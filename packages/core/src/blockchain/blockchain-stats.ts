/**
 * @fileoverview BlockchainStats provides statistical analysis and metrics collection
 * for blockchain performance, health, and network participation. It implements caching
 * and circuit breaker patterns for efficient data retrieval.
 *
 * @module BlockchainStats
 */

/**
 * BlockchainStats collects and manages blockchain statistics with built-in caching
 * and circuit breaker protection.
 *
 * @class BlockchainStats
 *
 * @property {IBlockchainData} blockchain - Interface to blockchain data
 * @property {Map<string, { value: any; timestamp: number }>} statsCache - Statistics cache
 * @property {number} maxCacheSize - Maximum cache entries
 * @property {MetricsCollector} metricsCollector - Metrics collection instance
 * @property {Map} circuitBreaker - Circuit breaker state for stats operations
 *
 * @example
 * const stats = new BlockchainStats(blockchain);
 * const votingStats = await stats.getVotingStats();
 * const consensusHealth = await stats.getConsensusHealth();
 */

/**
 * Creates a new instance of BlockchainStats
 *
 * @constructor
 * @param {IBlockchainData} blockchain - Interface to blockchain data
 */

/**
 * Gets voting statistics including participation rates and period information
 *
 * @async
 * @method getVotingStats
 * @returns {Promise<{
 *   currentPeriod: number;
 *   blocksUntilNextVoting: number;
 *   participationRate: number;
 *   powWeight: number;
 *   votingWeight: number;
 * }>} Current voting statistics
 *
 * @example
 * const stats = await blockchainStats.getVotingStats();
 * console.log(`Current participation rate: ${stats.participationRate}%`);
 */

/**
 * Gets orphan rate over configured window
 *
 * @async
 * @method getOrphanRate
 * @returns {Promise<number>} Orphan rate as percentage
 *
 * @example
 * const orphanRate = await blockchainStats.getOrphanRate();
 * console.log(`Current orphan rate: ${orphanRate}%`);
 */

/**
 * Gets consensus health metrics
 *
 * @async
 * @method getConsensusHealth
 * @returns {Promise<{
 *   powHashrate: number;
 *   activeVoters: number;
 *   consensusParticipation: number;
 *   isHealthy: boolean;
 * }>} Consensus health status
 *
 * @example
 * const health = await blockchainStats.getConsensusHealth();
 * if (!health.isHealthy) {
 *   console.warn('Consensus health check failed');
 * }
 */

/**
 * Gets average block time over recent blocks
 *
 * @async
 * @method getAverageBlockTime
 * @returns {Promise<number>} Average block time in seconds
 *
 * @example
 * const avgBlockTime = await blockchainStats.getAverageBlockTime();
 * console.log(`Average block time: ${avgBlockTime}s`);
 */

/**
 * Gets block propagation statistics
 *
 * @async
 * @method getBlockPropagationStats
 * @returns {Promise<{
 *   average: number;
 *   median: number;
 * }>} Block propagation timing statistics
 *
 * @example
 * const propagation = await blockchainStats.getBlockPropagationStats();
 * console.log(`Median propagation time: ${propagation.median}ms`);
 */

/**
 * Gets cached value with automatic refresh
 *
 * @private
 * @async
 * @method getCachedValue
 * @template T
 * @param {string} key - Cache key
 * @param {() => Promise<T>} calculator - Value calculator function
 * @returns {Promise<T>} Cached or freshly calculated value
 */

/**
 * Executes operation with retry logic
 *
 * @private
 * @async
 * @method executeWithRetry
 * @template T
 * @param {() => Promise<T>} operation - Operation to execute
 * @returns {Promise<T>} Operation result
 */

/**
 * Executes operation with timeout
 *
 * @private
 * @async
 * @method executeWithTimeout
 * @template T
 * @param {Promise<T>} promise - Promise to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<T>} Operation result or timeout error
 */

