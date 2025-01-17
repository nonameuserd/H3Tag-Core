import winston from 'winston';
export declare class MonitoringError extends Error {
    constructor(message: string);
}
export declare class Monitoring {
    private metrics;
    logger: winston.Logger;
    private timers;
    private responseTimeHistogram;
    private readonly mutex;
    constructor();
    updateMetrics(data: {
        powNodes?: number;
        hashrate?: number;
        blockTime?: number;
        difficulty?: number;
        voterParticipation?: number;
    }): Promise<void>;
    shutdown(): Promise<void>;
    startTimer(label: string): {
        end: () => number;
    };
    recordResponseTime(method: string, path: string, duration: number): void;
    updateActiveNodes(count: number): void;
    updateNetworkMetrics(totalHashPower: number, totalNodes: number): void;
}
