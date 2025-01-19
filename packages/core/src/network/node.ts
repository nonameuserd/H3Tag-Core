import { EventEmitter } from 'events';
import { Logger } from '@h3tag-blockchain/shared';
import { Blockchain } from '../blockchain/blockchain';
import { Peer } from './peer';
import { BlockchainSchema } from '../database/blockchain-schema';
import { Mempool } from '../blockchain/mempool';
import { Block } from '../models/block.model';
import { Transaction } from '../models/transaction.model';
import { DNSSeeder } from './dnsSeed';
import { CircuitBreaker } from './circuit-breaker';
import { Cache } from '../scaling/cache';
import { Mutex } from 'async-mutex';
import { MetricsCollector } from '../monitoring/metrics-collector';
import { HealthMonitor } from '../monitoring/health';
import { DDoSProtection } from '../security/ddos';
import { AuditManager } from '../security/audit';
import { ConfigService } from '@h3tag-blockchain/shared';
import { NetworkType } from './dnsSeed';
import { PeerDiscovery, PeerType } from './discovery';
import { UTXOSet } from '../models/utxo.model';
import {
  MessagePayload,
  PeerMessageType,
  PeerServices,
} from '../models/peer.model';
import { BLOCKCHAIN_CONSTANTS } from '../blockchain/utils/constants';
import { TransactionBuilder } from '../models/transaction.model';
import { NodeVerifier } from './verification';

interface NodeConfig {
  networkType: NetworkType;
  port: number;
  maxPeers: number;
  minPeers: number;
  connectionTimeout: number;
  syncInterval: number;
  banTime: number;
  maxBanScore: number;
  pruneInterval: number;
  maxOrphans: number;
  maxReorg: number;
  services: PeerServices[];
}

interface PeerState {
  id: string;
  address: string;
  port: number;
  version: number;
  services: PeerServices[];
  lastSeen: number;
  banScore: number;
  synced: boolean;
  height: number;
}

export class Node {
  private readonly config: NodeConfig;
  private readonly peers: Map<string, Peer>;
  private readonly peerStates: Map<string, PeerState>;
  private readonly bannedPeers: Map<string, number>;
  private readonly orphanBlocks: Map<string, Block>;
  private readonly orphanTxs: Map<string, Transaction>;
  private readonly seeder: DNSSeeder;
  private readonly metrics: MetricsCollector;
  private readonly health: HealthMonitor;
  private readonly ddosProtection: DDoSProtection;
  private readonly audit: AuditManager;
  private readonly peerCircuitBreakers: Map<string, CircuitBreaker>;
  private readonly mutex = new Mutex();
  private readonly peerCache: Cache<PeerState>;
  private isRunning = false;
  private maintenanceTimer?: NodeJS.Timeout;
  private readonly discovery: PeerDiscovery;
  private readonly eventEmitter: EventEmitter;

  private static readonly DEFAULT_CONFIG: NodeConfig = {
    networkType:
      NetworkType[BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.type.MAINNET],
    port: BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.port.MAINNET,
    maxPeers: 100000,
    minPeers: 1,
    connectionTimeout: BLOCKCHAIN_CONSTANTS.UTIL.VALIDATION_TIMEOUT_MS,
    syncInterval: 10000,
    banTime: 86400000, // 24 hours
    maxBanScore: 100,
    pruneInterval: 3600000, // 1 hour
    maxOrphans: BLOCKCHAIN_CONSTANTS.MINING.ORPHAN_WINDOW,
    maxReorg: BLOCKCHAIN_CONSTANTS.MINING.MAX_FORK_DEPTH,
    services: [PeerServices.NODE],
  };

