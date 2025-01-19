import { Level } from "level";
import { Vote } from "../models/vote.model";
import { Transaction, TransactionType } from "../models/transaction.model";
import { Block, BlockHeader } from "../models/block.model";
import { Cache } from "../scaling/cache";
import { IVotingSchema } from "./voting-schema";
import { Validator } from "../models/validator";
import { AbstractBatch } from "abstract-leveldown";
import { UTXO } from "../models/utxo.model";
/**
 * @fileoverview BlockchainSchema implements the database schema and operations for blockchain data storage.
 * It handles block, transaction, and UTXO persistence with optimized caching and atomic batch operations.
 *
 * @module BlockchainSchema
 */
/**
 * BlockchainSchema manages blockchain data persistence with LevelDB.
 *
 * @class BlockchainSchema
 *
 * @property {Level} db - LevelDB database instance
 * @property {Mutex} mutex - Mutex for synchronizing operations
 * @property {number} BATCH_SIZE - Maximum batch operation size
 * @property {AuditManager} auditManager - Audit logging manager
 * @property {EventEmitter} eventEmitter - Event emitter for database events
 * @property {MetricsCollector} metricsCollector - Metrics collection instance
 * @property {Cache} cache - Multi-purpose data cache
 * @property {Cache} transactionCache - Transaction-specific cache
 * @property {Cache} blockCache - Block-specific cache
 * @property {Cache} validatorMetricsCache - Validator metrics cache
 * @property {Cache} votingPowerCache - Voting power cache
 * @property {Cache} slashingHistoryCache - Slashing history cache
 * @property {string} dbPath - Database directory path
 *
 * @example
 * const schema = new BlockchainSchema('./data/blockchain');
 * await schema.initialize();
 * await schema.saveBlock(block);
 */
/**
 * @typedef {Object} ValidatorPerformance
 * @property {number} successfulValidations - Number of successful validations
 * @property {number} totalOpportunities - Total validation opportunities
 */
/**
 * @typedef {Object} ValidatorStats
 * @property {number} currentLoad - Current validator load
 * @property {number} maxCapacity - Maximum validator capacity
 */
/**
 * @typedef {Object} ShardData
 * @property {string[]} data - Shard data array
 * @property {number} lastSync - Last synchronization timestamp
 * @property {number} version - Shard data version
 * @property {string} checksum - Data integrity checksum
 * @property {Object} metadata - Shard metadata
 * @property {number} metadata.size - Data size in bytes
 * @property {boolean} metadata.compressed - Compression status
 * @property {number} metadata.createdAt - Creation timestamp
 * @property {number} metadata.updatedAt - Last update timestamp
 */
/**
 * Creates a new voting period
 *
 * @async
 * @method createVotingPeriod
 * @param {number} startBlock - Period start block
 * @param {number} endBlock - Period end block
 * @returns {Promise<number>} New voting period ID
 * @throws {Error} If period creation fails
 *
 * @example
 * const periodId = await schema.createVotingPeriod(1000, 2000);
 */
/**
 * Records a vote in the database
 *
 * @async
 * @method recordVote
 * @param {Vote} vote - Vote to record
 * @param {number} periodId - Voting period ID
 * @returns {Promise<boolean>} True if vote was recorded
 * @throws {Error} If vote recording fails
 *
 * @example
 * const success = await schema.recordVote(vote, periodId);
 */
/**
 * Gets UTXOs by address
 *
 * @async
 * @method getUtxosByAddress
 * @param {string} address - Address to query
 * @returns {Promise<Array<{
 *   txid: string;
 *   vout: number;
 *   amount: number;
 *   confirmations: number;
 * }>>} Array of UTXOs
 *
 * @example
 * const utxos = await schema.getUtxosByAddress(address);
 */
/**
 * Gets current blockchain height
 *
 * @async
 * @method getCurrentHeight
 * @returns {Promise<number>} Current height
 *
 * @example
 * const height = await schema.getCurrentHeight();
 */
/**
 * Gets unique addresses with balance
 *
 * @async
 * @method getUniqueAddressesWithBalance
 * @returns {Promise<number>} Number of unique addresses
 */
/**
 * Gets total supply
 *
 * @async
 * @method getTotalSupply
 * @returns {Promise<bigint>} Total supply
 */
/**
 * Compacts the database
 *
 * @async
 * @method compact
 * @returns {Promise<void>}
 * @throws {Error} If compaction fails
 */
/**
 * Closes database connection
 *
 * @async
 * @method close
 * @returns {Promise<void>}
 */
