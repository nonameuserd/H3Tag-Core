"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceMonitor = void 0;
const shared_1 = require("@h3tag-blockchain/shared");
const performance_metrics_1 = require("./performance-metrics");
const async_mutex_1 = require("async-mutex");
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
class PerformanceMonitor {
    /**
     * Creates a new PerformanceMonitor instance
     * @param {string} context - Monitoring context
     * @throws {Error} If context is not provided
     */
    constructor(context) {
        this.context = context;
        this.metrics = new Map();
        this.MAX_MEASUREMENTS = 1000;
        this.ALERT_THRESHOLD_MS = 5000;
        this.mutex = new async_mutex_1.Mutex();
        if (!context) {
            throw new Error("Context is required for PerformanceMonitor");
        }
        this.metricsClient = performance_metrics_1.PerformanceMetrics.getInstance();
    }
    /**
     * Starts monitoring an operation
     * @param {string} operation - Operation name
     * @returns {string} Operation marker ID
     * @throws {Error} If operation name is not provided
     */
    start(operation) {
        if (!operation) {
            shared_1.Logger.error("Operation name is required");
            throw new Error("Operation name is required");
        }
        const markerId = `${this.context}_${operation}_${Date.now()}`;
        this.metrics.set(markerId, {
            startTime: performance.now(),
            measurements: [],
        });
        return markerId;
    }
    /**
     * Ends monitoring for an operation
     * @param {string} markerId - Operation marker ID
     * @throws {Error} If monitoring fails
     */
    async end(markerId) {
        const release = await this.mutex.acquire();
        try {
            const metric = this.metrics.get(markerId);
            if (!metric) {
                shared_1.Logger.warn(`No start time found for marker: ${markerId}`);
                return;
            }
            const duration = performance.now() - metric.startTime;
            const [context, operation] = markerId.split("_");
            // Record metric using the PerformanceMetrics class
            await this.metricsClient.recordMetric(operation, duration, {
                context: this.context,
                markerId,
            });
            // Store measurement with bounds checking
            if (metric.measurements.length >= this.MAX_MEASUREMENTS) {
                metric.measurements.shift();
            }
            metric.measurements.push(duration);
            // Calculate statistics
            const stats = this.calculateStats(metric.measurements);
            // Report metrics
            await this.metricsClient.recordMetric(`${operation}_duration`, duration, {
                context: this.context,
                operation,
                unit: "ms",
            });
            await this.metricsClient.recordMetric(`${operation}_duration_avg`, stats.average, {
                context: this.context,
                operation,
                unit: "ms",
            });
            // Performance alerts
            if (duration > this.ALERT_THRESHOLD_MS) {
                shared_1.Logger.warn(`Performance threshold exceeded`, {
                    context,
                    operation,
                    duration,
                    threshold: this.ALERT_THRESHOLD_MS,
                    stats,
                });
            }
            // Cleanup
            this.metrics.delete(markerId);
        }
        catch (error) {
            shared_1.Logger.error("Error in performance monitoring:", error);
            throw error;
        }
        finally {
            release();
        }
    }
    calculateStats(measurements) {
        if (!measurements || measurements.length === 0) {
            return {
                average: 0,
                median: 0,
                p95: 0,
                p99: 0,
                min: 0,
                max: 0,
                samples: 0,
            };
        }
        const sorted = [...measurements].sort((a, b) => a - b);
        return {
            average: measurements.reduce((a, b) => a + b, 0) / measurements.length,
            median: sorted[Math.floor(sorted.length / 2)] || 0,
            p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
            p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
            min: sorted[0] || 0,
            max: sorted[sorted.length - 1] || 0,
            samples: measurements.length,
        };
    }
    /**
     * Gets metrics for specified operation
     * @param {string} [operation] - Optional operation filter
     * @returns {Object} Operation metrics
     */
    getMetrics(operation) {
        const metrics = {};
        for (const [markerId, data] of this.metrics.entries()) {
            const [context, op] = markerId.split("_");
            if (!operation || op === operation) {
                const stats = this.calculateStats(data.measurements);
                metrics[op] = {
                    current: performance.now() - data.startTime,
                    average: stats.average,
                    p95: stats.p95,
                    p99: stats.p99,
                };
            }
        }
        return metrics;
    }
    /**
     * Resets all metrics
     */
    reset() {
        this.metrics.clear();
    }
    /**
     * Cleans up resources
     * @throws {Error} If cleanup fails
     */
    async dispose() {
        const release = await this.mutex.acquire();
        try {
            // Cleanup any active metrics
            this.metrics.clear();
        }
        catch (error) {
            shared_1.Logger.error("Failed to dispose PerformanceMonitor:", error);
            throw error;
        }
        finally {
            release();
        }
    }
}
exports.PerformanceMonitor = PerformanceMonitor;
//# sourceMappingURL=performance-monitor.js.map