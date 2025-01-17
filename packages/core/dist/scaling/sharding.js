"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShardManager = void 0;
const shared_1 = require("@h3tag-blockchain/shared");
const cache_1 = require("./cache");
const async_mutex_1 = require("async-mutex");
const events_1 = require("events");
const audit_1 = require("../security/audit");
const performance_monitor_1 = require("../monitoring/performance-monitor");
const retry_1 = require("../utils/retry");
const constants_1 = require("../blockchain/utils/constants");
class ShardManager {
    constructor(config, db) {
        this.config = config;
        this.db = db;
        this.mutex = new async_mutex_1.Mutex();
        this.eventEmitter = new events_1.EventEmitter();
        this.circuitBreaker = {
            failures: 0,
            lastFailure: 0,
            threshold: 5,
            resetTimeout: 60000
        };
        this.MAINTENANCE_INTERVAL = 3600000; // 1 hour
        this.shards = new Map();
        this.shardMetrics = new Map();
        this.performanceMonitor = new performance_monitor_1.PerformanceMonitor("shard_manager");
        this.auditManager = new audit_1.AuditManager();
        this.cache = new cache_1.Cache({
            ttl: 300000,
            maxSize: 10000,
            compression: true
        });
        // Initialize shards
        this.initializeShards();
        // Start sync timer
        this.startSyncTimer();
        // Start maintenance tasks
        this.startMaintenanceTasks();
    }
    /**
     * Initialize shard structure
     */
    async initializeShards() {
        try {
            // Create voting shards
            for (let i = 0; i < this.config.votingShards; i++) {
                this.shards.set(i, new Set());
                this.shardMetrics.set(i, this.createInitialMetrics());
            }
            // Create PoW shards
            for (let i = this.config.votingShards; i < this.config.shardCount; i++) {
                this.shards.set(i, new Set());
                this.shardMetrics.set(i, this.createInitialMetrics());
            }
            await this.auditManager.log(audit_1.AuditEventType.SHARD_INITIALIZED, {
                shardCount: this.config.shardCount,
                votingShards: this.config.votingShards,
                powShards: this.config.powShards
            });
        }
        catch (error) {
            shared_1.Logger.error("Failed to initialize shards:", error);
        }
    }
    /**
     * Get shard for transaction
     */
    getShardForTransaction(tx) {
        const hash = BigInt(`0x${tx.id}`);
        return Number(hash % BigInt(this.config.shardCount));
    }
    /**
     * Update metrics for a shard
     */
    async updateShardMetrics(shardId) {
        const shard = this.shards.get(shardId);
        if (!shard)
            return;
        const metrics = {
            size: shard.size,
            transactions: Array.from(shard).filter(id => id.startsWith('tx')).length,
            lastAccess: Date.now(),
            loadFactor: shard.size / this.config.maxShardSize
        };
        this.shardMetrics.set(shardId, metrics);
        // Emit metrics
        this.eventEmitter.emit('shard_metrics', {
            shardId,
            metrics
        });
    }
    /**
     * Check if resharding is needed
     */
    async checkResharding(shardId) {
        const metrics = this.shardMetrics.get(shardId);
        if (!metrics)
            return;
        if (metrics.loadFactor > this.config.reshardThreshold) {
            await this.performResharding(shardId);
        }
    }
    /**
     * Perform resharding of overloaded shard
     */
    async performResharding(shardId) {
        const release = await this.mutex.acquire();
        try {
            await this.db.beginTransaction();
            const shard = this.shards.get(shardId);
            if (!shard) {
                await this.db.rollback();
                return;
            }
            // Create new shards
            const newShardId = this.shards.size;
            this.shards.set(newShardId, new Set());
            // Redistribute data
            const items = Array.from(shard);
            for (const item of items) {
                if (BigInt(`0x${item}`) % BigInt(2) === BigInt(0)) {
                    shard.delete(item);
                    this.shards.get(newShardId)?.add(item);
                }
            }
            // Update metrics
            await this.updateShardMetrics(shardId);
            await this.updateShardMetrics(newShardId);
            await this.auditManager.log(audit_1.AuditEventType.SHARD_RESHARD, {
                originalShard: shardId,
                newShard: newShardId,
                itemsRedistributed: items.length / 2
            });
            await this.db.commit();
        }
        catch (error) {
            await this.db.rollback();
            throw error;
        }
        finally {
            release();
        }
    }
    /**
     * Start periodic shard sync
     */
    startSyncTimer() {
        this.syncTimer = setInterval(() => this.syncShards(), this.config.syncInterval);
    }
    /**
     * Sync shards with database
     */
    async syncShards() {
        const release = await this.mutex.acquire();
        try {
            for (const [shardId, shard] of this.shards) {
                await this.db.syncShard(shardId, Array.from(shard));
            }
        }
        catch (error) {
            shared_1.Logger.error("Shard sync failed:", error);
        }
        finally {
            release();
        }
    }
    /**
     * Create initial metrics for new shard
     */
    createInitialMetrics() {
        return {
            size: 0,
            transactions: 0,
            lastAccess: Date.now(),
            loadFactor: 0
        };
    }
    /**
     * Clean up resources
     */
    dispose() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
        if (this.maintenanceTimer) {
            clearInterval(this.maintenanceTimer);
        }
        this.shards.clear();
        this.shardMetrics.clear();
        this.cache.clear();
    }
    async getTransaction(hash) {
        if (this.isCircuitBreakerOpen()) {
            throw new Error('Circuit breaker is open');
        }
        const perfMarker = this.performanceMonitor.start('get_transaction');
        const release = await this.mutex.acquire();
        try {
            // Input validation
            if (!hash || typeof hash !== 'string') {
                throw new Error('Invalid transaction hash');
            }
            // Check cache first
            const cachedTx = await this.cache.get(`tx:${hash}`);
            if (cachedTx) {
                this.metricsCollector.increment('tx_cache_hit');
                return cachedTx;
            }
            // Determine target shard using consistent hashing
            const targetShardId = this.getShardForTransaction({ id: hash });
            const shard = this.shards.get(targetShardId);
            if (!shard?.has(hash)) {
                this.metricsCollector.increment('tx_not_found');
                return undefined;
            }
            // Get from database
            const tx = await this.db.getTransaction(hash);
            if (tx) {
                // Cache the result
                await this.cache.set(`tx:${hash}`, tx, { ttl: 300000 }); // 5 minutes
                this.metricsCollector.increment('tx_found');
                // Update shard metrics
                await this.updateShardMetrics(targetShardId);
            }
            return tx;
        }
        catch (error) {
            this.metricsCollector.increment('tx_lookup_error');
            shared_1.Logger.error(`Transaction lookup failed for hash ${hash}:`, error);
            await this.auditManager.log(audit_1.AuditEventType.SHARD_TX_LOOKUP_FAILED, {
                hash,
                error: error.message,
                timestamp: Date.now()
            });
            this.recordFailure();
            throw error;
        }
        finally {
            this.performanceMonitor.end(perfMarker);
            release();
        }
    }
    async cleanupStaleData() {
        const release = await this.mutex.acquire();
        try {
            for (const [shardId, shard] of this.shards) {
                const staleItems = Array.from(shard).filter(async (item) => {
                    const lastAccess = await this.db.getLastAccess(item);
                    return Date.now() - lastAccess > constants_1.BLOCKCHAIN_CONSTANTS.UTIL.STALE_THRESHOLD;
                });
                staleItems.forEach(item => shard.delete(item));
            }
        }
        finally {
            release();
        }
    }
    isCircuitBreakerOpen() {
        const now = Date.now();
        const elapsed = now - this.circuitBreaker.lastFailure;
        return elapsed < this.circuitBreaker.resetTimeout;
    }
    recordFailure() {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailure = Date.now();
    }
    async warmCache() {
        const recentTransactions = await this.db.getRecentTransactions(100);
        for (const tx of recentTransactions) {
            this.cache.set(`tx:${tx.id}`, tx, { ttl: 300000 });
        }
    }
    async healthCheck() {
        try {
            const metrics = Array.from(this.shardMetrics.values());
            const avgLoadFactor = metrics.reduce((sum, m) => sum + m.loadFactor, 0) / metrics.length;
            const isHealthy = avgLoadFactor < this.config.reshardThreshold &&
                this.circuitBreaker.failures < this.circuitBreaker.threshold;
            await this.auditManager.log(audit_1.AuditEventType.SHARD_HEALTH_CHECK, {
                avgLoadFactor,
                isHealthy,
                timestamp: Date.now()
            });
            return isHealthy;
        }
        catch (error) {
            shared_1.Logger.error('Shard health check failed:', error);
            return false;
        }
    }
    async rebalanceShards() {
        const release = await this.mutex.acquire();
        try {
            const shardSizes = Array.from(this.shards.entries())
                .map(([id, shard]) => ({ id, size: shard.size }));
            const avgSize = shardSizes.reduce((sum, s) => sum + s.size, 0) / shardSizes.length;
            const threshold = avgSize * 0.2; // 20% deviation threshold
            for (const { id, size } of shardSizes) {
                if (Math.abs(size - avgSize) > threshold) {
                    await this.performResharding(id);
                }
            }
        }
        finally {
            release();
        }
    }
    startMaintenanceTasks() {
        this.maintenanceTimer = setInterval(async () => {
            try {
                // Run maintenance tasks sequentially
                await this.cleanupStaleData();
                await this.rebalanceShards();
                // Check each shard for potential resharding
                for (const shardId of this.shards.keys()) {
                    await this.checkResharding(shardId);
                }
                shared_1.Logger.info('Shard maintenance completed successfully');
            }
            catch (error) {
                shared_1.Logger.error('Shard maintenance failed:', error);
            }
        }, this.MAINTENANCE_INTERVAL);
    }
}
__decorate([
    (0, retry_1.retry)({
        maxAttempts: 3,
        delay: 1000,
        exponentialBackoff: true
    })
], ShardManager.prototype, "getTransaction", null);
exports.ShardManager = ShardManager;
//# sourceMappingURL=sharding.js.map