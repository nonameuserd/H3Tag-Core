import { Block } from "../../models/block.model";
import { ProofOfWork } from "./pow";
import { DirectVoting } from "./voting";
import { Blockchain } from "../blockchain";
import { Transaction } from "../../models/transaction.model";
interface CacheMetrics {
    hitRate: number;
    size: number;
    memoryUsage: number;
    evictionCount: number;
}
/**
 * @fileoverview HybridDirectConsensus implements a hybrid consensus mechanism that combines
 * Proof of Work (PoW) with direct voting for blockchain validation and fork resolution.
 * This hybrid approach provides both the security of PoW and the governance benefits of voting.
 *
 * @module HybridDirectConsensus
 */
/**
 * HybridDirectConsensus implements a hybrid consensus mechanism combining PoW and direct voting.
 * It manages block validation, chain fork resolution, and consensus state.
 *
 * @class HybridDirectConsensus
 *
 * @property {ProofOfWork} pow - Handles Proof of Work operations
 * @property {DirectVoting} directVoting - Manages voting operations
 * @property {BlockchainSchema} db - Database instance
 * @property {AuditManager} auditManager - Manages audit logging
 * @property {Cache<boolean>} blockCache - Caches block validation results
 * @property {ShardManager} shardManager - Manages blockchain sharding
 * @property {Mempool} mempool - Manages transaction mempool
 * @property {Blockchain} blockchain - Core blockchain instance
 * @property {MerkleTree} merkleTree - Handles merkle tree operations
 * @property {Performance} performance - Monitors performance metrics
 * @property {RetryStrategy} retryStrategy - Manages operation retries
 * @property {Map<string, Peer>} peers - Manages network peers
 * @property {BlockchainSync} blockchainSync - Handles blockchain synchronization
 * @property {DDoSProtection} ddosProtection - Provides DDoS protection
 *
 * @example
 * const consensus = await HybridDirectConsensus.create(blockchain);
 * const isValid = await consensus.validateBlock(block);
 * if (isValid) {
 *   await consensus.processBlock(block);
 * }
 */
/**
 * Creates a new instance of HybridDirectConsensus
 *
 * @constructor
 * @param {Blockchain} blockchain - Blockchain instance
 */
/**
 * Creates and initializes a new HybridDirectConsensus instance
 *
 * @static
 * @async
 * @method create
 * @param {Blockchain} blockchain - Blockchain instance
 * @returns {Promise<HybridDirectConsensus>} Initialized consensus instance
 */
/**
 * Validates a block using hybrid consensus rules
 *
 * @async
 * @method validateBlock
 * @param {Block} block - Block to validate
 * @returns {Promise<boolean>} True if block is valid
 * @throws {BlockValidationError} If validation fails or times out
 *
 * @example
 * const isValid = await consensus.validateBlock(block);
 * if (!isValid) {
 *   // Handle invalid block
 * }
 */
/**
 * Processes a new block
 *
 * @async
 * @method processBlock
 * @param {Block} block - Block to process
 * @returns {Promise<Block>} Processed block
 * @throws {ConsensusError} If block processing fails or times out
 *
 * @example
 * const processedBlock = await consensus.processBlock(block);
 */
/**
 * Handles chain fork resolution
 *
 * @async
 * @method handleChainFork
 * @param {Block} block - Block causing the fork
 * @returns {Promise<string>} Hash of the winning chain tip
 * @throws {ConsensusError} If fork resolution fails or times out
 */
/**
 * Validates participation reward transaction
 *
 * @async
 * @method validateParticipationReward
 * @param {Transaction} transaction - Reward transaction to validate
 * @param {number} currentHeight - Current blockchain height
 * @returns {Promise<boolean>} True if reward is valid
 */
/**
 * Gets consensus metrics
 *
 * @method getMetrics
 * @returns {{
 *   pow: Object,
 *   voting: Object,
 *   votingPeriod: number,
 *   minimumParticipation: number,
 *   performance: Object,
 *   cache: {
 *     size: number,
 *     hitRate: number,
 *     evictionCount: number
 *   },
 *   retryStats: Object
 * }}
 */
/**
 * Performs health check of consensus system
 *
 * @async
 * @method healthCheck
 * @returns {Promise<boolean>} True if system is healthy
 */
/**
 * Starts continuous mining process
 *
 * @method startMining
 * @returns {void}
 */
/**
 * Stops the mining process
 *
 * @method stopMining
 * @returns {void}
 */
/**
 * Disposes of the consensus system
 *
 * @async
 * @method dispose
 * @returns {Promise<void>}
 */
/**
 * @typedef {Object} CacheMetrics
 * @property {number} hitRate - Cache hit rate
 * @property {number} size - Current cache size
 * @property {number} memoryUsage - Memory usage in bytes
 * @property {number} evictionCount - Number of cache evictions
 */
/**
 * @typedef {Object} CircuitBreaker
 * @property {number} failures - Number of consecutive failures
 * @property {number} lastFailure - Timestamp of last failure
 * @property {number} threshold - Failure threshold before opening
 * @property {number} resetTimeout - Time before resetting failures
 */
