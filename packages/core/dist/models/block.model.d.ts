/**
 * @fileoverview Block model definitions for the H3Tag blockchain. Includes block structure,
 * header format, and builder pattern implementation for block creation and validation.
 *
 * @module BlockModel
 */
import { Transaction } from "./transaction.model";
import { Vote } from "./vote.model";
import { Validator } from "./validator";
import { AuditManager } from "../security/audit";
import { HybridKeyPair } from "@h3tag-blockchain/crypto";
/**
 * @class BlockError
 * @extends Error
 * @description Custom error class for block-related errors
 *
 * @example
 * throw new BlockError("Invalid block structure");
 */
export declare class BlockError extends Error {
    constructor(message: string);
}
/**
 * @interface BlockHeader
 * @description Defines the structure of a block header in the blockchain
 *
 * @property {number} version - Block version number
 * @property {number} height - Block height in the chain
 * @property {string} previousHash - Hash of the previous block
 * @property {number} timestamp - Block creation timestamp
 * @property {string} merkleRoot - Merkle root of transactions
 * @property {number} difficulty - Mining difficulty target
 * @property {number} nonce - Proof of work nonce
 * @property {string} miner - Miner identifier
 * @property {string} validatorMerkleRoot - Merkle root of validators
 * @property {number} totalTAG - Total TAG in circulation
 * @property {number} blockReward - Mining reward for this block
 * @property {number} fees - Total transaction fees
 * @property {string} target - Mining target difficulty
 * @property {string[]} locator - Locator for the block
 * @property {string} hashStop - Hash stop for the block
 * @property {Object} consensusData - Consensus-related metrics
 * @property {number} consensusData.powScore - Proof of work score
 * @property {number} consensusData.votingScore - Voting score
 * @property {number} consensusData.participationRate - Network participation rate
 * @property {number} consensusData.periodId - Consensus period identifier
 * @property {string} [signature] - Block signature
 * @property {string} publicKey - Miner's public key
 * @property {string} hash - Block hash
 * @property {string} minerAddress - Miner's address
 */
export interface BlockHeader {
    version: number;
    height: number;
    previousHash: string;
    timestamp: number;
    merkleRoot: string;
    difficulty: number;
    nonce: number;
    miner: string;
    validatorMerkleRoot: string;
    totalTAG: number;
    blockReward: number;
    fees: number;
    target: string;
    locator: string[];
    hashStop: string;
    consensusData: {
        powScore: number;
        votingScore: number;
        participationRate: number;
        periodId: number;
    };
    signature?: string;
    publicKey: string;
    hash: string;
    minerAddress: string;
}
/**
 * @interface Block
 * @description Represents a complete block in the blockchain
 *
 * @property {string} hash - Block hash identifier
 * @property {BlockHeader} header - Block header information
 * @property {Transaction[]} transactions - List of transactions in the block
 * @property {Object} [metadata] - Additional block metadata
 * @property {number} metadata.receivedTimestamp - Block reception timestamp
 * @property {Object} [metadata.consensusMetrics] - Consensus-related metrics
 * @property {Vote[]} votes - List of validator votes
 * @property {Validator[]} validators - List of block validators
 * @property {number} timestamp - Block timestamp
 *
 * @method verifyHash - Verifies block hash integrity
 * @method verifySignature - Verifies block signature
 * @method getHeaderBase - Gets base header string for hashing
 * @method isComplete - Checks if block has all required components
 */
export interface Block {
    hash: string;
    header: BlockHeader;
    transactions: Transaction[];
    metadata?: {
        receivedTimestamp: number;
        consensusMetrics?: {
            powWeight: number;
            votingWeight: number;
            participationRate: number;
        };
    };
    votes: Vote[];
    validators: Validator[];
    timestamp: number;
    verifyHash(): Promise<boolean>;
    verifySignature(): Promise<boolean>;
    getHeaderBase(): string;
    isComplete(): boolean;
}
/**
 * @class BlockBuilder
 * @description Builder pattern implementation for creating new blocks
 *
 * @property {number} CURRENT_VERSION - Current block version
 * @property {number} MAX_TRANSACTIONS - Maximum transactions per block
 * @property {number} MIN_DIFFICULTY - Minimum mining difficulty
 * @property {number} maxTransactionAge - Maximum age of transactions
 *
 * @example
 * const builder = new BlockBuilder(previousHash, difficulty, auditManager);
 * await builder.setTransactions(transactions);
 * const block = await builder.build(minerKeyPair);
 */
