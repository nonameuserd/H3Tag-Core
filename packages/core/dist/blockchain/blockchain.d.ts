/**
 * @fileoverview Blockchain implements the core blockchain functionality including block processing,
 * chain management, consensus coordination, and network synchronization. It integrates PoW mining
 * and voting-based governance through a hybrid consensus mechanism.
 *
 * @module Blockchain
 */
/**
 * Blockchain class manages the core blockchain operations and state.
 *
 * @class Blockchain
 *
 * @property {Block[]} chain - Array of blocks in the blockchain
 * @property {UTXOSet} utxoSet - Unspent transaction output set
 * @property {Mempool} mempool - Transaction memory pool
 * @property {Map<string, Peer>} peers - Connected network peers
 * @property {Block} genesisBlock - Genesis block of the chain
 * @property {number} totalSupply - Total currency supply
 * @property {BlockchainConfig} config - Blockchain configuration
 * @property {HybridDirectConsensus} consensus - Consensus mechanism
 * @property {BlockchainSchema} db - Database interface
 * @property {ShardManager} shardManager - Sharding manager
 * @property {BlockchainSync} sync - Chain synchronization
 * @property {Node} node - Network node instance
 * @property {number} minConfirmations - Minimum confirmations for transaction finality
 * @property {EventEmitter} eventEmitter - Event emitter for blockchain events
 *
 * @example
 * const blockchain = new Blockchain(config);
 * await blockchain.initialize();
 * await blockchain.addBlock(block);
 */
/**
 * Creates a new Blockchain instance
 *
 * @constructor
 * @param {Partial<BlockchainConfig>} config - Optional blockchain configuration
 */
/**
 * Initializes the blockchain asynchronously
 *
 * @async
 * @method initializeAsync
 * @param {Partial<BlockchainConfig>} config - Optional configuration override
 * @returns {Promise<void>}
 * @throws {Error} If initialization fails
 *
 * @example
 * await blockchain.initializeAsync({
 *   network: 'testnet',
 *   maxBlockSize: 2000000
 * });
 */
/**
 * Adds a new block to the chain
 *
 * @async
 * @method addBlock
 * @param {Block} block - Block to add
 * @returns {Promise<void>}
 * @throws {Error} If block validation fails
 *
 * @example
 * const block = await miner.mineBlock();
 * await blockchain.addBlock(block);
 */
/**
 * Gets block by height
 *
 * @method getBlockByHeight
 * @param {number} height - Block height
 * @returns {Block | undefined} Block at height if found
 *
 * @example
 * const block = blockchain.getBlockByHeight(1000);
 */
/**
 * Gets block by hash
 *
 * @method getBlockByHash
 * @param {string} hash - Block hash
 * @returns {Block | undefined} Block with hash if found
 *
 * @example
 * const block = blockchain.getBlockByHash('0x...');
 */
/**
 * Gets current blockchain height
 *
 * @method getCurrentHeight
 * @returns {number} Current chain height
 */
/**
 * Gets chain tip (latest block)
 *
 * @method getChainTip
 * @returns {ChainTip} Current chain tip info
 */
/**
 * Validates a transaction
 *
 * @async
 * @method validateTransaction
 * @param {Transaction} transaction - Transaction to validate
 * @param {boolean} [mempool=false] - Whether transaction is from mempool
 * @returns {Promise<boolean>} True if transaction is valid
 *
 * @example
 * const isValid = await blockchain.validateTransaction(tx);
 */
/**
 * Gets transaction by hash
 *
 * @async
 * @method getTransaction
 * @param {string} hash - Transaction hash
 * @returns {Promise<Transaction | undefined>} Transaction if found
 *
 * @example
 * const tx = await blockchain.getTransaction('0x...');
 */
/**
 * @typedef {Object} ChainTip
 * @property {number} height - Block height
 * @property {string} hash - Block hash
 * @property {number} branchLen - Length of branch
 * @property {'active' | 'valid-fork' | 'valid-headers' | 'invalid'} status - Tip status
 * @property {string} [firstBlockHash] - Hash of first block in branch
 * @property {number} [lastValidatedAt] - Timestamp of last validation
 */
/**
 * @typedef {Object} DbSolution
 * @property {Object} data - Solution data
 * @property {string} data.blockHash - Block hash
 * @property {number} data.nonce - Solution nonce
 * @property {number} data.difficulty - Block difficulty
 * @property {string} data.minerAddress - Miner's address
 * @property {string} data.signature - Solution signature
 * @property {number} timestamp - Solution timestamp
 */
