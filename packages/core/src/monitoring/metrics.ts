import { Logger } from '@h3tag-blockchain/shared';
import { Mutex } from 'async-mutex';

/**
 * @fileoverview Core metrics tracking system for the H3Tag blockchain. Includes performance metrics,
 * mining statistics, and network monitoring for blockchain operations and analysis.
 *
 * @module CoreMetrics
 */

/**
 * @class CoreMetrics
 * @description Core metrics tracking and management for blockchain operations
 *
 * @property {Object} metrics - Storage for various metric types
 * @property {number[]} metrics.hashRate - Array of hash rate measurements
 * @property {number[]} metrics.timestamp - Array of measurement timestamps
 * @property {number[]} metrics.tagVolume - Array of TAG volume measurements
 * @property {number[]} metrics.tagFees - Array of TAG fee measurements
 * @property {number} blockHeight - Current block height
 * @property {number} syncedHeaders - Number of synced headers
 * @property {number} syncedBlocks - Number of synced blocks
 * @property {number} whitelistedPeers - Number of whitelisted peers
 * @property {number} blacklistedPeers - Number of blacklisted peers
 * @property {number} hashRate - Current hash rate
 * @property {number} difficulty - Current mining difficulty
 * @property {number} totalBlocks - Total blocks processed
 * @property {number} successfulBlocks - Successfully mined blocks
 * @property {number} lastBlockTime - Timestamp of last block
 * @property {number} lastMiningTime - Duration of last mining operation
 *
 * @example
 * const metrics = new CoreMetrics();
 * metrics.gauge("hash_rate", 1000000);
 * const avgHashRate = metrics.getAverageHashRate();
 */
export class MiningMetrics {
  public totalBlocks: number = 0;
  public successfulBlocks: number = 0;
  public lastMiningTime: number = 0;
  public averageHashRate: number = 0;
  public totalTAGMined: number = 0;
  public currentBlockReward: number = 0;
  public tagTransactionsCount: number = 0;
  public timestamp: bigint = BigInt(0);
  public blockHeight: number = 0;
  public hashRate: number = 0;
  public difficulty: number = 0;
  public blockTime: number = 0;
  public tagVolume: number = 0;
  public tagFees: number = 0;
  public lastBlockTime: number = Date.now();
  public syncedHeaders: number = 0;
  public syncedBlocks: number = 0;
  public whitelistedPeers: number = 0;
  public blacklistedPeers: number = 0;
  private static instance: MiningMetrics;
  private metrics: {
    hashRate: number[];
    difficulty: number[];
    blockTimes: number[];
    timestamps: bigint[];
    tagVolume: number[];
    tagFees: number[];
  };
  private readonly mutex = new Mutex();

  private constructor() {
    this.metrics = {
      hashRate: [],
      difficulty: [],
      blockTimes: [],
      timestamps: [],
      tagVolume: [],
      tagFees: [],
    };
  }

  public static getInstance(): MiningMetrics {
    if (!MiningMetrics.instance) {
      MiningMetrics.instance = new MiningMetrics();
    }
    return MiningMetrics.instance;
  }

  public async updateMetrics(data: {
    hashRate?: number;
    difficulty?: number;
    blockTime?: number;
    tagVolume?: number;
    tagFees?: number;
  }): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      const now = Date.now();
      const currentTimestamp = BigInt(now);
      // For any metric update that will be averaged later, push the current timestamp.
      // Here we assume that if any metric is updated it should use the same timestamp.
      // If individual timestamps are needed, consider separate arrays.

