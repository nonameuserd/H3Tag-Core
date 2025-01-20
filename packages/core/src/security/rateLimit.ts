import { EventEmitter } from 'events';
import { Cache } from '../scaling/cache';
import { AuditManager, AuditEventType, AuditSeverity } from './audit';
import { Request, Response, NextFunction } from 'express';
import { Logger } from '@h3tag-blockchain/shared';
import { BLOCKCHAIN_CONSTANTS } from '../blockchain/utils/constants';

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

interface RateLimitRequest extends Request {
  consensusType?: 'pow' | 'quadraticVote' | 'default';
  headers: {
    'x-forwarded-for'?: string;
  } & Request['headers'];
}

interface RateLimitResponse extends Response {
  setHeader(name: string, value: string | number): this;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: {
    pow: number;
    qudraticVote: number;
    default: number;
  };
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response, next: (err?: Error) => void) => void;
  skip?: (req: Request) => boolean;
  keyPrefix?: string;
  skipFailedRequests?: boolean;
  headers?: boolean;
  trustProxy?: boolean;
  maxKeys?: number;
  blockDuration?: number;
  priorityLevels?: {
    pow: number;
    quadratic_vote: number;
    default: number;
  };
}

interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: number;
  blocked: boolean;
  lastRequest: number;
  currency: string;
}

interface RateLimitMetrics {
  totalRequests: number;
  blockedRequests: number;
  activeKeys: number;
  memoryUsage: number;
  currency: string;
}

export class RateLimit {
  private readonly eventEmitter = new EventEmitter();
  private limiter: Cache<RateLimitInfo>;
  private readonly config: RateLimitConfig;
  private readonly auditManager: AuditManager;
  private metrics: RateLimitMetrics | undefined;
  private limits = new Map<string, { count: number; timestamp: number }>();
  private readonly MAX_REQUESTS = 100;
  private readonly WINDOW_MS = 60000; // 1 minute

  private static readonly DEFAULT_CONFIG: RateLimitConfig = {
    windowMs: 60000,
    maxRequests: {
      pow: 200,
      qudraticVote: 100,
      default: 50,
    },
    keyPrefix: 'rl:',
    skipFailedRequests: false,
    headers: true,
    trustProxy: false,
    maxKeys: 100000,
    blockDuration: 3600000,
    priorityLevels: {
      pow: 3,
      quadratic_vote: 2,
      default: 1,
    },
  };

  constructor(config: Partial<RateLimitConfig>, auditManager: AuditManager) {
    this.validateConfig(config);
    this.config = {
      ...RateLimit.DEFAULT_CONFIG,
      ...config,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator.bind(this),
      handler: config.handler || this.defaultHandler.bind(this),
    };
    this.auditManager = auditManager;
    this.limiter = new Cache<RateLimitInfo>({
      ttl: Math.ceil(this.config.windowMs / 1000),
      maxSize: this.config.maxKeys,
      compression: true,
      priorityLevels: {
        pow: 3,
        quadratic_vote: 2,
        default: 1,
      },
    });

    this.initializeMetrics();
  }

  private validateConfig(config: Partial<RateLimitConfig>): void {
    if (config.windowMs && config.windowMs < 1000) {
      throw new RateLimitError(
        'Window must be at least 1 second',
        'INVALID_CONFIG',
      );
    }
    if (
      config.maxRequests &&
      (config.maxRequests.pow < 1 ||
        config.maxRequests.qudraticVote < 1 ||
        config.maxRequests.default < 1)
    ) {
      throw new RateLimitError(
        'Max requests must be positive',
        'INVALID_CONFIG',
      );
    }
  }

