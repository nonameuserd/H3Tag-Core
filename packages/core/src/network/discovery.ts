import * as dns from 'dns';
import { EventEmitter } from 'events';
import { Peer, PeerMessage } from './peer';
import { RateLimit } from '../security/rateLimit';
import { Cache } from '../scaling/cache';
import { AuditManager } from '../security/audit';
import { FileAuditStorage } from '../security/fileAuditStorage';
import { Mempool } from '../blockchain/mempool';
import { UTXOSet } from '../models/utxo.model';
import {
  MessagePayload,
  PeerInfo,
  PeerMessageType,
} from '../models/peer.model';
import { Logger } from '@h3tag-blockchain/shared';
import { ConfigService } from '@h3tag-blockchain/shared';
import { DiscoveryError } from './discovery-error';
import { BlockchainSchema } from '../database/blockchain-schema';
import { isIP } from 'net';

export enum DiscoveryState {
  INITIALIZING = 'INITIALIZING',
  ACTIVE = 'ACTIVE',
  SYNCING = 'SYNCING',
  ERROR = 'ERROR',
}

export enum PeerType {
  MINER = 'miner',
  FULL_NODE = 'full_node',
  LIGHT_NODE = 'light_node',
  VALIDATOR = 'validator',
}

interface PeerAddress {
  url: string;
  timestamp: number;
  services: number;
  attempts: number;
  lastSuccess: number;
  lastAttempt: number;
  banScore: number;
}

export interface AddrPayload {
  addresses: Array<{
    url: string;
    services: number;
    timestamp: number;
    lastSeen?: number;
  }>;
}

export class PeerDiscovery {
  private readonly peers: Map<string, Peer>;
  private readonly miners: Set<string>;
  private readonly bannedPeers: Map<string, number>;
  private readonly config: ConfigService;
  private readonly database: BlockchainSchema | undefined;
  private readonly rateLimit: RateLimit;
  private readonly peerCache: Cache<PeerInfo>;
  private readonly utxoSet: UTXOSet;
  private readonly mempool: Mempool;
  private state: DiscoveryState;
  private discoveryInterval: NodeJS.Timeout | undefined;
  private cleanupInterval: NodeJS.Timeout | undefined;
  private peerScores: Map<string, number>;
  private statePromise: Promise<void> = Promise.resolve();
  private readonly peerAddresses: Map<string, PeerAddress>;
  private readonly dnsSeeds: string[];
  private readonly banThreshold = 100;
  private feelerInterval: NodeJS.Timeout | undefined;

  private static readonly DISCOVERY_INTERVAL = 30000;
  private static readonly CLEANUP_INTERVAL = 300000;
  private static readonly PEER_CACHE_TTL = 3600;
  private static readonly BAN_DURATION = 24 * 60 * 60 * 1000;
  private static readonly MAX_PEER_AGE = 3 * 24 * 60 * 60 * 1000;
  private static readonly MAX_RECONNECT_ATTEMPTS = 3;
  private static readonly RECONNECT_DELAY = 5000;
  private readonly eventEmitter = new EventEmitter();

  constructor(config: ConfigService, mempool: Mempool, utxoSet: UTXOSet) {
    this.config = config;
    this.mempool = mempool;
    this.utxoSet = utxoSet;
    this.state = DiscoveryState.INITIALIZING;

    this.peers = new Map();
    this.miners = new Set();
    this.bannedPeers = new Map();
    this.peerScores = new Map();
    this.peerAddresses = new Map();
    this.dnsSeeds = (this.config.get('network.dnsSeeds') as string[]) || [];

    this.rateLimit = new RateLimit(
      {
        windowMs: 60000,
        maxRequests: {
          pow: 200,
          quadraticVote: 150,
          default: 100,
        },
        keyPrefix: 'peer_discovery:',
      },
      new AuditManager(new FileAuditStorage()),
    );

    this.peerCache = new Cache<PeerInfo>({
      ttl: PeerDiscovery.PEER_CACHE_TTL,
      checkPeriod: 600,
    });

    // Add feeler connection interval for testing new peers
    this.feelerInterval = setInterval(
      () => this.attemptFeelerConnection(),
      120000,
    );

    this.initializeDiscovery().catch((error) => {
      Logger.error('Discovery initialization failed:', error);
      this.state = DiscoveryState.ERROR;
      throw new DiscoveryError(
        'Failed to initialize peer discovery',
        'INIT_FAILED',
      );
    });
  }

