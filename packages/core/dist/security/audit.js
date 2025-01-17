"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultAuditorsConsensus = exports.AuditManager = exports.AuditSeverity = exports.AuditEventType = exports.AuditError = void 0;
const events_1 = require("events");
const cache_1 = require("../scaling/cache");
const crypto_1 = require("@h3tag-blockchain/crypto");
const zlib_1 = __importDefault(require("zlib"));
const shared_1 = require("@h3tag-blockchain/shared");
const constants_1 = require("../blockchain/utils/constants");
const default_audit_storage_1 = require("./default-audit-storage");
class AuditError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "AuditError";
    }
}
exports.AuditError = AuditError;
var AuditEventType;
(function (AuditEventType) {
    AuditEventType["CONSENSUS"] = "CONSENSUS";
    AuditEventType["POW_BLOCK"] = "POW_BLOCK";
    AuditEventType["VOTE"] = "VOTE";
    AuditEventType["SECURITY"] = "SECURITY";
    AuditEventType["VALIDATION"] = "VALIDATION";
    AuditEventType["VOTING_HEALTH_CHECK_FAILED"] = "VOTING_HEALTH_CHECK_FAILED";
    AuditEventType["CONSENSUS_HEALTH_CHECK_FAILED"] = "CONSENSUS_HEALTH_CHECK_FAILED";
    AuditEventType["MEMPOOL_HEALTH_CHECK_FAILED"] = "MEMPOOL_HEALTH_CHECK_FAILED";
    AuditEventType["MINING_HEALTH_CHECK_FAILED"] = "MINING_HEALTH_CHECK_FAILED";
    AuditEventType["CURRENCY_VALIDATION_FAILED"] = "CURRENCY_VALIDATION_FAILED";
    AuditEventType["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    AuditEventType["VALIDATION_FAILED"] = "VALIDATION_FAILED";
    AuditEventType["BLOCK_VALIDATED"] = "BLOCK_VALIDATED";
    AuditEventType["VOTE_HANDLING_ERROR"] = "VOTE_HANDLING_ERROR";
    AuditEventType["VALIDATION_SUCCESS"] = "VALIDATION_SUCCESS";
    AuditEventType["TYPE"] = "node_selection";
    AuditEventType["CACHE_EVICTION"] = "CACHE_EVICTION";
    AuditEventType["POW_CONTRIBUTION_CHECKED"] = "POW_CONTRIBUTION_CHECKED";
    AuditEventType["POW_CONTRIBUTION_FAILED"] = "POW_CONTRIBUTION_FAILED";
    AuditEventType["VOTE_VERIFIED"] = "VOTE_VERIFIED";
    AuditEventType["VOTE_VERIFICATION_FAILED"] = "VOTE_VERIFICATION_FAILED";
    AuditEventType["VOTE_TRANSACTION_ADDED"] = "VOTE_TRANSACTION_ADDED";
    AuditEventType["VOTE_TRANSACTION_FAILED"] = "VOTE_TRANSACTION_FAILED";
    AuditEventType["REPUTATION_DATA_LOADED"] = "REPUTATION_DATA_LOADED";
    AuditEventType["REPUTATION_LOAD_FAILED"] = "REPUTATION_LOAD_FAILED";
    AuditEventType["REPUTATION_UPDATED"] = "REPUTATION_UPDATED";
    AuditEventType["REPUTATION_UPDATE_FAILED"] = "REPUTATION_UPDATE_FAILED";
    AuditEventType["MERKLE_ERROR"] = "MERKLE_ERROR";
    AuditEventType["VALIDATOR_SUSPENSION"] = "VALIDATOR_SUSPENSION";
    AuditEventType["VALIDATOR_ABSENCE_HANDLING_FAILED"] = "VALIDATOR_ABSENCE_HANDLING_FAILED";
    AuditEventType["BACKUP_VALIDATOR_SELECTED"] = "BACKUP_VALIDATOR_SELECTED";
    AuditEventType["BACKUP_SELECTION_FAILED"] = "BACKUP_SELECTION_FAILED";
    AuditEventType["VALIDATOR_BACKUP_ASSIGNED"] = "VALIDATOR_BACKUP_ASSIGNED";
    AuditEventType["VALIDATOR_BACKUP_FAILED"] = "VALIDATOR_BACKUP_FAILED";
    AuditEventType["TRANSACTIONS_ADDED"] = "TRANSACTIONS_ADDED";
    AuditEventType["TRANSACTIONS_FAILED"] = "TRANSACTIONS_FAILED";
    AuditEventType["LARGE_MERKLE_TREE"] = "LARGE_MERKLE_TREE";
    AuditEventType["OLD_TRANSACTIONS_REMOVED"] = "OLD_TRANSACTIONS_REMOVED";
    AuditEventType["TRANSACTION_INPUT_ADDED"] = "TRANSACTION_INPUT_ADDED";
    AuditEventType["TRANSACTION_OUTPUT_ADDED"] = "TRANSACTION_OUTPUT_ADDED";
    AuditEventType["FEE_CALCULATION_FAILED"] = "FEE_CALCULATION_FAILED";
    AuditEventType["FEE_BUCKET_UPDATE_FAILED"] = "FEE_BUCKET_UPDATE_FAILED";
    AuditEventType["SHARD_INITIALIZED"] = "SHARD_INITIALIZED";
    AuditEventType["SHARD_RESHARD"] = "SHARD_RESHARD";
    AuditEventType["SHARD_SYNC_FAILED"] = "SHARD_SYNC_FAILED";
    AuditEventType["SHARD_TX_LOOKUP_FAILED"] = "SHARD_TX_LOOKUP_FAILED";
    AuditEventType["SHARD_HEALTH_CHECK"] = "SHARD_HEALTH_CHECK";
    AuditEventType["DDOS_VIOLATION"] = "DDOS_VIOLATION";
    AuditEventType["TRANSACTION_VALIDATION_FAILED"] = "TRANSACTION_VALIDATION_FAILED";
    AuditEventType["TRANSACTION_COMMIT"] = "TRANSACTION_COMMIT";
})(AuditEventType = exports.AuditEventType || (exports.AuditEventType = {}));
var AuditSeverity;
(function (AuditSeverity) {
    AuditSeverity["INFO"] = "INFO";
    AuditSeverity["WARNING"] = "WARNING";
    AuditSeverity["ERROR"] = "ERROR";
    AuditSeverity["CRITICAL"] = "CRITICAL";
    AuditSeverity["HIGH"] = "HIGH";
})(AuditSeverity = exports.AuditSeverity || (exports.AuditSeverity = {}));
class AuditManager {
    constructor(storage) {
        this.eventEmitter = new events_1.EventEmitter();
        this.metrics = {
            totalEvents: 0,
            failedEvents: 0,
            syncLatency: 0,
            compressionRatio: 1,
            lastSync: 0,
            evictedEvents: 0,
            eventsRemoved: 0
        };
        this.storage = storage || new default_audit_storage_1.DefaultAuditStorage();
        this.config = { ...AuditManager.DEFAULT_CONFIG };
        this.auditorsConsensus = new DefaultAuditorsConsensus(this);
        this.validateConfig(this.config);
        this.events = new Map();
        this.eventCache = new cache_1.Cache({
            ttl: this.config.retentionPeriod * 24 * 60 * 60,
            maxSize: this.config.maxEvents,
            compression: true,
        });
        this.initialize();
    }
    validateConfig(config) {
        if (config.retentionPeriod < 1) {
            throw new AuditError("Invalid retention period", "INVALID_CONFIG");
        }
        if (config.maxEvents < 1) {
            throw new AuditError("Invalid max events", "INVALID_CONFIG");
        }
        if (config.batchSize < 1 || config.batchSize > config.maxEvents) {
            throw new AuditError("Invalid batch size", "INVALID_CONFIG");
        }
    }
    async initialize() {
        this.startSyncInterval();
        this.eventEmitter.emit("initialized");
        shared_1.Logger.info("Audit manager initialized");
    }
    async logEvent(options) {
        try {
            if (!options.source || !options.type || !options.severity) {
                throw new AuditError("Missing required audit event fields", "INVALID_INPUT");
            }
            const event = {
                id: await this.generateEventId(),
                timestamp: Date.now(),
                ...options,
                currency: options.currency || constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
                hash: "",
            };
            event.hash = await this.calculateEventHash(event);
            await this.storeEvent(event);
            this.metrics.totalEvents++;
            this.eventEmitter.emit("event_logged", {
                id: event.id,
                type: event.type,
                currency: event.currency
            });
            if (event.severity === AuditSeverity.CRITICAL) {
                this.handleCriticalEvent(event);
            }
            return event.id;
        }
        catch (error) {
            this.metrics.failedEvents++;
            shared_1.Logger.error(`Failed to log ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} audit event:`, error);
            throw new AuditError(`Failed to log ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} event: ${error.message}`, "LOG_FAILED");
        }
    }
    async storeEvent(event) {
        this.events.set(event.id, event);
        this.eventCache.set(event.id, event);
        if (this.events.size >= this.config.maxEvents) {
            await this.evictStaleEvents();
        }
        shared_1.Logger.debug(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} audit event stored:`, {
            id: event.id,
            type: event.type,
            severity: event.severity
        });
    }
    async evictStaleEvents() {
        const cutoffTime = Date.now() - this.config.retentionPeriod * 24 * 60 * 60 * 1000;
        const evictedEvents = Array.from(this.events.values()).filter((event) => event.timestamp < cutoffTime);
        for (const event of evictedEvents) {
            this.events.delete(event.id);
            this.eventCache.delete(event.id);
        }
        this.metrics.evictedEvents += evictedEvents.length;
        this.eventEmitter.emit("events_evicted", { count: evictedEvents.length });
    }
    async queryEvents(options) {
        const { startTime = Date.now() - 24 * 60 * 60 * 1000, endTime = Date.now(), type, severity, source, currency = constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL, limit = 100, offset = 0, } = options;
        const filteredEvents = Array.from(this.events.values())
            .filter((event) => event.timestamp >= startTime &&
            event.timestamp <= endTime &&
            (!type?.length || type.includes(event.type)) &&
            (!severity?.length || severity.includes(event.severity)) &&
            (!source?.length || source.includes(event.source)) &&
            (!currency || event.currency === currency))
            .sort((a, b) => b.timestamp - a.timestamp);
        const total = filteredEvents.length;
        const events = filteredEvents.slice(offset, offset + limit);
        return {
            events,
            total,
            hasMore: offset + limit < total,
        };
    }
    async syncEvents() {
        if (this.events.size === 0)
            return;
        const batch = Array.from(this.events.values()).slice(0, AuditManager.BATCH_SIZE);
        let retryCount = 0;
        while (retryCount < AuditManager.MAX_RETRY_ATTEMPTS) {
            try {
                const compressed = await this.compressEvents(batch);
                await this.storage.writeAuditLog(`audit_${Date.now()}.log`, compressed);
                batch.forEach(event => this.events.delete(event.id));
                this.metrics.lastSync = Date.now();
                this.eventEmitter.emit("sync_complete", batch.length);
                return;
            }
            catch (error) {
                retryCount++;
                if (retryCount === AuditManager.MAX_RETRY_ATTEMPTS) {
                    shared_1.Logger.error("Max retry attempts reached for sync:", error);
                    this.eventEmitter.emit("sync_failed", error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, AuditManager.RETRY_DELAY));
            }
        }
    }
    async compressEvents(events) {
        try {
            const data = JSON.stringify(events);
            const originalSize = data.length;
            return new Promise((resolve, reject) => {
                zlib_1.default.gzip(data, {
                    level: this.config.compressionLevel,
                    memLevel: 9,
                    strategy: 0
                }, (error, compressed) => {
                    if (error) {
                        reject(new AuditError(error.message, "COMPRESSION_FAILED"));
                    }
                    else {
                        this.metrics.compressionRatio = compressed.length / originalSize;
                        resolve(compressed.toString("base64"));
                    }
                });
            });
        }
        catch (error) {
            shared_1.Logger.error("Compression failed:", error);
            throw new AuditError("Failed to compress events", "COMPRESSION_ERROR");
        }
    }
    async generateEventId() {
        const entropy = Buffer.from(Date.now().toString() + Math.random().toString());
        return crypto_1.HybridCrypto.generateSharedSecret(entropy);
    }
    async calculateEventHash(event) {
        const { hash, ...eventWithoutHash } = event;
        const data = Buffer.from(JSON.stringify(eventWithoutHash));
        return crypto_1.HybridCrypto.generateSharedSecret(data);
    }
    handleCriticalEvent(event) {
        shared_1.Logger.error("Critical audit event:", event);
        this.eventEmitter.emit("critical_event", event);
    }
    startSyncInterval() {
        this.syncInterval = setInterval(() => {
            this.syncEvents().catch((error) => {
                shared_1.Logger.error("Failed to sync audit events:", error);
            });
        }, this.config.syncInterval);
        this.syncInterval.unref();
    }
    getMetrics() {
        return { ...this.metrics };
    }
    async verifyEventIntegrity(event) {
        const calculatedHash = await this.calculateEventHash({
            ...event,
            hash: "",
        });
        return calculatedHash === event.hash;
    }
    async shutdown() {
        clearInterval(this.syncInterval);
        await this.syncEvents(); // Final sync
        this.eventCache.shutdown();
        this.events.clear();
        this.eventEmitter.emit("shutdown");
        shared_1.Logger.info("Audit manager shutdown");
    }
    async logConsensusEvent(options) {
        return this.logEvent({
            type: AuditEventType.CONSENSUS,
            severity: AuditSeverity.INFO,
            source: options.minerAddress || options.voterAddress || "system",
            details: options,
        });
    }
    async log(eventType, data) {
        const auditLog = {
            eventType,
            timestamp: Date.now(),
            ...data
        };
        await this.storage.writeAuditLog(`${eventType}_${Date.now()}.log`, JSON.stringify(auditLog));
    }
    getAuditorsConsensus() {
        return this.auditorsConsensus;
    }
    async getAuditorSignature(auditorId, voteId) {
        try {
            const key = `auditor_signature:${auditorId}:${voteId}`;
            const data = await this.storage.readAuditLog(key);
            return JSON.parse(data).signature;
        }
        catch (error) {
            shared_1.Logger.error(`Failed to get auditor signature: ${error.message}`);
            return '';
        }
    }
    async cleanup() {
        const now = Date.now();
        const oldEvents = Array.from(this.events.values())
            .filter(event => now - event.timestamp > AuditManager.MAX_EVENT_AGE);
        for (const event of oldEvents) {
            this.events.delete(event.id);
        }
        this.metrics.eventsRemoved += oldEvents.length;
        this.eventEmitter.emit("cleanup_complete", oldEvents.length);
    }
    async dispose() {
        await this.shutdown(); // Use existing shutdown method
        this.events.clear();
        this.eventCache.clear();
        this.eventEmitter.removeAllListeners();
        shared_1.Logger.info("Audit manager disposed");
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
}
exports.AuditManager = AuditManager;
AuditManager.DEFAULT_CONFIG = {
    retentionPeriod: 90,
    maxEvents: 1000000,
    batchSize: 1000,
    syncInterval: 300000,
    enableCompression: true,
    compressionLevel: 6,
    maxRetries: 3,
    enabled: false,
    auditPath: "./audit",
    auditInterval: 60000,
};
AuditManager.BATCH_SIZE = 1000;
AuditManager.MAX_RETRY_ATTEMPTS = 3;
AuditManager.RETRY_DELAY = 1000; // 1 second
AuditManager.MAX_EVENT_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
class DefaultAuditorsConsensus {
    constructor(auditManager) {
        this.requiredMajority = 0.67; // 67% majority required
        this.activeAuditors = new Map();
        this.auditManager = auditManager;
    }
    async validateAuditor(auditorId) {
        const auditor = this.activeAuditors.get(auditorId);
        if (!auditor)
            return false;
        // Check if auditor is still active (within last 24 hours)
        const isActive = Date.now() - auditor.lastActive < 24 * 60 * 60 * 1000;
        if (!isActive) {
            this.activeAuditors.delete(auditorId);
            return false;
        }
        return true;
    }
    async getActiveAuditors() {
        // Clean up inactive auditors
        for (const [auditorId, data] of this.activeAuditors.entries()) {
            if (Date.now() - data.lastActive > 24 * 60 * 60 * 1000) {
                this.activeAuditors.delete(auditorId);
            }
        }
        return Array.from(this.activeAuditors.keys());
    }
    async dispose() {
        await this.auditManager.shutdown();
        this.activeAuditors.clear();
    }
}
exports.DefaultAuditorsConsensus = DefaultAuditorsConsensus;
//# sourceMappingURL=audit.js.map