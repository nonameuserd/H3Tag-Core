"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockValidator = exports.BlockValidationError = void 0;
const transaction_model_1 = require("../models/transaction.model");
const events_1 = require("events");
const transaction_model_2 = require("../models/transaction.model");
const crypto_1 = require("@h3tag-blockchain/crypto");
const crypto_2 = require("crypto");
const shared_1 = require("@h3tag-blockchain/shared");
const constants_1 = require("../blockchain/utils/constants");
const validator_1 = require("../models/validator");
const retry_1 = require("../utils/retry");
class BlockValidationError extends Error {
    constructor(message, code) {
        super(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} ${message}`);
        this.code = code;
        this.name = "BlockValidationError";
    }
}
exports.BlockValidationError = BlockValidationError;
class BlockValidator {
    constructor() {
        this.eventEmitter = new events_1.EventEmitter();
    }
    static async validateBlock(block, previousBlock, utxoSet) {
        try {
            await Promise.race([
                this.performValidation(block, previousBlock, utxoSet),
                this.createTimeout(),
            ]);
            // Cleanup validator set after successful validation
            await this.cleanupValidatorSet();
            return true;
        }
        catch (error) {
            if (error instanceof BlockValidationError) {
                shared_1.Logger.error(`Block validation failed: ${error.message} (${error.code})`);
            }
            else {
                shared_1.Logger.error("Unexpected error during block validation:", error);
            }
            return false;
        }
    }
    static createTimeout() {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new BlockValidationError(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} validation timeout`, "VALIDATION_TIMEOUT"));
            }, this.BLOCK_CONSTANTS.MAX_VALIDATION_TIME);
        });
    }
    static async performValidation(block, previousBlock, utxoSet) {
        await this.validateBlockStructure(block);
        await this.validateBlockSize(block);
        await this.validateTimestamp(block);
        await this.validateProofOfWork(block);
        await this.validateVotes(block);
        await this.validateBlockValidators(block);
        if (previousBlock) {
            await this.validatePreviousBlock(block, previousBlock);
        }
        await this.validateMerkleRoot(block);
        await this.validateTransactions(block, utxoSet);
    }
    static async validateBlockStructure(block) {
        if (!block.header || !block.transactions || !block.hash) {
            throw new BlockValidationError(`Invalid ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} block structure`, "INVALID_STRUCTURE");
        }
        const requiredFields = [
            "version",
            "previousHash",
            "merkleRoot",
            "timestamp",
            "difficulty",
            "nonce",
        ];
        for (const field of requiredFields) {
            if (!(field in block.header)) {
                throw new BlockValidationError(`Missing ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} header field: ${field}`, "MISSING_FIELD");
            }
        }
    }
    static async validateBlockSize(block) {
        // Check transaction count
        if (block.transactions.length > this.BLOCK_CONSTANTS.MAX_TRANSACTIONS) {
            throw new BlockValidationError(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} block has excess transactions`, "EXCESS_TRANSACTIONS");
        }
        // Get dynamic size limit for this block
        const dynamicSizeLimit = await this.calculateDynamicBlockSize(block);
        // Check block size against dynamic limit
        const blockSize = JSON.stringify(block).length;
        if (blockSize > (await dynamicSizeLimit)) {
            throw new BlockValidationError(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} block size ${blockSize} exceeds dynamic limit ${dynamicSizeLimit}`, "EXCESS_SIZE");
        }
    }
    static async validateTimestamp(block) {
        const currentTime = Date.now();
        const blockTime = block.header.timestamp;
        if (blockTime < currentTime + this.BLOCK_CONSTANTS.MIN_TIMESTAMP_OFFSET ||
            blockTime > currentTime + this.BLOCK_CONSTANTS.MAX_TIMESTAMP_OFFSET) {
            throw new BlockValidationError("Invalid timestamp", "INVALID_TIMESTAMP");
        }
    }
    static async validatePreviousBlock(block, previousBlock) {
        if (block.header.previousHash !== previousBlock.hash) {
            throw new BlockValidationError("Invalid previous block", "INVALID_PREV_BLOCK");
        }
        if (block.header.timestamp <= previousBlock.header.timestamp) {
            throw new BlockValidationError("Invalid timestamp order", "INVALID_TIMESTAMP_ORDER");
        }
    }
    static async validateMerkleRoot(block) {
        const calculatedRoot = await this.calculateMerkleRoot(block.transactions);
        if (calculatedRoot !== block.header.merkleRoot) {
            throw new BlockValidationError("Invalid merkle root", "INVALID_MERKLE_ROOT");
        }
    }
    static async validateTransactions(block, utxoSet) {
        const txBatch = 100; // Process transactions in batches
        for (let i = 0; i < block.transactions.length; i += txBatch) {
            const batch = block.transactions.slice(i, i + txBatch);
            await this.validateTransactionBatch(batch, utxoSet, i === 0);
        }
    }
    static async calculateMerkleRoot(transactions) {
        if (transactions.length === 0) {
            throw new BlockValidationError("Empty transaction list", "EMPTY_TRANSACTIONS");
        }
        const batchSize = 1000;
        let hashes = [];
        for (let i = 0; i < transactions.length; i += batchSize) {
            const batch = transactions.slice(i, i + batchSize);
            const batchHashes = await Promise.all(batch.map((tx) => this.hashTransaction(tx)));
            hashes.push(...batchHashes);
        }
        while (hashes.length > 1) {
            const nextLevel = [];
            for (let i = 0; i < hashes.length; i += 2) {
                const left = hashes[i];
                const right = i + 1 < hashes.length ? hashes[i + 1] : left;
                const combined = await this.hashPair(left, right);
                nextLevel.push(combined);
            }
            hashes = nextLevel;
        }
        return hashes[0];
    }
    static async hashTransaction(tx) {
        const txData = JSON.stringify({
            inputs: tx.inputs,
            outputs: tx.outputs,
            timestamp: tx.timestamp,
        });
        return this.hashData(txData);
    }
    static async hashPair(left, right) {
        return this.hashData(`${left}${right}`);
    }
    static async hashData(data) {
        return (0, crypto_2.createHash)("sha3-256").update(data).digest("hex");
    }
    static async validateProofOfWork(block) {
        if (!block.header.nonce || !(await this.meetsHashTarget(block))) {
            throw new BlockValidationError("Invalid proof of work", "INVALID_POW");
        }
        // Add quantum security validation
        await this.calculateBlockHash(block);
    }
    static async validateVotes(block) {
        const votes = (block.votes || []).map((vote) => typeof vote === "string" ? JSON.parse(vote) : vote);
        if (!(await this.validateVoteSignatures(votes))) {
            throw new BlockValidationError("Invalid vote signatures", "INVALID_VOTES");
        }
    }
    static async validateVoteSignatures(votes) {
        try {
            for (const vote of votes) {
                const isValid = await crypto_1.HybridCrypto.verify(vote.blockHash, vote.signature, vote.publicKey);
                if (!isValid) {
                    shared_1.Logger.warn("Invalid vote signature detected", { voter: vote.voter });
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            shared_1.Logger.error("Vote signature validation failed:", error);
            return false;
        }
    }
    static async validateTransactionBatch(transactions, utxoSet, isFirstBatch) {
        if (!transactions?.length) {
            throw new BlockValidationError("Empty transaction batch", "EMPTY_BATCH");
        }
        for (const tx of transactions) {
            if (isFirstBatch && this.isCoinbaseTransaction(tx)) {
                await this.validateCoinbase(tx);
            }
            else {
                await this.validateTransaction(tx, utxoSet);
            }
        }
    }
    static isCoinbaseTransaction(tx) {
        return (tx.type === transaction_model_2.TransactionType.POW_REWARD &&
            tx.inputs.length === 0 &&
            tx.outputs.length === 1);
    }
    static async validateCoinbase(tx) {
        if (!tx.powData?.nonce || !tx.outputs[0]?.amount) {
            throw new BlockValidationError("Invalid coinbase structure", "INVALID_COINBASE");
        }
        // Validate mining reward amount
        if (tx.outputs[0].amount > this.calculateBlockReward()) {
            throw new BlockValidationError("Invalid mining reward", "EXCESS_REWARD");
        }
    }
    static async validateTransaction(tx, utxoSet) {
        // Verify transaction signature and structure
        if (!(await transaction_model_1.TransactionBuilder.verify(tx))) {
            throw new BlockValidationError("Invalid transaction signature", "INVALID_TX_SIGNATURE");
        }
        // Validate UTXO references
        for (const input of tx.inputs) {
            const utxo = await utxoSet.get(input.txId, input.outputIndex);
            if (!utxo) {
                throw new BlockValidationError("UTXO not found", "INVALID_UTXO_REF");
            }
            if (utxo.amount !== input.amount) {
                throw new BlockValidationError("Amount mismatch", "AMOUNT_MISMATCH");
            }
        }
    }
    static calculateBlockReward() {
        try {
            const currentHeight = this.getCurrentHeight();
            if (currentHeight < 0) {
                shared_1.Logger.error("Invalid block height for reward calculation");
                return this.REWARD_CONSTANTS.MIN_REWARD;
            }
            const halvings = Math.min(Math.floor(currentHeight / this.REWARD_CONSTANTS.HALVING_INTERVAL), this.REWARD_CONSTANTS.MAX_HALVINGS);
            if (halvings >= this.REWARD_CONSTANTS.MAX_HALVINGS) {
                return this.REWARD_CONSTANTS.MIN_REWARD;
            }
            const reward = this.REWARD_CONSTANTS.INITIAL_REWARD >> BigInt(halvings);
            return reward > this.REWARD_CONSTANTS.MIN_REWARD
                ? reward
                : this.REWARD_CONSTANTS.MIN_REWARD;
        }
        catch (error) {
            shared_1.Logger.error("Block reward calculation failed:", error);
            return this.REWARD_CONSTANTS.MIN_REWARD;
        }
    }
    static getCurrentHeight() {
        try {
            return this.blockchain.getCurrentHeight() ?? 0;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get current height:", error);
            return 0;
        }
    }
    static setBlockchain(chain) {
        this.blockchain = chain;
    }
    static async meetsHashTarget(block) {
        const blockHash = await this.calculateBlockHash(block);
        const target = this.calculateDifficultyTarget(block.header.difficulty);
        return BigInt(`0x${blockHash}`) <= target;
    }
    static async calculateBlockHash(block) {
        const data = JSON.stringify({
            header: { ...block.header, hash: null },
            transactions: block.transactions.map((tx) => tx.id),
        });
        const hash = (0, crypto_2.createHash)("sha3-256").update(data).digest("hex");
        return hash;
    }
    static calculateDifficultyTarget(difficulty) {
        const maxTarget = BigInt("0x00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
        return maxTarget / BigInt(Math.floor(difficulty));
    }
    static async calculateDynamicBlockSize(block) {
        try {
            // Get network metrics
            const mempool = this.blockchain.getMempool();
            const stats = this.blockchain?.getBlockchainStats();
            if (!mempool || !stats) {
                return this.BLOCK_CONSTANTS.MIN_BLOCK_SIZE;
            }
            // Calculate network load factors
            const mempoolSize = mempool.getSize();
            const avgBlockTime = stats.getAverageBlockTime();
            const propagationStats = stats.getBlockPropagationStats();
            // Network congestion factor (0.5 to 2.0)
            const congestionFactor = Math.min(2.0, Math.max(0.5, mempoolSize / this.BLOCK_CONSTANTS.MAX_TRANSACTIONS));
            // Block time factor (0.8 to 1.2)
            const blockTimeFactor = Math.min(1.2, Math.max(0.8, this.BLOCK_CONSTANTS.TARGET_BLOCK_TIME / Number(avgBlockTime)));
            // Propagation factor (0.7 to 1.3)
            const propagationFactor = Math.min(1.3, Math.max(0.7, 1000 / (await propagationStats).median));
            // Calculate target size with all factors
            const currentSize = JSON.stringify(block).length;
            const adjustedSize = currentSize * congestionFactor * blockTimeFactor * propagationFactor;
            // Apply min/max bounds and smoothing
            const previousSize = this.getPreviousBlockSize();
            const maxChange = previousSize * (this.BLOCK_CONSTANTS.ADJUSTMENT_FACTOR - 1);
            const targetSize = Math.min(Math.max(this.BLOCK_CONSTANTS.MIN_BLOCK_SIZE, Math.min(previousSize + maxChange, Math.max(previousSize - maxChange, adjustedSize))), this.BLOCK_CONSTANTS.MAX_BLOCK_SIZE);
            return Math.floor(targetSize);
        }
        catch (error) {
            shared_1.Logger.error("Dynamic block size calculation failed:", error);
            return this.BLOCK_CONSTANTS.MIN_BLOCK_SIZE;
        }
    }
    static getPreviousBlockSize() {
        try {
            // Check cache first
            if (this.blockSizeCache &&
                Date.now() - this.blockSizeCache.timestamp < this.CACHE_DURATION) {
                return this.blockSizeCache.size;
            }
            // Get latest block and calculate size
            const previousBlock = this.blockchain.getLatestBlock();
            if (!previousBlock) {
                shared_1.Logger.warn("No previous block found, using minimum size");
                return this.BLOCK_CONSTANTS.MIN_BLOCK_SIZE;
            }
            // Calculate size efficiently
            const size = this.calculateBlockSize(previousBlock);
            // Update cache
            this.blockSizeCache = {
                size,
                timestamp: Date.now(),
            };
            return size;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get previous block size:", error);
            return this.blockSizeCache?.size || this.BLOCK_CONSTANTS.MIN_BLOCK_SIZE;
        }
    }
    static calculateBlockSize(block) {
        try {
            // Calculate size of essential components only
            const headerSize = JSON.stringify(block.header).length;
            const txSize = block.transactions.reduce((sum, tx) => sum + JSON.stringify(tx).length, 0);
            const votesSize = (block.votes || []).reduce((sum, vote) => sum +
                (typeof vote === "string"
                    ? vote.length
                    : JSON.stringify(vote).length), 0);
            return headerSize + txSize + votesSize;
        }
        catch (error) {
            shared_1.Logger.error("Block size calculation failed:", error);
            return this.BLOCK_CONSTANTS.MIN_BLOCK_SIZE;
        }
    }
    // Add validator verification to block validation
    static async validateBlockValidators(block) {
        const validators = block.validators || [];
        if (validators.length < this.VALIDATOR_CONSTANTS.MIN_VALIDATORS) {
            throw new BlockValidationError("Insufficient validators", "INSUFFICIENT_VALIDATORS");
        }
        // Verify each validator's merkle proof and signatures
        const validatorResults = await Promise.all(validators.map(async (validator) => {
            try {
                const [merkleValid, signaturesValid] = await Promise.all([
                    this.validatorSet.verifyValidator(validator, block.header.validatorMerkleRoot),
                    this.verifyValidatorSignatures(validator),
                ]);
                return {
                    validator,
                    isValid: merkleValid && signaturesValid,
                    weight: validator.reputation / this.VALIDATOR_CONSTANTS.MAX_REPUTATION,
                };
            }
            catch (error) {
                shared_1.Logger.error(`Validator verification failed: ${validator.id}`, error);
                return { validator, isValid: false, weight: 0 };
            }
        }));
        // Calculate weighted validation score
        const totalWeight = validatorResults.reduce((sum, { isValid, weight }) => sum + (isValid ? weight : 0), 0);
        if (totalWeight < this.VALIDATOR_CONSTANTS.VALIDATION_WEIGHT_THRESHOLD) {
            throw new BlockValidationError("Insufficient validator weight", "INSUFFICIENT_VALIDATOR_WEIGHT");
        }
    }
    static async verifyValidatorSignatures(validator) {
        try {
            const [classicSig] = await Promise.all([
                crypto_1.HybridCrypto.verify(validator.validationData, validator.signature, validator.publicKey),
            ]);
            return classicSig;
        }
        catch (error) {
            shared_1.Logger.error(`Validator signature verification failed: ${validator.id}`, error);
            return false;
        }
    }
    static async cleanupValidatorSet() {
        try {
            await this.validatorSet.cleanup();
        }
        catch (error) {
            shared_1.Logger.warn("Validator set cleanup failed:", error);
        }
    }
    // Add methods to expose event emitter functionality
    on(event, listener) {
        this.eventEmitter.on(event, listener);
    }
    off(event, listener) {
        this.eventEmitter.off(event, listener);
    }
    removeAllListeners() {
        this.eventEmitter.removeAllListeners();
    }
}
exports.BlockValidator = BlockValidator;
BlockValidator.BLOCK_CONSTANTS = {
    MIN_BLOCK_SIZE: 1000000, // 1MB minimum
    MAX_BLOCK_SIZE: 32000000, // 32MB maximum
    TARGET_BLOCK_TIME: 600, // 10 minutes
    ADJUSTMENT_FACTOR: 1.2, // 20% adjustment limit
    MAX_TRANSACTIONS: 2000,
    MIN_TIMESTAMP_OFFSET: -2 * 60 * 60 * 1000, // 2 hours in the past
    MAX_TIMESTAMP_OFFSET: 2 * 60 * 60 * 1000, // 2 hours in the future
    MAX_VALIDATION_TIME: 30000, // 30 seconds
};
BlockValidator.REWARD_CONSTANTS = {
    INITIAL_REWARD: BigInt(50), // 50 coins in smallest unit
    HALVING_INTERVAL: 210000, // Blocks per halving
    MAX_HALVINGS: 64, // Prevent infinite halvings
    MIN_REWARD: BigInt(1), // Minimum reward amount
};
BlockValidator.CACHE_DURATION = 60000; // 1 minute cache
BlockValidator.blockSizeCache = null;
BlockValidator.validatorSet = new validator_1.ValidatorSet();
// Add validator-specific constants
BlockValidator.VALIDATOR_CONSTANTS = {
    MIN_VALIDATORS: 4,
    MAX_VALIDATORS: 100,
    MIN_REPUTATION: 0,
    MAX_REPUTATION: 100,
    VALIDATION_WEIGHT_THRESHOLD: 0.66, // 66% of validators required
};
BlockValidator.blockchain = null;
__decorate([
    (0, retry_1.retry)({
        maxAttempts: 3,
        delay: 1000,
        exponentialBackoff: true,
    })
], BlockValidator, "validateBlock", null);
