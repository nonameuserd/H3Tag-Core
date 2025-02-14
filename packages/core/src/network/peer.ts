import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { Logger } from '@h3tag-blockchain/shared';
import { CircuitBreaker } from './circuit-breaker';
import { MetricsCollector } from '../monitoring/metrics-collector';
import { HybridCrypto } from '@h3tag-blockchain/crypto';
import { Mutex } from 'async-mutex';
import { randomBytes } from 'crypto';
import { BlockchainSchema } from '../database/blockchain-schema';
import {
  MessagePayload,
  PeerInfo,
  PeerMessageType,
  PeerServices,
} from '../models/peer.model';
import { BLOCKCHAIN_CONSTANTS } from '../blockchain/utils/constants';
import { Transaction } from '../models/transaction.model';
import { BlockInFlight } from '../blockchain/consensus/pow';
import { BlockchainSync } from './sync';
import { Metric } from '../monitoring/performance-metrics';
import { Vote } from '../models/vote.model';
import { VotingDatabase } from '../database/voting-schema';
import { ConfigService } from '@h3tag-blockchain/shared';
import crypto from 'crypto';

export enum PeerState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  READY = 'ready',
  SYNCING = 'syncing',
  BANNED = 'banned',
}

export interface Ban {
  address: string;
  timestamp: number;
  expiration: number;
  reason: string;
  banScore: number;
  timeRemaining: number;
}

export interface PeerUpdateInfo {
  version: number;
  services: PeerServices[];
  startHeight: number;
  userAgent?: string;
  lastSeen: number;
}

export interface VersionPayload {
  version: number;
  services?: PeerServices[];
  startHeight?: number;
  userAgent?: string;
  timestamp: number;
  inventory?: { type: string; hash: string }[];
}

export interface PeerConfig {
  version: number;
  services: PeerServices[];
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
  payload: MessagePayload;
  checksum?: string;
  version?: string;
}

export interface PeerDetailedInfo {
  id: string;
  address: string;
  port: number;
  version: string;
  state: PeerState;
  services: PeerServices[];
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
      resolve: (value: MessagePayload) => void;
      reject: (reason?: string) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  private lastPing = 0;
  private pingInterval?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private handshakeTimer?: NodeJS.Timeout;
  private bytesReceived = 0;
  private bytesSent = 0;
  private messagesSent = 0;
  private messagesReceived = 0;
  private lastMessageTime = 0;
  private version?: number;
  private services?: PeerServices[];
  private count = 0;
  private durations: number[] = [];
  private timestamps: number[] = [];
  private totalDuration = 0;
  private maxDuration = 0;
  private minDuration = 0;
  private last24Hours: number[] = [];
  private lastUpdated = 0;
  private average = 0;
  private startHeight?: number;
  private userAgent?: string;
  private blockchainSync: BlockchainSync | undefined;
  public readonly eventEmitter = new EventEmitter();
  private readonly circuitBreaker: CircuitBreaker;
  private id: string;

  private readonly latencyWindow: number[] = [];
  private static readonly MAX_LATENCY_SAMPLES = 10;
  private static readonly LATENCY_WINDOW_MS = 60000; // 1 minute

  private lastVoteTime: number | null = null;

  private peerState: { banScore: number } = { banScore: 0 };

  private database: BlockchainSchema;
  private votingDatabase: VotingDatabase | undefined;

  private inbound = false;

  private syncedHeaders = 0;
  private syncedBlocks = 0;
  private isWhitelisted = false;
  private isBlacklisted = false;

  private readonly blocksInFlight = new Map<number, BlockInFlight>();

  private readonly peers: Set<string> = new Set();

  private height = 0;

  private messageTimestamps: number[] = [];
  private messageByteRecords: { timestamp: number; bytes: number }[] = [];
  private lastBytesReceived = 0;

