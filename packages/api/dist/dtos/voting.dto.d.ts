import { TransactionType, TransactionStatus } from "@h3tag-blockchain/core";
export declare class ChainVoteDataDto {
    amount: bigint;
    targetChainId: string;
    forkHeight: number;
}
export declare class VoteDto {
    voteId: string;
    periodId: string;
    voterAddress: string;
    signature: string;
    timestamp: number;
    choice: boolean;
    chainVoteData: ChainVoteDataDto;
    type: TransactionType;
    status: TransactionStatus;
    votingPower: bigint;
    height: number;
    balance: bigint;
}
export declare class VotingPeriodDto {
    periodId: string;
    startHeight: number;
    endHeight: number;
}
export declare class VotingMetricsDto {
    currentPeriod: VotingPeriodDto;
    totalVotes: number;
    activeVoters: number;
    participationRate: number;
}