      // Update hashRate if provided
      if (data.hashRate !== undefined && !isNaN(data.hashRate)) {
        this.metrics.hashRate.push(data.hashRate);
        this.metrics.timestamps.push(currentTimestamp);
        this.hashRate = data.hashRate; // current value update
      }
      // Update difficulty if provided (and record its timestamp for consistency)
      if (data.difficulty !== undefined && !isNaN(data.difficulty)) {
        this.metrics.difficulty.push(data.difficulty);
        this.metrics.timestamps.push(currentTimestamp);
        this.difficulty = data.difficulty;
      }
      // Update blockTime if provided (and record its timestamp)
      if (data.blockTime !== undefined && !isNaN(data.blockTime)) {
        this.lastBlockTime = now;
        this.metrics.blockTimes.push(data.blockTime);
        this.metrics.timestamps.push(currentTimestamp);
        this.blockTime = data.blockTime;
      }
      // Update tagVolume if provided
      if (data.tagVolume !== undefined && !isNaN(data.tagVolume)) {
        this.metrics.tagVolume.push(data.tagVolume);
        this.metrics.timestamps.push(currentTimestamp);
        this.tagVolume = data.tagVolume;
      }
      // Update tagFees if provided
      if (data.tagFees !== undefined && !isNaN(data.tagFees)) {
        this.metrics.tagFees.push(data.tagFees);
        this.metrics.timestamps.push(currentTimestamp);
        this.tagFees = data.tagFees;
      }

