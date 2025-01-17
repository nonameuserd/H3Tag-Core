import { Transaction, TransactionType } from "../models/transaction.model";
import { UTXO, UTXOSet } from "../models/utxo.model";
import { Blockchain } from "./blockchain";
import { Validator } from "../models/validator";
/**
 * @fileoverview Mempool manages unconfirmed transactions before they are included in blocks.
 * It implements transaction validation, fee-based prioritization, and memory management with
 * configurable limits and eviction policies.
 *
 * @module Mempool
 */
/**
 * Mempool class manages unconfirmed transactions with fee prioritization and ancestor/descendant tracking.
 *
 * @class Mempool
 *
 * @property {Map<string, Transaction>} transactions - Map of transactions in mempool
 * @property {Map<number, Set<string>>} feeRateBuckets - Fee rate-based transaction grouping
 * @property {Map<string, Set<string>>} ancestorMap - Transaction ancestor relationships
 * @property {Map<string, Set<string>>} descendantMap - Transaction descendant relationships
 * @property {HybridDirectConsensus} consensus - Consensus mechanism instance
 * @property {Blockchain} blockchain - Blockchain instance
 * @property {Node} node - Network node instance
 * @property {HealthMonitor} healthMonitor - Mempool health monitoring
 * @property {AuditManager} auditManager - Audit logging manager
 * @property {Cache} cache - Transaction cache
 * @property {DDoSProtection} ddosProtection - DDoS protection
 *
 * @example
 * const mempool = new Mempool(blockchain);
 * await mempool.addTransaction(transaction);
 * const pendingTxs = mempool.getPendingTransactions();
 */
/**
 * @typedef {Object} MempoolInfo
 * @property {number} size - Number of transactions
 * @property {number} bytes - Total size in bytes
 * @property {number} usage - Memory usage
 * @property {number} maxSize - Maximum size limit
 * @property {number} maxMemoryUsage - Maximum memory limit
 * @property {number} currentMemoryUsage - Current memory usage
 * @property {number} loadFactor - Current load factor
 * @property {Object} fees - Fee statistics
 * @property {Object} transactions - Transaction statistics
 * @property {Object} age - Transaction age statistics
 * @property {Object} health - Health status
 */
/**
 * @typedef {Object} FeeMetrics
 * @property {number} mean - Mean fee rate
 * @property {number} median - Median fee rate
 * @property {number} min - Minimum fee rate
 * @property {number} max - Maximum fee rate
 */
/**
 * @typedef {Object} RawMempoolEntry
 * @property {string} txid - Transaction ID
 * @property {number} fee - Transaction fee
 * @property {number} vsize - Virtual size
 * @property {number} weight - Transaction weight
 * @property {number} time - Entry timestamp
 * @property {number} height - Entry height
 * @property {number} descendantcount - Number of descendants
 * @property {number} descendantsize - Size of descendants
 * @property {number} ancestorcount - Number of ancestors
 * @property {number} ancestorsize - Size of ancestors
 * @property {string[]} depends - Dependencies
 */
/**
 * Creates a new Mempool instance
 *
 * @constructor
 * @param {Blockchain} blockchain - Blockchain instance
 */
/**
 * Adds a transaction to the mempool
 *
 * @async
 * @method addTransaction
 * @param {Transaction} transaction - Transaction to add
 * @param {boolean} [broadcast=true] - Whether to broadcast to peers
 * @returns {Promise<boolean>} True if transaction was added
 * @throws {Error} If transaction is invalid or mempool is full
 *
 * @example
 * const success = await mempool.addTransaction(tx);
 * if (success) {
 *   console.log('Transaction added to mempool');
 * }
 */
/**
 * Removes transactions from mempool
 *
 * @method removeTransactions
 * @param {Transaction[]} transactions - Transactions to remove
 * @returns {void}
 */
/**
 * Gets mempool information and statistics
 *
 * @method getMempoolInfo
 * @returns {MempoolInfo} Mempool statistics
 *
 * @example
 * const info = mempool.getMempoolInfo();
 * console.log(`Mempool size: ${info.size} transactions`);
 */
/**
 * Gets fee metrics for mempool transactions
 *
 * @method getFeeMetrics
 * @returns {FeeMetrics} Fee statistics
 */
/**
 * Gets transactions ordered by fee rate
 *
 * @method getTransactionsByFeeRate
 * @param {number} [limit] - Maximum transactions to return
 * @returns {Transaction[]} Ordered transactions
 */
/**
 * Validates transaction for mempool acceptance
 *
 * @async
 * @method validateTransaction
 * @param {Transaction} transaction - Transaction to validate
 * @returns {Promise<boolean>} True if transaction is valid
 * @throws {Error} If validation fails
 */
/**
 * Checks if transaction exists in mempool
 *
 * @method hasTransaction
 * @param {string} txid - Transaction ID
 * @returns {boolean} True if transaction exists
 */
