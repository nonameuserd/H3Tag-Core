import { EventEmitter } from "events";
import WebSocket from "ws";
import { Logger } from "@h3tag-blockchain/shared";
import { CircuitBreaker } from "./circuit-breaker";
import { MetricsCollector } from "../monitoring/metrics-collector";
import { HybridCrypto } from "@h3tag-blockchain/crypto";
import { ConfigService } from "@h3tag-blockchain/shared";
import { Mutex } from "async-mutex";
import { randomBytes } from "crypto";
import { BlockchainSchema } from "../database/blockchain-schema";
import { PeerInfo, PeerMessageType } from "../models/peer.model";
import { BLOCKCHAIN_CONSTANTS } from "../blockchain/utils/constants";
import { Transaction } from "../models/transaction.model";
import { BlockInFlight } from "../blockchain/consensus/pow";
import { BlockchainSync } from "./sync";
export enum PeerState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  READY = "ready",
  SYNCING = "syncing",
  BANNED = "banned",
}

interface PeerConfig {
  version: number;
  services: number;
  minPingInterval: number;
  connectionTimeout: number;
  handshakeTimeout: number;
  messageTimeout: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  keepAlive: boolean;
  maxBufferSize: number;
  rateLimits: {
    messages: number;
    bytes: number;
    interval: number;
  };
  timeout?: number;
  maxBanScore: number;
}

export interface PeerMessage {
  type: PeerMessageType;
  payload: any;
  checksum?: string;
}

export interface PeerDetailedInfo {
  id: string;
  address: string;
  port: number;
  version: string;
  state: PeerState;
  services: number;
  lastSeen: number;
  lastSend: number;
  lastReceive: number;
  connectionTime: number;
  bytesReceived: number;
  bytesSent: number;
  messagesReceived: number;
  messagesSent: number;
  latency: number;
  inbound: boolean;
  startingHeight: number;
  banScore: number;
  syncedHeaders: number;
  syncedBlocks: number;
  inflight: number[];
  whitelisted: boolean;
  blacklisted: boolean;
  capabilities: string[];
  userAgent: string;
}

