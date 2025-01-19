import { NetworkStats } from "../network/network-stats";
import { Blockchain } from "../blockchain/blockchain";
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
export declare class DifficultyAdjuster {
    private lastHashRate;
    readonly TARGET_BLOCK_TIME = 600000;
    private readonly ADJUSTMENT_FACTOR;
    private readonly WINDOW_SIZE;
    private readonly HASH_RATE_WINDOW;
    private readonly MAX_HASH_RATE_ADJUSTMENT;
    private readonly hashRateHistory;
    private readonly blockchainStats;
    protected readonly networkStats: NetworkStats;
    private readonly MIN_VOTES_WEIGHT;
    private readonly VOTE_POWER_CAP;
    private readonly VOTE_INFLUENCE;
    private lastOrphanRate;
    constructor(blockchain: Blockchain, networkStats?: NetworkStats);
    calculateNextDifficulty(currentDifficulty: number, blockTimes: number[], hashRate: number, voteData: {
        participation: number;
        approvalRate: number;
    }): Promise<number>;
    private calculateVoteAdjustment;
    private calculateHashRateAdjustment;
    private calculateEMA;
    private sigmoid;
    private calculateNetworkHealthFactor;
    private getOrphanRate;
    private getAveragePropagationTime;
    private getActivePeerCount;
    private getAverageNetworkLatency;
    private calculateAverageBlockTime;
    private calculatePOWAdjustment;
}
