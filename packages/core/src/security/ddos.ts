import { EventEmitter } from 'events';
import { Cache } from '../scaling/cache';
import { AuditManager, AuditEventType, AuditSeverity } from './audit';
import { Logger } from '@h3tag-blockchain/shared';
import { BLOCKCHAIN_CONSTANTS } from '../blockchain/utils/constants';
import { Request, Response } from 'express';

export class DDoSError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'DDoSError';
  }
}

interface DDoSConfig {
  windowMs: number;
  maxRequests: {
    pow: number; // Higher limit for PoW mining requests
    quadraticVote: number; // Limit for voting requests
    default: number; // Default limit for other requests
  };
  blockDuration: number;
  whitelist: string[];
  blacklist: string[];
  trustProxy: boolean;
  banThreshold: number;
  maxTrackedIPs: number;
  cleanupInterval: number;
  currency: string;
}

interface RequestRecord {
  ip: string;
  count: number;
  firstRequest: number;
  lastRequest: number;
  blocked: boolean;
  violations: number;
  lastViolation?: number;
}

interface DDoSMetrics {
  totalRequests: number;
  blockedRequests: number;
  activeBlocks: number;
  totalBans: number;
  whitelistedIPs: number;
  blacklistedIPs: number;
  memoryUsage: number;
  currency: string;
}

export class DDoSProtection {
  private requests: Cache<RequestRecord>;
  private blockedIPs: Set<string>;
  private readonly config: DDoSConfig;
  private readonly auditManager: AuditManager;
  private metrics: DDoSMetrics | undefined;
  private cleanupInterval: NodeJS.Timeout | undefined;
  private readonly rateLimitBuckets = new Map<
    string,
    Map<string, RequestRecord>
  >();
  private static readonly BUCKET_TYPES = ['pow', 'vote', 'default'];
  private readonly eventEmitter = new EventEmitter();
  private readonly circuitBreaker = {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
    threshold: 10,
    resetTimeout: 30000,
  };
  private static readonly PRIORITIES = {
    POW: 3,
    VOTE: 2,
    DEFAULT: 1,
  };
  private readonly requestTracker = new Map<
    string,
    {
      count: number;
      firstRequest: number;
      blocked: boolean;
      blockExpires: number;
    }
  >();

  private static readonly DEFAULT_CONFIG: DDoSConfig = {
    windowMs: 60000,
    maxRequests: {
      pow: 200, // Higher throughput for PoW mining
      quadraticVote: 100, // Reasonable limit for voting
      default: 50, // Conservative default
    },
    blockDuration: 3600000,
    whitelist: [],
    blacklist: [],
    trustProxy: false,
    banThreshold: 5,
    maxTrackedIPs: 100000,
    cleanupInterval: 300000,
    currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
  };

  constructor(config: Partial<DDoSConfig> = {}, auditManager: AuditManager) {
    this.validateConfig(config);
    this.config = { ...DDoSProtection.DEFAULT_CONFIG, ...config };
    this.auditManager = auditManager;

    DDoSProtection.BUCKET_TYPES.forEach((type) => {
      this.rateLimitBuckets.set(type, new Map());
    });

    this.requests = new Cache<RequestRecord>({
      ttl: Math.ceil(this.config.windowMs / 1000),
      maxSize: this.config.maxTrackedIPs,
      compression: true,
    });

    this.blockedIPs = new Set(this.config.blacklist);
    this.initializeMetrics();
    this.startCleanupInterval();
    this.initialize();
  }

  private validateConfig(config: Partial<DDoSConfig>): void {
    if (config.windowMs && config.windowMs < 1000) {
      throw new DDoSError('Window must be at least 1 second', 'INVALID_CONFIG');
    }
    if (
      config.maxRequests &&
      (config.maxRequests.pow < 1 ||
        config.maxRequests.quadraticVote < 1 ||
        config.maxRequests.default < 1)
    ) {
      throw new DDoSError('Max requests must be positive', 'INVALID_CONFIG');
    }
    if (config.blockDuration && config.blockDuration < 1000) {
      throw new DDoSError(
        'Block duration must be at least 1 second',
        'INVALID_CONFIG',
      );
    }
  }

