"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsCollector = void 0;
const events_1 = require("events");
const shared_1 = require("@h3tag-blockchain/shared");
/**
 * @fileoverview Metrics collection system for the H3Tag blockchain. Includes performance metrics,
 * block statistics, and transaction monitoring for network analysis and optimization.
 *
 * @module MetricsCollector
 */
/**
 * @class MetricsCollector
 * @description Collects and manages blockchain metrics and performance data
 *
 * @property {Map<string, number>} metrics - Storage for collected metrics
 * @property {Map<string, number>} timers - Active metric timers
 * @property {EventEmitter} eventEmitter - Event emitter for metric updates
 * @property {string} namespace - Metrics namespace identifier
 * @property {NodeJS.Timeout} flushInterval - Timer for periodic metric flushing
 *
 * @example
 * const collector = new MetricsCollector("blockchain");
 * collector.increment("transactions.processed");
 * collector.gauge("block.size", 1024);
 * const stopTimer = collector.startTimer("block.processing");
 */
class MetricsCollector {
    /**
     * Creates a new MetricsCollector instance
     * @param {string} namespace - Metrics namespace
     * @param {number} [flushIntervalMs=60000] - Metrics flush interval in milliseconds
     * @throws {Error} If namespace is not provided
     */
    constructor(namespace, flushIntervalMs = 60000) {
        this.FLUSH_INTERVAL_MS = 60000; // 1 minute default
        if (!namespace) {
            throw new Error("Namespace is required");
        }
        this.namespace = namespace;
        this.metrics = new Map();
        this.timers = new Map();
        this.eventEmitter = new events_1.EventEmitter();
        // Validate flush interval
        if (flushIntervalMs < 1000) {
            shared_1.Logger.warn("Flush interval too low, setting to 1 second minimum");
            flushIntervalMs = 1000;
        }
        this.flushInterval = setInterval(() => this.flush(), flushIntervalMs);
    }
    /**
     * Increments a metric counter
     * @param {string} metric - Metric name
     * @param {number} [value=1] - Increment value
     */
    increment(metric, value = 1) {
        if (!metric) {
            shared_1.Logger.error("Invalid metric name");
            return;
        }
        try {
            const key = `${this.namespace}.${metric}`;
            const currentValue = this.metrics.get(key) || 0;
            this.metrics.set(key, currentValue + value);
        }
        catch (error) {
            shared_1.Logger.error(`Failed to increment metric ${metric}:`, error);
        }
    }
    /**
     * Sets a gauge metric value
     * @param {string} metric - Metric name
     * @param {number | (() => number)} value - Gauge value or value provider function
     */
    gauge(metric, value) {
        if (!metric) {
            shared_1.Logger.error("Invalid metric name");
            return;
        }
        try {
            const key = `${this.namespace}.${metric}`;
            const actualValue = typeof value === "function" ? value() : value;
            if (typeof actualValue !== "number" || isNaN(actualValue)) {
                throw new Error("Invalid gauge value");
            }
            this.metrics.set(key, actualValue);
        }
        catch (error) {
            shared_1.Logger.error(`Failed to set gauge ${metric}:`, error);
        }
    }
    /**
     * Starts a timer for duration measurement
     * @param {string} metric - Metric name
     * @returns {() => number} Timer stop function that returns duration
     */
    startTimer(metric) {
        if (!metric) {
            shared_1.Logger.error("Invalid metric name");
            return () => 0;
        }
        const start = Date.now();
        const key = `${this.namespace}.${metric}`;
        this.timers.set(key, start);
        return () => {
            try {
                const duration = Date.now() - start;
                this.metrics.set(key, duration);
                this.timers.delete(key); // Clean up timer
                return duration;
            }
            catch (error) {
                shared_1.Logger.error(`Failed to stop timer ${metric}:`, error);
                return 0;
            }
        };
    }
    /**
     * Records a histogram value
     * @param {string} metric - Metric name
     * @param {number} value - Histogram value
     * @param {Record<string, string>} [labels] - Optional metric labels
     */
    histogram(metric, value, labels) {
        if (!metric || typeof value !== "number" || isNaN(value)) {
            shared_1.Logger.error("Invalid histogram parameters");
            return;
        }
        try {
            const key = `${this.namespace}.${metric}${labels ? `.${labels.stat}` : ""}`;
            this.metrics.set(key, value);
        }
        catch (error) {
            shared_1.Logger.error(`Failed to update histogram ${metric}:`, error);
        }
    }
    /**
     * Flushes collected metrics
     * @returns {Promise<void>}
     * @private
     */
    async flush() {
        try {
            const metricsData = Array.from(this.metrics.entries()).map(([key, value]) => ({
                name: key,
                value,
                timestamp: Date.now(),
                type: this.timers.has(key) ? "timer" : "counter",
            }));
            if (metricsData.length > 0) {
                this.eventEmitter.emit("metrics", metricsData);
            }
            this.metrics.clear();
            this.timers.clear();
        }
        catch (error) {
            shared_1.Logger.error("Failed to flush metrics:", error);
        }
    }
    /**
     * Emits block-related metrics
     * @param {Block} block - Block to measure
     * @param {number} duration - Block processing duration
     */
    emitMetrics(block, duration) {
        if (!block || !block.header || typeof duration !== "number") {
            shared_1.Logger.error("Invalid block metrics parameters");
            return;
        }
        try {
            const blockSize = this.calculateBlockSize(block);
            this.histogram("block_processing_time", duration);
            this.gauge("block_height", block.header.height);
            this.gauge("block_size", blockSize);
            this.histogram("transactions_per_block", block.transactions.length);
        }
        catch (error) {
            shared_1.Logger.error("Failed to emit block metrics:", error);
        }
    }
    /**
     * Cleans up collector resources
     */
    dispose() {
        try {
            if (this.flushInterval) {
                clearInterval(this.flushInterval);
            }
            this.eventEmitter.removeAllListeners();
            this.metrics.clear();
            this.timers.clear();
        }
        catch (error) {
            shared_1.Logger.error("Failed to dispose metrics collector:", error);
        }
    }
    calculateBlockSize(block) {
        if (!block || !block.header || !Array.isArray(block.transactions)) {
            throw new Error("Invalid block structure");
        }
        try {
            const headerSize = this.calculateHeaderSize(block.header);
            return (headerSize +
                this.calculateVarIntSize(block.transactions.length) +
                block.transactions.reduce((size, tx) => size + this.calculateTransactionSize(tx), 0));
        }
        catch (error) {
            shared_1.Logger.error("Failed to calculate block size:", error);
            return 0;
        }
    }
    calculateHeaderSize(header) {
        // Serialize header data according to protocol specification
        const serializedHeader = Buffer.concat([
            Buffer.from(header.version.toString(16).padStart(8, "0"), "hex"),
            Buffer.from(header.previousHash, "hex"),
            Buffer.from(header.merkleRoot, "hex"),
            Buffer.from(header.timestamp.toString(16).padStart(8, "0"), "hex"),
            Buffer.from(header.difficulty.toString(16).padStart(8, "0"), "hex"),
            Buffer.from(header.nonce.toString(16).padStart(8, "0"), "hex"),
        ]);
        return serializedHeader.length;
    }
    calculateTransactionSize(tx) {
        return (this.calculateVarIntSize(tx.version) +
            this.calculateVarIntSize(tx.inputs.length) +
            tx.inputs.reduce((size, input) => size + this.calculateInputSize(input), 0) +
            this.calculateVarIntSize(tx.outputs.length) +
            tx.outputs.reduce((size, output) => size + this.calculateOutputSize(output), 0) +
            this.calculateVarIntSize(tx.lockTime));
    }
    calculateVarIntSize(value) {
        if (value < 0xfd)
            return 1;
        if (value <= 0xffff)
            return 3;
        if (value <= 0xffffffff)
            return 5;
        return 9;
    }
    calculateInputSize(input) {
        return (Buffer.from(input.txId, "hex").length +
            this.calculateVarIntSize(input.outputIndex) +
            this.calculateVarIntSize(input.script.length) +
            input.script.length +
            this.calculateVarIntSize(input.confirmations));
    }
    calculateOutputSize(output) {
        return (this.calculateVarIntSize(Number(output.amount)) +
            this.calculateVarIntSize(output.script.length) +
            output.script.length);
    }
    /**
     * Sets a labeled gauge metric
     * @param {string} metric - Metric name
     * @param {number} value - Gauge value
     * @param {string} label - Metric label
     */
    setGauge(metric, value, label) {
        if (!metric || !label) {
            shared_1.Logger.error("Invalid gauge parameters");
            return;
        }
        try {
            const key = `${this.namespace}.${metric}.${label}`;
            if (typeof value !== "number" || isNaN(value)) {
                throw new Error("Invalid gauge value");
            }
            this.metrics.set(key, value);
        }
        catch (error) {
            shared_1.Logger.error(`Failed to set labeled gauge ${metric}:`, error);
        }
    }
    /**
     * Creates a counter metric
     * @param {string} metric - Metric name
     * @returns {Object} Counter object with increment method
     */
    counter(metric) {
        if (!metric) {
            shared_1.Logger.error("Invalid counter metric name");
            return { inc: () => { } }; // Return no-op function
        }
        return {
            inc: (labels) => {
                try {
                    const key = `${this.namespace}.${metric}${labels ? `.${labels.stat}` : ""}`;
                    this.increment(key);
                }
                catch (error) {
                    shared_1.Logger.error(`Failed to increment counter ${metric}:`, error);
                }
            },
        };
    }
}
exports.MetricsCollector = MetricsCollector;
