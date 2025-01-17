import { DirectVoting, Vote } from '@h3tag-blockchain/core';
import { VoteDto, VotingMetricsDto } from '../dtos/voting.dto';
export declare class VotingService {
    private readonly directVoting;
    private readonly transactionBuilder;
    constructor(directVoting: DirectVoting);
    submitVote(voteDto: VoteDto): Promise<string>;
    getVotingMetrics(): Promise<VotingMetricsDto>;
    getCurrentPeriod(): Promise<import("@h3tag-blockchain/core").VotingPeriod>;
    getVotesByAddress(address: string): Promise<Vote[]>;
}