  private initializeMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      activeKeys: 0,
      memoryUsage: 0,
      currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
    };
  }

  public middleware() {
    return async (
      req: RateLimitRequest,
      res: RateLimitResponse,
      next: NextFunction,
    ) => {
      if (this.config.skip?.(req) ?? false) {
        return next();
      }

      try {
        const key = this.config.keyGenerator?.(req) ?? '';
        const info = await this.checkRateLimit(
          key,
          req.consensusType || 'default',
        );

        if (this.config.headers) {
          this.setHeaders(res, info);
        }

        if (info.blocked) {
          if (this.metrics) {
            this.metrics.blockedRequests++;
          }
          return this.config.handler?.(req, res, next);
        }

        if (this.metrics) {
          this.metrics.totalRequests++;
        }

        if (this.config.skipFailedRequests) {
          res.on('finish', () => {
            if (res.statusCode < 400) {
              this.incrementCounter(key);
            }
          });
        } else {
          await this.incrementCounter(key);
        }

        next();
      } catch (error) {
        Logger.error('Rate limit error:', error);
        next(error);
      }
    };
  }

  private async checkRateLimit(
    key: string,
    type: 'pow' | 'quadraticVote' | 'default',
  ): Promise<RateLimitInfo> {
    const now = Date.now();
    let info = this.limiter.get(key);

    if (!info || now > info.resetTime) {
      info = {
        limit: this.config.maxRequests[type as keyof typeof this.config.maxRequests],
        current: 0,
        remaining: this.config.maxRequests[type as keyof typeof this.config.maxRequests],
        resetTime: now + this.config.windowMs,
        blocked: false,
        lastRequest: now,
        currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
      };
    }

    if (info.current >= info.limit) {
      info.blocked = true;
      info.resetTime = now + (this.config.blockDuration ?? 0);
      await this.auditManager.logEvent({
        type: AuditEventType.SECURITY,
        severity: AuditSeverity.WARNING,
        source: 'rate_limit',
        details: { key, requests: info.current },
      });
    }

    this.limiter.set(key, info, {
      priority: this.config.priorityLevels?.[type as keyof typeof this.config.priorityLevels] ?? 0,
    });

    return info;
  }

  private async incrementCounter(key: string): Promise<void> {
    const info = this.limiter.get(key);
    if (info) {
      info.current++;
      info.remaining = Math.max(0, info.limit - info.current);
      info.lastRequest = Date.now();

      if (info.remaining === 0) {
        info.blocked = true;
        info.resetTime = Date.now() + (this.config.blockDuration ?? 0);
        this.eventEmitter.emit('blocked', { key });
        await this.auditManager.logEvent({
          type: AuditEventType.SECURITY,
          severity: AuditSeverity.WARNING,
          source: 'rate_limit',
          details: { key, requests: info.current },
        });
      }

      this.limiter.set(key, info);
    }
  }

  private defaultKeyGenerator(req: RateLimitRequest): string {
    const ip = this.config.trustProxy
      ? req.ip || req.headers['x-forwarded-for']?.split(',')[0]
      : req.connection?.remoteAddress;

    if (!ip) {
      throw new RateLimitError('Unable to determine client IP', 'INVALID_IP');
    }

    return this.config.keyPrefix + ip.trim();
  }

  private defaultHandler(req: RateLimitRequest, res: RateLimitResponse): void {
    Logger.warn(
      `Rate limit exceeded for ${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} request:`,
      {
        ip: req.ip,
        path: req.path,
        currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
      },
    );

    res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded for ${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL}`,
      retryAfter: Math.ceil((this.config.blockDuration ?? 0) / 1000),
      currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
    });
  }

  private setHeaders(res: RateLimitResponse, info: RateLimitInfo): void {
    if (this.config.headers) {
      res.setHeader('X-RateLimit-Limit', info.limit);
      res.setHeader('X-RateLimit-Remaining', info.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(info.resetTime / 1000));
      res.setHeader(
        'X-RateLimit-Currency',
        BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
      );
    }
  }

  public getMetrics(): RateLimitMetrics {
    return {
      ...this.metrics,
      currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
    } as RateLimitMetrics;
  }

  public resetLimit(key: string): void {
    if (this.limiter.delete(key)) {
      if (this.metrics) {
        this.metrics.activeKeys = Math.max(0, this.metrics.activeKeys - 1);
      }
    }
  }

  public async shutdown(): Promise<void> {
    this.limiter.shutdown();
    this.eventEmitter.emit('shutdown');
    Logger.info('Rate limiter shutdown');
  }

  public async checkLimit(
    key: string,
    type: 'pow' | 'quadraticVote' | 'default' = 'default',
  ): Promise<boolean> {
    const info = await this.checkRateLimit(key, type);
    await this.incrementCounter(key);
    return !info.blocked;
  }

  public on(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  public off(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  public removeAllListeners(): void {
    this.eventEmitter.removeAllListeners();
  }

  public getActiveKeys(): string[] {
    return Array.from(this.limiter.keys());
  }

  public getLastAccess(key: string): number {
    const info = this.limiter.get(key);
    return info?.lastRequest || 0;
  }
}