  private initializeMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      activeBlocks: 0,
      totalBans: 0,
      whitelistedIPs: this.config.whitelist.length,
      blacklistedIPs: this.config.blacklist.length,
      memoryUsage: 0,
      currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
    };
  }

  public async initialize(): Promise<void> {
    // Add whitelist IPs to cache with higher limits
    for (const ip of this.config.whitelist) {
      this.requests.set(ip, {
        ip,
        count: 0,
        firstRequest: Date.now(),
        lastRequest: Date.now(),
        blocked: false,
        violations: 0,
      });
    }
    Logger.info('DDoS protection initialized');
  }

  public middleware() {
    return async (req: Request, res: Response, next: (err?: Error) => void) => {
      try {
        if (this.circuitBreaker.isOpen) {
          if (
            Date.now() - this.circuitBreaker.lastFailure >
            this.circuitBreaker.resetTimeout
          ) {
            this.circuitBreaker.isOpen = false;
            this.circuitBreaker.failures = 0;
          } else {
            return res
              .status(503)
              .json({ err: 'Service temporarily unavailable' });
          }
        }

        const ip = this.getClientIP(req);
        if (!ip) {
          throw new DDoSError('Could not determine client IP', 'INVALID_IP');
        }

        const requestType = this.getRequestType(req);
        const record = await this.getRequestRecord(ip);

        if (
          this.isRateLimitExceeded(
            record,
            requestType as 'pow' | 'quadraticVote' | 'default',
          )
        ) {
          await this.handleViolation(ip, record);
          return res.status(429).json({
            error: 'Too many requests',
            retryAfter: this.getRetryAfter(ip),
          });
        }

        await this.recordRequest(ip, requestType);
        next();
      } catch (error: unknown) {
        this.handleFailure();
        next(error as Error | undefined);
      }
    };
  }

  private handleFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();

    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.isOpen = true;
      this.eventEmitter.emit('circuit_breaker_open');
    }
  }

  private getRequestType(req: Request): string {
    if (req.path.includes('/pow')) return 'pow';
    if (req.path.includes('/vote')) return 'quadraticVote';
    return 'default';
  }

  private async recordRequest(ip: string, type: string): Promise<void> {
    const bucket = this.rateLimitBuckets.get(type);
    if (!bucket) return;

    const record = bucket.get(ip) || {
      ip,
      count: 0,
      firstRequest: Date.now(),
      lastRequest: Date.now(),
      blocked: false,
      violations: 0,
    };

    record.count++;
    record.lastRequest = Date.now();
    bucket.set(ip, record);
  }

  public async shouldBlock(ip: string, type: string): Promise<boolean> {
    if (this.blockedIPs.has(ip)) {
      return true;
    }

    if (this.config.whitelist.includes(ip)) {
      return false;
    }

    const record = this.requests.get(ip);
    if (!record) {
      return false;
    }

    return (
      record.blocked ||
      this.isRateLimitExceeded(
        record,
        type as 'pow' | 'quadraticVote' | 'default',
      )
    );
  }

  private isRateLimitExceeded(
    record: RequestRecord,
    type: 'pow' | 'quadraticVote' | 'default',
  ): boolean {
    const windowExpired =
      Date.now() - record.firstRequest > this.config.windowMs;
    if (windowExpired) {
      record.count = 1;
      record.firstRequest = Date.now();
      return false;
    }

    const limit = this.config.maxRequests[type];
    return record.count > limit;
  }

  private async handleViolation(
    ip: string,
    record: RequestRecord,
  ): Promise<void> {
    record.violations = (record.violations || 0) + 1;
    record.lastViolation = Date.now();

    const blockDuration = record.violations * this.config.blockDuration;

    if (record.violations >= this.config.banThreshold) {
      this.blockedIPs.add(ip);
      if (this.metrics) {
        this.metrics.totalBans++;
      }

      await this.auditManager.logEvent({
        type: AuditEventType.SECURITY,
        severity: AuditSeverity.HIGH,
        source: 'ddos_protection',
        details: {
          message: `IP ${ip} banned for exceeding ${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} rate limit threshold`,
          ip,
          violations: record.violations,
          currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        },
        data: {
          ip,
          violations: record.violations,
          currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        },
      });

      this.eventEmitter.emit('ip_banned', {
        ip,
        violations: record.violations,
        currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
      });
    } else {
      await this.blockIP(ip, blockDuration);
    }

    await this.auditManager.logEvent({
      type: AuditEventType.SECURITY,
      severity: AuditSeverity.WARNING,
      source: 'ddos_protection',
      details: {
        ip,
        violations: record.violations,
        requests: record.count,
        timeWindow: this.config.windowMs,
      },
    });
  }

  private async blockIP(ip: string, duration: number): Promise<void> {
    const record = this.requests.get(ip);
    if (record) {
      if (!record.blocked) {
        record.blocked = true;
        if (this.metrics) {
          this.metrics.activeBlocks++;
        }
      }
      this.requests.set(ip, record, { ttl: duration / 1000 });
    }

    this.eventEmitter.emit('ip_blocked', { ip, duration });
  }

  private getClientIP(req: Request): string {
    const ip = this.config.trustProxy
      ? (req as Request).ip ||
        (typeof req.headers['x-forwarded-for'] === 'string'
          ? req.headers['x-forwarded-for'].split(',')[0]
          : req.headers['x-forwarded-for']?.[0])
      : req.socket.remoteAddress;

    if (!ip || typeof ip !== 'string') {
      throw new DDoSError('Invalid IP address', 'INVALID_IP');
    }
    return ip.trim();
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupOldRecords();
        await this.cleanupRequestTracker();
      } catch (err) {
        Logger.error('Failed to cleanup old records or tracker:', err);
      }
    }, this.config.cleanupInterval);

    this.cleanupInterval.unref();
  }

  private async cleanupOldRecords(): Promise<void> {
    const now = Date.now();
    let cleaned = 0;

    for (const [ip, record] of this.requests.entries()) {
      if (now - record.lastRequest > this.config.windowMs * 2) {
        this.requests.delete(ip);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      Logger.debug(`Cleaned up ${cleaned} old IP records`);
    }
  }

  private getRetryAfter(ip: string): number {
    const record = this.requests.get(ip);
    if (!record || !record.blocked) return 0;

    const now = Date.now();
    const blockEnd =
      record.lastViolation! + record.violations * this.config.blockDuration;
    return Math.max(0, Math.ceil((blockEnd - now) / 1000));
  }

  public getMetrics(): DDoSMetrics {
    if (!this.metrics) {
      throw new Error('Metrics are not initialized');
    }
    return {
      ...this.metrics,
      memoryUsage: this.requests.getStats().memoryUsage,
      currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
    };
  }

  public unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
    this.requests.delete(ip);
    if (this.metrics) {
      this.metrics.activeBlocks = Math.max(0, this.metrics.activeBlocks - 1);
    }
    this.eventEmitter.emit('ip_unblocked', { ip });
  }

  public shutdown(): void {
    clearInterval(this.cleanupInterval);
    this.requests.shutdown();
    this.eventEmitter.emit('shutdown');
    Logger.info('DDoS protection shutdown');
  }

  private async getRequestRecord(ip: string): Promise<RequestRecord> {
    let record = this.requests.get(ip);
    if (!record) {
      record = {
        ip,
        count: 0,
        firstRequest: Date.now(),
        lastRequest: Date.now(),
        blocked: false,
        violations: 0,
      };
      this.requests.set(ip, record);
    }
    return record;
  }

  /**
   * Checks if a request should be allowed based on rate limits
   * @param type Request type identifier
   * @param address Source address making the request
   * @returns boolean True if request is allowed, false if it should be blocked
   */
  public checkRequest(type: string, address: string): boolean {
    try {
      // Generate unique key for this address and request type
      const key = `${type}:${address}`;
      const now = Date.now();

      // Get rate limit configuration for this type
      const limit =
        this.config.maxRequests[type as keyof typeof this.config.maxRequests] ||
        this.config.maxRequests.default;
      const windowMs = this.config.windowMs;

      // Get or initialize request tracking
      let tracking = this.requestTracker.get(key) || {
        count: 0,
        firstRequest: now,
        blocked: false,
        blockExpires: 0,
      };

      // Check if address is blocked
      if (tracking.blocked) {
        if (now < tracking.blockExpires) {
          // Still blocked
          this.logViolation(address, type, 'Request blocked - cooldown period');
          return false;
        }
        // Block expired, reset tracking
        tracking = {
          count: 0,
          firstRequest: now,
          blocked: false,
          blockExpires: 0,
        };
      }

      // Reset window if needed
      if (now - tracking.firstRequest > windowMs) {
        tracking.count = 0;
        tracking.firstRequest = now;
      }

      // Increment request count
      tracking.count++;

      // Check if limit exceeded
      if (tracking.count > limit) {
        // Block the address
        tracking.blocked = true;
        tracking.blockExpires = now + this.config.blockDuration;

        // Log violation
        this.logViolation(
          address,
          type,
          `Rate limit exceeded: ${tracking.count}/${limit}`,
        );

        // Update tracking
        this.requestTracker.set(key, tracking);

        // Emit event for monitoring
        this.auditManager.log(AuditEventType.DDOS_VIOLATION, {
          address,
          type,
          count: tracking.count,
          limit,
          severity: AuditSeverity.WARNING,
        });

        return false;
      }

      // Update tracking
      this.requestTracker.set(key, tracking);
      return true;
    } catch (error) {
      // Log error but allow request to proceed in case of internal error
      Logger.error('DDoS protection error:', error);
      return true;
    }
  }

  /**
   * Logs a rate limit violation
   */
  private logViolation(address: string, type: string, reason: string): void {
    Logger.warn(`Rate limit violation: ${reason}`, {
      address,
      type,
      timestamp: new Date().toISOString(),
    });
  }

  public async dispose(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.requests.clear();
    this.blockedIPs.clear();
    this.rateLimitBuckets.clear();
  }

  /**
   * Cleans up the stale entries in the request tracker.
   * This method now also removes entries where the cooldown period has ended.
   */
  private async cleanupRequestTracker(): Promise<void> {
    const now = Date.now();
    for (const [key, tracking] of this.requestTracker.entries()) {
      // Remove the tracking if it is not blocked and the window has passed
      if (
        !tracking.blocked &&
        now - tracking.firstRequest > this.config.windowMs
      ) {
        this.requestTracker.delete(key);
      }
      // Remove the tracking if it is blocked but the cooldown period has ended.
      else if (tracking.blocked && now >= tracking.blockExpires) {
        this.requestTracker.delete(key);
      }
    }
  }
}
