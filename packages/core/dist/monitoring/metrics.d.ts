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
export declare class MiningMetrics {
    totalBlocks: number;
    successfulBlocks: number;
    lastMiningTime: number;
    averageHashRate: number;
    totalTAGMined: number;
    currentBlockReward: number;
    tagTransactionsCount: number;
    timestamp: bigint;
    blockHeight: number;
    hashRate: number;
    difficulty: number;
    blockTime: number;
    tagVolume: number;
    tagFees: number;
    lastBlockTime: number;
    syncedHeaders: number;
    syncedBlocks: number;
    whitelistedPeers: number;
    blacklistedPeers: number;
    private static instance;
    private metrics;
    private readonly mutex;
    private constructor();
    static getInstance(): MiningMetrics;
    updateMetrics(data: {
        hashRate?: number;
        difficulty?: number;
        blockTime?: number;
        tagVolume?: number;
        tagFees?: number;
    }): Promise<void>;
    private cleanupOldMetrics;
    /**
     * Get average hash rate over specified time window
     * @param {number} [timeWindow=3600000] - Time window in milliseconds (default: 1 hour)
     * @returns {number} Average hash rate or 0 if no data
     */
    getAverageHashRate(timeWindow?: number): number;
    /**
     * Get average TAG volume over specified time window
     * @param {number} [timeWindow=3600000] - Time window in milliseconds (default: 1 hour)
     * @returns {number} Average TAG volume or 0 if no data
     */
    getAverageTAGVolume(timeWindow?: number): number;
    /**
     * Get average TAG transaction fees over specified time window
     * @param {number} [timeWindow=3600000] - Time window in milliseconds (default: 1 hour)
     * @returns {number} Average TAG fees or 0 if no data
     */
    getAverageTAGFees(timeWindow?: number): number;
    /**
     * Record a mining error
     * @param {string} context - Error context
     */
    recordError(context: string): void;
    /**
     * Set a gauge metric value
     * @param {string} name - Metric name
     * @param {number} value - Gauge value
     */
    gauge(name: string, value: number): void;
    /**
     * Record a failed mining attempt
     * @param {string} reason - Failure reason
     */
    recordFailedMine(reason: string): void;
    /**
     * Record a successful mining attempt
     */
    recordSuccessfulMine(): void;
}
