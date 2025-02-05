import { EventEmitter } from 'events';
import { Logger } from '@h3tag-blockchain/shared';
import { Block, BlockHeader } from '../models/block.model';
import { Transaction, TxInput, TxOutput } from '../models/transaction.model';

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
export class MetricsCollector {
  private metrics: Map<string, number>;
  private timers: Map<string, number>;
  private readonly eventEmitter: EventEmitter;
  private readonly namespace: string;
  private flushInterval: NodeJS.Timeout | null;
  private readonly FLUSH_INTERVAL_MS = 60000; // 1 minute default
  private isFlushing: boolean = false;

  /**
   * Creates a new MetricsCollector instance
   * @param {string} namespace - Metrics namespace
   * @param {number} [flushIntervalMs=60000] - Metrics flush interval in milliseconds
   * @throws {Error} If namespace is not provided
   */
  constructor(namespace: string, flushIntervalMs: number = 60000) {
    if (!namespace) {
      throw new Error('Namespace is required');
    }

    this.namespace = namespace;
    this.metrics = new Map();
    this.timers = new Map();
    this.eventEmitter = new EventEmitter();

    // Validate flush interval to be at least 1 second.
    if (flushIntervalMs < 1000) {
      Logger.warn('Flush interval too low, setting to 1 second minimum');
      flushIntervalMs = 1000;
    }

    this.flushInterval = setInterval(() => {
      void this.flush();
    }, flushIntervalMs);
  }

  /**
   * Increments a metric counter
   * @param {string} metric - Metric name
   * @param {number} [value=1] - Increment value
   */
  increment(metric: string, value: number = 1): void {
    if (!metric) {
      Logger.error('Invalid metric name');
      return;
    }

    try {
      const key = `${this.namespace}.${metric}`;
      const currentValue = this.metrics.get(key) || 0;
      this.metrics.set(key, currentValue + value);
    } catch (error) {
      Logger.error(`Failed to increment metric ${metric}:`, error);
    }
  }

  /**
   * Sets a gauge metric value
   * @param {string} metric - Metric name
   * @param {number | (() => number)} value - Gauge value or value provider function
   */
  gauge(metric: string, value: number | (() => number)): void {
    if (!metric) {
      Logger.error('Invalid metric name');
      return;
    }

    try {
      const key = `${this.namespace}.${metric}`;
      const actualValue = typeof value === 'function' ? value() : value;

      if (typeof actualValue !== 'number' || isNaN(actualValue)) {
        throw new Error('Invalid gauge value');
      }

      this.metrics.set(key, actualValue);
    } catch (error) {
      Logger.error(`Failed to set gauge ${metric}:`, error);
    }
  }

