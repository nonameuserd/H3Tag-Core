import { Block } from "./block.model";
import { Transaction } from "./transaction.model";
export declare class UTXOError extends Error {
    constructor(message: string);
}
/**
 * Represents an Unspent Transaction Output (UTXO)
 * @interface UTXO
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
    constructor();
    private createUtxoMerkleRoot;
    add(utxo: UTXO): Promise<void>;
    private signUtxo;
    findUtxosForAmount(address: string, targetAmount: bigint): Promise<UTXO[]>;
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
    private updateMerkleTree;
    private cleanupCache;
    private rollbackTransaction;
    findUtxosForVoting(address: string): Promise<UTXO[]>;
    calculateVotingPower(utxos: UTXO[]): bigint;
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
}
