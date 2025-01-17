/// <reference types="node" />
import { Block } from "../../models/block.model";
import { Blockchain } from "../blockchain";
import { Transaction } from "../../models/transaction.model";
interface MiningHealth {
    isHealthy: boolean;
    hashRate: number;
    workerCount: number;
    cacheHitRate: number;
    lastBlockTime: number;
}
interface MiningInfo {
    powEnabled: boolean;
    mining: boolean;
    hashRate: number;
    difficulty: number;
    networkHashRate: number;
    blockHeight: number;
    lastBlockTime: number;
    workers: {
        total: number;
        active: number;
        idle: number;
    };
    hardware: {
        gpuEnabled: boolean;
        gpuStatus: string;
        cpuThreads: number;
    };
    mempool: {
        pending: number;
        size: number;
    };
    performance: {
        averageBlockTime: number;
        successRate: number;
        cacheHitRate: number;
    };
    network: {
        activeMiners: number;
        participationRate: number;
        targetBlockTime: number;
    };
}
interface BlockTemplate {
    version: number;
    height: number;
    previousHash: string;
    timestamp: number;
    difficulty: number;
    transactions: Transaction[];
    merkleRoot: string;
    target: string;
    minTime: number;
    maxTime: number;
    maxVersion: number;
    minVersion: number;
    defaultVersion: number;
}
export interface BlockInFlight {
    height: number;
    hash: string;
    startTime: number;
    timeout: NodeJS.Timeout;
    attempts: number;
    peer?: string;
}
/**
 * @fileoverview ProofOfWork implements the Proof of Work consensus mechanism for block mining
 * and validation. It handles mining operations, difficulty adjustments, and block rewards.
 *
 * @module ProofOfWork
 */
/**
 * ProofOfWork implements the Proof of Work consensus mechanism for block mining and validation.
 * It manages mining operations, worker threads, difficulty adjustments, and block rewards.
 *
 * @class ProofOfWork
 *
 * @property {BlockchainSchema} db - Database instance
 * @property {Mempool} mempool - Transaction mempool instance
 * @property {AuditManager} auditManager - Audit logging manager
 * @property {Worker[]} workers - Mining worker threads
 * @property {Cache<Block>} blockCache - Block validation cache
 * @property {MerkleTree} merkleTree - Merkle tree operations
 * @property {Performance} metrics - Mining performance metrics
 * @property {RetryStrategy} retryStrategy - Operation retry handling
 * @property {boolean} isInterrupted - Mining interrupt flag
 * @property {KeyPair} minerKeyPair - Miner's key pair
 * @property {number} miningFailures - Consecutive mining failures
 *
 * @example
 * const pow = new ProofOfWork(blockchain, mempool, auditManager);
 * await pow.initialize();
 * const block = await pow.createAndMineBlock();
 */
/**
 * Creates a new instance of ProofOfWork
 *
 * @constructor
 * @param {Blockchain} blockchain - Blockchain instance
 * @param {Mempool} mempool - Mempool instance
 * @param {AuditManager} auditManager - Audit manager instance
 */
/**
 * Initializes the mining system
 *
 * @async
 * @method initialize
 * @returns {Promise<void>}
 * @throws {Error} If initialization fails
 */
/**
 * Gets the current network difficulty
 *
 * @async
 * @method getNetworkDifficulty
 * @returns {Promise<number>} Current network difficulty
 */
/**
 * Gets active miners in the network
 *
 * @async
 * @method getActiveMiners
 * @returns {Promise<string[]>} Array of active miner addresses
 */
/**
 * Gets mining participation rate
 *
 * @async
 * @method getParticipationRate
 * @returns {Promise<number>} Participation rate as percentage
 */
/**
 * Creates and mines a new block
 *
 * @async
 * @method createAndMineBlock
 * @returns {Promise<Block>} Mined block
 * @throws {Error} If block creation or mining fails
 *
 * @example
 * const block = await pow.createAndMineBlock();
 * await blockchain.addBlock(block);
 */
/**
 * Validates a block's proof of work
 *
 * @async
 * @method validateBlock
 * @param {Block} block - Block to validate
 * @returns {Promise<boolean>} True if block is valid
 */
