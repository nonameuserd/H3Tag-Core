import {
  BlockchainStats,
  IBlockchainData,
} from '../blockchain/blockchain-stats';
import { NetworkStats } from '../network/network-stats';
import { Logger } from '@h3tag-blockchain/shared';

/**
 * @fileoverview DifficultyAdjuster implements hybrid difficulty adjustment for H3Tag mining.
 * It combines Proof of Work difficulty with voting influence to create a balanced and
 * responsive difficulty adjustment mechanism.
 *
 * @module DifficultyAdjuster
 */

/**
 * DifficultyAdjuster manages mining difficulty adjustments with voting influence.
 *
 * @class DifficultyAdjuster
 *
 * @property {bigint} lastHashRate - Last recorded network hash rate
 * @property {number} TARGET_BLOCK_TIME - Target time between blocks (10 minutes)
 * @property {number} ADJUSTMENT_FACTOR - Maximum adjustment per period (25%)
 * @property {number} WINDOW_SIZE - Number of blocks for adjustment calculation
 * @property {number} HASH_RATE_WINDOW - Window size for hash rate calculations
 * @property {number} MAX_HASH_RATE_ADJUSTMENT - Maximum hash rate adjustment
 * @property {bigint[]} hashRateHistory - Historical hash rate data
 * @property {BlockchainStats} blockchainStats - Blockchain statistics manager
 * @property {NetworkStats} networkStats - Network statistics manager
 * @property {number} MIN_VOTES_WEIGHT - Minimum voting participation threshold
 * @property {number} VOTE_POWER_CAP - Maximum voting power per participant
 * @property {number} VOTE_INFLUENCE - Voting influence on difficulty (40%)
 *
 * @example
 * const adjuster = new DifficultyAdjuster(blockchain);
 * const newDifficulty = await adjuster.calculateNextDifficulty(
 *   currentDifficulty,
 *   blockTimes,
 *   hashRate,
 *   { participation: 0.15, approvalRate: 0.6 }
 * );
 */

/**
 * Calculates the next mining difficulty
 *
 * @async
 * @method calculateNextDifficulty
 * @param {number} currentDifficulty - Current mining difficulty
 * @param {number[]} blockTimes - Recent block times
 * @param {number} hashRate - Current network hash rate
 * @param {{ participation: number; approvalRate: number }} voteData - Voting statistics
 * @returns {Promise<number>} New difficulty value
 *
 * @example
 * const newDifficulty = await adjuster.calculateNextDifficulty(
 *   1000,
 *   [600000, 580000, 620000],
 *   15000,
 *   { participation: 0.2, approvalRate: 0.7 }
 * );
 */

/**
 * Calculates vote-based difficulty adjustment
 *
 * @private
 * @method calculateVoteAdjustment
 * @param {number} participation - Voting participation rate
 * @param {number} approvalRate - Vote approval rate
 * @returns {number} Vote-based adjustment factor
 */

/**
 * Calculates hash rate based difficulty adjustment
 *
 * @private
 * @method calculateHashRateAdjustment
 * @param {number} currentHashRate - Current network hash rate
 * @returns {number} Hash rate based adjustment factor
 */

/**
 * Calculates network health factor
 *
 * @private
 * @method calculateNetworkHealthFactor
 * @returns {Promise<number>} Network health adjustment factor
 */

/**
 * Calculates Exponential Moving Average
 *
 * @private
 * @method calculateEMA
 * @param {number[]} values - Values to average
 * @param {number} period - EMA period
 * @returns {number} EMA value
 */

/**
 * Calculates PoW-based difficulty adjustment
 *
 * @private
 * @method calculatePOWAdjustment
 * @param {number[]} blockTimes - Recent block times
 * @param {number} hashRate - Current network hash rate
 * @returns {number} PoW-based adjustment factor
 */