/**
 * @typedef {Object} PowSolution
 * @property {string} blockHash - Block hash
 * @property {number} nonce - Solution nonce
 * @property {number} difficulty - Block difficulty
 * @property {number} timestamp - Solution timestamp
 * @property {string} minerAddress - Miner's address
 * @property {string} signature - Solution signature
 * @property {boolean} [verified] - Whether solution is verified
 */
import { UTXO, UTXOSet } from "../models/utxo.model";
import { Mempool } from "./mempool";
import { BlockchainConfig } from "@h3tag-blockchain/shared";
import { BlockchainSchema } from "../database/blockchain-schema";
import { HybridDirectConsensus } from "./consensus/hybrid-direct";
import { Peer } from "../network/peer";
import { BlockchainStats } from "./blockchain-stats";
import { Transaction } from "../models/transaction.model";
import { Block } from "../models/block.model";
import { Node } from "../network/node";
import { Vote } from "../models/vote.model";
export interface PowSolution {
    blockHash: string;
    nonce: number;
    difficulty: number;
    timestamp: number;
    minerAddress: string;
    signature: string;
    verified?: boolean;
}
interface ChainTip {
    height: number;
    hash: string;
    branchLen: number;
    status: 'active' | 'valid-fork' | 'valid-headers' | 'invalid';
    firstBlockHash?: string;
    lastValidatedAt?: number;
}
export declare class Blockchain {
    private static instance;
    private chain;
    private utxoSet;
    private mempool;
    private peers;
    private genesisBlock;
    private totalSupply;
    private config;
    private consensus;
    db: BlockchainSchema;
    private shardManager;
    private sync;
    private consensusPublicKey;
    private node;
    private readonly minConfirmations;
    private heightCache;
    private readonly eventEmitter;
    private readonly utxoCache;
    private utxoSetCache;
    private blockCache;
    private readonly healthMonitor;
    private readonly transactionCache;
    private readonly firstTxCache;
    private readonly hybridCrypto;
    private merkleTree;
    private readonly spentTxTracker;
    private readonly txLock;
    private readonly MEMPOOL_EXPIRY_TIME;
    private readonly MAX_MEMPOOL_SIZE;
    private readonly blacklistedAddresses;
    private readonly rateLimiter;
    private readonly MAX_REORG_DEPTH;
    private readonly reorgLock;
    private readonly errorMonitor;
    private readonly errorHandler;
    private readonly peerManager;
    private readonly auditManager;
    private readonly cacheLock;
    private readonly circuitBreakers;
    private readonly metrics;
    private readonly retryStrategy;
    private boundSyncCompleted;
    private boundSyncError;
    private readonly mutex;
    private readonly healthCheckInterval;
    private healthCheckTimer;
    private readonly validationInterval;
    private validationTimer;
    private ddosProtection;
    private readonly chainLock;
    private cleanupTimer;
    /**
     * Creates a new blockchain instance with the specified configuration
     * @param config Optional blockchain configuration parameters
     */
    constructor(config?: Partial<BlockchainConfig>);
    /**
     * Initializes blockchain components asynchronously
     * @param config Optional blockchain configuration
     * @throws Error if initialization fails
     */
    private initializeAsync;
    /**
     * Initializes keys for consensus
     * @returns Promise<void>
     */
    private initializeKeys;
    /**
     * Sets up event listeners
     * @returns void
     */
    private setupEventListeners;
    /**
     * Creates a new blockchain instance
     * @param config Optional blockchain configuration
     * @returns Promise<Blockchain> New blockchain instance
     */
    static create(config?: Partial<BlockchainConfig>): Promise<Blockchain>;
    /**
    * Create the genesis block
     */
    private createGenesisBlock;
    /**
     * Adds a new block to the blockchain
     * @param block The block to be added
     * @returns Promise<boolean> True if block was added successfully
     * @throws Error if block validation fails
     */
    addBlock(block: Block): Promise<boolean>;
    private validateBlockPreAdd;
    /**
     * Calculate block hash
     */
    private calculateBlockHash;
    /**
     * Get block by hash with caching and validation
     */
    getBlock(hash: string): Promise<Block | undefined>;
    /**
     * Get block by height
     */
    getBlockByHeight(height: number): Block | undefined;
    /**
     * Get current chain height with caching
     * @returns number The current blockchain height
     */
    getHeight(): number;
    /**
     * Get UTXO set
     */
    getUTXOSet(): Promise<UTXOSet>;
    /**
     * Rebuilds UTXO set
     */
    private rebuildUTXOSet;
    /**
     * Get current difficulty
     */
    getCurrentDifficulty(): number;
    /**
     * Validate the entire chain
     */
    validateChain(): Promise<boolean>;
    /**
     * Get chain state
     */
    getState(): {
        chain: Block[];
        utxoSet: UTXOSet;
        height: number;
        totalSupply: number;
    };
    getMempool(): Mempool;
    getTotalSupply(): number;
    getPowSolutions(minerAddress: string, sinceTimestamp: number): Promise<PowSolution[]>;
    getConfig(): {
        blockchain: {
            maxSupply: number;
            blockTime: number;
        };
    };
    start(): Promise<void>;
    stop(): Promise<void>;
    /**
     * Get blockchain stats
     */
    getBlockchainStats(): BlockchainStats;
    getCurrentHeight(): number;
    getLatestBlock(): Block | null;
    /**
     * Calculates the merkle root for a given set of transactions
     * @param transactions Transactions to calculate the merkle root for
     * @returns Promise<string> The merkle root
     */
    private calculateMerkleRoot;
    /**
     * Mines a new block
     * @param transactions Transactions to include in the block
     * @returns Promise<Block> Newly mined block
     */
    mineNewBlock(transactions: Transaction[]): Promise<Block>;
    /**
     * Gets transaction by hash
     * @param hash Transaction hash
     * @returns Promise<Transaction|undefined> Transaction if found
     */
    getTransaction(hash: string): Promise<Transaction | undefined>;
    /**
     * Get currency details including current supply
     */
    getCurrencyDetails(): {
        name: string;
        symbol: string;
        decimals: number;
        totalSupply: number;
        maxSupply: number;
        circulatingSupply: number;
    };
    /**
     * Calculate block reward at given height with additional security and precision
     */
    calculateBlockReward(height: number): bigint;
    /**
     * Get circulating supply (excluding burned/locked tokens)
     */
    private getCirculatingSupply;
    /**
     * Get confirmed UTXOs for an address
     * @param address Address to get UTXOs for
     * @returns Promise<Array<{ txid: string; vout: number; amount: number; confirmations: number; }>> Confirmed UTXOs
     */
    getConfirmedUtxos(address: string): Promise<Array<{
        txid: string;
        vout: number;
        amount: number;
        confirmations: number;
    }>>;
    /**
     * Initializes blockchain configuration
     * @param config Partial blockchain configuration
     * @returns Blockchain configuration
     */
    private initializeConfig;
    /**
     * Get maximum allowed transaction size based on network conditions
     * @returns {number} Maximum transaction size in bytes
     */
    getMaxTransactionSize(): Promise<number>;
    /**
     * Cleans up resources and stops blockchain operations
     */
    dispose(): Promise<void>;
    private monitorMemoryUsage;
    private pruneMemory;
    getConsensusMetrics(): Promise<{
        powHashrate: number;
        activeVoters: number;
        participation: number;
        currentParticipation: number;
    }>;
    getNode(): Node;
    private signBlock;
    addTransaction(tx: Transaction): Promise<boolean>;
    /**
     * Gets the first transaction for an address
     * @param address Address to get the first transaction for
     * @returns Promise<{ blockHeight: number } | null> First transaction for the address
     */
    getFirstTransactionForAddress(address: string): Promise<{
        blockHeight: number;
    } | null>;
    /**
     * Validates transaction amount
     * @param tx Transaction to validate
     * @returns Promise<boolean> True if transaction amount is valid
     */
    validateTransactionAmount(tx: Transaction): Promise<boolean>;
    /**
     * Calculates the total amount of inputs for a given transaction
     * @param inputs Inputs to calculate the total amount for
     * @returns Promise<bigint> Total amount of inputs
     */
    private calculateInputAmount;
    /**
     * Checks and marks spent transactions
     * @param tx Transaction to check and mark
     * @returns Promise<boolean> True if transaction is valid
     */
    private checkAndMarkSpent;
    /**
     * Processes a payment transaction
     * @param tx Transaction to process
     * @returns Promise<boolean> True if transaction is processed successfully
     */
    processPayment(tx: Transaction): Promise<boolean>;
    /**
     * Cleans up mempool
     */
    private cleanupMempool;
    /**
     * Handles chain reorganization when a new chain tip is received
     * @param newChainTip The new chain tip block
     * @returns Promise<boolean> True if reorganization was successful
     */
    handleChainReorganization(newChainTip: Block): Promise<boolean>;
    /**
     * Finds the common ancestor between two blocks
     * @param newTip The new chain tip block
     * @returns Promise<Block | null> The common ancestor block or null if not found
     */
    private findCommonAncestor;
    /**
     * Validates transaction size
     * @param tx Transaction to validate
     * @returns boolean True if transaction size is valid
     */
    private validateTransactionSize;
    /**
     * Calculates the transaction fee
     * @param tx Transaction to calculate fee for
     * @returns bigint Transaction fee
     */
    private calculateTransactionFee;
    /**
     * Validates a transaction
     * @param tx Transaction to validate
     * @returns Promise<boolean> True if transaction is valid
     */
    validateTransaction(tx: Transaction): Promise<boolean>;
    /**
     * Adds a new peer to the blockchain
     * @param peerUrl Peer URL to add
     * @returns Promise<boolean> True if peer was added successfully
     */
    addPeer(peerUrl: string): Promise<boolean>;
    /**
     * Handles peer ban
     * @param data Peer ban data
     */
    private handlePeerBanned;
    /**
     * Handles peer violation
     * @param data Peer violation data
     */
    private handlePeerViolation;
    /**
     * Updates peer scores
     */
    private updatePeerScores;
    /**
     * Rolls back to a specific block height
     * @param height Block height to rollback to
     * @returns Promise<void>
     */
    private rollbackToBlock;
    /**
     * Gets new chain blocks
     * @param commonAncestor The common ancestor block
     * @param newTip The new chain tip block
     * @returns Promise<Block[]> New chain blocks
     */
    private getNewChainBlocks;
    /**
     * Reverts a block
     * @param block Block to revert
     * @returns Promise<void>
     */
    private revertBlock;
    /**
     * Wraps operations with circuit breaker for critical operations
     * @param operation Name of the operation being performed
     * @param action Function to execute within error boundary
     * @returns Promise<T> Result of operation
     * @throws Error if action fails
     */
    private withCircuitBreaker;
    /**
     * Syncs with a peer
     * @param peer Peer to sync with
     * @returns Promise<void>
     */
    syncWithPeer(peer: Peer): Promise<void>;
    /**
     * Rolls back a transaction
     * @param tx Transaction to rollback
     * @returns Promise<void>
     */
    private rollbackTransaction;
    /**
     * Handles sync completion
     */
    private handleSyncCompleted;
    /**
     * Handles sync error
     * @param error Sync error
     */
    private handleSyncError;
    /**
     * Validates and updates the UTXO set
     * @throws Error if validation fails
     */
    private validateAndUpdateUTXOSet;
    /**
     * Performs health check on blockchain system
     * @returns Promise<boolean> True if system is healthy
     */
    healthCheck(): Promise<boolean>;
    /**
     * Wraps operations with error boundary for consistent error handling
     * @param operation Name of the operation being performed
     * @param action Function to execute within error boundary
     * @returns Promise<T> Result of the action
     * @throws Error if action fails
     */
    private withErrorBoundary;
    /**
     * Starts periodic validation of blockchain state
     */
    private startPeriodicValidation;
    getValidatorCount(): Promise<number>;
    private handleBlockMined;
    getUTXO(txId: string, outputIndex: number): Promise<UTXO | null>;
    getDynamicBlockSize(block: Block): Promise<number>;
    getVersion(): number;
    hasBlock(hash: string): boolean;
    validateBlock(block: Block): Promise<boolean>;
    verifyBlock(block: Block): Promise<boolean>;
    processVote(vote: Vote): Promise<void>;
    /**
     * Gets the consensus public key for the blockchain
     * @returns string The consensus public key
     */
    getConsensusPublicKey(): string;
    static getInstance(config?: Partial<BlockchainConfig>): Blockchain;
    /**
     * Gets information about all known chain tips
     * @returns Promise<ChainTip[]> Array of chain tips information
     */
    getChainTips(): Promise<ChainTip[]>;
    getVerificationProgress(): number;
    getChainWork(): string;
    isInitialBlockDownload(): boolean;
    private calculateChainWork;
    getConsensus(): HybridDirectConsensus;
    hasTransaction(hash: string): Promise<boolean>;
    isUTXOSpent(input: {
        txId: string;
        outputIndex: number;
    }): Promise<boolean>;
    private updatePostBlockAdd;
    private retryPostBlockAdd;
}
export {};