/**
 * Submits a mined block
 *
 * @async
 * @method submitBlock
 * @param {Block} block - Block to submit
 * @returns {Promise<boolean>} True if block was accepted
 * @throws {Error} If block validation fails
 */
/**
 * Gets mining information and statistics
 *
 * @async
 * @method getMiningInfo
 * @returns {Promise<MiningInfo>} Current mining status and statistics
 */
/**
 * Gets network hash rate
 *
 * @async
 * @method getNetworkHashPS
 * @param {number} blocks - Number of blocks to analyze (default 120)
 * @param {number} height - Starting block height (-1 for latest)
 * @returns {Promise<number>} Network hash rate in H/s
 */
/**
 * Gets block template for mining
 *
 * @async
 * @method getBlockTemplate
 * @param {string} minerAddress - Address to receive mining reward
 * @returns {Promise<BlockTemplate>} Block template ready for mining
 * @throws {Error} If template generation fails
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
 * @typedef {Object} MiningInfo
 * @property {boolean} powEnabled - Whether PoW mining is enabled
 * @property {boolean} mining - Whether currently mining
 * @property {number} hashRate - Current hash rate
 * @property {number} difficulty - Current network difficulty
 * @property {number} networkHashRate - Network hash rate
 * @property {number} blockHeight - Current block height
 * @property {number} lastBlockTime - Last block timestamp
 * @property {Object} workers - Worker thread statistics
 * @property {Object} hardware - Mining hardware information
 * @property {Object} mempool - Mempool statistics
 * @property {Object} performance - Mining performance metrics
 * @property {Object} network - Network statistics
 */
/**
 * @typedef {Object} BlockTemplate
 * @property {number} version - Block version
 * @property {number} height - Block height
 * @property {string} previousHash - Previous block hash
 * @property {number} timestamp - Block timestamp
 * @property {number} difficulty - Target difficulty
 * @property {Transaction[]} transactions - Block transactions
 * @property {string} merkleRoot - Merkle root of transactions
 * @property {string} target - Target hash in hex
 * @property {number} minTime - Minimum timestamp
 * @property {number} maxTime - Maximum timestamp
 */
/**
 * @typedef {Object} BlockSizeComponents
 * @property {number} header - Size of block header in bytes
 * @property {number} transactions - Size of transactions in bytes
 * @property {number} metadata - Size of metadata in bytes
 * @property {number} total - Total block size in bytes
 */
