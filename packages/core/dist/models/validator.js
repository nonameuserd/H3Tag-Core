"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidatorSet = void 0;
const crypto_1 = require("@h3tag-blockchain/crypto");
const merkle_1 = require("../utils/merkle");
const shared_1 = require("@h3tag-blockchain/shared");
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
class ValidatorSet {
    /**
     * Creates a new ValidatorSet instance
     * Initializes merkle tree and sets up cache cleanup
     */
    constructor() {
        this.CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
        this.validatorCache = new Map();
        this.cacheTimestamps = new Map();
        this.merkleTree = new merkle_1.MerkleTree();
        this.validators = new Map();
        // Set up periodic cache cleanup
        setInterval(() => this.cleanExpiredCache(), this.CACHE_EXPIRY);
    }
    /**
     * Adds a validator to the set
     * @param {Validator} validator - Validator to add
     * @throws {Error} If validator data is invalid
     */
    async addValidator(validator) {
        if (!this.isValidValidator(validator)) {
            throw new Error("Invalid validator data");
        }
        try {
            const validatorData = this.serializeValidator(validator);
            const validators = Array.from(this.validators.values()).map((v) => this.serializeValidator(v));
            validators.push(validatorData);
            // Calculate and store merkle root
            const merkleRoot = await this.merkleTree.createRoot(validators);
            const proof = await this.merkleTree.generateProof(validators.length - 1);
            // Add timestamp check for last active
            if (validator.lastActive < Date.now() - 24 * 60 * 60 * 1000) {
                validator.isActive = false;
                validator.isAbsent = true;
            }
            // Store validator with merkle root and proof
            this.validators.set(validator.id, {
                ...validator,
                merkleProof: proof,
                merkleRoot: merkleRoot, // Add merkle root to validator data
            });
            // Update cache
            this.validatorCache.set(validator.id, validator);
            this.cacheTimestamps.set(validator.id, Date.now());
        }
        catch (error) {
            shared_1.Logger.error("Failed to add validator:", error);
            throw error;
        }
    }
    /**
     * Verifies a validator's merkle proof
     * @param {Validator} validator - Validator to verify
     * @param {string} [merkleRoot] - Optional merkle root for verification
     * @returns {Promise<boolean>} True if validator is verified
     */
    async verifyValidator(validator, merkleRoot) {
        if (!validator?.merkleProof || !merkleRoot)
            return false;
        try {
            const validatorData = this.serializeValidator(validator);
            const isValid = await this.merkleTree.verifyProof(validator.merkleProof, validatorData, merkleRoot);
            // Add signature verification
            if (isValid && validator.signature) {
                const data = Buffer.from(validatorData);
                const isValidSignature = await crypto_1.HybridCrypto.verify(data.toString(), validator.signature, validator.publicKey);
                return isValidSignature;
            }
            return isValid;
        }
        catch (error) {
            shared_1.Logger.error("Validator verification failed:", error);
            return false;
        }
    }
    /**
     * Validates validator data structure
     * @param {Validator} validator - Validator to validate
     * @returns {boolean} True if validator data is valid
     * @private
     */
    isValidValidator(validator) {
        return !!(validator &&
            validator.id &&
            validator.publicKey &&
            typeof validator.lastActive === "number" &&
            typeof validator.reputation === "number" &&
            validator.address &&
            typeof validator.isActive === "boolean" &&
            typeof validator.isSuspended === "boolean" &&
            typeof validator.isAbsent === "boolean" &&
            typeof validator.uptime === "number" &&
            validator.metrics &&
            typeof validator.metrics.uptime === "number" &&
            typeof validator.metrics.voteParticipation === "number" &&
            typeof validator.metrics.blockProduction === "number");
    }
    /**
     * Serializes validator data for merkle tree
     * @param {Validator} validator - Validator to serialize
     * @returns {string} Serialized validator data
     * @private
     */
    serializeValidator(validator) {
        return `${validator.id}:${validator.publicKey}:${validator.lastActive}:${validator.reputation}`;
    }
    /**
     * Cleans up validator set resources
     */
    async cleanup() {
        try {
            this.merkleTree?.clearCache();
            this.validators.clear();
            this.validatorCache.clear();
            this.cacheTimestamps.clear();
        }
        catch (error) {
            shared_1.Logger.error("ValidatorSet cleanup failed:", error);
        }
    }
    /**
     * Cleans up expired cache entries
     * @private
     */
    cleanExpiredCache() {
        const now = Date.now();
        for (const [key, timestamp] of this.cacheTimestamps.entries()) {
            if (now - timestamp > this.CACHE_EXPIRY) {
                this.validatorCache.delete(key);
                this.cacheTimestamps.delete(key);
            }
        }
    }
    /**
     * Updates an existing validator's information
     * @param {Validator} validator - Updated validator data
     * @throws {Error} If validator not found or invalid reputation change
     */ async updateValidator(validator) {
        if (!this.validators.has(validator.id)) {
            throw new Error("Validator not found");
        }
        const existingValidator = this.validators.get(validator.id);
        if (!existingValidator)
            return;
        // Prevent reputation manipulation
        if (Math.abs(validator.reputation - existingValidator.reputation) > 10) {
            throw new Error("Invalid reputation change");
        }
        await this.addValidator({
            ...existingValidator,
            ...validator,
            lastActive: Date.now(),
        });
    }
}
exports.ValidatorSet = ValidatorSet;
