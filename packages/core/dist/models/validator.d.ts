import { MerkleProof } from "../utils/merkle";
/**
 * @fileoverview Validator model definitions for the H3Tag blockchain. Includes validator structure,
 * validation set management, and merkle proof verification for validator consensus participation.
 *
 * @module ValidatorModel
 */
/**
 * @interface Validator
 * @description Defines the structure of a network validator
 *
 * @property {string} id - Unique validator identifier
 * @property {string} publicKey - Validator's public key
 * @property {number} lastActive - Last activity timestamp
 * @property {number} [powHashRate] - Optional proof of work hash rate
 * @property {number} reputation - Validator reputation score
 * @property {MerkleProof} [merkleProof] - Optional merkle proof of validation
 * @property {string} [merkleRoot] - Optional merkle root
 * @property {string} [signature] - Optional validator signature
 * @property {string} address - Validator's blockchain address
 * @property {boolean} isActive - Current active status
 * @property {boolean} isSuspended - Suspension status
 * @property {boolean} isAbsent - Absence status
 * @property {number} uptime - Validator uptime percentage
 * @property {Object} metrics - Performance metrics
 * @property {number} metrics.uptime - Uptime percentage
 * @property {number} metrics.voteParticipation - Voting participation rate
 * @property {number} metrics.blockProduction - Block production rate
 * @property {string} validationData - Validation-specific data
 */
export interface Validator {
    id: string;
    publicKey: string;
    lastActive: number;
    powHashRate?: number;
    reputation: number;
    merkleProof?: MerkleProof;
    merkleRoot?: string;
    signature?: string;
    address: string;
    isActive: boolean;
    isSuspended: boolean;
    isAbsent: boolean;
    uptime: number;
    metrics: {
        uptime: number;
        voteParticipation: number;
        blockProduction: number;
    };
    validationData: string;
}
/**
 * @class ValidatorSet
 * @description Manages the set of active validators and their merkle proofs
 *
 * @property {MerkleTree} merkleTree - Merkle tree for validator set
 * @property {Map<string, Validator>} validators - Map of active validators
 * @property {number} CACHE_EXPIRY - Cache expiration time in milliseconds
 * @property {Map<string, Validator>} validatorCache - Cached validator data
 * @property {Map<string, number>} cacheTimestamps - Cache entry timestamps
 *
 * @example
 * const validatorSet = new ValidatorSet();
 * await validatorSet.addValidator(validator);
 * const isValid = await validatorSet.verifyValidator(validator, merkleRoot);
 */
export declare class ValidatorSet {
    private merkleTree;
    private validators;
    private readonly CACHE_EXPIRY;
    private validatorCache;
    private cacheTimestamps;
    /**
     * Creates a new ValidatorSet instance
     * Initializes merkle tree and sets up cache cleanup
     */
    constructor();
    /**
     * Adds a validator to the set
     * @param {Validator} validator - Validator to add
     * @throws {Error} If validator data is invalid
     */
    addValidator(validator: Validator): Promise<void>;
    /**
     * Verifies a validator's merkle proof
     * @param {Validator} validator - Validator to verify
     * @param {string} [merkleRoot] - Optional merkle root for verification
     * @returns {Promise<boolean>} True if validator is verified
     */
    verifyValidator(validator: Validator, merkleRoot?: string): Promise<boolean>;
    /**
     * Validates validator data structure
     * @param {Validator} validator - Validator to validate
     * @returns {boolean} True if validator data is valid
     * @private
     */
    private isValidValidator;
    /**
     * Serializes validator data for merkle tree
     * @param {Validator} validator - Validator to serialize
     * @returns {string} Serialized validator data
     * @private
     */
    private serializeValidator;
    /**
     * Cleans up validator set resources
     */
    cleanup(): Promise<void>;
    /**
     * Cleans up expired cache entries
     * @private
     */
    private cleanExpiredCache;
    /**
     * Updates an existing validator's information
     * @param {Validator} validator - Updated validator data
     * @throws {Error} If validator not found or invalid reputation change
     */ updateValidator(validator: Validator): Promise<void>;
}
