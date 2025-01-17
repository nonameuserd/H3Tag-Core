import { Block } from '../models/block.model';
export declare class MetricsCollector {
    private metrics;
    private timers;
    private readonly eventEmitter;
    private readonly namespace;
    private flushInterval;
    constructor(namespace: string, flushIntervalMs?: number);
    increment(metric: string, value?: number): void;
    gauge(metric: string, value: number | (() => number)): void;
    startTimer(metric: string): () => number;
    histogram(metric: string, value: number, labels?: Record<string, string>): void;
    setGauge(metric: string, value: number, label: string): void;
    counter(metric: string): {
        inc: (labels?: Record<string, string>) => void;
    };
    private flush;
    dispose(): void;
    observe(metric: string, value: number): void;
    emitMetrics(block: Block, duration: number): void;
    private calculateBlockSize;
    private calculateHeaderSize;
    private calculateTransactionSize;
    private calculateVarIntSize;
    private calculateInputSize;
    private calculateOutputSize;
}
