import { Logger } from "@h3tag-blockchain/shared";
import { PerformanceMetrics } from "./performance-metrics";

export class PerformanceMonitor {
  private metrics: Map<string, { startTime: number; measurements: number[] }> =
    new Map();
  private readonly MAX_MEASUREMENTS = 1000;
  private readonly ALERT_THRESHOLD_MS = 5000;
  private readonly metricsClient: PerformanceMetrics;

  constructor(private readonly context: string) {
    this.metricsClient = PerformanceMetrics.getInstance();
  }

  public start(operation: string): string {
    const markerId = `${this.context}_${operation}_${Date.now()}`;
    this.metrics.set(markerId, {
      startTime: performance.now(),
      measurements: [],
    });
    return markerId;
  }

  public async end(markerId: string): Promise<void> {
    try {
      const metric = this.metrics.get(markerId);
      if (!metric) {
        Logger.warn(`No start time found for marker: ${markerId}`);
        return;
      }

      const duration = performance.now() - metric.startTime;
      const [context, operation] = markerId.split("_");

      // Record metric using the new PerformanceMetrics class
      await this.metricsClient.recordMetric(operation, duration, {
        context: this.context,
        markerId,
      });

      // Store measurement
      metric.measurements.push(duration);
      if (metric.measurements.length > this.MAX_MEASUREMENTS) {
        metric.measurements.shift();
      }

      // Calculate statistics
      const stats = this.calculateStats(metric.measurements);

      // Report metrics
      await this.metricsClient.recordMetric(`${context}_duration`, duration, {
        context: this.context,
        operation,
        unit: "ms",
      });

      await this.metricsClient.recordMetric(
        `${context}_duration_avg`,
        stats.average,
        {
          context: this.context,
          operation,
          unit: "ms",
        }
      );

      // Performance alerts
      if (duration > this.ALERT_THRESHOLD_MS) {
        Logger.warn(`Performance threshold exceeded`, {
          context,
          operation,
          duration,
          threshold: this.ALERT_THRESHOLD_MS,
          stats,
        });
      }

      // Cleanup
      this.metrics.delete(markerId);
    } catch (error) {
      Logger.error("Error in performance monitoring:", error);
    }
  }

  private calculateStats(measurements: number[]) {
    const sorted = [...measurements].sort((a, b) => a - b);
    return {
      average: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      samples: measurements.length,
    };
  }

  public getMetrics(operation?: string): {
    [key: string]: {
      current: number;
      average: number;
      p95: number;
      p99: number;
    };
  } {
    const metrics: any = {};

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

  public reset(): void {
    this.metrics.clear();
  }

  public async dispose(): Promise<void> {
    try {
      // Cleanup any active metrics
      this.metrics.clear();
      // Additional cleanup if needed
    } catch (error) {
      Logger.error("Failed to dispose PerformanceMonitor:", error);
    }
  }
}