  constructor(
    private readonly blockchain: Blockchain,
    private readonly db: BlockchainSchema,
    private readonly mempool: Mempool,
    private readonly configService: ConfigService,
    private readonly auditManager: AuditManager,
  ) {
    this.config = {
      ...Node.DEFAULT_CONFIG,
      ...configService.getConfig(),
    };

    this.peers = new Map();
    this.peerStates = new Map();
    this.bannedPeers = new Map();
    this.orphanBlocks = new Map();
    this.orphanTxs = new Map();
    this.peerCircuitBreakers = new Map();

    this.seeder = new DNSSeeder(configService, db, {
      networkType: this.config.networkType,
      port: this.config.port,
    });

    this.metrics = new MetricsCollector('node');
    this.health = new HealthMonitor({
      interval: 60000,
      thresholds: {
        minPowHashrate: 1000000000,
        minPowNodes: 100,
        minTagDistribution: 0.5,
        maxTagConcentration: 0.2,
      },
    });
    this.ddosProtection = new DDoSProtection(
      {
        maxRequests: {
          pow: 200,
          qudraticVote: 100,
          default: 50,
        },
        windowMs: 60000, // 1 minute
      },
      this.audit,
    );
    this.audit = new AuditManager();

    this.peerCache = new Cache<PeerState>({
      ttl: 3600000, // 1 hour
      maxSize: 1000,
    });

    this.discovery = new PeerDiscovery(configService, mempool, new UTXOSet());

    // Setup event handlers
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.eventEmitter.on('peer:connect', this.handlePeerConnect.bind(this));
    this.eventEmitter.on(
      'peer:disconnect',
      this.handlePeerDisconnect.bind(this),
    );
    this.eventEmitter.on('peer:message', this.handlePeerMessage.bind(this));
    this.eventEmitter.on('peer:error', this.handlePeerError.bind(this));
    this.eventEmitter.on('block:received', this.handleBlockReceived.bind(this));
    this.eventEmitter.on(
      'tx:received',
      this.handleTransactionReceived.bind(this),
    );
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      this.isRunning = true;

      // Start DNS seeder
      await this.seeder.start();

      // Load cached peer data
      await this.loadPeerCache();

      // Initial peer discovery
      await this.discoverPeers();

      // Start maintenance timer
      this.maintenanceTimer = setInterval(
        () => this.performMaintenance(),
        this.config.pruneInterval,
      );

      Logger.info('Node started successfully', {
        network: this.config.networkType,
        port: this.config.port,
      });
    } catch (error) {
      this.isRunning = false;
      Logger.error('Failed to start node:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      this.isRunning = false;

      // Clear maintenance timer
      if (this.maintenanceTimer) {
        clearInterval(this.maintenanceTimer);
      }

      // Disconnect all peers
      await Promise.all(
        Array.from(this.peers.values()).map((peer) => peer.disconnect()),
      );

      // Stop DNS seeder
      await this.seeder.stop();

      // Save peer cache
      await this.savePeerCache();

      Logger.info('Node stopped successfully');
    } catch (error) {
      Logger.error('Error stopping node:', error);
      throw error;
    }
  }

  // Peer Management Methods
  public async discoverPeers(): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      if (this.peers.size >= this.config.maxPeers) return;

      const peerAddresses = this.discovery.getPeersByType(PeerType.FULL_NODE);
      const connectPromises = peerAddresses
        .filter((addr) => !this.peers.has(addr) && !this.isBanned(addr))
        .slice(0, this.config.maxPeers - this.peers.size)
        .map((addr) => this.connectToPeer(addr));

      await Promise.allSettled(connectPromises);

      this.metrics.gauge('peer_count', this.peers.size);

