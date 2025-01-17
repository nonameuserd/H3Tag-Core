import { DifficultyAdjuster } from "./difficulty";
import { NetworkStats } from "../network/network-stats";
import { Blockchain } from "../blockchain/blockchain";
interface NetworkMetrics {
    hashRate: number;
    latency: number;
    peerCount: number;
    blockTime: number;
    propagationTime: number;
    networkHealth: number;
}
interface VoteData {
    desiredDifficulty: number;
    voter: string;
    timestamp: number;
}
export declare class NetworkAwareDifficulty extends DifficultyAdjuster {
    protected readonly networkStats: NetworkStats;
    private readonly POW_WEIGHT;
    private readonly VOTE_WEIGHT;
    private readonly MIN_VOTER_PARTICIPATION;
    private readonly MAX_INDIVIDUAL_INFLUENCE;
    private currentTarget;
    private readonly INITIAL_DIFFICULTY;
    constructor(blockchain: Blockchain);
    initialize(): Promise<void>;
    calculateHybridDifficulty(currentDifficulty: number, networkMetrics: NetworkMetrics, votes: VoteData[]): Promise<number>;
    private calculateDirectVoteAdjustment;
    private calculateNetworkHealth;
    getCurrentTarget(): number;
    private calculateCurrentDifficulty;
    private getNetworkMetrics;
}
export {};
