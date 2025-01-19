import { Block } from "../models/block.model";
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
export declare class MetricsCollector {
    private metrics;
    private timers;
    private readonly eventEmitter;
    private readonly namespace;
    private flushInterval;
    private readonly FLUSH_INTERVAL_MS;
    /**
     * Creates a new MetricsCollector instance
     * @param {string} namespace - Metrics namespace
     * @param {number} [flushIntervalMs=60000] - Metrics flush interval in milliseconds
     * @throws {Error} If namespace is not provided
     */
    constructor(namespace: string, flushIntervalMs?: number);
    /**
     * Increments a metric counter
     * @param {string} metric - Metric name
     * @param {number} [value=1] - Increment value
     */
    increment(metric: string, value?: number): void;
    /**
     * Sets a gauge metric value
     * @param {string} metric - Metric name
     * @param {number | (() => number)} value - Gauge value or value provider function
     */
    gauge(metric: string, value: number | (() => number)): void;
    /**
     * Starts a timer for duration measurement
     * @param {string} metric - Metric name
     * @returns {() => number} Timer stop function that returns duration
     */
    startTimer(metric: string): () => number;
    /**
     * Records a histogram value
     * @param {string} metric - Metric name
     * @param {number} value - Histogram value
     * @param {Record<string, string>} [labels] - Optional metric labels
     */
    histogram(metric: string, value: number, labels?: Record<string, string>): void;
    /**
     * Flushes collected metrics
     * @returns {Promise<void>}
     * @private
     */
    private flush;
    /**
     * Emits block-related metrics
     * @param {Block} block - Block to measure
     * @param {number} duration - Block processing duration
     */
    emitMetrics(block: Block, duration: number): void;
    /**
     * Cleans up collector resources
     */
    dispose(): void;
    private calculateBlockSize;
    private calculateHeaderSize;
    private calculateTransactionSize;
    private calculateVarIntSize;
    private calculateInputSize;
    private calculateOutputSize;
    /**
     * Sets a labeled gauge metric
     * @param {string} metric - Metric name
     * @param {number} value - Gauge value
     * @param {string} label - Metric label
     */
    setGauge(metric: string, value: number, label: string): void;
    /**
     * Creates a counter metric
     * @param {string} metric - Metric name
     * @returns {Object} Counter object with increment method
     */
    counter(metric: string): {
        inc: (labels?: Record<string, string>) => void;
    };
}
