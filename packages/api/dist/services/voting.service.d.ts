import { DirectVoting } from "@h3tag-blockchain/core";
import { VoteDto, VotingMetricsDto } from "../dtos/voting.dto";
export declare class VotingService {
    private readonly directVoting;
    private readonly transactionBuilder;
    constructor(directVoting: DirectVoting);
    submitVote(voteDto: VoteDto): Promise<string>;
    getVotingMetrics(): Promise<VotingMetricsDto>;
    getCurrentPeriod(): Promise<any>;
    getVotesByAddress(address: string): Promise<any>;
}
