"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiningMetrics = void 0;
const shared_1 = require("@h3tag-blockchain/shared");
const async_mutex_1 = require("async-mutex");
/**
 * @fileoverview Core metrics tracking system for the H3Tag blockchain. Includes performance metrics,
 * mining statistics, and network monitoring for blockchain operations and analysis.
 *
 * @module CoreMetrics
 */
/**
 * @class CoreMetrics
 * @description Core metrics tracking and management for blockchain operations
 *
 * @property {Object} metrics - Storage for various metric types
 * @property {number[]} metrics.hashRate - Array of hash rate measurements
 * @property {number[]} metrics.timestamp - Array of measurement timestamps
 * @property {number[]} metrics.tagVolume - Array of TAG volume measurements
 * @property {number[]} metrics.tagFees - Array of TAG fee measurements
 * @property {number} blockHeight - Current block height
 * @property {number} syncedHeaders - Number of synced headers
 * @property {number} syncedBlocks - Number of synced blocks
 * @property {number} whitelistedPeers - Number of whitelisted peers
 * @property {number} blacklistedPeers - Number of blacklisted peers
 * @property {number} hashRate - Current hash rate
 * @property {number} difficulty - Current mining difficulty
 * @property {number} totalBlocks - Total blocks processed
 * @property {number} successfulBlocks - Successfully mined blocks
 * @property {number} lastBlockTime - Timestamp of last block
 * @property {number} lastMiningTime - Duration of last mining operation
 *
 * @example
 * const metrics = new CoreMetrics();
 * metrics.gauge("hash_rate", 1000000);
 * const avgHashRate = metrics.getAverageHashRate();
 */
