import { Logger } from '@h3tag-blockchain/shared';
import { BlockchainSchema } from '../database/blockchain-schema';
import { Transaction } from '../models/transaction.model';
import { Cache } from './cache';
import { Mutex } from 'async-mutex';
import { EventEmitter } from 'events';
import { AuditManager, AuditEventType } from '../security/audit';
import { PerformanceMonitor } from '../monitoring/performance-monitor';
import { retry } from '../utils/retry';
import { MetricsCollector } from '../monitoring/metrics-collector';
import { BLOCKCHAIN_CONSTANTS } from '../blockchain/utils/constants';

interface ShardConfig {
  shardCount: number;
  votingShards: number;
  powShards: number;
  maxShardSize: number;
  replicationFactor: number;
  reshardThreshold: number;
  syncInterval: number;
}

interface ShardMetrics {
  size: number;
  transactions: number;
  lastAccess: number;
  loadFactor: number;
}

export class ShardManager {
  private readonly shards: Map<number, Set<string>>;
  private readonly shardMetrics: Map<number, ShardMetrics>;
  private readonly mutex = new Mutex();
  private readonly eventEmitter = new EventEmitter();
  private readonly cache: Cache<Transaction>;
  private readonly performanceMonitor: PerformanceMonitor;
  private readonly auditManager: AuditManager;
  private readonly metricsCollector: MetricsCollector | undefined;
  private syncTimer?: NodeJS.Timeout;
  private readonly circuitBreaker = {
    failures: 0,
    lastFailure: 0,
    threshold: 5,
    resetTimeout: 60000,
  };
  private maintenanceTimer?: NodeJS.Timeout;
  private readonly MAINTENANCE_INTERVAL = 3600000; // 1 hour

  constructor(
    private readonly config: ShardConfig,
    private readonly db: BlockchainSchema,
  ) {
    this.shards = new Map();
    this.shardMetrics = new Map();
    this.performanceMonitor = new PerformanceMonitor('shard_manager');
    this.auditManager = new AuditManager();
    this.cache = new Cache({
      ttl: 300000, // 5 minutes
      maxSize: 10000,
      compression: true,
    });

    // Initialize shards
    this.initializeShards();

    // Start sync timer
    this.startSyncTimer();

    // Start maintenance tasks
    this.startMaintenanceTasks();
  }

  /**
   * Initialize shard structure
   */
  private async initializeShards(): Promise<void> {
    try {
      // Create voting shards
      for (let i = 0; i < this.config.votingShards; i++) {
        this.shards.set(i, new Set());
        this.shardMetrics.set(i, this.createInitialMetrics());
      }
      // Create PoW shards using the powShards field
      const powShardCount = this.config.powShards;
      for (let i = this.config.votingShards; i < this.config.votingShards + powShardCount; i++) {
        this.shards.set(i, new Set());
        this.shardMetrics.set(i, this.createInitialMetrics());
      }
      await this.auditManager.log(AuditEventType.SHARD_INITIALIZED, {
        shardCount: this.config.shardCount,
        votingShards: this.config.votingShards,
        powShards: this.config.powShards,
      });
    } catch (error) {
      Logger.error('Failed to initialize shards:', error);
    }
  }

  /**
   * Get shard for transaction
   */
  private getShardForTransaction(tx: Transaction): number {
    try {
      const hash = BigInt(`0x${tx.id}`);
      return Number(hash % BigInt(this.config.shardCount));
    } catch (error) {
      Logger.error('Invalid transaction id format, cannot convert to BigInt:', tx.id, error);
      throw new Error('Invalid transaction id format');
    }
  }

