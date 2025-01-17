import { UTXO } from "./utxo.model";
export declare class TransactionError extends Error {
    constructor(message: string);
}
export declare enum TransactionType {
    QUADRATIC_VOTE = "quadratic_vote",
    POW_REWARD = "pow",
    STANDARD = "standard",
    TRANSFER = "transfer",
    COINBASE = "coinbase",
    REGULAR = "regular"
}
export declare enum TransactionStatus {
    PENDING = "pending",
    CONFIRMED = "confirmed",
    FAILED = "failed"
}
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
export interface TxOutput {
    address: string;
    amount: bigint;
    script: string;
    publicKey?: string;
    currency: {
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
}
export interface Transaction {
    id: string;
    version: number;
    type: TransactionType;
    hash: string;
    status: TransactionStatus;
    inputs: TxInput[];
    outputs: TxOutput[];
    timestamp: number;
    fee: bigint;
    lockTime?: number;
    signature: {
        address: string;
    };
    powData?: {
        nonce: string;
        difficulty: number;
        timestamp: number;
    };
    sender: string;
    recipient: string;
    memo?: string;
    currency: {
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
export declare class TransactionBuilder {
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
    private readonly mempool;
    constructor();
    addInput(txId: string, // Previous transaction ID
    outputIndex: number, // Index of output in previous transaction
    publicKey: string, // Sender's public key
    amount: bigint): Promise<this>;
    private generateInputScript;
    addOutput(address: string, // Recipient's address
    amount: bigint): Promise<this>;
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
    static validateTransaction(tx: Transaction, utxos: UTXO[]): boolean;
    static calculateTransactionSize(tx: Transaction): number;
    verify(): Promise<boolean>;
    setSignature(signature: {
        address: string;
    }): this;
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
}
/**
 * Estimates the fee for a transaction based on its size and current network conditions
 * @param {number} targetBlocks - Number of blocks within which the transaction should be included
 * @returns {Promise<bigint>} Estimated fee in smallest currency unit
 */
export declare function estimateFee(targetBlocks?: number): Promise<bigint>;
