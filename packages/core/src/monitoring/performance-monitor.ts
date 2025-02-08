import { Logger } from '@h3tag-blockchain/shared';
import { PerformanceMetrics } from './performance-metrics';
import { Mutex } from 'async-mutex';
import { performance } from 'perf_hooks';

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
export class PerformanceMonitor {
  private metrics: Map<
    string,
    { startTime: number; measurements: number[]; operation: string }
  > = new Map();
  private readonly MAX_MEASUREMENTS = 1000;
  private readonly ALERT_THRESHOLD_MS = 5000;
  private readonly metricsClient: PerformanceMetrics;
  private readonly mutex = new Mutex();

  /**
   * Creates a new PerformanceMonitor instance
   * @param {string} context - Monitoring context
   * @throws {Error} If context is not provided
   */
  constructor(private readonly context: string) {
    if (!context) {
      throw new Error('Context is required for PerformanceMonitor');
    }
    this.metricsClient = PerformanceMetrics.getInstance();
  }

  /**
   * Starts monitoring an operation
   * @param {string} operation - Operation name
   * @returns {string} Operation marker ID
   * @throws {Error} If operation name is not provided
   */
  public start(operation: string): string {
    if (!operation) {
      Logger.error('Operation name is required');
      throw new Error('Operation name is required');
    }

    const markerId =
      `${this.context}_${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.metrics.set(markerId, {
      startTime: performance.now(),
      measurements: [],
      operation,
    });
    return markerId;
  }

  /**
   * Ends monitoring for an operation
   * @param {string} markerId - Operation marker ID
   * @throws {Error} If monitoring fails
   */
  public async end(markerId: string): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      const metricEntry = this.metrics.get(markerId);
      if (!metricEntry) {
        Logger.warn(`No start time found for marker: ${markerId}`);
        return;
      }

      const duration = performance.now() - metricEntry.startTime;
      const operation = metricEntry.operation;

      // Record metric using the PerformanceMetrics class
      await this.metricsClient.recordMetric(operation, duration, {
        context: this.context,
        markerId,
      });

      // Store measurement with bounds checking
      if (metricEntry.measurements.length >= this.MAX_MEASUREMENTS) {
        metricEntry.measurements.shift();
      }
      metricEntry.measurements.push(duration);

      // Calculate statistics
      const stats = this.calculateStats(metricEntry.measurements);

      // Report metrics
      await this.metricsClient.recordMetric(`${operation}_duration`, duration, {
        context: this.context,
        operation,
        unit: 'ms',
      });

      await this.metricsClient.recordMetric(
        `${operation}_duration_avg`,
        stats.average,
        {
          context: this.context,
          operation,
          unit: 'ms',
        },
      );

      // Performance alerts
      if (duration > this.ALERT_THRESHOLD_MS) {
        Logger.warn('Performance threshold exceeded', {
          context: this.context,
          operation,
          duration,
          threshold: this.ALERT_THRESHOLD_MS,
          stats,
        });
      }

      // Cleanup
      this.metrics.delete(markerId);
    } catch (error) {
      Logger.error('Error in performance monitoring:', error);
      throw error;
    } finally {
      release();
    }
  }

  private calculateStats(measurements: number[]) {
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
  public getMetrics(operation?: string): {
    [key: string]: {
      current: number;
      average: number;
      p95: number;
      p99: number;
    };
  } {
    const metricsResult: Record<
      string,
      { current: number; average: number; p95: number; p99: number }
    > = {};

    for (const [, data] of this.metrics.entries()) {
      if (!operation || data.operation === operation) {
        // Compute stats once instead of three times
        const stats = this.calculateStats(data.measurements);
        metricsResult[data.operation] = {
          current: performance.now() - data.startTime,
          average: stats.average,
          p95: stats.p95,
          p99: stats.p99,
        };
      }
    }

    return metricsResult;
  }

  /**
   * Resets all metrics
   */
  public reset(): void {
    this.metrics.clear();
  }

  /**
   * Cleans up resources
   * @throws {Error} If cleanup fails
   */
  public async dispose(): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      // Cleanup any active metrics
      this.metrics.clear();
    } catch (error) {
      Logger.error('Failed to dispose PerformanceMonitor:', error);
      throw error;
    } finally {
      release();
    }
  }
}