export class Peer {
  private ws: WebSocket | null = null;
  private state: PeerState = PeerState.DISCONNECTED;
  private readonly config: PeerConfig;
  private readonly metrics: MetricsCollector;
  private readonly mutex = new Mutex();
  private readonly messageQueue: PeerMessage[] = [];
  private readonly pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason?: any) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  private lastPing: number = 0;
  private pingInterval?: NodeJS.Timeout;
  private reconnectAttempts: number = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private handshakeTimer?: NodeJS.Timeout;
  private bytesReceived: number = 0;
  private bytesSent: number = 0;
  private messagesSent: number = 0;
  private messagesReceived: number = 0;
  private lastMessageTime: number = 0;
  private version?: number;
  private services?: number;
  private startHeight?: number;
  private userAgent?: string;
  private blockchainSync: BlockchainSync;
  public readonly eventEmitter = new EventEmitter();
  private readonly circuitBreaker: CircuitBreaker;
  private readonly peerId: string = crypto.randomUUID();

  private readonly latencyWindow: number[] = [];
  private static readonly MAX_LATENCY_SAMPLES = 10;
  private static readonly LATENCY_WINDOW_MS = 60000; // 1 minute

  private lastVoteTime: number | null = null;

  private id: string;

  private peerState: { banScore: number } = { banScore: 0 };

  private database: BlockchainSchema;

  private inbound: boolean = false;

  private syncedHeaders: number = 0;
  private syncedBlocks: number = 0;
  private inflightBlocks: Set<number> = new Set();
  private isWhitelisted: boolean = false;
  private isBlacklisted: boolean = false;

  private readonly blocksInFlight = new Map<number, BlockInFlight>();

  private readonly peers: Set<string> = new Set();

  private height: number = 0;

  constructor(
    private readonly address: string,
    private readonly port: number,
    config: Partial<PeerConfig>,
    private readonly configService: ConfigService,
    database: BlockchainSchema,
    isInbound: boolean = false
  ) {
    this.id = crypto.randomUUID();

    this.config = {
      version: 70015, // Bitcoin protocol version
      services: 1, // NODE_NETWORK
      minPingInterval: 120000, // 2 minutes
      connectionTimeout: 10000,
      handshakeTimeout: 30000,
      messageTimeout: 30000,
      maxReconnectAttempts: 3,
      reconnectDelay: 5000,
      keepAlive: true,
      maxBufferSize: 10000000, // 10MB
      rateLimits: {
        messages: 100,
        bytes: 5000000, // 5MB
        interval: 60000, // 1 minute
      },
      maxBanScore: 100, // Default max ban score
      ...config,
    };

    this.metrics = new MetricsCollector(`peer_${this.address}`);
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 60000,
    });

    this.database = database;

    this.inbound = isInbound;

    // Check configured lists
    const whitelistedPeers =
      (this.configService.get("WHITELISTED_PEERS") as string)?.split(",") || [];
    const blacklistedPeers =
      (this.configService.get("BLACKLISTED_PEERS") as string)?.split(",") || [];

    this.isWhitelisted = whitelistedPeers.includes(
      `${this.address}:${this.port}`
    );
    this.isBlacklisted = blacklistedPeers.includes(
      `${this.address}:${this.port}`
    );

    if (this.isBlacklisted) {
      Logger.warn(`Peer ${this.address}:${this.port} is blacklisted`);
    }

    if (this.isWhitelisted) {
      Logger.info(`Peer ${this.address}:${this.port} is whitelisted`);
    }

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.eventEmitter.on("message", this.handleMessage.bind(this));
    this.eventEmitter.on("error", this.handleError.bind(this));
    this.eventEmitter.on("close", this.handleClose.bind(this));
  }

  public async connect(): Promise<void> {
    if (this.state !== PeerState.DISCONNECTED) {
      throw new Error("Peer is not in disconnected state");
    }

    const release = await this.mutex.acquire();
    try {
      this.state = PeerState.CONNECTING;
      this.ws = new WebSocket(`wss://${this.address}:${this.port}`, {
        handshakeTimeout: this.config.handshakeTimeout,
        maxPayload: this.config.maxBufferSize,
        perMessageDeflate: true,
      });

      await this.setupWebSocket();
      await this.performHandshake();

      this.startPingInterval();
      this.state = PeerState.READY;
      this.eventEmitter.emit("ready");
    } catch (error) {
      this.handleConnectionError(error);
      throw error;
    } finally {
      release();
    }
  }

  private async setupWebSocket(): Promise<void> {
    if (!this.ws) throw new Error("WebSocket not initialized");

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout"));
      }, this.config.connectionTimeout);

      this.ws!.on("open", () => {
        clearTimeout(timeout);
        this.state = PeerState.CONNECTED;
        this.eventEmitter.emit("connect");
        resolve();
      })
        .on("message", (data: WebSocket.Data) =>
          this.handleIncomingMessage(data)
        )
        .on("error", (error: Error) => this.handleError(error))
        .on("close", (code: number, reason: string) =>
          this.handleClose(code, reason)
        )
        .on("ping", () => this.ws?.pong())
        .on("pong", () => this.handlePong());
    });
  }

  private async performHandshake(): Promise<void> {
    this.handshakeTimer = setTimeout(() => {
      this.disconnect(1002, "Handshake timeout");
    }, this.config.handshakeTimeout);

    await this.sendVersion();
    await this.waitForVerack();
  }

  private async handleIncomingMessage(data: WebSocket.Data): Promise<void> {
    try {
      this.updateMessageMetrics(data);

      if (!this.checkRateLimits()) {
        this.eventEmitter.emit("error", new Error("Rate limit exceeded"));
        return;
      }

      const message = this.parseMessage(data);
      if (!message) return;

      this.lastMessageTime = Date.now();
      this.messagesReceived++;
      this.eventEmitter.emit("message", message);

      await this.processMessage(message);
    } catch (error) {
      Logger.error("Error handling incoming message:", error);
      this.eventEmitter.emit("error", error);
    }
  }

  private async processMessage(message: PeerMessage): Promise<void> {
    switch (message.type) {
      case PeerMessageType.VERSION:
        await this.handleVersion(message.payload);
        break;
      case PeerMessageType.VERACK:
        this.handleVerack();
        break;
      case PeerMessageType.PING:
        await this.handlePing(message.payload);
        break;
      case PeerMessageType.INV:
        await this.handleInventory(message.payload);
        break;
      case PeerMessageType.TX:
        await this.handleTransactionMessage(message.payload);
        break;
      // ... handle other message types
      default:
        this.eventEmitter.emit("unknown_message", message);
    }
  }

  public async send(type: PeerMessageType, payload: any): Promise<void> {
    if (!this.isConnected()) {
      throw new Error("Peer not connected");
    }

    const message: PeerMessage = {
      type,
      payload,
      checksum: await this.calculateChecksum(payload),
    };

    return new Promise((resolve, reject) => {
      this.ws!.send(JSON.stringify(message), (error) => {
        if (error) {
          this.handleError(error);
          reject(error);
        } else {
          this.updateSendMetrics(message);
          resolve();
        }
      });
    });
  }

  public async request(
    type: PeerMessageType,
    payload: any,
    timeout = this.config.messageTimeout
  ): Promise<any> {
    const requestId = randomBytes(32).toString("hex");

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${type}`));
      }, timeout);

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutId,
      });
      this.send(type, { ...payload, requestId }).catch(reject);
    });
  }

  public disconnect(code = 1000, reason = "Normal closure"): void {
    if (this.ws && this.isConnected()) {
      this.ws.close(code, reason);
    }

    this.cleanup();
  }

  private cleanup(): void {
    this.state = PeerState.DISCONNECTED;
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.handshakeTimer) clearTimeout(this.handshakeTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.pendingRequests.forEach(({ timeout }) => clearTimeout(timeout));
    this.pendingRequests.clear();
    this.messageQueue.length = 0;
    this.ws = null;
  }

  // Utility methods
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private async calculateChecksum(payload: any): Promise<string> {
    const data =
      typeof payload === "string" ? payload : JSON.stringify(payload);
    return await HybridCrypto.hash(data);
  }

  private checkRateLimits(): boolean {
    // Implement rate limiting logic
    return true;
  }

  private updateMessageMetrics(data: WebSocket.Data): void {
    this.bytesReceived += data.toString().length;
    this.metrics.increment("bytes_received", data.toString().length);
    this.metrics.increment("messages_received");
  }

  private updateSendMetrics(message: PeerMessage): void {
    const size = JSON.stringify(message).length;
    this.bytesSent += size;
    this.messagesSent++;
    this.metrics.increment("bytes_sent", size);
    this.metrics.increment("messages_sent");
  }

  // Getters
  public getState(): PeerState {
    return this.state;
  }

  public getAddress(): string {
    return this.address;
  }

  public getVersion(): number | undefined {
    return this.version;
  }

  public getLastSeen(): number {
    return this.lastMessageTime;
  }

  public getMetrics(): any {
    return {
      bytesReceived: this.bytesReceived,
      bytesSent: this.bytesSent,
      messagesReceived: this.messagesReceived,
      messagesSent: this.messagesSent,
      lastSeen: this.lastMessageTime,
      state: this.state,
      version: this.version,
      services: this.services,
    };
  }

  public async getNodeInfo(): Promise<{
    isMiner: boolean;
    publicKey: { address: string };
    signature: { address: string };
    tagInfo: {
      minedBlocks: number;
      votingPower: bigint;
      voteParticipation: number;
      lastVoteHeight: number;
    };
  }> {
    const response = await this.request(PeerMessageType.GET_NODE_INFO, {});
    return {
      ...response,
      publicKey: { address: response.address || "" },
      signature: { address: response.signatureAddress || "" },
      tagInfo: {
        ...response.tagInfo,
        lastVoteHeight: response.tagInfo.lastVoteHeight || 0,
      },
    };
  }

  public getInfo(): PeerInfo {
    return {
      id: this.peerId,
      url: `${this.address}:${this.port}`,
      version: this.version?.toString() || "1",
      height: this.startHeight || 0,
      lastSeen: this.lastMessageTime,
      latency: this.getLatency(),
      capabilities: ["sync", "transactions"],
      connectedAt: this.lastMessageTime,
      consensusRole: "participant",
      consensusStats: {
        powContributions: 0,
        votingParticipation: 0,
        lastVoteHeight: 0,
        reputation: 0,
      },
      currency: {
        name: BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
        symbol: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        decimals: BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
        currentSupply: 0,
        maxSupply: BLOCKCHAIN_CONSTANTS.CURRENCY.MAX_SUPPLY,
        blockReward: Number(BLOCKCHAIN_CONSTANTS.MINING.BLOCK_REWARD),
      },
      services: this.services,
    };
  }

  private getLatency(): number {
    try {
      // Remove old samples (older than LATENCY_WINDOW_MS)
      const now = Date.now();
      while (
        this.latencyWindow.length > 0 &&
        now - this.latencyWindow[0] > Peer.LATENCY_WINDOW_MS
      ) {
        this.latencyWindow.shift();
      }

      if (this.latencyWindow.length === 0) {
        return 0;
      }

      // Calculate average latency from recent samples
      const sum = this.latencyWindow.reduce((a, b) => a + b, 0);
      return Math.round(sum / this.latencyWindow.length);
    } catch (error) {
      Logger.error("Failed to calculate latency:", error);
      return 0;
    }
  }

  // Add this method to update latency samples
  public updateLatency(rtt: number): void {
    this.latencyWindow.push(rtt);
    while (this.latencyWindow.length > Peer.MAX_LATENCY_SAMPLES) {
      this.latencyWindow.shift();
    }
  }

  public async getPeers(): Promise<{ url: string }[]> {
    const response = await this.request(PeerMessageType.GETADDR, {});
    return response as { url: string }[];
  }

  public hasVoted(): boolean {
    return this.lastVoteTime !== null;
  }

  public getVoteTime(): number | null {
    return this.lastVoteTime;
  }

  public getId(): string {
    return this.id;
  }

  private async handleMessage(message: PeerMessage): Promise<void> {
    await this.processMessage(message);
  }

  private handleError(error: Error): void {
    Logger.error("Peer error:", error);
    this.eventEmitter.emit("error", error);
  }

  private handleClose(code: number, reason: string): void {
    this.cleanup();
    this.eventEmitter.emit("close", code, reason);
  }

  public async handshake(): Promise<{
    version: number;
    services: number;
    height: number;
    peers: number;
    isMiner: boolean;
    publicKey: { address: string };
    signature: { address: string };
    minedBlocks: number;
    voteParticipation: number;
    lastVoteHeight: number;
    votingPower?: number;
  }> {
    await this.connect();
    const nodeInfo = await this.getNodeInfo();

    return {
      version: this.version || 0,
      services: this.services || 0,
      height: this.startHeight || 0,
      peers: this.peers.size || 0,
      isMiner: nodeInfo.isMiner,
      publicKey: nodeInfo.publicKey,
      signature: nodeInfo.signature,
      minedBlocks: nodeInfo.tagInfo.minedBlocks,
      voteParticipation: nodeInfo.tagInfo.voteParticipation,
      lastVoteHeight: nodeInfo.tagInfo.lastVoteHeight,
      votingPower: Number(nodeInfo.tagInfo.votingPower) || 0,
    };
  }

  private startPingInterval(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(async () => {
      try {
        await this.send(PeerMessageType.PING, { timestamp: Date.now() });
      } catch (error) {
        Logger.error("Ping failed:", error);
      }
    }, this.config.minPingInterval);
  }

  private handleConnectionError(error: any): void {
    Logger.error("Connection error:", error);
    this.state = PeerState.DISCONNECTED;
    this.eventEmitter.emit("error", error);
    this.cleanup();
  }

  private handlePong(): void {
    const rtt = Date.now() - this.lastPing;
    this.updateLatency(rtt);
    this.lastPing = Date.now();
  }

  private async sendVersion(): Promise<void> {
    await this.send(PeerMessageType.VERSION, {
      version: this.config.version,
      services: this.config.services,
      timestamp: Date.now(),
      height: this.startHeight || 0,
    });
  }

  private async waitForVerack(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Verack timeout"));
      }, this.config.handshakeTimeout);

      this.eventEmitter.once(PeerMessageType.VERACK, () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  private parseMessage(data: WebSocket.Data): PeerMessage | null {
    try {
      const message = JSON.parse(data.toString()) as PeerMessage;
      if (
        !message.type ||
        !Object.values(PeerMessageType).includes(message.type)
      ) {
        Logger.warn("Invalid message type received");
        return null;
      }
      return message;
    } catch (error) {
      Logger.error("Failed to parse message:", error);
      return null;
    }
  }

  private async handleVersion(payload: any): Promise<void> {
    this.version = payload.version;
    this.services = payload.services;
    this.startHeight = payload.startHeight;
    this.userAgent = payload.userAgent;
    await this.send(PeerMessageType.VERACK, {});
  }

  private handleVerack(): void {
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = undefined;
    }
    this.eventEmitter.emit(PeerMessageType.VERACK);
  }

  private async handlePing(payload: any): Promise<void> {
    await this.send(PeerMessageType.PONG, payload);
  }

  private async handleInventory(
    payload: { type: string; hash: string }[]
  ): Promise<void> {
    this.eventEmitter.emit("inventory", payload);
  }

  public adjustPeerScore(adjustment: number): void {
    const currentScore = this.peerState?.banScore || 0;
    this.updatePeerState({ banScore: currentScore + adjustment });

    if (currentScore + adjustment >= this.config.maxBanScore) {
      this.disconnect(1008, "Ban score exceeded");
    }
  }

  private updatePeerState(update: Partial<typeof this.peerState>): void {
    this.peerState = { ...this.peerState, ...update };
  }

  public async getBlockHeight(): Promise<number> {
    try {
      const response = await this.request(PeerMessageType.GET_NODE_INFO, {
        metric: "blockHeight",
      });
      const height = response?.blockHeight || this.startHeight || 0;

      // Update peer state in database
      await this.database.put(`peer:${this.id}:height`, height.toString());

      return height;
    } catch (error) {
      Logger.error("Failed to get block height:", error);
      // Fallback to last known height from database
      const stored = await this.database
        .get(`peer:${this.id}:height`)
        .catch(() => "0");
      return parseInt(stored) || 0;
    }
  }

  public async getMinedBlocks(): Promise<number> {
    try {
      const response = await this.request(PeerMessageType.GET_NODE_INFO, {
        metric: "minedBlocks",
      });
      const minedBlocks = response?.minedBlocks || 0;

      // Update mined blocks count in database
      await this.database.put(
        `peer:${this.id}:minedBlocks`,
        minedBlocks.toString()
      );

      return minedBlocks;
    } catch (error) {
      Logger.error("Failed to get mined blocks:", error);
      // Fallback to last known count from database
      const stored = await this.database
        .get(`peer:${this.id}:minedBlocks`)
        .catch(() => "0");
      return parseInt(stored) || 0;
    }
  }

  public async getVoteParticipation(): Promise<number> {
    const now = Date.now();
    try {
      const recentVotes = await this.database.db.iterator({
        gte: `peer:${this.id}:vote:${now - 24 * 60 * 60 * 1000}`, // Last 24 hours
        lte: `peer:${this.id}:vote:${now}`,
      });

      let voteCount = 0;
      for await (const [key, value] of recentVotes) {
        voteCount++;
      }

      // Calculate participation rate (0-1)
      const participation = voteCount / (24 * 60); // Expected votes per minute
      return Math.min(participation, 1);
    } catch (error) {
      Logger.error("Failed to get vote participation:", error);
      return this.lastVoteTime && now - this.lastVoteTime < 3600000 ? 1 : 0;
    }
  }

  // Helper method to record votes
  public async recordVote(): Promise<void> {
    const timestamp = Date.now();
    this.lastVoteTime = timestamp;

    try {
      await this.database.put(
        `peer:${this.id}:vote:${timestamp}`,
        JSON.stringify({
          timestamp,
          height: await this.getBlockHeight(),
        })
      );
    } catch (error) {
      Logger.error("Failed to record vote:", error);
    }
  }

  public async validatePeerCurrency(peerInfo: PeerInfo): Promise<boolean> {
    try {
      if (
        !peerInfo.currency?.symbol ||
        peerInfo.currency.symbol !== BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL
      ) {
        return false;
      }
      const response = await this.request(PeerMessageType.GET_NODE_INFO, {
        metric: "currency",
      });
      return response?.currency === BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL;
    } catch (error) {
      Logger.error("Currency validation failed:", error);
      return false;
    }
  }

  public getAverageBandwidth(): number {
    const timeWindow = 60000; // 1 minute
    const totalBytes = this.bytesSent + this.bytesReceived;
    return (totalBytes / timeWindow) * 1000; // Convert to bytes/second
  }

  public isBanned(): boolean {
    return (
      this.state === PeerState.BANNED ||
      (this.peerState?.banScore || 0) >= this.config.maxBanScore
    );
  }

  /**
   * Send transaction to peer
   * @param tx Transaction to send
   * @returns Promise<void>
   */
  public async sendTransaction(tx: Transaction): Promise<void> {
    try {
      // Rate limiting check
      if (!this.checkRateLimits()) {
        throw new Error("Rate limit exceeded");
      }

      // Send transaction message
      await this.send(PeerMessageType.TX, {
        transaction: tx,
        timestamp: Date.now(),
      });

      // Update metrics
      this.metrics.increment("transactions_sent");

      Logger.debug("Transaction sent to peer", {
        peerId: this.getId(),
        txId: tx.id,
      });
    } catch (error) {
      Logger.error("Failed to send transaction to peer:", {
        peerId: this.getId(),
        error: error.message,
      });

      // Increase ban score for failed transactions
      this.adjustPeerScore(1);
      throw error;
    }
  }

  /**
   * Handle incoming transaction message
   * @param payload Transaction message payload
   */
  private async handleTransactionMessage(payload: any): Promise<void> {
    try {
      const { transaction, timestamp } = payload;

      // Basic validation
      if (!transaction || !timestamp) {
        throw new Error("Invalid transaction message format");
      }

      // Check message age
      const messageAge = Date.now() - timestamp;
      if (messageAge > BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_MESSAGE_AGE) {
        throw new Error("Transaction message too old");
      }

      // Emit transaction received event
      this.eventEmitter.emit("transaction", transaction);

      // Update metrics
      this.metrics.increment("transactions_received");
    } catch (error) {
      Logger.error("Transaction message handling failed:", {
        peerId: this.getId(),
        error: error.message,
      });
      this.adjustPeerScore(1);
    }
  }

  /**
   * Ban or unban a peer
   * @param command 'add' to ban, 'remove' to unban
   * @param banTime Duration of ban in seconds (0 for permanent)
   * @param reason Reason for the ban
   */
  public async setBan(
    command: "add" | "remove",
    banTime: number = 0,
    reason: string = ""
  ): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      const banKey = `ban:${this.address}`;

      if (command === "add") {
        // Calculate ban expiration
        const banExpiration = banTime === 0 ? 0 : Date.now() + banTime * 1000;

        const banData = {
          address: this.address,
          timestamp: Date.now(),
          expiration: banExpiration,
          reason,
          banScore: this.peerState.banScore,
        };

        // Store ban information
        await this.database.put(banKey, JSON.stringify(banData));

        // Update peer state
        this.state = PeerState.BANNED;

        // Disconnect the peer
        this.disconnect(1008, `Banned: ${reason}`);

        // Log the ban
        Logger.warn(`Peer banned: ${this.address}`, {
          reason,
          duration: banTime === 0 ? "permanent" : `${banTime}s`,
          banScore: this.peerState.banScore,
        });

        // Emit ban event
        this.eventEmitter.emit("banned", banData);
      } else if (command === "remove") {
        // Remove ban record
        await this.database.del(banKey);

        // Reset ban score
        this.peerState.banScore = 0;

        // Log unban
        Logger.info(`Peer unbanned: ${this.address}`);

        // Emit unban event
        this.eventEmitter.emit("unbanned", { address: this.address });
      }
    } catch (error) {
      Logger.error("Failed to set ban status:", error);
      throw error;
    } finally {
      release();
    }
  }

  /**
   * Check if peer is currently banned
   * @returns Promise<boolean>
   */
  public async checkBanStatus(): Promise<boolean> {
    try {
      const banKey = `ban:${this.address}`;
      const banData = await this.database.get(banKey);

      if (!banData) {
        return false;
      }

      const ban = JSON.parse(banData);

      // Check if ban has expired
      if (ban.expiration !== 0 && ban.expiration < Date.now()) {
        // Remove expired ban
        await this.setBan("remove");
        return false;
      }

      return true;
    } catch (error) {
      // If no ban record exists, peer is not banned
      if (error.type === "NotFoundError") {
        return false;
      }
      Logger.error("Failed to check ban status:", error);
      throw error;
    }
  }

  /**
   * Get ban information for the peer
   * @returns Promise<BanInfo | null>
   */
  public async getBanInfo(): Promise<{
    address: string;
    timestamp: number;
    expiration: number;
    reason: string;
    banScore: number;
  } | null> {
    try {
      const banKey = `ban:${this.address}`;
      const banData = await this.database.get(banKey);

      if (!banData) {
        return null;
      }

      return JSON.parse(banData);
    } catch (error) {
      if (error.type === "NotFoundError") {
        return null;
      }
      Logger.error("Failed to get ban info:", error);
      throw error;
    }
  }

  /**
   * List all banned peers
   * @returns Promise<Array<BanInfo>>
   */
  public async listBans(): Promise<
    Array<{
      address: string;
      timestamp: number;
      expiration: number;
      reason: string;
      banScore: number;
      timeRemaining: number;
    }>
  > {
    try {
      const bans: any[] = [];

      // Iterate through database to find ban records
      for await (const [key, value] of this.database.iterator({
        gte: "ban:",
        lte: "ban:\xFF",
      })) {
        const banData = JSON.parse(value);
        const now = Date.now();

        // Calculate remaining ban time
        const timeRemaining =
          banData.expiration === 0
            ? 0 // Permanent ban
            : Math.max(0, banData.expiration - now); // Temporary ban

        // Add ban info with remaining time
        bans.push({
          ...banData,
          timeRemaining,
        });
      }

      // Sort by timestamp (most recent first)
      return bans.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      Logger.error("Failed to list bans:", error);
      throw error;
    }
  }

  /**
   * Remove ban for a specific peer address
   * @param address Peer address to unban
   * @returns Promise<boolean> True if ban was removed, false if peer wasn't banned
   */
  public async removeBan(address: string): Promise<boolean> {
    const release = await this.mutex.acquire();
    try {
      const banKey = `ban:${address}`;

      // Check if peer is banned
      const banData = await this.database.get(banKey);
      if (!banData) {
        return false;
      }

      // Remove ban record
      await this.database.del(banKey);

      // Log unban
      Logger.info(`Removed ban for peer: ${address}`);

      // Emit unban event
      this.eventEmitter.emit("unbanned", { address });

      return true;
    } catch (error) {
      if (error.type === "NotFoundError") {
        return false;
      }
      Logger.error("Failed to remove ban:", error);
      throw error;
    } finally {
      release();
    }
  }

  /**
   * Clear all bans
   * @returns Promise<number> Number of bans cleared
   */
  public async clearBans(): Promise<number> {
    const release = await this.mutex.acquire();
    try {
      let count = 0;

      // Iterate and remove all ban records
      for await (const [key] of this.database.iterator({
        gte: "ban:",
        lte: "ban:\xFF",
      })) {
        await this.database.del(key);
        count++;
      }

      Logger.info(`Cleared ${count} peer bans`);
      this.eventEmitter.emit("bansCleared", { count });

      return count;
    } catch (error) {
      Logger.error("Failed to clear bans:", error);
      throw error;
    } finally {
      release();
    }
  }

  public isInbound(): boolean {
    return this.inbound;
  }

  public isVerified(): boolean {
    return this.state === PeerState.READY;
  }

  public getBytesReceived(): number {
    return this.bytesReceived;
  }

  public getBytesSent(): number {
    return this.bytesSent;
  }

  public getPeerInfo(): PeerDetailedInfo {
    const now = Date.now();
    const connectionDuration = this.lastMessageTime
      ? now - this.lastMessageTime
      : 0;

    return {
      id: this.peerId,
      address: this.address,
      port: this.port,
      version: this.version?.toString() || "unknown",
      state: this.state,
      services: this.services || 0,
      lastSeen: this.lastMessageTime,
      lastSend: this.bytesSent > 0 ? this.lastMessageTime : 0,
      lastReceive: this.bytesReceived > 0 ? this.lastMessageTime : 0,
      connectionTime: connectionDuration,
      bytesReceived: this.bytesReceived,
      bytesSent: this.bytesSent,
      messagesReceived: this.messagesReceived,
      messagesSent: this.messagesSent,
      latency: this.getLatency(),
      inbound: this.inbound,
      startingHeight: this.startHeight || 0,
      banScore: this.peerState.banScore,
      syncedHeaders: this.blockchainSync.headerSync.currentHeight,
      syncedBlocks: this.syncedBlocks,
      inflight: this.getInflightBlocks().map((block) => block.height),
      whitelisted: this.isWhitelisted,
      blacklisted: this.isBlacklisted,
      capabilities: [
        "NETWORK",
        this.services ? "BLOOM" : "",
        this.services ? "WITNESS" : "",
        this.services ? "COMPACT_FILTERS" : "",
      ].filter(Boolean),
      userAgent: this.userAgent || "unknown",
    };
  }

  public updateSyncedBlocks(height: number): void {
    this.syncedBlocks = Math.max(this.syncedBlocks, height);
    this.metrics.gauge("synced_blocks", this.syncedBlocks);
  }

  public setWhitelisted(status: boolean): void {
    // Only allow manual whitelisting if peer is in configured whitelist
    const whitelistedPeers =
      (this.configService.get("WHITELISTED_PEERS") as string)?.split(",") || [];
    const isPeerInWhitelist = whitelistedPeers.includes(
      `${this.address}:${this.port}`
    );

    if (!isPeerInWhitelist && status) {
      Logger.warn(
        `Cannot whitelist peer ${this.peerId} - not in configured whitelist`
      );
      return;
    }

    this.isWhitelisted = status;
    this.metrics.gauge("whitelisted", status ? 1 : 0);
    Logger.info(`Peer ${this.peerId} whitelist status set to ${status}`);
  }

  public setBlacklisted(status: boolean): void {
    this.isBlacklisted = status;
    this.metrics.gauge("blacklisted", status ? 1 : 0);
    Logger.info(`Peer ${this.peerId} blacklist status set to ${status}`);

    if (status) {
      // Automatically disconnect blacklisted peers
      this.disconnect(1008, "Peer blacklisted");
      this.adjustPeerScore(this.config.maxBanScore);
    }
  }

  public isBlocked(): boolean {
    return this.isBlacklisted || this.isBanned();
  }

  public getInflightBlocks(): BlockInFlight[] {
    return Array.from(this.blocksInFlight.values());
  }

  public getHeight(): number {
    return this.height;
  }

  public setHeight(height: number): void {
    this.height = height;
  }
}
