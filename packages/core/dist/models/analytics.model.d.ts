export interface ConsensusMetrics {
    powWeight: number;
    votingWeight: number;
    currentPeriod: number;
    nextVotingHeight: number;
    activeNodes: number;
    participationRate: number;
    networkHealth: {
        isHealthy: boolean;
        lastChecked: number;
        issues: string[];
    };
    currentState: {
        timestamp: number;
        blockHeight: number;
        totalParticipants: number;
        minParticipation: number;
    };
}
export interface TrendData {
    period: string;
    value: number;
    change: number;
}
export interface NetworkStats {
    peerCount: number;
    averageLatency: number;
    blockPropagation: number;
    consensusParticipation: number;
    timestamp: number;
}
