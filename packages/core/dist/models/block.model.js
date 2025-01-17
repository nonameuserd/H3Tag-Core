"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockBuilder = exports.BlockError = void 0;
const shared_1 = require("@h3tag-blockchain/shared");
const merkle_1 = require("../utils/merkle");
const async_mutex_1 = require("async-mutex");
const audit_1 = require("../security/audit");
const crypto_1 = require("@h3tag-blockchain/crypto");
class BlockError extends Error {
    constructor(message) {
        super(message);
        this.name = "BlockError";
    }
}
exports.BlockError = BlockError;
class BlockBuilder {
    constructor(previousHash, difficulty, auditManager) {
        this.maxTransactionAge = 72 * 60 * 60 * 1000; // 72 hours
        this.transactions = [];
        this.votes = [];
        this.validators = [];
        this.mutex = new async_mutex_1.Mutex();
        this.hash = "";
        if (difficulty < BlockBuilder.MIN_DIFFICULTY) {
            throw new BlockError("Invalid difficulty");
        }
        this.auditManager = auditManager;
        this.merkleTree = new merkle_1.MerkleTree();
        this.header = {
            version: BlockBuilder.CURRENT_VERSION,
            height: 0,
            previousHash,
            timestamp: Date.now(),
            merkleRoot: "",
            difficulty,
            nonce: 0,
            miner: "",
            validatorMerkleRoot: "",
            totalTAG: 0,
            blockReward: 0,
            fees: 0,
            target: "",
            consensusData: {
                powScore: 0,
                votingScore: 0,
                participationRate: 0,
                periodId: 0,
            },
            minerAddress: "",
            signature: undefined,
            publicKey: "",
            hash: "",
        };
    }
    async calculateMerkleRoot() {
        const release = await this.mutex.acquire();
        try {
            // Performance tracking
            const startTime = Date.now();
            // Input validation
            if (!this.transactions || !Array.isArray(this.transactions)) {
                throw new BlockError("Invalid transaction array");
            }
            // Handle empty transaction list
            if (this.transactions.length === 0) {
                shared_1.Logger.debug("Calculating merkle root for empty transaction list");
                return await this.merkleTree.createRoot([""]); // Empty tree
            }
            // Validate each transaction has an ID
            for (const tx of this.transactions) {
                if (!tx.id) {
                    throw new BlockError(`Transaction missing ID: ${JSON.stringify(tx)}`);
                }
            }
            // Map transactions to their hashes
            const txHashes = this.transactions.map((tx) => {
                if (typeof tx.id !== "string") {
                    throw new BlockError(`Invalid transaction ID format: ${tx.id}`);
                }
                return tx.id;
            });
            // Calculate merkle root
            const merkleRoot = await this.merkleTree.createRoot(txHashes);
            // Validate merkle root
            if (!merkleRoot ||
                typeof merkleRoot !== "string" ||
                merkleRoot.length === 0) {
                throw new BlockError("Invalid merkle root generated");
            }
            // Log performance metrics
            const duration = Date.now() - startTime;
            shared_1.Logger.debug(`Merkle root calculation completed in ${duration}ms for ${txHashes.length} transactions`);
            // Audit log for significant transaction counts
            if (txHashes.length > 1000) {
                await this.auditManager?.log(audit_1.AuditEventType.LARGE_MERKLE_TREE, {
                    transactionCount: txHashes.length,
                    calculationTime: duration,
                    merkleRoot,
                    severity: audit_1.AuditSeverity.INFO,
                });
            }
            return merkleRoot;
        }
        catch (error) {
            shared_1.Logger.error("Merkle root calculation failed:", error);
            throw new BlockError(error instanceof BlockError
                ? error.message
                : "Failed to calculate merkle root");
        }
        finally {
            release();
        }
    }
    /**
     * Sets the transactions for the block
     * @param transactions Transactions to set
     * @returns Promise<this> This block builder instance
     */
    async setTransactions(transactions) {
        const release = await this.mutex.acquire();
        try {
            // Validate input
            if (!Array.isArray(transactions)) {
                throw new BlockError("Invalid transactions array");
            }
            // Check transaction limit
            if (transactions.length > BlockBuilder.MAX_TRANSACTIONS) {
                throw new BlockError(`Too many transactions: ${transactions.length}/${BlockBuilder.MAX_TRANSACTIONS}`);
            }
            // Validate each transaction
            for (const tx of transactions) {
                if (!tx.id || !tx.sender || !tx.timestamp) {
                    throw new BlockError(`Invalid transaction structure: ${tx.id}`);
                }
                // Check transaction age
                const txAge = Date.now() - tx.timestamp;
                if (txAge > this.maxTransactionAge) {
                    throw new BlockError(`Transaction too old: ${tx.id}`);
                }
            }
            // Check for duplicate transactions
            const txIds = new Set();
            for (const tx of transactions) {
                if (txIds.has(tx.id)) {
                    throw new BlockError(`Duplicate transaction found: ${tx.id}`);
                }
                txIds.add(tx.id);
            }
            // Calculate total size and fees
            let totalSize = 0;
            let totalFees = BigInt(0);
            for (const tx of transactions) {
                totalSize += JSON.stringify(tx).length;
                totalFees += BigInt(tx.fee);
            }
            // Update block header and transaction list
            try {
                // Create new array to prevent external mutations
                this.transactions = [...transactions];
                // Update merkle root
                this.header.merkleRoot = await this.calculateMerkleRoot();
                // Update block metadata
                this.header.fees = Number(totalFees);
                // Log transaction addition
                shared_1.Logger.info(`Added ${transactions.length} transactions to block. Total fees: ${totalFees}`);
                await this.auditManager?.log(audit_1.AuditEventType.TRANSACTIONS_ADDED, {
                    blockHeight: this.header.height,
                    transactionCount: transactions.length,
                    totalFees,
                    merkleRoot: this.header.merkleRoot,
                    severity: audit_1.AuditSeverity.INFO,
                });
                return this;
            }
            catch (error) {
                shared_1.Logger.error("Failed to update block with transactions:", error);
                throw new BlockError("Failed to update block with transactions");
            }
        }
        catch (error) {
            shared_1.Logger.error("Transaction validation failed:", error);
            if (error instanceof BlockError) {
                throw error;
            }
            throw new BlockError(error instanceof Error ? error.message : "Failed to set transactions");
        }
        finally {
            release();
        }
    }
    async calculateHash() {
        try {
            // Validate header fields before hashing
            if (!this.header ||
                !this.header.previousHash ||
                !this.header.merkleRoot) {
                throw new BlockError("Invalid block header");
            }
            // Performance tracking
            const startTime = Date.now();
            // Create header string with ordered fields for consistent hashing
            const headerString = JSON.stringify({
                ...this.header,
                timestamp: this.header.timestamp,
                nonce: this.header.nonce,
            });
            // Use HybridCrypto for quantum-resistant hashing
            const hash = await crypto_1.HybridCrypto.hash(headerString);
            // Log performance metrics
            shared_1.Logger.debug(`Block hash calculation took ${Date.now() - startTime}ms`);
            return hash;
        }
        catch (error) {
            shared_1.Logger.error("Failed to calculate block hash:", error);
            throw new BlockError(error instanceof Error
                ? error.message
                : "Failed to calculate block hash");
        }
    }
    async build(minerKeyPair) {
        try {
            // Validate required block components
            if (!this.header.merkleRoot) {
                this.header.merkleRoot = await this.calculateMerkleRoot();
            }
            if (!this.header.validatorMerkleRoot && this.validators.length > 0) {
                const validatorHashes = this.validators.map((v) => v.address);
                this.header.validatorMerkleRoot = await this.merkleTree.createRoot(validatorHashes);
            }
            // Calculate final block hash
            const hash = await this.calculateHash();
            this.header.hash = hash;
            // Calculate total fees and rewards
            const totalFees = this.transactions.reduce((sum, tx) => sum + Number(tx.fee), 0);
            this.header.fees = totalFees;
            // Sign the block before finalizing
            const headerString = JSON.stringify(this.header);
            this.header.signature = await crypto_1.HybridCrypto.sign(headerString, minerKeyPair);
            // Build final block object with all components
            const block = {
                header: {
                    ...this.header,
                    timestamp: this.header.timestamp || Date.now(), // Ensure timestamp exists
                },
                transactions: [...this.transactions],
                hash,
                votes: [...this.votes],
                validators: [...this.validators],
                metadata: {
                    receivedTimestamp: Date.now(),
                    consensusMetrics: {
                        powWeight: this.header.consensusData.powScore,
                        votingWeight: this.header.consensusData.votingScore,
                        participationRate: this.header.consensusData.participationRate,
                    },
                },
                timestamp: this.header.timestamp || Date.now(),
                verifyHash: async () => this.verifyHash(),
                verifySignature: async () => this.verifySignature(),
                getHeaderBase: () => this.getHeaderBase(),
                isComplete: () => this.isComplete(),
            };
            // Validate final block structure
            this.validateBlockStructure(block);
            return block;
        }
        catch (error) {
            shared_1.Logger.error("Failed to build block:", error);
            throw new BlockError(error instanceof Error ? error.message : "Failed to build block");
        }
    }
    // Helper method to validate block structure
    validateBlockStructure(block) {
        if (!block.hash || !block.header || !Array.isArray(block.transactions)) {
            throw new BlockError("Invalid block structure");
        }
        // Validate header fields
        const requiredFields = [
            "version",
            "height",
            "previousHash",
            "timestamp",
            "merkleRoot",
            "difficulty",
            "nonce",
            "miner",
        ];
        for (const field of requiredFields) {
            if (!(field in block.header)) {
                throw new BlockError(`Missing required header field: ${field}`);
            }
        }
        // Validate consensus data
        if (block.header.consensusData.powScore < 0 ||
            block.header.consensusData.votingScore < 0 ||
            block.header.consensusData.participationRate < 0 ||
            block.header.consensusData.participationRate > 1) {
            throw new BlockError("Invalid consensus data values");
        }
    }
    setHeight(height) {
        if (height < 0 || !Number.isInteger(height)) {
            throw new BlockError("Invalid block height");
        }
        this.header.height = height;
        return this;
    }
    setPreviousHash(hash) {
        this.header.previousHash = hash;
        return this;
    }
    setTimestamp(timestamp) {
        const now = Date.now();
        const oneHourInFuture = now + (60 * 60 * 1000);
        const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
        // Validate timestamp is not in the future (with small tolerance)
        if (timestamp > oneHourInFuture) {
            throw new BlockError("Block timestamp cannot be in the future");
        }
        // Validate timestamp is not too old
        if (timestamp < oneYearAgo) {
            throw new BlockError("Block timestamp is too old");
        }
        // Validate timestamp is a valid number
        if (!Number.isFinite(timestamp) || timestamp <= 0) {
            throw new BlockError("Invalid timestamp value");
        }
        this.header.timestamp = timestamp;
        return this;
    }
    async verifyHash() {
        try {
            const calculatedHash = await this.calculateHash();
            return calculatedHash === this.hash;
        }
        catch (error) {
            shared_1.Logger.error("Hash verification failed:", error);
            return false;
        }
    }
    async verifySignature() {
        return crypto_1.HybridCrypto.verify(this.header.hash, this.header.signature, {
            address: this.header.publicKey,
        });
    }
    getHeaderBase() {
        return (this.header.version +
            this.header.previousHash +
            this.header.merkleRoot +
            this.header.timestamp +
            this.header.difficulty +
            this.header.nonce +
            this.header.miner);
    }
    setVersion(version) {
        this.header.version = version;
        return this;
    }
    setMerkleRoot(merkleRoot) {
        this.header.merkleRoot = merkleRoot;
        return this;
    }
    setDifficulty(difficulty) {
        this.header.difficulty = difficulty;
        return this;
    }
    setNonce(nonce) {
        this.header.nonce = nonce;
        return this;
    }
    isComplete() {
        return !!(this.hash &&
            this.header &&
            this.transactions?.length >= 0 &&
            this.header.merkleRoot &&
            this.header.timestamp &&
            this.header.nonce);
    }
    setHash(hash) {
        this.hash = hash;
        return this;
    }
}
exports.BlockBuilder = BlockBuilder;
BlockBuilder.CURRENT_VERSION = 1;
BlockBuilder.MAX_TRANSACTIONS = 2000;
BlockBuilder.MIN_DIFFICULTY = 1;
//# sourceMappingURL=block.model.js.map