  private async initializeDiscovery(): Promise<void> {
    try {
      await this.setState(DiscoveryState.INITIALIZING);

      // First try to load cached peers
      await this.loadCachedPeers();

      // If we don't have enough peers, query DNS seeds
      if (this.peers.size < this.getTargetOutbound()) {
        await this.queryDnsSeeds();
      }

      // Start periodic peer discovery
      this.discoveryInterval = setInterval(
        () => this.managePeerConnections(),
        PeerDiscovery.DISCOVERY_INTERVAL,
      );

      await this.setState(DiscoveryState.ACTIVE);
    } catch (error) {
      await this.setState(DiscoveryState.ERROR);
      throw error;
    }
  }

  private async queryDnsSeeds(): Promise<void> {
    for (const seed of this.dnsSeeds) {
      try {
        const addresses = await this.resolveDnsSeed(seed);
        addresses.forEach((addr) => {
          this.addPeerAddress({
            url: addr,
            timestamp: Date.now(),
            services: 0,
            attempts: 0,
            lastSuccess: 0,
            lastAttempt: 0,
            banScore: 0,
          });
        });
      } catch (error) {
        Logger.warn(`Failed to query DNS seed ${seed}:`, error);
      }
    }
  }

  private async managePeerConnections(): Promise<void> {
    const targetConnections = this.getTargetOutbound();

    // Remove excess connections
    while (this.peers.size > targetConnections) {
      const [oldestPeer] = Array.from(this.peers.entries())[0];
      await this.removePeer(oldestPeer);
    }

    // Add new connections if needed
    while (this.peers.size < targetConnections) {
      const candidate = this.selectPeerCandidate();
      if (!candidate) break;

      try {
        await this.connectToPeer(candidate.url);
        this.updatePeerScore(candidate.url, 1);
      } catch (error: unknown) {
        if (error instanceof Error) {
          this.updatePeerScore(candidate.url, -1);
        }
      }
    }
  }

  private updatePeerScore(url: string, score: number): void {
    const peerAddr = this.peerAddresses.get(url);
    if (peerAddr) {
      peerAddr.banScore += score;

      // Ban peer if score exceeds threshold
      if (peerAddr.banScore >= this.banThreshold) {
        this.bannedPeers.set(url, Date.now() + PeerDiscovery.BAN_DURATION);
        this.peerAddresses.delete(url);
      }
    }
  }

  private selectPeerCandidate(): PeerAddress | null {
    const candidates = Array.from(this.peerAddresses.values())
      .filter(
        (addr) => !this.peers.has(addr.url) && !this.bannedPeers.has(addr.url),
      )
      .sort((a, b) => {
        // Prefer peers that have succeeded recently
        if (a.lastSuccess && !b.lastSuccess) return -1;
        if (!a.lastSuccess && b.lastSuccess) return 1;

        // Then prefer peers with fewer attempts
        return a.attempts - b.attempts;
      });

    return candidates[0] || null;
  }

  private async loadCachedPeers(): Promise<void> {
    const cachedPeers = this.peerCache.getAll();
    const connectPromises = cachedPeers
      .filter((peerInfo) => this.isValidPeer(peerInfo))
      .map((peerInfo) => this.connectToPeer(peerInfo.url));

    await Promise.allSettled(connectPromises);
  }

  private async connectToSeedNodes(): Promise<void> {
    const seedNodes =
      (this.config.get('SEED_NODES') as string)?.split(',') || [];
    const connectPromises = seedNodes
      .filter((node) => !this.peers.has(node) && !this.bannedPeers.has(node))
      .map((node) => this.connectToPeer(node));

    await Promise.allSettled(connectPromises);
  }

  private async discoverPeers(): Promise<void> {
    if (this.state !== DiscoveryState.ACTIVE) {
      return;
    }

    try {
      await this.setState(DiscoveryState.SYNCING);
      const minPeers = parseInt(this.config.get('MIN_PEERS') || '10');
      if (this.peers.size < minPeers) {
        Logger.info(
          `Discovering new peers (current: ${this.peers.size}, min: ${minPeers})`,
        );
        await this.requestNewPeers();
      }

      await this.updatePeerTypes();
      await this.setState(DiscoveryState.ACTIVE);
    } catch (error) {
      await this.setState(DiscoveryState.ERROR);
      this.eventEmitter.emit('discovery_error', error);
    }
  }

