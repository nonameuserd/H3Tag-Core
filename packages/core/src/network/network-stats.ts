import { Peer } from './peer';
import { EventEmitter } from 'events';
import { BLOCKCHAIN_CONSTANTS } from '../blockchain/utils/constants';
import { NetworkError, NetworkErrorCode } from './network-error';
import { ConfigService, Logger } from '@h3tag-blockchain/shared';
import { Blockchain } from '../blockchain/blockchain';

type NetworkStatsEvent = {
  timestamp: number;
  peerId?: string;
  data?: unknown;
  metrics?: {
    count?: number;
    latency?: number;
    hashRate?: number;
    propagationTime?: number;
  };
};

export class NetworkStats {
  private readonly eventEmitter = new EventEmitter();
  public blockPropagationTimes: number[] = [];
  public globalHashRate: number = 0;
  public peerLatencies: Map<string, number> = new Map();
  private peers: Map<string, Peer> = new Map();
  public currentDifficulty: number = 1;

  private static readonly MAX_PROPAGATION_TIMES = 50;
  private static readonly MIN_HASH_RATE = 0;
  private static readonly MAX_LATENCY = 5000; // 5 seconds
  private static readonly MIN_LATENCY = 0;
  private static readonly MAX_PEERS = 100;
  private static readonly PEER_EVENTS = ['disconnect', 'error', 'ban'];
  private static readonly DEFAULT_LATENCY = 0;
  private static readonly MAX_SAMPLE_SIZE = 1000;
  private static readonly VALID_EVENTS = new Set([
    'disconnect',
    'error',
    'ban',
    'timeout',
    'message',
    'sync',
  ]);
  private static readonly DEFAULT_PROPAGATION_TIME = 0;
  private static readonly OUTLIER_THRESHOLD = 3; // Standard deviations
  private readonly blockchain: Blockchain | undefined;
  private readonly configService: ConfigService | undefined;

  private discoveryTimer: NodeJS.Timeout | null = null;
  private readonly peerScores: Map<string, number> = new Map();
  private readonly lastSeen: Map<string, number> = new Map();
  private readonly bannedPeers: Set<string> = new Set();

  private static readonly DISCOVERY_INTERVAL = 30000; // 30 seconds
  private static readonly PEER_TIMEOUT = 120000; // 2 minutes
  private static readonly MAX_SCORE = 100;
  private static readonly MIN_SCORE = -100;
  private static readonly SCORE_DECAY = 0.95;

  private readonly startTime: number = Math.floor(Date.now() / 1000);

  constructor() {
    this.startDiscoveryLoop();
  }

  private startDiscoveryLoop(): void {
    this.discoveryTimer = setInterval(() => {
      this.performDiscovery();
    }, NetworkStats.DISCOVERY_INTERVAL);
  }

  private async performDiscovery(): Promise<void> {
    const peersToRemove = new Set<string>();
    const now = Date.now();

    try {
      // First, identify peers to remove
      for (const [peerId, lastSeenTime] of this.lastSeen.entries()) {
        if (now - lastSeenTime > NetworkStats.PEER_TIMEOUT) {
          peersToRemove.add(peerId);
        }
      }

      // Then, perform removals in a transaction-like manner
      await Promise.all(
        Array.from(peersToRemove).map(async (peerId) => {
          try {
            await this.removePeer(peerId);
          } catch (error) {
            Logger.error(`Failed to remove peer ${peerId}:`, error);
          }
        }),
      );

      // Update scores atomically
      for (const [peerId, score] of this.peerScores.entries()) {
        if (!peersToRemove.has(peerId)) {
          this.peerScores.set(peerId, score * NetworkStats.SCORE_DECAY);
        }
      }

      this.eventEmitter.emit('discovery_cycle', {
        timestamp: now,
        activePeers: this.getActivePeerCount(),
        bannedPeers: this.bannedPeers.size,
        averageScore: this.getAveragePeerScore(),
      });
    } catch (error) {
      Logger.error('Discovery cycle failed:', error);
    }
  }