/**
 * Gets ancestor transactions
 *
 * @method getAncestors
 * @param {string} txid - Transaction ID
 * @returns {Set<string>} Ancestor transaction IDs
 */
/**
 * Gets descendant transactions
 *
 * @method getDescendants
 * @param {string} txid - Transaction ID
 * @returns {Set<string>} Descendant transaction IDs
 */
/**
 * Cleans up expired transactions
 *
 * @private
 * @method cleanupExpiredTransactions
 * @returns {void}
 */
/**
 * Updates mempool state after block addition
 *
 * @async
 * @method updateAfterBlock
 * @param {Block} block - New block
 * @returns {Promise<void>}
 */
interface MempoolInfo {
    size: number;
    bytes: number;
    usage: number;
    maxSize: number;
    maxMemoryUsage: number;
    currentMemoryUsage: number;
    loadFactor: number;
    fees: {
        base: number;
        current: number;
        mean: number;
        median: number;
        min: number;
        max: number;
    };
    transactions: {
        total: number;
        pending: number;
        distribution: Record<TransactionType, number>;
    };
    age: {
        oldest: number;
        youngest: number;
    };
    health: {
        status: "healthy" | "degraded" | "critical";
        lastUpdate: number;
        isAcceptingTransactions: boolean;
    };
}
interface RawMempoolEntry {
    txid: string;
    fee: number;
    vsize: number;
    weight: number;
    time: number;
    height: number;
    descendantcount: number;
    descendantsize: number;
    ancestorcount: number;
    ancestorsize: number;
    depends: string[];
}
/**
 * Mempool class for managing unconfirmed transactions
 * @class
 * @description Handles transaction queuing, validation, and fee-based prioritization
 */
