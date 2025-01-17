import { VotingService } from "../services/voting.service";
import { VoteDto, VotingMetricsDto } from "../dtos/voting.dto";
export declare class VotingController {
    private readonly votingService;
    constructor(votingService: VotingService);
    submitVote(voteDto: VoteDto): Promise<{
        success: boolean;
        voteId: string;
    }>;
    getMetrics(): Promise<VotingMetricsDto>;
    getCurrentPeriod(): Promise<import("packages/core/dist").VotingPeriod>;
    getVotesByAddress(address: string): Promise<import("packages/core/dist").Vote[]>;
}
