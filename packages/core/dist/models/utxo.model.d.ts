import { Block } from "./block.model";
import { Transaction } from "./transaction.model";
/**
 * @fileoverview UTXO (Unspent Transaction Output) model definitions for the H3Tag blockchain.
 * Includes UTXO structure, set management, and validation logic for transaction inputs/outputs.
 *
 * @module UTXOModel
 */
/**
 * @class UTXOError
 * @extends Error
 * @description Custom error class for UTXO-related errors
 *
 * @example
 * throw new UTXOError("Invalid UTXO structure");
 */
export declare class UTXOError extends Error {
    constructor(message: string);
}
/**
 * @interface UTXO
 * @description Represents an unspent transaction output in the blockchain
 *
 * @property {string} txId - Transaction ID containing this UTXO
 * @property {number} outputIndex - Index of this output in the transaction
 * @property {string} address - Address owning this UTXO
 * @property {bigint} amount - Amount of currency in this UTXO
 * @property {string} script - Locking script
 * @property {string} publicKey - Public key associated with the address
 * @property {string} [signature] - Optional signature for the UTXO
 * @property {number} blockHeight - Block height where this UTXO was created
 * @property {number} timestamp - Creation timestamp
 * @property {number} confirmations - Number of confirmations
 * @property {boolean} spent - Whether this UTXO has been spent
 * @property {Object} currency - Currency information
 */
export interface UTXO {
    /** Unique identifier of the transaction this UTXO belongs to */
    txId: string;
    /** Index of this output in the transaction's output array */
    outputIndex: number;
    /** Amount of TAG stored in this UTXO (in smallest unit) */
    amount: bigint;
    /** Address of the UTXO owner */
    address: string;
    /** Locking script that must be satisfied to spend this UTXO */
    script: string;
    /** Unix timestamp when this UTXO was created */
    timestamp: number;
    /** Optional hybrid cryptographic signature */
    signature?: string;
    /** Whether this UTXO has been spent */
    spent: boolean;
    /** Currency type - always TAG for H3Tag blockchain */
    currency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    /** Block height where this UTXO was created */
    blockHeight?: number;
    /** Merkle root of the UTXO */
    merkleRoot?: string;
    /** Public key associated with the UTXO */
    publicKey: string;
    confirmations: number;
}
/**
 * @interface ListUnspentOptions
 * @description Options for listing unspent transaction outputs (UTXOs)
 *
 * @property {number} [minConfirmations] - Minimum number of confirmations required
 * @property {number} [maxConfirmations] - Maximum number of confirmations to include
 * @property {string[]} [addresses] - List of addresses to filter UTXOs by
 * @property {bigint} [minAmount] - Minimum amount in smallest currency unit
 * @property {bigint} [maxAmount] - Maximum amount in smallest currency unit
 * @property {boolean} [includeUnsafe] - Whether to include UTXOs that might be unsafe
 * @property {Object} [queryOptions] - Pagination options
 * @property {number} [queryOptions.limit] - Maximum number of UTXOs to return
 * @property {number} [queryOptions.offset] - Number of UTXOs to skip
 *
 * @example
 * const options: ListUnspentOptions = {
 *   minConfirmations: 6,
 *   addresses: ["addr1", "addr2"],
 *   minAmount: BigInt(1000),
 *   queryOptions: { limit: 10 }
 * };
 */
export interface ListUnspentOptions {
    minConfirmations?: number;
    maxConfirmations?: number;
    addresses?: string[];
    minAmount?: bigint;
    maxAmount?: bigint;
    includeUnsafe?: boolean;
    queryOptions?: {
        limit?: number;
        offset?: number;
    };
}
/**
 * @interface TxOutInfo
 * @description Detailed information about a transaction output
 *
 * @property {string} bestblock - Hash of the best block
 * @property {number} confirmations - Number of confirmations
 * @property {bigint} amount - Output amount
 * @property {Object} scriptPubKey - Output script information
 * @property {string} scriptPubKey.asm - Script assembly
 * @property {string} scriptPubKey.hex - Script hex
 * @property {string} scriptPubKey.type - Script type
 * @property {string} scriptPubKey.address - Associated address
 * @property {boolean} coinbase - Whether this is a coinbase output
 * @property {number} timestamp - Creation timestamp
 */
export interface TxOutInfo {
    bestblock: string;
    confirmations: number;
    amount: bigint;
    scriptPubKey: {
        asm: string;
        hex: string;
        type: string;
        address: string;
    };
    coinbase: boolean;
    timestamp?: number;
}
/**
 * @interface UTXOSet
 * @description Manages a set of UTXOs with query and update capabilities
 *
 * @property {Map<string, UTXO>} cache - In-memory cache of UTXOs
 * @property {Map<string, number>} cacheTimestamps - Timestamps for cache entries
 * @property {number} CACHE_EXPIRY - Cache expiration time in milliseconds
 *
 * @method get - Retrieves a UTXO by txId and outputIndex
 * @method add - Adds a new UTXO to the set
 * @method remove - Removes a UTXO from the set
 * @method getBalance - Gets total balance for an address
 * @method getUTXOs - Gets all UTXOs for an address
 */
