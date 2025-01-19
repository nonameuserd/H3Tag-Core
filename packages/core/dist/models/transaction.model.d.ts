import { UTXO } from "./utxo.model";
import { Mempool } from "../blockchain/mempool";
/**
 * @interface Transaction
 * @description Complete transaction structure
 *
 * @property {string} id - Transaction identifier
 * @property {number} version - Transaction version
 * @property {TransactionType} type - Transaction type
 * @property {string} hash - Transaction hash
 * @property {TransactionStatus} status - Transaction status
 * @property {TxInput[]} inputs - Transaction inputs
 * @property {TxOutput[]} outputs - Transaction outputs
 * @property {number} timestamp - Transaction timestamp
 * @property {bigint} fee - Transaction fee
 * @property {number} [lockTime] - Optional lock time
 * @property {string} signature - Transaction signature
 * @property {Object} [powData] - Optional mining data
 * @property {string} sender - Sender's address
 * @property {string} recipient - Recipient's address
 * @property {string} [memo] - Optional transaction memo
 * @property {Object} currency - Currency information
 * @property {number} [blockHeight] - Block height containing transaction
 * @property {number} [nonce] - Transaction nonce
 * @property {Object} [voteData] - Optional voting data
 * @property {boolean} [hasWitness] - Segregated witness flag
 * @property {Object} [witness] - Witness data
 *
 * @method verify - Verifies transaction integrity
 * @method toHex - Converts transaction to hex string
 * @method getSize - Gets transaction size in bytes
 */
export declare class TransactionError extends Error {
    constructor(message: string);
}
/**
 * @enum TransactionType
 * @description Types of transactions supported by the blockchain
 *
 * @property {string} QUADRATIC_VOTE - Quadratic voting transaction
 * @property {string} POW_REWARD - Mining reward transaction
 * @property {string} STANDARD - Standard value transfer
 * @property {string} TRANSFER - Token transfer transaction
 * @property {string} COINBASE - Block reward transaction
 * @property {string} REGULAR - Regular transaction
 */
export declare enum TransactionType {
    QUADRATIC_VOTE = "quadratic_vote",// quadratic voting
    POW_REWARD = "pow",// For PoW mining rewards
    STANDARD = "standard",// Standard transaction
    TRANSFER = "transfer",// Transfer transaction
    COINBASE = "coinbase",// Coinbase transaction
    REGULAR = "regular"
}
/**
 * @enum TransactionStatus
 * @description Status states for transactions
 *
 * @property {string} PENDING - Transaction awaiting confirmation
 * @property {string} CONFIRMED - Transaction confirmed in blockchain
 * @property {string} FAILED - Transaction failed to process
 */
export declare enum TransactionStatus {
    PENDING = "pending",
    CONFIRMED = "confirmed",
    FAILED = "failed"
}
/**
 * @interface TxInput
 * @description Transaction input structure
 *
 * @property {string} txId - Previous transaction ID
 * @property {number} outputIndex - Index of previous output
 * @property {string} signature - Input signature
 * @property {string} publicKey - Sender's public key
 * @property {string} address - Sender's address
 * @property {bigint} amount - Input amount
 * @property {Object} currency - Currency information
 * @property {string} currency.symbol - Currency symbol
 * @property {number} currency.decimals - Decimal places
 * @property {Object} [votingData] - Optional voting information
 * @property {number} confirmations - Number of confirmations
 * @property {string} script - Input script
 * @property {number} sequence - Input sequence number
 */
export interface TxInput {
    txId: string;
    outputIndex: number;
    signature: string;
    publicKey: string;
    address: string;
    amount: bigint;
    currency: {
        symbol: string;
        decimals: number;
    };
    votingData?: {
        powContribution: number;
        personhoodProof: string;
        timestamp: number;
    };
    confirmations: number;
    script: string;
    sequence: number;
}
/**
 * @interface TxOutput
 * @description Transaction output structure
 *
 * @property {string} address - Recipient's address
 * @property {bigint} amount - Output amount
 * @property {string} script - Output script
 * @property {string} [publicKey] - Optional recipient's public key
 * @property {Object} currency - Currency information
 * @property {number} index - Output index in transaction
 * @property {Object} [votingData] - Optional voting information
 */
