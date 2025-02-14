/**
 * @fileoverview Vote model definitions for the H3Tag blockchain. Includes voting types,
 * vote structures, and voting period management for consensus and governance.
 *
 * @module VoteModel
 */

/**
 * @type {string} VotingType
 * @description Types of voting supported by the blockchain
 *
 * @property {"node_selection"} node_selection - Voting for node selection
 * @property {"parameter_change"} parameter_change - Voting for parameter changes
 */
export type VotingType = 'node_selection' | 'parameter_change';

/**
 * @interface Vote
 * @description Defines the structure of a vote in the blockchain
 *
 * @property {string} voteId - Unique vote identifier
 * @property {number} periodId - Voting period identifier
 * @property {string} blockHash - Hash of the block containing the vote
 * @property {string} voterAddress - Address of the voter
 * @property {boolean} approve - Vote decision (true/false)
 * @property {number} timestamp - Vote submission timestamp
 * @property {string} signature - Vote signature
 * @property {string} publicKey - Voter's public key
 * @property {boolean} encrypted - Whether the vote is encrypted
 * @property {string} [encryptedChoice] - Optional encrypted vote choice
 * @property {string} voter - Voter identifier
 * @property {string} votingPower - Voter's voting power (stored as a string to ensure JSON compatibility)
 * @property {Object} [chainVoteData] - Optional chain selection vote data
 * @property {string} chainVoteData.targetChainId - Target chain identifier
 * @property {number} chainVoteData.forkHeight - Fork height
 * @property {string} chainVoteData.amount - Vote amount (stored as a string for serialization)
 * @property {number} height - Block height of the vote
 * @property {string} balance - Voter's balance at time of vote (stored as a string for serialization)
 */
export interface Vote {
  voteId: string;
  periodId: number;
  blockHash: string;
  voterAddress: string;
  approve: boolean;
  timestamp: number;
  signature: string;
  publicKey: string;
  encrypted: boolean;
  encryptedChoice?: string;
  voter: string;
  votingPower: string;
  chainVoteData?: {
    targetChainId: string;
    forkHeight: number;
    amount: bigint;
  };
  height: number;
  balance: bigint;
}

/**
 * @interface ForkDecision
 * @description Represents a fork decision in the blockchain
 *
 * @property {string} selectedChain - Selected chain identifier
 * @property {Record<string, string>} votePowers - Voting power distribution (as strings)
 * @property {number} decidedAt - Decision timestamp
 * @property {number} forkHeight - Height of the fork
 */
export interface ForkDecision {
  selectedChain: string;
  votePowers: Record<string, string>;
  decidedAt: number;
  forkHeight: number;
}

/**
 * @interface VotingPeriod
 * @description Defines a voting period in the blockchain
 *
 * @property {number} periodId - Unique period identifier
 * @property {number} startBlock - Starting block number
 * @property {number} endBlock - Ending block number
 * @property {number} startTime - Period start timestamp
 * @property {number} startHeight - Starting block height
 * @property {number} endHeight - Ending block height
 * @property {number} endTime - Period end timestamp
 * @property {"active" | "completed" | "cancelled"} status - Period status
 * @property {Record<string, Vote>} votes - Map of votes in the period
 * @property {string} [votesMerkleRoot] - Optional merkle root of votes
 * @property {VotingType} [type] - Type of voting period
 * @property {string} [chainId] - Optional chain identifier
 * @property {number} [forkHeight] - Optional fork height
 * @property {Object} [competingChains] - Optional competing chains data
 * @property {string} competingChains.oldChainId - Original chain identifier
 * @property {string} competingChains.newChainId - New chain identifier
 * @property {number} competingChains.commonAncestorHeight - Common ancestor height
 * @property {Object} [chainSelectionResult] - Optional chain selection result
 * @property {string} chainSelectionResult.selectedChainId - Selected chain
 * @property {string} chainSelectionResult.votingPower - Total voting power (stored as a string for serialization)
 * @property {number} chainSelectionResult.participationRate - Participation rate
 * @property {number} chainSelectionResult.timestamp - Result timestamp
 * @property {boolean} isAudited - Whether period has been audited
 * @property {number} createdAt - Period creation timestamp
 * @property {ForkDecision} [forkDecision] - Optional fork decision data
 */
export interface VotingPeriod {
  periodId: number;
  startBlock: number;
  endBlock: number;
  startTime: number;
  startHeight: number;
  endHeight: number;
  endTime: number;
  status: 'active' | 'completed' | 'cancelled';
  votes: Record<string, Vote>;
  votesMerkleRoot?: string;
  type?: VotingType;
  chainId?: string;
  forkHeight?: number;
  competingChains?: {
    oldChainId: string;
    newChainId: string;
    commonAncestorHeight: number;
  };
  chainSelectionResult?: {
    selectedChainId: string;
    votingPower: string;
    participationRate: number;
    timestamp: number;
  };
  isAudited: boolean;
  createdAt: number;
  forkDecision?: ForkDecision;
}

/**
 * Utility to convert a Map to a Record (plain object)
 */
export function mapToRecord<T>(map: Map<string, T>): Record<string, T> {
  return Object.fromEntries(map.entries());
}

/**
 * Utility to convert a Record (plain object) to a Map<string, T>
 */
export function recordToMap<T>(record: Record<string, T>): Map<string, T> {
  const map = new Map<string, T>();
  Object.keys(record).forEach((key) => {
    map.set(key, record[key]);
  });
  return map;
}