  private async requestNewPeers(): Promise<void> {
    if (!this.rateLimit.checkLimit('peer_discovery')) {
      return;
    }

    const selectedPeers = Array.from(this.peers.values())
      .sort(() => Math.random() - 0.5)
      .slice(0, 3); // Only query 3 random peers at a time

    const discoveryPromises = selectedPeers.map((peer) =>
      this.requestPeers(peer),
    );

    const results = await Promise.allSettled(discoveryPromises);
    const newPeers = results
      .filter(
        (result): result is PromiseFulfilledResult<string[]> =>
          result.status === 'fulfilled',
      )
      .map((result) => result.value)
      .flat();

    await this.connectToNewPeers(newPeers);
  }

  private async updatePeerTypes(): Promise<void> {
    const updatePromises = Array.from(this.peers.values()).map(async (peer) => {
      let url: string;
      try {
        const info = await peer.getNodeInfo();
        const peerInfo = await peer.getInfo();
        url = peerInfo.url;

        // Check TAG requirements for miners
        const isValidMiner =
          info.isMiner &&
          info.tagInfo.minedBlocks >= 1 &&
          BigInt(info.tagInfo.votingPower) >= BigInt(1000) &&
          info.tagInfo.voteParticipation >= 0.1;

        if (isValidMiner) {
          this.miners.add(url);
          Logger.debug(
            `Added TAG miner: ${url}, blocks: ${info.tagInfo.minedBlocks}`,
          );
        } else {
          this.miners.delete(url);
        }

        // Update peer metrics
        this.peerScores.set(
          url,
          (this.peerScores.get(url) || 0) + (isValidMiner ? 2 : 1),
        );
      } catch (error) {
        // Ensure url is captured even in error state
        // If getInfo fails, try to get url from peer; otherwise use a fallback identifier
        try {
          const peerInfo = await peer.getInfo();
          url = peerInfo.url;
        } catch {
          url = 'unknown';
        }
        Logger.warn(`Failed to update peer type for ${url}:`, error);
        this.peerScores.set(url, (this.peerScores.get(url) || 0) - 1);
        this.miners.delete(url);
      }
    });
    await Promise.allSettled(updatePromises);
  }

  private async cleanup(): Promise<void> {
    this.cleanupOldPeers();
    this.cleanupBannedPeers();
    this.cleanupResources();
  }

  private async cleanupOldPeers(): Promise<void> {
    const now = Date.now();
    // Construct a list of removal promises to await together
    const removalPromises = [];
    for (const [url, peer] of this.peers.entries()) {
      try {
        const info = await peer.getInfo();
        if (now - info.lastSeen > PeerDiscovery.MAX_PEER_AGE) {
          removalPromises.push(this.removePeer(url));
        }
      } catch {
        // If getInfo() fails, consider the peer stale and schedule it for removal.
        removalPromises.push(this.removePeer(url));
      }
    }
    await Promise.allSettled(removalPromises);
  }

  private cleanupBannedPeers(): void {
    const now = Date.now();
    for (const [url, banExpiry] of this.bannedPeers.entries()) {
      if (now > banExpiry) {
        this.bannedPeers.delete(url);
      }
    }
  }

  private cleanupResources(): void {
    // Only clear expired entries
    this.peerCache.clear(true);

    // Remove low-scoring peers and await removals
    (async () => {
      const removalPromises: Promise<void>[] = [];
      for (const [url, score] of this.peerScores.entries()) {
        if (score < 0) {
          removalPromises.push(this.removePeer(url));
        }
      }
      await Promise.allSettled(removalPromises);

      // Limit total connections
      const maxPeers =
        parseInt(this.config.get('MAX_PEERS') as string, 10) || 50;
      if (this.peers.size > maxPeers) {
        const excessPeers = Array.from(this.peers.keys()).slice(maxPeers);
        const excessPromises = excessPeers.map((url) => this.removePeer(url));
        await Promise.allSettled(excessPromises);
      }
    })().catch((err) => Logger.error('Error cleaning up resources:', err));
  }

  public getPeersByType(type: PeerType): string[] {
    switch (type) {
      case PeerType.MINER:
        return Array.from(this.miners);
      default:
        return Array.from(this.peers.keys());
    }
  }

  public async shutdown(): Promise<void> {
    try {
      await this.setState(DiscoveryState.INITIALIZING);
      clearInterval(this.discoveryInterval);
      clearInterval(this.cleanupInterval);
      clearInterval(this.feelerInterval);

      const disconnectPromises = Array.from(this.peers.values()).map((peer) =>
        peer.disconnect(),
      );
      await Promise.allSettled(disconnectPromises);

      this.peers.clear();
      this.miners.clear();
      this.bannedPeers.clear();
      this.peerCache.clear();

      Logger.info('Peer discovery shutdown complete');
    } catch (error: unknown) {
      if (error instanceof Error) {
        await this.setState(DiscoveryState.ERROR);
        throw new DiscoveryError('Shutdown failed', 'SHUTDOWN_ERROR');
      }
    }
  }

