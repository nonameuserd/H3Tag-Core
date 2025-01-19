"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionValidator = void 0;
const transaction_model_1 = require("../models/transaction.model");
const shared_1 = require("@h3tag-blockchain/shared");
const crypto_1 = require("@h3tag-blockchain/crypto");
const blockchain_schema_1 = require("../database/blockchain-schema");
const constants_1 = require("../blockchain/utils/constants");
const transaction_validation_error_1 = require("./transaction-validation-error");
const async_mutex_1 = require("async-mutex");
const database_transaction_1 = require("../database/database-transaction");
const crypto_2 = require("crypto");
class TransactionValidator {
    static async validateTransaction(tx, utxoSet, currentHeight) {
        const release = await this.voteLock.acquire();
        try {
            await this.validateBasicRequirements(tx, utxoSet);
            if (tx.type === transaction_model_1.TransactionType.POW_REWARD) {
                await this.validatePoWTransaction(tx);
            }
            else if (tx.type === transaction_model_1.TransactionType.QUADRATIC_VOTE) {
                await this.validateVoteTransaction(tx, utxoSet, currentHeight);
            }
            return true;
        }
        catch (error) {
            shared_1.Logger.error("Transaction validation failed:", error);
            return false;
        }
        finally {
            release();
        }
    }
    static async validateBasicRequirements(tx, utxoSet) {
        // Add null/undefined check for tx
        if (!tx) {
            throw new transaction_validation_error_1.TransactionValidationError("Transaction is null or undefined", "INVALID_TRANSACTION");
        }
        // Add type validation
        if (typeof tx.type !== "number" ||
            !Object.values(transaction_model_1.TransactionType).includes(tx.type)) {
            throw new transaction_validation_error_1.TransactionValidationError("Invalid transaction type", "INVALID_TYPE");
        }
        // Basic structure validation
        if (!tx.id || !tx.inputs || !tx.outputs) {
            throw new transaction_validation_error_1.TransactionValidationError("Invalid structure", "INVALID_STRUCTURE");
        }
        // Size limits
        if (JSON.stringify(tx).length > constants_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_TX_SIZE) {
            throw new transaction_validation_error_1.TransactionValidationError(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NAME} transaction too large`, "EXCESS_SIZE");
        }
        // Input/Output validation
        await this.validateInputsAndOutputs(tx, utxoSet);
        // Signature verification
        await this.validateSignatures(tx);
        // Add version validation
        if (!this.validateTransactionVersion(tx)) {
            throw new transaction_validation_error_1.TransactionValidationError("Invalid transaction version", "INVALID_VERSION");
        }
        // Add size validation
        if (!this.validateTransactionSize(tx)) {
            throw new transaction_validation_error_1.TransactionValidationError("Transaction size exceeds limit", "EXCESS_SIZE");
        }
    }
    static async validatePoWTransaction(tx) {
        // Validate PoW data structure
        if (!tx.powData || typeof tx.powData !== "object") {
            throw new transaction_validation_error_1.TransactionValidationError(`Invalid ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} PoW data structure`, "INVALID_POW_DATA");
        }
        // Calculate and validate hash
        const hash = await this.calculateTransactionPoW(tx);
        if (!this.isValidHash(hash)) {
            throw new transaction_validation_error_1.TransactionValidationError("Invalid PoW hash format", "INVALID_HASH");
        }
        // Calculate and validate difficulty
        const difficulty = this.calculateHashDifficulty(hash);
        const minDifficulty = constants_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_DIFFICULTY;
        if (difficulty < minDifficulty) {
            throw new transaction_validation_error_1.TransactionValidationError(`Insufficient PoW difficulty (${difficulty} < ${minDifficulty})`, "INSUFFICIENT_POW");
        }
        // Validate timestamp
        const now = Date.now();
        const maxAge = 600000; // 10 minutes
        if (now - tx.powData.timestamp > maxAge) {
            throw new transaction_validation_error_1.TransactionValidationError("PoW timestamp too old", "EXPIRED_POW");
        }
    }
    static async validateVoteTransaction(tx, utxoSet, currentHeight) {
        // Validate transaction type
        if (tx.type !== transaction_model_1.TransactionType.QUADRATIC_VOTE) {
            throw new transaction_validation_error_1.TransactionValidationError("Invalid transaction type for vote", "INVALID_VOTE_TYPE");
        }
        // Validate vote data structure
        if (!tx.voteData ||
            typeof tx.voteData !== "object" ||
            !tx.voteData.proposal ||
            typeof tx.voteData.vote !== "boolean") {
            throw new transaction_validation_error_1.TransactionValidationError("Invalid vote data structure", "INVALID_VOTE_DATA");
        }
        // Calculate quadratic voting power
        const committedAmount = await this.calculateVotingPower(tx, utxoSet);
        const quadraticPower = Math.floor(Math.sqrt(Number(committedAmount)));
        if (quadraticPower < constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_VOTE_AMOUNT) {
            throw new transaction_validation_error_1.TransactionValidationError(`Insufficient quadratic voting power (${quadraticPower})`, "INSUFFICIENT_VOTING_POWER");
        }
        // Validate cooldown period
        const [lastVoted, utxo] = await Promise.all([
            tx.inputs[0]?.publicKey
                ? this.getLastVoteHeight(tx.inputs[0].publicKey)
                : 0,
            utxoSet.get(tx.inputs[0].txId, tx.inputs[0].outputIndex),
        ]);
        if (!utxo) {
            throw new transaction_validation_error_1.TransactionValidationError("Invalid input UTXO", "INVALID_INPUT");
        }
        if (currentHeight - lastVoted <
            constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.COOLDOWN_BLOCKS) {
            throw new transaction_validation_error_1.TransactionValidationError("Vote cooldown period not met", "VOTE_COOLDOWN");
        }
        // Update last vote height
        await this.setLastVoteHeight(utxo.address, currentHeight);
    }
    static async calculateVotingPower(tx, utxoSet) {
        const utxos = await this.getTransactionUTXOs(tx, utxoSet);
        const totalAmount = utxos.reduce((sum, utxo) => sum + utxo.amount, BigInt(0));
        // Convert to quadratic voting power
        const quadraticPower = Math.floor(Math.sqrt(Number(totalAmount)));
        // Ensure minimum voting power
        return Math.max(quadraticPower, 0);
    }
    static async validateSignatures(tx) {
        try {
            // Add input array validation
            if (!Array.isArray(tx.inputs)) {
                throw new transaction_validation_error_1.TransactionValidationError("Invalid inputs array", "INVALID_INPUTS");
            }
            // Add concurrent signature verification with timeout
            const verificationPromises = tx.inputs.map((input) => {
                return Promise.race([
                    this.verifyInputSignature(input, tx.id),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Signature verification timeout")), 5000)),
                ]);
            });
            await Promise.all(verificationPromises);
        }
        catch (error) {
            shared_1.Logger.error("Signature validation failed:", error);
            if (error instanceof transaction_validation_error_1.TransactionValidationError) {
                throw error;
            }
            throw new transaction_validation_error_1.TransactionValidationError("Signature validation failed", "VALIDATION_ERROR");
        }
    }
    static async calculateTransactionPoW(tx) {
        try {
            // Create immutable copy with timestamp
            const data = {
                ...tx,
                powData: {
                    ...tx.powData,
                    timestamp: Date.now(),
                    version: "1.0",
                },
            };
            // Generate deterministic buffer
            const dataString = JSON.stringify(data, (_, v) => typeof v === "bigint" ? v.toString() : v);
            // Calculate classical hash using SHA3-256
            const classicalHash = (0, crypto_2.createHash)("sha3-256")
                .update(Buffer.from(dataString))
                .digest("hex");
            if (!this.isValidHash(classicalHash)) {
                throw new transaction_validation_error_1.TransactionValidationError("Invalid classical hash format", "INVALID_HASH");
            }
            // Create hybrid hash
            const hybridHash = await crypto_1.HybridCrypto.hash(classicalHash);
            if (!this.isValidHash(hybridHash)) {
                throw new transaction_validation_error_1.TransactionValidationError("Invalid hybrid hash format", "INVALID_HASH");
            }
            return hybridHash;
        }
        catch (error) {
            shared_1.Logger.error("PoW calculation failed:", error);
            throw new transaction_validation_error_1.TransactionValidationError("PoW calculation failed", "POW_CALCULATION_ERROR");
        }
    }
    static isValidHash(hash) {
        return (typeof hash === "string" &&
            hash.length === 64 &&
            /^[0-9a-f]{64}$/i.test(hash));
    }
    static async validateInputsAndOutputs(tx, utxoSet) {
        try {
            if (!tx.inputs?.length || !tx.outputs?.length) {
                throw new transaction_validation_error_1.TransactionValidationError("Empty inputs or outputs", "INVALID_STRUCTURE");
            }
            // Validate input/output counts
            if (tx.inputs.length > constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_INPUTS ||
                tx.outputs.length > constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_OUTPUTS) {
                throw new transaction_validation_error_1.TransactionValidationError("Too many inputs or outputs", "EXCESS_INPUTS_OUTPUTS");
            }
            // Validate individual amounts
            for (const output of tx.outputs) {
                if (output.amount <= BigInt(0)) {
                    throw new transaction_validation_error_1.TransactionValidationError("Invalid output amount", "INVALID_AMOUNT");
                }
            }
            // Validate total amounts
            const inputSum = await this.calculateInputSum(tx, utxoSet);
            const outputSum = tx.outputs.reduce((sum, output) => sum + output.amount, BigInt(0));
            if (inputSum < outputSum) {
                throw new transaction_validation_error_1.TransactionValidationError("Insufficient input amount", "INSUFFICIENT_FUNDS");
            }
            // Validate no duplicate inputs
            const inputIds = new Set();
            for (const input of tx.inputs) {
                const inputId = `${input.txId}:${input.outputIndex}`;
                if (inputIds.has(inputId)) {
                    throw new transaction_validation_error_1.TransactionValidationError("Duplicate input detected", "DUPLICATE_INPUT");
                }
                inputIds.add(inputId);
            }
        }
        catch (error) {
            shared_1.Logger.error("Input/output validation failed:", error);
            if (error instanceof transaction_validation_error_1.TransactionValidationError) {
                throw error;
            }
            throw new transaction_validation_error_1.TransactionValidationError("Input/output validation failed", "VALIDATION_ERROR");
        }
    }
    static async calculateInputSum(tx, utxoSet) {
        let sum = BigInt(0);
        for (const input of tx.inputs) {
            const utxo = await utxoSet.get(input.txId, input.outputIndex);
            if (!utxo || utxo.spent) {
                throw new transaction_validation_error_1.TransactionValidationError("Invalid input UTXO", "INVALID_INPUT");
            }
            sum += utxo.amount;
        }
        return sum;
    }
    static async getTransactionUTXOs(tx, utxoSet) {
        const utxos = [];
        for (const input of tx.inputs) {
            const utxo = await utxoSet.get(input.txId, input.outputIndex);
            if (utxo && !utxo.spent) {
                utxos.push(utxo);
            }
        }
        return utxos;
    }
    static async getLastVoteHeight(address) {
        try {
            const key = `${this.VOTE_HEIGHT_KEY_PREFIX}${address}`;
            const height = await this.db.get(key);
            return height ? Number(height) : 0;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get last vote height:", error);
            return 0;
        }
    }
    static async setLastVoteHeight(address, height) {
        const key = `${this.VOTE_HEIGHT_KEY_PREFIX}${address}`;
        const release = await this.voteLock.acquire();
        try {
            const dbTx = new database_transaction_1.DatabaseTransaction(this.db);
            await dbTx.put(key, height.toString());
            await dbTx.put(`${key}:timestamp`, Date.now().toString());
            await dbTx.commit();
            // Update cache if exists
            if (this.voteHeightCache?.has(address)) {
                this.voteHeightCache.set(address, height);
            }
        }
        catch (error) {
            shared_1.Logger.error("Failed to set last vote height:", error);
            throw new transaction_validation_error_1.TransactionValidationError("Failed to update vote height", "DB_ERROR");
        }
        finally {
            release();
        }
    }
    static calculateHashDifficulty(hash) {
        try {
            // Validate hash format
            if (!/^[0-9a-f]{64}$/i.test(hash)) {
                throw new transaction_validation_error_1.TransactionValidationError("Invalid hash format", "INVALID_HASH");
            }
            // Optimize binary conversion by checking hex digits directly
            let leadingZeros = 0;
            for (const char of hash) {
                const hexValue = parseInt(char, 16);
                if (hexValue === 0) {
                    leadingZeros += 4;
                }
                else {
                    // Count remaining leading zeros in this hex digit
                    const bits = hexValue.toString(2).padStart(4, "0");
                    for (const bit of bits) {
                        if (bit === "0") {
                            leadingZeros++;
                        }
                        else {
                            return leadingZeros;
                        }
                    }
                    break;
                }
            }
            return leadingZeros;
        }
        catch (error) {
            shared_1.Logger.error("Hash difficulty calculation failed:", error);
            throw new transaction_validation_error_1.TransactionValidationError("Difficulty calculation failed", "DIFFICULTY_ERROR");
        }
    }
    static async verifyInputSignature(input, txId) {
        if (!input?.signature || !input?.publicKey) {
            throw new transaction_validation_error_1.TransactionValidationError("Missing signature data", "INVALID_SIGNATURE");
        }
        return crypto_1.HybridCrypto.verify(txId, input.signature, input.publicKey);
    }
    /**
     * Validates transaction size against network limits
     */
    static validateTransactionSize(tx) {
        try {
            const txSize = this.calculateTransactionSize(tx);
            return txSize <= constants_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_TX_SIZE;
        }
        catch (error) {
            shared_1.Logger.error("Transaction size validation failed:", error);
            return false;
        }
    }
    /**
     * Calculates required transaction fee based on size
     */
    static calculateTransactionFee(tx) {
        try {
            const txSize = this.calculateTransactionSize(tx);
            return BigInt(txSize) * constants_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_FEE_PER_BYTE;
        }
        catch (error) {
            shared_1.Logger.error("Transaction fee calculation failed:", error);
            throw new transaction_validation_error_1.TransactionValidationError("Fee calculation failed", "FEE_CALCULATION_ERROR");
        }
    }
    /**
     * Calculates transaction size in bytes
     */
    static calculateTransactionSize(tx) {
        try {
            // Create a sanitized copy for size calculation
            const sizingTx = {
                id: tx.id,
                version: tx.version,
                type: tx.type,
                timestamp: tx.timestamp,
                sender: tx.sender,
                nonce: tx.nonce,
                inputs: tx.inputs,
                outputs: tx.outputs,
                signature: tx.signature,
            };
            // Convert to buffer to get actual byte size
            return Buffer.from(JSON.stringify(sizingTx)).length;
        }
        catch (error) {
            shared_1.Logger.error("Transaction size calculation failed:", error);
            throw new transaction_validation_error_1.TransactionValidationError("Size calculation failed", "SIZE_CALCULATION_ERROR");
        }
    }
    /**
     * Validates transaction version
     */
    static validateTransactionVersion(tx) {
        try {
            if (!tx.version) {
                throw new transaction_validation_error_1.TransactionValidationError("Missing transaction version", "MISSING_VERSION");
            }
            return (tx.version >= constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MIN_TX_VERSION &&
                tx.version <= constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_TX_VERSION);
        }
        catch (error) {
            shared_1.Logger.error("Transaction version validation failed:", error);
            return false;
        }
    }
}
exports.TransactionValidator = TransactionValidator;
TransactionValidator.VOTE_HEIGHT_KEY_PREFIX = "vote_height:";
TransactionValidator.db = new blockchain_schema_1.BlockchainSchema(); // Assuming Database is imported
TransactionValidator.voteLock = new async_mutex_1.Mutex();
TransactionValidator.voteHeightCache = new Map();