class MiningMetrics {
    constructor() {
        this.totalBlocks = 0;
        this.successfulBlocks = 0;
        this.lastMiningTime = 0;
        this.averageHashRate = 0;
        this.totalTAGMined = 0;
        this.currentBlockReward = 0;
        this.tagTransactionsCount = 0;
        this.timestamp = BigInt(0);
        this.blockHeight = 0;
        this.hashRate = 0;
        this.difficulty = 0;
        this.blockTime = 0;
        this.tagVolume = 0;
        this.tagFees = 0;
        this.lastBlockTime = Date.now();
        this.syncedHeaders = 0;
        this.syncedBlocks = 0;
        this.whitelistedPeers = 0;
        this.blacklistedPeers = 0;
        this.mutex = new async_mutex_1.Mutex();
        this.metrics = {
            hashRate: [],
            difficulty: [],
            blockTimes: [],
            timestamp: [],
            tagVolume: [],
            tagFees: [],
        };
    }
    static getInstance() {
        if (!MiningMetrics.instance) {
            MiningMetrics.instance = new MiningMetrics();
        }
        return MiningMetrics.instance;
    }
    async updateMetrics(data) {
        const release = await this.mutex.acquire();
        try {
            const now = Date.now();
            // Validate inputs before updating
            if (data.hashRate !== undefined && !isNaN(data.hashRate)) {
                this.metrics.hashRate.push(data.hashRate);
                this.metrics.timestamp.push(BigInt(now));
                this.hashRate = data.hashRate; // Update current hashRate
            }
            if (data.difficulty !== undefined && !isNaN(data.difficulty)) {
                this.metrics.difficulty.push(data.difficulty);
                this.difficulty = data.difficulty; // Update current difficulty
            }
            if (data.blockTime !== undefined && !isNaN(data.blockTime)) {
                this.lastBlockTime = now;
                this.metrics.blockTimes.push(data.blockTime);
                this.blockTime = data.blockTime; // Update current blockTime
            }
            if (data.tagVolume !== undefined && !isNaN(data.tagVolume)) {
                this.metrics.tagVolume.push(data.tagVolume);
                this.tagVolume = data.tagVolume; // Update current tagVolume
            }
            if (data.tagFees !== undefined && !isNaN(data.tagFees)) {
                this.metrics.tagFees.push(data.tagFees);
                this.tagFees = data.tagFees; // Update current tagFees
            }
            // Cleanup old metrics
            this.cleanupOldMetrics(now);
        }
        finally {
            release();
        }
    }
    cleanupOldMetrics(now) {
        const cutoff = now - 24 * 60 * 60 * 1000; // 24 hours
        const startIdx = this.metrics.timestamp.findIndex((t) => Number(t) > cutoff // Convert BigInt to Number for comparison
        );
        if (startIdx > 0) {
            // Cleanup all metric arrays at once
            Object.keys(this.metrics).forEach((key) => {
                if (Array.isArray(this.metrics[key])) {
                    this.metrics[key] = this.metrics[key].slice(startIdx);
                }
            });
        }
    }
    /**
     * Get average hash rate over specified time window
     * @param {number} [timeWindow=3600000] - Time window in milliseconds (default: 1 hour)
     * @returns {number} Average hash rate or 0 if no data
     */
    getAverageHashRate(timeWindow = 3600000) {
        try {
            if (!this.metrics.hashRate.length || !this.metrics.timestamp.length) {
                return 0;
            }
            const cutoff = Date.now() - timeWindow;
            const startIdx = this.metrics.timestamp.findIndex((t) => Number(t) > cutoff);
            if (startIdx === -1)
                return 0;
            const recentHashes = this.metrics.hashRate.slice(startIdx);
            return recentHashes.length > 0
                ? recentHashes.reduce((a, b) => a + b, 0) / recentHashes.length
                : 0;
        }
        catch (error) {
            shared_1.Logger.error("Error calculating average hash rate:", error);
            return 0;
        }
    }
    /**
     * Get average TAG volume over specified time window
     * @param {number} [timeWindow=3600000] - Time window in milliseconds (default: 1 hour)
     * @returns {number} Average TAG volume or 0 if no data
     */
    getAverageTAGVolume(timeWindow = 3600000) {
        try {
            const cutoff = Date.now() - timeWindow;
            // Early return if no data
            if (!this.metrics.tagVolume.length || !this.metrics.timestamp.length) {
                shared_1.Logger.debug("No TAG volume data available for averaging");
                return 0;
            }
            // Find starting index for optimization
            const startIdx = this.metrics.timestamp.findIndex((t) => t > cutoff);
            if (startIdx === -1) {
                shared_1.Logger.debug("No TAG volume data within specified timeWindow");
                return 0;
            }
            // Calculate sum and count for average
            let sum = 0;
            let count = 0;
            for (let i = startIdx; i < this.metrics.tagVolume.length; i++) {
                const volume = this.metrics.tagVolume[i];
                if (typeof volume === "number" && !isNaN(volume)) {
                    sum += volume;
                    count++;
                }
            }
            // Calculate and round to 8 decimal places (TAG precision)
            const average = count > 0 ? Number((sum / count).toFixed(8)) : 0;
            shared_1.Logger.debug(`Calculated average TAG volume: ${average} over ${timeWindow}ms`);
            return average;
        }
        catch (error) {
            shared_1.Logger.error("Error calculating average TAG volume:", error);
            return 0;
        }
    }
    /**
     * Get average TAG transaction fees over specified time window
     * @param {number} [timeWindow=3600000] - Time window in milliseconds (default: 1 hour)
     * @returns {number} Average TAG fees or 0 if no data
     */
    getAverageTAGFees(timeWindow = 3600000) {
        try {
            const cutoff = Date.now() - timeWindow;
            // Early return if no data
            if (!this.metrics.tagFees.length || !this.metrics.timestamp.length) {
                shared_1.Logger.debug("No TAG fee data available for averaging");
                return 0;
            }
            // Find starting index for optimization
            const startIdx = this.metrics.timestamp.findIndex((t) => t > cutoff);
            if (startIdx === -1) {
                shared_1.Logger.debug("No TAG fee data within specified timeWindow");
                return 0;
            }
            // Calculate sum and count for average
            let sum = 0;
            let count = 0;
            for (let i = startIdx; i < this.metrics.tagFees.length; i++) {
                const fee = this.metrics.tagFees[i];
                if (typeof fee === "number" && !isNaN(fee)) {
                    sum += fee;
                    count++;
                }
            }
            // Calculate and round to 8 decimal places (TAG precision)
            const average = count > 0 ? Number((sum / count).toFixed(8)) : 0;
            shared_1.Logger.debug(`Calculated average TAG fees: ${average} over ${timeWindow}ms`);
            return average;
        }
        catch (error) {
            shared_1.Logger.error("Error calculating average TAG fees:", error);
            return 0;
        }
    }
    /**
     * Record a mining error
     * @param {string} context - Error context
     */
    recordError(context) {
        try {
            shared_1.Logger.error(`Mining error in ${context}`);
            this.updateMetrics({
                hashRate: 0,
                difficulty: this.difficulty,
                blockTime: 0,
            }).catch((err) => shared_1.Logger.error("Failed to update metrics on error:", err));
        }
        catch (error) {
            shared_1.Logger.error("Failed to record error:", error);
        }
    }
    /**
     * Set a gauge metric value
     * @param {string} name - Metric name
     * @param {number} value - Gauge value
     */
    gauge(name, value) {
        if (typeof value !== "number" || isNaN(value)) {
            shared_1.Logger.error(`Invalid gauge value for ${name}`);
            return;
        }
        try {
            switch (name) {
                case "blocks_in_flight":
                    this.blockHeight = value;
                    break;
                case "synced_headers":
                    this.syncedHeaders = value;
                    break;
                case "synced_blocks":
                    this.syncedBlocks = value;
                    break;
                case "whitelisted":
                    this.whitelistedPeers = value;
                    break;
                case "blacklisted":
                    this.blacklistedPeers = value;
                    break;
                case "hash_rate":
                    this.hashRate = value;
                    break;
                case "difficulty":
                    this.difficulty = value;
                    break;
                default:
                    shared_1.Logger.warn(`Unknown metric gauge: ${name}`);
            }
        }
        catch (error) {
            shared_1.Logger.error(`Failed to update gauge ${name}:`, error);
        }
    }
    /**
     * Record a failed mining attempt
     * @param {string} reason - Failure reason
     */
    recordFailedMine(reason) {
        this.totalBlocks++;
        this.lastMiningTime = Date.now() - this.lastBlockTime;
        this.hashRate = 0; // Reset hash rate on failure
        shared_1.Logger.warn(`Mining failed: ${reason}`);
    }
    /**
     * Record a successful mining attempt
     */
    recordSuccessfulMine() {
        this.totalBlocks++;
        this.successfulBlocks++;
        this.lastBlockTime = Date.now();
    }
}
exports.MiningMetrics = MiningMetrics;
//# sourceMappingURL=metrics.js.map