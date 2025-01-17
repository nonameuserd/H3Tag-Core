export declare class MiningMetrics {
    totalBlocks: number;
    successfulBlocks: number;
    lastMiningTime: number;
    averageHashRate: number;
    totalTAGMined: number;
    currentBlockReward: number;
    tagTransactionsCount: number;
    timestamp: bigint;
    blockHeight: number;
    hashRate: number;
    difficulty: number;
    blockTime: number;
    tagVolume: number;
    tagFees: number;
    lastBlockTime: number;
    syncedHeaders: number;
    syncedBlocks: number;
    whitelistedPeers: number;
    blacklistedPeers: number;
    private static instance;
    private metrics;
    private readonly mutex;
    private constructor();
    static getInstance(): MiningMetrics;
    updateMetrics(data: {
        hashRate?: number;
        difficulty?: number;
        blockTime?: number;
        tagVolume?: number;
        tagFees?: number;
    }): Promise<void>;
    private cleanupOldMetrics;
    getAverageHashRate(timeWindow?: number): number;
    /**
     * Get average TAG volume over specified time window
     * @param timeWindow Time window in milliseconds (default: 1 hour)
     * @returns Average TAG volume or 0 if no data
     */
    getAverageTAGVolume(timeWindow?: number): number;
    /**
     * Get average TAG transaction fees over specified time window
     * @param timeWindow Time window in milliseconds (default: 1 hour)
     * @returns Average TAG fees or 0 if no data
     */
    getAverageTAGFees(timeWindow?: number): number;
    recordError(context: string): void;
    gauge(name: string, value: number): void;
    recordFailedMine(reason: string): void;
    recordSuccessfulMine(): void;
}