      if (this.peers.size < this.config.minPeers) {
        Logger.warn('Low peer count', {
          current: this.peers.size,
          minimum: this.config.minPeers,
        });
      }
    } finally {
      release();
    }
  }

  public async connectToPeer(address: string): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      // Early checks
      if (this.peers.has(address)) return;
      if (this.isBanned(address)) return;

      const breaker = this.getCircuitBreaker(address);
      if (!breaker.isAvailable()) return;

      // Create temporary peer connection to get node info
      const tempPeer = new Peer(
        address,
        this.config.port,
        {
          version: this.blockchain.getVersion(),
          services: this.config.services,
          timeout: this.config.connectionTimeout,
        },
        this.configService,
        this.db,
      );

      // Get node info through handshake
      const nodeInfo = await tempPeer.handshake();

      // Verify the node using NodeVerifier
      const isVerified = await NodeVerifier.verifyNode({
        version: nodeInfo.version.toString(),
        height: nodeInfo.height,
        peers: nodeInfo.peers || 0,
        isMiner: nodeInfo.isMiner || false,
        publicKey: nodeInfo.publicKey,
        signature: nodeInfo.signature,
        timestamp: Date.now(),
        address: address,
        tagInfo: {
          minedBlocks: nodeInfo.minedBlocks || 0,
          voteParticipation: nodeInfo.voteParticipation || 0,
          lastVoteHeight: nodeInfo.lastVoteHeight || 0,
          currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
          votingPower: nodeInfo.votingPower,
        },
      });

      if (!isVerified) {
        Logger.warn('Peer verification failed', { address });
        tempPeer.disconnect();
        this.increasePeerBanScore(address, 10);
        return;
      }

      // If verification passed, use the peer
      this.peers.set(address, tempPeer);
      this.updatePeerState(address, {
        id: tempPeer.getId(),
        address,
        port: this.config.port,
        version: nodeInfo.version,
        services: nodeInfo.services,
        lastSeen: Date.now(),
        banScore: 0,
        synced: false,
        height: nodeInfo.height,
      });

      breaker.onSuccess();
      this.eventEmitter.emit('peer:connect', tempPeer);

      Logger.info('Peer connected and verified', {
        address,
        version: nodeInfo.version,
        height: nodeInfo.height,
      });
    } catch (error) {
      this.getCircuitBreaker(address).onFailure();
      Logger.error('Failed to connect to peer:', {
        address,
        error: error.message,
      });
      this.increasePeerBanScore(address, 1);
    } finally {
      release();
    }
  }

  // Message Handling
  private async handlePeerMessage(
    peer: Peer,
    message: {
      type: PeerMessageType;
      data: MessagePayload;
    },
  ): Promise<void> {
    try {
      if (!this.ddosProtection.checkRequest('peer_message', peer.getId())) {
        this.increasePeerBanScore(peer.getId(), 10);
        return;
      }

      switch (message.type) {
        case 'block':
          await this.handleBlockMessage(peer, message.data.block);
          break;
        case 'tx':
          await this.handleTransactionMessage(peer, message.data.transaction);
          break;
        case 'inv':
          await this.handleInventoryMessage(peer, message.data.inventory);
          break;
        case 'getdata':
          await this.handleGetDataMessage(peer, message.data.data);
          break;
        case 'ping':
          await peer.send(PeerMessageType.PONG, {
            nonce: message.data.headers[0].nonce,
          });
          break;
        default:
          Logger.warn('Unknown message type:', message.type);
      }

      this.updatePeerLastSeen(peer.getId());
    } catch (error) {
      Logger.error('Error handling peer message:', {
        peerId: peer.getId(),
        error: error.message,
      });
      this.increasePeerBanScore(peer.getId(), 1);
    }
  }

  // Block and Transaction Handling
  private async handleBlockMessage(peer: Peer, block: Block): Promise<void> {
    try {
      if (this.blockchain.hasBlock(block.hash)) return;

      if (!(await this.blockchain.validateBlock(block))) {
        this.increasePeerBanScore(peer.getId(), 20);
        return;
      }

      if (
        !block.header.previousHash ||
        !this.blockchain.hasBlock(block.header.previousHash)
      ) {
        this.handleOrphanBlock(block);
        return;
      }

      await this.blockchain.addBlock(block);
      this.processOrphanBlocks(block.hash);
      this.eventEmitter.emit('block:received', block);
    } catch (error) {
      Logger.error('Error handling block message:', {
        blockHash: block.hash,
        error: error.message,
      });
    }
  }

  private async handleTransactionMessage(
    peer: Peer,
    tx: Transaction,
  ): Promise<void> {
    try {
      if (this.mempool.hasTransaction(tx.id)) return;

      if (
        !(await this.mempool.validateTransaction(
          tx,
          await this.blockchain.getUTXOSet(),
          this.blockchain.getCurrentHeight(),
        ))
      ) {
        this.increasePeerBanScore(peer.getId(), 10);
        return;
      }

      await this.mempool.addTransaction(tx);
      this.eventEmitter.emit('tx:received', tx);
    } catch (error) {
      Logger.error('Error handling transaction message:', {
        txId: tx.id,
        error: error.message,
      });
    }
  }

  // Peer State Management
  private updatePeerState(address: string, state: Partial<PeerState>): void {
    if (!address) {
      Logger.warn('Attempted to update state for null peer address');
      return;
    }

    const currentState = this.peerStates.get(address) || {
      id: '',
      address,
      port: this.config.port,
      version: 0,
      services: [],
      lastSeen: Date.now(),
      banScore: 0,
      synced: false,
      height: 0,
    };

    this.peerStates.set(address, { ...currentState, ...state });
    this.peerCache.set(address, this.peerStates.get(address)!);
  }

  private increasePeerBanScore(peerId: string, score: number): void {
    const state = this.peerStates.get(peerId);
    if (!state) return;

    state.banScore += score;
    if (state.banScore >= this.config.maxBanScore) {
      this.banPeer(peerId);
    }
  }

  private banPeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.disconnect();
      this.peers.delete(peerId);
      this.bannedPeers.set(peerId, Date.now() + this.config.banTime);

      Logger.warn('Peer banned:', {
        peerId,
        banScore: this.peerStates.get(peerId)?.banScore,
      });
    }
  }

  // Utility Methods
  private getCircuitBreaker(address: string): CircuitBreaker {
    if (!this.peerCircuitBreakers.has(address)) {
      this.peerCircuitBreakers.set(
        address,
        new CircuitBreaker({
          failureThreshold: 3,
          resetTimeout: 60000,
        }),
      );
    }
    return this.peerCircuitBreakers.get(address)!;
  }

  private isCompatibleVersion(version: number): boolean {
    const minVersion = this.configService.get('MIN_PEER_VERSION') as number;
    return version >= minVersion;
  }

  private isBanned(address: string): boolean {
    const banExpiry = this.bannedPeers.get(address);
    if (!banExpiry) return false;

    if (Date.now() >= banExpiry) {
      this.bannedPeers.delete(address);
      return false;
    }
    return true;
  }

  // Public Methods
  public getAddress(): string {
    return this.configService.get('NODE_ADDRESS');
  }

  public getPeerCount(): number {
    return this.peers.size;
  }

  public getBannedPeers(): string[] {
    return Array.from(this.bannedPeers.keys());
  }

  public async broadcastBlock(block: Block): Promise<void> {
    try {
      const promises = Array.from(this.peers.values()).map((peer) =>
        peer.send(PeerMessageType.BLOCK, block),
      );
      await Promise.allSettled(promises);
    } catch (error) {
      Logger.error('Failed to broadcast block:', error);
    }
  }

  public async broadcastTransaction(tx: Transaction): Promise<void> {
    const promises = Array.from(this.peers.values()).map((peer) =>
      peer.send(PeerMessageType.TX, { transaction: tx }),
    );
    await Promise.allSettled(promises);
  }

  private handlePeerConnect(peer: Peer): void {
    Logger.info('Peer connected:', peer.getId());
  }

  private handlePeerDisconnect(peer: Peer): void {
    const peerId = peer.getId();
    this.peers.delete(peerId);
    this.peerStates.delete(peerId);
    this.peerCircuitBreakers.delete(peerId);
    Logger.info('Peer disconnected:', peerId);
  }

  private handlePeerError(peer: Peer, error: Error): void {
    Logger.error('Peer error:', {
      peerId: peer.getId(),
      error: error.message,
    });
  }

  private handleBlockReceived(block: Block): void {
    Logger.info('Block received:', block.hash);
  }

  private handleTransactionReceived(tx: Transaction): void {
    Logger.info('Transaction received:', tx.id);
  }

  private async loadPeerCache(): Promise<void> {
    try {
      const cachedPeers = this.peerCache.getAll();
      for (const [address, state] of Object.entries(cachedPeers)) {
        this.peerStates.set(address, state);
      }
      Logger.debug('Loaded peer cache:', {
        peerCount: Object.keys(cachedPeers).length,
      });
    } catch (error) {
      Logger.error('Failed to load peer cache:', error);
    }
  }

  private async savePeerCache(): Promise<void> {
    try {
      for (const [address, state] of this.peerStates.entries()) {
        this.peerCache.set(address, state);
      }
      Logger.debug('Saved peer cache:', { peerCount: this.peerStates.size });
    } catch (error) {
      Logger.error('Failed to save peer cache:', error);
    }
  }

  private async performMaintenance(): Promise<void> {
    try {
      // Clean up stale peers
      await this.evictStalePeers();

      // Prune orphan blocks and transactions
      this.pruneOrphans();

      // Save peer cache
      await this.savePeerCache();

      Logger.debug('Maintenance completed');
    } catch (error) {
      Logger.error('Maintenance error:', error);
    }
  }

  private async evictStalePeers(): Promise<void> {
    const now = Date.now();
    const staleThreshold = now - this.config.connectionTimeout * 2;

    for (const [address, state] of this.peerStates.entries()) {
      if (state.lastSeen < staleThreshold) {
        const peer = this.peers.get(address);
        if (peer) {
          peer.disconnect();
          this.peers.delete(address);
        }
        this.peerStates.delete(address);
        Logger.debug('Evicted stale peer:', { address });
      }
    }
  }

  private pruneOrphans(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    for (const [key, block] of this.orphanBlocks.entries()) {
      if (now - block.timestamp > maxAge) {
        this.orphanBlocks.delete(key);
      }
    }
  }

  private async handleInventoryMessage(
    peer: Peer,
    data: { type: string; hash: string }[],
  ): Promise<void> {
    for (const item of data) {
      if (item.type === 'block' && !this.blockchain.hasBlock(item.hash)) {
        await peer.send(PeerMessageType.GETDATA, {
          hash: item.hash,
          type: 'block',
        });
      } else if (
        item.type === 'tx' &&
        !this.mempool.hasTransaction(item.hash)
      ) {
        await peer.send(PeerMessageType.GETDATA, {
          type: 'tx',
          hash: item.hash,
        });
      }
    }
  }

  private async handleGetDataMessage(
    peer: Peer,
    data: { type: string; hash: string }[],
  ): Promise<void> {
    for (const item of data) {
      if (item.type === 'block') {
        const block = await this.blockchain.getBlock(item.hash);
        if (block) await peer.send(PeerMessageType.BLOCK, block);
      } else if (item.type === 'tx') {
        const tx = this.mempool.getTransaction(item.hash);
        if (tx) await peer.send(PeerMessageType.TX, { transaction: tx });
      }
    }
  }

  private updatePeerLastSeen(peerId: string): void {
    this.updatePeerState(peerId, {
      lastSeen: Date.now(),
    });
  }

  private async handleOrphanBlock(block: Block): Promise<void> {
    const orphanKey = `${block.header.previousHash}:${block.hash}`;
    this.orphanBlocks.set(orphanKey, block);
    Logger.debug('Added orphan block:', {
      hash: block.hash,
      previousHash: block.header.previousHash,
    });
  }

  private async processOrphanBlocks(parentHash: string): Promise<void> {
    for (const [key, block] of this.orphanBlocks.entries()) {
      if (block.header.previousHash === parentHash) {
        await this.blockchain.addBlock(block);
        this.orphanBlocks.delete(key);
        await this.processOrphanBlocks(block.hash); // Recursively process children
      }
    }
  }

  public async getActiveValidators(): Promise<{ address: string }[]> {
    const [peerValidators, dbValidators] = await Promise.all([
      Array.from(this.peers.values())
        .filter((peer) => peer.isConnected() && peer.hasVoted())
        .map((peer) => ({ address: peer.getAddress() })),
      this.db.getActiveValidators(),
    ]);

    // Combine and deduplicate validators
    const uniqueAddresses = new Set([
      ...peerValidators.map((v) => v.address),
      ...dbValidators.map((v) => v.address),
    ]);

    return Array.from(uniqueAddresses).map((address) => ({ address }));
  }

  public async close(): Promise<void> {
    this.isRunning = false;
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
    }

    // Disconnect all peers
    const disconnectPromises = Array.from(this.peers.values()).map((peer) =>
      peer.disconnect(),
    );
    await Promise.all(disconnectPromises);

    this.peers.clear();
    this.peerStates.clear();
    await this.savePeerCache();
  }

  public getInfo() {
    return {
      networkType: this.config.networkType,
      port: this.config.port,
      peersCount: this.peers.size,
      version: this.blockchain.getVersion(),
      isRunning: this.isRunning,
      syncStatus: {
        synced: this.peers.size > 0,
        height: this.blockchain.getCurrentHeight(),
      },
    };
  }

  /**
   * Broadcast raw transaction to connected peers
   * @param rawTx Serialized transaction data
   * @returns Promise<string> Transaction ID
   */
  public async broadcastRawTransaction(rawTx: string): Promise<string> {
    const release = await this.mutex.acquire();
    try {
      // Deserialize and validate transaction
      const txBuilder = new TransactionBuilder();
      const txId = await txBuilder.sendRawTransaction(rawTx);

      // Get transaction object
      const tx = await this.db.getTransaction(txId);
      if (!tx) {
        throw new Error('Transaction not found after creation');
      }

      // Broadcast to all connected peers
      const broadcastPromises = Array.from(this.peers.values())
        .filter((peer) => peer.isConnected() && !peer.isBanned())
        .map((peer) => peer.sendTransaction(tx));

      // Wait for broadcast completion with timeout
      const results = await Promise.allSettled(broadcastPromises);

      // Check broadcast success rate
      const successCount = results.filter(
        (r) => r.status === 'fulfilled',
      ).length;
      const minPeers = Math.ceil(this.peers.size * 0.51); // Require >50% success

      if (successCount < minPeers) {
        throw new Error('Failed to broadcast to sufficient peers');
      }

      Logger.info('Transaction broadcast successful', {
        txId,
        successPeers: successCount,
        totalPeers: this.peers.size,
      });

      return txId;
    } catch (error) {
      Logger.error('Transaction broadcast failed:', error);
      throw error;
    } finally {
      release();
    }
  }

  public getMempool(): Mempool {
    return this.mempool;
  }

  public getConfig(): NodeConfig {
    return this.config;
  }

  public getPeer(address: string) {
    return this.peers.get(address);
  }
}