/**
 * Creates database backup
 *
 * @async
 * @method backup
 * @param {string} path - Backup destination path
 * @returns {Promise<void>}
 * @throws {Error} If backup fails
 */
interface ChainState {
    height: number;
    lastBlockHash: string;
    timestamp: number;
}
interface ValidatorPerformance {
    successfulValidations: number;
    totalOpportunities: number;
}
interface ValidatorStats {
    currentLoad: number;
    maxCapacity: number;
}
export declare class BlockchainSchema {
    db: Level;
    private mutex;
    private readonly auditManager;
    private readonly eventEmitter;
    private readonly metricsCollector;
    readonly cache: Cache<Block | {
        signature: string;
    } | {
        balance: bigint;
        holdingPeriod: number;
    }>;
    private readonly dbPath;
    private transactionCache;
    private blockCache;
    private readonly validatorMetricsCache;
    private readonly votingPowerCache;
    private readonly slashingHistoryCache;
    private readonly shardMutex;
    private readonly performanceMonitor;
    private readonly SHARD_VERSION;
    private abstractTransaction;
    private transaction;
    private transactionOperations;
    private heightCache;
    private votingDb;
    private transactionLock;
    private transactionStartTime;
    private transactionLocks;
    /**
     * Constructor for Database
     * @param dbPath Path to the database
     */
    constructor(dbPath?: string);
    /**
     * Get the database path
     * @returns string Database path
     */
    getPath(): string;
    /**
     * Create a new voting period
     * @param startBlock Start block number
     * @param endBlock End block number
     * @returns Promise<number> New voting period ID
     */
    createVotingPeriod(startBlock: number, endBlock: number): Promise<number>;
    /**
     * Record a vote
     * @param vote Vote to record
     * @param periodId Voting period ID
     * @returns Promise<boolean> True if vote was recorded successfully
     */
    recordVote(vote: Vote, periodId: number): Promise<boolean>;
    /**
     * Get UTXOs by address
     * @param address Address to get UTXOs for
     * @returns Promise<Array<{ txid: string; vout: number; amount: number; confirmations: number; }>> UTXOs for the address
     */
    getUtxosByAddress(address: string): Promise<Array<{
        txid: string;
        vout: number;
        amount: number;
        confirmations: number;
    }>>;
    private isValidUtxo;
    /**
     * Get the current block height
     * @returns Promise<number> Current block height
     */
    getCurrentHeight(): Promise<number>;
    /**
     * Get the number of unique addresses with balance
     * @returns Promise<number> Number of unique addresses with balance
     */
    getUniqueAddressesWithBalance(): Promise<number>;
    /**
     * Get the total supply of the blockchain
     * @returns Promise<bigint> Total supply
     */
    getTotalSupply(): Promise<bigint>;
    /**
     * Compact the database
     * @returns Promise<void>
     */
    compact(): Promise<void>;
    /**
     * Determine if a key should be deleted
     * @param key Key to check
     * @param value Value of the key
     * @param context Context object
     * @returns Promise<boolean> True if the key should be deleted
     */
    private shouldDelete;
    /**
     * Close the database connection
     * @returns Promise<void>
     */
    close(): Promise<void>;
    /**
     * Backup the database
     * @param path Path to backup to
     * @returns Promise<void>
     */
    backup(path: string): Promise<void>;
    /**
     * Find data in the database
     * @param query Query object
     * @returns Promise<any[]> Found data
     */
    find(query: {
        [key: string]: any;
    }): Promise<any[]>;
    private matchesQuery;
    /**
     * Get a value from the database
     * @param key Key to get
     * @returns Promise<string> Value
     */
    get(key: string): Promise<string>;
    /**
     * Query the database
     * @param sql SQL query
     * @param params Parameters for the query
     * @returns Promise<any> Query results
     */
    query(sql: string, params?: any[]): Promise<any>;
    /**
     * Get a range of blocks from the database
     * @param startHeight Start block height
     * @param endHeight End block height
     * @returns Promise<Block[]> Blocks in the range
     */
    getBlockRange(startHeight: number, endHeight: number): Promise<Block[]>;
    /**
     * Get the token holders
     * @returns Promise<Array<{ address: string; balance: bigint }>> Token holders
     */
    getTokenHolders(): Promise<Array<{
        address: string;
        balance: bigint;
    }>>;
    /**
     * Get the token balance for an address
     * @param address Address to get balance for
     * @returns Promise<{ balance: bigint; holdingPeriod: number }> Token balance and holding period
     */
    getTokenBalance(address: string): Promise<{
        balance: bigint;
        holdingPeriod: number;
    }>;
    /**
     * Remove a delegation
     * @param delegator Delegator to remove
     * @returns Promise<void>
     */
    removeDelegation(delegator: string): Promise<void>;
    /**
     * Get an auditor's signature for a vote
     * @param auditorId Auditor ID
     * @param voteId Vote ID
     * @returns Promise<string> Auditor's signature
     */
    getAuditorSignature(auditorId: string, voteId: string): Promise<string>;
    /**
     * Calculate the Gini coefficient for token distribution
     * @returns Promise<number> Gini coefficient
     */
    calculateTokenDistributionGini(): Promise<number>;
    /**
     * Get the latest vote for a voter
     * @param voterAddress Voter address
     * @returns Promise<Vote | null> Latest vote or null if not found
     */
    getLatestVote(voterAddress: string): Promise<Vote | null>;
    /**
     * Get blocks by miner
     * @param minerAddress Miner address
     * @returns Promise<Block[]> Blocks by miner
     */
    getBlocksByMiner(minerAddress: string): Promise<Block[]>;
    /**
     * Get votes by voter
     * @param voterAddress Voter address
     * @returns Promise<Vote[]> Votes by voter
     */
    getVotesByVoter(voterAddress: string): Promise<Vote[]>;
    /**
     * Get the total number of votes
     * @returns Promise<number> Total number of votes
     */
    getTotalVotes(): Promise<number>;
    /**
     * Put a value in the database
     * @param key Key to put
     * @param value Value to put
     * @returns Promise<void>
     */
    put(key: string, value: string): Promise<void>;
    /**
     * Get a transaction by its hash
     * @param hash Transaction hash
     * @returns Promise<Transaction | undefined> Transaction or undefined if not found
     */
    getTransaction(hash: string): Promise<Transaction | undefined>;
    /**
     * Save a transaction to the database
     * @param transaction Transaction to save
     * @returns Promise<void>
     */
    saveTransaction(transaction: Transaction): Promise<void>;
    private isValidTransaction;
    /**
     * Delete a transaction by its hash
     * @param hash Transaction hash
     * @returns Promise<void>
     */
    deleteTransaction(hash: string): Promise<void>;
    /**
     * Get transactions by type
     * @param type Transaction type (optional)
     * @returns Promise<Transaction[]> Transactions
     */
    getTransactions(type?: TransactionType): Promise<Transaction[]>;
    /**
     * Get the balance for an address
     * @param address Address to get balance for
     * @returns Promise<bigint> Balance
     */
    getBalance(address: string): Promise<bigint>;
    /**
     * Get the voting schema
     * @returns IVotingSchema Voting schema
     */
    getVotingSchema(): IVotingSchema;
    /**
     * Get votes by period
     * @param periodId Voting period ID
     * @returns Promise<Vote[]> Votes by period
     */
    getVotesByPeriod(periodId: number): Promise<Vote[]>;
    /**
     * Get a block by its height
     * @param height Block height
     * @returns Promise<Block | null> Block or null if not found
     */
    getBlockByHeight(height: number): Promise<Block | null>;
    /**
     * Get the total number of eligible voters
     * @returns Promise<number> Total number of eligible voters
     */
    getTotalEligibleVoters(): Promise<number>;
    /**
     * Ping the database
     * @returns Promise<boolean> True if the database is accessible
     */
    ping(): Promise<boolean>;
    /**
     * Emit a metric
     * @param name Metric name
     * @param value Metric value
     */
    private emitMetric;
    /**
     * Verify a signature
     * @param address Address to verify
     * @param message Message to verify
     * @param signature Signature to verify
     * @returns Promise<boolean> True if the signature is valid
     */
    verifySignature(address: string, message: string, signature: string): Promise<boolean>;
    /**
     * Get the chain state
     * @returns Promise<ChainState | null> Chain state or null if not found
     */
    getChainState(): Promise<ChainState | null>;
    /**
     * Update the chain state
     * @param state Chain state
     * @returns Promise<void>
     */
    updateChainState(state: ChainState): Promise<void>;
    /**
     * Get blocks from a specific height
     * @param startHeight Start block height
     * @param endHeight End block height
     * @returns Promise<Block[]> Blocks in the range
     */
    getBlocksFromHeight(startHeight: number, endHeight: number): Promise<Block[]>;
    /**
     * Save a block to the database
     * @param block Block to save
     * @returns Promise<void>
     */
    saveBlock(block: Block): Promise<void>;
    /**
     * Get a block by its hash
     * @param hash Block hash
     * @returns Promise<Block | null> Block or null if not found
     */
    getBlock(hash: string): Promise<Block | null>;
    /**
     * Get validators
     * @returns Promise<Validator[]> Validators
     */
    getValidators(): Promise<Validator[]>;
    /**
     * Update a validator's reputation
     * @param address Validator address
     * @param update Reputation update
     * @returns Promise<void>
     */
    updateValidatorReputation(address: string, update: {
        reputation: number;
        lastUpdate: number;
        reason: string;
        change: number;
    }): Promise<void>;
    /**
     * Get a validator's uptime
     * @param address Validator address
     * @returns Promise<number> Uptime
     */
    getValidatorUptime(address: string): Promise<number>;
    /**
     * Get a validator's vote participation
     * @param address Validator address
     * @returns Promise<number> Vote participation
     */
    getVoteParticipation(address: string): Promise<number>;
    /**
     * Get a validator's block production
     * @param address Validator address
     * @returns Promise<number> Block production
     */
    getBlockProduction(address: string): Promise<number>;
    /**
     * Get a validator's slashing history
     * @param address Validator address
     * @returns Promise<Array<{ timestamp: number; reason: string }>> Slashing history
     */
    getSlashingHistory(address: string): Promise<Array<{
        timestamp: number;
        reason: string;
    }>>;
    /**
     * Get a validator's expected block count
     * @param address Validator address
     * @returns Promise<number> Expected block count
     */
    private getExpectedBlockCount;
    /**
     * Get a validator's hash power contribution
     * @param address Validator address
     * @returns Promise<number> Hash power contribution
     */
    private getPowContribution;
    /**
     * Get a validator's token holder votes
     * @param address Validator address
     * @returns Promise<number> Token holder votes
     */
    private getTokenHolderVotes;
    /**
     * Get a validator's reliability
     * @param address Validator address
     * @returns Promise<number> Reliability
     */
    private getValidatorReliability;
    /**
     * Get a validator's hash power
     * @param address Validator address
     * @returns Promise<number> Hash power
     */
    private getValidatorHashPower;
    /**
     * Get the total network hash power
     * @returns Promise<number> Total network hash power
     */
    private getTotalNetworkHashPower;
    /**
     * Get a validator's block production success
     * @param address Validator address
     * @returns Promise<number> Block production success
     */
    private getBlockProductionSuccess;
    /**
     * Get a validator's average response time
     * @param address Validator address
     * @returns Promise<number> Average response time
     */
    private getAverageResponseTime;
    /**
     * Get a validator's votes
     * @param address Validator address
     * @returns Promise<number> Votes
     */
    private getVotesForValidator;
    /**
     * Get the total voting power
     * @returns Promise<bigint> Total voting power
     */
    private getTotalVotingPower;
    /**
     * Get voting periods
     * @param since Start time
     * @returns Promise<VotingPeriod[]> Voting periods
     */
    private getVotingPeriods;
    /**
     * Get a vote in a specific period
     * @param address Validator address
     * @param periodId Voting period ID
     * @returns Promise<Vote | null> Vote or null if not found
     */
    private getVoteInPeriod;
    /**
     * Get a validator by its address
     * @param address Validator address
     * @returns Promise<Validator | null> Validator or null if not found
     */
    getValidator(address: string): Promise<Validator | null>;
    /**
     * Get the total number of validators
     * @returns Promise<number> Total number of validators
     */
    getValidatorCount(): Promise<number>;
    /**
     * Get the last N blocks
     * @param n Number of blocks to get
     * @returns Promise<Block[]> Last N blocks
     */
    getLastNBlocks(n: number): Promise<Block[]>;
    /**
     * Get the nonce for an account
     * @param address Account address
     * @returns Promise<number> Nonce
     */
    getAccountNonce(address: string): Promise<number>;
    /**
     * Get the block hash by its height
     * @param height Block height
     * @returns Promise<string | null> Block hash or null if not found
     */
    getBlockHashByHeight(height: number): Promise<string | null>;
    /**
     * Set the chain head
     * @param height Block height
     * @returns Promise<void>
     */
    setChainHead(height: number): Promise<void>;
    /**
     * Execute a database transaction
     * @param callback Callback function to execute
     * @returns Promise<T> Result of the callback
     */
    executeTransaction<T>(callback: () => Promise<T>): Promise<T>;
    /**
     * Create a snapshot
     * @returns Promise<string> Snapshot ID
     */
    createSnapshot(): Promise<string>;
    /**
     * Commit a snapshot
     * @param snapshotId Snapshot ID
     * @returns Promise<void>
     */
    commitSnapshot(snapshotId: string): Promise<void>;
    /**
     * Rollback a snapshot
     * @param snapshotId Snapshot ID
     * @returns Promise<void>
     */
    rollbackSnapshot(snapshotId: string): Promise<void>;
    /**
     * Get the chain head
     * @returns Promise<number> Chain head height
     */
    getChainHead(): Promise<number>;
    /**
     * Delete a key from the database
     * @param key Key to delete
     * @returns Promise<void>
     */
    del(key: string): Promise<void>;
    /**
     * Get a validator's performance
     * @param address Validator address
     * @param blockCount Number of blocks to consider
     * @returns Promise<ValidatorPerformance> Validator performance
     */
    getValidatorPerformance(address: string, blockCount: number): Promise<ValidatorPerformance>;
    /**
     * Get a validator's stats
     * @param address Validator address
     * @returns Promise<ValidatorStats> Validator stats
     */
    getValidatorStats(address: string): Promise<ValidatorStats>;
    /**
     * Get a UTXO by its transaction ID and output index
     * @param txId Transaction ID
     * @param outputIndex Output index
     * @returns Promise<UTXO | null> UTXO or null if not found
     */
    getUTXO(txId: string, outputIndex: number): Promise<UTXO | null>;
    /**
     * Start a database transaction
     * @returns Promise<void>
     */
    beginTransaction(): Promise<void>;
    /**
     * Commit a database transaction
     * @returns Promise<void>
     */
    commit(): Promise<void>;
    /**
     * Rollback a database transaction
     * @returns Promise<void>
     */
    rollback(): Promise<void>;
    /**
     * Add a transaction operation
     * @param operation Transaction operation
     */
    protected addToTransaction(operation: AbstractBatch): void;
    /**
     * Sync a shard
     * @param shardId Shard ID
     * @param data Data to sync
     * @returns Promise<void>
     */
    syncShard(shardId: number, data: string[]): Promise<void>;
    private getShardData;
    private calculateChecksum;
    private compressData;
    getRecentTransactions(limit?: number): Promise<Transaction[]>;
    getLastAccess(id: string): Promise<number>;
    updateLastAccess(id: string): Promise<void>;
    startTransaction(): Promise<void>;
    private startTransactionMonitor;
    commitTransaction(): Promise<void>;
    rollbackTransaction(): Promise<void>;
    private invalidateAffectedCaches;
    private persistOperations;
    private validateOperations;
    getSeeds(): Promise<Array<{
        address: string;
        services: number;
        lastSeen: number;
        attempts: number;
        failures: number;
        latency: number;
        score: number;
    }>>;
    saveSeeds(seeds: Array<[string, any]>): Promise<void>;
    getActiveValidators(): Promise<{
        address: string;
    }[]>;
    getTagHolderCount(): Promise<number>;
    getTagDistribution(): Promise<number>;
    private calculateGiniCoefficient;
    getBlockByHash(hash: string): Promise<Block | null>;
    /**
     * Get all blocks at a specific height
     * @param height Block height
     * @returns Promise<Block[]> Blocks at the specified height
     */
    getBlocksByHeight(height: number): Promise<Block[]>;
    iterator(options: {
        gte: string;
        lte: string;
    }): import("level").Iterator<Level<string, string>, string, string>;
    getVotingEndHeight(): Promise<number>;
    getVotingStartHeight(): Promise<number>;
    getTransactionExecutor<T>(): (operation: () => Promise<T>) => Promise<T>;
    /**
     * Updates block difficulty in database
     */
    updateDifficulty(blockHash: string, difficulty: number): Promise<void>;
    lockTransaction(txId: string): Promise<() => Promise<void>>;
    unlockTransaction(txId: string): Promise<void>;
    markUTXOPending(txId: string, outputIndex: number): Promise<void>;
    /**
     * Get block height by hash
     * @param hash Block hash
     * @returns Promise<number | null> Block height or null if not found
     */
    getBlockHeight(hash: string): Promise<number | null>;
    hasBlock(hash: string): Promise<boolean>;
    hasTransaction(hash: string): Promise<boolean>;
    getHeaders(locator: string[], hashStop: string): Promise<BlockHeader[]>;
    getBlocks(locator: string[], hashStop: string): Promise<Block[]>;
}
export {};
