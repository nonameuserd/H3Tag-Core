import { EventEmitter } from 'events';
import { Block } from '../../models/block.model';
import { ProofOfWork } from './pow';
import { DirectVoting } from './voting';
import { Logger } from '@h3tag-blockchain/shared';
import { Mutex } from 'async-mutex';
import { DirectVotingUtil } from './voting/util';
import { ConsensusError } from '../utils/consensus.error';
import { BlockValidationError } from '../utils/validation.error';
import { BlockchainSchema } from '../../database/blockchain-schema';
import {
  AuditEventType,
  AuditManager,
  AuditSeverity,
} from '../../security/audit';
import { Mempool } from '../mempool';
import { Blockchain } from '../blockchain';
import { RetryStrategy } from '../../utils/retry';
import { Peer } from '../../network/peer';
import { BlockchainSync } from '../../network/sync';
import { Cache } from '../../scaling/cache';
import { ShardManager } from '../../scaling/sharding';
import { MerkleTree } from '../../utils/merkle';
import { DDoSProtection } from '../../security/ddos';
import { BLOCKCHAIN_CONSTANTS } from '../utils/constants';
import { Performance } from '../../monitoring/performance';
import { Transaction } from '../../models/transaction.model';
import { IVotingSchema } from '../../database/voting-schema';

interface CacheMetrics {
  hitRate: number;
  size: number;
  memoryUsage: number;
  evictionCount: number;
}

/**
 * @fileoverview HybridDirectConsensus implements a hybrid consensus mechanism that combines
 * Proof of Work (PoW) with direct voting for blockchain validation and fork resolution.
 * This hybrid approach provides both the security of PoW and the governance benefits of voting.
 *
 * @module HybridDirectConsensus
 */

/**
 * HybridDirectConsensus implements a hybrid consensus mechanism combining PoW and direct voting.
 * It manages block validation, chain fork resolution, and consensus state.
 *
 * @class HybridDirectConsensus
 *
 * @property {ProofOfWork} pow - Handles Proof of Work operations
 * @property {DirectVoting} directVoting - Manages voting operations
 * @property {BlockchainSchema} db - Database instance
 * @property {AuditManager} auditManager - Manages audit logging
 * @property {Cache<boolean>} blockCache - Caches block validation results
 * @property {ShardManager} shardManager - Manages blockchain sharding
 * @property {Mempool} mempool - Manages transaction mempool
 * @property {Blockchain} blockchain - Core blockchain instance
 * @property {MerkleTree} merkleTree - Handles merkle tree operations
 * @property {Performance} performance - Monitors performance metrics
 * @property {RetryStrategy} retryStrategy - Manages operation retries
 * @property {Map<string, Peer>} peers - Manages network peers
 * @property {BlockchainSync} blockchainSync - Handles blockchain synchronization
 * @property {DDoSProtection} ddosProtection - Provides DDoS protection
 *
 * @example
 * const consensus = await HybridDirectConsensus.create(blockchain);
 * const isValid = await consensus.validateBlock(block);
 * if (isValid) {
 *   await consensus.processBlock(block);
 * }
 */

/**
 * Creates a new instance of HybridDirectConsensus
 *
 * @constructor
 * @param {Blockchain} blockchain - Blockchain instance
 */

/**
 * Creates and initializes a new HybridDirectConsensus instance
 *
 * @static
 * @async
 * @method create
 * @param {Blockchain} blockchain - Blockchain instance
 * @returns {Promise<HybridDirectConsensus>} Initialized consensus instance
 */

/**
 * Validates a block using hybrid consensus rules
 *
 * @async
 * @method validateBlock
 * @param {Block} block - Block to validate
 * @returns {Promise<boolean>} True if block is valid
 * @throws {BlockValidationError} If validation fails or times out
 *
 * @example
 * const isValid = await consensus.validateBlock(block);
 * if (!isValid) {
 *   // Handle invalid block
 * }
 */

/**
 * Processes a new block
 *
 * @async
 * @method processBlock
 * @param {Block} block - Block to process
 * @returns {Promise<Block>} Processed block
 * @throws {ConsensusError} If block processing fails or times out
 *
 * @example
 * const processedBlock = await consensus.processBlock(block);
 */