  private isValidPeer(peerInfo: PeerInfo): boolean {
    const now = Date.now();
    return (
      Boolean(peerInfo.url) &&
      peerInfo.lastSeen > now - PeerDiscovery.MAX_PEER_AGE &&
      !this.bannedPeers.has(peerInfo.url) &&
      !this.peers.has(peerInfo.url)
    );
  }

  private async connectToPeer(url: string): Promise<void> {
    let retryCount = 0;
    while (retryCount < PeerDiscovery.MAX_RECONNECT_ATTEMPTS) {
      try {
        // Parsing the URL for IPv6 or IPv4
        let address: string;
        let port: number;
        if (url.startsWith('[')) {
          const closingBracketIndex = url.indexOf(']');
          if (closingBracketIndex === -1) {
            throw new Error(`Invalid IPv6 address format: ${url}`);
          }
          address = url.substring(1, closingBracketIndex);
          const portPart = url.substring(closingBracketIndex + 1);
          if (!portPart.startsWith(':')) {
            throw new Error(`Missing port separator in IPv6 URL: ${url}`);
          }
          port = parseInt(portPart.substring(1), 10);
        } else {
          const splitIndex = url.lastIndexOf(':');
          if (splitIndex === -1) {
            throw new Error(`Invalid peer URL, missing port: ${url}`);
          }
          address = url.substring(0, splitIndex);
          const portStr = url.substring(splitIndex + 1);
          port = parseInt(portStr, 10);
        }
        if (!address) {
          throw new Error(`Invalid peer URL: ${url}`);
        }
        if (isNaN(port) || port <= 0 || port > 65535) {
          throw new Error(`Invalid port number extracted: ${port}`);
        }

        const peer = new Peer(
          address,
          port,
          {}, // config
          this.config, // ConfigService
          this.database || new BlockchainSchema(),
        );
        await peer.connect();

        // Set up message handling for the new peer
        peer.eventEmitter.on('message', (message: PeerMessage) => {
          this.processMessage(message).catch((error) => {
            Logger.error('Error processing peer message:', error);
          });
        });

        this.peers.set(url, peer);
        return;
      } catch (error) {
        retryCount++;
        if (retryCount >= PeerDiscovery.MAX_RECONNECT_ATTEMPTS) {
          throw error;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, PeerDiscovery.RECONNECT_DELAY),
        );
      }
    }
  }

  private async requestPeers(peer: Peer): Promise<string[]> {
    try {
      const peerList = await peer.getPeers();
      return peerList.map((p) => p.url);
    } catch (error) {
      let peerUrl = 'unknown';
      try {
        const peerInfo = await peer.getInfo();
        peerUrl = peerInfo.url;
      } catch {
        // Could not get peer info; defaulting to 'unknown'
        peerUrl = 'unknown';
      }
      Logger.warn(`Failed to get peers from ${peerUrl}:`, error);
      return [];
    }
  }

  private async connectToNewPeers(peers: string[]): Promise<void> {
    const connectPromises = peers
      .filter((url) => !this.peers.has(url) && !this.bannedPeers.has(url))
      .map((url) => this.connectToPeer(url));

    await Promise.allSettled(connectPromises);
  }

  private async removePeer(url: string): Promise<void> {
    const peer = this.peers.get(url);
    if (peer) {
      await peer.disconnect();
      this.peers.delete(url);
      this.miners.delete(url);
      this.peerCache.delete(url);
      Logger.info(`Removed peer: ${url}`);
    }
  }

  private async setState(newState: DiscoveryState): Promise<void> {
    this.statePromise = this.statePromise.then(async () => {
      const oldState = this.state;
      this.state = newState;

      Logger.info(`Discovery state changed: ${oldState} -> ${newState}`);
      this.eventEmitter.emit('stateChange', { old: oldState, new: newState });

      if (newState === DiscoveryState.ERROR) {
        await this.cleanup();
      }
    });
    await this.statePromise;
  }

  private async attemptFeelerConnection(): Promise<void> {
    const candidate = this.selectPeerCandidate();
    if (candidate) {
      try {
        await this.connectToPeer(candidate.url);
        this.updatePeerScore(candidate.url, 1);
      } catch (error: unknown) {
        if (error instanceof Error) {
          this.updatePeerScore(candidate.url, -1);
        }
      }
    }
  }

  private getTargetOutbound(): number {
    return parseInt(this.config.get('network.maxPeers') as string, 10) || 8;
  }

  private async resolveDnsSeed(seed: string): Promise<string[]> {
    try {
      const addresses = await new Promise<string[]>((resolve, reject) => {
        dns.resolve(seed, (err: Error | null, addresses: string[]) => {
          if (err) reject(err);
          else resolve(addresses);
        });
      });
      return addresses.filter((addr) => this.isValidAddress(addr));
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.warn(`DNS resolution failed for ${seed}:`, error);
      }
      return [];
    }
  }

  private isValidAddress(address: string): boolean {
    try {
      // Use Node's built-in isIP. Returns 0 for invalid,
      // 4 for IPv4, and 6 for IPv6.
      return isIP(address) !== 0;
    } catch {
      return false;
    }
  }

  private addPeerAddress(address: PeerAddress): void {
    if (!this.peerAddresses.has(address.url)) {
      this.peerAddresses.set(address.url, address);
    }
  }

  private async processMessage(message: PeerMessage): Promise<void> {
    try {
      switch (message.type) {
        case PeerMessageType.VERSION:
          await this.handleVersion({
            version: message.payload.version,
            services: message.payload.services,
          });
          break;
        case PeerMessageType.ADDR:
          await this.handleAddr({
            addresses: message.payload.addresses || [],
          });
          break;
        case PeerMessageType.INV:
          await this.handleInventory({
            type: message.payload.type,
            hash: message.payload.hash,
          });
          break;
        default:
          Logger.debug(`Unhandled message type: ${message.type}`);
      }
    } catch (error) {
      Logger.error(`Error processing message ${message.type}:`, error);
    }
  }

  private async handleVersion(payload: MessagePayload): Promise<void> {
    try {
      if (!payload.nodeInfo) {
        throw new DiscoveryError(
          'Missing node info in version message',
          'INVALID_VERSION',
        );
      }

      const { version, services, timestamp, startHeight, userAgent } =
        payload.nodeInfo;

      // Validate version compatibility (convert to number)
      const minVersion = this.config.get('MIN_PROTOCOL_VERSION') || '1';
      if (Number(version) < Number(minVersion)) {
        throw new DiscoveryError(
          `Incompatible protocol version: ${version}`,
          'VERSION_MISMATCH',
        );
      }

      // Use the URL (or fallback to id) as key to find the peer
      const peer = this.peers.get(payload.nodeInfo.url || payload.nodeInfo.id);
      if (peer) {
        await peer.updateInfo({
          version: Number(version),
          services,
          startHeight: startHeight || 0,
          userAgent,
          lastSeen: timestamp || Date.now(),
        });

        this.eventEmitter.emit('version', {
          peerId: peer.getId(),
          version,
          services,
          startHeight,
        });

        Logger.debug(
          `Updated peer version info: ${peer.getId()}, v${version}, services: ${services}`,
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        Logger.error('Error handling version message:', error);
        this.eventEmitter.emit('discovery_error', error);
      }
    }
  }

  private async handleAddr(payload: AddrPayload): Promise<void> {
    try {
      if (!Array.isArray(payload.addresses)) {
        throw new DiscoveryError(
          'Invalid addr payload format',
          'INVALID_PAYLOAD',
        );
      }

      const validAddresses = payload.addresses.filter(
        (addr) =>
          addr.url &&
          typeof addr.services === 'number' &&
          this.isValidAddress(addr.url) &&
          !this.bannedPeers.has(addr.url),
      );

      for (const addr of validAddresses) {
        this.addPeerAddress({
          url: addr.url,
          timestamp: addr.timestamp || Date.now(),
          services: addr.services,
          attempts: 0,
          lastSuccess: addr.lastSeen || 0,
          lastAttempt: 0,
          banScore: 0,
        });

        Logger.debug(`Added new peer address: ${addr.url}`);
      }

      // Update peer metrics
      this.eventEmitter.emit('peerDiscovery', {
        newAddresses: validAddresses.length,
        totalPeers: this.peerAddresses.size,
      });
    } catch (error) {
      if (error instanceof Error) {
        Logger.error('Error handling addr message:', error);
        this.eventEmitter.emit('discovery_error', error);
      }
    }
  }

  private async handleInventory(payload: MessagePayload): Promise<void> {
    try {
      // Handle inventory announcements (new blocks, transactions, etc)
      Logger.debug('Received inventory message:', payload);
      this.eventEmitter.emit('inventory', payload);
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Error handling inventory message:', error);
      }
    }
  }
}
