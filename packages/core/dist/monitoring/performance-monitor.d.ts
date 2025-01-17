/**
 * @fileoverview Performance monitoring and tracking system for the H3Tag blockchain.
 * Provides real-time performance metrics and threshold monitoring.
 *
 * @module PerformanceMonitor
 */
/**
 * @class PerformanceMonitor
 * @description Monitors and tracks performance metrics with context-based tracking
 *
 * @property {Map<string, Object>} metrics - Performance metrics storage
 * @property {number} MAX_MEASUREMENTS - Maximum number of measurements to store
 * @property {number} ALERT_THRESHOLD_MS - Threshold for performance alerts
 *
 * @example
 * const monitor = new PerformanceMonitor("blockchain");
 * const markerId = monitor.start("blockProcessing");
 * // ... perform operation ...
 * await monitor.end(markerId);
 */
export declare class PerformanceMonitor {
    private readonly context;
    private metrics;
    private readonly MAX_MEASUREMENTS;
    private readonly ALERT_THRESHOLD_MS;
    private readonly metricsClient;
    private readonly mutex;
    /**
     * Creates a new PerformanceMonitor instance
     * @param {string} context - Monitoring context
     * @throws {Error} If context is not provided
     */
    constructor(context: string);
    /**
     * Starts monitoring an operation
     * @param {string} operation - Operation name
     * @returns {string} Operation marker ID
     * @throws {Error} If operation name is not provided
     */
    start(operation: string): string;
    /**
     * Ends monitoring for an operation
     * @param {string} markerId - Operation marker ID
     * @throws {Error} If monitoring fails
     */
    end(markerId: string): Promise<void>;
    private calculateStats;
    /**
     * Gets metrics for specified operation
     * @param {string} [operation] - Optional operation filter
     * @returns {Object} Operation metrics
     */
    getMetrics(operation?: string): {
        [key: string]: {
            current: number;
            average: number;
            p95: number;
            p99: number;
        };
    };
    /**
     * Resets all metrics
     */
    reset(): void;
    /**
     * Cleans up resources
     * @throws {Error} If cleanup fails
     */
    dispose(): Promise<void>;
}
