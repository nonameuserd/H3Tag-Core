import { HybridDirectConsensus } from "../blockchain/consensus/hybrid-direct";
/**
 * @fileoverview Performance monitoring system for the H3Tag blockchain. Includes timing metrics,
 * cache performance tracking, and statistical analysis for blockchain operations.
 *
 * @module Performance
 */
/**
 * @class Performance
 * @description Singleton class for tracking performance metrics and cache statistics
 *
 * @property {Map<string, any>} metrics - Storage for performance metrics
 * @property {number} MAX_METRICS_AGE - Maximum age of metrics (24 hours)
 * @property {number} CLEANUP_INTERVAL - Interval for metrics cleanup (1 hour)
 *
 * @example
 * const performance = Performance.getInstance();
 * const marker = Performance.startTimer("blockProcessing");
 * // ... perform operation ...
 * const duration = Performance.stopTimer(marker);
 */
export declare class Performance {
    private static instance;
    private static metrics;
    private static readonly MAX_METRICS_AGE;
    private static readonly CLEANUP_INTERVAL;
    private cleanupTimer;
    private constructor();
    static getInstance(): Performance;
    /**
     * Updates consensus cache metrics
     * @param {HybridDirectConsensus} consensus - Consensus instance
     */
    updateCacheMetrics(consensus: HybridDirectConsensus): void;
    /**
     * Starts a performance timer
     * @param {string} label - Timer label
     * @returns {string} Timer marker
     * @throws {Error} If label is not provided
     */
    static startTimer(label: string): string;
    /**
     * Stops a performance timer
     * @param {string} marker - Timer marker
     * @returns {number} Duration in milliseconds
     */
    static stopTimer(marker: string): number;
    private static recordMetric;
    private cleanupOldMetrics;
    /**
     * Gets all current metrics
     * @returns {Object} Current metrics
     */
    getMetrics(): {
        [k: string]: any;
    };
    /**
     * Cleans up resources
     * @throws {Error} If cleanup fails
     */
    dispose(): void;
}
