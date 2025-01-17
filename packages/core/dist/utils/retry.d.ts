interface RetryConfig {
    maxAttempts: number;
    delay: number;
    exponentialBackoff?: boolean;
    maxDelay?: number;
    retryableErrors?: Array<string | RegExp>;
    jitterFactor?: number;
}
export declare function retry(config: RetryConfig): (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export declare class RetryStrategy {
    private config;
    private stats;
    constructor(config: RetryConfig);
    execute<T>(fn: () => Promise<T>): Promise<T>;
    getStats(): {
        attempts: number;
        successes: number;
        failures: number;
        lastAttempt: number;
        averageDelay: number;
    };
}
export {};
