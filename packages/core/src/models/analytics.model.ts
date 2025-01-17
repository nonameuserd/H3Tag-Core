export interface ConsensusMetrics {
  // Core metrics
  powWeight: number;
  votingWeight: number;
  currentPeriod: number;
  nextVotingHeight: number;

  // Participation
  activeNodes: number;
  participationRate: number;

  // Health indicators
  networkHealth: {
    isHealthy: boolean;
    lastChecked: number;
    issues: string[];
  };

  // Consensus state
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
