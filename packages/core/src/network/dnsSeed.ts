import dns from 'dns';
import { promisify } from 'util';
import { Logger } from '@h3tag-blockchain/shared';
import { ConfigService } from '@h3tag-blockchain/shared';
import { BlockchainSchema } from '../database/blockchain-schema';
import { Mutex } from 'async-mutex';
import { EventEmitter } from 'events';
import { Cache } from '../scaling/cache';
import { MetricsCollector } from '../monitoring/metrics-collector';
import { CircuitBreaker } from '../network/circuit-breaker';

export enum NetworkType {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
  DEVNET = 'devnet',
}

export class DNSSeederError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'DNSSeederError';
  }
}

export interface DNSSeederConfig {
  networkType: NetworkType;
  region?: string;
  minPeers: number;
  maxPeers: number;
  port: number;
  timeout: number;
  retryDelay: number;
  maxRetries: number;
  cacheExpiry: number;
  requiredServices: number;
  banThreshold: number;
  seedRanking: boolean;
}

interface SeedInfo {
  address: string;
  services: number;
  lastSeen: number;
  attempts: number;
  failures: number;
  latency: number;
  score: number;
}

export class DNSSeeder extends EventEmitter {
  private readonly resolve4Async = promisify(dns.resolve4);
  private readonly resolve6Async = promisify(dns.resolve6);
  private readonly lookupAsync = promisify(dns.lookup);
  private readonly seedDomains: string[];
  private readonly config: DNSSeederConfig;
  private readonly activeSeeds: Set<string>;
  private readonly seedCache: Cache<SeedInfo>;
  private readonly metrics: MetricsCollector;
  private readonly mutex = new Mutex();
  private readonly circuitBreaker: CircuitBreaker;
  private isRunning = false;
  private discoveryTimer?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly db: BlockchainSchema,
    config?: Partial<DNSSeederConfig>,
  ) {
    super();

    this.config = {
      networkType: NetworkType.MAINNET,
      minPeers: 10,
      maxPeers: 100,
      port: 3000,
      timeout: 5000,
      retryDelay: 1000,
      maxRetries: 3,
      cacheExpiry: 3600000, // 1 hour
      requiredServices: 1, // NODE_NETWORK
      banThreshold: 5,
      seedRanking: true,
      ...config,
    };

    this.seedDomains = this.loadSeeds();
    this.activeSeeds = new Set();

    this.seedCache = new Cache<SeedInfo>({
      ttl: this.config.cacheExpiry,
      maxSize: 1000,
      onEvict: (key, value) => this.handleCacheEviction(key, value),
    });

    this.metrics = new MetricsCollector('dns_seeder');

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 30000,
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      this.isRunning = true;
      await this.loadCachedSeeds();
      await this.startDiscovery();

      this.discoveryTimer = setInterval(() => {
        this.startDiscovery().catch((error) =>
          Logger.error('Discovery failed:', error),
        );
      }, this.config.cacheExpiry / 2);
    } catch (error) {
      this.isRunning = false;
      throw error;
    }
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    const timer = this.discoveryTimer;
    this.discoveryTimer = undefined;

    if (timer) {
      clearInterval(timer);
    }

    try {
      await this.saveSeedsToCache();
    } catch (error) {
      Logger.error('Failed to save seeds:', error);
      throw error;
    }
  }

  private async loadCachedSeeds(): Promise<void> {
    try {
      const cached = await this.db.getSeeds();
      cached.forEach((seed) => {
        if (this.isValidSeed(seed)) {
          this.seedCache.set(seed.address, seed);
        }
      });
    } catch (error) {
      Logger.error('Failed to load cached seeds:', error);
    }
  }

  private async saveSeedsToCache(): Promise<void> {
    try {
      const seeds = Array.from(this.seedCache.entries());
      await this.db.saveSeeds(seeds);
    } catch (error) {
      Logger.error('Failed to save seeds to cache:', error);
    }
  }

  public async discoverPeers(): Promise<string[]> {
    const release = await this.mutex.acquire();
    try {
      if (this.circuitBreaker.isOpen()) {
        throw new DNSSeederError('Circuit breaker is open', 'CIRCUIT_OPEN');
      }

      const startTime = Date.now();
      const peers = await this.resolvePeers(this.seedDomains);

      this.metrics.histogram('discovery_time', Date.now() - startTime);
      this.metrics.gauge('active_peers', peers.length);

      return this.formatPeerUrls(peers);
    } catch (error) {
      this.circuitBreaker.recordFailure();
      throw error;
    } finally {
      release();
    }
  }

  private async resolvePeers(seeds: string[]): Promise<string[]> {
    const uniquePeers = new Set<string>();
    const promises: Promise<void>[] = [];

    for (const seed of seeds) {
      if (this.activeSeeds.has(seed)) continue;

      promises.push(
        (async () => {
          const release = await this.mutex.acquire();
          try {
            this.activeSeeds.add(seed);
            const startTime = Date.now();

            const addresses = await this.resolveWithRetry(seed);
            const latency = Date.now() - startTime;

            this.updateSeedMetrics(seed, addresses.length, latency);
            addresses.forEach((addr) => uniquePeers.add(addr));
          } catch (error) {
            this.handleSeedFailure(seed, error);
          } finally {
            this.activeSeeds.delete(seed);
            release();
          }
        })(),
      );
    }

    await Promise.allSettled(promises);
    return this.rankPeers(Array.from(uniquePeers));
  }

  private async resolveWithRetry(
    seed: string,
    retryCount = 0,
  ): Promise<string[]> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new DNSSeederError('DNS timeout', 'DNS_TIMEOUT')),
        this.config.timeout,
      );
    });

    try {
      const results = await Promise.race([
        Promise.all([
          this.resolve4Async(seed),
          this.resolve6Async(seed).catch(() => []),
          this.lookupAsync(seed)
            .then((result) => [result.address])
            .catch(() => []),
        ]),
        timeoutPromise,
      ]);

      const [ipv4Addresses, ipv6Addresses, lookupResult] = results;
      const uniqueAddresses = new Set([
        ...ipv4Addresses,
        ...ipv6Addresses,
        ...lookupResult,
      ]);

      return Array.from(uniqueAddresses);
    } catch (error) {
      if (retryCount < this.config.maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.retryDelay),
        );
        return this.resolveWithRetry(seed, retryCount + 1);
      }
      throw error;
    }
  }

  private rankPeers(peers: string[]): string[] {
    if (!this.config.seedRanking) {
      return peers.slice(0, this.config.maxPeers);
    }

    return peers
      .map((peer) => ({
        address: peer,
        score: this.calculatePeerScore(peer),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxPeers)
      .map((p) => p.address);
  }

  private calculatePeerScore(peer: string): number {
    const info = this.seedCache.get(peer);
    if (!info) return 0;

    let score = 100;

    // Reduce score based on failures
    score -= info.failures * 10;

    // Prefer peers with lower latency
    score -= Math.floor(info.latency / 100);

    // Prefer peers seen recently
    const hoursSinceLastSeen = (Date.now() - info.lastSeen) / 3600000;
    score -= Math.floor(hoursSinceLastSeen * 2);

    return Math.max(0, score);
  }

  private updateSeedMetrics(
    seed: string,
    addressCount: number,
    latency: number,
  ): void {
    const info = this.seedCache.get(seed) || {
      address: seed,
      services: this.config.requiredServices,
      lastSeen: 0,
      attempts: 0,
      failures: 0,
      latency: 0,
      score: 0,
    };

    info.lastSeen = Date.now();
    info.attempts++;
    info.latency = (info.latency + latency) / 2;
    this.seedCache.set(seed, info);

    this.metrics.gauge(`seed_latency_${seed}`, latency);
    this.metrics.gauge(`seed_addresses_${seed}`, addressCount);
  }

  private handleSeedFailure(seed: string, error: Error): void {
    const info = this.seedCache.get(seed);
    if (info) {
      info.failures++;
      if (info.failures >= this.config.banThreshold) {
        this.seedCache.delete(seed);
        Logger.warn(`Banned seed ${seed} due to excessive failures`);
      } else {
        this.seedCache.set(seed, info);
      }
    }

    Logger.error(`Seed ${seed} failed:`, error);
    this.metrics.increment(`seed_failures_${seed}`);
  }

  private handleCacheEviction(key: string, value: SeedInfo): void {
    this.metrics.increment('cache_evictions');
    Logger.debug(`Evicted seed ${key} from cache`, value);
  }

  private isValidSeed(seed: SeedInfo): boolean {
    return (
      seed &&
      typeof seed.address === 'string' &&
      typeof seed.services === 'number' &&
      seed.services >= this.config.requiredServices &&
      seed.failures < this.config.banThreshold
    );
  }

  private formatPeerUrls(peers: string[]): string[] {
    return peers
      .filter((ip) => this.isValidIpAddress(ip))
      .map((ip) => `https://${ip}:${this.config.port}`);
  }

  private isValidIpAddress(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) return false;

    if (ipv4Regex.test(ip)) {
      const parts = ip.split('.').map(Number);
      return parts.every((part) => part >= 0 && part <= 255);
    }

    return true; // IPv6 format already validated by regex
  }

  public getActiveSeedCount(): number {
    return this.activeSeeds.size;
  }

  public getSeedCount(): number {
    return this.seedDomains.length;
  }

  public getCachedPeerCount(): number {
    return this.seedCache.size();
  }

  private loadSeeds(): string[] {
    const seeds =
      (
        this.configService.get(
          `${this.config.networkType.toUpperCase()}_SEEDS`,
        ) as string
      )?.split(',') || [];
    return this.validateSeeds(seeds);
  }

  private validateSeeds(seeds: string[]): string[] {
    const domainRegex =
      /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;

    return seeds.filter((seed) => {
      if (!seed || typeof seed !== 'string') {
        Logger.warn(`Invalid seed value: ${seed}`);
        return false;
      }
      if (!domainRegex.test(seed)) {
        Logger.warn(`Invalid seed domain: ${seed}`);
        return false;
      }
      return true;
    });
  }

  private async startDiscovery(): Promise<void> {
    try {
      await this.discoverPeers();
    } catch (error) {
      Logger.error('Discovery failed:', error);
    }
  }

  public getPowNodeCount(): number {
    return Array.from(this.seedCache.values()).filter(
      (seed) => (seed.services & 1) === 1,
    ).length;
  }

  public getVotingNodeCount(): number {
    return Array.from(this.seedCache.values()).filter(
      (seed) => (seed.services & 2) === 2,
    ).length;
  }

  public getNetworkHashrate(): number {
    return Array.from(this.seedCache.values()).reduce(
      (total, seed) => total + (seed.services & 4 ? 1 : 0),
      0,
    );
  }

  public async getTagHolderCount(): Promise<number> {
    return this.db.getTagHolderCount();
  }

  public async getTagDistribution(): Promise<number> {
    return this.db.getTagDistribution();
  }

  public async dispose(): Promise<void> {
    try {
      this.isRunning = false;
      if (this.discoveryTimer) {
        clearInterval(this.discoveryTimer);
        this.discoveryTimer = undefined;
      }
      await this.saveSeedsToCache();
      this.removeAllListeners();
      await this.circuitBreaker.reset();
    } catch (error) {
      Logger.error('Failed to dispose DNS seeder:', error);
      throw error;
    }
  }
}