  constructor(
    private readonly address: string,
    private readonly port: number,
    config: Partial<PeerConfig>,
    private readonly configService: ConfigService,
    database: BlockchainSchema,
    isInbound = false,
  ) {
    this.id = crypto.randomUUID();

    this.config = {
      version: 70015,
      services: [PeerServices.NODE],
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
      (this.configService.get('WHITELISTED_PEERS') as string)?.split(',') || [];
    const blacklistedPeers =
      (this.configService.get('BLACKLISTED_PEERS') as string)?.split(',') || [];

    this.isWhitelisted = whitelistedPeers.includes(
      `${this.address}:${this.port}`,
    );
    this.isBlacklisted = blacklistedPeers.includes(
      `${this.address}:${this.port}`,
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
    this.eventEmitter.on('message', this.handleMessage.bind(this));
    this.eventEmitter.on('error', this.handleError.bind(this));
    this.eventEmitter.on('close', this.handleClose.bind(this));
  }

  public async connect(): Promise<void> {
    if (this.state !== PeerState.DISCONNECTED) {
      throw new Error('Peer is not in disconnected state');
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
      this.eventEmitter.emit('ready');
    } catch (error: unknown) {
      this.handleConnectionError(error as Error);
      throw error;
    } finally {
      release();
    }
  }

  private async setupWebSocket(): Promise<void> {
    if (!this.ws) throw new Error('WebSocket not initialized');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.connectionTimeout);

      this.ws!.once('open', () => {
        clearTimeout(timeout);
        this.state = PeerState.CONNECTED;
        this.eventEmitter.emit('connect');
        resolve();
      });

      // Listen once for error so we can reject immediately.
      this.ws!.once('error', (error: Error) => {
        clearTimeout(timeout);
        this.handleError(error);
        reject(error);
      });

      this.ws!.on('message', (data: WebSocket.Data) =>
        this.handleIncomingMessage(data),
      )
        .on('close', (code: number, reason: string) =>
          this.handleClose(code, reason),
        )
        .on('ping', () => this.ws?.pong())
        .on('pong', () => this.handlePong());
    });
  }

  private async performHandshake(): Promise<void> {
    this.handshakeTimer = setTimeout(() => {
      this.disconnect(1002, 'Handshake timeout');
    }, this.config.handshakeTimeout);

    await this.sendVersion();
    await this.waitForVerack();
  }

  private async handleIncomingMessage(data: WebSocket.Data): Promise<void> {
    try {
      this.updateMessageMetrics(data);

      if (!this.checkRateLimits()) {
        this.eventEmitter.emit('error', new Error('Rate limit exceeded'));
        return;
      }

      const message = this.parseMessage(data);
      if (!message) return;

      // NEW: Check if the message is a response to a previous request.
      const reqId = message.payload?.requestId;
      if (reqId && this.pendingRequests.has(reqId)) {
        const pending = this.pendingRequests.get(reqId)!;
        clearTimeout(pending.timeout);
        pending.resolve(message.payload);
        this.pendingRequests.delete(reqId);
        return; // Do not process this message further.
      }

      this.lastMessageTime = Date.now();
      this.messagesReceived++;
      this.eventEmitter.emit('message', message);
      await this.processMessage(message);
    } catch (error) {
      Logger.error('Error handling incoming message:', error);
      this.eventEmitter.emit('error', error);
    }
  }

  private async processMessage(message: PeerMessage): Promise<void> {
    switch (message.type) {
      case PeerMessageType.VERSION:
        await this.handleVersion({
          version: message.payload.version || 0,
          timestamp: message.payload.timestamp || 0,
        });
        break;
      case PeerMessageType.VERACK:
        this.handleVerack();
        break;
      case PeerMessageType.PING:
        await this.handlePing(message.payload);
        break;
      case PeerMessageType.INV:
        await this.handleInventory(message.payload.inventory || []);
        break;
      case PeerMessageType.TX:
        await this.handleTransactionMessage(message.payload as { transaction: Transaction; timestamp: number });
        break;
      case PeerMessageType.BLOCK:
        if (message.payload.block) {
          await this.handleBlockMessage(message.payload.block);
        }
        break;
      case PeerMessageType.GET_VOTES:
        await this.handleGetVotes();
        break;
      case PeerMessageType.GET_HEADERS:
        if (message.payload.headers) {
          await this.handleGetHeaders({
            locator: message.payload.headers[0].locator,
            hashStop: message.payload.headers[0].hashStop,
          });
        }
        break;
      case PeerMessageType.GET_BLOCKS:
        if (message.payload.blocks) {
          await this.handleGetBlocks({
            locator: message.payload.blocks[0].header.locator,
            hash: message.payload.blocks[0].header.hashStop,
          });
        }
        break;
      case PeerMessageType.GET_NODE_INFO:
        await this.handleGetNodeInfo();
        break;
      default:
        this.eventEmitter.emit('unknown_message', message);
    }
  }

  public async send(
    type: PeerMessageType,
    payload: MessagePayload,
  ): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Peer not connected');
    }

    // Wrap the send operation in the circuit breaker.
    // If too many send attempts fail, circuitBreaker.run() will short-circuit.
    return this.circuitBreaker.run(async () => {
      const message: PeerMessage = {
        type,
        payload,
        version: this.version?.toString(),
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
    });
  }

  public async request(
    type: PeerMessageType,
    payload: MessagePayload,
    timeout = this.config.messageTimeout,
  ): Promise<MessagePayload> {
    const requestId = randomBytes(32).toString('hex');

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
      this.send(type, { ...payload, requestId }).catch((error) => {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(requestId);
        reject(error);
      });
    });
  }

  public disconnect(code = 1000, reason = 'Normal closure'): void {
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

  private async calculateChecksum(payload: MessagePayload): Promise<string> {
    const data =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    return await HybridCrypto.hash(data);
  }

  private checkRateLimits(): boolean {
    const now = Date.now();
    const interval = this.config.rateLimits.interval;

    // Clean up old message count timestamps.
    while (this.messageTimestamps.length > 0 && this.messageTimestamps[0] < now - interval) {
      this.messageTimestamps.shift();
    }
    // Clean up old byte records.
    this.messageByteRecords = this.messageByteRecords.filter(record => record.timestamp >= now - interval);

    // Check message count limit.
    if (this.messageTimestamps.length >= this.config.rateLimits.messages) {
      Logger.warn(`Peer ${this.address} exceeded message rate limit`);
      this.adjustPeerScore(1);
      return false;
    }
    
    // SUM the bytes received in the interval.
    const totalBytes = this.messageByteRecords.reduce((sum, record) => sum + record.bytes, 0);
    if (totalBytes > this.config.rateLimits.bytes) {
      Logger.warn(`Peer ${this.address} exceeded bandwidth limit`);
      this.adjustPeerScore(1);
      return false;
    }
    
    // Record the new message timestamp.
    this.messageTimestamps.push(now);
    return true;
  }

  private updateMessageMetrics(data: WebSocket.Data): void {
    let messageBuffer: Buffer;
    if (typeof data === 'string') {
      messageBuffer = Buffer.from(data);
    } else if (data instanceof Buffer) {
      messageBuffer = data;
    } else {
      messageBuffer = Buffer.from(data.toString());
    }
    const byteCount = messageBuffer.byteLength;
    this.bytesReceived += byteCount;
    this.metrics.increment('bytes_received', byteCount);
    this.metrics.increment('messages_received');

    // NEW: Record the size and timestamp for bandwidth tracking.
    this.messageByteRecords.push({ timestamp: Date.now(), bytes: byteCount });
  }

  private updateSendMetrics(message: PeerMessage): void {
    const size = JSON.stringify(message).length;
    this.bytesSent += size;
    this.messagesSent++;
    this.metrics.increment('bytes_sent', size);
    this.metrics.increment('messages_sent');
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

  public getMetrics(): Metric {
    return {
      bytesReceived: this.bytesReceived,
      bytesSent: this.bytesSent,
      messagesReceived: this.messagesReceived,
      messagesSent: this.messagesSent,
      lastSeen: this.lastMessageTime,
      state: this.state,
      version: this.version,
      services: this.services,
      count: this.count,
      durations: this.durations,
      timestamps: this.timestamps,
      totalDuration: this.totalDuration,
      maxDuration: this.maxDuration,
      minDuration: this.minDuration,
      last24Hours: this.last24Hours || [],
      lastUpdated: this.lastUpdated || 0,
      average: this.average || 0,
    };
  }

  public async getNodeInfo(): Promise<{
    isMiner: boolean;
    publicKey: string;
    signature: string;
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
      publicKey: response.publicKey || '',
      signature: response.signature || '',
      tagInfo: {
        ...response.tagInfo,
        lastVoteHeight: response.tagInfo?.lastVoteHeight || 0,
        minedBlocks: await this.getMinedBlocks(),
        voteParticipation: await this.getVoteParticipation(),
        votingPower: await this.getVotingPower(),
      },
      isMiner: response.isMiner || false,
    };
  }

  public async getInfo(): Promise<PeerInfo> {
    return {
      id: this.id,
      url: `${this.address}:${this.port}`,
      timestamp: Date.now(),
      version: this.version?.toString() || '1',
      height: this.startHeight || 0,
      lastSeen: this.lastMessageTime,
      latency: this.getLatency(),
      capabilities: ['sync', 'transactions'],
      connectedAt: this.lastMessageTime,
      consensusRole: 'participant',
      consensusStats: {
        powContributions: await this.getMinedBlocks(),
        votingParticipation: await this.getVoteParticipation(),
        lastVoteHeight: this.lastVoteTime ? await this.getBlockHeight() : 0,
        reputation: this.peerState?.banScore
          ? 100 - this.peerState.banScore
          : 100,
      },
      peers: this.peers.size,
      currency: {
        name: BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
        symbol: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        decimals: BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
        currentSupply: 0,
        maxSupply: BLOCKCHAIN_CONSTANTS.CURRENCY.MAX_SUPPLY,
        blockReward: Number(BLOCKCHAIN_CONSTANTS.MINING.BLOCK_REWARD),
      },
      services: Object.values(PeerServices)
        .filter(
          (service): service is PeerServices => typeof service === 'number',
        )
        .filter((service) => {
          const currentServices = this.services || [PeerServices.NODE];
          return currentServices.some((s) => s & service);
        }),
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
      Logger.error('Failed to calculate latency:', error);
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
    Logger.error('Peer error:', error);
    this.eventEmitter.emit('error', error);
  }

  private handleClose(code: number, reason: string): void {
    this.cleanup();
    this.eventEmitter.emit('close', code, reason);
  }

  public async handshake(): Promise<{
    version: number;
    services: PeerServices[];
    height: number;
    peers: number;
    isMiner: boolean;
    publicKey: string;
    signature: string;
    minedBlocks: number;
    voteParticipation: number;
    lastVoteHeight: number;
    votingPower?: number;
  }> {
    await this.connect();
    const nodeInfo = await this.getNodeInfo();

    return {
      version: this.version || 0,
      services: this.services || [],
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
        // Record the ping send time.
        this.lastPing = Date.now();
        await this.send(PeerMessageType.PING, { timestamp: this.lastPing });
      } catch (error) {
        Logger.error('Ping failed:', error);
      }
    }, this.config.minPingInterval).unref();
  }

  private handleConnectionError(error: Error): void {
    Logger.error('Connection error:', error);
    this.state = PeerState.DISCONNECTED;
    this.eventEmitter.emit('error', error);
    this.cleanup();
  }

  private handlePong(): void {
    const rtt = Date.now() - this.lastPing;
    this.updateLatency(rtt);
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
        reject(new Error('Verack timeout'));
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
        Logger.warn('Invalid message type received');
        return null;
      }
      return message;
    } catch (error) {
      Logger.error('Failed to parse message:', error);
      return null;
    }
  }

  private async handleVersion(payload: VersionPayload): Promise<void> {
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

  private async handlePing(payload: MessagePayload): Promise<void> {
    await this.send(PeerMessageType.PONG, payload);
  }

  private async handleInventory(
    inventory: Array<{ type: string; hash: string }>,
  ): Promise<void> {
    try {
      if (!Array.isArray(inventory)) {
        throw new Error('Invalid inventory format');
      }

      // Process each inventory item
      for (const item of inventory) {
        if (!item.type || !item.hash) {
          Logger.warn('Invalid inventory item format', item);
          continue;
        }

        // Update metrics
        this.metrics.increment(`inventory_received_${item.type.toLowerCase()}`);

        // Handle different inventory types
        switch (item.type) {
          case 'BLOCK':
            await this.handleBlockInventory(item.hash);
            break;
          case 'TX':
            await this.handleTransactionInventory(item.hash);
            break;
          default:
            Logger.debug(`Unhandled inventory type: ${item.type}`);
        }
      }

      // Emit inventory event for external handlers
      this.eventEmitter.emit('inventory', inventory);
    } catch (error) {
      Logger.error('Error processing inventory:', error);
      this.adjustPeerScore(1); // Penalize peer for invalid inventory
    }
  }

  private async handleBlockInventory(hash: string): Promise<void> {
    // Check if we already have this block
    const hasBlock = await this.database.hasBlock(hash);
    if (!hasBlock) {
      this.eventEmitter.emit('new_block', { hash });
    }
  }

  private async handleTransactionInventory(hash: string): Promise<void> {
    // Check if we already have this transaction
    const hasTx = await this.database.hasTransaction(hash);
    if (!hasTx) {
      this.eventEmitter.emit('new_transaction', { hash });
    }
  }

  public adjustPeerScore(adjustment: number): void {
    const currentScore = this.peerState?.banScore || 0;
    this.updatePeerState({ banScore: currentScore + adjustment });

    if (currentScore + adjustment >= this.config.maxBanScore) {
      this.disconnect(1008, 'Ban score exceeded');
    }
  }

  private updatePeerState(update: Partial<typeof this.peerState>): void {
    this.peerState = { ...this.peerState, ...update };
  }

  public async getBlockHeight(): Promise<number> {
    try {
      const response = await this.request(PeerMessageType.GET_NODE_INFO, {
        metric: 'blockHeight',
      });
      const height = response?.headers?.[0]?.height || this.startHeight || 0;

      // Update peer state in database
      await this.database.put(`peer:${this.id}:height`, height.toString());

      return height;
    } catch (error) {
      Logger.error('Failed to get block height:', error);
      // Fallback to last known height from database
      const stored = await this.database
        .get(`peer:${this.id}:height`)
        .catch(() => '0');
      return parseInt(stored) || 0;
    }
  }

  public async getMinedBlocks(): Promise<number> {
    try {
      const response = await this.request(PeerMessageType.GET_NODE_INFO, {
        metric: 'minedBlocks',
      });
      const minedBlocks = response?.minedBlocks || 0;

      // Update mined blocks count in database
      await this.database.put(
        `peer:${this.id}:minedBlocks`,
        minedBlocks.toString(),
      );

      return minedBlocks;
    } catch (error) {
      Logger.error('Failed to get mined blocks:', error);
      // Fallback to last known count from database
      const stored = await this.database
        .get(`peer:${this.id}:minedBlocks`)
        .catch(() => '0');
      return parseInt(stored) || 0;
    }
  }

  public async getVoteParticipation(): Promise<number> {
    const now = Date.now();
    try {
      const recentVotes = this.database.db.iterator({
        gte: `peer:${this.id}:vote:${now - 24 * 60 * 60 * 1000}`, // Last 24 hours
        lte: `peer:${this.id}:vote:${now}`,
      });

      let voteCount = 0;
      for await (const [, value] of recentVotes) {
        const vote = this.votingDatabase?.getSafeParse<Vote>(value);
        if (vote && this.votingDatabase?.getValidateVote(vote)) {
          voteCount++;
        }
      }

      // Calculate participation rate (0-1)
      const participation = voteCount / (24 * 60); // Expected votes per minute
      return Math.min(participation, 1);
    } catch (error) {
      Logger.error('Failed to get vote participation:', error);
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
        }),
      );
    } catch (error) {
      Logger.error('Failed to record vote:', error);
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
        metric: 'currency',
      });
      return (
        response?.currency?.symbol === BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL
      );
    } catch (error) {
      Logger.error('Currency validation failed:', error);
      return false;
    }
  }

  public getAverageBandwidth(): number {
    const timeWindow = 60000; // 1 minute
    const totalBytes = Number(this.bytesSent) + Number(this.bytesReceived);
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
        throw new Error('Rate limit exceeded');
      }

      // Send transaction message
      await this.send(PeerMessageType.TX, {
        transaction: tx,
        timestamp: Date.now(),
      });

      // Update metrics
      this.metrics.increment('transactions_sent');

      Logger.debug('Transaction sent to peer', {
        peerId: this.getId(),
        txId: tx.id,
      });
    } catch (error: unknown) {
      Logger.error('Failed to send transaction to peer:', {
        peerId: this.getId(),
        error: (error as Error).message,
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
  private async handleTransactionMessage(payload: { transaction: Transaction; timestamp: number }): Promise<void> {
    try {
      const { transaction, timestamp } = payload;

      // Basic validation
      if (!transaction || !timestamp) {
        throw new Error('Invalid transaction message format');
      }

      // Check message age
      const messageAge = Date.now() - timestamp;
      if (messageAge > BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_MESSAGE_AGE) {
        throw new Error('Transaction message too old');
      }

      // Emit transaction received event
      this.eventEmitter.emit('transaction', transaction);

      // Update metrics
      this.metrics.increment('transactions_received');
    } catch (error: unknown) {
      Logger.error('Transaction message handling failed:', {
        peerId: this.getId(),
        error: (error as Error).message,
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
    command: 'add' | 'remove',
    banTime = 0,
    reason = '',
  ): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      const banKey = `ban:${this.address}`;

      if (command === 'add') {
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
          duration: banTime === 0 ? 'permanent' : `${banTime}s`,
          banScore: this.peerState.banScore,
        });

        // Emit ban event
        this.eventEmitter.emit('banned', banData);
      } else if (command === 'remove') {
        // Remove ban record
        await this.database.del(banKey);

        // Reset ban score
        this.peerState.banScore = 0;

        // Log unban
        Logger.info(`Peer unbanned: ${this.address}`);

        // Emit unban event
        this.eventEmitter.emit('unbanned', { address: this.address });
      }
    } catch (error) {
      Logger.error('Failed to set ban status:', error);
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
        await this.setBan('remove');
        return false;
      }

      return true;
    } catch (error) {
      // If no ban record exists, peer is not banned
      if ((error as Error).name === 'NotFoundError') {
        return false;
      }
      Logger.error('Failed to check ban status:', error);
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
    } catch (error: unknown) {
      if ((error as Error).name === 'NotFoundError') {
        return null;
      }
      Logger.error('Failed to get ban info:', error);
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
      const bans: Ban[] = [];

      // Iterate through database to find ban records
      for await (const [, value] of this.database.iterator({
        gte: 'ban:',
        lte: 'ban:\xFF',
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
      Logger.error('Failed to list bans:', error);
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
      this.eventEmitter.emit('unbanned', { address });

      return true;
    } catch (error: unknown) {
      if ((error as Error).name === 'NotFoundError') {
        return false;
      }
      Logger.error('Failed to remove ban:', error);
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
        gte: 'ban:',
        lte: 'ban:\xFF',
      })) {
        await this.database.del(key);
        count++;
      }

      Logger.info(`Cleared ${count} peer bans`);
      this.eventEmitter.emit('bansCleared', { count });

      return count;
    } catch (error) {
      Logger.error('Failed to clear bans:', error);
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
      id: this.id,
      address: this.address,
      port: this.port,
      version: this.version?.toString() || 'unknown',
      state: this.state,
      services: this.services || [],
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
      syncedHeaders: this.blockchainSync?.headerSync?.currentHeight || 0,
      syncedBlocks: this.syncedBlocks,
      inflight: this.getInflightBlocks().map((block) => block.height),
      whitelisted: this.isWhitelisted,
      blacklisted: this.isBlacklisted,
      capabilities: [
        'NETWORK',
        this.services ? 'BLOOM' : '',
        this.services ? 'WITNESS' : '',
        this.services ? 'COMPACT_FILTERS' : '',
      ].filter(Boolean),
      userAgent: this.userAgent || 'unknown',
    };
  }

  public updateSyncedBlocks(height: number): void {
    this.syncedBlocks = Math.max(this.syncedBlocks, height);
    this.metrics.gauge('synced_blocks', this.syncedBlocks);
  }

  public setWhitelisted(status: boolean): void {
    // Only allow manual whitelisting if peer is in configured whitelist
    const whitelistedPeers =
      (this.configService.get('WHITELISTED_PEERS') as string)?.split(',') || [];
    const isPeerInWhitelist = whitelistedPeers.includes(
      `${this.address}:${this.port}`,
    );

    if (!isPeerInWhitelist && status) {
      Logger.warn(
        `Cannot whitelist peer ${this.id} - not in configured whitelist`,
      );
      return;
    }

    this.isWhitelisted = status;
    this.metrics.gauge('whitelisted', status ? 1 : 0);
    Logger.info(`Peer ${this.id} whitelist status set to ${status}`);
  }

  public setBlacklisted(status: boolean): void {
    this.isBlacklisted = status;
    this.metrics.gauge('blacklisted', status ? 1 : 0);
    Logger.info(`Peer ${this.id} blacklist status set to ${status}`);

    if (status) {
      // Automatically disconnect blacklisted peers
      this.disconnect(1008, 'Peer blacklisted');
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

  public async getVotingPower(): Promise<bigint> {
    const release = await this.mutex.acquire();
    try {
      // Check cache first
      const cacheKey = `votingPower:${this.id}`;
      const cached = this.database.cache.get(cacheKey);
      if (cached && typeof cached === 'object' && 'balance' in cached) {
        return BigInt(cached.balance);
      }

      // Get balance from database
      const stored = await this.database.get(`peer:${this.id}:balance`);
      if (stored) {
        const balance = BigInt(stored);
        const votingPower = BigInt(Math.floor(Math.sqrt(Number(balance))));
        this.database.cache.set(cacheKey, {
          balance: votingPower,
          holdingPeriod: 0,
        });
        return votingPower;
      }

      // If not found, fetch from peer
      const response = await this.request(PeerMessageType.GET_NODE_INFO, {
        metric: 'balance',
      });
      const balance = BigInt(response?.balance || 0);
      const votingPower = BigInt(Math.floor(Math.sqrt(Number(balance))));

      // Store in database and cache
      await this.database.put(
        `peer:${this.id}:balance`,
        balance.toString(),
      );
      this.database.cache.set(cacheKey, {
        balance: votingPower,
        holdingPeriod: 0,
      });

      return votingPower;
    } catch (error) {
      Logger.error('Failed to get voting power:', error);
      return BigInt(0);
    } finally {
      release();
    }
  }

  public async updateInfo(info: PeerUpdateInfo): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      this.version = info.version;
      this.services = info.services;
      this.startHeight = info.startHeight;
      this.userAgent = info.userAgent;
      this.lastMessageTime = info.lastSeen;

      // Update database
      await this.database.put(`peer:${this.id}:info`, JSON.stringify(info));

      Logger.debug(`Updated peer info: ${this.id}`, info);
    } catch (error) {
      Logger.error('Failed to update peer info:', error);
      throw error;
    } finally {
      release();
    }
  }

  private async handleBlockMessage(
    blockMessage: MessagePayload,
  ): Promise<void> {
    try {
      this.eventEmitter.emit('block', blockMessage.block);
      this.metrics.increment('blocks_received');
    } catch (error) {
      Logger.error('Block message handling failed:', error);
      this.adjustPeerScore(1);
    }
  }

  private async handleGetVotes(): Promise<void> {
    try {
      const votes = await this.votingDatabase?.getVotes();
      await this.send(PeerMessageType.GET_VOTES, { votes });
    } catch (error: unknown) {
      Logger.error('Get votes handling failed:', (error as Error).message);
    }
  }

  private async handleGetHeaders(payload: {
    locator: string[];
    hashStop: string;
  }): Promise<void> {
    try {
      const headers = await this.database.getHeaders(
        payload.locator,
        payload.hashStop,
      );
      await this.send(PeerMessageType.HEADERS, { headers });
    } catch (error) {
      Logger.error('Get headers handling failed:', error);
    }
  }

  private async handleGetBlocks(payload: {
    locator: string[];
    hash: string;
  }): Promise<void> {
    try {
      const blocks = await this.database.getBlocks(
        payload.locator,
        payload.hash,
      );
      await this.send(PeerMessageType.GET_BLOCKS, { blocks });
    } catch (error) {
      Logger.error('Get blocks handling failed:', error);
    }
  }

   /**
   * Retrieve the local node's public key (production code should fetch it from the wallet or key management service)
   */
   private async getPublicKey(): Promise<string> {
    // First, check if a public key is configured.
    const configuredPublicKey = process.env.NODE_PUBLIC_KEY || (this.configService.get('NODE_PUBLIC_KEY') as string);
    if (configuredPublicKey) {
      return configuredPublicKey;
    }
    
    // If not, derive the public key from the provided private key.
    const privateKey = process.env.NODE_PRIVATE_KEY || (this.configService.get('NODE_PRIVATE_KEY') as string);
    if (!privateKey) {
      throw new Error('NODE_PRIVATE_KEY is not configured');
    }

    // Use the ECC curve to generate the public key from the private key.
    const publicKey = HybridCrypto.TRADITIONAL_CURVE
      .keyFromPrivate(privateKey, 'hex')
      .getPublic('hex');
    return publicKey;
  }
  
  /**
   * Retrieve the local node's signature
   */
  private async getSignature(): Promise<string> {
    const privateKey = process.env.NODE_PRIVATE_KEY || (this.configService.get('NODE_PRIVATE_KEY') as string);
    if (!privateKey) {
      throw new Error('NODE_PRIVATE_KEY is not configured');
    }
    const message = 'node_info';
    // Retrieve the raw key pair.
    const rawKeyPair = HybridCrypto.TRADITIONAL_CURVE.keyFromPrivate(privateKey, 'hex');
    // Wrap the raw key pair into the expected HybridKeyPair type
    const hybridKeyPair = {
        address: rawKeyPair.getPublic('hex'),   // You may derive the address properly if needed
        privateKey: rawKeyPair.getPrivate('hex'),
        publicKey: rawKeyPair.getPublic('hex'),
    };
    const sign = await HybridCrypto.sign(message, hybridKeyPair);
    return sign;
  }

  private async handleGetNodeInfo(): Promise<void> {
    try {
      const publicKey = await this.getPublicKey();
      const signature = await this.getSignature();
      const minedBlocks = await this.getMinedBlocks();
      const voteParticipation = await this.getVoteParticipation();
      const lastVoteHeight = await this.getBlockHeight();
      const votingPower = await this.getVotingPower();
      const isMiner = (this.configService.get('IS_MINER') as string) === 'true';

      const localNodeInfo = {
        publicKey,
        signature,
        tagInfo: {
          minedBlocks,
          voteParticipation,
          lastVoteHeight,
          votingPower,
        },
        isMiner,
      };
      await this.send(PeerMessageType.GET_NODE_INFO, localNodeInfo);
    } catch (error) {
      Logger.error('Get node info handling failed:', error);
    }
  }
}
