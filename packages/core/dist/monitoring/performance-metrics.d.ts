/**
 * @fileoverview Performance metrics tracking system for the H3Tag blockchain. Includes operation timing,
 * statistical analysis, and performance monitoring for blockchain operations.
 *
 * @module PerformanceMetrics
 */
/**
 * @class PerformanceMetrics
 * @description Singleton class for tracking and analyzing operation performance metrics
 *
 * @property {Map<string, Object>} metrics.operations - Map of operation metrics
 * @property {number[]} metrics.operations.durations - Array of operation durations
 * @property {number[]} metrics.operations.timestamps - Array of measurement timestamps
 * @property {number} metrics.operations.count - Total operation count
 * @property {number} metrics.operations.totalDuration - Total duration of operations
 * @property {number} metrics.operations.maxDuration - Maximum operation duration
 * @property {number} metrics.operations.minDuration - Minimum operation duration
 * @property {number} metrics.operations.lastUpdated - Last update timestamp
 *
 * @example
 * const metrics = PerformanceMetrics.getInstance();
 * await metrics.recordMetric("blockProcessing", 150, { context: "mainnet" });
 * const stats = metrics.getMetrics("mainnet");
 */
export declare class PerformanceMetrics {
    private static instance;
    private readonly mutex;
    private readonly MAX_METRICS_AGE;
    private readonly MAX_ARRAY_SIZE;
    private readonly CLEANUP_INTERVAL;
    private cleanupTimer;
    private metrics;
    /**
     * Private constructor for singleton pattern
     */
    private constructor();
    /**
     * Gets singleton instance
     * @returns {PerformanceMetrics} Singleton instance
     */
    static getInstance(): PerformanceMetrics;
    /**
     * Records a performance metric
     * @param {string} operation - Operation name
     * @param {number} duration - Operation duration in milliseconds
     * @param {Object} metadata - Operation metadata
     * @param {string} metadata.context - Operation context
     * @throws {Error} If metric recording fails
     */
    recordMetric(operation: string, duration: number, metadata: {
        context: string;
        [key: string]: any;
    }): Promise<void>;
    private initializeMetric;
    private updateMetric;
    /**
     * Cleans up resources and disposes metrics
     * @throws {Error} If disposal fails
     */
    dispose(): Promise<void>;
    /**
     * Gets metrics for specified context
     * @param {string} [context] - Optional context filter
     * @returns {Record<string, any>} Filtered metrics
     */
    getMetrics(context?: string): Record<string, any>;
    private cleanupOldMetrics;
}
