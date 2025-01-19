import { DirectVotingUtil } from "./voting/util";
import { VotingPeriod } from "../../models/vote.model";
import { BlockchainSchema } from "../../database/blockchain-schema";
import { BlockchainSync } from "../../network/sync";
import { Vote } from "../../models/vote.model";
import { IVotingSchema } from "../../database/voting-schema";
import { AuditManager } from "../../security/audit";
import { Node } from "../../network/node";
import { Block } from "../../models/block.model";
import { Validator } from "../../models/validator";
/**
 * @fileoverview DirectVoting implements a quadratic voting-based consensus mechanism for blockchain governance
 * and chain selection. It manages voting periods, vote submission, chain fork resolution, and validator participation.
 *
 * @module DirectVoting
 */
/**
 * DirectVoting class implements the direct voting consensus mechanism for blockchain governance
 * and chain selection using quadratic voting power calculations.
 *
 * @class DirectVoting
 *
 * @property {EventEmitter} eventEmitter - Emits voting-related events
 * @property {VotingPeriod | null} currentPeriod - Current active voting period
 * @property {number} nextVotingHeight - Block height when next voting period begins
 * @property {PerformanceMonitor} performanceMonitor - Monitors performance metrics
 * @property {Cache<Vote[]>} cache - Caches vote data
 * @property {MerkleTree} merkleTree - Handles vote merkle tree operations
 * @property {BackupManager} backupManager - Manages voting state backups
 * @property {Mempool} mempool - Manages transaction/vote mempool
 * @property {DDoSProtection} ddosProtection - Provides DDoS protection
 * @property {BlockchainSync} sync - Handles blockchain synchronization
 *
 * @example
 * const voting = new DirectVoting(
 *   blockchainDb,
 *   votingDb,
 *   auditManager,
 *   votingUtil,
 *   node,
 *   sync
 * );
 *
 * await voting.initialize();
 * await voting.submitVote(vote);
 */
/**
 * Creates a new instance of DirectVoting
 *
 * @constructor
 * @param {BlockchainSchema} db - Blockchain database instance
 * @param {IVotingSchema} votingDb - Voting database instance
 * @param {AuditManager} auditManager - Audit logging manager
 * @param {DirectVotingUtil} votingUtil - Voting utility functions
 * @param {Node} node - Network node instance
 * @param {BlockchainSync} sync - Blockchain sync instance
 */
/**
 * Initializes the voting system
 *
 * @async
 * @method initialize
 * @returns {Promise<void>}
 * @throws {VotingError} If initialization fails
 */
/**
 * Submits a vote to the current voting period
 *
 * @async
 * @method submitVote
 * @param {Vote} vote - Vote to be submitted
 * @returns {Promise<boolean>} True if vote was submitted successfully
 * @throws {VotingError} If vote submission fails validation
 *
 * @example
 * const vote = {
 *   voteId: "123",
 *   voter: "0x...",
 *   chainVoteData: {
 *     amount: "1000"
 *   }
 * };
 * const success = await voting.submitVote(vote);
 */
/**
 * Handles chain fork resolution through voting
 *
 * @async
 * @method handleChainFork
 * @param {string} oldChainId - Current chain ID
 * @param {string} newChainId - Proposed new chain ID
 * @param {number} forkHeight - Height at which fork occurred
 * @param {Validator[]} validators - List of validators
 * @returns {Promise<string>} Selected chain ID
 * @throws {Error} If chain IDs are invalid or validators array is empty
 *
 * @example
 * const selectedChain = await voting.handleChainFork(
 *   "chain_1",
 *   "chain_2",
 *   1000,
 *   validators
 * );
 */
/**
 * Gets current voting schedule information
 *
 * @async
 * @method getVotingSchedule
 * @returns {Promise<{
 *   currentPeriod: VotingPeriod | null,
 *   nextVotingHeight: number,
 *   blocksUntilNextVoting: number
 * }>}
 */
/**
 * Validates votes in a block
 *
 * @async
 * @method validateVotes
 * @param {Block} block - Block containing votes to validate
 * @returns {Promise<boolean>} True if all votes are valid
 */