  /**
   * Update metrics for a shard
   */
  private async updateShardMetrics(shardId: number): Promise<void> {
    const shard = this.shards.get(shardId);
    if (!shard) return;

    const metrics = {
      size: shard.size,
      transactions: Array.from(shard).filter((id) => id.startsWith('tx'))
        .length,
      lastAccess: Date.now(),
      loadFactor: shard.size / this.config.maxShardSize,
    };

    this.shardMetrics.set(shardId, metrics);

    // Emit metrics
    this.eventEmitter.emit('shard_metrics', {
      shardId,
      metrics,
    });
  }

  /**
   * Check if resharding is needed
   */
  private async checkResharding(shardId: number): Promise<void> {
    const metrics = this.shardMetrics.get(shardId);
    if (!metrics) return;

    if (metrics.loadFactor > this.config.reshardThreshold) {
      await this.performResharding(shardId);
    }
  }

  /**
   * Perform resharding of overloaded shard
   */
  private async performResharding(shardId: number): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      await this.db.beginTransaction();
      const shard = this.shards.get(shardId);
      if (!shard) {
        await this.db.rollback();
        return;
      }

      // Create new shard; newShardId is chosen as the current number of shards
      const newShardId = this.shards.size;
      this.shards.set(newShardId, new Set());

      // Updated redistribution: recalculate shard assignment using an adjusted approach.
      const items = Array.from(shard);
      for (const item of items) {
        try {
          // Calculate a new shard assignment given the new number of shards.
          const newAssignment = Number(BigInt(`0x${item}`) % BigInt(newShardId + 1));
          if (newAssignment !== shardId) {
            shard.delete(item);
            this.shards.get(newShardId)?.add(item);
          }
        } catch (error) {
          // Log and skip problematic transaction IDs.
          Logger.error('Failed to reassign transaction during resharding:', item, error);
        }
      }

      // Update metrics for both shards
      await this.updateShardMetrics(shardId);
      await this.updateShardMetrics(newShardId);

      await this.auditManager.log(AuditEventType.SHARD_RESHARD, {
        originalShard: shardId,
        newShard: newShardId,
        itemsRedistributed: items.length,
      });