      this.cleanupOldMetrics(now);
    } finally {
      release();
    }
  }

  private cleanupOldMetrics(now: number): void {
    const cutoff = now - 24 * 60 * 60 * 1000; // 24 hours in ms
    const startIdx = this.metrics.timestamps.findIndex(
      (t) => Number(t) > cutoff,
    );

    if (startIdx === -1) {
      // Clear all arrays if no data is newer than the cutoff
      this.metrics.timestamps = [];
      this.metrics.hashRate = [];
      this.metrics.difficulty = [];
      this.metrics.blockTimes = [];
      this.metrics.tagVolume = [];
      this.metrics.tagFees = [];
    } else if (startIdx > 0) {
      this.metrics.timestamps = this.metrics.timestamps.slice(startIdx);
      // Ensure all related metric arrays are sliced to maintain index alignment
      ['hashRate', 'difficulty', 'blockTimes', 'tagVolume', 'tagFees'].forEach(
        (key) => {
          if (key in this.metrics) {
            (this.metrics[
              key as
                | 'hashRate'
                | 'difficulty'
                | 'blockTimes'
                | 'tagVolume'
                | 'tagFees'
            ] as number[]) =
              this.metrics[
                key as
                  | 'hashRate'
                  | 'difficulty'
                  | 'blockTimes'
                  | 'tagVolume'
                  | 'tagFees'
              ].slice(startIdx);
          }
        },
      );
    }
  }

  /**
   * Get average hash rate over specified time window
   * @param {number} [timeWindow=3600000] - Time window in milliseconds (default: 1 hour)
   * @returns {number} Average hash rate or 0 if no data
   */
  public getAverageHashRate(timeWindow: number = 3600000): number {
    try {
      if (!this.metrics.hashRate.length || !this.metrics.timestamps.length) {
        return 0;
      }

      const cutoff = Date.now() - timeWindow;
      const startIdx = this.metrics.timestamps.findIndex(
        (t) => Number(t) > cutoff,
      );

      if (startIdx === -1) return 0;

      const recentHashes = this.metrics.hashRate.slice(startIdx);
      return recentHashes.length > 0
        ? recentHashes.reduce((a, b) => a + b, 0) / recentHashes.length
        : 0;
    } catch (error) {
      Logger.error('Error calculating average hash rate:', error);
      return 0;
    }
  }

  /**
   * Get average TAG volume over specified time window
   * @param {number} [timeWindow=3600000] - Time window in milliseconds (default: 1 hour)
   * @returns {number} Average TAG volume or 0 if no data
   */
  getAverageTAGVolume(timeWindow: number = 3600000): number {
    try {
      if (!this.metrics.tagVolume.length || !this.metrics.timestamps.length) {
        Logger.debug('No TAG volume data available for averaging');
        return 0;
      }

      const cutoff = Date.now() - timeWindow;
      const startIdx = this.metrics.timestamps.findIndex(
        (t) => Number(t) > cutoff,
      );
      if (startIdx === -1) {
        Logger.debug('No TAG volume data within specified timeWindow');
        return 0;
      }

      let sum = 0;
      let count = 0;
      for (let i = startIdx; i < this.metrics.tagVolume.length; i++) {
        const volume = this.metrics.tagVolume[i];
        if (typeof volume === 'number' && !isNaN(volume)) {
          sum += volume;
          count++;
        }
      }

      const average = count > 0 ? Number((sum / count).toFixed(8)) : 0;
      Logger.debug(
        `Calculated average TAG volume: ${average} over ${timeWindow}ms`,
      );
      return average;
    } catch (error) {
      Logger.error('Error calculating average TAG volume:', error);
      return 0;
    }
  }

  /**
   * Get average TAG transaction fees over specified time window
   * @param {number} [timeWindow=3600000] - Time window in milliseconds (default: 1 hour)
   * @returns {number} Average TAG fees or 0 if no data
   */
  getAverageTAGFees(timeWindow: number = 3600000): number {
    try {
      if (!this.metrics.tagFees.length || !this.metrics.timestamps.length) {
        Logger.debug('No TAG fee data available for averaging');
        return 0;
      }

      const cutoff = Date.now() - timeWindow;
      const startIdx = this.metrics.timestamps.findIndex(
        (t) => Number(t) > cutoff,
      );
      if (startIdx === -1) {
        Logger.debug('No TAG fee data within specified timeWindow');
        return 0;
      }

      let sum = 0;
      let count = 0;
      for (let i = startIdx; i < this.metrics.tagFees.length; i++) {
        const fee = this.metrics.tagFees[i];
        if (typeof fee === 'number' && !isNaN(fee)) {
          sum += fee;
          count++;
        }
      }

      const average = count > 0 ? Number((sum / count).toFixed(8)) : 0;
      Logger.debug(
        `Calculated average TAG fees: ${average} over ${timeWindow}ms`,
      );
      return average;
    } catch (error) {
      Logger.error('Error calculating average TAG fees:', error);
      return 0;
    }
  }

  /**
   * Record a mining error
   * @param {string} context - Error context
   */
  public recordError(context: string): void {
    try {
      Logger.error(`Mining error in ${context}`);
      this.updateMetrics({
        hashRate: 0,
        difficulty: this.difficulty,
        blockTime: 0,
      }).catch((err) =>
        Logger.error('Failed to update metrics on error:', err),
      );
    } catch (error) {
      Logger.error('Failed to record error:', error);
    }
  }

  /**
   * Set a gauge metric value
   * @param {string} name - Metric name
   * @param {number} value - Gauge value
   */
  public gauge(name: string, value: number): void {
    if (typeof value !== 'number' || isNaN(value)) {
      Logger.error(`Invalid gauge value for ${name}`);
      return;
    }

    try {
      switch (name) {
        case 'blocks_in_flight':
          this.blockHeight = value;
          break;
        case 'synced_headers':
          this.syncedHeaders = value;
          break;
        case 'synced_blocks':
          this.syncedBlocks = value;
          break;
        case 'whitelisted':
          this.whitelistedPeers = value;
          break;
        case 'blacklisted':
          this.blacklistedPeers = value;
          break;
        case 'hash_rate':
          this.hashRate = value;
          break;
        case 'difficulty':
          this.difficulty = value;
          break;
        default:
          Logger.warn(`Unknown metric gauge: ${name}`);
      }
    } catch (error) {
      Logger.error(`Failed to update gauge ${name}:`, error);
    }
  }

  /**
   * Record a failed mining attempt
   * @param {string} reason - Failure reason
   */
  public recordFailedMine(reason: string): void {
    this.totalBlocks++;
    this.lastMiningTime = Date.now() - this.lastBlockTime;
    this.hashRate = 0; // Reset hash rate on failure
    Logger.warn(`Mining failed: ${reason}`);
  }

  /**
   * Record a successful mining attempt
   */
  public recordSuccessfulMine(): void {
    this.totalBlocks++;
    this.successfulBlocks++;
    this.lastBlockTime = Date.now();
  }
}