  public updatePeerScore(peerId: string, delta: number): void {
    try {
      // Check if peer exists
      if (!this.peers.has(peerId)) {
        throw new NetworkError(
          'Peer not found',
          NetworkErrorCode.PEER_NOT_FOUND,
        );
      }

      const currentScore = this.peerScores.get(peerId) ?? 0;
      const newScore = Math.max(
        NetworkStats.MIN_SCORE,
        Math.min(NetworkStats.MAX_SCORE, currentScore + delta),
      );

      this.peerScores.set(peerId, newScore);
      this.lastSeen.set(peerId, Date.now());

      if (newScore <= NetworkStats.MIN_SCORE) {
        this.banPeer(peerId);
      }
    } catch (error) {
      Logger.error('Failed to update peer score:', error);
    }
  }

  private banPeer(peerId: string): void {
    try {
      this.bannedPeers.add(peerId);
      this.removePeer(peerId);

      this.eventEmitter.emit('peer_banned', {
        peerId,
        timestamp: Date.now(),
        reason: 'Low score',
      });
    } catch (error) {
      Logger.error('Failed to ban peer:', error);
    }
  }

  private getAveragePeerScore(): number {
    const scores = Array.from(this.peerScores.values());
    return scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
  }

  public on(
    event: string,
    listener: (eventData: NetworkStatsEvent) => void,
  ): void {
    this.eventEmitter.on(event, listener);
  }

  public off(
    event: string,
    listener: (...args: NetworkStatsEvent[]) => void,
  ): void {
    this.eventEmitter.off(event, listener);
  }

  public removeAllListeners(): void {
    this.eventEmitter.removeAllListeners();
  }

  // Add TAG specific metrics
  private readonly h3TagMetrics = {
    price: 0,
    volume24h: 0,
    marketCap: 0,
    holders: 0,
    distribution: {
      gini: 0,
      top10Percent: 0,
      top50Percent: 0,
    },
  };

  // Add validation constants
  private static readonly MIN_DIFFICULTY = 1;
  private static readonly MAX_DIFFICULTY = Number.MAX_SAFE_INTEGER;
  private static readonly MIN_PROPAGATION_TIME = 0;
  private static readonly MAX_PROPAGATION_TIME = 30000; // 30 seconds

  public async addPeer(peer: Peer): Promise<void> {
    try {
      if (!peer || !(peer instanceof Peer)) {
        throw new NetworkError(
          'Invalid peer object',
          NetworkErrorCode.PEER_VALIDATION_FAILED,
          { peer },
        );
      }

      const peerInfo = await peer.getInfo();
      if (!peerInfo?.id) {
        throw new NetworkError(
          'Invalid peer info',
          NetworkErrorCode.PEER_VALIDATION_FAILED,
          { peerInfo },
        );
      }

      // Check peer limit
      if (this.peers.size >= NetworkStats.MAX_PEERS) {
        throw new NetworkError(
          'Maximum peer limit reached',
          NetworkErrorCode.PEER_VALIDATION_FAILED,
          { currentPeers: this.peers.size },
        );
      }

      if (this.bannedPeers.has(peerInfo.id)) {
        throw new NetworkError('Peer is banned', NetworkErrorCode.PEER_BANNED, {
          peerId: peerInfo.id,
        });
      }

      // Initialize peer score
      this.peerScores.set(peerInfo.id, 0);
      this.lastSeen.set(peerInfo.id, Date.now());

      // Add event listeners
      NetworkStats.PEER_EVENTS.forEach((event) => {
        peer.eventEmitter.on(event, (...args) =>
          this.handlePeerEvent(peerInfo.id, event, ...args),
        );
      });

      this.peers.set(peerInfo.id, peer);

      // Emit peer added event
      this.eventEmitter.emit('peer_added', {
        peerId: peerInfo.id,
        peerInfo,
        timestamp: Date.now(),
        totalPeers: this.peers.size,
      });

      Logger.info(
        `Peer added: ${peerInfo.id}, total peers: ${this.peers.size}`,
      );
    } catch (error) {
      Logger.error('Failed to add peer:', error);
      throw error;
    }
  }

