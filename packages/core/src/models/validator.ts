import { HybridCrypto } from '@h3tag-blockchain/crypto';
import { MerkleTree, MerkleProof } from '../utils/merkle';
import { Logger } from '@h3tag-blockchain/shared';

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
export class ValidatorSet {
  private merkleTree: MerkleTree;
  private validators: Map<string, Validator>;
  private readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
  private validatorCache: Map<string, Validator> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();

  /**
   * Creates a new ValidatorSet instance
   * Initializes merkle tree and sets up cache cleanup
   */
  constructor() {
    this.merkleTree = new MerkleTree();
    this.validators = new Map();
    // Set up periodic cache cleanup
    setInterval(() => this.cleanExpiredCache(), this.CACHE_EXPIRY);
  }

  /**
   * Adds a validator to the set
   * @param {Validator} validator - Validator to add
   * @throws {Error} If validator data is invalid
   */
  async addValidator(validator: Validator): Promise<void> {
    if (!this.isValidValidator(validator)) {
      throw new Error('Invalid validator data');
    }

    try {
      const validatorData = this.serializeValidator(validator);
      const validators = Array.from(this.validators.values()).map((v) =>
        this.serializeValidator(v),
      );
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
    } catch (error) {
      Logger.error('Failed to add validator:', error);
      throw error;
    }
  }

  /**
   * Verifies a validator's merkle proof
   * @param {Validator} validator - Validator to verify
   * @param {string} [merkleRoot] - Optional merkle root for verification
   * @returns {Promise<boolean>} True if validator is verified
   */
  async verifyValidator(
    validator: Validator,
    merkleRoot?: string,
  ): Promise<boolean> {
    if (!validator?.merkleProof || !merkleRoot) return false;

    try {
      const validatorData = this.serializeValidator(validator);
      const isValid = await this.merkleTree.verifyProof(
        validator.merkleProof,
        validatorData,
        merkleRoot,
      );

      // Add signature verification
      if (isValid && validator.signature) {
        const data = Buffer.from(validatorData);
        const isValidSignature = await HybridCrypto.verify(
          data.toString(),
          validator.signature,
          validator.publicKey,
        );
        return isValidSignature;
      }

      return isValid;
    } catch (error) {
      Logger.error('Validator verification failed:', error);
      return false;
    }
  }

  /**
   * Validates validator data structure
   * @param {Validator} validator - Validator to validate
   * @returns {boolean} True if validator data is valid
   * @private
   */
  private isValidValidator(validator: Validator): boolean {
    return !!(
      validator &&
      validator.id &&
      validator.publicKey &&
      typeof validator.lastActive === 'number' &&
      typeof validator.reputation === 'number' &&
      validator.address &&
      typeof validator.isActive === 'boolean' &&
      typeof validator.isSuspended === 'boolean' &&
      typeof validator.isAbsent === 'boolean' &&
      typeof validator.uptime === 'number' &&
      validator.metrics &&
      typeof validator.metrics.uptime === 'number' &&
      typeof validator.metrics.voteParticipation === 'number' &&
      typeof validator.metrics.blockProduction === 'number'
    );
  }

  /**
   * Serializes validator data for merkle tree
   * @param {Validator} validator - Validator to serialize
   * @returns {string} Serialized validator data
   * @private
   */
  private serializeValidator(validator: Validator): string {
    return `${validator.id}:${validator.publicKey}:${validator.lastActive}:${validator.reputation}`;
  }

  /**
   * Cleans up validator set resources
   */
  async cleanup(): Promise<void> {
    try {
      this.merkleTree?.clearCache();
      this.validators.clear();
      this.validatorCache.clear();
      this.cacheTimestamps.clear();
    } catch (error) {
      Logger.error('ValidatorSet cleanup failed:', error);
    }
  }

  /**
   * Cleans up expired cache entries
   * @private
   */
  private cleanExpiredCache(): void {
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
   */ async updateValidator(validator: Validator): Promise<void> {
    if (!this.validators.has(validator.id)) {
      throw new Error('Validator not found');
    }

    const existingValidator = this.validators.get(validator.id);
    if (!existingValidator) return;

    // Prevent reputation manipulation
    if (Math.abs(validator.reputation - existingValidator.reputation) > 10) {
      throw new Error('Invalid reputation change');
    }

    await this.addValidator({
      ...existingValidator,
      ...validator,
      lastActive: Date.now(),
    });
  }
}
