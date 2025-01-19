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
import { UTXO } from '@h3tag-blockchain/core';

// Create interface for what BlockchainStats needs
interface IBlockchainData {
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
  private readonly statsCache: Map<
    string,
    { value: unknown; timestamp: number }
  >;
  private readonly maxCacheSize = 1000; // Prevent unlimited growth
  private readonly metricsCollector: MetricsCollector;
  private circuitBreaker = new Map<
    string,
    {
      failures: number;
      lastFailure: number;
      isOpen: boolean;
    }
  >();
  private readonly cleanupInterval = 300000; // 5 minutes

  /**
   * Constructor for BlockchainStats
   * @param blockchain Blockchain data
   */
  constructor(blockchain: IBlockchainData) {
    this.blockchain = blockchain;
    this.statsCache = new Map();
    this.metricsCollector = new MetricsCollector('blockchain_stats');
    this.initializeMetrics();
    this.startCacheCleanup();
  }

  /**
   * Initializes metrics
   */
  private initializeMetrics(): void {
    this.metricsCollector.gauge(
      'blockchain_stats_cache_size',
      () => this.statsCache.size,
    );
    this.metricsCollector.gauge('blockchain_stats_last_update.voting_stats', 0);
    this.metricsCollector.gauge(
      'blockchain_stats_last_update.consensus_health',
      0,
    );
    this.metricsCollector.gauge('blockchain_stats_last_update.chain_stats', 0);
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
    const startTime = performance.now();
    try {
      const cached = this.statsCache.get(key);
      const now = Date.now();

      // Manage cache size
      if (this.statsCache.size > this.maxCacheSize) {
        const oldestKey = Array.from(this.statsCache.entries()).sort(
          ([, a], [, b]) => a.timestamp - b.timestamp,
        )[0][0];
        this.statsCache.delete(oldestKey);
      }

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

      // Update all relevant metrics
      this.metricsCollector.histogram(
        'blockchain_stats_calculation_time',
        performance.now() - startTime,
      );
      this.metricsCollector.gauge(`blockchain_stats_last_update.${key}`, now);
      this.metricsCollector.gauge(
        'blockchain_stats_cache_size',
        this.statsCache.size,
      );

      return value;
    } catch (error: unknown) {
      // Add error type to metrics
      this.metricsCollector.counter('blockchain_stats_errors').inc({
        stat: key,
        error: (error as Error).name,
      });
      throw error;
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
    if (height < 0) {
      throw new Error('Invalid blockchain height');
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
        const startHeight = Math.max(
          0,
          currentHeight - BLOCKCHAIN_CONSTANTS.MINING.ORPHAN_WINDOW,
        );
        let orphanCount = 0;

        // Guard against zero window size
        if (BLOCKCHAIN_CONSTANTS.MINING.ORPHAN_WINDOW <= 0) {
          return 0;
        }

        // Batch fetch blocks with proper memory management
        const batchSize = 1000;

        for (let i = startHeight; i < currentHeight; i += batchSize) {
          const endHeight = Math.min(i + batchSize, currentHeight);
          const blocks = await Promise.all(
            Array.from({ length: endHeight - i }, (_, idx) =>
              this.blockchain.getBlockByHeight(i + idx),
            ),
          );

          for (let j = 0; j < blocks.length - 1; j++) {
            if (
              blocks[j] &&
              blocks[j + 1] &&
              blocks[j + 1]?.header?.previousHash !== blocks[j]?.hash
            ) {
              orphanCount++;
            }
          }
        }

        return orphanCount / BLOCKCHAIN_CONSTANTS.MINING.ORPHAN_WINDOW;
      } catch (error) {
        Logger.error('Error calculating orphan rate:', error);
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
        const blocks = Array.from({ length: 10 }, (_, i) =>
          this.blockchain.getBlockByHeight(this.blockchain.getHeight() - i),
        ).filter(Boolean);

        if (blocks.length < 2) return 600;

        const times = blocks.map((b) => b?.header?.timestamp || 0);
        const avgTime =
          times
            .slice(0, -1)
            .map((time, i) =>
              time && times[i + 1] ? (time - times[i + 1]) / 1000 : 600,
            )
            .reduce((a, b) => a + b, 0) /
          (times.length - 1);

        return avgTime || 600;
      } catch (error) {
        Logger.error('Error calculating average block time:', error);
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
        (v) => v > 0 && v <= 10000,
        'Invalid propagation window size',
      );
      const batchSize = 100;
      const startHeight = Math.max(
        0,
        currentHeight - BLOCKCHAIN_CONSTANTS.MINING.PROPAGATION_WINDOW,
      );
      const propagationTimes: number[] = [];

      // Process blocks in batches
      for (
        let height = startHeight;
        height < currentHeight;
        height += batchSize
      ) {
        const endHeight = Math.min(height + batchSize, currentHeight);
        const blocks = await Promise.all(
          Array.from({ length: endHeight - height }, (_, i) =>
            this.blockchain.getBlockByHeight(height + i),
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
      }

      if (propagationTimes.length === 0) {
        return { average: 0, median: 0 };
      }

      const average =
        propagationTimes.reduce((a, b) => a + b, 0) / propagationTimes.length;
      const sorted = propagationTimes.sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];

      return { average, median };
    });
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
        let totalTransactions = 0;
        let totalSize = 0;

        chain.forEach((block) => {
          totalTransactions += block.transactions.length;
          totalSize += this.calculateBlockSize(block);
        });

        return {
          totalBlocks: chain.length,
          totalTransactions,
          averageBlockSize: totalSize / chain.length,
          difficulty: this.blockchain.getCurrentDifficulty(),
        };
      } catch (error) {
        return this.handleError(error as Error, 'getChainStats');
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
      return Buffer.byteLength(
        JSON.stringify({
          header: block.header,
          transactions: block.transactions.map((tx) => tx.hash),
        }),
      );
    } catch (error) {
      Logger.error('Error calculating block size:', error);
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
      if (!currentBlock) return 0;

      const difficulty = currentBlock.header.difficulty;
      const blockTime = await this.getAverageBlockTime();

      // Avoid division by zero
      if (blockTime <= 0) return 0;

      // Network hash rate = difficulty * 2^32 / blockTime
      return (difficulty * Math.pow(2, 32)) / blockTime;
    } catch (error) {
      Logger.error('Error calculating network hash rate:', error);
      return 0;
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
      return result;
    } catch (error) {
      breaker.failures++;
      breaker.lastFailure = Date.now();
      breaker.isOpen = breaker.failures >= 5;
      this.circuitBreaker.set(key, breaker);
      throw error;
    }
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.statsCache.entries()) {
        if (now - entry.timestamp > BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL) {
          this.statsCache.delete(key);
        }
      }
      this.metricsCollector.gauge(
        'blockchain_stats_cache_size',
        this.statsCache.size,
      );
    }, this.cleanupInterval);
  }

  /**
   * Cleans up resources
   */
  public cleanup(): void {
    clearInterval(this.cleanupInterval);
    this.statsCache.clear();
    this.circuitBreaker.clear();
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
    this.metricsCollector.counter('blockchain_stats_errors').inc({
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
}
