export declare class PerformanceMetrics {
    private static instance;
    private readonly mutex;
    private metrics;
    private constructor();
    static getInstance(): PerformanceMetrics;
    recordMetric(operation: string, duration: number, metadata: {
        context: string;
        [key: string]: any;
    }): Promise<void>;
    private cleanupOldMetrics;
    getMetrics(context?: string): Record<string, {
        average: number;
        count: number;
        totalDuration: number;
        maxDuration: number;
        minDuration: number;
        last24Hours: number[];
    }>;
}
