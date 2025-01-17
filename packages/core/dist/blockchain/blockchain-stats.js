"use strict";
/**
 * @fileoverview BlockchainStats provides statistical analysis and metrics collection
 * for blockchain performance, health, and network participation. It implements caching
 * and circuit breaker patterns for efficient data retrieval.
 *
 * @module BlockchainStats
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainStats = void 0;
const shared_1 = require("@h3tag-blockchain/shared");
const constants_1 = require("./utils/constants");
const metrics_collector_1 = require("../monitoring/metrics-collector");
const retry_1 = require("../utils/retry");
const perf_hooks_1 = require("perf_hooks");
class BlockchainStats {
    /**
     * Constructor for BlockchainStats
     * @param blockchain Blockchain data
     */
    constructor(blockchain) {
        this.maxCacheSize = 1000; // Prevent unlimited growth
        this.circuitBreaker = new Map();
        this.cleanupInterval = 300000; // 5 minutes
        this.blockchain = blockchain;
        this.statsCache = new Map();
        this.metricsCollector = new metrics_collector_1.MetricsCollector("blockchain_stats");
        this.initializeMetrics();
        this.startCacheCleanup();
    }
    /**
     * Initializes metrics
     */
    initializeMetrics() {
        this.metricsCollector.gauge("blockchain_stats_cache_size", () => this.statsCache.size);
        this.metricsCollector.gauge("blockchain_stats_last_update.voting_stats", 0);
        this.metricsCollector.gauge("blockchain_stats_last_update.consensus_health", 0);
        this.metricsCollector.gauge("blockchain_stats_last_update.chain_stats", 0);
    }
    /**
     * Gets cached value
     * @param key Key to get value for
     * @param calculator Calculator function
     * @returns Promise<T> Cached value
     */
    async getCachedValue(key, calculator) {
        const startTime = perf_hooks_1.performance.now();
        try {
            const cached = this.statsCache.get(key);
            const now = Date.now();
            // Manage cache size
            if (this.statsCache.size > this.maxCacheSize) {
                const oldestKey = Array.from(this.statsCache.entries()).sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
                this.statsCache.delete(oldestKey);
            }
            if (cached &&
                now - cached.timestamp < constants_1.BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL) {
                return cached.value;
            }
            const value = await this.executeWithCircuitBreaker(key, () => this.executeWithTimeout(this.executeWithRetry(() => calculator())));
            this.statsCache.set(key, { value, timestamp: now });
            // Update all relevant metrics
            this.metricsCollector.histogram("blockchain_stats_calculation_time", perf_hooks_1.performance.now() - startTime);
            this.metricsCollector.gauge(`blockchain_stats_last_update.${key}`, now);
            this.metricsCollector.gauge("blockchain_stats_cache_size", this.statsCache.size);
            return value;
        }
        catch (error) {
            // Add error type to metrics
            this.metricsCollector.counter("blockchain_stats_errors").inc({
                stat: key,
                error: error.name,
            });
            throw error;
        }
    }
    /**
     * Executes operation with retry
     * @param operation Operation to execute
     * @returns Promise<T> Result of operation
     */
    async executeWithRetry(operation) {
        return operation();
    }
    /**
     * Executes operation with timeout
     * @param promise Promise to execute
     * @param timeoutMs Timeout in milliseconds
     * @returns Promise<T> Result of operation
     */
    async executeWithTimeout(promise, timeoutMs = 5000) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Operation timed out")), timeoutMs);
        });
        return Promise.race([promise, timeoutPromise]);
    }
    /**
     * Gets voting stats
     * @returns Promise<{ currentPeriod: number; blocksUntilNextVoting: number; participationRate: number; powWeight: number; votingWeight: number; }> Voting stats
     */
    async getVotingStats() {
        return this.getCachedValue("votingStats", async () => {
            const currentHeight = await this.validateHeight();
            const consensusMetrics = await this.validateConsensusMetrics();
            const currentPeriod = Math.floor(currentHeight /
                constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_BLOCKS);
            const nextVotingHeight = (currentPeriod + 1) *
                constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_BLOCKS;
            return {
                currentPeriod,
                blocksUntilNextVoting: nextVotingHeight - currentHeight,
                participationRate: consensusMetrics.currentParticipation,
                powWeight: constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.POW_WEIGHT,
                votingWeight: constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.VALIDATOR_WEIGHT,
            };
        });
    }
    /**
     * Validates blockchain height
     * @returns Promise<number> Blockchain height
     */
    async validateHeight() {
        const height = this.blockchain.getHeight();
        if (height < 0) {
            throw new Error("Invalid blockchain height");
        }
        return height;
    }
    /**
     * Validates consensus metrics
     * @returns Promise<{ powHashrate: number; activeVoters: number; participation: number; currentParticipation: number; }> Consensus metrics
     */
    async validateConsensusMetrics() {
        const metrics = await this.blockchain.getConsensusMetrics();
        if (!metrics) {
            throw new Error("Failed to fetch consensus metrics");
        }
        return metrics;
    }
    /**
     * Gets orphan rate
     * @returns Promise<number> Orphan rate
     */
    async getOrphanRate() {
        return this.getCachedValue("orphanRate", async () => {
            try {
                const currentHeight = this.blockchain.getHeight();
                const startHeight = Math.max(0, currentHeight - constants_1.BLOCKCHAIN_CONSTANTS.MINING.ORPHAN_WINDOW);
                let orphanCount = 0;
                // Guard against zero window size
                if (constants_1.BLOCKCHAIN_CONSTANTS.MINING.ORPHAN_WINDOW <= 0) {
                    return 0;
                }
                // Batch fetch blocks with proper memory management
                const batchSize = 1000;
                for (let i = startHeight; i < currentHeight; i += batchSize) {
                    const endHeight = Math.min(i + batchSize, currentHeight);
                    const blocks = await Promise.all(Array.from({ length: endHeight - i }, (_, idx) => this.blockchain.getBlockByHeight(i + idx)));
                    for (let j = 0; j < blocks.length - 1; j++) {
                        if (blocks[j] &&
                            blocks[j + 1] &&
                            blocks[j + 1].header.previousHash !== blocks[j].hash) {
                            orphanCount++;
                        }
                    }
                }
                return orphanCount / constants_1.BLOCKCHAIN_CONSTANTS.MINING.ORPHAN_WINDOW;
            }
            catch (error) {
                shared_1.Logger.error("Error calculating orphan rate:", error);
                return 0;
            }
        });
    }
    /**
     * Gets consensus health
     * @returns Promise<{ powHashrate: number; activeVoters: number; consensusParticipation: number; isHealthy: boolean; }> Consensus health
     */
    async getConsensusHealth() {
        return this.getCachedValue("consensusHealth", async () => {
            try {
                const metrics = await this.blockchain.getConsensusMetrics();
                const minHealthyParticipation = 0.5;
                return {
                    powHashrate: metrics.powHashrate || 0,
                    activeVoters: metrics.activeVoters || 0,
                    consensusParticipation: metrics.participation || 0,
                    isHealthy: (metrics.participation || 0) >= minHealthyParticipation,
                };
            }
            catch (error) {
                shared_1.Logger.error("Error calculating consensus health:", error);
                return {
                    powHashrate: 0,
                    activeVoters: 0,
                    consensusParticipation: 0,
                    isHealthy: false,
                };
            }
        });
    }
    /**
     * Gets average block time
     * @returns Promise<number> Average block time
     */
    async getAverageBlockTime() {
        return this.getCachedValue("blockTime", async () => {
            try {
                const blocks = Array.from({ length: 10 }, (_, i) => this.blockchain.getBlockByHeight(this.blockchain.getHeight() - i)).filter(Boolean);
                if (blocks.length < 2)
                    return 600;
                const times = blocks.map((b) => b?.header?.timestamp || 0);
                const avgTime = times
                    .slice(0, -1)
                    .map((time, i) => time && times[i + 1] ? (time - times[i + 1]) / 1000 : 600)
                    .reduce((a, b) => a + b, 0) /
                    (times.length - 1);
                return avgTime || 600;
            }
            catch (error) {
                shared_1.Logger.error("Error calculating average block time:", error);
                return 600;
            }
        });
    }
    /**
     * Gets block propagation stats
     * @returns Promise<{ average: number; median: number; }> Block propagation stats
     */
    async getBlockPropagationStats() {
        return this.getCachedValue("propagation", async () => {
            const currentHeight = await this.validateHeight();
            this.validateInput(constants_1.BLOCKCHAIN_CONSTANTS.MINING.PROPAGATION_WINDOW, (v) => v > 0 && v <= 10000, "Invalid propagation window size");
            const batchSize = 100;
            const startHeight = Math.max(0, currentHeight - constants_1.BLOCKCHAIN_CONSTANTS.MINING.PROPAGATION_WINDOW);
            const propagationTimes = [];
            // Process blocks in batches
            for (let height = startHeight; height < currentHeight; height += batchSize) {
                const endHeight = Math.min(height + batchSize, currentHeight);
                const blocks = await Promise.all(Array.from({ length: endHeight - height }, (_, i) => this.blockchain.getBlockByHeight(height + i)));
                blocks.forEach((block) => {
                    if (block?.metadata?.receivedTimestamp) {
                        const time = block.metadata.receivedTimestamp - block.header.timestamp;
                        if (time > 0 &&
                            time < constants_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_PROPAGATION_TIME) {
                            propagationTimes.push(time);
                        }
                    }
                });
            }
            if (propagationTimes.length === 0) {
                return { average: 0, median: 0 };
            }
            const average = propagationTimes.reduce((a, b) => a + b, 0) / propagationTimes.length;
            const sorted = propagationTimes.sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)];
            return { average, median };
        });
    }
    /**
     * Gets chain stats
     * @returns Promise<{ totalBlocks: number; totalTransactions: number; averageBlockSize: number; difficulty: number; }> Chain stats
     */
    async getChainStats() {
        return this.getCachedValue("chainStats", async () => {
            try {
                const chain = this.blockchain.getState().chain;
                let totalTransactions = 0;
                let totalSize = 0;
                chain.forEach((block) => {
                    totalTransactions += block.transactions.length;
                    totalSize += this.calculateBlockSize(block);
                });
                return {
                    totalBlocks: chain.length,
                    totalTransactions,
                    averageBlockSize: totalSize / chain.length,
                    difficulty: this.blockchain.getCurrentDifficulty(),
                };
            }
            catch (error) {
                return this.handleError(error, "getChainStats");
            }
        });
    }
    /**
     * Calculates block size
     * @param block Block to calculate size for
     * @returns number Block size
     */
    calculateBlockSize(block) {
        try {
            return Buffer.byteLength(JSON.stringify({
                header: block.header,
                transactions: block.transactions.map((tx) => tx.hash),
            }));
        }
        catch (error) {
            shared_1.Logger.error("Error calculating block size:", error);
            return 0;
        }
    }
    /**
     * Gets network hash rate
     * @returns Promise<number> Network hash rate
     */
    async getNetworkHashRate() {
        try {
            const currentBlock = this.blockchain.getLatestBlock();
            if (!currentBlock)
                return 0;
            const difficulty = currentBlock.header.difficulty;
            const blockTime = await this.getAverageBlockTime();
            // Avoid division by zero
            if (blockTime <= 0)
                return 0;
            // Network hash rate = difficulty * 2^32 / blockTime
            return (difficulty * Math.pow(2, 32)) / blockTime;
        }
        catch (error) {
            shared_1.Logger.error("Error calculating network hash rate:", error);
            return 0;
        }
    }
    /**
     * Validates input
     * @param value Value to validate
     * @param validator Validator function
     * @param errorMessage Error message
     */
    validateInput(value, validator, errorMessage) {
        if (!validator(value)) {
            throw new Error(errorMessage);
        }
    }
    /**
     * Executes operation with circuit breaker
     * @param key Key to execute operation for
     * @param operation Operation to execute
     * @returns Promise<T> Result of operation
     */
    async executeWithCircuitBreaker(key, operation) {
        const breaker = this.circuitBreaker.get(key) || {
            failures: 0,
            lastFailure: 0,
            isOpen: false,
        };
        if (breaker.isOpen) {
            const cooldownTime = 60000; // 1 minute
            if (Date.now() - breaker.lastFailure < cooldownTime) {
                throw new Error("Circuit breaker is open");
            }
            breaker.isOpen = false;
        }
        try {
            const result = await operation();
            breaker.failures = 0;
            this.circuitBreaker.set(key, breaker);
            return result;
        }
        catch (error) {
            breaker.failures++;
            breaker.lastFailure = Date.now();
            breaker.isOpen = breaker.failures >= 5;
            this.circuitBreaker.set(key, breaker);
            throw error;
        }
    }
    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.statsCache.entries()) {
                if (now - entry.timestamp > constants_1.BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL) {
                    this.statsCache.delete(key);
                }
            }
            this.metricsCollector.gauge("blockchain_stats_cache_size", this.statsCache.size);
        }, this.cleanupInterval);
    }
    /**
     * Cleans up resources
     */
    cleanup() {
        clearInterval(this.cleanupInterval);
        this.statsCache.clear();
        this.circuitBreaker.clear();
    }
    /**
     * Handles error
     * @param error Error to handle
     * @param context Context to handle error for
     * @returns never
     */
    handleError(error, context) {
        const errorCode = error instanceof BlockchainStatsError ? error.code : "UNKNOWN_ERROR";
        this.metricsCollector.counter("blockchain_stats_errors").inc({
            context,
            error: errorCode,
        });
        throw new BlockchainStatsError(error.message, errorCode, {
            context,
            originalError: error,
        });
    }
    async getMedianTime() {
        return this.getCachedValue("medianTime", async () => {
            try {
                const blocks = Array.from({ length: 11 }, (_, i) => this.blockchain.getBlockByHeight(this.blockchain.getHeight() - i)).filter(Boolean);
                if (blocks.length < 1)
                    return Date.now();
                const times = blocks.map((b) => b.header.timestamp);
                const sorted = [...times].sort((a, b) => a - b);
                return sorted[Math.floor(sorted.length / 2)];
            }
            catch (error) {
                shared_1.Logger.error("Error calculating median time:", error);
                return Date.now();
            }
        });
    }
}
__decorate([
    (0, retry_1.retry)({
        maxAttempts: 3,
        delay: 1000,
        exponentialBackoff: true,
    })
], BlockchainStats.prototype, "executeWithRetry", null);
exports.BlockchainStats = BlockchainStats;
//# sourceMappingURL=blockchain-stats.js.map