  /**
   * Starts a timer for duration measurement
   * @param {string} metric - Metric name
   * @returns {() => number} Timer stop function that returns duration
   */
  startTimer(metric: string): () => number {
    if (!metric) {
      Logger.error('Invalid metric name');
      return () => 0;
    }

    const timerKey = `${this.namespace}.${metric}`;
    const startTime = Date.now();
    this.timers.set(timerKey, startTime);

    return () => {
      try {
        const currentTime = Date.now();
        const start = this.timers.get(timerKey);
        if (start === undefined) {
          Logger.warn(
            `Timer for ${timerKey} not found. It might have already been stopped.`,
          );
          return 0;
        }
        const duration = currentTime - start;
        this.metrics.set(timerKey, duration);
        this.timers.delete(timerKey);
        return duration;
      } catch (error) {
        Logger.error(`Failed to stop timer for ${timerKey}:`, error);
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
  histogram(
    metric: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    if (!metric || typeof value !== 'number' || isNaN(value)) {
      Logger.error('Invalid histogram parameters');
      return;
    }

    try {
      const labelSuffix = labels && labels.stat ? `.${labels.stat}` : '';
      const key = `${this.namespace}.${metric}${labelSuffix}`;
      this.metrics.set(key, value);
    } catch (error) {
      Logger.error(`Failed to update histogram ${metric}:`, error);
    }
  }

  /**
   * Flushes collected metrics
   * @returns {Promise<void>}
   * @private
   */
  private async flush(): Promise<void> {
    try {
      if (this.metrics.size > 0) {
        Logger.info('Flushing metrics:', Array.from(this.metrics.entries()));
        this.metrics.clear();
      }
    } catch (error) {
      Logger.error('Error during flushing metrics:', error);
    }
  }

  /**
   * Emits block-related metrics
   * @param {Block} block - Block to measure
   * @param {number} duration - Block processing duration
   */
  public emitMetrics(block: Block, duration: number): void {
    if (!block || !block.header || typeof duration !== 'number') {
      Logger.error('Invalid block metrics parameters');
      return;
    }

    try {
      const blockSize = this.calculateBlockSize(block);

      this.histogram('block_processing_time', duration);
      this.gauge('block_height', block.header.height);
      this.gauge('block_size', blockSize);
      this.histogram('transactions_per_block', block.transactions.length);
    } catch (error) {
      Logger.error('Failed to emit block metrics:', error);
    }
  }

  /**
   * Cleans up collector resources
   */
  dispose(): void {
    try {
      if (this.flushInterval) {
        clearInterval(this.flushInterval);
      }
      this.eventEmitter.removeAllListeners();
      this.metrics.clear();
      this.timers.clear();
    } catch (error) {
      Logger.error('Failed to dispose metrics collector:', error);
    }
  }

  private calculateBlockSize(block: Block): number {
    if (!block || !block.header || !Array.isArray(block.transactions)) {
      throw new Error('Invalid block structure');
    }

    try {
      const headerSize = this.calculateHeaderSize(block.header);
      return (
        headerSize +
        this.calculateVarIntSize(block.transactions.length) +
        block.transactions.reduce(
          (size, tx) => size + this.calculateTransactionSize(tx),
          0,
        )
      );
    } catch (error) {
      Logger.error('Failed to calculate block size:', error);
      return 0;
    }
  }

  private calculateHeaderSize(header: BlockHeader): number {
    // Serialize header data according to protocol specification
    const serializedHeader = Buffer.concat([
      Buffer.from(header.version.toString(16).padStart(8, '0'), 'hex'),
      Buffer.from(header.previousHash, 'hex'),
      Buffer.from(header.merkleRoot, 'hex'),
      Buffer.from(header.timestamp.toString(16).padStart(8, '0'), 'hex'),
      Buffer.from(header.difficulty.toString(16).padStart(8, '0'), 'hex'),
      Buffer.from(header.nonce.toString(16).padStart(8, '0'), 'hex'),
    ]);

    return serializedHeader.length;
  }

  private calculateTransactionSize(tx: Transaction): number {
    return (
      this.calculateVarIntSize(tx.version) +
      this.calculateVarIntSize(tx.inputs.length) +
      tx.inputs.reduce(
        (size, input) => size + this.calculateInputSize(input),
        0,
      ) +
      this.calculateVarIntSize(tx.outputs.length) +
      tx.outputs.reduce(
        (size, output) => size + this.calculateOutputSize(output),
        0,
      ) +
      this.calculateVarIntSize(tx.lockTime || 0)
    );
  }

  private calculateVarIntSize(value: number): number {
    if (value < 0) {
      throw new Error('Negative value is not allowed for varInt calculation');
    }
    if (value < 0xfd) return 1;
    if (value <= 0xffff) return 3;
    if (value <= 0xffffffff) return 5;
    return 9;
  }

  private calculateInputSize(input: TxInput): number {
    try {
      // Convert hex string to a Buffer to measure script byte length accurately.
      const scriptBuffer = Buffer.from(input.script, 'hex');
      const scriptLength = scriptBuffer.length;
      return (
        Buffer.from(input.txId, 'hex').length +
        this.calculateVarIntSize(input.outputIndex) +
        this.calculateVarIntSize(scriptLength) +
        scriptLength +
        this.calculateVarIntSize(input.confirmations)
      );
    } catch (error) {
      Logger.error('Failed to calculate input size:', error);
      return 0;
    }
  }

  private calculateOutputSize(output: TxOutput): number {
    try {
      const scriptBuffer = Buffer.from(output.script, 'hex');
      const scriptLength = scriptBuffer.length;
      return (
        this.calculateVarIntSize(Number(output.amount)) +
        this.calculateVarIntSize(scriptLength) +
        scriptLength
      );
    } catch (error) {
      Logger.error('Failed to calculate output size:', error);
      return 0;
    }
  }

  /**
   * Sets a labeled gauge metric
   * @param {string} metric - Metric name
   * @param {number} value - Gauge value
   * @param {string} label - Metric label
   */
  setGauge(metric: string, value: number, label: string): void {
    if (!metric || !label) {
      Logger.error('Invalid gauge parameters');
      return;
    }

    try {
      const key = `${this.namespace}.${metric}.${label}`;
      if (typeof value !== 'number' || isNaN(value)) {
        throw new Error('Invalid gauge value');
      }
      this.metrics.set(key, value);
    } catch (error) {
      Logger.error(`Failed to set labeled gauge ${metric}:`, error);
    }
  }

  /**
   * Creates a counter metric
   * @param {string} metric - Metric name
   * @returns {Object} Counter object with increment method
   */
  counter(metric: string): { inc: (labels?: Record<string, string>) => void } {
    if (!metric) {
      Logger.error('Invalid counter metric name');
      return { inc: () => {} }; // Return no-op function
    }

    return {
      inc: (labels?: Record<string, string>) => {
        try {
          const labelSuffix = labels && labels.stat ? `.${labels.stat}` : '';
          // Pass metric with its label suffix to increment(), which applies the namespace.
          this.increment(`${metric}${labelSuffix}`);
        } catch (error) {
          Logger.error(`Failed to increment counter ${metric}:`, error);
        }
      },
    };
  }

  /**
   * Cleans up metrics collector resources
   */
  cleanup(): void {
    this.metrics.clear();
    this.timers.clear();
  }
}
