export type VotingType = "node_selection" | "parameter_change";

export interface Vote {
  voteId: string;
  periodId: number;
  blockHash: string;
  voterAddress: string;
  approve: boolean;
  timestamp: number;
  signature: {
    address: string;
  };
  publicKey: {
    address: string;
  };
  encrypted: boolean;
  encryptedChoice?: string;
  voter: string;
  votingPower: bigint;
  chainVoteData?: {
    targetChainId: string;
    forkHeight: number;
    amount: bigint;
  };
  height: number;
  balance: bigint;
}

interface ForkDecision {
  selectedChain: string;
  votePowers: Record<string, bigint>;
  decidedAt: number;
  forkHeight: number;
}

export interface VotingPeriod {
  periodId: number;
  startBlock: number;
  endBlock: number;
  startTime: number;
  startHeight: number;
  endHeight: number;
  endTime: number;
  status: "active" | "completed" | "cancelled";
  votes: Map<string, Vote>;
  votesMerkleRoot?: string;

  // Chain selection specific fields
  type?: VotingType;
  chainId?: string; // ID of the new chain being voted on
  forkHeight?: number; // Height where the fork occurred
  competingChains?: {
    // Details of chains being voted on
    oldChainId: string;
    newChainId: string;
    commonAncestorHeight: number;
  };
  chainSelectionResult?: {
    selectedChainId: string;
    votingPower: bigint;
    participationRate: number;
    timestamp: number;
  };
  isAudited: boolean;
  createdAt: number;
  forkDecision?: ForkDecision; // Optional since not all periods have fork decisions
}
