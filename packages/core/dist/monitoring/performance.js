"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Performance = void 0;
const shared_1 = require("@h3tag-blockchain/shared");
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
class Performance {
    constructor() {
        // Initialize cleanup timer
        this.cleanupTimer = setInterval(() => {
            this.cleanupOldMetrics().catch((err) => shared_1.Logger.error("Metrics cleanup failed:", err));
        }, Performance.CLEANUP_INTERVAL);
    }
    static getInstance() {
        if (!this.instance) {
            this.instance = new Performance();
        }
        return this.instance;
    }
    /**
     * Updates consensus cache metrics
     * @param {HybridDirectConsensus} consensus - Consensus instance
     */
    updateCacheMetrics(consensus) {
        if (!consensus) {
            shared_1.Logger.error("Invalid consensus instance");
            return;
        }
        try {
            const cacheMetrics = consensus.getCacheMetrics();
            if (!cacheMetrics) {
                shared_1.Logger.error("Failed to get cache metrics");
                return;
            }
            Performance.metrics.set("cache_hit_rate", cacheMetrics.hitRate);
            Performance.metrics.set("cache_size", cacheMetrics.size);
            Performance.metrics.set("cache_evictions", cacheMetrics.evictionCount);
            Performance.metrics.set("cache_memory_usage", cacheMetrics.memoryUsage);
            // Alert if cache performance degrades
            if (cacheMetrics.hitRate < 0.3) {
                shared_1.Logger.warn("Cache hit rate is low", {
                    hitRate: cacheMetrics.hitRate,
                    threshold: 0.3,
                });
            }
            if (cacheMetrics.evictionCount > 1000) {
                shared_1.Logger.warn("High cache eviction rate", {
                    evictions: cacheMetrics.evictionCount,
                    threshold: 1000,
                });
            }
        }
        catch (error) {
            shared_1.Logger.error("Failed to update cache metrics:", error);
        }
    }
    /**
     * Starts a performance timer
     * @param {string} label - Timer label
     * @returns {string} Timer marker
     * @throws {Error} If label is not provided
     */
    static startTimer(label) {
        if (!label) {
            shared_1.Logger.error("Timer label is required");
            throw new Error("Timer label is required");
        }
        const marker = `${label}_${Date.now()}`;
        this.metrics.set(marker, {
            count: 0,
            total: 0,
            min: Infinity,
            max: -Infinity,
            avg: 0,
            startTime: Date.now(),
        });
        return marker;
    }
    /**
     * Stops a performance timer
     * @param {string} marker - Timer marker
     * @returns {number} Duration in milliseconds
     */
    static stopTimer(marker) {
        if (!marker) {
            shared_1.Logger.error("Timer marker is required");
            return 0;
        }
        try {
            const metric = this.metrics.get(marker);
            if (!metric?.startTime) {
                shared_1.Logger.warn("No start time found for marker:", marker);
                return 0;
            }
            const duration = Date.now() - metric.startTime;
            const label = marker.split("_")[0];
            this.recordMetric(label, duration);
            this.metrics.delete(marker);
            return duration;
        }
        catch (error) {
            shared_1.Logger.error("Failed to stop timer:", error);
            return 0;
        }
    }
    static recordMetric(label, duration) {
        if (!label || typeof duration !== "number" || duration < 0) {
            shared_1.Logger.error("Invalid metric parameters", { label, duration });
            return;
        }
        try {
            const current = this.metrics.get(label) || {
                count: 0,
                total: 0,
                min: Infinity,
                max: -Infinity,
                avg: 0,
            };
            current.count++;
            current.total += duration;
            current.min = Math.min(current.min, duration);
            current.max = Math.max(current.max, duration);
            current.avg = current.total / current.count;
            this.metrics.set(label, current);
        }
        catch (error) {
            shared_1.Logger.error("Failed to record metric:", error);
        }
    }
    async cleanupOldMetrics() {
        const cutoff = Date.now() - Performance.MAX_METRICS_AGE;
        try {
            for (const [key, metric] of Performance.metrics.entries()) {
                if (metric.startTime && metric.startTime < cutoff) {
                    Performance.metrics.delete(key);
                }
            }
        }
        catch (error) {
            shared_1.Logger.error("Failed to cleanup metrics:", error);
            throw error;
        }
    }
    /**
     * Gets all current metrics
     * @returns {Object} Current metrics
     */
    getMetrics() {
        return Object.fromEntries(Performance.metrics);
    }
    /**
     * Cleans up resources
     * @throws {Error} If cleanup fails
     */
    dispose() {
        try {
            if (this.cleanupTimer) {
                clearInterval(this.cleanupTimer);
            }
            Performance.metrics.clear();
        }
        catch (error) {
            shared_1.Logger.error("Failed to dispose Performance monitor:", error);
            throw error;
        }
    }
}
exports.Performance = Performance;
Performance.metrics = new Map();
Performance.MAX_METRICS_AGE = 24 * 60 * 60 * 1000; // 24 hours
Performance.CLEANUP_INTERVAL = 3600000; // 1 hour
//# sourceMappingURL=performance.js.map