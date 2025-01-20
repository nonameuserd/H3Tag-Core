import { Logger } from '@h3tag-blockchain/shared';
import { HybridDirectConsensus } from '../blockchain/consensus/hybrid-direct';

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
export class Performance {
  private static instance: Performance;
  private static metrics: Map<
    string,
    {
      startTime: number;
      count: number;
      total: number;
      min: number;
      max: number;
      avg: number;
    }
  > = new Map();
  private static readonly MAX_METRICS_AGE = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly CLEANUP_INTERVAL = 3600000; // 1 hour
  private cleanupTimer: NodeJS.Timeout;

  private constructor() {
    // Initialize cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldMetrics().catch((err) =>
        Logger.error('Metrics cleanup failed:', err),
      );
    }, Performance.CLEANUP_INTERVAL);
  }

  public static getInstance(): Performance {
    if (!this.instance) {
      this.instance = new Performance();
    }
    return this.instance;
  }

  /**
   * Updates consensus cache metrics
   * @param {HybridDirectConsensus} consensus - Consensus instance
   */
  public updateCacheMetrics(consensus: HybridDirectConsensus) {
    if (!consensus) {
      Logger.error('Invalid consensus instance');
      return;
    }

    try {
      const cacheMetrics = consensus.getCacheMetrics();
      if (!cacheMetrics) {
        Logger.error('Failed to get cache metrics');
        return;
      }

      Performance.metrics.set('cache_hit_rate', {
        startTime: Date.now(),
        count: 0,
        total: 0,
        min: Infinity,
        max: -Infinity,
        avg: 0,
      });
      Performance.metrics.set('cache_size', {
        startTime: Date.now(),
        count: 0,
        total: 0,
        min: Infinity,
        max: -Infinity,
        avg: 0,
      });
      Performance.metrics.set('cache_evictions', {
        startTime: Date.now(),
        count: 0,
        total: 0,
        min: Infinity,
        max: -Infinity,
        avg: 0,
      });
      Performance.metrics.set('cache_memory_usage', {
        startTime: Date.now(),
        count: 0,
        total: 0,
        min: Infinity,
        max: -Infinity,
        avg: 0,
      });

      // Alert if cache performance degrades
      if (cacheMetrics.hitRate < 0.3) {
        Logger.warn('Cache hit rate is low', {
          hitRate: cacheMetrics.hitRate,
          threshold: 0.3,
        });
      }

      if (cacheMetrics.evictionCount > 1000) {
        Logger.warn('High cache eviction rate', {
          evictions: cacheMetrics.evictionCount,
          threshold: 1000,
        });
      }
    } catch (error) {
      Logger.error('Failed to update cache metrics:', error);
    }
  }

  /**
   * Starts a performance timer
   * @param {string} label - Timer label
   * @returns {string} Timer marker
   * @throws {Error} If label is not provided
   */
  public static startTimer(label: string): string {
    if (!label) {
      Logger.error('Timer label is required');
      throw new Error('Timer label is required');
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
  public static stopTimer(marker: string): number {
    if (!marker) {
      Logger.error('Timer marker is required');
      return 0;
    }

    try {
      const metric = this.metrics.get(marker) as { startTime: number };
      if (!metric?.startTime) {
        Logger.warn('No start time found for marker:', marker);
        return 0;
      }

      const duration = Date.now() - metric.startTime;
      const label = marker.split('_')[0];

      this.recordMetric(label, duration);
      this.metrics.delete(marker);
      return duration;
    } catch (error) {
      Logger.error('Failed to stop timer:', error);
      return 0;
    }
  }

  private static recordMetric(label: string, duration: number): void {
    if (!label || typeof duration !== 'number' || duration < 0) {
      Logger.error('Invalid metric parameters', { label, duration });
      return;
    }

    try {
      const current = this.metrics.get(label) || {
        startTime: Date.now(),
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
    } catch (error) {
      Logger.error('Failed to record metric:', error);
    }
  }

  private async cleanupOldMetrics(): Promise<void> {
    const cutoff = Date.now() - Performance.MAX_METRICS_AGE;

    try {
      for (const [key, metric] of Performance.metrics.entries()) {
        if (metric.startTime && metric.startTime < cutoff) {
          Performance.metrics.delete(key);
        }
      }
    } catch (error) {
      Logger.error('Failed to cleanup metrics:', error);
      throw error;
    }
  }

  /**
   * Gets all current metrics
   * @returns {Object} Current metrics
   */
  public getMetrics() {
    return Object.fromEntries(Performance.metrics);
  }

  /**
   * Cleans up resources
   * @throws {Error} If cleanup fails
   */
  public dispose(): void {
    try {
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
      }
      Performance.metrics.clear();
    } catch (error) {
      Logger.error('Failed to dispose Performance monitor:', error);
      throw error;
    }
  }
}
