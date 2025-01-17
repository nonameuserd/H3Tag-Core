import { Logger } from "@h3tag-blockchain/shared";
import { HybridDirectConsensus } from "../blockchain/consensus/hybrid-direct";

export class Performance {
  private static instance: Performance;
  private static metrics: Map<string, any> = new Map();

  public static getInstance(): Performance {
    if (!this.instance) {
      this.instance = new Performance();
    }
    return this.instance;
  }

  public updateCacheMetrics(consensus: HybridDirectConsensus) {
    const cacheMetrics = consensus.getCacheMetrics();

    Performance.metrics.set("cache_hit_rate", cacheMetrics.hitRate);
    Performance.metrics.set("cache_size", cacheMetrics.size);
    Performance.metrics.set("cache_evictions", cacheMetrics.evictionCount);
    Performance.metrics.set("cache_memory_usage", cacheMetrics.memoryUsage);

    // Alert if cache performance degrades
    if (cacheMetrics.hitRate < 0.3) {
      Logger.warn("Cache hit rate is low", { hitRate: cacheMetrics.hitRate });
    }

    if (cacheMetrics.evictionCount > 1000) {
      Logger.warn("High cache eviction rate", {
        evictions: cacheMetrics.evictionCount,
      });
    }
  }

  public static startTimer(label: string): string {
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

  public static stopTimer(marker: string): number {
    const metric = this.metrics.get(marker);
    if (!metric?.startTime) return 0;

    const duration = Date.now() - metric.startTime;
    this.recordMetric(marker.split("_")[0], duration);
    this.metrics.delete(marker);
    return duration;
  }

  static recordMetric(label: string, duration: number): void {
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

  public getMetrics() {
    return Object.fromEntries(Performance.metrics);
  }
}
