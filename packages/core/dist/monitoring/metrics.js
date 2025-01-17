"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiningMetrics = void 0;
const shared_1 = require("@h3tag-blockchain/shared");
const async_mutex_1 = require("async-mutex");
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
            if (data.hashRate) {
                this.metrics.hashRate.push(data.hashRate);
                this.metrics.timestamp.push(BigInt(now));
            }
            if (data.difficulty)
                this.metrics.difficulty.push(data.difficulty);
            if (data.blockTime) {
                this.lastBlockTime = Date.now();
                this.metrics.blockTimes.push(data.blockTime);
            }
            if (data.tagVolume)
                this.metrics.tagVolume.push(data.tagVolume);
            if (data.tagFees)
                this.metrics.tagFees.push(data.tagFees);
            // Cleanup old metrics
            this.cleanupOldMetrics(now);
        }
        finally {
            release();
        }
    }
    cleanupOldMetrics(now) {
        const cutoff = now - 24 * 60 * 60 * 1000; // 24 hours
        const startIdx = this.metrics.timestamp.findIndex(t => t > cutoff);
        if (startIdx > 0) {
            this.metrics.hashRate = this.metrics.hashRate.slice(startIdx);
            this.metrics.difficulty = this.metrics.difficulty.slice(startIdx);
            this.metrics.blockTimes = this.metrics.blockTimes.slice(startIdx);
            this.metrics.timestamp = this.metrics.timestamp.slice(startIdx);
            this.metrics.tagVolume = this.metrics.tagVolume.slice(startIdx);
            this.metrics.tagFees = this.metrics.tagFees.slice(startIdx);
        }
    }
    getAverageHashRate(timeWindow = 3600000) {
        if (!this.metrics.hashRate.length || !this.metrics.timestamp.length) {
            return 0;
        }
        const cutoff = Date.now() - timeWindow;
        const startIdx = this.metrics.timestamp.findIndex(t => t > cutoff);
        if (startIdx === -1)
            return 0;
        const recentHashes = this.metrics.hashRate.slice(startIdx);
        return recentHashes.reduce((a, b) => a + b, 0) / recentHashes.length || 0;
    }
    /**
     * Get average TAG volume over specified time window
     * @param timeWindow Time window in milliseconds (default: 1 hour)
     * @returns Average TAG volume or 0 if no data
     */
    getAverageTAGVolume(timeWindow = 3600000) {
        try {
            const cutoff = Date.now() - timeWindow;
            // Early return if no data
            if (!this.metrics.tagVolume.length || !this.metrics.timestamp.length) {
                shared_1.Logger.debug('No TAG volume data available for averaging');
                return 0;
            }
            // Find starting index for optimization
            const startIdx = this.metrics.timestamp.findIndex(t => t > cutoff);
            if (startIdx === -1) {
                shared_1.Logger.debug('No TAG volume data within specified timeWindow');
                return 0;
            }
            // Calculate sum and count for average
            let sum = 0;
            let count = 0;
            for (let i = startIdx; i < this.metrics.tagVolume.length; i++) {
                const volume = this.metrics.tagVolume[i];
                if (typeof volume === 'number' && !isNaN(volume)) {
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
            shared_1.Logger.error('Error calculating average TAG volume:', error);
            return 0;
        }
    }
    /**
     * Get average TAG transaction fees over specified time window
     * @param timeWindow Time window in milliseconds (default: 1 hour)
     * @returns Average TAG fees or 0 if no data
     */
    getAverageTAGFees(timeWindow = 3600000) {
        try {
            const cutoff = Date.now() - timeWindow;
            // Early return if no data
            if (!this.metrics.tagFees.length || !this.metrics.timestamp.length) {
                shared_1.Logger.debug('No TAG fee data available for averaging');
                return 0;
            }
            // Find starting index for optimization
            const startIdx = this.metrics.timestamp.findIndex(t => t > cutoff);
            if (startIdx === -1) {
                shared_1.Logger.debug('No TAG fee data within specified timeWindow');
                return 0;
            }
            // Calculate sum and count for average
            let sum = 0;
            let count = 0;
            for (let i = startIdx; i < this.metrics.tagFees.length; i++) {
                const fee = this.metrics.tagFees[i];
                if (typeof fee === 'number' && !isNaN(fee)) {
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
            shared_1.Logger.error('Error calculating average TAG fees:', error);
            return 0;
        }
    }
    recordError(context) {
        shared_1.Logger.error(`Mining error in ${context}`);
        this.updateMetrics({
            hashRate: 0,
            difficulty: this.difficulty,
            blockTime: 0
        });
    }
    gauge(name, value) {
        switch (name) {
            case 'blocks_in_flight':
                // Track number of blocks being processed
                this.blockHeight = value;
                break;
            case 'synced_headers':
                // Track header sync progress
                this.syncedHeaders = value;
                break;
            case 'synced_blocks':
                // Track block sync progress
                this.syncedBlocks = value;
                break;
            case 'whitelisted':
                // Track whitelisted peers count
                this.whitelistedPeers = value;
                break;
            case 'blacklisted':
                // Track blacklisted peers count
                this.blacklistedPeers = value;
                break;
            case 'hash_rate':
                // Track current hash rate
                this.hashRate = value;
                break;
            case 'difficulty':
                // Track current mining difficulty
                this.difficulty = value;
                break;
            default:
                shared_1.Logger.warn(`Unknown metric gauge: ${name}`);
        }
    }
    recordFailedMine(reason) {
        this.totalBlocks++;
        this.lastMiningTime = Date.now() - this.lastBlockTime;
        this.hashRate = 0; // Reset hash rate on failure
        shared_1.Logger.warn(`Mining failed: ${reason}`);
    }
    recordSuccessfulMine() {
        this.totalBlocks++;
        this.successfulBlocks++;
        this.lastBlockTime = Date.now();
    }
}
exports.MiningMetrics = MiningMetrics;
//# sourceMappingURL=metrics.js.map