export interface TxOutput {
    address: string;
    amount: bigint;
    script: string;
    publicKey?: string;
    currency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    index: number;
    votingData?: {
        proposal: string;
        choice: boolean;
        quadraticPower: bigint;
        timestamp: number;
    };
    confirmations: number;
}
/**
 * @interface Transaction
 * @description Complete transaction structure
 *
 * @property {string} id - Transaction identifier
 * @property {number} version - Transaction version
 * @property {TransactionType} type - Transaction type
 * @property {string} hash - Transaction hash
 * @property {TransactionStatus} status - Transaction status
 * @property {TxInput[]} inputs - Transaction inputs
 * @property {TxOutput[]} outputs - Transaction outputs
 * @property {number} timestamp - Transaction timestamp
 * @property {bigint} fee - Transaction fee
 * @property {number} [lockTime] - Optional lock time
 * @property {string} signature - Transaction signature
 * @property {Object} [powData] - Optional mining data
 * @property {string} sender - Sender's address
 * @property {string} recipient - Recipient's address
 * @property {string} [memo] - Optional transaction memo
 * @property {Object} currency - Currency information
 * @property {number} [blockHeight] - Block height containing transaction
 * @property {number} [nonce] - Transaction nonce
 * @property {Object} [voteData] - Optional voting data
 * @property {boolean} [hasWitness] - Segregated witness flag
 * @property {Object} [witness] - Witness data
 * @property {Object} transaction - Transaction data
 *
 * @method verify - Verifies transaction integrity
 * @method toHex - Converts transaction to hex string
 * @method getSize - Gets transaction size in bytes
 */
export interface Transaction {
    id: string;
    version: number;
    type: TransactionType;
    hash: string;
    status: TransactionStatus;
    inputs: TxInput[];
    outputs: TxOutput[];
    transaction: {
        hash: string;
        timestamp: number;
        fee: bigint;
        lockTime?: number;
        signature: string;
    };
    timestamp: number;
    fee: bigint;
    lockTime?: number;
    signature: string;
    powData?: {
        nonce: string;
        difficulty: number;
        timestamp: number;
    };
    sender: string;
    recipient: string;
    memo?: string;
    currency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    blockHeight?: number;
    nonce?: number;
    voteData?: {
        proposal: string;
        vote: boolean;
        weight: number;
    };
    hasWitness?: boolean;
    witness?: {
        stack: string[];
    };
    verify(): Promise<boolean>;
    toHex(): string;
    getSize(): number;
}
/**
 * @class TransactionBuilder
 * @description Builder pattern implementation for creating new transactions
 *
 * @property {number} MAX_INPUTS - Maximum number of inputs allowed
 * @property {number} MAX_OUTPUTS - Maximum number of outputs allowed
 *
 * @example
 * const builder = new TransactionBuilder();
 * await builder.addInput(txId, outputIndex, publicKey, amount);
 * await builder.addOutput(address, amount);
 * const transaction = await builder.build();
 */
