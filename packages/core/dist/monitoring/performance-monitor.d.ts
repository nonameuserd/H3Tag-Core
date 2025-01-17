export declare class PerformanceMonitor {
    private readonly context;
    private metrics;
    private readonly MAX_MEASUREMENTS;
    private readonly ALERT_THRESHOLD_MS;
    private readonly metricsClient;
    constructor(context: string);
    start(operation: string): string;
    end(markerId: string): Promise<void>;
    private calculateStats;
    getMetrics(operation?: string): {
        [key: string]: {
            current: number;
            average: number;
            p95: number;
            p99: number;
        };
    };
    reset(): void;
    dispose(): Promise<void>;
}