export declare class BlockBuilder {
    private static readonly CURRENT_VERSION;
    private static readonly MAX_TRANSACTIONS;
    private static readonly MIN_DIFFICULTY;
    private readonly maxTransactionAge;
    header: Block["header"];
    private transactions;
    private votes;
    private validators;
    private readonly merkleTree;
    private readonly mutex;
    private readonly auditManager;
    private hash;
    /**
     * Creates a new BlockBuilder instance
     * @param {string} previousHash - Hash of the previous block
     * @param {number} difficulty - Mining difficulty target
     * @param {AuditManager} auditManager - Audit logging manager
     * @throws {BlockError} If difficulty is invalid
     */
    constructor(previousHash: string, difficulty: number, auditManager: AuditManager);
    private calculateMerkleRoot;
    /**
     * Sets transactions for the block
     * @param {Transaction[]} transactions - Array of transactions to include
     * @returns {Promise<this>} Builder instance for chaining
     * @throws {BlockError} If transactions are invalid or exceed limits
     */
    setTransactions(transactions: Transaction[]): Promise<this>;
    /**
     * Calculates the block hash
     * @returns {Promise<string>} Block hash
     * @throws {BlockError} If block header is invalid
     */
    calculateHash(): Promise<string>;
    /**
     * Builds the final block
     * @param {HybridKeyPair} minerKeyPair - Miner's key pair for signing
     * @returns {Promise<Block>} Completed block
     * @throws {BlockError} If block building fails
     */
    build(minerKeyPair: HybridKeyPair): Promise<Block>;
    private validateBlockStructure;
    /**
     * Sets the block height
     * @param {number} height - Block height
     * @returns {this} Builder instance for chaining
     * @throws {BlockError} If height is invalid
     */
    setHeight(height: number): this;
    /**
     * Sets the previous block hash
     * @param {string} hash - Previous block hash
     * @returns {this} Builder instance for chaining
     */
    setPreviousHash(hash: string): this;
    /**
     * Sets the block timestamp
     * @param {number} timestamp - Block timestamp
     * @returns {this} Builder instance for chaining
     * @throws {BlockError} If timestamp is invalid
     */
    setTimestamp(timestamp: number): this;
    /**
     * Verifies the block hash
     * @returns {Promise<boolean>} True if hash is valid
     * @throws {BlockError} If hash verification fails
     */
    verifyHash(): Promise<boolean>;
    /**
     * Verifies the block signature
     * @returns {Promise<boolean>} True if signature is valid
     * @throws {BlockError} If signature verification fails
     */
    verifySignature(): Promise<boolean>;
    /**
     * Gets the base header string for hashing
     * @returns {string} Base header string
     */
    getHeaderBase(): string;
    /**
     * Sets the block version
     * @param {number} version - Block version
     * @returns {this} Builder instance for chaining
     */
    setVersion(version: number): this;
    /**
     * Sets the merkle root
     * @param {string} merkleRoot - Merkle root
     * @returns {this} Builder instance for chaining
     */
    setMerkleRoot(merkleRoot: string): this;
    /**
     * Sets the difficulty
     * @param {number} difficulty - Difficulty
     * @returns {this} Builder instance for chaining
     */
    setDifficulty(difficulty: number): this;
    /**
     * Sets the nonce
     * @param {number} nonce - Nonce
     * @returns {this} Builder instance for chaining
     */
    setNonce(nonce: number): this;
    /**
     * Checks if the block is complete
     * @returns {boolean} True if block is complete
     */
    isComplete(): boolean;
    /**
     * Sets the block hash
     * @param {string} hash - Block hash
     * @returns {this} Builder instance for chaining
     */
    setHash(hash: string): this;
}