  public removePeer(peerId: string): void {
    try {
      if (!peerId || typeof peerId !== 'string') {
        throw new NetworkError(
          'Invalid peer ID',
          NetworkErrorCode.PEER_VALIDATION_FAILED,
          { peerId },
        );
      }

      const peer = this.peers.get(peerId);
      if (!peer) {
        Logger.warn(`Attempted to remove non-existent peer: ${peerId}`);
        return;
      }

      // Remove event listeners
      NetworkStats.PEER_EVENTS.forEach((event) => {
        peer.eventEmitter.removeAllListeners(event);
      });

      this.peers.delete(peerId);
      this.peerLatencies.delete(peerId);

      // Emit peer removed event
      this.eventEmitter.emit('peer_removed', {
        peerId,
        timestamp: Date.now(),
        remainingPeers: this.peers.size,
      });

      Logger.info(
        `Peer removed: ${peerId}, remaining peers: ${this.peers.size}`,
      );
    } catch (error) {
      Logger.error('Failed to remove peer:', error);
      throw error;
    }
  }

  public getActivePeerCount(): number {
    try {
      const activePeers = Array.from(this.peers.values()).filter((peer) =>
        peer.isConnected(),
      ).length;

      // Emit metrics
      this.eventEmitter.emit('active_peers_updated', {
        count: activePeers,
        total: this.peers.size,
        timestamp: Date.now(),
      });

      return activePeers;
    } catch (error) {
      Logger.error('Failed to get active peer count:', error);
      throw new NetworkError(
        'Failed to get active peer count',
        NetworkErrorCode.PEER_VALIDATION_FAILED,
        { error },
      );
    }
  }

