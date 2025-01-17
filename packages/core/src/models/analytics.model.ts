/**
 * @interface ConsensusMetrics
 * @description Core metrics and health indicators for consensus mechanism
 * @property {number} powWeight - Proof of Work weight in consensus
 * @property {number} votingWeight - Voting weight in consensus
 * @property {number} currentPeriod - Current consensus period number
 * @property {number} nextVotingHeight - Next block height for voting
 * @property {number} activeNodes - Number of currently active nodes
 * @property {number} participationRate - Current participation rate
 * @property {Object} networkHealth - Network health status
 * @property {boolean} networkHealth.isHealthy - Overall health status
 * @property {number} networkHealth.lastChecked - Last health check timestamp
 * @property {string[]} networkHealth.issues - Array of current issues
 * @property {Object} currentState - Current consensus state
 * @property {number} currentState.timestamp - State timestamp
 * @property {number} currentState.blockHeight - Current block height
 * @property {number} currentState.totalParticipants - Total participant count
 * @property {number} currentState.minParticipation - Minimum required participation
 */
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

/**
 * @interface TrendData
 * @description Time-series data point for trend analysis
 * @property {string} period - Time period identifier
 * @property {number} value - Metric value
 * @property {number} change - Change from previous period
 */
export interface TrendData {
  period: string;
  value: number;
  change: number;
}

/**
 * @interface NetworkStats
 * @description Network performance and health statistics
 * @property {number} peerCount - Number of connected peers
 * @property {number} averageLatency - Average network latency in ms
 * @property {number} blockPropagation - Block propagation time in ms
 * @property {number} consensusParticipation - Consensus participation rate
 * @property {number} timestamp - Statistics timestamp
 */
export interface NetworkStats {
  peerCount: number;
  averageLatency: number;
  blockPropagation: number;
  consensusParticipation: number;
  timestamp: number;
}