/**
 * Handles chain fork resolution
 *
 * @async
 * @method handleChainFork
 * @param {Block} block - Block causing the fork
 * @returns {Promise<string>} Hash of the winning chain tip
 * @throws {ConsensusError} If fork resolution fails or times out
 */

/**
 * Validates participation reward transaction
 *
 * @async
 * @method validateParticipationReward
 * @param {Transaction} transaction - Reward transaction to validate
 * @param {number} currentHeight - Current blockchain height
 * @returns {Promise<boolean>} True if reward is valid
 */

/**
 * Gets consensus metrics
 *
 * @method getMetrics
 * @returns {{
 *   pow: Object,
 *   voting: Object,
 *   votingPeriod: number,
 *   minimumParticipation: number,
 *   performance: Object,
 *   cache: {
 *     size: number,
 *     hitRate: number,
 *     evictionCount: number
 *   },
 *   retryStats: Object
 * }}
 */

/**
 * Performs health check of consensus system
 *
 * @async
 * @method healthCheck
 * @returns {Promise<boolean>} True if system is healthy
 */

/**
 * Starts continuous mining process
 *
 * @method startMining
 * @returns {void}
 */

/**
 * Stops the mining process
 *
 * @method stopMining
 * @returns {void}
 */

/**
 * Disposes of the consensus system
 *
 * @async
 * @method dispose
 * @returns {Promise<void>}
 */

/**
 * @typedef {Object} CacheMetrics
 * @property {number} hitRate - Cache hit rate
 * @property {number} size - Current cache size
 * @property {number} memoryUsage - Memory usage in bytes
 * @property {number} evictionCount - Number of cache evictions
 */

/**
 * @typedef {Object} CircuitBreaker
 * @property {number} failures - Number of consecutive failures
 * @property {number} lastFailure - Timestamp of last failure
 * @property {number} threshold - Failure threshold before opening
 * @property {number} resetTimeout - Time before resetting failures
 */

export class HybridDirectConsensus {
  readonly pow: ProofOfWork;
  readonly directVoting: DirectVoting;
  private readonly db: BlockchainSchema;
  private readonly auditManager: AuditManager;
  private readonly blockCache: Cache<boolean>;
  private readonly shardManager: ShardManager;
  private readonly mempool: Mempool | undefined;
  private readonly blockchain: Blockchain;
  private readonly merkleTree: MerkleTree;
  private readonly eventEmitter = new EventEmitter();
  private readonly performance: Performance | undefined;
  private readonly retryStrategy: RetryStrategy;
  private readonly peers: Map<string, Peer> | undefined;
  private isDisposed = false;
  private readonly forkLock = new Mutex();
  private cleanupHandler?: () => Promise<void>;
  private readonly blockchainSync: BlockchainSync;
  private readonly circuitBreaker = {
    failures: 0,
    lastFailure: 0,
    threshold: 5,
    resetTimeout: 60000, // 1 minute
  };
  private ddosProtection: DDoSProtection;
  private readonly cacheLock = new Mutex();
  private readonly consensusPublicKey: string;
  private isInitialized = false;
  private readonly forkResolutionLock = new Mutex();

