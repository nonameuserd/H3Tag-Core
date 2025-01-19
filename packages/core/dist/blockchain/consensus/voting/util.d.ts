import { BlockchainSchema } from "../../../database/blockchain-schema";
import { AuditManager } from "../../../security/audit";
import { Validator } from "../../../models/validator";
import { Vote } from "../../../models/vote.model";
import { VotingPeriod } from "../../../models/vote.model";
export interface VoteTally {
    approved: bigint;
    rejected: bigint;
    totalVotes: number;
    uniqueVoters: number;
    participationRate: number;
    timestamp: number;
}
export declare class DirectVotingUtil {
    private readonly db;
    private readonly auditManager;
    private readonly voteMutex;
    private readonly metrics;
    private readonly circuitBreaker;
    private readonly backupManager;
    private readonly eventEmitter;
    private readonly ddosProtection;
    /**
     * Constructor for DirectVotingUtil
     * @param db Database instance
     * @param auditManager Audit manager instance
     */
    constructor(db: BlockchainSchema, auditManager: AuditManager);
    /**
     * Initializes a chain voting period
     * @param oldChainId Old chain ID
     * @param newChainId New chain ID
     * @param forkHeight Fork height
     * @returns Promise<VotingPeriod> Initialized voting period
     */
    initializeChainVotingPeriod(oldChainId: string, newChainId: string, forkHeight: number): Promise<VotingPeriod>;
    /**
     * Collects votes for a given voting period
     * @param period Voting period
     * @param validators Validators
     * @returns Promise<VoteTally> Tally of votes
     */
    collectVotes(period: VotingPeriod, validators: Validator[]): Promise<VoteTally>;
    /**
     * Tallys votes for a given voting period
     * @param votes Votes to tally
     * @returns Promise<VoteTally> Tally of votes
     */
    private tallyVotes;
    /**
     * Processes voting results
     * @param tally Vote tally
     * @param oldChainId Old chain ID
     * @param newChainId New chain ID
     * @returns Promise<string> New chain ID if selected, old chain ID otherwise
     */
    private processVotingResults;
    /**
     * Verifies a vote
     * @param vote Vote to verify
     * @param validators Validators to verify against
     * @returns Promise<boolean> True if vote is valid
     */
    verifyVote(vote: Vote, validators: Validator[]): Promise<boolean>;
    private _verifyVote;
    /**
     * Disposes of the DirectVotingUtil
     * @returns Promise<void>
     */
    dispose(): Promise<void>;
}