/**
 * @interface IBlockchainData
 * @property {() => number} getHeight - Gets current blockchain height
 * @property {() => number} getCurrentHeight - Gets current synced height
 * @property {() => Block | null} getLatestBlock - Gets latest block
 * @property {(height: number) => Block | undefined} getBlockByHeight - Gets block at height
 * @property {() => number} getCurrentDifficulty - Gets current mining difficulty
 * @property {() => { chain: Block[] }} getState - Gets blockchain state
 * @property {() => Promise<Object>} getConsensusMetrics - Gets consensus metrics
 * @property {(hash: string) => Promise<Transaction | undefined>} getTransaction - Gets transaction by hash
 * @property {() => Object} getCurrencyDetails - Gets currency details
 * @property {(height: number) => bigint} calculateBlockReward - Calculates block reward
 * @property {(address: string) => Promise<Array>} getConfirmedUtxos - Gets confirmed UTXOs
 */

import { Block } from '../models/block.model';
import { Logger } from '@h3tag-blockchain/shared';
import { BLOCKCHAIN_CONSTANTS } from './utils/constants';
import { MetricsCollector } from '../monitoring/metrics-collector';
import { retry } from '../utils/retry';
import { performance } from 'perf_hooks';
import { Transaction } from '../models/transaction.model';
import { BlockchainStatsError } from './utils/blockchain-stats-error';
import { UTXO } from '../models/utxo.model';
import { Mutex } from 'async-mutex';

// Create interface for what BlockchainStats needs
export interface IBlockchainData {
  getHeight(): number;
  getCurrentHeight(): number;
  getLatestBlock(): Block | null;
  getBlockByHeight(height: number): Block | undefined;
  getCurrentDifficulty(): number;
  getState(): { chain: Block[] };
  getConsensusMetrics(): Promise<{
    powHashrate: number;
    activeVoters: number;
    participation: number;
    currentParticipation: number;
  }>;
  getTransaction(hash: string): Promise<Transaction | undefined>;
  getCurrencyDetails(): {
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: number;
    maxSupply: number;
    circulatingSupply: number;
  };
  calculateBlockReward(height: number): bigint;
  getConfirmedUtxos(address: string): Promise<UTXO[]>;
}

export class BlockchainStats {
  private readonly blockchain: IBlockchainData;
  private readonly statsCache = new Map<
    string,
    { value: unknown; timestamp: number }
  >();
  private readonly maxCacheSize = 1000; // Prevent unlimited growth
  private metricsCollector?: MetricsCollector;
  private circuitBreaker = new Map<
    string,
    {
      failures: number;
      lastFailure: number;
      isOpen: boolean;
    }
  >();
  private readonly cleanupInterval = 300000; // 5 minutes
  private cleanupIntervalId?: NodeJS.Timeout;
  private cacheMutex = new Mutex();
  private readonly cacheIndex = new Map<number, string>(); // Height to key mapping
  private readonly cacheQueue: string[] = []; // Add cache queue
  private readonly BATCH_SIZE = 1000; // Add to constants
  private saveIntervalId?: NodeJS.Timeout;
  private readonly SAVE_INTERVAL = 60000; // 1 minute

  /**
   * Constructor for BlockchainStats
   * @param blockchain Blockchain data
   */
  constructor(blockchain: IBlockchainData) {
    this.blockchain = blockchain;
    this.initializeMetrics();
    this.startCacheCleanup();
    this.startCircuitBreakerSaving();
    this.loadCircuitBreakerState().catch((error) => {
      Logger.error('Failed to load circuit breaker state:', error);
    });
  }

  /**
   * Initializes metrics
   */
  private initializeMetrics(): void {
    this.metricsCollector = new MetricsCollector('blockchain_stats');
    this.getMetricsCollector()?.gauge(
      'blockchain_stats_cache_size',
      () => this.statsCache.size,
    );
    this.getMetricsCollector()?.gauge(
      'blockchain_stats_last_update.voting_stats',
      0,
    );
    this.getMetricsCollector()?.gauge(
      'blockchain_stats_last_update.consensus_health',
      0,
    );
    this.getMetricsCollector()?.gauge(
      'blockchain_stats_last_update.chain_stats',
      0,
    );
  }

