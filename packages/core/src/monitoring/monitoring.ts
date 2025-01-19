import prometheus from "prom-client";
import winston from "winston";
import { hostname } from "os";
import { Mutex } from "async-mutex";

/**
 * @fileoverview Monitoring system for the H3Tag blockchain. Includes performance tracking,
 * metrics collection, logging, and alerting for blockchain operations.
 *
 * @module Monitoring
 */

/**
 * @class MonitoringError
 * @extends Error
 * @description Custom error class for monitoring-related errors
 *
 * @example
 * throw new MonitoringError("Failed to initialize monitoring system");
 */
export class MonitoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MonitoringError";
  }
}

/**
 * @class Monitoring
 * @description Core monitoring system for blockchain operations
 *
 * @property {Object} metrics - Prometheus metrics collection
 * @property {prometheus.Gauge} metrics.activeNodes - Active nodes counter
 * @property {prometheus.Gauge} metrics.powHashrate - PoW hashrate gauge
 * @property {prometheus.Histogram} metrics.blockTime - Block time histogram
 * @property {prometheus.Gauge} metrics.networkDifficulty - Network difficulty gauge
 * @property {prometheus.Gauge} metrics.powNodeCount - PoW node count gauge
 * @property {winston.Logger} logger - Winston logger instance
 * @property {Map<string, number>} timers - Active monitoring timers
 *
 * @example
 * const monitoring = new Monitoring();
 * await monitoring.updateMetrics({
 *   powNodes: 10,
 *   hashrate: 1000000,
 *   blockTime: 60,
 *   difficulty: 12345
 * });
 */
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
        help: "Number of active nodes in the network",
        labelNames: ["type", "status"],
      }),
      powHashrate: new prometheus.Gauge({
        name: "pow_hashrate",
        help: "Current PoW hashrate in H/s",
        labelNames: ["node_id"],
      }),
      blockTime: new prometheus.Histogram({
        name: "block_time_seconds",
        help: "Block time in seconds",
        buckets: [10, 30, 60, 120, 300, 600],
      }),
      networkDifficulty: new prometheus.Gauge({
        name: "network_difficulty",
        help: "Current network difficulty",
        labelNames: ["algorithm"],
      }),
      powNodeCount: new prometheus.Gauge({
        name: "pow_node_count",
        help: "Number of PoW mining nodes",
        labelNames: ["status"],
      }),
    };

    try {
      this.logger = winston.createLogger({
        level: process.env.LOG_LEVEL || "info",
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        ),
        defaultMeta: {
          service: "blockchain",
          host: hostname(),
          version: process.env.APP_VERSION || "unknown",
        },
        transports: [
          new winston.transports.File({
            filename: "error.log",
            level: "error",
            maxsize: 5242880,
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: "combined.log",
            maxsize: 5242880,
            maxFiles: 5,
          }),
        ],
      });

      if (process.env.NODE_ENV !== "production") {
        this.logger.add(
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            ),
          })
        );
      }
    } catch (error) {
      console.error("Failed to initialize logger:", error);
      throw new MonitoringError("Logger initialization failed");
    }
  }

  /**
   * Updates monitoring metrics
   * @param {Object} data - Metric data to update
   * @param {number} [data.powNodes] - Number of PoW nodes
   * @param {number} [data.hashrate] - Current hashrate
   * @param {number} [data.blockTime] - Block time in seconds
   * @param {number} [data.difficulty] - Network difficulty
   * @throws {MonitoringError} If metrics update fails
   */
  public async updateMetrics(data: {
    powNodes?: number;
    hashrate?: number;
    blockTime?: number;
    difficulty?: number;
    voterParticipation?: number;
  }): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      if (typeof data.powNodes === "number" && data.powNodes >= 0) {
        this.metrics.powNodeCount.set({ status: "active" }, data.powNodes);
      }
      if (typeof data.hashrate === "number" && data.hashrate >= 0) {
        this.metrics.powHashrate.set({ node_id: "total" }, data.hashrate);
      }
      if (typeof data.blockTime === "number" && data.blockTime >= 0) {
        this.metrics.blockTime.observe(data.blockTime);
      }
      if (typeof data.difficulty === "number" && data.difficulty > 0) {
        this.metrics.networkDifficulty.set(
          { algorithm: "pow" },
          data.difficulty
        );
      }
    } catch (error) {
      this.logger.error("Failed to update metrics:", error);
      throw new MonitoringError("Metrics update failed");
    } finally {
      release();
    }
  }

  /**
   * Shuts down monitoring system
   * @throws {MonitoringError} If shutdown fails
   */
  async shutdown(): Promise<void> {
    try {
      await Promise.all(
        this.logger.transports.map(
          (transport) =>
            new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error("Transport shutdown timeout"));
              }, 5000);

              transport.once("finish", () => {
                clearTimeout(timeout);
                resolve();
              });
              transport.end();
            })
        )
      );

      Object.values(this.metrics).forEach((metric) => {
        if (metric instanceof prometheus.Gauge) {
          metric.reset();
        } else if (metric instanceof prometheus.Histogram) {
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

  /**
   * Records HTTP response time
   * @param {string} method - HTTP method
   * @param {string} path - Request path
   * @param {number} duration - Response time in milliseconds
   */
  public recordResponseTime(
    method: string,
    path: string,
    duration: number
  ): void {
    try {
      if (!method || !path || typeof duration !== "number" || duration < 0) {
        this.logger.warn("Invalid response time parameters", {
          method,
          path,
          duration,
        });
        return;
      }

      const MAX_DURATION = 30000;
      if (duration > MAX_DURATION) {
        this.logger.warn("Request timeout exceeded", {
          method,
          path,
          duration,
          limit: MAX_DURATION,
        });
        return;
      }

      this.responseTimeHistogram.labels(method, path).observe(duration);
    } catch (error) {
      this.logger.error("Failed to record response time:", error);
    }
  }

  /**
   * Updates active nodes count
   * @param {number} count - Number of active nodes
   */
  public updateActiveNodes(count: number): void {
    this.metrics.activeNodes.set({ type: "total" }, count);
  }

  /**
   * Updates network metrics
   * @param {number} totalHashPower - Total network hashpower
   * @param {number} totalNodes - Total number of nodes
   */
  public updateNetworkMetrics(
    totalHashPower: number,
    totalNodes: number
  ): void {
    this.metrics.powHashrate.set(totalHashPower);
    this.metrics.powNodeCount.set(totalNodes);
  }
}
