"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DDoSProtection = exports.DDoSError = void 0;
const events_1 = require("events");
const cache_1 = require("../scaling/cache");
const audit_1 = require("./audit");
const shared_1 = require("@h3tag-blockchain/shared");
const constants_1 = require("../blockchain/utils/constants");
class DDoSError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "DDoSError";
    }
}
exports.DDoSError = DDoSError;
class DDoSProtection {
    constructor(config = {}, auditManager) {
        this.rateLimitBuckets = new Map();
        this.eventEmitter = new events_1.EventEmitter();
        this.circuitBreaker = {
            failures: 0,
            lastFailure: 0,
            isOpen: false,
            threshold: 10,
            resetTimeout: 30000,
        };
        this.requestTracker = new Map();
        this.validateConfig(config);
        this.config = { ...DDoSProtection.DEFAULT_CONFIG, ...config };
        this.auditManager = auditManager;
        DDoSProtection.BUCKET_TYPES.forEach((type) => {
            this.rateLimitBuckets.set(type, new Map());
        });
        this.requests = new cache_1.Cache({
            ttl: Math.ceil(this.config.windowMs / 1000),
            maxSize: this.config.maxTrackedIPs,
            compression: true,
        });
        this.blockedIPs = new Set(this.config.blacklist);
        this.initializeMetrics();
        this.startCleanupInterval();
        this.initialize();
    }
    validateConfig(config) {
        if (config.windowMs && config.windowMs < 1000) {
            throw new DDoSError("Window must be at least 1 second", "INVALID_CONFIG");
        }
        if (config.maxRequests &&
            (config.maxRequests.pow < 1 ||
                config.maxRequests.qudraticVote < 1 ||
                config.maxRequests.default < 1)) {
            throw new DDoSError("Max requests must be positive", "INVALID_CONFIG");
        }
        if (config.blockDuration && config.blockDuration < 1000) {
            throw new DDoSError("Block duration must be at least 1 second", "INVALID_CONFIG");
        }
    }
    initializeMetrics() {
        this.metrics = {
            totalRequests: 0,
            blockedRequests: 0,
            activeBlocks: 0,
            totalBans: 0,
            whitelistedIPs: this.config.whitelist.length,
            blacklistedIPs: this.config.blacklist.length,
            memoryUsage: 0,
            currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        };
    }
    async initialize() {
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
        shared_1.Logger.info("DDoS protection initialized");
    }
    middleware() {
        return async (req, res, next) => {
            try {
                if (this.circuitBreaker.isOpen) {
                    if (Date.now() - this.circuitBreaker.lastFailure >
                        this.circuitBreaker.resetTimeout) {
                        this.circuitBreaker.isOpen = false;
                        this.circuitBreaker.failures = 0;
                    }
                    else {
                        return res.status(503).json({ err: "Service temporarily unavailable" });
                    }
                }
                const ip = this.getClientIP(req);
                if (!ip) {
                    throw new DDoSError("Could not determine client IP", "INVALID_IP");
                }
                const requestType = this.getRequestType(req);
                const record = await this.getRequestRecord(ip);
                if (this.isRateLimitExceeded(record, requestType)) {
                    await this.handleViolation(ip, record);
                    return res.status(429).json({
                        error: "Too many requests",
                        retryAfter: this.getRetryAfter(ip),
                    });
                }
                await this.recordRequest(ip, requestType);
                next();
            }
            catch (error) {
                this.handleFailure();
                next(error);
            }
        };
    }
    handleFailure() {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailure = Date.now();
        if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
            this.circuitBreaker.isOpen = true;
            this.eventEmitter.emit("circuit_breaker_open");
        }
    }
    getRequestType(req) {
        if (req.path.includes("/pow"))
            return "pow";
        if (req.path.includes("/vote"))
            return "vote";
        return "default";
    }
    async recordRequest(ip, type) {
        const bucket = this.rateLimitBuckets.get(type);
        if (!bucket)
            return;
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
    async shouldBlock(ip, type) {
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
        return (record.blocked ||
            this.isRateLimitExceeded(record, type));
    }
    isRateLimitExceeded(record, type) {
        const windowExpired = Date.now() - record.firstRequest > this.config.windowMs;
        if (windowExpired) {
            record.count = 1;
            record.firstRequest = Date.now();
            return false;
        }
        const limit = this.config.maxRequests[type];
        return record.count > limit;
    }
    async handleViolation(ip, record) {
        const blockDuration = record.violations * this.config.blockDuration;
        if (record.violations >= this.config.banThreshold) {
            this.blockedIPs.add(ip);
            this.metrics.totalBans++;
            await this.auditManager.logEvent({
                type: audit_1.AuditEventType.SECURITY,
                severity: audit_1.AuditSeverity.HIGH,
                source: "ddos_protection",
                details: {
                    message: `IP ${ip} banned for exceeding ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} rate limit threshold`,
                    ip,
                    violations: record.violations,
                    currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
                },
                data: {
                    ip,
                    violations: record.violations,
                    currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
                },
            });
            this.eventEmitter.emit("ip_banned", {
                ip,
                violations: record.violations,
                currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
            });
        }
        else {
            await this.blockIP(ip, blockDuration);
        }
        await this.auditManager.logEvent({
            type: audit_1.AuditEventType.SECURITY,
            severity: audit_1.AuditSeverity.WARNING,
            source: "ddos_protection",
            details: {
                ip,
                violations: record.violations,
                requests: record.count,
                timeWindow: this.config.windowMs,
            },
        });
    }
    async blockIP(ip, duration) {
        const record = this.requests.get(ip);
        if (record) {
            record.blocked = true;
            this.requests.set(ip, record, { ttl: duration / 1000 });
            this.metrics.activeBlocks++;
        }
        this.eventEmitter.emit("ip_blocked", { ip, duration });
    }
    getClientIP(req) {
        const ip = this.config.trustProxy
            ? req.ip || (typeof req.headers["x-forwarded-for"] === 'string'
                ? req.headers["x-forwarded-for"].split(",")[0]
                : req.headers["x-forwarded-for"]?.[0])
            : req.socket.remoteAddress;
        if (!ip || typeof ip !== "string") {
            throw new DDoSError("Invalid IP address", "INVALID_IP");
        }
        return ip.trim();
    }
    startCleanupInterval() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldRecords().catch((err) => shared_1.Logger.error("Failed to cleanup old records:", err));
        }, this.config.cleanupInterval);
        this.cleanupInterval.unref();
    }
    async cleanupOldRecords() {
        const now = Date.now();
        let cleaned = 0;
        for (const [ip, record] of this.requests.entries()) {
            if (now - record.lastRequest > this.config.windowMs * 2) {
                this.requests.delete(ip);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            shared_1.Logger.debug(`Cleaned up ${cleaned} old IP records`);
        }
    }
    getRetryAfter(ip) {
        const record = this.requests.get(ip);
        if (!record || !record.blocked)
            return 0;
        const now = Date.now();
        const blockEnd = record.lastViolation + record.violations * this.config.blockDuration;
        return Math.max(0, Math.ceil((blockEnd - now) / 1000));
    }
    getMetrics() {
        return {
            ...this.metrics,
            memoryUsage: this.requests.getStats().memoryUsage,
            currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        };
    }
    unblockIP(ip) {
        this.blockedIPs.delete(ip);
        this.requests.delete(ip);
        this.metrics.activeBlocks = Math.max(0, this.metrics.activeBlocks - 1);
        this.eventEmitter.emit("ip_unblocked", { ip });
    }
    shutdown() {
        clearInterval(this.cleanupInterval);
        this.requests.shutdown();
        this.eventEmitter.emit("shutdown");
        shared_1.Logger.info("DDoS protection shutdown");
    }
    async getRequestRecord(ip) {
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
    checkRequest(type, address) {
        try {
            // Generate unique key for this address and request type
            const key = `${type}:${address}`;
            const now = Date.now();
            // Get rate limit configuration for this type
            const limit = this.config.maxRequests[type] || this.config.maxRequests.default;
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
                    this.logViolation(address, type, "Request blocked - cooldown period");
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
                this.logViolation(address, type, `Rate limit exceeded: ${tracking.count}/${limit}`);
                // Update tracking
                this.requestTracker.set(key, tracking);
                // Emit event for monitoring
                this.auditManager.log(audit_1.AuditEventType.DDOS_VIOLATION, {
                    address,
                    type,
                    count: tracking.count,
                    limit,
                    severity: audit_1.AuditSeverity.WARNING,
                });
                return false;
            }
            // Update tracking
            this.requestTracker.set(key, tracking);
            return true;
        }
        catch (error) {
            // Log error but allow request to proceed in case of internal error
            shared_1.Logger.error("DDoS protection error:", error);
            return true;
        }
    }
    /**
     * Logs a rate limit violation
     */
    logViolation(address, type, reason) {
        shared_1.Logger.warn(`Rate limit violation: ${reason}`, {
            address,
            type,
            timestamp: new Date().toISOString(),
        });
    }
    async dispose() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.requests.clear();
        this.blockedIPs.clear();
        this.rateLimitBuckets.clear();
    }
}
exports.DDoSProtection = DDoSProtection;
DDoSProtection.BUCKET_TYPES = ["pow", "vote", "default"];
DDoSProtection.PRIORITIES = {
    POW: 3,
    VOTE: 2,
    DEFAULT: 1,
};
DDoSProtection.DEFAULT_CONFIG = {
    windowMs: 60000,
    maxRequests: {
        pow: 200, // Higher throughput for PoW mining
        qudraticVote: 100, // Reasonable limit for voting
        default: 50, // Conservative default
    },
    blockDuration: 3600000,
    whitelist: [],
    blacklist: [],
    trustProxy: false,
    banThreshold: 5,
    maxTrackedIPs: 100000,
    cleanupInterval: 300000,
    currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
};
