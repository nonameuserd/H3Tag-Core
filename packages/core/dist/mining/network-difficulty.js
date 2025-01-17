"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkAwareDifficulty = void 0;
const difficulty_1 = require("./difficulty");
const network_stats_1 = require("../network/network-stats");
const shared_1 = require("@h3tag-blockchain/shared");
class NetworkAwareDifficulty extends difficulty_1.DifficultyAdjuster {
    constructor(blockchain) {
        super(blockchain);
        this.POW_WEIGHT = 0.6; // 60% influence from PoW for security
        this.VOTE_WEIGHT = 0.4; // 40% influence from direct voting
        this.MIN_VOTER_PARTICIPATION = 1000; // Minimum voters needed
        this.MAX_INDIVIDUAL_INFLUENCE = 0.001; // Cap individual vote at 0.1%
        this.currentTarget = BigInt("0x00000000FFFF0000000000000000000000000000000000000000000000000000");
        this.INITIAL_DIFFICULTY = 1;
        this.networkStats = new network_stats_1.NetworkStats();
    }
    async initialize() {
        try {
            // Initialize network stats
            await this.networkStats.initialize();
            // Set initial difficulty target
            this.currentTarget = BigInt("0x00000000FFFF0000000000000000000000000000000000000000000000000000");
            shared_1.Logger.debug("Network difficulty initialized");
        }
        catch (error) {
            shared_1.Logger.error("Failed to initialize network difficulty:", error);
            throw error;
        }
    }
    async calculateHybridDifficulty(currentDifficulty, networkMetrics, votes) {
        try {
            await this.networkStats.initialize();
        }
        catch (error) {
            shared_1.Logger.error("Failed to initialize network stats:", error);
        }
        // PoW security layer
        const powAdjustment = await super.calculateNextDifficulty(currentDifficulty, this.networkStats.blockPropagationTimes, this.networkStats.globalHashRate, {
            participation: votes.length / this.MIN_VOTER_PARTICIPATION,
            approvalRate: votes.filter((v) => v.desiredDifficulty > currentDifficulty).length /
                votes.length,
        });
        // Direct democratic voting layer
        const voteAdjustment = this.calculateDirectVoteAdjustment(votes, currentDifficulty);
        // Network health check
        const networkHealth = this.calculateNetworkHealth(networkMetrics);
        // Combine with weights (PoW primary, voting secondary)
        let finalDifficulty = (powAdjustment * this.POW_WEIGHT + voteAdjustment * this.VOTE_WEIGHT) *
            networkHealth;
        return Math.floor(finalDifficulty);
    }
    calculateDirectVoteAdjustment(votes, currentDifficulty) {
        if (!votes || votes.length === 0) {
            return currentDifficulty;
        }
        if (votes.length < this.MIN_VOTER_PARTICIPATION) {
            return currentDifficulty; // Maintain current if not enough participation
        }
        // Each voter gets equal weight, capped at MAX_INDIVIDUAL_INFLUENCE
        const voteWeight = Math.min(1 / votes.length, this.MAX_INDIVIDUAL_INFLUENCE);
        // Calculate average desired difficulty from all votes equally
        const totalVotedDifficulty = votes.reduce((sum, vote) => sum + vote.desiredDifficulty, 0);
        return totalVotedDifficulty / votes.length;
    }
    calculateNetworkHealth(metrics) {
        const latencies = Array.from(this.networkStats.peerLatencies.values());
        const avgLatency = latencies.length > 0
            ? latencies.reduce((a, b) => a + b, 0) / latencies.length
            : 0;
        const healthScore = Math.min(1.1, // Max 10% increase
        Math.max(0.9, // Max 10% decrease
        1 - avgLatency / 1000 // Adjust based on latency
        ));
        return healthScore;
    }
    getCurrentTarget() {
        try {
            const currentDifficulty = this.calculateCurrentDifficulty();
            if (currentDifficulty <= 0) {
                return this.INITIAL_DIFFICULTY;
            }
            return Number(this.currentTarget / BigInt(currentDifficulty));
        }
        catch (error) {
            shared_1.Logger.error("Error getting current target:", error);
            return this.INITIAL_DIFFICULTY;
        }
    }
    calculateCurrentDifficulty() {
        try {
            const target = this.currentTarget;
            const maxTarget = BigInt("0x00000000FFFF0000000000000000000000000000000000000000000000000000");
            const difficulty = Number(maxTarget / target);
            const networkHealth = this.calculateNetworkHealth(this.getNetworkMetrics());
            return Math.max(1, Math.floor(difficulty * networkHealth));
        }
        catch (error) {
            shared_1.Logger.error("Error calculating difficulty:", error);
            return this.INITIAL_DIFFICULTY || 1;
        }
    }
    getNetworkMetrics() {
        try {
            const latencies = Array.from(this.networkStats.peerLatencies.values());
            const avgLatency = latencies.length > 0
                ? latencies.reduce((a, b) => a + b, 0) / latencies.length
                : 0;
            const blockTimes = this.networkStats.blockPropagationTimes;
            const avgBlockTime = blockTimes.length > 0
                ? blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length
                : this.TARGET_BLOCK_TIME;
            return {
                hashRate: this.networkStats.globalHashRate,
                latency: avgLatency,
                peerCount: this.networkStats.getActivePeerCount(),
                blockTime: avgBlockTime,
                propagationTime: this.networkStats.getAveragePropagationTime(),
                networkHealth: 1.0,
            };
        }
        catch (error) {
            shared_1.Logger.error("Error calculating network metrics:", error);
            return {
                hashRate: 0,
                latency: 0,
                peerCount: 0,
                blockTime: this.TARGET_BLOCK_TIME,
                propagationTime: 0,
                networkHealth: 1.0,
            };
        }
    }
}
exports.NetworkAwareDifficulty = NetworkAwareDifficulty;
//# sourceMappingURL=network-difficulty.js.map