  /**
   * Creates a new instance of HybridDirectConsensus
   * @param db Database instance
   * @param pow Proof of Work instance
   * @param directVoting Direct voting instance
   * @param merkleTree Merkle tree instance
   * @param auditManager Audit manager instance
   * @param blockCache Block cache instance
   * @param shardManager Shard manager instance
   * @param performance Performance monitor instance
   * @param retryStrategy Retry strategy instance
   */
  constructor(blockchain: Blockchain) {
    this.blockchain = blockchain;
    this.consensusPublicKey = blockchain.getConsensusPublicKey();
    this.db = new BlockchainSchema();
    this.merkleTree = new MerkleTree();
    this.auditManager = new AuditManager();
    this.pow = new ProofOfWork(this.blockchain);
    this.blockchainSync = new BlockchainSync(
      this.blockchain,
      this.mempool || new Mempool(this.blockchain),
      this.peers || new Map(),
      { publicKey: this.consensusPublicKey },
      this.db,
    );

    // Initialize after dependencies
    this.directVoting = new DirectVoting(
      this.db,
      this.db.getVotingSchema() as IVotingSchema,
      this.auditManager,
      new DirectVotingUtil(this.db, this.auditManager),
      this.blockchain.getNode(),
      this.blockchainSync,
    );

    // Add async initialization method
    this.initialize().catch((error) =>
      Logger.error('Failed to initialize HybridDirectConsensus:', error),
    );

    // Add cleanup handler
    this.registerCleanupHandler();

    // Initialize caches and sharding
    this.blockCache = new Cache<boolean>({
      ttl: BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL_HOURS * 3600,
      maxSize: 10000,
      compression: true,
      priorityLevels: {
        pow: 3,
        consensus: 2,
        quadratic_vote: 3,
      },
      onEvict: (key) => this.handleCacheEviction(key),
    });

    this.shardManager = new ShardManager(
      {
        shardCount: 16,
        votingShards: 8,
        powShards: 8,
        maxShardSize: 1000000,
        replicationFactor: 3,
        reshardThreshold: 0.8,
        syncInterval: 60000,
      },
      this.db,
    );

    this.retryStrategy = new RetryStrategy({
      maxAttempts: BLOCKCHAIN_CONSTANTS.UTIL.RETRY_ATTEMPTS,
      delay: BLOCKCHAIN_CONSTANTS.UTIL.RETRY_DELAY_MS,
    });

    this.ddosProtection = new DDoSProtection(
      {
        maxRequests: {
          default: 200,
          pow: 100,
          qudraticVote: 100,
        },
        windowMs: 60000,
        blockDuration: 600000, // 10 minutes
      },
      this.auditManager,
    );
  }

