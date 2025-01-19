export declare class ErrorMonitor {
    private readonly windowSize;
    private readonly errorCounts;
    private readonly errorThresholds;
    private readonly alertCallbacks;
    constructor(windowSize?: number);
    record(type: string, error: Error): void;
    setThreshold(type: string, threshold: number): void;
    onThresholdExceeded(callback: (type: string, count: number) => void): void;
    private cleanup;
}
