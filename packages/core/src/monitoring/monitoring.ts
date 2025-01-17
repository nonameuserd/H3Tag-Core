import prometheus from "prom-client";
import winston from "winston";
import { hostname } from "os";
import { Mutex } from "async-mutex";

export class MonitoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MonitoringError";
  }
}

export class Monitoring {
  private metrics: {
    activeNodes: prometheus.Gauge<string>;
    powHashrate: prometheus.Gauge<string>;
    blockTime: prometheus.Histogram<string>;
    networkDifficulty: prometheus.Gauge<string>;
    powNodeCount: prometheus.Gauge<string>;
  };

  public logger: winston.Logger;

  private timers: Map<string, number> = new Map();

  private responseTimeHistogram = new prometheus.Histogram({
    name: "http_request_duration_ms",
    help: "HTTP request duration in milliseconds",
    labelNames: ["method", "path"],
  });

  private readonly mutex = new Mutex();

  constructor() {
    this.metrics = {
      activeNodes: new prometheus.Gauge({
        name: "network_active_nodes",
        help: "Number of active nodes",
        labelNames: ["type"],
      }),
      powHashrate: new prometheus.Gauge({
        name: "pow_hashrate",
        help: "Current PoW hashrate",
      }),
      blockTime: new prometheus.Histogram({
        name: "block_time_seconds",
        help: "Block time in seconds",
        buckets: [10, 30, 60, 120, 300],
      }),
      networkDifficulty: new prometheus.Gauge({
        name: "network_difficulty",
        help: "Current network difficulty",
      }),
      powNodeCount: new prometheus.Gauge({
        name: "pow_node_count",
        help: "Number of PoW mining nodes",
      }),
    };

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: "blockchain", host: hostname() },
      transports: [
        new winston.transports.File({ filename: "error.log", level: "error" }),
        new winston.transports.File({ filename: "combined.log" }),
      ],
    });

    if (process.env.NODE_ENV !== "production") {
      this.logger.add(
        new winston.transports.Console({
          format: winston.format.simple(),
        })
      );
    }
  }

  public async updateMetrics(data: {
    powNodes?: number;
    hashrate?: number;
    blockTime?: number;
    difficulty?: number;
    voterParticipation?: number;
  }): Promise<void> {
    let release = await this.mutex.acquire();
    try {
      if (data.powNodes !== undefined && data.powNodes >= 0) {
        this.metrics.powNodeCount.set(data.powNodes);
      }
      if (data.hashrate !== undefined && data.hashrate >= 0) {
        this.metrics.powHashrate.set(data.hashrate);
      }
      if (data.blockTime !== undefined && data.blockTime >= 0) {
        this.metrics.blockTime.observe(data.blockTime);
      }
      if (data.difficulty !== undefined && data.difficulty > 0) {
        this.metrics.networkDifficulty.set(data.difficulty);
      }
    } catch (error) {
      this.logger.error("Failed to update metrics:", error);
      throw new MonitoringError("Metrics update failed");
    } finally {
      release();
    }
  }

  async shutdown(): Promise<void> {
    try {
      await Promise.all(
        this.logger.transports.map(
          (transport) =>
            new Promise<void>((resolve) => {
              transport.once("finish", () => resolve());
              transport.end();
            })
        )
      );

      Object.values(this.metrics).forEach((metric) => {
        if (metric instanceof prometheus.Gauge) {
          metric.reset();
        }
      });

      this.timers.clear();
    } catch (error) {
      this.logger.error("Failed to shutdown monitoring:", error);
      throw new MonitoringError("Monitoring shutdown failed");
    }
  }

  startTimer(label: string): { end: () => number } {
    const start = Date.now();
    return {
      end: () => {
        const duration = Date.now() - start;
        this.timers.set(label, duration);
        return duration;
      },
    };
  }

  public recordResponseTime(
    method: string,
    path: string,
    duration: number
  ): void {
    try {
      if (!method || !path || duration < 0) {
        this.logger.warn("Invalid response time parameters");
        return;
      }

      if (duration > 30000) {
        // 30 second timeout
        this.logger.warn("Request timeout exceeded", {
          method,
          path,
          duration,
        });
        return;
      }

      this.responseTimeHistogram.labels(method, path).observe(duration);
    } catch (error) {
      this.logger.error("Failed to record response time:", error);
    }
  }

  public updateActiveNodes(count: number): void {
    this.metrics.activeNodes.set({ type: "total" }, count);
  }

  public updateNetworkMetrics(
    totalHashPower: number,
    totalNodes: number
  ): void {
    this.metrics.powHashrate.set(totalHashPower);
    this.metrics.powNodeCount.set(totalNodes);
  }
}