  /**
   * Gets cached value
   * @param key Key to get value for
   * @param calculator Calculator function
   * @returns Promise<T> Cached value
   */
  private async getCachedValue<T>(
    key: string,
    calculator: () => Promise<T>,
  ): Promise<T> {
    const release = await this.cacheMutex.acquire();
    try {
      const startTime = performance.now();
      const cached = this.statsCache.get(key);
      const now = Date.now();

      // Remove duplicates from the cacheQueue.
      const existingIndex = this.cacheQueue.indexOf(key);
      if (existingIndex !== -1) {
        this.cacheQueue.splice(existingIndex, 1);
      }
      // Manage cache size: remove oldest if necessary.
      if (this.statsCache.size >= this.maxCacheSize) {
        const oldestKey = this.cacheQueue.shift();
        if (oldestKey) this.statsCache.delete(oldestKey);
      }
      this.cacheQueue.push(key);

      if (
        cached &&
        now - cached.timestamp < BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL
      ) {
        return cached.value as T;
      }

      const value = await this.executeWithCircuitBreaker(key, () =>
        this.executeWithTimeout(this.executeWithRetry(() => calculator())),
      );
      this.statsCache.set(key, { value, timestamp: now });

      this.getMetricsCollector()?.histogram(
        'blockchain_stats_calculation_time',
        performance.now() - startTime,
      );
      this.getMetricsCollector()?.gauge(
        `blockchain_stats_last_update.${key}`,
        now,
      );
      this.getMetricsCollector()?.gauge(
        'blockchain_stats_cache_size',
        this.statsCache.size,
      );

      this.cacheIndex.set(this.blockchain.getHeight(), key);
      return value;
    } catch (error: unknown) {
      this.getMetricsCollector()
        ?.counter('blockchain_stats_errors')
        .inc({
          stat: key,
          error: (error as Error).name,
        });
      throw error;
    } finally {
      release();
    }
  }

