"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsCollector = void 0;
const events_1 = require("events");
const shared_1 = require("@h3tag-blockchain/shared");
class MetricsCollector {
    constructor(namespace, flushIntervalMs = 60000) {
        this.namespace = namespace;
        this.metrics = new Map();
        this.timers = new Map();
        this.eventEmitter = new events_1.EventEmitter();
        this.flushInterval = setInterval(() => this.flush(), flushIntervalMs);
    }
    increment(metric, value = 1) {
        const key = `${this.namespace}.${metric}`;
        this.metrics.set(key, (this.metrics.get(key) || 0) + value);
    }
    gauge(metric, value) {
        const key = `${this.namespace}.${metric}`;
        const actualValue = typeof value === "function" ? value() : value;
        this.metrics.set(key, actualValue);
    }
    startTimer(metric) {
        const start = Date.now();
        const key = `${this.namespace}.${metric}`;
        this.timers.set(key, start);
        return () => {
            const duration = Date.now() - start;
            this.metrics.set(key, duration);
            return duration;
        };
    }
    histogram(metric, value, labels) {
        const key = `${this.namespace}.${metric}${labels ? `.${labels.stat}` : ""}`;
        this.metrics.set(key, value);
    }
    setGauge(metric, value, label) {
        const key = `${this.namespace}.${metric}.${label}`;
        this.metrics.set(key, value);
    }
    counter(metric) {
        return {
            inc: (labels) => {
                const key = `${this.namespace}.${metric}${labels ? `.${labels.stat}` : ""}`;
                this.increment(key);
            },
        };
    }
    flush() {
        try {
            const metricsData = Array.from(this.metrics.entries()).map(([key, value]) => ({
                name: key,
                value,
                timestamp: Date.now(),
                type: this.timers.has(key) ? "timer" : "counter",
            }));
            this.eventEmitter.emit("metrics", metricsData);
            this.metrics.clear();
            this.timers.clear();
        }
        catch (error) {
            shared_1.Logger.error("Failed to flush metrics:", error);
        }
    }
    dispose() {
        clearInterval(this.flushInterval);
        this.eventEmitter.removeAllListeners();
        this.metrics.clear();
        this.timers.clear();
    }
    observe(metric, value) {
        try {
            this.metrics.set(metric, value);
            this.eventEmitter.emit("metric", {
                name: metric,
                value,
                type: "observation",
            });
        }
        catch (error) {
            shared_1.Logger.error(`Failed to observe metric ${metric}:`, error);
        }
    }
    emitMetrics(block, duration) {
        const blockSize = this.calculateBlockSize(block);
        this.histogram("block_processing_time", duration);
        this.gauge("block_height", block.header.height);
        this.gauge("block_size", blockSize);
        this.histogram("transactions_per_block", block.transactions.length);
    }
    calculateBlockSize(block) {
        const headerSize = this.calculateHeaderSize(block.header);
        return (headerSize +
            this.calculateVarIntSize(block.transactions.length) +
            block.transactions.reduce((size, tx) => size + this.calculateTransactionSize(tx), 0));
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
}
exports.MetricsCollector = MetricsCollector;
//# sourceMappingURL=metrics-collector.js.map