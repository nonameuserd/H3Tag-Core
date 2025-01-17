import { Logger } from "@h3tag-blockchain/shared";
import { Mutex } from "async-mutex";

export class PerformanceMetrics {
  private static instance: PerformanceMetrics;
  private readonly mutex = new Mutex();

  private metrics: {
    operations: Map<
      string,
      {
        durations: number[];
        timestamps: number[];
        count: number;
        totalDuration: number;
        maxDuration: number;
        minDuration: number;
      }
    >;
  };

  private constructor() {
    this.metrics = {
      operations: new Map(),
    };
  }

  public static getInstance(): PerformanceMetrics {
    if (!PerformanceMetrics.instance) {
      PerformanceMetrics.instance = new PerformanceMetrics();
    }
    return PerformanceMetrics.instance;
  }

  public async recordMetric(
    operation: string,
    duration: number,
    metadata: { context: string; [key: string]: any }
  ): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      const now = Date.now();
      const key = `${metadata.context}_${operation}`;

      if (!this.metrics.operations.has(key)) {
        this.metrics.operations.set(key, {
          durations: [],
          timestamps: [],
          count: 0,
          totalDuration: 0,
          maxDuration: duration,
          minDuration: duration,
        });
      }

      const metric = this.metrics.operations.get(key)!;
      metric.durations.push(duration);
      metric.timestamps.push(now);
      metric.count++;
      metric.totalDuration += duration;
      metric.maxDuration = Math.max(metric.maxDuration, duration);
      metric.minDuration = Math.min(metric.minDuration, duration);

      // Keep last 24 hours of data
      await this.cleanupOldMetrics(now);

      Logger.debug("Performance metric recorded", {
        operation: key,
        duration,
        average: metric.totalDuration / metric.count,
        count: metric.count,
        ...metadata,
      });
    } finally {
      release();
    }
  }

  private async cleanupOldMetrics(now: number): Promise<void> {
    const cutoff = now - 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, metric] of this.metrics.operations.entries()) {
      const startIdx = metric.timestamps.findIndex((t) => t > cutoff);

      if (startIdx > 0) {
        metric.durations = metric.durations.slice(startIdx);
        metric.timestamps = metric.timestamps.slice(startIdx);
        metric.count = metric.durations.length;
        metric.totalDuration = metric.durations.reduce((a, b) => a + b, 0);
        metric.maxDuration = Math.max(...metric.durations);
        metric.minDuration = Math.min(...metric.durations);
      }

      if (metric.timestamps.length === 0) {
        this.metrics.operations.delete(key);
      }
    }
  }

  public getMetrics(context?: string): Record<
    string,
    {
      average: number;
      count: number;
      totalDuration: number;
      maxDuration: number;
      minDuration: number;
      last24Hours: number[];
    }
  > {
    const result: Record<string, any> = {};

    for (const [key, metric] of this.metrics.operations.entries()) {
      if (!context || key.startsWith(context)) {
        result[key] = {
          average: metric.totalDuration / metric.count,
          count: metric.count,
          totalDuration: metric.totalDuration,
          maxDuration: metric.maxDuration,
          minDuration: metric.minDuration,
          last24Hours: metric.durations,
        };
      }
    }

    return result;
  }
}