export declare class TransactionBuilder {
    static mempool: Mempool;
    type: TransactionType;
    private timestamp;
    private fee;
    private static readonly MAX_INPUTS;
    private static readonly MAX_OUTPUTS;
    private inputs;
    private outputs;
    private readonly merkleTree;
    private readonly db;
    private static readonly blockchain;
    private static readonly pow;
    private static readonly hybridDirect;
    private readonly mutex;
    private signature;
    private sender;
    private emitter;
    constructor();
    static setMempool(mempoolInstance: Mempool): void;
    /**
     * Adds an input to the transaction
     * @param {string} txId - Previous transaction ID
     * @param {number} outputIndex - Index of output in previous transaction
     * @param {string} publicKey - Sender's public key
     * @param {bigint} amount - Amount to spend
     * @returns {Promise<this>} Builder instance for chaining
     * @throws {TransactionError} If input parameters are invalid
     */
    addInput(txId: string, // Previous transaction ID
    outputIndex: number, // Index of output in previous transaction
    publicKey: string, // Sender's public key
    amount: bigint): Promise<this>;
    private generateInputScript;
    /**
     * Adds an output to the transaction
     * @param {string} address - Recipient's address
     * @param {bigint} amount - Amount to send
     * @param {number} confirmations - Confirmations
     * @returns {Promise<this>} Builder instance for chaining
     * @throws {TransactionError} If output parameters are invalid
     */
    addOutput(address: string, // Recipient's address
    amount: bigint, // Amount to send
    confirmations: number): Promise<this>;
    private generateOutputScript;
    /**
     * Build the transaction
     * @returns Promise<Transaction> The built transaction
     * @throws TransactionError If the transaction cannot be built
     */
    build(): Promise<Transaction>;
    private calculateTransactionHash;
    private deriveSenderAddress;
    private isValidAddress;
    private validateAddressChecksum;
    private validateNetworkPrefix;
    private hashAddress;
    /**
     * Verify transaction
     * @param tx Transaction to verify
     * @returns Promise<boolean> True if the transaction is valid, false otherwise
     * it's been used in block.validator.ts
     */
    static verify(tx: Transaction): Promise<boolean>;
    /**
     * Safely parses a JSON string
     * @param {string} str - JSON string to parse
     * @returns {any} Parsed object
     * @throws {TransactionError} If parsing fails
     */
    static safeJsonParse(str: string): any;
    /**
     * Calculate total input amount with overflow protection
     * @param utxos The UTXOs to calculate the input amount from
     * @returns The total input amount
     * @throws TransactionError If the input amount calculation fails
     */
    static calculateInputAmount(utxos: UTXO[]): bigint;
    /**
     * Calculate total output amount with overflow protection
     */
    static calculateOutputAmount(outputs: TxOutput[]): bigint;
    /**
     * Validate transaction structure and amounts
     */
    static validateTransaction(tx: Transaction, utxos: UTXO[]): Promise<boolean>;
    /**
     * Calculate transaction size
     * @param tx Transaction to calculate size for
     * @returns Size of the transaction in bytes
     * @throws TransactionError If size calculation fails
     */
    static calculateTransactionSize(tx: Transaction): number;
    verify(): Promise<boolean>;
    setSignature(signature: string): this;
    setSender(sender: string): this;
    setFee(fee: bigint): this;
    /**
     * Get detailed transaction information
     * @param txId Transaction ID to fetch
     * @returns Promise<Transaction | null> Transaction details or null if not found
     * @throws TransactionError If there's an error fetching the transaction
     */
    getTransaction(txId: string): Promise<Transaction | null>;
    /**
     * Broadcast a raw transaction to the network
     * @param rawTx Serialized transaction data
     * @returns Promise<string> Transaction ID if successful
     * @throws TransactionError if validation or broadcast fails
     */
    sendRawTransaction(rawTx: string): Promise<string>;
    private deserializeTransaction;
    /**
     * Get raw transaction data
     * @param txId Transaction ID to fetch
     * @returns Promise<string> Raw transaction data in serialized format
     * @throws TransactionError If there's an error fetching or serializing the transaction
     */
    getRawTransaction(txId: string): Promise<string>;
    /**
     * Decode a raw transaction hex string
     * @param rawTx Raw transaction hex string
     * @returns Promise<Transaction> Decoded transaction
     * @throws TransactionError If decoding fails
     */
    static decodeRawTransaction(rawTx: string): Promise<Transaction>;
    getSize(): number;
    /**
     * Sign a message using hybrid cryptography (classical + quantum-resistant)
     * @param {string} message - Message to sign
     * @param {string} privateKey - Classical private key in hex format (64 characters)
     * @returns {Promise<string>} Combined signature hash that includes:
     *   - Classical ECC signature (secp256k1)
     *   - Dilithium quantum-resistant signature
     *   - Kyber key encapsulation
     * @throws {TransactionError} If signing fails or input validation fails
     */
    static signMessage(message: string, privateKey: string): Promise<string>;
    /**
     * Verify a message signature using hybrid cryptography
     * @param {string} message - Original message that was signed
     * @param {string} signature - Hybrid signature hash to verify
     * @param {string} publicKey - Public key in hex format
     * @returns {Promise<boolean>} True if signature is valid
     * @throws {TransactionError} If verification fails due to invalid input
     */
    static verifyMessage(message: string, signature: string, publicKey: string): Promise<boolean>;
    /**
     * Validates a blockchain address format and checksum
     * @param {string} address - The address to validate
     * @returns {boolean} True if the address is valid
     */
    static validateAddress(address: string): boolean;
    private static getNetworkType;
    cleanup(): void;
    private validateCurrency;
    /**
     * Calculate minimum required fee based on current network conditions
     * @param txSize Transaction size in bytes
     * @returns Promise<bigint> Minimum required fee
     */
    private getDynamicMinFee;
    /**
     * Calculate maximum allowed fee based on current network conditions
     * @param txSize Transaction size in bytes
     * @returns Promise<bigint> Maximum allowed fee
     */
    private getDynamicMaxFee;
}
/**
 * Estimates the fee for a transaction based on its size and current network conditions
 * @param {number} targetBlocks - Number of blocks within which the transaction should be included
 * @returns {Promise<bigint>} Estimated fee in smallest currency unit
 */
export declare function estimateFee(targetBlocks?: number): Promise<bigint>;