  public static async create(
    blockchain: Blockchain,
  ): Promise<HybridDirectConsensus> {
    const instance = new HybridDirectConsensus(blockchain);
    await instance.initialize();
    return instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.cleanupCircuitBreaker();
      await this.warmupCache();
      await this.directVoting.initialize();
      await this.pow.initialize();
      this.isInitialized = true;
    } catch (error) {
      Logger.error('Failed to initialize HybridDirectConsensus:', error);
      await this.dispose();
      throw error;
    }
  }

  async validateBlock(block: Block): Promise<boolean> {
    const validationTimer = Performance.startTimer('block_validation');
    let timeoutId = setTimeout(
      () => {},
      BLOCKCHAIN_CONSTANTS.UTIL.VALIDATION_TIMEOUT_MS,
    );

    try {
      const result = await Promise.race([
        this._validateBlock(block),
        new Promise<boolean>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new BlockValidationError('Validation timeout exceeded'));
          }, BLOCKCHAIN_CONSTANTS.UTIL.VALIDATION_TIMEOUT_MS);
        }),
      ]);

      if (!result) {
        await this.mempool?.handleValidationFailure(
          `block_validation:${block.header.height}`,
          block.validators.map((v) => v.address).join(','),
        );
      }
      return result;
    } catch (error) {
      Logger.error('Block validation failed:', error);
      await this.mempool?.handleValidationFailure(
        `block_validation:${block.header.height}`,
        block.validators.map((v) => v.address).join(','),
      );
      return false;
    } finally {
      clearTimeout(timeoutId);
      const duration = Performance.stopTimer(validationTimer);
      this.emitMetric('validation_duration', duration);
    }
  }

  /**
   * Validates a block
   * @param block Block to validate
   * @returns Promise<boolean> True if block is valid
   */
  private async _validateBlock(block: Block): Promise<boolean> {
    return await this.cacheLock.runExclusive(async () => {
      try {
        let cached: boolean | undefined;
        try {
          cached = this.blockCache.get(block.hash);
          if (cached !== undefined) return cached;
        } catch (error) {
          Logger.warn('Cache read error:', error);
        }

        // Clean up circuit breaker before checking
        this.cleanupCircuitBreaker();

        // Check circuit breaker
        if (this.isCircuitOpen()) {
          throw new ConsensusError('Circuit breaker is open');
        }

        // 1. Verify merkle root (fast check)
        if (!(await this.verifyMerkleRoot(block))) {
          return false;
        }

        // 2. Validate PoW
        const powValid = await this.pow.validateBlock(block);
        if (!powValid) {
          await this.logValidationFailure(block, 'Invalid PoW');
          return false;
        }

        // 3. Check if this is a fork point requiring voting
        if (await this.isForkPoint(block)) {
          // Check if we're in a voting period
          const votingSchedule = await this.directVoting.getVotingSchedule();

          if (votingSchedule.currentPeriod?.status === 'active') {
            // Handle through voting
            const chainDecision = await this.handleChainFork(block);
            if (!chainDecision) {
              await this.logValidationFailure(
                block,
                'Chain fork rejected by vote',
              );
              return false;
            }
          } else {
            // Outside voting period - use PoW only with higher threshold
            const powScore = await this.calculatePowScore(block);
            if (
              powScore < BLOCKCHAIN_CONSTANTS.MINING.EMERGENCY_POW_THRESHOLD
            ) {
              await this.logValidationFailure(
                block,
                'Insufficient PoW for fork outside voting period',
              );
              return false;
            }
          }
        }

        // Log successful validation
        await this.logSuccessfulValidation(block);
        const result = true;

        try {
          this.blockCache.set(block.hash, result);
        } catch (error) {
          Logger.warn('Cache write error:', error);
        }

        return result;
      } catch (error) {
        this.recordFailure();
        throw error;
      }
    });
  }

  /**
   * Checks if a block is a fork point
   * @param block Block to check
   * @returns Promise<boolean> True if block is a fork point
   */
  private async isForkPoint(block: Block): Promise<boolean | null> {
    const existingBlock = await this.db.getBlockByHeight(block.header.height);
    return existingBlock && existingBlock.hash !== block.header.previousHash;
  }

  /**
   * Handles chain fork resolution
   * @param block Block causing the fork
   * @returns Promise<string> Hash of the winning chain tip
   * @throws Error if fork resolution fails or times out
   */
  private async handleChainFork(block: Block): Promise<string> {
    return this.forkResolutionLock.runExclusive(async () => {
      // First check DDoS protection within the lock
      if (
        !this.ddosProtection.checkRequest('fork_resolution', block.header.miner)
      ) {
        throw new ConsensusError('Rate limit exceeded for fork resolution');
      }

      const forkTimer = Performance.startTimer('fork_resolution');

      try {
        return await Promise.race([
          this._handleChainFork(block),
          new Promise<string>((_, reject) => {
            setTimeout(() => {
              reject(new ConsensusError('Fork resolution timeout exceeded'));
            }, BLOCKCHAIN_CONSTANTS.MINING.FORK_RESOLUTION_TIMEOUT_MS);
          }),
        ]);
      } finally {
        const duration = Performance.stopTimer(forkTimer);
        this.emitMetric('fork_resolution_duration', duration);
      }
    });
  }

  /**
   * Handles chain fork resolution
   * @param block Block causing the fork
   * @returns Promise<string> Hash of the winning chain tip
   * @throws Error if fork resolution fails or times out
   */
  private async _handleChainFork(block: Block): Promise<string> {
    const metrics = {
      attempts: 0,
      success: false,
      startTime: Date.now(),
    };

    try {
      metrics.attempts++;
      return await this.forkLock.runExclusive(async () => {
        // Validate fork length
        const currentHeight = this.blockchain.getCurrentHeight();
        const maxForkLength = BLOCKCHAIN_CONSTANTS.CONSENSUS.MAX_FORK_LENGTH;

        if (block.header.height < currentHeight - maxForkLength) {
          throw new ConsensusError('Fork exceeds maximum length');
        }

        const existingBlock = await this.db.getBlockByHeight(
          block.header.height,
        );
        if (!existingBlock) return block.hash;

        // Validate block timestamps
        if (block.header.timestamp < existingBlock.header.timestamp) {
          throw new ConsensusError('Fork block timestamp invalid');
        }

        // DirectVoting handles vote calculation
        const winningHash = await Promise.race<string>([
          this.directVoting.handleChainFork(
            existingBlock.hash,
            block.hash,
            block.header.height,
            block.validators,
          ),
          new Promise<string>((_, reject) =>
            setTimeout(
              () => reject(new Error('Fork resolution deadlock')),
              BLOCKCHAIN_CONSTANTS.MINING.FORK_RESOLUTION_TIMEOUT_MS,
            ),
          ),
        ]);

        metrics.success = true;
        return winningHash;
      });
    } finally {
      this.emitMetric('fork_resolution_attempts', metrics.attempts);
      this.emitMetric('fork_resolution_success', metrics.success ? 1 : 0);
      this.emitMetric('fork_resolution_time', Date.now() - metrics.startTime);
    }
  }

  /**
   * Calculates PoW score for a block
   * @param block Block to calculate score for
   * @returns Promise<number> PoW score
   */
  private async calculatePowScore(block: Block): Promise<number> {
    const difficulty = block.header.difficulty;
    const networkDifficulty = await this.pow.getNetworkDifficulty();
    return difficulty / networkDifficulty;
  }

  /**
   * Processes a new block
   * @param block Block to process
   * @returns Promise<Block> Processed block
   * @throws Error if block processing fails
   */
  async processBlock(block: Block): Promise<Block> {
    const processingTimer = Performance.startTimer('block_processing');
    let timeoutId = setTimeout(
      () => {},
      BLOCKCHAIN_CONSTANTS.UTIL.PROCESSING_TIMEOUT_MS,
    );

    try {
      const result = await Promise.race([
        this._processBlock(block),
        new Promise<Block>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new ConsensusError('Block processing timeout exceeded'));
          }, BLOCKCHAIN_CONSTANTS.UTIL.PROCESSING_TIMEOUT_MS);
        }),
      ]);

      return result;
    } catch (error) {
      Logger.error('Block processing failed:', error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
      const duration = Performance.stopTimer(processingTimer);
      this.emitMetric('block_processing_duration', duration);
    }
  }

  private async _processBlock(block: Block): Promise<Block> {
    try {
      // 1. Create merkle root with timeout
      const txHashes = block.transactions.map((tx) => tx.hash);
      block.header.merkleRoot = await this.merkleTree.createRoot(txHashes);

      // 2. Mine block using PoW with circuit breaker
      let attempts = 0;
      const maxAttempts = BLOCKCHAIN_CONSTANTS.MINING.MAX_ATTEMPTS;

      while (attempts < maxAttempts) {
        try {
          const minedBlock = await this.pow.mineBlock(block);

          // 3. Log successful mining
          await this.auditManager.logEvent({
            type: AuditEventType.POW_BLOCK,
            severity: AuditSeverity.INFO,
            source: block.header.miner,
            details: {
              blockHash: minedBlock.hash,
              height: minedBlock.header.height,
              difficulty: minedBlock.header.difficulty,
            },
          });

          return minedBlock;
        } catch (error) {
          attempts++;
          if (attempts >= maxAttempts) throw error;

          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(1000 * Math.pow(2, attempts), 30000)),
          );
        }
      }

      throw new Error('Block processing failed after max attempts');
    } catch (error) {
      Logger.error('Block processing error:', error);
      throw error;
    }
  }

  /**
   * Verifies merkle root of a block
   * @param block Block to verify
   * @returns Promise<boolean> True if merkle root is valid
   */
  private async verifyMerkleRoot(block: Block): Promise<boolean> {
    try {
      const txHashes = block.transactions.map((tx) => tx.hash);
      const computedRoot = await this.merkleTree.createRoot(txHashes);

      if (!computedRoot) {
        throw new Error('Failed to compute merkle root');
      }

      const isValid = computedRoot === block.header.merkleRoot;
      if (!isValid) {
        await this.logValidationFailure(block, 'Merkle root mismatch');
      }
      return isValid;
    } catch (error) {
      Logger.error('Merkle root verification failed:', error);
      await this.auditManager.logEvent({
        type: AuditEventType.MERKLE_ERROR,
        severity: AuditSeverity.ERROR,
        source: block.header.miner,
        details: { error: (error as Error).message },
      });
      return false;
    }
  }

  /**
   * Logs validation failure event
   * @param block Block that failed validation
   * @param reason Failure reason
   */
  private async logValidationFailure(
    block: Block,
    reason: string,
  ): Promise<void> {
    await this.auditManager.logEvent({
      type: AuditEventType.VALIDATION_FAILED,
      severity: AuditSeverity.WARNING,
      source: block.header.miner,
      details: { blockHash: block.hash, reason },
    });
  }

  /**
   * Logs successful validation event
   * @param block Validated block
   */
  private async logSuccessfulValidation(block: Block): Promise<void> {
    await this.auditManager.logEvent({
      type: AuditEventType.VALIDATION_SUCCESS,
      severity: AuditSeverity.INFO,
      source: block.header.miner,
      details: { blockHash: block.hash },
    });
  }

  /**
   * Logs validation error event
   * @param block Block that caused error
   * @param error Error details
   */
  private async logValidationError(block: Block, error: Error): Promise<void> {
    await this.auditManager.logEvent({
      type: AuditEventType.VALIDATION_ERROR,
      severity: AuditSeverity.ERROR,
      source: block.header.miner,
      details: { blockHash: block.hash, error: error.message },
    });
  }

  /**
   * Gets consensus metrics
   * @returns Object containing various consensus metrics
   */
  public getMetrics() {
    return {
      pow: this.pow.getMetrics(),
      voting: this.directVoting.getVotingMetrics(),
      votingPeriod: BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTING_PERIOD,
      minimumParticipation: BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_PARTICIPATION,
      performance: Performance.getInstance().getMetrics(),
      cache: {
        size: this.blockCache.size(),
        hitRate: this.blockCache.getHitRate(),
        evictionCount: this.blockCache.getEvictionCount(),
      },
      retryStats: this.retryStrategy.getStats(),
    };
  }

  /**
   * Performs health check of consensus system
   * @returns Promise<boolean> True if system is healthy
   */
  public async healthCheck(): Promise<boolean> {
    if (this.isDisposed) return false;

    try {
      const [powHealth, votingHealth, dbHealth, cacheMetrics] =
        await Promise.all([
          this.pow.healthCheck(),
          this.directVoting.healthCheck(),
          this.db.ping(),
          this.validateCacheIntegrity(),
          this.getCacheMetrics(),
        ]);

      // Check cache health
      const isCacheHealthy =
        cacheMetrics.hitRate > 0.5 &&
        cacheMetrics.size < this.blockCache.maxSize &&
        cacheMetrics.memoryUsage <
          Number(process.env.MAX_MEMORY_USAGE || Infinity);

      const isHealthy = powHealth && votingHealth && dbHealth && isCacheHealthy;

      if (!isHealthy) {
        Logger.warn('Hybrid consensus health check failed', {
          pow: powHealth,
          voting: votingHealth,
          db: dbHealth,
          cache: cacheMetrics,
        });
      }

      return isHealthy;
    } catch (error) {
      Logger.error('Health check failed:', error);
      return false;
    }
  }

  private async validateCacheIntegrity(): Promise<CacheMetrics> {
    return {
      hitRate: this.blockCache.getHitRate(),
      size: this.blockCache.size(),
      memoryUsage: process.memoryUsage().heapUsed,
      evictionCount: this.blockCache.getEvictionCount(),
    };
  }

  /**
   * Disposes of the consensus system
   * @returns Promise<void>
   */
  public async dispose(): Promise<void> {
    if (this.isDisposed) return;

    process.off('beforeExit', this.cleanupHandler || (() => {}));
    process.off('SIGINT', this.cleanupHandler || (() => {}));
    process.off('SIGTERM', this.cleanupHandler || (() => {}));

    this.blockCache.clear();
    await this.directVoting.close();
    await this.pow.dispose();
    this.isDisposed = true;
  }

  /**
   * Registers an event listener
   * @param event Event name
   * @param listener Event handler function
   */
  public on(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  public off(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * Emits a metric event
   * @param name Metric name
   * @param value Metric value
   */
  private emitMetric(name: string, value: number): void {
    this.eventEmitter.emit('metric', {
      name,
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Handles cache eviction
   * @param key Cache key being evicted
   */
  private handleCacheEviction(key: string) {
    try {
      // Add proper cleanup
      if (this.blockCache.has(key)) {
        this.blockCache.delete(key);
      }
      Logger.debug(`Cache entry evicted: ${key}`);
    } catch (error) {
      Logger.error(`Cache eviction error for key ${key}:`, error);
    }
  }

  /**
   * Checks if circuit breaker is open
   * @returns boolean True if circuit breaker is open
   */
  private isCircuitOpen(): boolean {
    const now = Date.now();
    if (
      now - this.circuitBreaker.lastFailure >
      this.circuitBreaker.resetTimeout
    ) {
      this.circuitBreaker.failures = 0;
      return false;
    }
    return this.circuitBreaker.failures >= this.circuitBreaker.threshold;
  }

  /**
   * Records a failure for circuit breaker
   */
  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
  }

  /**
   * Warms up block cache with recent blocks
   * @param recentBlocks Number of recent blocks to cache
   */
  private async warmupCache(recentBlocks: number = 100): Promise<void> {
    const retryOptions = {
      maxAttempts: 3,
      backoffMs: 1000,
      maxBackoffMs: 5000,
    };

    return this.cacheLock.runExclusive(async () => {
      const warmupWithRetry = async () => {
        try {
          const latestHeight = await this.db.getCurrentHeight();
          const startHeight = Math.max(0, latestHeight - recentBlocks);

          // Use batch processing to avoid memory issues
          const BATCH_SIZE = 20;
          for (
            let height = startHeight;
            height <= latestHeight;
            height += BATCH_SIZE
          ) {
            const endHeight = Math.min(height + BATCH_SIZE, latestHeight);
            const blocks = await Promise.all(
              Array.from({ length: endHeight - height + 1 }, (_, i) =>
                this.db.getBlockByHeight(height + i),
              ),
            );

            blocks.forEach((block) => {
              if (block) {
                this.blockCache.set(block.hash, true, {
                  priority: 3,
                  ttl: BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL_HOURS * 3600,
                });
              }
            });

            // Allow other operations to proceed between batches
            await new Promise((resolve) => setTimeout(resolve, 0));
          }

          Logger.info(
            `Cache warmup completed for blocks ${startHeight} to ${latestHeight}`,
          );
        } catch (error) {
          Logger.error('Cache warmup failed:', error);
          throw error;
        }
      };

      // Implement retry logic
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= retryOptions.maxAttempts; attempt++) {
        try {
          await warmupWithRetry();
          return;
        } catch (error) {
          lastError = error as Error;
          if (attempt < retryOptions.maxAttempts) {
            const backoff = Math.min(
              retryOptions.backoffMs * Math.pow(2, attempt - 1),
              retryOptions.maxBackoffMs,
            );
            await new Promise((resolve) => setTimeout(resolve, backoff));
          }
        }
      }

      throw new Error(
        `Cache warmup failed after ${retryOptions.maxAttempts} attempts: ${lastError?.message}`,
      );
    });
  }

  public async validateParticipationReward(
    transaction: Transaction,
    currentHeight: number,
  ): Promise<boolean> {
    try {
      // Verify PoW participation
      const hasValidPoW = await this.pow.validateWork(
        transaction.sender,
        await this.pow.getNetworkDifficulty(),
      );
      if (!hasValidPoW) return false;

      // Verify voting participation
      const hasVoted = await this.directVoting.hasParticipated(
        transaction.sender,
      );
      if (!hasVoted) return false;

      // Verify reward amount matches consensus rules
      const expectedReward =
        await this.calculateParticipationReward(currentHeight);
      return transaction.outputs[0]?.amount === expectedReward;
    } catch (error) {
      Logger.error('Participation reward validation failed:', error);
      return false;
    }
  }

  private async calculateParticipationReward(height: number): Promise<bigint> {
    try {
      // Base reward
      let reward = BLOCKCHAIN_CONSTANTS.CONSENSUS.BASE_REWARD;

      // Adjust based on hybrid participation
      const votingRate = await this.directVoting.getParticipationRate();
      const powRate = await this.pow.getParticipationRate();
      const hybridRate = (votingRate + powRate) / 2;

      // Safely perform BigInt operations with bounds checking
      const safeMultiply = (a: bigint, b: bigint): bigint => {
        const result = a * b;
        if (
          result < 0n ||
          result > BLOCKCHAIN_CONSTANTS.CONSENSUS.MAX_SAFE_REWARD
        ) {
          throw new Error('Reward calculation overflow');
        }
        return result;
      };

      const safeDivide = (a: bigint, b: bigint): bigint => {
        if (b === 0n) throw new Error('Division by zero');
        return a / b;
      };

      // Higher participation = lower rewards (to incentivize early participation)
      const participationFactor = BigInt(Math.floor(100 - hybridRate));
      reward = safeDivide(safeMultiply(reward, participationFactor), 100n);

      // Adjust based on block height (halving)
      const halvingInterval = BLOCKCHAIN_CONSTANTS.CONSENSUS.HALVING_INTERVAL;
      const halvings = Math.floor(height / halvingInterval);
      if (halvings > 64) {
        // Prevent excessive right shifts
        throw new Error('Halving calculation overflow');
      }
      reward = reward >> BigInt(halvings);

      // Network difficulty adjustment
      const difficultyFactor = await this.pow.getNetworkDifficulty(); // Kept the original network difficulty call
      const difficultyBigInt = BigInt(difficultyFactor);
      reward = safeDivide(
        safeMultiply(reward, difficultyBigInt),
        BigInt(BLOCKCHAIN_CONSTANTS.CONSENSUS.BASE_DIFFICULTY),
      );

      // Minimum reward protection
      return reward > BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_REWARD
        ? reward
        : BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_REWARD;
    } catch (error) {
      Logger.error('Failed to calculate participation reward:', error);
      return BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_REWARD;
    }
  }

  /**
   * Manual mining - mines a single block
   */
  public async mineBlock(): Promise<Block> {
    return this.withErrorBoundary('mineBlock', async () => {
      const block = await this.pow.createAndMineBlock();
      if (await this.validateBlock(block)) {
        await this.blockchain.addBlock(block);
        return block;
      }
      throw new ConsensusError('Block validation failed');
    });
  }

  /**
   * Starts continuous mining process
   */
  public startMining(): void {
    if (!this.isDisposed) {
      this.pow.startMining();
      Logger.info('Hybrid consensus mining started');
    }
  }

  /**
   * Stops the mining process
   */
  public stopMining(): void {
    this.pow.stopMining();
    Logger.info('Hybrid consensus mining stopped');
  }

  private async withErrorBoundary<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      Logger.error(`Error in ${operation}:`, error);
      throw error;
    }
  }

  private cleanupCircuitBreaker(): void {
    const now = Date.now();
    if (
      now - this.circuitBreaker.lastFailure >
      this.circuitBreaker.resetTimeout
    ) {
      this.circuitBreaker.failures = 0;
    }
  }

  private registerCleanupHandler(): void {
    this.cleanupHandler = async () => {
      if (!this.isDisposed) {
        await this.dispose();
      }
    };

    process.on('beforeExit', this.cleanupHandler);
    process.on('SIGINT', this.cleanupHandler);
    process.on('SIGTERM', this.cleanupHandler);
  }

  public getCacheMetrics(): CacheMetrics {
    return {
      size: this.blockCache.size(),
      hitRate: this.blockCache.getHitRate(),
      evictionCount: this.blockCache.getEvictionCount(),
      memoryUsage: process.memoryUsage().heapUsed,
    };
  }

  /**
   * Updates consensus state after new block addition
   * @param block The newly added block
   */
  public async updateState(block: Block): Promise<void> {
    try {
      // Update voting state
      await this.directVoting.updateVotingState(async (currentState) => {
        // Process block and return updated voting state
        return {
          ...currentState,
          lastBlockHash: block.hash,
          height: block.header.height,
          timestamp: block.header.timestamp,
        };
      });

      // Update PoW state
      await this.pow.updateDifficulty(block);

      // Update cache
      this.blockCache.set(block.hash, true);
    } catch (error) {
      Logger.error('Failed to update consensus state:', error);
      throw error;
    }
  }
}