      await this.db.commit();
    } catch (error) {
      await this.db.rollback();
      throw error;
    } finally {
      release();
    }
  }

  /**
   * Start periodic shard sync
   */
  private startSyncTimer(): void {
    this.syncTimer = setInterval(
      () => this.syncShards(),
      this.config.syncInterval,
    ).unref();
  }

  /**
   * Sync shards with database
   */
  private async syncShards(): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      for (const [shardId, shard] of this.shards) {
        if (typeof this.db.syncShard === 'function') {
          await this.db.syncShard(shardId, Array.from(shard));
        } else {
          Logger.warn(`syncShard is not available on this.db. Skipping sync for shardId ${shardId}`);
        }
      }
    } catch (error) {
      Logger.error('Shard sync failed:', error);
    } finally {
      release();
    }
  }

  /**
   * Create initial metrics for new shard
   */
  private createInitialMetrics(): ShardMetrics {
    return {
      size: 0,
      transactions: 0,
      lastAccess: Date.now(),
      loadFactor: 0,
    };
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
    }
    this.shards.clear();
    this.shardMetrics.clear();
    this.cache.clear();
  }

  @retry({
    maxAttempts: 3,
    delay: 1000,
    exponentialBackoff: true,
  })
  public async getTransaction(hash: string): Promise<Transaction | undefined> {
    if (this.isCircuitBreakerOpen()) {
      throw new Error('Circuit breaker is open');
    }
    const perfMarker = this.performanceMonitor.start('get_transaction');
    const release = await this.mutex.acquire();

    try {
      // Input validation
      if (!hash || typeof hash !== 'string') {
        throw new Error('Invalid transaction hash');
      }

      // Check cache first
      const cachedTx = await this.cache.get(`tx:${hash}`);
      if (cachedTx) {
        this.metricsCollector?.increment('tx_cache_hit');
        this.recordSuccess();
        return cachedTx;
      }

      // Determine target shard using consistent hashing
      const targetShardId = this.getShardForTransaction({
        id: hash,
      } as Transaction);
      const shard = this.shards.get(targetShardId);

      if (!shard?.has(hash)) {
        this.metricsCollector?.increment('tx_not_found');
        return undefined;
      }

      // Get from database
      const tx = await this.db.getTransaction(hash);
      if (tx) {
        // Cache the result
        await this.cache.set(`tx:${hash}`, tx, { ttl: 300000 }); // 5 minutes
        this.metricsCollector?.increment('tx_found');

        // Update shard metrics
        await this.updateShardMetrics(targetShardId);
      }

      this.recordSuccess();

      return tx;
    } catch (error: unknown) {
      this.metricsCollector?.increment('tx_lookup_error');
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      Logger.error(`Transaction lookup failed for hash ${hash}:`, errorMessage);

      await this.auditManager.log(AuditEventType.SHARD_TX_LOOKUP_FAILED, {
        hash,
        error: errorMessage,
        timestamp: Date.now(),
      });

      this.recordFailure();
      throw error;
    } finally {
      this.performanceMonitor.end(perfMarker);
      release();
    }
  }

  private async cleanupStaleData(): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      for (const shard of this.shards.values()) {
        for (const item of Array.from(shard)) {
          const lastAccess = await this.db.getLastAccess(item);
          if (
            Date.now() - lastAccess >
            BLOCKCHAIN_CONSTANTS.UTIL.STALE_THRESHOLD
          ) {
            shard.delete(item);
          }
        }
      }
    } finally {
      release();
    }
  }

  private isCircuitBreakerOpen(): boolean {
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      const now = Date.now();
      if (
        now - this.circuitBreaker.lastFailure <
        this.circuitBreaker.resetTimeout
      ) {
        return true;
      } else {
        // After the timeout, reset the failure counter.
        this.circuitBreaker.failures = 0;
        return false;
      }
    }
    return false;
  }

  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
  }

  private recordSuccess(): void {
    this.circuitBreaker.failures = 0;
  }

  private async warmCache(): Promise<void> {
    const recentTransactions = await this.db.getRecentTransactions(100);
    for (const tx of recentTransactions) {
      await this.cache.set(`tx:${tx.id}`, tx, { ttl: 300000 });
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const metrics = Array.from(this.shardMetrics.values());
      const avgLoadFactor =
        metrics.reduce((sum, m) => sum + m.loadFactor, 0) / metrics.length;
      const isHealthy =
        avgLoadFactor < this.config.reshardThreshold &&
        this.circuitBreaker.failures < this.circuitBreaker.threshold;

      await this.auditManager.log(AuditEventType.SHARD_HEALTH_CHECK, {
        avgLoadFactor,
        isHealthy,
        timestamp: Date.now(),
      });

      return isHealthy;
    } catch (error) {
      Logger.error('Shard health check failed:', error);
      return false;
    }
  }

  private async rebalanceShards(): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      const shardSizes = Array.from(this.shards.entries()).map(
        ([id, shard]) => ({ id, size: shard.size }),
      );

      const avgSize =
        shardSizes.reduce((sum, s) => sum + s.size, 0) / shardSizes.length;
      const threshold = avgSize * 0.2; // 20% deviation threshold

      for (const { id, size } of shardSizes) {
        if (Math.abs(size - avgSize) > threshold) {
          await this.performResharding(id);
        }
      }
    } finally {
      release();
    }
  }

  private startMaintenanceTasks(): void {
    this.maintenanceTimer = setInterval(async () => {
      try {
        // Run maintenance tasks sequentially
        await this.cleanupStaleData();
        await this.rebalanceShards();

        // Check each shard for potential resharding
        for (const shardId of this.shards.keys()) {
          await this.checkResharding(shardId);
        }

        Logger.info('Shard maintenance completed successfully');
      } catch (error) {
        Logger.error('Shard maintenance failed:', error);
      }
    }, this.MAINTENANCE_INTERVAL).unref();
  }
}