export declare class HybridDirectConsensus {
    readonly pow: ProofOfWork;
    readonly directVoting: DirectVoting;
    private readonly db;
    private readonly auditManager;
    private readonly blockCache;
    private readonly shardManager;
    private readonly mempool;
    private readonly blockchain;
    private readonly merkleTree;
    private readonly eventEmitter;
    private readonly performance;
    private readonly retryStrategy;
    private readonly peers;
    private isDisposed;
    private readonly forkLock;
    private cleanupHandler;
    private readonly blockchainSync;
    private readonly circuitBreaker;
    private ddosProtection;
    private readonly cacheLock;
    private readonly consensusPublicKey;
    private isInitialized;
    private readonly forkResolutionLock;
    /**
     * Creates a new instance of HybridDirectConsensus
     * @param db Database instance
     * @param pow Proof of Work instance
     * @param directVoting Direct voting instance
     * @param merkleTree Merkle tree instance
     * @param auditManager Audit manager instance
     * @param blockCache Block cache instance
     * @param shardManager Shard manager instance
     * @param performance Performance monitor instance
     * @param retryStrategy Retry strategy instance
     */
    constructor(blockchain: Blockchain);
    static create(blockchain: Blockchain): Promise<HybridDirectConsensus>;
    private initialize;
    validateBlock(block: Block): Promise<boolean>;
    /**
     * Validates a block
     * @param block Block to validate
     * @returns Promise<boolean> True if block is valid
     */
    private _validateBlock;
    /**
     * Checks if a block is a fork point
     * @param block Block to check
     * @returns Promise<boolean> True if block is a fork point
     */
    private isForkPoint;
    /**
     * Handles chain fork resolution
     * @param block Block causing the fork
     * @returns Promise<string> Hash of the winning chain tip
     * @throws Error if fork resolution fails or times out
     */
    private handleChainFork;
    /**
     * Handles chain fork resolution
     * @param block Block causing the fork
     * @returns Promise<string> Hash of the winning chain tip
     * @throws Error if fork resolution fails or times out
     */
    private _handleChainFork;
    /**
     * Calculates PoW score for a block
     * @param block Block to calculate score for
     * @returns Promise<number> PoW score
     */
    private calculatePowScore;
    /**
     * Processes a new block
     * @param block Block to process
     * @returns Promise<Block> Processed block
     * @throws Error if block processing fails
     */
    processBlock(block: Block): Promise<Block>;
    private _processBlock;
    /**
     * Verifies merkle root of a block
     * @param block Block to verify
     * @returns Promise<boolean> True if merkle root is valid
     */
    private verifyMerkleRoot;
    /**
     * Logs validation failure event
     * @param block Block that failed validation
     * @param reason Failure reason
     */
    private logValidationFailure;
    /**
     * Logs successful validation event
     * @param block Validated block
     */
    private logSuccessfulValidation;
    /**
     * Logs validation error event
     * @param block Block that caused error
     * @param error Error details
     */
    private logValidationError;
    /**
     * Gets consensus metrics
     * @returns Object containing various consensus metrics
     */
    getMetrics(): {
        pow: {
            totalBlocks: number;
            successfulBlocks: number;
            lastMiningTime: number;
            averageHashRate: number;
            totalTAGMined: number;
            currentBlockReward: number;
            tagTransactionsCount: number;
            timestamp: bigint;
            blockHeight: number;
            hashRate: number;
            difficulty: number;
            blockTime: number;
            tagVolume: number;
            tagFees: number;
            lastBlockTime: number;
            syncedHeaders: number;
            syncedBlocks: number;
            whitelistedPeers: number;
            blacklistedPeers: number;
        };
        voting: {
            currentPeriod: import("../..").VotingPeriod;
            totalVotes: Promise<number>;
            activeVoters: Promise<string[]>;
            participationRate: Promise<number>;
        };
        votingPeriod: number;
        minimumParticipation: number;
        performance: {
            [k: string]: {
                startTime: number;
                count: number;
                total: number;
                min: number;
                max: number;
                avg: number;
            };
        };
        cache: {
            size: number;
            hitRate: number;
            evictionCount: number;
        };
        retryStats: {
            attempts: number;
            successes: number;
            failures: number;
            lastAttempt: number;
            averageDelay: number;
        };
    };
    /**
     * Performs health check of consensus system
     * @returns Promise<boolean> True if system is healthy
     */
    healthCheck(): Promise<boolean>;
    private validateCacheIntegrity;
    /**
     * Disposes of the consensus system
     * @returns Promise<void>
     */
    dispose(): Promise<void>;
    /**
     * Registers an event listener
     * @param event Event name
     * @param listener Event handler function
     */
    on(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    /**
     * Emits a metric event
     * @param name Metric name
     * @param value Metric value
     */
    private emitMetric;
    /**
     * Handles cache eviction
     * @param key Cache key being evicted
     */
    private handleCacheEviction;
    /**
     * Checks if circuit breaker is open
     * @returns boolean True if circuit breaker is open
     */
    private isCircuitOpen;
    /**
     * Records a failure for circuit breaker
     */
    private recordFailure;
    /**
     * Warms up block cache with recent blocks
     * @param recentBlocks Number of recent blocks to cache
     */
    private warmupCache;
    validateParticipationReward(transaction: Transaction, currentHeight: number): Promise<boolean>;
    private calculateParticipationReward;
    /**
     * Manual mining - mines a single block
     */
    mineBlock(): Promise<Block>;
    /**
     * Starts continuous mining process
     */
    startMining(): void;
    /**
     * Stops the mining process
     */
    stopMining(): void;
    private withErrorBoundary;
    private cleanupCircuitBreaker;
    private registerCleanupHandler;
    getCacheMetrics(): CacheMetrics;
    /**
     * Updates consensus state after new block addition
     * @param block The newly added block
     */
    updateState(block: Block): Promise<void>;
}
export {};