  /**
   * Executes operation with retry
   * @param operation Operation to execute
   * @returns Promise<T> Result of operation
   */
  @retry({
    maxAttempts: 3,
    delay: 1000,
    exponentialBackoff: true,
  })
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }

  /**
   * Executes operation with timeout
   * @param promise Promise to execute
   * @param timeoutMs Timeout in milliseconds
   * @returns Promise<T> Result of operation
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number = 5000,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Gets voting stats
   * @returns Promise<{ currentPeriod: number; blocksUntilNextVoting: number; participationRate: number; powWeight: number; votingWeight: number; }> Voting stats
   */
  public async getVotingStats(): Promise<{
    currentPeriod: number;
    blocksUntilNextVoting: number;
    participationRate: number;
    powWeight: number;
    votingWeight: number;
  }> {
    return this.getCachedValue('votingStats', async () => {
      const currentHeight = await this.validateHeight();
      const consensusMetrics = await this.validateConsensusMetrics();

      const currentPeriod = Math.floor(
        currentHeight /
          BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_BLOCKS,
      );
      const nextVotingHeight =
        (currentPeriod + 1) *
        BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_BLOCKS;

      return {
        currentPeriod,
        blocksUntilNextVoting: nextVotingHeight - currentHeight,
        participationRate: consensusMetrics.currentParticipation,
        powWeight: BLOCKCHAIN_CONSTANTS.CONSENSUS.POW_WEIGHT,
        votingWeight: BLOCKCHAIN_CONSTANTS.CONSENSUS.VALIDATOR_WEIGHT,
      };
    });
  }

  /**
   * Validates blockchain height
   * @returns Promise<number> Blockchain height
   */
  private async validateHeight(): Promise<number> {
    const height = this.blockchain.getHeight();
    if (height < 10) {
      throw new BlockchainStatsError(
        'Insufficient blockchain height',
        'INSUFFICIENT_HEIGHT',
      );
    }
    return height;
  }

  /**
   * Validates consensus metrics
   * @returns Promise<{ powHashrate: number; activeVoters: number; participation: number; currentParticipation: number; }> Consensus metrics
   */
  private async validateConsensusMetrics() {
    const metrics = await this.blockchain.getConsensusMetrics();
    if (!metrics) {
      throw new Error('Failed to fetch consensus metrics');
    }
    return metrics;
  }

  /**
   * Gets orphan rate
   * @returns Promise<number> Orphan rate
   */
  public async getOrphanRate(): Promise<number> {
    return this.getCachedValue('orphanRate', async () => {
      try {
        const currentHeight = this.blockchain.getHeight();
        if (currentHeight < 1) {
          throw new BlockchainStatsError(
            'Invalid blockchain height',
            'INVALID_HEIGHT',
          );
        }

        const windowSize = BLOCKCHAIN_CONSTANTS.MINING.ORPHAN_WINDOW;
        if (windowSize <= 0) return 0;

        const startHeight = Math.max(0, currentHeight - windowSize);
        let orphanCount = 0;

        // Process in batches using array methods
        const batchCount = Math.ceil(
          (currentHeight - startHeight) / this.BATCH_SIZE,
        );
        const batches = Array.from({ length: batchCount }, (_, i) => ({
          start: startHeight + i * this.BATCH_SIZE,
          end: Math.min(startHeight + (i + 1) * this.BATCH_SIZE, currentHeight),
        }));

        await Promise.all(
          batches.map(async ({ start, end }) => {
            const blocks = await Promise.all(
              Array.from({ length: end - start }, (_, idx) =>
                this.blockchain.getBlockByHeight(start + idx),
              ),
            );

            blocks.slice(0, -1).forEach((block, idx) => {
              if (
                block &&
                blocks[idx + 1] &&
                blocks[idx + 1]?.header?.previousHash !== block?.hash
              ) {
                orphanCount++;
              }
            });
          }),
        );

        return orphanCount / windowSize;
      } catch (error) {
        Logger.error('Error calculating orphan rate:', error);
        this.getMetricsCollector()
          ?.counter('blockchain_stats_errors')
          .inc({
            method: 'getOrphanRate',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        return 0;
      }
    });
  }

  /**
   * Gets consensus health
   * @returns Promise<{ powHashrate: number; activeVoters: number; consensusParticipation: number; isHealthy: boolean; }> Consensus health
   */
  public async getConsensusHealth(): Promise<{
    powHashrate: number;
    activeVoters: number;
    consensusParticipation: number;
    isHealthy: boolean;
  }> {
    return this.getCachedValue('consensusHealth', async () => {
      try {
        const metrics = await this.blockchain.getConsensusMetrics();
        const minHealthyParticipation = 0.5;

        return {
          powHashrate: metrics.powHashrate || 0,
          activeVoters: metrics.activeVoters || 0,
          consensusParticipation: metrics.participation || 0,
          isHealthy: (metrics.participation || 0) >= minHealthyParticipation,
        };
      } catch (error) {
        Logger.error('Error calculating consensus health:', error);
        return {
          powHashrate: 0,
          activeVoters: 0,
          consensusParticipation: 0,
          isHealthy: false,
        };
      }
    });
  }

  /**
   * Gets average block time
   * @returns Promise<number> Average block time
   */
  public async getAverageBlockTime(): Promise<number> {
    return this.getCachedValue('blockTime', async () => {
      try {
        const currentHeight = this.blockchain.getHeight();
        if (currentHeight < 1) {
          throw new BlockchainStatsError(
            'Invalid blockchain height',
            'INVALID_HEIGHT',
          );
        }

        const blocks = Array.from({ length: 10 }, (_, i) =>
          this.blockchain.getBlockByHeight(currentHeight - i),
        ).filter(Boolean);

        if (blocks.length < 2) {
          Logger.warn('Insufficient blocks for average block time calculation');
          return 600;
        }

        const times = blocks.map((b) => {
          if (!b?.header?.timestamp) {
            throw new BlockchainStatsError(
              'Invalid block timestamp',
              'INVALID_TIMESTAMP',
            );
          }
          return b.header.timestamp;
        });

        let totalTimeDiff = 0;
        let validPairs = 0;

        for (let i = 0; i < times.length - 1; i++) {
          const timeDiff = (times[i] - times[i + 1]) / 1000;
          if (timeDiff > 0) {
            totalTimeDiff += timeDiff;
            validPairs++;
          }
        }

        if (validPairs === 0) {
          Logger.warn('No valid block time pairs found');
          return 600;
        }

        return totalTimeDiff / validPairs;
      } catch (error) {
        Logger.error('Error calculating average block time:', error);
        this.getMetricsCollector()
          ?.counter('blockchain_stats_errors')
          .inc({
            method: 'getAverageBlockTime',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        return 600;
      }
    });
  }

  /**
   * Gets block propagation stats
   * @returns Promise<{ average: number; median: number; }> Block propagation stats
   */
  public async getBlockPropagationStats(): Promise<{
    average: number;
    median: number;
  }> {
    return this.getCachedValue('propagation', async () => {
      const currentHeight = await this.validateHeight();
      this.validateInput(
        BLOCKCHAIN_CONSTANTS.MINING.PROPAGATION_WINDOW,
        (v) =>
          v > 0 &&
          v <= (BLOCKCHAIN_CONSTANTS.MINING.MAX_PROPAGATION_WINDOW || 10000),
        'Invalid propagation window size',
      );

      const batchSize = 100;
      const startHeight = Math.max(
        0,
        currentHeight - BLOCKCHAIN_CONSTANTS.MINING.PROPAGATION_WINDOW,
      );
      const propagationTimes: number[] = [];

      // Process blocks in batches using array methods
      const batchCount = Math.ceil((currentHeight - startHeight) / batchSize);
      const batches = Array.from({ length: batchCount }, (_, i) => ({
        start: startHeight + i * batchSize,
        end: Math.min(startHeight + (i + 1) * batchSize, currentHeight),
      }));

      await Promise.all(
        batches.map(async ({ start, end }) => {
          const blocks = await Promise.all(
            Array.from({ length: end - start }, (_, i) =>
              this.blockchain.getBlockByHeight(start + i),
            ),
          );

          blocks.forEach((block) => {
            if (block?.metadata?.receivedTimestamp) {
              const time =
                block.metadata.receivedTimestamp - block.header.timestamp;
              if (
                time > 0 &&
                time < BLOCKCHAIN_CONSTANTS.MINING.MAX_PROPAGATION_TIME
              ) {
                propagationTimes.push(time);
              }
            }
          });
        }),
      );

      if (propagationTimes.length === 0) {
        return { average: 0, median: 0 };
      }

      const totalTime = propagationTimes.reduce((sum, time) => sum + time, 0);
      const average = totalTime / propagationTimes.length;
      const median = this.quickselectMedian(propagationTimes);

      return { average, median };
    });
  }

  private quickselectMedian(arr: number[]): number {
    if (arr.length === 0) return 0;
    const k = Math.floor(arr.length / 2);
    this.quickselect(arr, 0, arr.length - 1, k);
    return arr[k];
  }

  private quickselect(
    arr: number[],
    left: number,
    right: number,
    k: number,
  ): void {
    while (left < right) {
      const pivotIndex = this.partition(arr, left, right);
      if (pivotIndex === k) {
        return;
      } else if (pivotIndex < k) {
        left = pivotIndex + 1;
      } else {
        right = pivotIndex - 1;
      }
    }
  }

  private partition(arr: number[], left: number, right: number): number {
    const pivot = arr[right];
    let i = left;
    for (let j = left; j < right; j++) {
      if (arr[j] < pivot) {
        [arr[i], arr[j]] = [arr[j], arr[i]];
        i++;
      }
    }
    [arr[i], arr[right]] = [arr[right], arr[i]];
    return i;
  }

  /**
   * Gets chain stats
   * @returns Promise<{ totalBlocks: number; totalTransactions: number; averageBlockSize: number; difficulty: number; }> Chain stats
   */
  public async getChainStats(): Promise<{
    totalBlocks: number;
    totalTransactions: number;
    averageBlockSize: number;
    difficulty: number;
  }> {
    return this.getCachedValue('chainStats', async () => {
      try {
        const chain = this.blockchain.getState().chain;
        if (!chain || chain.length === 0) {
          throw new BlockchainStatsError(
            'Empty blockchain state',
            'EMPTY_CHAIN',
          );
        }

        const { totalTransactions, totalSize } = chain.reduce(
          (acc, block) => {
            if (!block) {
              throw new BlockchainStatsError(
                'Invalid block in chain',
                'INVALID_BLOCK',
              );
            }
            return {
              totalTransactions:
                acc.totalTransactions + block.transactions.length,
              totalSize: acc.totalSize + this.calculateBlockSize(block),
            };
          },
          { totalTransactions: 0, totalSize: 0 },
        );

        const stats = {
          totalBlocks: chain.length,
          totalTransactions,
          averageBlockSize: totalSize / chain.length,
          difficulty: this.blockchain.getCurrentDifficulty(),
        };

        // Log successful stats calculation
        this.getMetricsCollector()?.gauge(
          'blockchain_stats_total_blocks',
          stats.totalBlocks,
        );
        this.getMetricsCollector()?.gauge(
          'blockchain_stats_total_transactions',
          stats.totalTransactions,
        );
        this.getMetricsCollector()?.gauge(
          'blockchain_stats_average_block_size',
          stats.averageBlockSize,
        );

        return stats;
      } catch (error) {
        Logger.error('Failed to calculate chain stats:', error);
        this.getMetricsCollector()
          ?.counter('blockchain_stats_errors')
          .inc({
            method: 'getChainStats',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        throw new BlockchainStatsError(
          'Failed to calculate chain stats',
          'CHAIN_STATS_CALCULATION_FAILED',
          { originalError: error },
        );
      }
    });
  }

  /**
   * Calculates block size
   * @param block Block to calculate size for
   * @returns number Block size
   */
  private calculateBlockSize(block: Block): number {
    try {
      // Calculate header size
      const headerSize = Buffer.byteLength(JSON.stringify(block.header));

      // Calculate transactions size
      const transactionsSize = block.transactions.reduce((sum, tx) => {
        return sum + (tx.hash ? Buffer.byteLength(tx.hash) : 0);
      }, 0);

      return headerSize + transactionsSize;
    } catch (error) {
      Logger.error('Error calculating block size:', error);
      this.getMetricsCollector()
        ?.counter('blockchain_stats_errors')
        .inc({
          method: 'calculateBlockSize',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      return 0;
    }
  }

  /**
   * Gets network hash rate
   * @returns Promise<number> Network hash rate
   */
  public async getNetworkHashRate(): Promise<number> {
    try {
      const currentBlock = this.blockchain.getLatestBlock();
      if (!currentBlock) {
        throw new BlockchainStatsError('No current block', 'NO_CURRENT_BLOCK');
      }

      const difficulty = currentBlock.header.difficulty;
      const blockTime = await this.getAverageBlockTime();

      // Avoid division by zero
      if (blockTime <= 0) {
        Logger.warn('Invalid block time for hash rate calculation');
        return 0;
      }

      // Network hash rate = difficulty * 2^32 / blockTime
      return Number(
        (BigInt(difficulty) * BigInt(Math.pow(2, 32))) / BigInt(blockTime),
      );
    } catch (error) {
      Logger.error('Failed to calculate network hash rate:', error);
      this.getMetricsCollector()
        ?.counter('blockchain_stats_errors')
        .inc({
          method: 'getNetworkHashRate',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      throw new BlockchainStatsError(
        'Failed to calculate network hash rate',
        'HASH_RATE_CALCULATION_FAILED',
        { originalError: error },
      );
    }
  }

  /**
   * Validates input
   * @param value Value to validate
   * @param validator Validator function
   * @param errorMessage Error message
   */
  private validateInput<T>(
    value: T,
    validator: (v: T) => boolean,
    errorMessage: string,
  ): void {
    if (!validator(value)) {
      throw new Error(errorMessage);
    }
  }

  /**
   * Executes operation with circuit breaker
   * @param key Key to execute operation for
   * @param operation Operation to execute
   * @returns Promise<T> Result of operation
   */
  private async executeWithCircuitBreaker<T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const breaker = this.circuitBreaker.get(key) || {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
    };

    if (breaker.isOpen) {
      const cooldownTime = 60000; // 1 minute
      if (Date.now() - breaker.lastFailure < cooldownTime) {
        throw new Error('Circuit breaker is open');
      }
      breaker.isOpen = false;
    }

    try {
      const result = await operation();
      breaker.failures = 0;
      this.circuitBreaker.set(key, breaker);
      try {
        await this.saveCircuitBreakerState();
      } catch (stateError) {
        Logger.error('Failed to save circuit breaker state:', stateError);
      }
      return result;
    } catch (error) {
      breaker.failures++;
      breaker.lastFailure = Date.now();
      breaker.isOpen = breaker.failures >= 5;
      this.circuitBreaker.set(key, breaker);
      try {
        await this.saveCircuitBreakerState();
      } catch (stateError) {
        Logger.error(
          'Failed to save circuit breaker state after error:',
          stateError,
        );
      }
      throw error;
    }
  }

  private async startCacheCleanup(): Promise<void> {
    this.cleanupIntervalId = setInterval(async () => {
      await this.cacheMutex.runExclusive(() => {
        const now = Date.now();
        this.statsCache.forEach((entry, key) => {
          if (now - entry.timestamp > BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL) {
            Logger.debug(`Cache expired for ${key}`);
            this.statsCache.delete(key);
          }
        });
        this.metricsCollector?.gauge(
          'blockchain_stats_cache_size',
          this.statsCache.size,
        );
      });
    }, this.cleanupInterval);
  }

  /**
   * Cleans up resources
   */
  public cleanup(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
    if (this.saveIntervalId) {
      clearInterval(this.saveIntervalId);
    }
    this.saveCircuitBreakerState().catch((error) => {
      Logger.error(
        'Failed to save circuit breaker state during cleanup:',
        error,
      );
    });
    this.statsCache.clear();
    this.circuitBreaker.clear();
    this.cacheQueue.length = 0;
    this.cacheIndex.clear();
    this.metricsCollector?.cleanup();
    this.cacheMutex.cancel(); // Ensure no pending operations.
  }

  /**
   * Handles error
   * @param error Error to handle
   * @param context Context to handle error for
   * @returns never
   */
  private handleError(error: Error, context: string): never {
    const errorCode =
      error instanceof BlockchainStatsError ? error.code : 'UNKNOWN_ERROR';
    this.getMetricsCollector()?.counter('blockchain_stats_errors').inc({
      context,
      error: errorCode,
    });
    throw new BlockchainStatsError(error.message, errorCode, {
      context,
      originalError: error,
    });
  }

  public async getMedianTime(): Promise<number> {
    return this.getCachedValue('medianTime', async () => {
      try {
        const blocks = Array.from({ length: 11 }, (_, i) =>
          this.blockchain.getBlockByHeight(this.blockchain.getHeight() - i),
        ).filter(Boolean);

        if (blocks.length < 1) return Date.now();

        const times = blocks.map((b) => b?.header?.timestamp);
        const sorted = [...times].sort((a, b) => (a || 0) - (b || 0));
        return sorted[Math.floor(sorted.length / 2)];
      } catch (error) {
        Logger.error('Error calculating median time:', error);
        return Date.now();
      }
    }) as Promise<number>;
  }

  private getMetricsCollector() {
    if (!this.metricsCollector) {
      this.metricsCollector = new MetricsCollector('blockchain_stats');
    }
    return this.metricsCollector;
  }

  private async saveCircuitBreakerState(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const data = JSON.stringify({
        timestamp: Date.now(),
        circuitBreaker: Array.from(this.circuitBreaker.entries()),
      });

      const storagePath = path.join(
        process.cwd(),
        'data',
        'circuit_breaker_state.json',
      );
      await fs.mkdir(path.dirname(storagePath), { recursive: true });
      await fs.writeFile(storagePath, data, 'utf8');

      this.getMetricsCollector()?.gauge('circuit_breaker_state_saved', 1);
    } catch (error) {
      Logger.error('Failed to save circuit breaker state:', error);
      this.getMetricsCollector()
        ?.counter('circuit_breaker_errors')
        .inc({
          operation: 'save',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
  }

  private async loadCircuitBreakerState(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const storagePath = path.join(
        process.cwd(),
        'data',
        'circuit_breaker_state.json',
      );
      const data = await fs.readFile(storagePath, 'utf8');
      const parsed = JSON.parse(data);

      // Validate the loaded data
      if (
        !parsed ||
        !parsed.circuitBreaker ||
        !Array.isArray(parsed.circuitBreaker)
      ) {
        throw new Error('Invalid circuit breaker state format');
      }

      // Convert array back to Map
      this.circuitBreaker = new Map(parsed.circuitBreaker);

      this.getMetricsCollector()?.gauge('circuit_breaker_state_loaded', 1);
    } catch (error) {
      if (
        error instanceof Error &&
        (error as unknown as { code?: string }).code !== 'ENOENT'
      ) {
        // Ignore file not found errors
        Logger.error('Failed to load circuit breaker state:', error);
        this.getMetricsCollector()
          ?.counter('circuit_breaker_errors')
          .inc({
            operation: 'load',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
      }
    }
  }

  private startCircuitBreakerSaving(): void {
    this.saveIntervalId = setInterval(async () => {
      try {
        await this.saveCircuitBreakerState();
      } catch (error) {
        Logger.error('Failed to save circuit breaker state:', error);
      }
    }, this.SAVE_INTERVAL);
  }
}