export class DifficultyAdjuster {
  private lastHashRate: bigint = BigInt(0);
  readonly TARGET_BLOCK_TIME = 600_000; // 10 minutes for H3Tag blocks
  private readonly ADJUSTMENT_FACTOR = 0.25; // 25% max adjustment
  private readonly WINDOW_SIZE = 2016; // ~2 weeks of blocks
  private readonly HASH_RATE_WINDOW = 72; // 12 hours of blocks at 10-min intervals
  private readonly MAX_HASH_RATE_ADJUSTMENT = 0.25; // 25% max adjustment
  private readonly hashRateHistory: bigint[] = [];
  private readonly blockchainStats: BlockchainStats;
  protected readonly networkStats: NetworkStats;
  private readonly MIN_VOTES_WEIGHT = 0.1; // Minimum voting participation for TAG governance
  private readonly VOTE_POWER_CAP = 0.1; // Maximum voting power per participant
  private readonly VOTE_INFLUENCE = 0.4; // Voting influence on difficulty (40%)
  private lastOrphanRate: number = 0;

  constructor(
    blockchain: IBlockchainData,
    networkStats: NetworkStats = new NetworkStats(),
  ) {
    this.blockchainStats = new BlockchainStats(blockchain);
    this.networkStats = networkStats;
  }

  async calculateNextDifficulty(
    currentDifficulty: number,
    blockTimes: number[],
    hashRate: number,
    voteData: {
      participation: number;
      approvalRate: number;
    },
  ): Promise<number> {
    let adjustment = this.calculatePOWAdjustment(blockTimes, hashRate);

    // Add hash rate adjustment
    const hashRateAdjustment = this.calculateHashRateAdjustment(hashRate);
    adjustment = adjustment * hashRateAdjustment;

    // Apply voting influence
    if (voteData.participation >= this.MIN_VOTES_WEIGHT) {
      const voteAdjustment = this.calculateVoteAdjustment(
        voteData.participation,
        voteData.approvalRate,
      );
      adjustment =
        adjustment * (1 - this.VOTE_INFLUENCE) +
        voteAdjustment * this.VOTE_INFLUENCE;
    }

    return Math.floor(
      currentDifficulty *
        Math.max(
          1 - this.ADJUSTMENT_FACTOR,
          Math.min(adjustment, 1 + this.ADJUSTMENT_FACTOR),
        ),
    );
  }

  private calculateVoteAdjustment(
    participation: number,
    approvalRate: number,
  ): number {
    const cappedParticipation = Math.min(Math.max(participation, 0), 1);
    const cappedApprovalRate = Math.min(Math.max(approvalRate, 0), 1);

    const participationWeight = cappedParticipation / this.MIN_VOTES_WEIGHT;
    const approvalWeight = cappedApprovalRate - 0.5; // Center around 50%

    return 1 + participationWeight * approvalWeight * this.ADJUSTMENT_FACTOR;
  }

  private calculateHashRateAdjustment(currentHashRate: number): number {
    // Add current hash rate to history
    this.hashRateHistory.push(BigInt(currentHashRate));
    if (this.hashRateHistory.length > this.HASH_RATE_WINDOW) {
      this.hashRateHistory.shift();
    }

    if (this.hashRateHistory.length < 6) {
      return 1.0;
    }

    const shortTermEMA = this.calculateEMA(
      this.hashRateHistory.slice(-6).map(Number),
      2,
    );
    const longTermEMA = this.calculateEMA(this.hashRateHistory.map(Number), 12);

    const hashRateChange = (shortTermEMA - longTermEMA) / longTermEMA;

    const adjustment =
      1 + this.sigmoid(hashRateChange) * this.MAX_HASH_RATE_ADJUSTMENT;

    const networkFactor = this.calculateNetworkHealthFactor();

    return Math.max(
      1 - this.MAX_HASH_RATE_ADJUSTMENT,
      Math.min(
        Number(adjustment) * Number(networkFactor),
        1 + this.MAX_HASH_RATE_ADJUSTMENT,
      ),
    );
  }

  private calculateEMA(values: number[], period: number): number {
    if (!values?.length || period <= 0) return 0;
    const alpha = 2 / (period + 1);
    let ema = values[0];

    for (let i = 1; i < values.length; i++) {
      const value = values[i];
      if (typeof value !== 'number' || isNaN(value) || !isFinite(value))
        continue;
      ema = value * alpha + ema * (1 - alpha);
    }

    return isFinite(ema) ? ema : 0;
  }

