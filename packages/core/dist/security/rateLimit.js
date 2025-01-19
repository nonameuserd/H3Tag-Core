"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimit = exports.RateLimitError = void 0;
const events_1 = require("events");
const cache_1 = require("../scaling/cache");
const audit_1 = require("./audit");
const shared_1 = require("@h3tag-blockchain/shared");
const constants_1 = require("../blockchain/utils/constants");
class RateLimitError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "RateLimitError";
    }
}
exports.RateLimitError = RateLimitError;
class RateLimit {
    constructor(config, auditManager) {
        this.eventEmitter = new events_1.EventEmitter();
        this.limits = new Map();
        this.MAX_REQUESTS = 100;
        this.WINDOW_MS = 60000; // 1 minute
        this.validateConfig(config);
        this.config = {
            ...RateLimit.DEFAULT_CONFIG,
            ...config,
            keyGenerator: config.keyGenerator || this.defaultKeyGenerator.bind(this),
            handler: config.handler || this.defaultHandler.bind(this),
        };
        this.auditManager = auditManager;
        this.limiter = new cache_1.Cache({
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
    validateConfig(config) {
        if (config.windowMs && config.windowMs < 1000) {
            throw new RateLimitError("Window must be at least 1 second", "INVALID_CONFIG");
        }
        if (config.maxRequests &&
            (config.maxRequests.pow < 1 ||
                config.maxRequests.qudraticVote < 1 ||
                config.maxRequests.default < 1)) {
            throw new RateLimitError("Max requests must be positive", "INVALID_CONFIG");
        }
    }
    initializeMetrics() {
        this.metrics = {
            totalRequests: 0,
            blockedRequests: 0,
            activeKeys: 0,
            memoryUsage: 0,
            currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        };
    }
    middleware() {
        return async (req, res, next) => {
            if (this.config.skip(req)) {
                return next();
            }
            try {
                const key = this.config.keyGenerator(req);
                const info = await this.checkRateLimit(key, req.consensusType || "default");
                if (this.config.headers) {
                    this.setHeaders(res, info);
                }
                if (info.blocked) {
                    this.metrics.blockedRequests++;
                    return this.config.handler(req, res, next);
                }
                this.metrics.totalRequests++;
                if (this.config.skipFailedRequests) {
                    res.on("finish", () => {
                        if (res.statusCode < 400) {
                            this.incrementCounter(key);
                        }
                    });
                }
                else {
                    await this.incrementCounter(key);
                }
                next();
            }
            catch (error) {
                shared_1.Logger.error("Rate limit error:", error);
                next(error);
            }
        };
    }
    async checkRateLimit(key, type) {
        const now = Date.now();
        let info = this.limiter.get(key);
        if (!info || now > info.resetTime) {
            info = {
                limit: this.config.maxRequests[type],
                current: 0,
                remaining: this.config.maxRequests[type],
                resetTime: now + this.config.windowMs,
                blocked: false,
                lastRequest: now,
                currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
            };
        }
        if (info.current >= info.limit) {
            info.blocked = true;
            info.resetTime = now + this.config.blockDuration;
            await this.auditManager.logEvent({
                type: audit_1.AuditEventType.SECURITY,
                severity: audit_1.AuditSeverity.WARNING,
                source: "rate_limit",
                details: { key, requests: info.current },
            });
        }
        this.limiter.set(key, info, {
            priority: this.config.priorityLevels[type],
        });
        return info;
    }
    async incrementCounter(key) {
        const info = this.limiter.get(key);
        if (info) {
            info.current++;
            info.remaining = Math.max(0, info.limit - info.current);
            info.lastRequest = Date.now();
            if (info.remaining === 0) {
                info.blocked = true;
                info.resetTime = Date.now() + this.config.blockDuration;
                this.eventEmitter.emit("blocked", { key });
                await this.auditManager.logEvent({
                    type: audit_1.AuditEventType.SECURITY,
                    severity: audit_1.AuditSeverity.WARNING,
                    source: "rate_limit",
                    details: { key, requests: info.current },
                });
            }
            this.limiter.set(key, info);
        }
    }
    defaultKeyGenerator(req) {
        const ip = this.config.trustProxy
            ? req.ip || req.headers["x-forwarded-for"]?.split(",")[0]
            : req.connection?.remoteAddress;
        if (!ip) {
            throw new RateLimitError("Unable to determine client IP", "INVALID_IP");
        }
        return this.config.keyPrefix + ip.trim();
    }
    defaultHandler(req, res) {
        shared_1.Logger.warn(`Rate limit exceeded for ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} request:`, {
            ip: req.ip,
            path: req.path,
            currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        });
        res.status(429).json({
            error: "Too Many Requests",
            message: `Rate limit exceeded for ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL}`,
            retryAfter: Math.ceil(this.config.blockDuration / 1000),
            currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        });
    }
    setHeaders(res, info) {
        if (this.config.headers) {
            res.setHeader("X-RateLimit-Limit", info.limit);
            res.setHeader("X-RateLimit-Remaining", info.remaining);
            res.setHeader("X-RateLimit-Reset", Math.ceil(info.resetTime / 1000));
            res.setHeader("X-RateLimit-Currency", constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL);
        }
    }
    getMetrics() {
        return {
            ...this.metrics,
            currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        };
    }
    resetLimit(key) {
        if (this.limiter.delete(key)) {
            this.metrics.activeKeys = Math.max(0, this.metrics.activeKeys - 1);
        }
    }
    async shutdown() {
        this.limiter.shutdown();
        this.eventEmitter.emit("shutdown");
        shared_1.Logger.info("Rate limiter shutdown");
    }
    async checkLimit(key, type = "default") {
        const info = await this.checkRateLimit(key, type);
        await this.incrementCounter(key);
        return !info.blocked;
    }
    on(event, listener) {
        this.eventEmitter.on(event, listener);
    }
    off(event, listener) {
        this.eventEmitter.off(event, listener);
    }
    removeAllListeners() {
        this.eventEmitter.removeAllListeners();
    }
    getActiveKeys() {
        return Array.from(this.limiter.keys());
    }
    getLastAccess(key) {
        const info = this.limiter.get(key);
        return info?.lastRequest || 0;
    }
}
exports.RateLimit = RateLimit;
RateLimit.DEFAULT_CONFIG = {
    windowMs: 60000,
    maxRequests: {
        pow: 200,
        qudraticVote: 100,
        default: 50,
    },
    keyPrefix: "rl:",
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
