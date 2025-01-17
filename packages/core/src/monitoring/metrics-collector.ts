import { EventEmitter } from "events";
import { Logger } from "@h3tag-blockchain/shared";
import { Block, BlockHeader } from "../models/block.model";
import { Transaction, TxInput, TxOutput } from "../models/transaction.model";

export class MetricsCollector {
  private metrics: Map<string, number>;
  private timers: Map<string, number>;
  private readonly eventEmitter: EventEmitter;
  private readonly namespace: string;
  private flushInterval: NodeJS.Timeout;

  constructor(namespace: string, flushIntervalMs: number = 60000) {
    this.namespace = namespace;
    this.metrics = new Map();
    this.timers = new Map();
    this.eventEmitter = new EventEmitter();

    this.flushInterval = setInterval(() => this.flush(), flushIntervalMs);
  }

  increment(metric: string, value: number = 1): void {
    const key = `${this.namespace}.${metric}`;
    this.metrics.set(key, (this.metrics.get(key) || 0) + value);
  }

  gauge(metric: string, value: number | (() => number)): void {
    const key = `${this.namespace}.${metric}`;
    const actualValue = typeof value === "function" ? value() : value;
    this.metrics.set(key, actualValue);
  }

  startTimer(metric: string): () => number {
    const start = Date.now();
    const key = `${this.namespace}.${metric}`;
    this.timers.set(key, start);

    return () => {
      const duration = Date.now() - start;
      this.metrics.set(key, duration);
      return duration;
    };
  }

  histogram(
    metric: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    const key = `${this.namespace}.${metric}${labels ? `.${labels.stat}` : ""}`;
    this.metrics.set(key, value);
  }

  setGauge(metric: string, value: number, label: string): void {
    const key = `${this.namespace}.${metric}.${label}`;
    this.metrics.set(key, value);
  }

  counter(metric: string): { inc: (labels?: Record<string, string>) => void } {
    return {
      inc: (labels?: Record<string, string>) => {
        const key = `${this.namespace}.${metric}${
          labels ? `.${labels.stat}` : ""
        }`;
        this.increment(key);
      },
    };
  }

  private flush(): void {
    try {
      const metricsData = Array.from(this.metrics.entries()).map(
        ([key, value]) => ({
          name: key,
          value,
          timestamp: Date.now(),
          type: this.timers.has(key) ? "timer" : "counter",
        })
      );

      this.eventEmitter.emit("metrics", metricsData);
      this.metrics.clear();
      this.timers.clear();
    } catch (error) {
      Logger.error("Failed to flush metrics:", error);
    }
  }

  dispose(): void {
    clearInterval(this.flushInterval);
    this.eventEmitter.removeAllListeners();
    this.metrics.clear();
    this.timers.clear();
  }

  public observe(metric: string, value: number): void {
    try {
      this.metrics.set(metric, value);
      this.eventEmitter.emit("metric", {
        name: metric,
        value,
        type: "observation",
      });
    } catch (error) {
      Logger.error(`Failed to observe metric ${metric}:`, error);
    }
  }

  public emitMetrics(block: Block, duration: number): void {
    const blockSize = this.calculateBlockSize(block);

    this.histogram("block_processing_time", duration);
    this.gauge("block_height", block.header.height);
    this.gauge("block_size", blockSize);
    this.histogram("transactions_per_block", block.transactions.length);
  }

  private calculateBlockSize(block: Block): number {
    const headerSize = this.calculateHeaderSize(block.header);
    return (
      headerSize +
      this.calculateVarIntSize(block.transactions.length) +
      block.transactions.reduce(
        (size, tx) => size + this.calculateTransactionSize(tx),
        0
      )
    );
  }

  private calculateHeaderSize(header: BlockHeader): number {
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

  private calculateTransactionSize(tx: Transaction): number {
    return (
      this.calculateVarIntSize(tx.version) +
      this.calculateVarIntSize(tx.inputs.length) +
      tx.inputs.reduce(
        (size, input) => size + this.calculateInputSize(input),
        0
      ) +
      this.calculateVarIntSize(tx.outputs.length) +
      tx.outputs.reduce(
        (size, output) => size + this.calculateOutputSize(output),
        0
      ) +
      this.calculateVarIntSize(tx.lockTime)
    );
  }

  private calculateVarIntSize(value: number): number {
    if (value < 0xfd) return 1;
    if (value <= 0xffff) return 3;
    if (value <= 0xffffffff) return 5;
    return 9;
  }

  private calculateInputSize(input: TxInput): number {
    return (
      Buffer.from(input.txId, "hex").length +
      this.calculateVarIntSize(input.outputIndex) +
      this.calculateVarIntSize(input.script.length) +
      input.script.length +
      this.calculateVarIntSize(input.confirmations)
    );
  }

  private calculateOutputSize(output: TxOutput): number {
    return (
      this.calculateVarIntSize(Number(output.amount)) +
      this.calculateVarIntSize(output.script.length) +
      output.script.length
    );
  }
}