  public async getAverageLatency(): Promise<number> {
    try {
      // Get connected peers
      const connectedPeers = Array.from(this.peers.values())
        .filter((peer) => peer.isConnected())
        .slice(0, NetworkStats.MAX_SAMPLE_SIZE); // Limit sample size for performance

      if (connectedPeers.length === 0) {
        Logger.debug('No connected peers for latency calculation');
        return NetworkStats.DEFAULT_LATENCY;
      }

      let validSamples = 0;
      const latencies = await Promise.all(
        connectedPeers.map(async (peer) => {
          try {
            const peerInfo = await peer.getInfo();
            const latency = peerInfo?.latency;
            if (
              typeof latency === 'number' &&
              latency >= NetworkStats.MIN_LATENCY &&
              latency <= NetworkStats.MAX_LATENCY
            ) {
              validSamples++;
              return latency;
            }
            return 0;
          } catch (error: unknown) {
            Logger.warn(
              `Failed to get latency for peer, error: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
              error,
            );
            return 0;
          }
        }),
      );

      const totalLatency = latencies.reduce((sum, latency) => sum + latency, 0);

      if (validSamples === 0) {
        Logger.warn('No valid latency samples available');
        return NetworkStats.DEFAULT_LATENCY;
      }

      const averageLatency = totalLatency / validSamples;

      // Emit metrics
      this.eventEmitter.emit('average_latency_updated', {
        average: averageLatency,
        sampleSize: validSamples,
        totalPeers: this.peers.size,
        timestamp: Date.now(),
      });

      return averageLatency;
    } catch (error) {
      Logger.error('Failed to calculate average latency:', error);
      throw new NetworkError(
        'Failed to calculate average latency',
        NetworkErrorCode.PEER_VALIDATION_FAILED,
        { error },
      );
    }
  }

  public addBlockPropagationTime(time: number): void {
    try {
      if (
        !Number.isFinite(time) ||
        time < NetworkStats.MIN_PROPAGATION_TIME ||
        time > NetworkStats.MAX_PROPAGATION_TIME
      ) {
        throw new NetworkError(
          'Invalid propagation time',
          NetworkErrorCode.INVALID_PROPAGATION_TIME,
          { time },
        );
      }
      this.blockPropagationTimes.push(time);
      while (
        this.blockPropagationTimes.length > NetworkStats.MAX_PROPAGATION_TIMES
      ) {
        this.blockPropagationTimes.shift();
      }
      this.eventEmitter.emit('propagation_time_added', { time });
    } catch (error) {
      Logger.error('Failed to add propagation time:', error);
      throw error;
    }
  }

  public updateGlobalHashRate(hashRate: number): void {
    try {
      if (!Number.isFinite(hashRate) || hashRate < NetworkStats.MIN_HASH_RATE) {
        throw new NetworkError(
          'Invalid hash rate value',
          NetworkErrorCode.INVALID_HASH_RATE,
          { hashRate },
        );
      }
      this.globalHashRate = hashRate;
      this.eventEmitter.emit('hashrate_updated', { hashRate });
    } catch (error) {
      Logger.error('Hash rate update failed:', error);
      throw error;
    }
  }

  public updatePeerLatency(peerId: string, latency: number): void {
    try {
      if (!peerId || typeof peerId !== 'string') {
        throw new NetworkError(
          'Invalid peer ID',
          NetworkErrorCode.PEER_VALIDATION_FAILED,
          { peerId },
        );
      }
      if (
        !Number.isFinite(latency) ||
        latency < NetworkStats.MIN_LATENCY ||
        latency > NetworkStats.MAX_LATENCY
      ) {
        throw new NetworkError(
          'Invalid latency value',
          NetworkErrorCode.PEER_VALIDATION_FAILED,
          { peerId, latency },
        );
      }
      this.peerLatencies.set(peerId, latency);
      this.eventEmitter.emit('peer_latency_updated', { peerId, latency });
    } catch (error) {
      Logger.error('Latency update failed:', error);
      throw error;
    }
  }

  public getAveragePropagationTime(): number {
    try {
      if (this.blockPropagationTimes.length === 0) {
        return NetworkStats.DEFAULT_PROPAGATION_TIME;
      }

      const samples = this.blockPropagationTimes.slice(
        -NetworkStats.MAX_SAMPLE_SIZE,
      );
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;

      // Add safety check for standard deviation
      const variance =
        samples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / samples.length;
      const stdDev = Math.sqrt(variance) || 1; // Prevent division by zero

      const validSamples = samples.filter(
        (time) =>
          Math.abs(time - mean) <= NetworkStats.OUTLIER_THRESHOLD * stdDev,
      );

      // Return mean if no valid samples after filtering
      return validSamples.length > 0
        ? validSamples.reduce((a, b) => a + b, 0) / validSamples.length
        : mean;
    } catch (error) {
      Logger.error('Failed to calculate average propagation time:', error);
      return NetworkStats.DEFAULT_PROPAGATION_TIME;
    }
  }

  private handlePeerEvent(
    peerId: string,
    event: string,
    ...args: unknown[]
  ): void {
    try {
      if (!NetworkStats.VALID_EVENTS.has(event)) {
        throw new NetworkError(
          'Invalid event type',
          NetworkErrorCode.MESSAGE_VALIDATION_FAILED,
        );
      }

      const eventName = `peer_${event}`;
      const listener = () => {
        this.eventEmitter.emit(eventName, {
          peerId,
          args,
          timestamp: Date.now(),
          eventId: `${peerId}_${event}_${Date.now()}`,
          peerCount: this.peers.size,
        });
      };

      this.eventEmitter.once(eventName, listener);
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.eventEmitter.on(event, listener);
      }
    } catch (error) {
      Logger.error('Failed to handle peer event:', error);
    }
  }

  public getVotingStats(): {
    participation: number;
    averageVoteTime: number;
    totalVoters: number;
  } {
    try {
      // Calculate voting participation rate
      const activeVoters = Array.from(this.peers.values()).filter((peer) =>
        peer.hasVoted(),
      ).length;

      return {
        participation: activeVoters / this.peers.size,
        averageVoteTime: this.calculateAverageVoteTime(),
        totalVoters: this.peers.size,
      };
    } catch (error) {
      Logger.error('Failed to calculate voting stats:', error);
      return {
        participation: 0,
        averageVoteTime: 0,
        totalVoters: 0,
      };
    }
  }

  private calculateAverageVoteTime(): number {
    try {
      const voteTimes = Array.from(this.peers.values())
        .filter((peer) => peer.hasVoted())
        .map((peer) => peer.getVoteTime() || 0);

      if (voteTimes.length === 0) return 0;
      return voteTimes.reduce((a, b) => a + b, 0) / voteTimes.length;
    } catch (error) {
      Logger.error('Failed to calculate average vote time:', error);
      return 0;
    }
  }

  /**
   * Update TAG price and market metrics
   */
  public updateHBXMetrics(metrics: {
    price?: number;
    volume24h?: number;
    marketCap?: number;
    holders?: number;
    distribution?: {
      gini: number;
      top10Percent: number;
      top50Percent: number;
    };
  }): void {
    try {
      Object.assign(this.h3TagMetrics, metrics);

      this.eventEmitter.emit('h3Tag_metrics_updated', {
        ...this.h3TagMetrics,
        currency: BLOCKCHAIN_CONSTANTS.CURRENCY,
        timestamp: Date.now(),
      });
    } catch (error) {
      Logger.error('Failed to update TAG metrics:', error);
      throw new NetworkError(
        'Failed to update TAG metrics',
        NetworkErrorCode.METRICS_UPDATE_FAILED,
        { metrics },
      );
    }
  }

  /**
   * Get current TAG metrics
   */
  public getMetrics() {
    return {
      ...this.h3TagMetrics,
      currency: {
        name: BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
        symbol: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        decimals: BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
      },
    };
  }

  public async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Network stats initialization timeout'));
      }, 30000); // 30 second timeout

      try {
        this.peerLatencies = new Map();
        this.blockPropagationTimes = [];
        this.globalHashRate = 0;

        // Start discovery loop
        this.startDiscoveryLoop();

        clearTimeout(timeout);
        Logger.debug('Network stats initialized');
        resolve();
      } catch (error) {
        clearTimeout(timeout);
        Logger.error('Failed to initialize network stats:', error);
        reject(error);
      }
    });
  }

  public cleanup(): void {
    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = null;
    }
    this.removeAllListeners();
    this.peers.clear();
    this.peerScores.clear();
    this.lastSeen.clear();
    this.bannedPeers.clear();
  }

  public getNetworkInfo(): {
    version: string;
    subversion: string;
    protocolVersion: number;
    localServices: string[];
    connections: {
      total: number;
      inbound: number;
      outbound: number;
      verified: number;
    };
    networks: {
      name: string;
      limited: boolean;
      reachable: boolean;
      proxy: string;
      proxy_randomize_credentials: boolean;
    }[];
    localAddresses: string[];
    warnings: string;
    metrics: {
      totalBytesRecv: number;
      totalBytesSent: number;
      timeConnected: number;
      blockHeight: number;
      difficulty: number;
      hashRate: number;
      mempool: {
        size: number;
        bytes: number;
        usage: number;
        maxmempool: number;
        mempoolminfee: number;
      };
    };
  } {
    try {
      // Get connected peers
      const connectedPeers = Array.from(this.peers.values()).filter((peer) =>
        peer.isConnected(),
      );

      // Calculate connection metrics
      const inbound = connectedPeers.filter((peer) => peer.isInbound()).length;
      const outbound = connectedPeers.length - inbound;
      const verified = connectedPeers.filter((peer) =>
        peer.isVerified(),
      ).length;

      // Get network metrics
      const metrics = {
        totalBytesRecv: connectedPeers.reduce(
          (sum, peer) => sum + peer.getBytesReceived(),
          0,
        ),
        totalBytesSent: connectedPeers.reduce(
          (sum, peer) => sum + peer.getBytesSent(),
          0,
        ),
        timeConnected: Math.floor(Date.now() / 1000) - this.startTime,
        blockHeight: this.blockchain?.getHeight() || 0,
        difficulty: this.blockchain?.getCurrentDifficulty() || 0,
        hashRate: this.globalHashRate,
        mempool: this.getMempoolInfo(),
      };

      // Get local addresses
      const localAddresses = this.getLocalAddresses();

      return {
        version: BLOCKCHAIN_CONSTANTS.VERSION.toString(),
        subversion: BLOCKCHAIN_CONSTANTS.USER_AGENT,
        protocolVersion: BLOCKCHAIN_CONSTANTS.PROTOCOL_VERSION,
        localServices: this.getLocalServices(),
        connections: {
          total: connectedPeers.length,
          inbound,
          outbound,
          verified,
        },
        networks: [
          {
            name: 'ipv4',
            limited: false,
            reachable: true,
            proxy: this.configService?.get('PROXY_IPV4') || 'none',
            proxy_randomize_credentials: true,
          },
          {
            name: 'ipv6',
            limited: false,
            reachable: true,
            proxy: this.configService?.get('PROXY_IPV6') || 'none',
            proxy_randomize_credentials: true,
          },
          {
            name: 'onion',
            limited: true,
            reachable: false,
            proxy: 'none',
            proxy_randomize_credentials: true,
          },
        ],
        localAddresses,
        warnings: this.getNetworkWarnings(),
        metrics,
      };
    } catch (error) {
      Logger.error('Failed to get network info:', error);
      throw new NetworkError(
        'Failed to get network info',
        NetworkErrorCode.NETWORK_INFO_FAILED,
        { error },
      );
    }
  }

  private getMempoolInfo() {
    try {
      const mempool = this.blockchain?.getMempool();
      return {
        size: mempool?.size || 0,
        bytes: mempool?.bytes || 0,
        usage: mempool?.usage || 0,
        maxmempool: BLOCKCHAIN_CONSTANTS.MAX_MEMPOOL_SIZE,
        mempoolminfee: BLOCKCHAIN_CONSTANTS.MIN_RELAY_TX_FEE,
      };
    } catch (error) {
      Logger.warn('Failed to get mempool info:', error);
      return {
        size: 0,
        bytes: 0,
        usage: 0,
        maxmempool: BLOCKCHAIN_CONSTANTS.MAX_MEMPOOL_SIZE,
        mempoolminfee: BLOCKCHAIN_CONSTANTS.MIN_RELAY_TX_FEE,
      };
    }
  }

  private getLocalServices(): string[] {
    const services = [];
    if (this.configService?.get('NETWORK_NODE'))
      services.push('NODE_NETWORK');
    if (this.configService?.get('NETWORK_BLOOM')) services.push('NODE_BLOOM');
    if (this.configService?.get('NETWORK_WITNESS'))
      services.push('NODE_WITNESS');
    if (this.configService?.get('NETWORK_COMPACT'))
      services.push('NODE_COMPACT_FILTERS');
    return services;
  }

  private getLocalAddresses(): string[] {
    try {
      return (
        (this.configService?.get('LOCAL_ADDRESSES') as string)?.split(',') || []
      );
    } catch (error) {
      Logger.warn('Failed to get local addresses:', error);
      return [];
    }
  }

  private getNetworkWarnings(): string {
    const warnings = [];

    // Check for version updates
    if (this.isVersionOutdated()) {
      warnings.push('WARNING: Client version is outdated. Please upgrade.');
    }

    // Check network health
    if (this.peers.size < BLOCKCHAIN_CONSTANTS.MIN_PEERS) {
      warnings.push(
        'WARNING: Low peer count. Network connectivity may be limited.',
      );
    }

    // Check sync status
    if (!this.isSynced()) {
      warnings.push('WARNING: Node is not fully synced with the network.');
    }

    return warnings.join(' ');
  }

  private isVersionOutdated(): boolean {
    try {
      const currentVersion = parseFloat(
        BLOCKCHAIN_CONSTANTS.VERSION.toString(),
      );
      const latestVersion = parseFloat(
        this.configService?.get('LATEST_VERSION') as string,
      );
      return currentVersion < latestVersion;
    } catch (error) {
      Logger.warn('Failed to check version:', error);
      return false;
    }
  }

  private async isSynced(): Promise<boolean> {
    try {
      return (
        !this.blockchain?.isInitialBlockDownload() &&
        (await this.blockchain?.getVerificationProgress() || 0) >= 0.99
      );
    } catch (error: unknown) {
      Logger.warn('Failed to check sync status:', error as Error);
      return false;
    }
  }
}