  private sigmoid(x: number): number {
    return 2 / (1 + Math.exp(-4 * x)) - 1;
  }

  private async calculateNetworkHealthFactor(): Promise<number> {
    try {
      const metrics = {
        orphanRate: await this.getOrphanRate().catch(() => 0),
        propagationTime: this.getAveragePropagationTime(),
        peerCount: this.getActivePeerCount(),
        networkLatency: await this.getAverageNetworkLatency().catch(() => 0),
      };

      const normalizedMetrics = {
        orphanRate: Math.min(Number(metrics.orphanRate || 0) / 0.05, 1),
        propagationTime: Math.min(
          Number(metrics.propagationTime || 0) / 30000,
          1,
        ),
        peerCount: Math.max(
          0,
          Math.min(((metrics.peerCount || 0) - 8) / 50, 1),
        ),
        networkLatency: Math.min(Number(metrics.networkLatency || 0) / 1000, 1),
      };

      const weights = {
        orphanRate: 0.4,
        propagationTime: 0.3,
        peerCount: 0.2,
        networkLatency: 0.1,
      };

      const healthScore = Object.keys(weights).reduce((score, metric) => {
        return (
          score +
          normalizedMetrics[metric as keyof typeof normalizedMetrics] *
            weights[metric as keyof typeof weights]
        );
      }, 0);

      return 0.9 + healthScore * 0.2;
    } catch (error) {
      Logger.error('Failed to calculate network health factor:', error);
      return 1.0; // Fallback to neutral health factor
    }
  }

  private async getOrphanRate(): Promise<number> {
    try {
      const orphanRate = await this.blockchainStats.getOrphanRate();

      if (isNaN(orphanRate) || orphanRate < 0) {
        Logger.warn('Invalid orphan rate detected, using default', {
          orphanRate,
        });
        return 0;
      }

      this.lastOrphanRate = orphanRate;

      return orphanRate;
    } catch (error) {
      Logger.error('Error calculating orphan rate:', error);
      return this.lastOrphanRate || 0;
    }
  }

  private getAveragePropagationTime(): number {
    return this.networkStats.getAveragePropagationTime();
  }

  private getActivePeerCount(): number {
    return this.networkStats.getActivePeerCount();
  }

  private async getAverageNetworkLatency(): Promise<number> {
    return this.networkStats.getAverageLatency();
  }

  private calculateAverageBlockTime(blockTimes: number[]): number {
    const recentTimes = blockTimes.slice(-this.WINDOW_SIZE);
    if (recentTimes.length === 0) return this.TARGET_BLOCK_TIME;

    const mean = recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length;
    const stdDev = Math.sqrt(
      recentTimes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
        recentTimes.length,
    );

    const filteredTimes = recentTimes.filter(
      (time) => Math.abs(time - mean) <= 2 * stdDev,
    );

    return filteredTimes.reduce((a, b) => a + b, 0) / filteredTimes.length;
  }

  private calculatePOWAdjustment(
    blockTimes: number[],
    hashRate: number,
  ): number {
    try {
      if (
        !Array.isArray(blockTimes) ||
        !blockTimes?.length ||
        blockTimes.length < 3 ||
        typeof hashRate !== 'number' ||
        !isFinite(hashRate) ||
        hashRate <= 0
      ) {
        return 1.0;
      }

      const avgBlockTime = this.calculateAverageBlockTime(blockTimes);
      if (avgBlockTime <= 0) return 1.0;

      const timeRatio = this.TARGET_BLOCK_TIME / avgBlockTime;
      const hashRateChange =
        this.lastHashRate > 0
          ? (Number(hashRate) - Number(this.lastHashRate)) /
            Number(this.lastHashRate)
          : 0;

      const dampening = 0.75;
      const adjustment = timeRatio * (1 + hashRateChange * dampening);
      this.lastHashRate = BigInt(hashRate);

      return Math.max(
        1 - this.ADJUSTMENT_FACTOR,
        Math.min(adjustment, 1 + this.ADJUSTMENT_FACTOR),
      );
    } catch (error) {
      Logger.error('Error in POW adjustment calculation:', error);
      return 1.0;
    }
  }
}
