"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Monitoring = exports.MonitoringError = void 0;
const prom_client_1 = __importDefault(require("prom-client"));
const winston_1 = __importDefault(require("winston"));
const os_1 = require("os");
const async_mutex_1 = require("async-mutex");
class MonitoringError extends Error {
    constructor(message) {
        super(message);
        this.name = "MonitoringError";
    }
}
exports.MonitoringError = MonitoringError;
class Monitoring {
    constructor() {
        this.timers = new Map();
        this.responseTimeHistogram = new prom_client_1.default.Histogram({
            name: "http_request_duration_ms",
            help: "HTTP request duration in milliseconds",
            labelNames: ["method", "path"],
        });
        this.mutex = new async_mutex_1.Mutex();
        this.metrics = {
            activeNodes: new prom_client_1.default.Gauge({
                name: "network_active_nodes",
                help: "Number of active nodes",
                labelNames: ["type"],
            }),
            powHashrate: new prom_client_1.default.Gauge({
                name: "pow_hashrate",
                help: "Current PoW hashrate",
            }),
            blockTime: new prom_client_1.default.Histogram({
                name: "block_time_seconds",
                help: "Block time in seconds",
                buckets: [10, 30, 60, 120, 300],
            }),
            networkDifficulty: new prom_client_1.default.Gauge({
                name: "network_difficulty",
                help: "Current network difficulty",
            }),
            powNodeCount: new prom_client_1.default.Gauge({
                name: "pow_node_count",
                help: "Number of PoW mining nodes",
            }),
        };
        this.logger = winston_1.default.createLogger({
            level: process.env.LOG_LEVEL || "info",
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
            defaultMeta: { service: "blockchain", host: (0, os_1.hostname)() },
            transports: [
                new winston_1.default.transports.File({ filename: "error.log", level: "error" }),
                new winston_1.default.transports.File({ filename: "combined.log" }),
            ],
        });
        if (process.env.NODE_ENV !== "production") {
            this.logger.add(new winston_1.default.transports.Console({
                format: winston_1.default.format.simple(),
            }));
        }
    }
    async updateMetrics(data) {
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
        }
        catch (error) {
            this.logger.error("Failed to update metrics:", error);
            throw new MonitoringError("Metrics update failed");
        }
        finally {
            release();
        }
    }
    async shutdown() {
        try {
            await Promise.all(this.logger.transports.map((transport) => new Promise((resolve) => {
                transport.once("finish", () => resolve());
                transport.end();
            })));
            Object.values(this.metrics).forEach((metric) => {
                if (metric instanceof prom_client_1.default.Gauge) {
                    metric.reset();
                }
            });
            this.timers.clear();
        }
        catch (error) {
            this.logger.error("Failed to shutdown monitoring:", error);
            throw new MonitoringError("Monitoring shutdown failed");
        }
    }
    startTimer(label) {
        const start = Date.now();
        return {
            end: () => {
                const duration = Date.now() - start;
                this.timers.set(label, duration);
                return duration;
            },
        };
    }
    recordResponseTime(method, path, duration) {
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
        }
        catch (error) {
            this.logger.error("Failed to record response time:", error);
        }
    }
    updateActiveNodes(count) {
        this.metrics.activeNodes.set({ type: "total" }, count);
    }
    updateNetworkMetrics(totalHashPower, totalNodes) {
        this.metrics.powHashrate.set(totalHashPower);
        this.metrics.powNodeCount.set(totalNodes);
    }
}
exports.Monitoring = Monitoring;
//# sourceMappingURL=monitoring.js.map