export declare class Mempool {
    private readonly transactions;
    private readonly feeRateBuckets;
    private readonly ancestorMap;
    private readonly descendantMap;
    private readonly consensus;
    private readonly blockchain;
    private readonly node;
    private readonly MAX_ANCESTORS;
    private readonly MAX_DESCENDANTS;
    private readonly RBF_INCREMENT;
    readonly maxSize: number;
    private readonly maxTransactionAge;
    private readonly healthMonitor;
    private readonly auditManager;
    private readonly reputationSystem;
    private readonly lastVoteHeight;
    private readonly voteCounter;
    private readonly cache;
    private readonly AUDIT_DIR;
    private readonly reputationMutex;
    private readonly performanceMonitor;
    private readonly powCache;
    private readonly VALIDATOR_PENALTIES;
    private readonly consecutiveMisses;
    private activeValidators;
    private lastChangeTimestamp;
    private cleanupInterval;
    private readonly mempoolStateCache;
    private readonly transactionMutexes;
    private lastValidFee;
    private ddosProtection;
    size: number;
    bytes: number;
    usage: number;
    private readonly SCRIPT_OPCODES;
    constructor(blockchain: Blockchain);
    /**
     * Initializes the mempool and its dependencies.
     * Must be called after construction and before using the mempool.
     */
    initialize(): Promise<void>;
    private initializeVoteTracking;
    private validateVoteEligibility;
    private updateVoteTracking;
    addTransaction(transaction: Transaction): Promise<boolean>;
    private processTransaction;
    private handleVoteTransaction;
    /**
     * Retrieves a transaction by its ID
     * @param {string} txId - Transaction ID to lookup
     * @returns {Transaction | undefined} Transaction if found, undefined otherwise
     * @throws {Error} If there's an error accessing the mempool
     */
    getTransaction(txId: string): Transaction | undefined;
    /**
     * Checks if a transaction exists in the mempool
     * @param {string} txId - Transaction ID to check
     * @returns {boolean} True if transaction exists, false otherwise
     */
    hasTransaction(txId: string): boolean;
    /**
     * Gets the current size of the mempool
     * @returns {number} Number of transactions in mempool
     */
    getSize(): number;
    /**
     * Clears all transactions from the mempool
     * @throws {Error} If clearing the mempool fails
     */
    clear(): void;
    /**
     * Retrieves pending transactions based on criteria
     * @param {Object} options - Filter options
     * @param {number} [options.limit] - Maximum number of transactions to return
     * @param {number} [options.minFeeRate] - Minimum fee rate in sat/byte
     * @returns {Promise<Transaction[]>} Array of pending transactions
     */
    getPendingTransactions(options?: {
        limit?: number;
        minFeeRate?: number;
    }): Promise<Transaction[]>;
    /**
     * Estimates transaction fee based on mempool state
     * @param {number} targetBlocks - Target number of blocks for confirmation
     * @returns {number} Estimated fee rate in TAG satoshis/byte
     */
    estimateFee(targetBlocks: number): number;
    /**
     * Removes transactions that are included in a block
     * @param {Transaction[]} transactions - Array of transactions to remove
     */
    removeTransactions(transactions: Transaction[]): void;
    /**
     * Gets all UTXOs for a specific address from mempool transactions
     * @param {string} address - Address to get UTXOs for
     * @returns {UTXO[]} Array of unspent transaction outputs
     */
    getPendingUTXOsForAddress(address: string): UTXO[];
    private initializeFeeRateBuckets;
    private handleRBF;
    private findConflictingTransactions;
    private checkAncestryLimits;
    private getAncestors;
    private getDescendants;
    /**
     * Calculate fee per byte for transaction
     */
    private calculateFeePerByte;
    /**
     * Get transaction size in bytes
     */
    private getTransactionSize;
    /**
     * Get all transactions in mempool
     */
    getTransactions(): Transaction[];
    private updateAncestryMaps;
    private updateFeeBuckets;
    removeTransaction(txId: string): void;
    validateTransaction(transaction: Transaction, utxoSet: UTXOSet, currentHeight: number): Promise<boolean>;
    private validateBasicStructure;
    private validateUTXOs;
    private validateMempoolState;
    private calculateDynamicMinFee;
    private addToMempool;
    private removeOldTransactions;
    dispose(): Promise<void>;
    private getAccountAge;
    private getPowContribution;
    private loadReputationData;
    private calculateValidatorReputation;
    updateValidatorReputation(validatorAddress: string, reputationChange: number, reason: string): Promise<boolean>;
    handleValidatorAbsence(validatorAddress: string): Promise<void>;
    resetConsecutiveMisses(validatorAddress: string): void;
    /**
     * Select backup validator when primary fails
     */
    selectBackupValidator(validationTask: string, failedValidator: string): Promise<string | null>;
    /**
     * Get list of validators eligible to serve as backups
     */
    private getEligibleBackupValidators;
    /**
     * Rank backup validators based on multiple criteria
     */
    rankBackupValidators(validators: Validator[]): Promise<Array<Validator & {
        score: number;
    }>>;
    /**
     * Check if validator is currently overloaded
     */
    private isValidatorOverloaded;
    /**
     * Calculate recent performance score (0-100)
     */
    private getRecentPerformanceScore;
    /**
     * Calculate validator's current load factor (0-1)
     */
    private getValidatorLoadFactor;
    handleValidationFailure(validationTask: string, failedValidator: string): Promise<boolean>;
    getExpectedValidators(): Promise<Validator[]>;
    hasChanged(): Promise<boolean>;
    /**
     * Add an input to a pending transaction
     * @param txId Transaction ID to add input to
     * @param input Input to add
     * @returns Promise<boolean> True if input was added successfully
     */
    addTransactionInput(txId: string, input: {
        previousTxId: string;
        outputIndex: number;
        publicKey: string;
        amount: bigint;
    }): Promise<boolean>;
    /**
     * Add an output to a pending transaction
     * @param txId Transaction ID to add output to
     * @param output Output to add
     * @returns Promise<boolean> True if output was added successfully
     */
    addTransactionOutput(txId: string, output: {
        address: string;
        amount: bigint;
    }): Promise<boolean>;
    private cleanupCache;
    private initializeCleanupInterval;
    private calculateTransactionSize;
    private getVarIntSize;
    private getMutexForTransaction;
    private findFeeBucket;
    private getOrCreateFeeBucket;
    private cleanupOldFeeBuckets;
    private updateDynamicFees;
    private getVotingContribution;
    private validateTransactionInputs;
    private isUTXOSpentInMempool;
    private validateTransactionSize;
    private updateMetrics;
    private calculateUsage;
    /**
     * Get detailed information about the current state of the mempool
     * @returns {Promise<MempoolInfo>} Detailed mempool statistics and status
     */
    getMempoolInfo(): Promise<MempoolInfo>;
    private calculateFeeMetrics;
    private getTransactionTypeDistribution;
    private getPendingCount;
    private getOldestTransactionAge;
    private getYoungestTransactionAge;
    private getHealthStatus;
    private canAcceptTransactions;
    /**
     * Get detailed information about all transactions in the mempool
     * @param {boolean} verbose - If true, returns detailed information for each transaction
     * @returns {Promise<Record<string, RawMempoolEntry> | string[]>} Mempool transactions
     */
    getRawMempool(verbose?: boolean): Promise<Record<string, RawMempoolEntry> | string[]>;
    /**
     * Calculate total weight of a transaction
     */
    private calculateTransactionWeight;
    /**
     * Calculate total size of descendant transactions
     */
    private calculateDescendantSize;
    /**
     * Calculate total size of ancestor transactions
     */
    private calculateAncestorSize;
    /**
     * Get detailed information about a specific transaction in the mempool
     * @param {string} txid - Transaction ID to lookup
     * @returns {Promise<RawMempoolEntry>} Detailed transaction information
     * @throws {Error} If transaction is not found in mempool
     */
    getMempoolEntry(txid: string): Promise<RawMempoolEntry>;
    private isValidInputScript;
    private isValidScriptType;
}
export {};