/**
 * Checks if an address has participated in current voting period
 *
 * @async
 * @method hasParticipated
 * @param {string} address - Address to check
 * @returns {Promise<boolean>} True if address has participated
 * @throws {VotingError} If address format is invalid
 */
/**
 * Gets votes by address
 *
 * @async
 * @method getVotesByAddress
 * @param {string} address - Address to get votes for
 * @returns {Promise<Vote[]>} Array of votes for the address
 * @throws {VotingError} If address format is invalid or retrieval fails
 */
/**
 * Gets votes for multiple addresses
 *
 * @async
 * @method getVotesByAddresses
 * @param {string[]} addresses - Addresses to get votes for
 * @returns {Promise<Record<string, Vote[]>>} Map of addresses to their votes
 * @throws {Error} If addresses format is invalid
 */
/**
 * Cleans up resources and stops voting system
 *
 * @async
 * @method dispose
 * @returns {Promise<void>}
 */
/**
 * Performs health check of voting system
 *
 * @async
 * @method healthCheck
 * @returns {Promise<boolean>} True if system is healthy
 */
/**
 * Gets current voting metrics
 *
 * @method getVotingMetrics
 * @returns {{
 *   currentPeriod: VotingPeriod | null,
 *   totalVotes: number,
 *   activeVoters: Promise<string[]>,
 *   participationRate: Promise<number>
 * }}
 */
/**
 * @typedef {Object} VotingPeriod
 * @property {number} periodId - Unique identifier for voting period
 * @property {number} startBlock - Starting block height
 * @property {number} endBlock - Ending block height
 * @property {number} startTime - Period start timestamp
 * @property {number} endTime - Period end timestamp
 * @property {'active' | 'completed'} status - Current period status
 * @property {Map<string, Vote>} votes - Map of votes in period
 * @property {boolean} isAudited - Whether period has been audited
 * @property {string} votesMerkleRoot - Merkle root of period votes
 */
/**
 * @typedef {Object} Vote
 * @property {string} voteId - Unique vote identifier
 * @property {string} voter - Address of voter
 * @property {Object} chainVoteData - Chain-specific vote data
 * @property {string} chainVoteData.amount - Voting power amount
 * @property {number} timestamp - Vote submission timestamp
 */
