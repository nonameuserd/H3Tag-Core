interface CircuitBreakerConfig {
    failureThreshold: number;
    resetTimeout: number;
    halfOpenTimeout?: number;
    monitorInterval?: number;
}
export declare class CircuitBreaker {
    private failures;
    private lastFailureTime;
    private state;
    private readonly config;
    private monitorInterval;
    constructor(config: CircuitBreakerConfig);
    isOpen(): boolean;
    recordSuccess(): void;
    recordFailure(): void;
    private monitor;
    dispose(): void;
    isAvailable(): boolean;
    onSuccess(): void;
    onFailure(): void;
    reset(): Promise<void>;
}
export {};
