import { BlockchainSchema } from "../database/blockchain-schema";
import { Transaction } from "../models/transaction.model";
interface ShardConfig {
    shardCount: number;
    votingShards: number;
    powShards: number;
    maxShardSize: number;
    replicationFactor: number;
    reshardThreshold: number;
    syncInterval: number;
}
export declare class ShardManager {
    private readonly config;
    private readonly db;
    private readonly shards;
    private readonly shardMetrics;
    private readonly mutex;
    private readonly eventEmitter;
    private readonly cache;
    private readonly performanceMonitor;
    private readonly auditManager;
    private readonly metricsCollector;
    private syncTimer?;
    private readonly circuitBreaker;
    private maintenanceTimer?;
    private readonly MAINTENANCE_INTERVAL;
    constructor(config: ShardConfig, db: BlockchainSchema);
    /**
     * Initialize shard structure
     */
    private initializeShards;
    /**
     * Get shard for transaction
     */
    private getShardForTransaction;
    /**
     * Update metrics for a shard
     */
    private updateShardMetrics;
    /**
     * Check if resharding is needed
     */
    private checkResharding;
    /**
     * Perform resharding of overloaded shard
     */
    private performResharding;
    /**
     * Start periodic shard sync
     */
    private startSyncTimer;
    /**
     * Sync shards with database
     */
    private syncShards;
    /**
     * Create initial metrics for new shard
     */
    private createInitialMetrics;
    /**
     * Clean up resources
     */
    dispose(): void;
    getTransaction(hash: string): Promise<Transaction | undefined>;
    private cleanupStaleData;
    private isCircuitBreakerOpen;
    private recordFailure;
    private warmCache;
    healthCheck(): Promise<boolean>;
    private rebalanceShards;
    private startMaintenanceTasks;
}
export {};
