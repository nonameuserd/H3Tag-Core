"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceMetrics = void 0;
const shared_1 = require("@h3tag-blockchain/shared");
const async_mutex_1 = require("async-mutex");
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
class PerformanceMetrics {
    /**
     * Private constructor for singleton pattern
     */
    constructor() {
        this.mutex = new async_mutex_1.Mutex();
        this.MAX_METRICS_AGE = 24 * 60 * 60 * 1000; // 24 hours
        this.MAX_ARRAY_SIZE = 1000;
        this.CLEANUP_INTERVAL = 3600000; // 1 hour
        this.metrics = {
            operations: new Map(),
        };
        // Add periodic cleanup
        this.cleanupTimer = setInterval(() => {
            this.cleanupOldMetrics(Date.now()).catch((err) => shared_1.Logger.error("Periodic cleanup failed:", err));
        }, this.CLEANUP_INTERVAL);
    }
    /**
     * Gets singleton instance
     * @returns {PerformanceMetrics} Singleton instance
     */
    static getInstance() {
        if (!PerformanceMetrics.instance) {
            PerformanceMetrics.instance = new PerformanceMetrics();
        }
        return PerformanceMetrics.instance;
    }
    /**
     * Records a performance metric
     * @param {string} operation - Operation name
     * @param {number} duration - Operation duration in milliseconds
     * @param {Object} metadata - Operation metadata
     * @param {string} metadata.context - Operation context
     * @throws {Error} If metric recording fails
     */
    async recordMetric(operation, duration, metadata) {
        if (!operation ||
            typeof duration !== "number" ||
            duration < 0 ||
            !metadata?.context) {
            shared_1.Logger.error("Invalid metric parameters", {
                operation,
                duration,
                metadata,
            });
            return;
        }
        const release = await this.mutex.acquire();
        try {
            const now = Date.now();
            const key = `${metadata.context}_${operation}`;
            let metric = this.metrics.operations.get(key);
            if (!metric) {
                metric = this.initializeMetric(duration, now);
                this.metrics.operations.set(key, metric);
            }
            await this.updateMetric(metric, duration, now);
        }
        catch (error) {
            shared_1.Logger.error("Failed to record metric:", error);
            throw error;
        }
        finally {
            release();
        }
    }
    initializeMetric(duration, timestamp) {
        return {
            durations: [duration],
            timestamps: [timestamp],
            count: 1,
            totalDuration: duration,
            maxDuration: duration,
            minDuration: duration,
            lastUpdated: timestamp,
            average: duration,
            last24Hours: [duration],
        };
    }
    async updateMetric(metric, duration, now) {
        // Check for numeric overflow
        if (metric.totalDuration > Number.MAX_SAFE_INTEGER - duration) {
            await this.cleanupOldMetrics(now);
            metric.totalDuration = metric.durations.reduce((a, b) => a + b, 0);
        }
        // Prevent array growth
        if (metric.durations.length >= this.MAX_ARRAY_SIZE) {
            const removeCount = Math.floor(this.MAX_ARRAY_SIZE / 2);
            metric.durations = metric.durations.slice(removeCount);
            metric.timestamps = metric.timestamps.slice(removeCount);
            metric.count = metric.durations.length;
        }
        metric.durations.push(duration);
        metric.timestamps.push(now);
        metric.count++;
        metric.totalDuration += duration;
        metric.maxDuration = Math.max(metric.maxDuration, duration);
        metric.minDuration = Math.min(metric.minDuration, duration);
        metric.lastUpdated = now;
    }
    /**
     * Cleans up resources and disposes metrics
     * @throws {Error} If disposal fails
     */
    async dispose() {
        const release = await this.mutex.acquire();
        try {
            if (this.cleanupTimer) {
                clearInterval(this.cleanupTimer);
            }
            this.metrics.operations.clear();
        }
        catch (error) {
            shared_1.Logger.error("Failed to dispose metrics:", error);
            throw error;
        }
        finally {
            release();
        }
    }
    /**
     * Gets metrics for specified context
     * @param {string} [context] - Optional context filter
     * @returns {Record<string, any>} Filtered metrics
     */
    getMetrics(context) {
        try {
            const result = {};
            const now = Date.now();
            const cutoff = now - this.MAX_METRICS_AGE;
            for (const [key, metric] of this.metrics.operations.entries()) {
                if (!context || key.startsWith(context)) {
                    if (metric.count === 0 || metric.lastUpdated < cutoff)
                        continue;
                    const recentDurations = metric.durations.filter((_, i) => metric.timestamps[i] > cutoff);
                    if (recentDurations.length === 0)
                        continue;
                    result[key] = {
                        ...metric,
                        average: metric.totalDuration / metric.count,
                        last24Hours: recentDurations,
                        lastUpdated: metric.lastUpdated,
                    };
                }
            }
            return result;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get metrics:", error);
            return {};
        }
    }
    async cleanupOldMetrics(now) {
        const cutoff = now - this.MAX_METRICS_AGE;
        const release = await this.mutex.acquire();
        try {
            for (const [key, metric] of this.metrics.operations.entries()) {
                // Check if metric is too old or empty
                if (metric.lastUpdated < cutoff || metric.durations.length === 0) {
                    this.metrics.operations.delete(key);
                    continue;
                }
                const startIdx = metric.timestamps.findIndex((t) => t > cutoff);
                // If all data is old, remove the metric
                if (startIdx === -1) {
                    this.metrics.operations.delete(key);
                    continue;
                }
                // If we found newer data, slice the arrays and update metrics
                if (startIdx > 0) {
                    metric.durations = metric.durations.slice(startIdx);
                    metric.timestamps = metric.timestamps.slice(startIdx);
                    // Recalculate metrics
                    metric.count = metric.durations.length;
                    metric.totalDuration = metric.durations.reduce((a, b) => a + b, 0);
                    // Use null checks for empty arrays
                    if (metric.durations.length > 0) {
                        metric.maxDuration = Math.max(...metric.durations);
                        metric.minDuration = Math.min(...metric.durations);
                    }
                    // Update lastUpdated to most recent timestamp
                    metric.lastUpdated = metric.timestamps[metric.timestamps.length - 1];
                }
            }
        }
        catch (error) {
            shared_1.Logger.error("Failed to cleanup metrics:", error);
            throw error;
        }
        finally {
            release();
        }
    }
}
exports.PerformanceMetrics = PerformanceMetrics;