export declare class DirectVoting {
    private readonly db;
    private readonly votingDb;
    private readonly auditManager;
    private readonly votingUtil;
    private readonly node;
    private readonly eventEmitter;
    private currentPeriod;
    private nextVotingHeight;
    private readonly performanceMonitor;
    private isShuttingDown;
    private cache;
    private readonly merkleTree;
    private backupManager;
    private networkFailureCount;
    private readonly MAX_FAILURES;
    private readonly RESET_INTERVAL;
    private votingScheduleTimer?;
    private cacheCleanupTimer?;
    private networkResetTimer?;
    private readonly mempool;
    private ddosProtection;
    private readonly sync;
    startVotingHeight: number;
    endVotingHeight: number;
    private rateCache;
    private voteMutex;
    private periodMutex;
    private validators;
    private circuitBreaker;
    /**
     * Creates a new instance of DirectVoting
     * @param config Configuration options for direct voting
     * @param node Network node instance
     * @param db Database instance
     * @param votingDb Voting database instance
     * @param eventEmitter Event emitter for voting events
     */
    constructor(db: BlockchainSchema, votingDb: IVotingSchema, auditManager: AuditManager, votingUtil: DirectVotingUtil, node: Node, sync: BlockchainSync);
    initialize(): Promise<void>;
    /**
     * Initializes the voting schedule
     * @returns Promise<void>
     */
    private initializeVotingSchedule;
    /**
     * Recovers voting state from backup
     * @returns Promise<void>
     */
    private recoverFromBackup;
    /**
     * Schedules the next voting period
     * @returns Promise<void>
     */
    private scheduleNextVotingPeriod;
    /**
     * Starts a new voting period
     * @throws {VotingError} If starting period fails
     */
    startVotingPeriod(): Promise<void>;
    /**
     * Submits a vote to the current voting period
     * @param vote Vote to be submitted
     * @returns Promise<boolean> True if vote was submitted successfully
     */
    submitVote(vote: Vote): Promise<boolean>;
    /**
     * Validates a vote submission
     * @param vote Vote to validate
     * @throws {VotingError} If validation fails
     */
    private validateVoteSubmission;
    /**
     * Handles chain fork resolution through voting
     * @param oldChainId Current chain ID
     * @param newChainId Proposed new chain ID
     * @param forkHeight Height at which fork occurred
     * @returns Promise<string> Selected chain ID
     */
    handleChainFork(oldChainId: string, newChainId: string, forkHeight: number, validators: Validator[]): Promise<string>;
    /**
     * Checks if network conditions are stable enough for voting
     * @returns Promise<boolean> True if network is stable
     */
    private isNetworkStable;
    /**
     * Gets list of active voters in current period
     * @returns Promise<string[]> Array of voter addresses
     */
    getActiveVoters(): Promise<string[]>;
    /**
     * Logs audit events for voting actions
     * @param action Action being audited
     * @param data Additional audit data
     */
    private logAudit;
    /**
     * Cleans up resources and stops voting system
     */
    close(): Promise<void>;
    /**
     * Gets current voting schedule information
     * @returns Current period, next voting height and blocks until next voting
     */
    getVotingSchedule(): Promise<{
        currentPeriod: VotingPeriod | null;
        nextVotingHeight: number;
        blocksUntilNextVoting: number;
    }>;
    /**
     * Gets current height of the blockchain
     * @returns Promise<number> Current height
     */
    private getCurrentHeight;
    /**
     * Gets current voting metrics
     * @returns Object containing various voting metrics
     */
    getVotingMetrics(): {
        currentPeriod: VotingPeriod;
        totalVotes: Promise<number>;
        activeVoters: Promise<string[]>;
        participationRate: Promise<number>;
    };
    /**
     * Calculates current participation rate
     * @returns Promise<number> Participation rate between 0 and 1
     */
    getParticipationRate(): Promise<number>;
    /**
     * Performs health check of voting system
     * @returns Promise<boolean> True if system is healthy
     */
    healthCheck(): Promise<boolean>;
    /**
     * Creates merkle root from votes
     * @param votes Array of votes to create root from
     * @returns Promise<string> Merkle root hash
     */
    private createVoteMerkleRoot;
    /**
     * Validates votes in a block
     * @param block Block containing votes to validate
     * @returns Promise<boolean> True if all votes are valid
     */
    validateVotes(block: Block): Promise<boolean>;
    /**
     * Validates a vote
     * @param vote Vote to validate
     * @param validators Validators to validate against
     * @returns Promise<boolean> True if vote is valid
     */
    validateVote(vote: Vote, validators: Validator[]): Promise<boolean>;
    /**
     * Cleans up cache
     */
    private cleanupCache;
    /**
     * Calculates average block time
     * @returns Promise<number> Average block time in milliseconds
     */
    private calculateAverageBlockTime;
    /**
     * Validates vote signatures
     * @param votes Votes to validate
     * @param validators Validators to validate against
     * @returns Promise<boolean> True if all signatures are valid
     */
    private validateVoteSignatures;
    /**
     * Checks if an address has participated in the current voting period
     * @param address Address to check
     * @returns Promise<boolean> True if address has participated
     */
    hasParticipated(address: string): Promise<boolean>;
    getValidators(): Promise<Validator[]>;
    getCurrentPeriod(): VotingPeriod;
    getVotesByAddress(address: string): Promise<Vote[]>;
    getVotesByAddresses(addresses: string[]): Promise<Record<string, Vote[]>>;
    private transitionPeriod;
    private loadValidators;
    private finalizePeriod;
    private initializeNewPeriod;
    /**
     * Disposes of the DirectVotingSystem
     * @returns Promise<void>
     */
    dispose(): Promise<void>;
    private setupIntervals;
    private acquireLocks;
    /**
     * Updates voting state atomically
     * @param operation Function that receives current state and returns updated state
     * @returns Promise<void>
     */
    updateVotingState(operation: (currentState: VotingPeriod) => Promise<VotingPeriod | false>): Promise<VotingPeriod | false>;
}
