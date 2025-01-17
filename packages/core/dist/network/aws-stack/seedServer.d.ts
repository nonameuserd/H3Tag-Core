export declare class SeedServer {
    private knownNodes;
    private readonly port;
    private readonly regions;
    private healthCheckInterval;
    private cloudWatch;
    private route53;
    private readonly merkleTree;
    constructor(port?: number);
    private publishMetrics;
    private updateHealthCheck;
    private checkNodeHealth;
    private updateNodeList;
    private setupIntervals;
    start(): Promise<void>;
    shutdown(): Promise<void>;
}
