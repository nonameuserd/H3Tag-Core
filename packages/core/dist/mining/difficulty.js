"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DifficultyAdjuster = void 0;
const blockchain_stats_1 = require("../blockchain/blockchain-stats");
const network_stats_1 = require("../network/network-stats");
const shared_1 = require("@h3tag-blockchain/shared");
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
class DifficultyAdjuster {
    constructor(blockchain, networkStats = new network_stats_1.NetworkStats()) {
        this.lastHashRate = BigInt(0);
        this.TARGET_BLOCK_TIME = 600000; // 10 minutes for H3Tag blocks
        this.ADJUSTMENT_FACTOR = 0.25; // 25% max adjustment
        this.WINDOW_SIZE = 2016; // ~2 weeks of blocks
        this.HASH_RATE_WINDOW = 72; // 12 hours of blocks at 10-min intervals
        this.MAX_HASH_RATE_ADJUSTMENT = 0.25; // 25% max adjustment
        this.hashRateHistory = [];
        this.MIN_VOTES_WEIGHT = 0.1; // Minimum voting participation for TAG governance
        this.VOTE_POWER_CAP = 0.1; // Maximum voting power per participant
        this.VOTE_INFLUENCE = 0.4; // Voting influence on difficulty (40%)
        this.lastOrphanRate = 0;
        this.blockchainStats = new blockchain_stats_1.BlockchainStats(blockchain);
        this.networkStats = networkStats;
    }
    async calculateNextDifficulty(currentDifficulty, blockTimes, hashRate, voteData) {
        let adjustment = this.calculatePOWAdjustment(blockTimes, hashRate);
        // Apply voting influence
        if (voteData.participation >= this.MIN_VOTES_WEIGHT) {
            const voteAdjustment = this.calculateVoteAdjustment(voteData.participation, voteData.approvalRate);
            adjustment =
                adjustment * (1 - this.VOTE_INFLUENCE) +
                    voteAdjustment * this.VOTE_INFLUENCE;
        }
        return Math.floor(currentDifficulty *
            Math.max(1 - this.ADJUSTMENT_FACTOR, Math.min(adjustment, 1 + this.ADJUSTMENT_FACTOR)));
    }
    calculateVoteAdjustment(participation, approvalRate) {
        const cappedParticipation = Math.min(participation, this.VOTE_POWER_CAP);
        const participationWeight = cappedParticipation / this.MIN_VOTES_WEIGHT;
        const approvalWeight = approvalRate - 0.5; // Center around 50%
        return 1 + participationWeight * approvalWeight * this.ADJUSTMENT_FACTOR;
    }
    calculateHashRateAdjustment(currentHashRate) {
        // Add current hash rate to history
        this.hashRateHistory.push(BigInt(currentHashRate));
        if (this.hashRateHistory.length > this.HASH_RATE_WINDOW) {
            this.hashRateHistory.shift();
        }
        if (this.hashRateHistory.length < 6) {
            return 1.0;
        }
        const shortTermEMA = this.calculateEMA(this.hashRateHistory.slice(-6).map(Number), 2);
        const longTermEMA = this.calculateEMA(this.hashRateHistory.map(Number), 12);
        const hashRateChange = (shortTermEMA - longTermEMA) / longTermEMA;
        const adjustment = 1 + this.sigmoid(hashRateChange) * this.MAX_HASH_RATE_ADJUSTMENT;
        const networkFactor = this.calculateNetworkHealthFactor();
        return Math.max(1 - this.MAX_HASH_RATE_ADJUSTMENT, Math.min(Number(adjustment) * Number(networkFactor), 1 + this.MAX_HASH_RATE_ADJUSTMENT));
    }
    calculateEMA(values, period) {
        if (!values?.length || period <= 0)
            return 0;
        const alpha = 2 / (period + 1);
        let ema = values[0];
        for (let i = 1; i < values.length; i++) {
            const value = values[i];
            if (typeof value !== "number" || isNaN(value) || !isFinite(value))
                continue;
            ema = value * alpha + ema * (1 - alpha);
        }
        return isFinite(ema) ? ema : 0;
    }
    sigmoid(x) {
        return 2 / (1 + Math.exp(-4 * x)) - 1;
    }
    async calculateNetworkHealthFactor() {
        const metrics = {
            orphanRate: await this.getOrphanRate(),
            propagationTime: this.getAveragePropagationTime(),
            peerCount: this.getActivePeerCount(),
            networkLatency: this.getAverageNetworkLatency(),
        };
        const normalizedMetrics = {
            orphanRate: Math.min(Number(metrics.orphanRate || 0) / 0.05, 1),
            propagationTime: Math.min(Number(metrics.propagationTime || 0) / 30000, 1),
            peerCount: Math.max(0, Math.min(((metrics.peerCount || 0) - 8) / 50, 1)),
            networkLatency: Math.min(Number(metrics.networkLatency || 0) / 1000, 1),
        };
        const weights = {
            orphanRate: 0.4,
            propagationTime: 0.3,
            peerCount: 0.2,
            networkLatency: 0.1,
        };
        // Calculate weighted average
        const healthScore = Object.keys(weights).reduce((score, metric) => {
            return score + normalizedMetrics[metric] * weights[metric];
        }, 0);
        // Convert to adjustment factor (0.9 - 1.1 range)
        return 0.9 + healthScore * 0.2;
    }
    async getOrphanRate() {
        try {
            const orphanRate = await this.blockchainStats.getOrphanRate();
            if (isNaN(orphanRate) || orphanRate < 0) {
                shared_1.Logger.warn("Invalid orphan rate detected, using default", {
                    orphanRate,
                });
                return 0;
            }
            this.lastOrphanRate = orphanRate;
            return orphanRate;
        }
        catch (error) {
            shared_1.Logger.error("Error calculating orphan rate:", error);
            return this.lastOrphanRate || 0;
        }
    }
    getAveragePropagationTime() {
        return this.networkStats.getAveragePropagationTime();
    }
    getActivePeerCount() {
        return this.networkStats.getActivePeerCount();
    }
    async getAverageNetworkLatency() {
        return this.networkStats.getAverageLatency();
    }
    calculateAverageBlockTime(blockTimes) {
        const recentTimes = blockTimes.slice(-this.WINDOW_SIZE);
        if (recentTimes.length === 0)
            return this.TARGET_BLOCK_TIME;
        const mean = recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length;
        const stdDev = Math.sqrt(recentTimes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
            recentTimes.length);
        const filteredTimes = recentTimes.filter((time) => Math.abs(time - mean) <= 2 * stdDev);
        return filteredTimes.reduce((a, b) => a + b, 0) / filteredTimes.length;
    }
    calculatePOWAdjustment(blockTimes, hashRate) {
        try {
            if (!Array.isArray(blockTimes) ||
                !blockTimes?.length ||
                blockTimes.length < 3 ||
                typeof hashRate !== "number" ||
                !isFinite(hashRate) ||
                hashRate <= 0) {
                return 1.0;
            }
            const avgBlockTime = this.calculateAverageBlockTime(blockTimes);
            if (avgBlockTime <= 0)
                return 1.0;
            const timeRatio = this.TARGET_BLOCK_TIME / avgBlockTime;
            const hashRateChange = this.lastHashRate > 0
                ? (Number(hashRate) - Number(this.lastHashRate)) /
                    Number(this.lastHashRate)
                : 0;
            const dampening = 0.75;
            const adjustment = timeRatio * (1 + hashRateChange * dampening);
            this.lastHashRate = BigInt(hashRate);
            return Math.max(1 - this.ADJUSTMENT_FACTOR, Math.min(adjustment, 1 + this.ADJUSTMENT_FACTOR));
        }
        catch (error) {
            shared_1.Logger.error("Error in POW adjustment calculation:", error);
            return 1.0;
        }
    }
}
exports.DifficultyAdjuster = DifficultyAdjuster;
