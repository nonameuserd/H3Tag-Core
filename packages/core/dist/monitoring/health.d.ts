interface HealthMonitorConfig {
    interval: number;
    thresholds: {
        minPowHashrate?: number;
        minPowNodes?: number;
        minTagDistribution?: number;
        maxTagConcentration?: number;
    };
}
export declare class HealthMonitor {
    private readonly eventEmitter;
    private dnsSeeder;
    readonly config: HealthMonitorConfig;
    constructor(config: HealthMonitorConfig);
    getNetworkHealth(): Promise<{
        powNodeCount: number;
        votingNodeCount: number;
        networkHashrate: number;
        tagHolderCount: number;
        tagDistribution: number;
        isHealthy: boolean;
    }>;
    dispose(): Promise<void>;
}
export {};
