import { Vote, VotingPeriod } from "../models/vote.model";
/**
 * @fileoverview VotingSchema implements the database schema and operations for blockchain voting.
 * It handles vote storage, validation, aggregation, and period management with optimized caching
 * and atomic batch operations.
 *
 * @module VotingSchema
 */
/**
 * Interface defining voting schema operations
 *
 * @interface IVotingSchema
 */
/**
 * VotingDatabase manages blockchain voting data with built-in caching and validation.
 *
 * @class VotingDatabase
 * @implements {IVotingSchema}
 *
 * @property {Level} db - LevelDB database instance
 * @property {boolean} isInitialized - Database initialization status
 * @property {Cache<Vote | VotingPeriod>} cache - Vote and period cache
 * @property {Mutex} mutex - Mutex for synchronizing operations
 * @property {number} BATCH_SIZE - Maximum batch operation size
 * @property {number} CACHE_TTL - Cache time-to-live in seconds
 *
 * @example
 * const votingDb = new VotingDatabase('./data/voting');
 * await votingDb.createVotingPeriod(period);
 * await votingDb.recordVote(vote);
 */
export interface IVotingSchema {
    createVotingPeriod(period: VotingPeriod): Promise<void>;
    recordVote(vote: Vote): Promise<void>;
    getLatestVote(voterAddress: string): Promise<Vote | null>;
    getVotesByVoter(voterAddress: string): Promise<Vote[]>;
    getTotalVotes(): Promise<number>;
    getVotesByPeriod(periodId: number): Promise<Vote[]>;
    getTotalEligibleVoters(): Promise<number>;
    close(): Promise<void>;
    getVotesByAddress(address: string): Promise<Vote[]>;
    storeVote(vote: Vote): Promise<void>;
    updateVotingPeriod(period: VotingPeriod): Promise<void>;
    getVotes(): Promise<Vote[]>;
}
export declare class VotingDatabase implements IVotingSchema {
    private db;
    private isInitialized;
    private cache;
    private mutex;
    private readonly BATCH_SIZE;
    private readonly CACHE_TTL;
    constructor(dbPath: string);
    private initialize;
    /**
     * Creates a new voting period
     *
     * @async
     * @method createVotingPeriod
     * @param {VotingPeriod} period - Voting period to create
     * @returns {Promise<void>}
     * @throws {Error} If period creation fails
     *
     * @example
     * await votingDb.createVotingPeriod({
     *   periodId: 1,
     *   startBlock: 1000,
     *   endBlock: 2000
     * });
     */
    createVotingPeriod(period: VotingPeriod): Promise<void>;
    /**
     * Records a vote in the current period
     *
     * @async
     * @method recordVote
     * @param {Vote} vote - Vote to record
     * @returns {Promise<void>}
     * @throws {VotingError} If vote is invalid or duplicate
     *
     * @example
     * await votingDb.recordVote({
     *   periodId: 1,
     *   voterAddress: '0x...',
     *   approve: true,
     *   votingPower: 100n
     * });
     */
    recordVote(vote: Vote): Promise<void>;
    /**
     * Aggregates votes for a period
     *
     * @async
     * @method aggregateVotes
     * @param {number} periodId - Period ID to aggregate
     * @returns {Promise<{
     *   approved: bigint;
     *   rejected: bigint;
     *   totalVotes: number;
     *   uniqueVoters: number;
     * }>} Vote aggregation results
     *
     * @example
     * const results = await votingDb.aggregateVotes(1);
     * console.log(`Approved: ${results.approved}, Rejected: ${results.rejected}`);
     */
    aggregateVotes(periodId: number): Promise<{
        approved: bigint;
        rejected: bigint;
        totalVotes: number;
        uniqueVoters: number;
    }>;
    /**
     * Gets latest vote for an address
     *
     * @async
     * @method getLatestVote
     * @param {string} voterAddress - Voter's address
     * @returns {Promise<Vote | null>} Latest vote if found
     *
     * @example
     * const vote = await votingDb.getLatestVote(address);
     */
    getLatestVote(voterAddress: string): Promise<Vote | null>;
    /**
     * Gets all votes by a voter
     *
     * @async
     * @method getVotesByVoter
     * @param {string} voterAddress - Voter's address
     * @returns {Promise<Vote[]>} Array of votes
     *
     * @example
     * const votes = await votingDb.getVotesByVoter(address);
     */
    getVotesByVoter(voterAddress: string): Promise<Vote[]>;
    /**
     * Gets total number of votes
     *
     * @async
     * @method getTotalVotes
     * @returns {Promise<number>} Total vote count
     */
    getTotalVotes(): Promise<number>;
    /**
     * Closes database connection
     *
     * @async
     * @method close
     * @returns {Promise<void>}
     */
    close(): Promise<void>;
    getVote(periodId: number, voterAddress: string): Promise<Vote | null>;
    /**
     * Gets votes for a specific period
     *
     * @async
     * @method getVotesByPeriod
     * @param {number} periodId - Period ID
     * @returns {Promise<Vote[]>} Array of votes
     */
    getVotesByPeriod(periodId: number): Promise<Vote[]>;
    /**
     * Gets total eligible voters
     *
     * @async
     * @method getTotalEligibleVoters
     * @returns {Promise<number>} Number of eligible voters
     */
    getTotalEligibleVoters(): Promise<number>;
    /**
     * Gets votes by address
     *
     * @async
     * @method getVotesByAddress
     * @param {string} address - Voter's address
     * @returns {Promise<Vote[]>} Array of votes
     * @throws {VotingError} If address is invalid or database not initialized
     */
    getVotesByAddress(address: string): Promise<Vote[]>;
    private validateVote;
    getValidateVote(vote: Vote): boolean;
    private safeParse;
    getSafeParse<T>(value: string): T | null;
    /**
     * Stores a vote
     *
     * @async
     * @method storeVote
     * @param {Vote} vote - Vote to store
     * @returns {Promise<void>}
     * @throws {VotingError} If vote is invalid or storage fails
     */
    storeVote(vote: Vote): Promise<void>;
    /**
     * Updates voting period data
     *
     * @async
     * @method updateVotingPeriod
     * @param {VotingPeriod} period - Updated period data
     * @returns {Promise<void>}
     * @throws {VotingError} If period not found or update fails
     */
    updateVotingPeriod(period: VotingPeriod): Promise<void>;
    getVotes(): Promise<Vote[]>;
}