export declare class UTXOSet {
    private readonly eventEmitter;
    private static readonly CACHE_DURATION;
    private static readonly MAX_UTXOS;
    private utxos;
    private readonly merkleTree;
    private height;
    private heightCache;
    private lastOperationTimestamp;
    private readonly MIN_OPERATION_INTERVAL;
    private addressIndex;
    private verificationCache;
    private static readonly BATCH_SIZE;
    private static readonly VERIFICATION_TIMEOUT;
    private readonly mutex;
    private merkleRoot;
    private readonly db;
    private cache;
    private blockchainSchema;
    private readonly CACHE_EXPIRY;
    private cacheTimestamps;
    private readonly VERIFICATION_CACHE_MAX_SIZE;
    constructor();
    private createUtxoMerkleRoot;
    /**
     * Add a UTXO to the set
     */
    add(utxo: UTXO): Promise<void>;
    private signUtxo;
    /**
     * Find UTXOs for a specific amount
     */
    findUtxosForAmount(address: string, targetAmount: bigint): Promise<UTXO[]>;
    /**
     * Verify a UTXO's integrity
     */
    verifyUtxo(utxo: UTXO): Promise<boolean>;
    /**
     * Remove a UTXO from the set
     */
    remove(utxo: UTXO): boolean;
    /**
     * Get all UTXOs for a specific address
     */
    getByAddress(address: string): UTXO[];
    /**
     * Get total balance for an address
     */
    getBalance(address: string): bigint;
    /**
     * Get a specific UTXO by its ID and index
     */
    getUtxo(txId: string, outputIndex: number): UTXO | undefined;
    /**
     * Check if a UTXO exists
     */
    exists(txId: string, outputIndex: number): boolean;
    /**
     * Get all UTXOs in the set
     */
    getAllUtxos(): UTXO[];
    /**
     * Clear all UTXOs
     */
    clear(): void;
    /**
     * Get the size of the UTXO set
     */
    size(): number;
    /**
     * Generate a unique key for a UTXO
     */
    private getUtxoKey;
    /**
     * Generate a unique key from txId and outputIndex
     */
    private generateKey;
    getUTXOsForAddress(address: string): UTXO[];
    /**
     * Validate a UTXO's structure and data types
     */
    static validateUtxo(utxo: UTXO): boolean;
    /**
     * Get current UTXO set height
     */
    getHeight(): number;
    verifyBalance(address: string, amount: bigint): Promise<boolean>;
    applyBlock(block: Block): Promise<void>;
    /**
     * Add a new UTXO to the set with validation and error handling
     */
    private addUTXO;
    /**
     * Generate appropriate locking script based on address type
     */
    private generateLockingScript;
    /**
     * Detect address type from address string
     */
    private detectAddressType;
    private removeUTXO;
    get(txId: string, outputIndex: number): Promise<UTXO | null>;
    set(txId: string, outputIndex: number, utxo: UTXO): Promise<void>;
    /**
     * Get total value of all unspent outputs
     */
    getTotalValue(): bigint;
    validate(): boolean;
    private checkRateLimit;
    private enforceSetLimits;
    addBatch(utxos: UTXO[]): Promise<void>;
    private indexByAddress;
    verifySignatures(utxo: UTXO): Promise<boolean>;
    verifyBatch(utxos: UTXO[]): Promise<boolean[]>;
    private verifyWithTimeout;
    private removeFromIndex;
    revertTransaction(tx: Transaction): Promise<void>;
    spendUTXO(txId: string, outputIndex: number): Promise<boolean>;
    applyTransaction(tx: Transaction): Promise<boolean>;
    private calculateInputAmount;
    private updateMerkleTree;
    private cleanupCache;
    private rollbackTransaction;
    findUtxosForVoting(address: string): Promise<UTXO[]>;
    calculateVotingPower(utxos: UTXO[]): bigint;
    private bigIntSqrt;
    /**
     * List unspent transaction outputs with filtering options
     * @param options Filtering options for listing UTXOs
     * @returns Promise<UTXO[]> Array of matching UTXOs
     */
    listUnspent(options?: ListUnspentOptions): Promise<UTXO[]>;
    /**
     * Check if a UTXO is considered safe to spend
     * @param utxo UTXO to check
     * @returns boolean indicating if UTXO is safe
     */
    private isUtxoSafe;
    /**
     * Check if a script is considered standard
     * @param script Script to check
     * @returns boolean indicating if script is standard
     */
    private isStandardScript;
    /**
     * Get detailed information about an unspent transaction output
     * @param txId Transaction ID
     * @param n Output index
     * @param includeMempool Whether to include mempool transactions
     * @returns Detailed UTXO information or null if not found/spent
     */
    getTxOut(txId: string, n: number, includeMempool?: boolean): Promise<TxOutInfo | null>;
    /**
     * Parse a script into its components
     * @param script Script string to parse
     * @returns Parsed script information
     */
    private parseScript;
    private determineScriptType;
    /**
     * Check if a transaction is a coinbase transaction
     * A coinbase transaction must:
     * 1. Be the first transaction in a block
     * 2. Have exactly one input
     * 3. Have input txid of all zeros
     * 4. Have input vout index of 0xFFFFFFFF (-1)
     *
     * @param txId Transaction ID to check
     * @returns boolean indicating if transaction is coinbase
     */
    private isCoinbaseTransaction;
    /**
     * Validate coinbase maturity
     * Coinbase transactions must have at least COINBASE_MATURITY (100) confirmations
     * before they can be spent
     *
     * @param txId Transaction ID to check
     * @returns boolean indicating if coinbase is mature
     */
    private isCoinbaseMature;
    private cleanExpiredCache;
}