export declare class ProofOfWork {
    private readonly eventEmitter;
    private isInterrupted;
    private readonly MAX_NONCE;
    private readonly db;
    private readonly miningDb;
    private workers;
    private readonly NUM_WORKERS;
    private metrics;
    private readonly mempool;
    private readonly target;
    private difficultyAdjuster;
    private gpuMiner;
    private readonly blockchain;
    private readonly node;
    private readonly nonceCache;
    private readonly shardManager;
    private blockValidator;
    private readonly blockCache;
    private readonly performanceMonitor;
    private readonly healthMonitor;
    private merkleTree;
    private readonly gpuCircuitBreaker;
    private workerPool;
    private readonly auditManager;
    private readonly minerKeyPair;
    private ddosProtection;
    private readonly templateCache;
    private minTime;
    private lastBlockTime;
    private readonly blocksInFlight;
    private readonly MAX_BLOCKS_IN_FLIGHT;
    private readonly BLOCK_TIMEOUT;
    private readonly MAX_RETRY_ATTEMPTS;
    private miningFailures;
    private readonly MAX_FAILURES;
    private readonly retryStrategy;
    private readonly txSelectionLock;
    /**
     * Creates a new ProofOfWork instance
     * @param blockchain Reference to the blockchain instance
     */
    constructor(blockchain: Blockchain);
    /**
     * Initializes PoW components including workers and GPU miner
     * @throws Error if initialization fails
     */
    initialize(): Promise<void>;
    /**
     * Mines a new block using available mining strategies
     * @param block Block structure to mine
     * @returns Promise<Block> Mined block with valid nonce
     * @throws Error if mining fails after max retries
     */
    mineBlock(block: Block): Promise<Block>;
    /**
     * Handles error boundary for mining operations
     * @param operation Name of operation being performed
     * @param action Function to execute within boundary
     * @returns Promise<T> Result of operation
     */
    private withErrorBoundary;
    private tryMiningStrategies;
    private getTarget;
    private validateBlockStructure;
    /**
     * Calculates hash rate from mining results
     * @param nonce Final nonce value
     * @param timeTaken Time taken to find nonce in ms
     * @returns number Calculated hash rate
     */
    private calculateHashRate;
    /**
     * Updates mining metrics
     * @param startTime Start time of mining
     * @param nonce Nonce used for mining
     * @param success True if mining was successful
     */
    private updateMetrics;
    /**
     * Emits progress event for block mining
     * @param nonce Nonce used for mining
     * @param hashRate Hash rate of mining
     * @param startTime Start time of mining
     */
    private emitProgress;
    /**
     * Emits success event for block mining
     * @param block Block that was mined
     * @param nonce Nonce used for mining
     * @param hashRate Hash rate of mining
     * @param startTime Start time of mining
     */
    private emitSuccess;
    getMetrics(): {
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
    interruptMining(): void;
    resumeMining(): void;
    /**
     * Calculates next difficulty
     * @param lastBlock Block to calculate from
     * @returns Promise<number> Next difficulty
     */
    private calculateNextDifficulty;
    /**
     * Gets block by height
     * @param height Block height
     * @returns Promise<Block> Block at specified height
     */
    private getBlockByHeight;
    /**
     * Calculates block hash
     * @param block Block to calculate hash for
     * @returns string Calculated hash
     */
    calculateBlockHash(block: Block): string;
    /**
     * Gets block by height
     * @param height Block height
     * @returns Promise<Block> Block at specified height
     */
    getBlock(height: number): Promise<Block>;
    private prepareHeaderBase;
    /**
     * Calculates mining target based on difficulty
     * @param difficulty Current mining difficulty
     * @returns bigint Target value that hash must be below
     */
    private calculateTarget;
    /**
     * Checks cache for previous mining results
     * @param block Block to check
     * @returns Block with nonce and hash if found, null otherwise
     */
    private checkCache;
    /**
     * Attempts parallel mining
     * @param block Block to mine
     * @returns Promise<Block | null> Mined block or null if failed
     */
    private tryParallelMining;
    /**
     * Attempts CPU mining
     * @param block Block to mine
     * @returns Promise<Block | null> Mined block or null if failed
     */
    private tryCPUMining;
    /**
     * Validates block's proof of work
     * @param block Block to validate
     * @returns Promise<boolean> True if block meets difficulty target
     */
    validateBlock(block: Block): Promise<boolean>;
    /**
     * Validates block's merkle root
     * @param block Block to validate
     * @returns Promise<boolean> True if merkle root is valid
     */
    validateBlockMerkleRoot(block: Block): Promise<boolean>;
    /**
     * Cleans up mining workers
     * @returns Promise<void>
     */
    private cleanupWorkers;
    /**
     * Cleans up mining resources
    */
    dispose(): Promise<void>;
    on(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    /**
     * Validates proof of work for a given hash
     * @param hash Hash to validate
     * @param minWork Minimum work required
     * @returns Promise<boolean> True if hash meets work requirement
     */
    validateWork(data: string, difficulty: number): Promise<boolean>;
    /**
     * Calculates classical hash for a given data
     * @param data Data to hash
     * @returns Promise<string> Hashed data
     */
    private calculateClassicalHash;
    /**
     * Gets maximum target value
     * @returns bigint Maximum target value
     */
    getMaxTarget(): bigint;
    /**
     * Gets minimum difficulty
     * @returns number Minimum difficulty
     */
    getMinDifficulty(): number;
    /**
     * Gets maximum difficulty
     * @returns number Maximum difficulty
     */
    getMaxDifficulty(): number;
    /**
     * Gets network difficulty
     * @returns Promise<number> Network difficulty
     */
    getNetworkDifficulty(): Promise<number>;
    /**
     * Gets recent blocks
     * @param count Number of blocks to get
     * @returns Promise<Block[]> Recent blocks
     */
    private getRecentBlocks;
    /**
     * Calculates average block time
     * @param blocks Blocks to calculate from
     * @returns number Average block time in milliseconds
     */
    private calculateAverageBlockTime;
    /**
     * Performs health check of PoW node
     * @returns Promise<boolean> True if node is healthy
     */
    healthCheck(): Promise<boolean>;
    /**
     * Checks mining health
     * @returns Promise<MiningHealth> Mining health
     */
    checkMiningHealth(): Promise<MiningHealth>;
    validateReward(transaction: Transaction, currentHeight: number): Promise<boolean>;
    getParticipationRate(): Promise<number>;
    private getActiveMiners;
    private shouldUpdateStructure;
    private isValidHash;
    private isCoinbaseTransaction;
    private calculateBlockSize;
    private calculateTransactionSize;
    getDynamicBlockSize(block: Block): Promise<number>;
    private constructBlock;
    /**
     * Creates and mines a new block with transactions from mempool
     * @returns Promise<Block> The mined block
     */
    createAndMineBlock(): Promise<Block>;
    /**
     * Verifies a coinbase transaction
     * @param tx Transaction to verify
     * @returns Promise<boolean> True if valid
     */
    private verifyCoinbaseTransaction;
    /**
     * Creates a coinbase transaction for block reward
     * @param reward Block reward amount
     * @returns Promise<Transaction> Coinbase transaction
     */
    private createCoinbaseTransaction;
    /**
     * Generates a coinbase script
     * Format: <block_height> <arbitrary_data> <extra_nonce>
     */
    private generateCoinbaseScript;
    /**
     * Starts the mining loop
     */
    startMining(): Promise<void>;
    /**
     * Stops the mining loop
     */
    stopMining(): void;
    /**
     * Gets comprehensive mining status information
     * @returns Promise<MiningInfo> Current mining status
     */
    getMiningInfo(): Promise<MiningInfo>;
    /**
     * Gets current GPU mining status
     * @returns string Status of GPU mining
     */
    private getGPUStatus;
    /**
     * Calculates network hash rate in hashes per second
     * @param blocks Number of blocks to look back (default 120)
     * @param height Block height to start from (default -1 for latest)
     * @returns Promise<number> Network hash rate in H/s
     */
    getNetworkHashPS(blocks?: number, height?: number): Promise<number>;
    /**
     * Calculates the amount of work for a given difficulty
     * @param difficulty Block difficulty
     * @returns bigint Amount of work (hashes) required
     */
    private getBlockWork;
    /**
     * Generates a block template for mining
     * @param minerAddress Address to receive mining reward
     * @returns Promise<BlockTemplate> Block template ready for mining
     */
    getBlockTemplate(minerAddress: string): Promise<BlockTemplate>;
    /**
     * Selects and validates transactions for block template
     * @param transactions Available transactions
     * @param maxBlockSize Maximum block size
     * @param coinbase Coinbase transaction
     * @returns Promise<Transaction[]> Selected valid transactions
     */
    private selectTransactions;
    /**
     * Validates a transaction for inclusion in block template
     * @param tx Transaction to validate
     * @returns Promise<boolean> True if transaction is valid
     */
    private validateTemplateTransaction;
    /**
     * Submit a mined block to the network
     * @param block The mined block to submit
     * @returns Promise<boolean> True if block was accepted
     * @throws Error if block validation fails
     */
    submitBlock(block: Block): Promise<boolean>;
    /**
     * Validates block header fields
     * @param block Block to validate header
     * @returns Promise<boolean> True if header is valid
     */
    private validateBlockHeader;
    /**
     * Checks if a hash meets the target difficulty
     * @param hash Hash to check
     * @param target Target difficulty in hex
     * @returns boolean True if hash meets target
     */
    private meetsTarget;
    private addInflightBlock;
    private removeInflightBlock;
    private handleBlockTimeout;
    getInflightBlocks(): BlockInFlight[];
    private persistBlock;
    /**
     * Updates difficulty after new block
     */
    updateDifficulty(block: Block): Promise<void>;
}
export {};
