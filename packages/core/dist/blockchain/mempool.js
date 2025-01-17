"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mempool = void 0;
const transaction_model_1 = require("../models/transaction.model");
const shared_1 = require("@h3tag-blockchain/shared");
const hybrid_direct_1 = require("./consensus/hybrid-direct");
const health_1 = require("../monitoring/health");
const audit_1 = require("../security/audit");
const audit_2 = require("../security/audit");
const fileAuditStorage_1 = require("../security/fileAuditStorage");
const async_mutex_1 = require("async-mutex");
const cache_1 = require("../scaling/cache");
const transaction_model_2 = require("../models/transaction.model");
const constants_1 = require("./utils/constants");
const ddos_1 = require("../security/ddos");
/**
 * Mempool class for managing unconfirmed transactions
 * @class
 * @description Handles transaction queuing, validation, and fee-based prioritization
 */
class Mempool {
    constructor(blockchain) {
        // Add missing required properties with defaults
        this.MAX_ANCESTORS = 25;
        this.MAX_DESCENDANTS = 25;
        this.RBF_INCREMENT = 1.1;
        this.maxSize = 50000;
        this.maxTransactionAge = 72 * 60 * 60 * 1000; // 72 hours
        this.cache = new cache_1.Cache({
            ttl: 300000,
            maxSize: 1000,
            onEvict: (key, value) => {
                try {
                    // Clear the map
                    value.clear();
                    // Log eviction event
                    shared_1.Logger.debug("Cache entry evicted", {
                        key,
                        valueSize: value.size,
                        timestamp: Date.now(),
                    });
                    // Trigger garbage collection if needed
                    if (process.memoryUsage().heapUsed > 1024 * 1024 * 512) {
                        // 512MB
                        global.gc?.();
                    }
                }
                catch (error) {
                    shared_1.Logger.error("Cache eviction error:", {
                        key,
                        error: error instanceof Error ? error.message : "Unknown error",
                    });
                }
            },
        });
        this.AUDIT_DIR = "./audit-logs";
        this.reputationMutex = new async_mutex_1.Mutex();
        this.performanceMonitor = {
            start: (label) => {
                const startTime = performance.now();
                const startMemory = process.memoryUsage().heapUsed;
                shared_1.Logger.debug("Performance monitoring started", {
                    label,
                    startTime,
                    startMemory,
                });
                return {
                    label,
                    startTime,
                    startMemory,
                };
            },
            end: (marker) => {
                const endTime = performance.now();
                const endMemory = process.memoryUsage().heapUsed;
                const duration = endTime - marker.startTime;
                const memoryDiff = endMemory - marker.startMemory;
                shared_1.Logger.debug("Performance monitoring ended", {
                    label: marker.label,
                    duration: `${duration.toFixed(2)}ms`,
                    memoryUsed: `${(memoryDiff / 1024 / 1024).toFixed(2)}MB`,
                    totalHeap: `${(endMemory / 1024 / 1024).toFixed(2)}MB`,
                });
            },
        };
        this.powCache = new cache_1.Cache({
            ttl: 300000,
            maxSize: 1000,
        });
        // Add new constants for absence penalties
        this.VALIDATOR_PENALTIES = {
            MISSED_VALIDATION: -5,
            MISSED_VOTE: -3,
            CONSECUTIVE_MISS_MULTIPLIER: 1.5,
            MAX_CONSECUTIVE_MISSES: 3,
        };
        // Add tracking for consecutive misses
        this.consecutiveMisses = new Map();
        // Track active and backup validators
        this.activeValidators = new Map();
        this.lastChangeTimestamp = Date.now();
        this.mempoolStateCache = new Map();
        this.transactionMutexes = new Map();
        this.lastValidFee = constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_FEE_RATE;
        this.size = 0;
        this.bytes = 0;
        this.usage = 0;
        this.SCRIPT_OPCODES = {
            // Stack operations
            OP_0: 0x00,
            OP_PUSHDATA1: 0x4c,
            OP_PUSHDATA2: 0x4d,
            OP_PUSHDATA4: 0x4e,
            OP_1: 0x51,
            OP_16: 0x60,
            // Flow control
            OP_IF: 0x63,
            OP_ELSE: 0x67,
            OP_ENDIF: 0x68,
            OP_VERIFY: 0x69,
            OP_RETURN: 0x6a,
            // Crypto
            OP_HASH160: 0xa9,
            OP_CHECKSIG: 0xac,
            OP_CHECKMULTISIG: 0xae,
        };
        this.blockchain = blockchain;
        this.transactions = new Map();
        this.feeRateBuckets = new Map();
        this.ancestorMap = new Map();
        this.descendantMap = new Map();
        this.consensus = new hybrid_direct_1.HybridDirectConsensus(this.blockchain);
        this.reputationSystem = new Map();
        this.lastVoteHeight = new Map();
        this.voteCounter = new Map();
        // Initialize fee rate buckets
        this.initializeFeeRateBuckets();
        this.healthMonitor = new health_1.HealthMonitor({
            interval: 60000,
            thresholds: {
                minPowNodes: 3,
                minPowHashrate: 1000000,
                minTagDistribution: 0.1,
                maxTagConcentration: 0.25,
            },
        });
        this.auditManager = new audit_2.AuditManager(new fileAuditStorage_1.FileAuditStorage({
            baseDir: this.AUDIT_DIR,
            compression: true,
            maxRetries: 3,
            retryDelay: 1000,
            maxConcurrentWrites: 5,
        }));
        // Initialize vote tracking
        this.initializeVoteTracking();
        // Start periodic cleanup
        this.initializeCleanupInterval();
        // Initialize DDoS protection
        this.ddosProtection = new ddos_1.DDoSProtection({
            maxRequests: {
                default: 150,
                pow: 100,
                qudraticVote: 100,
            },
            windowMs: 60000,
            blockDuration: 1200000, // 20 minutes
        }, this.auditManager);
        // Note: Call mempool.initialize() after construction
    }
    /**
     * Initializes the mempool and its dependencies.
     * Must be called after construction and before using the mempool.
     */
    async initialize() {
        try {
            await this.auditManager.initialize();
            shared_1.Logger.info("Mempool initialized successfully");
        }
        catch (error) {
            shared_1.Logger.error("Failed to initialize mempool:", error);
            throw error;
        }
    }
    async initializeVoteTracking() {
        // Load reputation data
        const reputationData = await this.loadReputationData();
        for (const [address, reputation] of reputationData) {
            this.reputationSystem.set(address, reputation);
        }
        // Reset vote counters periodically
        setInterval(() => {
            this.voteCounter.clear();
        }, constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.RATE_LIMIT_WINDOW * 1000);
    }
    async validateVoteEligibility(address) {
        try {
            const currentHeight = this.blockchain.getCurrentHeight();
            const accountAge = await this.getAccountAge(address);
            const reputation = this.reputationSystem.get(address) || 0;
            const lastVoteHeight = this.lastVoteHeight.get(address) || 0;
            const votesInWindow = this.voteCounter.get(address) || 0;
            // Add PoW validation using consensus mechanism
            const hasValidPoW = await this.consensus.pow.validateWork(address, constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_POW_CONTRIBUTION);
            // Check all requirements including PoW validation
            return (accountAge >= constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_ACCOUNT_AGE &&
                hasValidPoW &&
                reputation >=
                    constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.REPUTATION_THRESHOLD &&
                currentHeight - lastVoteHeight >=
                    constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.COOLDOWN_BLOCKS &&
                votesInWindow <
                    constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTES_PER_WINDOW);
        }
        catch (error) {
            shared_1.Logger.error("Error validating vote eligibility:", error);
            return false;
        }
    }
    async updateVoteTracking(address) {
        const currentHeight = this.blockchain.getCurrentHeight();
        this.lastVoteHeight.set(address, currentHeight);
        this.voteCounter.set(address, (this.voteCounter.get(address) || 0) + 1);
    }
    async addTransaction(transaction) {
        const mutex = this.getMutexForTransaction(transaction.id);
        const release = await mutex.acquire();
        let timeoutId;
        try {
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error("Transaction processing timeout")), 30000);
            });
            return await Promise.race([
                this.processTransaction(transaction),
                timeoutPromise,
            ]);
        }
        finally {
            clearTimeout(timeoutId);
            release();
        }
    }
    async processTransaction(transaction) {
        // Check network health
        const health = await this.healthMonitor.getNetworkHealth();
        if (!health.isHealthy) {
            await this.auditManager.log(audit_1.AuditEventType.MEMPOOL_HEALTH_CHECK_FAILED, {
                health,
                severity: audit_1.AuditSeverity.HIGH,
            });
            return false;
        }
        // Validate transaction size and fees
        if (!this.validateTransactionSize(transaction)) {
            shared_1.Logger.warn(`Transaction ${transaction.id} failed size validation`);
            return false;
        }
        // Validate UTXO inputs for double-spending
        const inputsValid = await this.validateTransactionInputs(transaction);
        if (!inputsValid) {
            shared_1.Logger.warn(`Transaction ${transaction.id} failed UTXO validation`);
            return false;
        }
        // Process the transaction based on type
        switch (transaction.type) {
            case transaction_model_1.TransactionType.QUADRATIC_VOTE:
                const isEligible = await this.validateVoteEligibility(transaction.sender);
                if (!isEligible)
                    return false;
                await this.handleVoteTransaction(transaction);
                await this.updateVoteTracking(transaction.sender);
                return true;
            case transaction_model_1.TransactionType.POW_REWARD:
                const isValidPoW = await this.consensus.pow.validateReward(transaction, this.blockchain.getCurrentHeight());
                if (!isValidPoW)
                    return false;
                break;
            default:
                const isValid = await this.validateTransaction(transaction, await this.blockchain.getUTXOSet(), this.blockchain.getCurrentHeight());
                if (!isValid)
                    return false;
        }
        // RBF and ancestry checks
        const rbfAccepted = await this.handleRBF(transaction);
        if (!rbfAccepted)
            return false;
        if (!this.checkAncestryLimits(transaction))
            return false;
        this.addToMempool(transaction);
        return true;
    }
    async handleVoteTransaction(vote) {
        // Add DDoS protection for vote transactions
        if (!this.ddosProtection.checkRequest("vote_tx", vote.sender)) {
            shared_1.Logger.warn(`DDoS protection blocked vote from ${vote.sender}`);
            return;
        }
        try {
            // Get UTXO set
            const utxoSet = await this.blockchain.getUTXOSet();
            // Find eligible voting UTXOs for the sender
            const votingUtxos = await utxoSet.findUtxosForVoting(vote.sender);
            if (votingUtxos.length === 0) {
                shared_1.Logger.warn("No eligible UTXOs for voting");
                return;
            }
            // Calculate voting power using quadratic voting
            const votingPower = utxoSet.calculateVotingPower(votingUtxos);
            if (votingPower <= BigInt(0)) {
                shared_1.Logger.warn("Insufficient voting power");
                return;
            }
            // Create vote transaction with UTXO references
            const voteTransaction = {
                ...vote,
                voteData: {
                    proposal: vote.id,
                    vote: true,
                    weight: Number(votingPower),
                },
            };
            // Add to mempool with high priority
            const success = await this.addTransaction(voteTransaction);
            if (success) {
                await this.auditManager.log(audit_1.AuditEventType.VOTE_TRANSACTION_ADDED, {
                    sender: vote.sender,
                    votingPower: votingPower.toString(),
                    utxoCount: votingUtxos.length,
                    severity: audit_1.AuditSeverity.INFO,
                });
            }
        }
        catch (error) {
            shared_1.Logger.error("Error handling vote transaction:", error);
            await this.auditManager.log(audit_1.AuditEventType.VOTE_TRANSACTION_FAILED, {
                error: error.message,
                severity: audit_1.AuditSeverity.ERROR,
            });
        }
    }
    /**
     * Retrieves a transaction by its ID
     * @param {string} txId - Transaction ID to lookup
     * @returns {Transaction | undefined} Transaction if found, undefined otherwise
     * @throws {Error} If there's an error accessing the mempool
     */
    getTransaction(txId) {
        // Add DDoS protection for transaction lookups
        if (!this.ddosProtection.checkRequest("get_tx", this.node.getAddress())) {
            shared_1.Logger.warn("DDoS protection blocked transaction lookup");
            return undefined;
        }
        try {
            if (!txId) {
                shared_1.Logger.warn("Invalid transaction ID requested");
                return undefined;
            }
            const tx = this.transactions.get(txId);
            shared_1.Logger.debug(`Transaction ${txId} ${tx ? "found" : "not found"} in mempool`);
            return tx;
        }
        catch (error) {
            shared_1.Logger.error("Error retrieving transaction:", error);
            return undefined;
        }
    }
    /**
     * Checks if a transaction exists in the mempool
     * @param {string} txId - Transaction ID to check
     * @returns {boolean} True if transaction exists, false otherwise
     */
    hasTransaction(txId) {
        try {
            if (!txId) {
                shared_1.Logger.warn("Invalid transaction ID checked");
                return false;
            }
            return this.transactions.has(txId);
        }
        catch (error) {
            shared_1.Logger.error("Error checking transaction existence:", error);
            return false;
        }
    }
    /**
     * Gets the current size of the mempool
     * @returns {number} Number of transactions in mempool
     */
    getSize() {
        try {
            const size = this.transactions.size;
            shared_1.Logger.debug(`Current mempool size: ${size}`);
            return size;
        }
        catch (error) {
            shared_1.Logger.error("Error getting mempool size:", error);
            return 0;
        }
    }
    /**
     * Clears all transactions from the mempool
     * @throws {Error} If clearing the mempool fails
     */
    clear() {
        try {
            const previousSize = this.transactions.size;
            this.transactions.clear();
            this.feeRateBuckets.clear();
            this.ancestorMap.clear();
            this.descendantMap.clear();
            shared_1.Logger.info(`Mempool cleared. Previous size: ${previousSize}`);
        }
        catch (error) {
            shared_1.Logger.error("Error clearing mempool:", error);
            throw new Error("Failed to clear mempool");
        }
    }
    /**
     * Retrieves pending transactions based on criteria
     * @param {Object} options - Filter options
     * @param {number} [options.limit] - Maximum number of transactions to return
     * @param {number} [options.minFeeRate] - Minimum fee rate in sat/byte
     * @returns {Promise<Transaction[]>} Array of pending transactions
     */
    async getPendingTransactions(options = {}) {
        try {
            const { limit, minFeeRate } = options;
            let transactions = Array.from(this.transactions.values());
            // Apply fee rate filter if specified
            if (minFeeRate !== undefined) {
                transactions = transactions.filter((tx) => this.calculateFeePerByte(tx) >= minFeeRate);
            }
            // Sort by fee rate (highest first)
            transactions.sort((a, b) => this.calculateFeePerByte(b) - this.calculateFeePerByte(a));
            // Apply limit if specified
            if (limit !== undefined) {
                transactions = transactions.slice(0, limit);
            }
            shared_1.Logger.debug(`Retrieved ${transactions.length} pending transactions`);
            return transactions;
        }
        catch (error) {
            shared_1.Logger.error("Error retrieving pending transactions:", error);
            throw new Error("Failed to retrieve pending transactions");
        }
    }
    /**
     * Estimates transaction fee based on mempool state
     * @param {number} targetBlocks - Target number of blocks for confirmation
     * @returns {number} Estimated fee rate in TAG satoshis/byte
     */
    estimateFee(targetBlocks) {
        let totalFeeRate = 0;
        let count = 0;
        // Calculate average fee rate from recent transactions
        for (const [rate, txs] of this.feeRateBuckets) {
            if (txs.size > 0) {
                totalFeeRate += rate * txs.size;
                count += txs.size;
            }
        }
        // Adjust based on target blocks (higher for faster confirmation)
        const baseFeeRate = count > 0 ? totalFeeRate / count : 1;
        const adjustedRate = baseFeeRate * (1 + 1 / targetBlocks);
        // Ensure minimum fee rate (0.00000001 TAG/byte)
        return Math.max(adjustedRate, 0.00000001);
    }
    /**
     * Removes transactions that are included in a block
     * @param {Transaction[]} transactions - Array of transactions to remove
     */
    removeTransactions(transactions) {
        transactions.forEach((tx) => {
            this.transactions.delete(tx.id);
        });
    }
    /**
     * Gets all UTXOs for a specific address from mempool transactions
     * @param {string} address - Address to get UTXOs for
     * @returns {UTXO[]} Array of unspent transaction outputs
     */
    getPendingUTXOsForAddress(address) {
        return Array.from(this.transactions.values()).flatMap((tx) => tx.outputs
            .filter((output) => output.address === address)
            .map((output, index) => ({
            txId: tx.id,
            outputIndex: index,
            address: output.address,
            publicKey: output.publicKey || "",
            amount: output.amount,
            script: output.script,
            timestamp: tx.timestamp,
            spent: false,
            currency: {
                name: "H3Tag",
                symbol: "TAG",
                decimals: 8,
            },
            confirmations: 0,
        })));
    }
    initializeFeeRateBuckets() {
        // Initialize fee rate buckets (in sat/byte)
        const buckets = [1, 2, 5, 10, 20, 50, 100, 200, 500];
        buckets.forEach((rate) => this.feeRateBuckets.set(rate, new Set()));
    }
    async handleRBF(newTx) {
        // Find conflicting transactions
        const conflicts = this.findConflictingTransactions(newTx);
        if (conflicts.size === 0)
            return true;
        // Check if new transaction pays sufficient fee
        const newFeeRate = this.calculateFeePerByte(newTx);
        let oldFeeRate = 0;
        for (const txId of conflicts) {
            const oldTx = this.transactions.get(txId);
            if (oldTx) {
                oldFeeRate += this.calculateFeePerByte(oldTx);
            }
        }
        // Require higher fee rate for replacement
        if (newFeeRate > oldFeeRate * this.RBF_INCREMENT) {
            // Remove replaced transactions
            conflicts.forEach((txId) => this.removeTransaction(txId));
            return true;
        }
        return false;
    }
    findConflictingTransactions(tx) {
        const conflicts = new Set();
        // Create UTXO tracking set
        const spentUTXOs = new Set();
        // Check for conflicts in the new transaction
        for (const input of tx.inputs) {
            const utxoKey = `${input.txId}:${input.outputIndex}`;
            // Check for double-spend within the same transaction
            if (spentUTXOs.has(utxoKey)) {
                conflicts.add(tx.id); // Self-conflict
                break;
            }
            spentUTXOs.add(utxoKey);
            // Check against existing mempool transactions
            this.transactions.forEach((memTx, txId) => {
                if (memTx.inputs.some((i) => i.txId === input.txId && i.outputIndex === input.outputIndex)) {
                    conflicts.add(txId);
                }
            });
        }
        return conflicts;
    }
    checkAncestryLimits(tx) {
        const ancestors = this.getAncestors(tx);
        const descendants = this.getDescendants(tx);
        return (ancestors.size <= this.MAX_ANCESTORS &&
            descendants.size <= this.MAX_DESCENDANTS);
    }
    getAncestors(tx) {
        const ancestors = new Set();
        tx.inputs.forEach((input) => {
            const parentTx = this.transactions.get(input.txId);
            if (parentTx) {
                ancestors.add(parentTx.id);
                const parentAncestors = this.ancestorMap.get(parentTx.id) || new Set();
                parentAncestors.forEach((a) => ancestors.add(a));
            }
        });
        return ancestors;
    }
    getDescendants(tx) {
        return this.descendantMap.get(tx.id) || new Set();
    }
    /**
     * Calculate fee per byte for transaction
     */
    calculateFeePerByte(transaction) {
        const size = this.calculateTransactionSize(transaction);
        if (size === 0)
            return 0;
        // Convert to BigInt for safe calculation
        const feeBI = BigInt(transaction.fee);
        const sizeBI = BigInt(size);
        // Check for overflow
        if (feeBI > Number.MAX_SAFE_INTEGER || sizeBI > Number.MAX_SAFE_INTEGER) {
            shared_1.Logger.warn("Fee calculation overflow risk", {
                txId: transaction.id,
                fee: feeBI.toString(),
                size: sizeBI.toString(),
            });
            return 0;
        }
        return Number(feeBI) / Number(sizeBI);
    }
    /**
     * Get transaction size in bytes
     */
    getTransactionSize(transaction) {
        // Rough estimation of transaction size
        const baseSize = 10; // Version, locktime, etc.
        const inputSize = transaction.inputs.length * 180; // Average input size
        const outputSize = transaction.outputs.length * 34; // Average output size
        return baseSize + inputSize + outputSize;
    }
    /**
     * Get all transactions in mempool
     */
    getTransactions() {
        return Array.from(this.transactions.values());
    }
    updateAncestryMaps(transaction) {
        // Update ancestor map
        const ancestors = this.getAncestors(transaction);
        this.ancestorMap.set(transaction.id, ancestors);
        // Update descendant map
        transaction.inputs.forEach((input) => {
            const parentTx = this.transactions.get(input.txId);
            if (parentTx) {
                const descendants = this.descendantMap.get(parentTx.id) || new Set();
                descendants.add(transaction.id);
                this.descendantMap.set(parentTx.id, descendants);
            }
        });
    }
    async updateFeeBuckets(transaction) {
        try {
            const oldBucket = this.findFeeBucket(transaction);
            if (oldBucket) {
                oldBucket.delete(transaction.id);
            }
            const feeRate = this.calculateFeePerByte(transaction);
            const newBucket = this.getOrCreateFeeBucket(feeRate);
            newBucket.add(transaction.id);
        }
        catch (error) {
            // Add cleanup
            shared_1.Logger.error("Fee bucket update failed:", error);
            await this.auditManager?.log(audit_1.AuditEventType.FEE_BUCKET_UPDATE_FAILED, {
                txId: transaction.id,
                error: error.message,
                severity: audit_1.AuditSeverity.ERROR,
            });
        }
    }
    removeTransaction(txId) {
        try {
            const tx = this.transactions.get(txId);
            if (tx) {
                this.transactions.delete(txId);
                // Clean up from fee buckets
                for (const txs of this.feeRateBuckets.values()) {
                    txs.delete(txId);
                }
                // Clean up ancestry maps
                this.ancestorMap.delete(txId);
                this.descendantMap.delete(txId);
                shared_1.Logger.debug(`Transaction ${txId} removed from mempool`);
            }
        }
        catch (error) {
            shared_1.Logger.error(`Failed to remove transaction ${txId}:`, error);
        }
    }
    async validateTransaction(transaction, utxoSet, currentHeight) {
        const perfMarker = this.performanceMonitor.start("validate_transaction");
        try {
            if (!this.validateBasicStructure(transaction)) {
                return false;
            }
            const txSize = this.getTransactionSize(transaction);
            const maxSize = await this.blockchain.getMaxTransactionSize();
            if (txSize > maxSize) {
                shared_1.Logger.warn("Transaction exceeds size limit", {
                    txId: transaction.id,
                    size: txSize,
                    maxAllowed: maxSize,
                });
                return false;
            }
            if (transaction.version !== constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.CURRENT_VERSION) {
                shared_1.Logger.warn("Invalid transaction version", {
                    txId: transaction.id,
                    version: transaction.version,
                    required: constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.CURRENT_VERSION,
                });
                return false;
            }
            const now = Date.now();
            if (transaction.timestamp > now + 7200000) {
                // 2 hours in future
                shared_1.Logger.warn("Transaction timestamp too far in future", {
                    txId: transaction.id,
                    timestamp: transaction.timestamp,
                    currentTime: now,
                });
                return false;
            }
            if (!(await transaction_model_2.TransactionBuilder.verify(transaction))) {
                shared_1.Logger.warn("Core transaction verification failed", {
                    txId: transaction.id,
                });
                return false;
            }
            if (!(await this.validateUTXOs(transaction, utxoSet))) {
                return false;
            }
            if (!(await this.validateMempoolState(transaction, utxoSet))) {
                return false;
            }
            // Add PoW validation for specific transaction types
            if (transaction.type === transaction_model_1.TransactionType.POW_REWARD) {
                const powContribution = await this.getPowContribution(transaction.sender);
                // Check coinbase maturity (100 blocks)
                if (currentHeight < constants_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_BLOCKS_MINED) {
                    shared_1.Logger.warn("Coinbase not yet mature", {
                        txId: transaction.id,
                        currentHeight,
                        requiredMaturity: constants_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_BLOCKS_MINED,
                    });
                    return false;
                }
                if (powContribution <= 0) {
                    shared_1.Logger.warn("Invalid PoW contribution", { txId: transaction.id });
                    return false;
                }
            }
            if (transaction.type === transaction_model_1.TransactionType.QUADRATIC_VOTE) {
                const votingWeight = await this.getVotingContribution(transaction.sender);
                if (votingWeight <= 0) {
                    shared_1.Logger.warn("Invalid voting weight", { txId: transaction.id });
                    return false;
                }
            }
            shared_1.Logger.debug("Transaction validation successful", {
                txId: transaction.id,
                size: txSize,
                inputs: transaction.inputs.length,
                outputs: transaction.outputs.length,
            });
            return true;
        }
        catch (error) {
            shared_1.Logger.error("Transaction validation failed:", {
                txId: transaction?.id,
                error: error.message,
                stack: error.stack,
            });
            await this.auditManager.log(audit_1.AuditEventType.TRANSACTION_VALIDATION_FAILED, {
                txId: transaction?.id,
                error: error.message,
                severity: audit_1.AuditSeverity.ERROR,
            });
            return false;
        }
        finally {
            if (typeof perfMarker !== "undefined") {
                this.performanceMonitor.end(perfMarker);
            }
        }
    }
    validateBasicStructure(tx) {
        return !!(tx &&
            tx.id &&
            tx.version &&
            Array.isArray(tx.inputs) &&
            Array.isArray(tx.outputs) &&
            tx.inputs.length > 0 &&
            tx.outputs.length > 0 &&
            tx.inputs.length <= constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_INPUTS &&
            tx.outputs.length <= constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_OUTPUTS);
    }
    async validateUTXOs(tx, utxoSet) {
        try {
            for (const input of tx.inputs) {
                const utxo = await utxoSet.get(input.txId, input.outputIndex);
                if (!utxo || utxo.spent) {
                    shared_1.Logger.warn("Invalid or spent UTXO", {
                        txId: tx.id,
                        utxoId: input.txId,
                        outputIndex: input.outputIndex,
                    });
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            shared_1.Logger.error("UTXO validation error:", error);
            return false;
        }
    }
    async validateMempoolState(transaction, utxoSet) {
        try {
            // 1. Fee requirements
            const txSize = this.getTransactionSize(transaction);
            const feeRate = this.calculateFeePerByte(transaction);
            const minFeeRate = constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MIN_FEE;
            if (feeRate < minFeeRate) {
                shared_1.Logger.warn("Insufficient fee rate", {
                    txId: transaction.id,
                    feeRate: feeRate.toString(),
                    minRequired: minFeeRate.toString(),
                    size: txSize,
                });
                return false;
            }
            // Dynamic fee requirements during high congestion
            if (this.transactions.size >
                constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.HIGH_CONGESTION_THRESHOLD) {
                const dynamicMinFee = this.calculateDynamicMinFee();
                if (feeRate < dynamicMinFee) {
                    shared_1.Logger.warn("Fee too low during high congestion", {
                        txId: transaction.id,
                        feeRate: feeRate.toString(),
                        requiredRate: dynamicMinFee.toString(),
                    });
                    return false;
                }
            }
            // 1. Check for double-spend within mempool
            for (const input of transaction.inputs) {
                const isDoubleSpend = Array.from(this.transactions.values()).some((tx) => tx.inputs.some((i) => i.txId === input.txId && i.outputIndex === input.outputIndex));
                if (isDoubleSpend) {
                    shared_1.Logger.warn("Double-spend detected in mempool", {
                        txId: transaction.id,
                    });
                    return false;
                }
            }
            // 2. Check mempool size limits
            if (this.transactions.size >=
                constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MAX_SIZE) {
                const minFeeRate = this.estimateFee(1);
                const txFeeRate = this.calculateFeePerByte(transaction);
                if (txFeeRate < minFeeRate) {
                    shared_1.Logger.warn("Fee too low for full mempool", {
                        txId: transaction.id,
                        feeRate: txFeeRate,
                        minFeeRate,
                    });
                    return false;
                }
            }
            // 3. Check ancestry limits
            if (!this.checkAncestryLimits(transaction)) {
                shared_1.Logger.warn("Transaction exceeds ancestry limits", {
                    txId: transaction.id,
                });
                return false;
            }
            // 4. Validate UTXO availability
            for (const input of transaction.inputs) {
                const utxo = await utxoSet.get(input.txId, input.outputIndex);
                if (!utxo || utxo.spent) {
                    shared_1.Logger.warn("UTXO not found or spent", {
                        txId: transaction.id,
                        inputTxId: input.txId,
                    });
                    return false;
                }
            }
            // 5. Check transaction age
            if (Date.now() - transaction.timestamp > this.maxTransactionAge) {
                shared_1.Logger.warn("Transaction too old", { txId: transaction.id });
                return false;
            }
            return true;
        }
        catch (error) {
            shared_1.Logger.error("Mempool state validation failed:", error);
            return false;
        }
    }
    calculateDynamicMinFee() {
        try {
            // Get current mempool metrics
            const currentSize = this.transactions.size;
            const maxSize = constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MAX_SIZE;
            const baseMinFee = constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_FEE_RATE;
            // Calculate congestion levels
            const congestionFactor = currentSize / maxSize;
            // Progressive fee scaling based on congestion levels
            let multiplier;
            if (congestionFactor <= 0.5) {
                multiplier = 1;
            }
            else if (congestionFactor <= 0.75) {
                multiplier = 1 + (congestionFactor - 0.5) * 2;
            }
            else if (congestionFactor <= 0.9) {
                multiplier = 2 + Math.pow(congestionFactor - 0.75, 2) * 8;
            }
            else {
                multiplier = 4 + Math.pow(congestionFactor - 0.9, 2) * 16;
            }
            // Calculate final fee rate with safety bounds
            const dynamicFee = Math.floor(baseMinFee * multiplier);
            const maxFee = baseMinFee * 20; // Cap at 20x base fee
            shared_1.Logger.debug("Dynamic fee calculation", {
                congestion: `${(congestionFactor * 100).toFixed(2)}%`,
                multiplier: multiplier.toFixed(2),
                baseFee: baseMinFee,
                dynamicFee,
            });
            return Math.min(dynamicFee, maxFee);
        }
        catch (error) {
            shared_1.Logger.error("Dynamic fee calculation failed:", error);
            // Add audit log for fee calculation failure
            this.auditManager?.log(audit_1.AuditEventType.FEE_CALCULATION_FAILED, {
                error: error.message,
                severity: audit_1.AuditSeverity.ERROR,
            });
            // Use a more reasonable fallback
            return Math.max(constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_FEE_RATE, this.lastValidFee ||
                constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_FEE_RATE * 2);
        }
    }
    addToMempool(transaction) {
        this.transactions.set(transaction.id, transaction);
        this.updateAncestryMaps(transaction);
        this.updateFeeBuckets(transaction);
    }
    removeOldTransactions() {
        try {
            const now = Date.now();
            let removedCount = 0;
            for (const [txId, tx] of this.transactions) {
                if (now - tx.timestamp > this.maxTransactionAge) {
                    this.removeTransaction(txId);
                    removedCount++;
                }
            }
            if (removedCount > 0) {
                shared_1.Logger.info(`Removed ${removedCount} expired transactions from mempool`);
                this.auditManager?.log(audit_1.AuditEventType.OLD_TRANSACTIONS_REMOVED, {
                    count: removedCount,
                    timestamp: now,
                    severity: audit_1.AuditSeverity.INFO,
                });
            }
        }
        catch (error) {
            shared_1.Logger.error("Failed to remove old transactions:", error);
        }
    }
    async dispose() {
        try {
            clearInterval(this.cleanupInterval);
            // Clear all caches
            this.cache.clear();
            this.powCache.clear();
            this.mempoolStateCache.clear();
            // Clear all maps
            this.transactions.clear();
            this.feeRateBuckets.clear();
            this.ancestorMap.clear();
            this.descendantMap.clear();
            this.consecutiveMisses.clear();
            this.activeValidators.clear();
            // Clear all mutexes
            for (const mutex of this.transactionMutexes.values()) {
                try {
                    const release = await mutex.acquire();
                    release();
                }
                catch (error) {
                    shared_1.Logger.warn("Failed to clean up mutex:", error);
                }
            }
            this.transactionMutexes.clear();
            await this.consensus?.dispose();
            await this.healthMonitor?.dispose();
            await this.ddosProtection?.dispose();
        }
        catch (error) {
            shared_1.Logger.error("Error during mempool disposal:", error);
            throw error;
        }
    }
    async getAccountAge(address) {
        try {
            const firstTx = await this.blockchain.getFirstTransactionForAddress(address);
            if (!firstTx)
                return 0;
            const currentHeight = await this.blockchain.getCurrentHeight();
            return currentHeight - firstTx.blockHeight;
        }
        catch (error) {
            shared_1.Logger.error("Error getting account age:", error);
            return 0;
        }
    }
    async getPowContribution(address) {
        try {
            const cacheKey = `pow_contribution:${address}`;
            const cached = this.powCache.get(cacheKey);
            if (cached !== undefined)
                return cached;
            // Validate PoW work with retries
            const maxRetries = 3;
            let retryCount = 0;
            let contribution = 0;
            while (retryCount < maxRetries) {
                try {
                    const isValid = await this.consensus.pow.validateWork(address, 0);
                    contribution = isValid ? 1 : 0;
                    break;
                }
                catch (error) {
                    retryCount++;
                    if (retryCount === maxRetries)
                        throw error;
                    await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
                }
            }
            // Cache result for 5 minutes
            this.powCache.set(cacheKey, contribution, { ttl: 300000 });
            // Log for monitoring
            await this.auditManager.log(audit_1.AuditEventType.POW_CONTRIBUTION_CHECKED, {
                address,
                contribution,
                retries: retryCount,
                severity: audit_1.AuditSeverity.INFO,
            });
            return contribution;
        }
        catch (error) {
            shared_1.Logger.error("Error getting PoW contribution:", error);
            await this.auditManager.log(audit_1.AuditEventType.POW_CONTRIBUTION_FAILED, {
                address,
                error: error.message,
                severity: audit_1.AuditSeverity.ERROR,
            });
            return 0;
        }
    }
    async loadReputationData() {
        const perfMarker = this.performanceMonitor.start("load_reputation_data");
        try {
            const cacheKey = "validator_reputation";
            const cached = this.cache.get(cacheKey);
            if (cached)
                return cached;
            const reputationData = new Map();
            const validators = await this.blockchain.db.getValidators();
            for (const validator of validators) {
                // Calculate reputation score based on multiple factors
                const reputation = await this.calculateValidatorReputation(validator);
                reputationData.set(validator.address, reputation);
            }
            // Cache results for 5 minutes
            this.cache.set(cacheKey, reputationData, { ttl: 300000 });
            // Log metrics
            await this.auditManager.log(audit_1.AuditEventType.REPUTATION_DATA_LOADED, {
                validatorCount: validators.length,
                timestamp: Date.now(),
                severity: audit_1.AuditSeverity.INFO,
            });
            return reputationData;
        }
        catch (error) {
            shared_1.Logger.error("Failed to load reputation data:", error);
            await this.auditManager.log(audit_1.AuditEventType.REPUTATION_LOAD_FAILED, {
                error: error.message,
                severity: audit_1.AuditSeverity.ERROR,
            });
            return new Map();
        }
        finally {
            if (typeof perfMarker !== "undefined") {
                this.performanceMonitor.end(perfMarker);
            }
        }
    }
    async calculateValidatorReputation(validator) {
        try {
            // Get historical performance data
            const uptime = await this.blockchain.db.getValidatorUptime(validator.address);
            const voteParticipation = await this.blockchain.db.getVoteParticipation(validator.address);
            const blockProduction = await this.blockchain.db.getBlockProduction(validator.address);
            const slashingHistory = await this.blockchain.db.getSlashingHistory(validator.address);
            // Calculate weighted reputation score
            let reputation = 100; // Base score
            // Uptime impact (30%)
            reputation += uptime * 30 - 30;
            // Vote participation impact (25%)
            reputation += voteParticipation * 25 - 25;
            // Block production impact (25%)
            reputation += blockProduction * 25 - 25;
            // Slashing penalties (20% max penalty)
            const slashingPenalty = Math.min(slashingHistory.length * 5, 20);
            reputation -= slashingPenalty;
            // Ensure reputation stays within bounds
            return Math.max(0, Math.min(100, reputation));
        }
        catch (error) {
            shared_1.Logger.error(`Failed to calculate reputation for ${validator.address}:`, error);
            return 0;
        }
    }
    // Method to update validator reputation
    async updateValidatorReputation(validatorAddress, reputationChange, reason) {
        const release = await this.reputationMutex.acquire();
        try {
            // Get current reputation
            const currentReputation = this.reputationSystem.get(validatorAddress) || 0;
            const newReputation = Math.max(0, Math.min(100, currentReputation + reputationChange));
            // Update in-memory state
            this.reputationSystem.set(validatorAddress, newReputation);
            // Persist to database
            await this.blockchain.db.updateValidatorReputation(validatorAddress, {
                reputation: newReputation,
                lastUpdate: Date.now(),
                reason,
                change: reputationChange,
            });
            // Clear cache
            this.cache.delete("validator_reputation");
            // Audit trail
            await this.auditManager.log(audit_1.AuditEventType.REPUTATION_UPDATED, {
                validator: validatorAddress,
                oldReputation: currentReputation,
                newReputation,
                reason,
                change: reputationChange,
                severity: audit_1.AuditSeverity.INFO,
            });
            return true;
        }
        catch (error) {
            shared_1.Logger.error("Failed to update validator reputation:", error);
            await this.auditManager.log(audit_1.AuditEventType.REPUTATION_UPDATE_FAILED, {
                validator: validatorAddress,
                error: error.message,
                severity: audit_1.AuditSeverity.ERROR,
            });
            return false;
        }
        finally {
            release();
        }
    }
    // Add method to handle validator absence
    async handleValidatorAbsence(validatorAddress) {
        try {
            // Get consecutive misses
            const misses = (this.consecutiveMisses.get(validatorAddress) || 0) + 1;
            this.consecutiveMisses.set(validatorAddress, misses);
            // Calculate penalty with multiplier for consecutive misses
            const penalty = this.VALIDATOR_PENALTIES.MISSED_VALIDATION *
                Math.pow(this.VALIDATOR_PENALTIES.CONSECUTIVE_MISS_MULTIPLIER, misses - 1);
            // Update reputation
            await this.updateValidatorReputation(validatorAddress, penalty, `Missed validation duty (${misses} consecutive misses)`);
            // If too many consecutive misses, consider temporary suspension
            if (misses >= this.VALIDATOR_PENALTIES.MAX_CONSECUTIVE_MISSES) {
                await this.auditManager.log(audit_1.AuditEventType.VALIDATOR_SUSPENSION, {
                    validator: validatorAddress,
                    consecutiveMisses: misses,
                    severity: audit_1.AuditSeverity.HIGH,
                });
                // Implement suspension logic here
            }
        }
        catch (error) {
            shared_1.Logger.error("Failed to handle validator absence:", error);
            await this.auditManager.log(audit_1.AuditEventType.VALIDATOR_ABSENCE_HANDLING_FAILED, {
                validator: validatorAddress,
                error: error.message,
                severity: audit_1.AuditSeverity.ERROR,
            });
        }
    }
    // Add method to reset consecutive misses when validator participates
    resetConsecutiveMisses(validatorAddress) {
        this.consecutiveMisses.delete(validatorAddress);
    }
    /**
     * Select backup validator when primary fails
     */
    async selectBackupValidator(validationTask, failedValidator) {
        const perfMarker = this.performanceMonitor.start("select_backup_validator");
        try {
            // Get current validator set
            const currentValidators = await this.getEligibleBackupValidators();
            // Remove failed validator from consideration
            const eligibleBackups = currentValidators.filter((v) => v.address !== failedValidator &&
                !this.activeValidators
                    .get(validationTask)
                    ?.backups.includes(v.address));
            // Sort by composite score (reputation, uptime, and recent performance)
            const rankedBackups = await this.rankBackupValidators(eligibleBackups);
            // Select best available backup
            const selectedBackup = rankedBackups[0]?.address;
            if (selectedBackup) {
                // Update active validators tracking
                const current = this.activeValidators.get(validationTask) || {
                    primary: failedValidator,
                    backups: [],
                    lastRotation: Date.now(),
                };
                current.backups.push(selectedBackup);
                this.activeValidators.set(validationTask, current);
                // Log the backup selection
                await this.auditManager.log(audit_1.AuditEventType.BACKUP_VALIDATOR_SELECTED, {
                    task: validationTask,
                    failed: failedValidator,
                    selected: selectedBackup,
                    attempt: current.backups.length,
                    severity: audit_1.AuditSeverity.INFO,
                });
                return selectedBackup;
            }
            return null;
        }
        catch (error) {
            shared_1.Logger.error("Failed to select backup validator:", error);
            await this.auditManager.log(audit_1.AuditEventType.BACKUP_SELECTION_FAILED, {
                task: validationTask,
                error: error.message,
                severity: audit_1.AuditSeverity.ERROR,
            });
            return null;
        }
        finally {
            if (typeof perfMarker !== "undefined") {
                this.performanceMonitor.end(perfMarker);
            }
        }
    }
    /**
     * Get list of validators eligible to serve as backups
     */
    async getEligibleBackupValidators() {
        try {
            const allValidators = await this.blockchain.db.getValidators();
            return allValidators.filter((validator) => {
                const reputation = this.reputationSystem.get(validator.address) || 0;
                const isEligible = reputation >=
                    constants_1.BLOCKCHAIN_CONSTANTS.BACKUP_VALIDATOR_CONFIG
                        .MIN_BACKUP_REPUTATION &&
                    validator.uptime >=
                        constants_1.BLOCKCHAIN_CONSTANTS.BACKUP_VALIDATOR_CONFIG.MIN_BACKUP_UPTIME &&
                    !this.isValidatorOverloaded(validator.address);
                return isEligible;
            });
        }
        catch (error) {
            shared_1.Logger.error("Failed to get eligible backup validators:", error);
            return [];
        }
    }
    /**
     * Rank backup validators based on multiple criteria
     */
    async rankBackupValidators(validators) {
        try {
            const ranked = await Promise.all(validators.map(async (validator) => {
                const reputation = this.reputationSystem.get(validator.address) || 0;
                const recentPerformance = await this.getRecentPerformanceScore(validator.address);
                const loadFactor = await this.getValidatorLoadFactor(validator.address);
                // Calculate composite score (0-100)
                const score = reputation * 0.4 + // 40% weight on reputation
                    recentPerformance * 0.3 + // 30% weight on recent performance
                    validator.uptime * 100 * 0.2 + // 20% weight on uptime
                    (1 - loadFactor) * 100 * 0.1; // 10% weight on available capacity
                return { ...validator, score };
            }));
            // Sort by score (highest first)
            return ranked.sort((a, b) => b.score - a.score);
        }
        catch (error) {
            shared_1.Logger.error("Failed to rank backup validators:", error);
            return [];
        }
    }
    /**
     * Check if validator is currently overloaded
     */
    isValidatorOverloaded(address) {
        let activeCount = 0;
        // Count active validation tasks
        for (const [_, info] of this.activeValidators) {
            if (info.primary === address || info.backups.includes(address)) {
                activeCount++;
            }
        }
        // Consider overloaded if handling more than 3 tasks
        return activeCount >= 3;
    }
    /**
     * Calculate recent performance score (0-100)
     */
    async getRecentPerformanceScore(address) {
        try {
            const recentBlocks = 100; // Look at last 100 blocks
            const performance = await this.blockchain.db.getValidatorPerformance(address, recentBlocks);
            return ((performance.successfulValidations / performance.totalOpportunities) *
                100);
        }
        catch (error) {
            shared_1.Logger.error("Failed to get validator performance:", error);
            return 0;
        }
    }
    /**
     * Calculate validator's current load factor (0-1)
     */
    async getValidatorLoadFactor(address) {
        try {
            const stats = await this.blockchain.db.getValidatorStats(address);
            return stats.currentLoad / stats.maxCapacity;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get validator load:", error);
            return 1; // Assume fully loaded on error
        }
    }
    // Add method to handle validation failure
    async handleValidationFailure(validationTask, failedValidator) {
        try {
            // Log and penalize the absent validator
            await this.handleValidatorAbsence(failedValidator);
            // Try to find a backup validator
            const backupValidator = await this.selectBackupValidator(validationTask, failedValidator);
            if (backupValidator) {
                await this.auditManager.log(audit_1.AuditEventType.VALIDATOR_BACKUP_ASSIGNED, {
                    task: validationTask,
                    failed: failedValidator,
                    backup: backupValidator,
                    severity: audit_1.AuditSeverity.INFO,
                });
                return true;
            }
            // No backup found
            await this.auditManager.log(audit_1.AuditEventType.VALIDATOR_BACKUP_FAILED, {
                task: validationTask,
                failed: failedValidator,
                severity: audit_1.AuditSeverity.HIGH,
            });
            return false;
        }
        catch (error) {
            shared_1.Logger.error("Failed to handle validation failure:", error);
            return false;
        }
    }
    async getExpectedValidators() {
        try {
            const validators = [];
            const validatorCount = await this.blockchain.db.getValidatorCount();
            // Iterate through active validators
            for (let i = 0; i < validatorCount; i++) {
                const validator = await this.blockchain.db.getValidator(`validator_${i}`);
                if (validator && validator.isActive) {
                    validators.push(validator);
                }
            }
            return validators;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get expected validators:", error);
            return [];
        }
    }
    async hasChanged() {
        try {
            const currentTransactions = this.getTransactions()
                .map((tx) => tx.hash)
                .join("");
            const cacheKey = "mempool_state";
            const cachedState = this.mempoolStateCache.get(cacheKey);
            if (cachedState !== currentTransactions) {
                this.mempoolStateCache.set(cacheKey, currentTransactions);
                this.lastChangeTimestamp = Date.now();
                return true;
            }
            return false;
        }
        catch (error) {
            shared_1.Logger.error("Error checking mempool changes:", error);
            return false;
        }
    }
    /**
     * Add an input to a pending transaction
     * @param txId Transaction ID to add input to
     * @param input Input to add
     * @returns Promise<boolean> True if input was added successfully
     */
    async addTransactionInput(txId, input) {
        // Add mutex for the specific transaction instead of global mutex
        const txMutex = await this.getMutexForTransaction(txId);
        const release = await txMutex.acquire();
        try {
            // Get existing transaction
            const transaction = this.transactions.get(txId);
            if (!transaction) {
                shared_1.Logger.warn("Transaction not found for input addition", { txId });
                return false;
            }
            // Create transaction builder
            const txBuilder = new transaction_model_2.TransactionBuilder();
            txBuilder.type = transaction.type;
            // Add new input
            await txBuilder.addInput(input.previousTxId, input.outputIndex, input.publicKey, input.amount);
            // Add existing inputs
            for (const existingInput of transaction.inputs) {
                await txBuilder.addInput(existingInput.txId, existingInput.outputIndex, existingInput.publicKey, existingInput.amount);
            }
            // Add existing outputs
            for (const output of transaction.outputs) {
                await txBuilder.addOutput(output.address, output.amount);
            }
            // Build updated transaction
            const updatedTx = await txBuilder.build();
            // Validate updated transaction
            const isValid = await this.validateTransaction(updatedTx, await this.blockchain.getUTXOSet(), this.blockchain.getCurrentHeight());
            if (!isValid) {
                shared_1.Logger.warn("Updated transaction validation failed", { txId });
                return false;
            }
            // Update transaction in mempool
            this.transactions.set(txId, updatedTx);
            this.updateFeeBuckets(updatedTx);
            await this.auditManager.log(audit_1.AuditEventType.TRANSACTION_INPUT_ADDED, {
                txId,
                inputTxId: input.previousTxId,
                amount: input.amount.toString(),
                severity: audit_1.AuditSeverity.INFO,
            });
            return true;
        }
        catch (error) {
            shared_1.Logger.error("Failed to add transaction input:", error);
            return false;
        }
        finally {
            release();
        }
    }
    /**
     * Add an output to a pending transaction
     * @param txId Transaction ID to add output to
     * @param output Output to add
     * @returns Promise<boolean> True if output was added successfully
     */
    async addTransactionOutput(txId, output) {
        // Add input validation
        if (!txId?.match(/^[a-f0-9]{64}$/i)) {
            shared_1.Logger.warn("Invalid transaction ID format");
            return false;
        }
        if (!output?.address || !output?.amount || output.amount <= BigInt(0)) {
            shared_1.Logger.warn("Invalid output parameters");
            return false;
        }
        const mutex = new async_mutex_1.Mutex();
        const release = await mutex.acquire();
        try {
            // Get existing transaction
            const transaction = this.transactions.get(txId);
            if (!transaction) {
                shared_1.Logger.warn("Transaction not found for output addition", { txId });
                return false;
            }
            // Create transaction builder
            const txBuilder = new transaction_model_2.TransactionBuilder();
            txBuilder.type = transaction.type;
            // Add existing inputs
            for (const input of transaction.inputs) {
                await txBuilder.addInput(input.txId, input.outputIndex, input.publicKey, input.amount);
            }
            // Add existing outputs
            for (const existingOutput of transaction.outputs) {
                await txBuilder.addOutput(existingOutput.address, existingOutput.amount);
            }
            // Add new output - script will be generated in TransactionBuilder.addOutput
            await txBuilder.addOutput(output.address, output.amount);
            // Build updated transaction
            const updatedTx = await txBuilder.build();
            // Validate updated transaction
            const isValid = await this.validateTransaction(updatedTx, await this.blockchain.getUTXOSet(), this.blockchain.getCurrentHeight());
            if (!isValid) {
                shared_1.Logger.warn("Updated transaction validation failed", { txId });
                return false;
            }
            // Update transaction in mempool
            this.transactions.set(txId, updatedTx);
            this.updateFeeBuckets(updatedTx);
            await this.auditManager.log(audit_1.AuditEventType.TRANSACTION_OUTPUT_ADDED, {
                txId,
                address: output.address,
                amount: output.amount.toString(),
                severity: audit_1.AuditSeverity.INFO,
            });
            return true;
        }
        catch (error) {
            shared_1.Logger.error("Failed to add transaction output:", error);
            return false;
        }
        finally {
            release();
        }
    }
    // Add cache cleanup
    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of this.mempoolStateCache.entries()) {
            if (now - this.lastChangeTimestamp > this.maxTransactionAge) {
                this.mempoolStateCache.delete(key);
            }
        }
    }
    initializeCleanupInterval() {
        this.cleanupInterval = setInterval(() => {
            try {
                this.removeOldTransactions();
                this.cleanupCache();
                this.updateDynamicFees();
                this.cleanupOldFeeBuckets();
            }
            catch (error) {
                shared_1.Logger.error("Cleanup interval failed:", error);
            }
        }, constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.CLEANUP_INTERVAL);
    }
    calculateTransactionSize(transaction) {
        try {
            // Basic structure validation
            if (!transaction || !transaction.inputs || !transaction.outputs) {
                throw new Error("Invalid transaction structure");
            }
            // Version validation
            if (transaction.version < 1 || transaction.version > 2) {
                throw new Error("Invalid transaction version");
            }
            let size = 0;
            const SIZES = {
                VERSION: 4,
                LOCKTIME: 4,
                INPUT_COUNT_VARINT: 1,
                OUTPUT_COUNT_VARINT: 1,
                INPUT_OUTPOINT: 36,
                INPUT_SCRIPT_LENGTH_VARINT: 1,
                INPUT_SEQUENCE: 4,
                OUTPUT_VALUE: 8,
                OUTPUT_SCRIPT_LENGTH_VARINT: 1,
                WITNESS_FLAG: 2,
            };
            // Add version and locktime
            size += SIZES.VERSION;
            size += SIZES.LOCKTIME;
            // Input size calculation
            size += this.getVarIntSize(transaction.inputs.length);
            for (const input of transaction.inputs) {
                if (!input.script) {
                    throw new Error("Missing input script");
                }
                if (!this.isValidInputScript(input.script)) {
                    throw new Error("Invalid input script");
                }
                size += SIZES.INPUT_OUTPOINT;
                size += SIZES.INPUT_SCRIPT_LENGTH_VARINT;
                // Signature validation and size
                if (input.signature) {
                    const sigSize = Buffer.from(input.signature, "base64").length;
                    if (sigSize > constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIGNATURE_SIZE) {
                        throw new Error("Signature too large");
                    }
                    size += sigSize;
                }
                // Public key validation and size
                if (input.publicKey) {
                    const pubKeySize = Buffer.from(input.publicKey, "base64").length;
                    if (pubKeySize > constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_PUBKEY_SIZE) {
                        throw new Error("Public key too large");
                    }
                    size += pubKeySize;
                }
                size += SIZES.INPUT_SEQUENCE;
            }
            // Output size calculation
            size += this.getVarIntSize(transaction.outputs.length);
            for (const output of transaction.outputs) {
                size += SIZES.OUTPUT_VALUE;
                size += SIZES.OUTPUT_SCRIPT_LENGTH_VARINT;
                if (output.script) {
                    if (!this.isValidScriptType(output.script)) {
                        throw new Error("Invalid script type");
                    }
                    const scriptSize = Buffer.from(output.script).length;
                    if (scriptSize > constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SCRIPT_SIZE) {
                        throw new Error("Script too large");
                    }
                    size += scriptSize;
                }
            }
            // Witness data calculation
            if (transaction.hasWitness && transaction.witness?.stack) {
                if (transaction.witness.stack.length !== transaction.inputs.length) {
                    throw new Error("Witness stack size mismatch");
                }
                size += SIZES.WITNESS_FLAG;
                size += this.getVarIntSize(transaction.witness.stack.length);
                for (const witnessData of transaction.witness.stack) {
                    const witnessSize = Buffer.from(witnessData, "hex").length;
                    size += this.getVarIntSize(witnessSize) + witnessSize;
                }
            }
            // Final size validation
            if (size > constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIZE) {
                throw new Error("Transaction too large");
            }
            return size;
        }
        catch (error) {
            shared_1.Logger.error("Transaction size calculation failed:", {
                txId: transaction?.id,
                error: error.message,
            });
            return Number.MAX_SAFE_INTEGER; // Force validation failure
        }
    }
    getVarIntSize(value) {
        if (value < 0xfd)
            return 1;
        if (value <= 0xffff)
            return 3;
        if (value <= 0xffffffff)
            return 5;
        return 9;
    }
    getMutexForTransaction(txId) {
        let mutex = this.transactionMutexes.get(txId);
        if (!mutex) {
            mutex = new async_mutex_1.Mutex();
            this.transactionMutexes.set(txId, mutex);
            // Cleanup mutex after transaction processed
            setTimeout(() => {
                if (!this.transactions.has(txId)) {
                    this.transactionMutexes.delete(txId);
                }
            }, this.maxTransactionAge);
        }
        return mutex;
    }
    findFeeBucket(transaction) {
        try {
            // Get fee rate with precision handling
            const feeRate = Math.round(this.calculateFeePerByte(transaction) * 100000) / 100000;
            // Find closest bucket within tolerance
            const RATE_TOLERANCE = 0.00001;
            for (const [rate, txs] of this.feeRateBuckets) {
                if (Math.abs(rate - feeRate) < RATE_TOLERANCE) {
                    shared_1.Logger.debug("Found fee bucket", {
                        txId: transaction.id,
                        feeRate,
                        bucketRate: rate,
                    });
                    return txs;
                }
            }
            // Create new bucket if none found
            if (!this.feeRateBuckets.has(feeRate)) {
                shared_1.Logger.debug("Creating new fee bucket", {
                    txId: transaction.id,
                    feeRate,
                });
                this.feeRateBuckets.set(feeRate, new Set());
                return this.feeRateBuckets.get(feeRate);
            }
            return undefined;
        }
        catch (error) {
            shared_1.Logger.error("Error finding fee bucket:", error);
            return undefined;
        }
    }
    getOrCreateFeeBucket(feeRate) {
        try {
            const normalizedRate = Math.round(feeRate * 100000) / 100000;
            let bucket = this.feeRateBuckets.get(normalizedRate);
            if (!bucket) {
                bucket = new Set();
                this.feeRateBuckets.set(normalizedRate, bucket);
            }
            return bucket;
        }
        catch (error) {
            shared_1.Logger.error("Error managing fee bucket:", error);
            return new Set();
        }
    }
    cleanupOldFeeBuckets() {
        try {
            const BUCKET_CONSOLIDATION_THRESHOLD = 1000; // Max number of buckets
            const MIN_BUCKET_SIZE = 5; // Minimum transactions per bucket
            // Remove empty buckets
            for (const [rate, bucket] of this.feeRateBuckets) {
                if (bucket.size === 0) {
                    this.feeRateBuckets.delete(rate);
                }
            }
            // Consolidate buckets if there are too many
            if (this.feeRateBuckets.size > BUCKET_CONSOLIDATION_THRESHOLD) {
                const sortedRates = Array.from(this.feeRateBuckets.keys()).sort((a, b) => a - b);
                for (let i = 0; i < sortedRates.length - 1; i++) {
                    const currentRate = sortedRates[i];
                    const nextRate = sortedRates[i + 1];
                    const currentBucket = this.feeRateBuckets.get(currentRate);
                    if (currentBucket.size < MIN_BUCKET_SIZE) {
                        const nextBucket = this.feeRateBuckets.get(nextRate);
                        // Merge into next bucket
                        currentBucket.forEach((txId) => nextBucket.add(txId));
                        this.feeRateBuckets.delete(currentRate);
                    }
                }
            }
            shared_1.Logger.debug("Fee buckets cleaned up", {
                bucketCount: this.feeRateBuckets.size,
                totalTransactions: Array.from(this.feeRateBuckets.values()).reduce((sum, bucket) => sum + bucket.size, 0),
            });
        }
        catch (error) {
            shared_1.Logger.error("Fee bucket cleanup failed:", error);
        }
    }
    updateDynamicFees() {
        try {
            const newFee = this.calculateDynamicMinFee();
            this.lastValidFee = newFee;
            shared_1.Logger.debug("Updated dynamic fees", {
                newFee,
                timestamp: Date.now(),
            });
        }
        catch (error) {
            shared_1.Logger.error("Failed to update dynamic fees:", error);
        }
    }
    async getVotingContribution(address) {
        try {
            const utxoSet = await this.blockchain.getUTXOSet();
            const votingUtxos = await utxoSet.findUtxosForVoting(address);
            return Number(utxoSet.calculateVotingPower(votingUtxos));
        }
        catch (error) {
            shared_1.Logger.error("Error getting voting contribution:", error);
            return 0;
        }
    }
    async validateTransactionInputs(tx) {
        const mutex = this.getMutexForTransaction(tx.id);
        let release;
        try {
            // Add timeout to prevent deadlock
            const acquirePromise = mutex.acquire();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Mutex acquisition timeout")), 5000);
            });
            release = await Promise.race([acquirePromise, timeoutPromise]);
            const spentUTXOs = new Set();
            for (const input of tx.inputs) {
                const utxoKey = `${input.txId}:${input.outputIndex}`;
                if (spentUTXOs.has(utxoKey)) {
                    shared_1.Logger.warn("Double-spend detected within transaction", {
                        txId: tx.id,
                        utxoKey,
                    });
                    return false;
                }
                // Add concurrent UTXO validation
                const [utxo, isSpentInMempool] = await Promise.all([
                    this.blockchain.getUTXO(input.txId, input.outputIndex),
                    this.isUTXOSpentInMempool(input.txId, input.outputIndex),
                ]);
                if (!utxo || utxo.spent || isSpentInMempool) {
                    shared_1.Logger.warn("Invalid or spent UTXO", {
                        txId: tx.id,
                        inputTxId: input.txId,
                        outputIndex: input.outputIndex,
                    });
                    return false;
                }
                // Verify amount matches
                if (utxo.amount !== input.amount) {
                    shared_1.Logger.warn(`Amount mismatch in transaction ${tx.id}`);
                    return false;
                }
                spentUTXOs.add(utxoKey);
            }
            return true;
        }
        catch (error) {
            shared_1.Logger.error("Transaction input validation failed:", error);
            return false;
        }
        finally {
            if (release)
                release();
        }
    }
    async isUTXOSpentInMempool(txId, outputIndex) {
        for (const tx of this.transactions.values()) {
            if (tx.inputs.some((input) => input.txId === txId && input.outputIndex === outputIndex)) {
                return true;
            }
        }
        return false;
    }
    validateTransactionSize(transaction) {
        const size = this.calculateTransactionSize(transaction);
        // Check against max transaction size
        if (size > constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIZE) {
            shared_1.Logger.warn("Transaction exceeds maximum size", {
                txId: transaction.id,
                size,
                maxSize: constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIZE,
            });
            return false;
        }
        // Check minimum fee based on size
        const minFee = BigInt(size * constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_FEE_RATE);
        if (transaction.fee < minFee) {
            shared_1.Logger.warn("Transaction fee too low for size", {
                txId: transaction.id,
                fee: transaction.fee.toString(),
                minFee: minFee.toString(),
            });
            return false;
        }
        return true;
    }
    updateMetrics(tx) {
        this.size = this.transactions.size;
        this.bytes += tx.getSize();
        this.usage = this.calculateUsage();
    }
    calculateUsage() {
        return Array.from(this.transactions.values()).reduce((sum, tx) => sum + tx.getSize(), 0);
    }
    /**
     * Get detailed information about the current state of the mempool
     * @returns {Promise<MempoolInfo>} Detailed mempool statistics and status
     */
    async getMempoolInfo() {
        try {
            // Calculate size metrics
            const bytes = Array.from(this.transactions.values()).reduce((sum, tx) => sum + this.calculateTransactionSize(tx), 0);
            // Get fee metrics
            const feeMetrics = this.calculateFeeMetrics();
            // Calculate load metrics
            const maxMemory = constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MAX_MEMORY_USAGE;
            const memoryUsage = process.memoryUsage().heapUsed;
            const loadFactor = this.transactions.size / this.maxSize;
            // Get transaction type distribution
            const typeDistribution = this.getTransactionTypeDistribution();
            return {
                size: this.transactions.size,
                bytes,
                usage: this.usage,
                maxSize: this.maxSize,
                maxMemoryUsage: maxMemory,
                currentMemoryUsage: memoryUsage,
                loadFactor,
                fees: {
                    base: constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_FEE_RATE,
                    current: this.lastValidFee,
                    mean: feeMetrics.mean,
                    median: feeMetrics.median,
                    min: feeMetrics.min,
                    max: feeMetrics.max,
                },
                transactions: {
                    total: this.transactions.size,
                    pending: this.getPendingCount(),
                    distribution: typeDistribution,
                },
                age: {
                    oldest: this.getOldestTransactionAge(),
                    youngest: this.getYoungestTransactionAge(),
                },
                health: {
                    status: this.getHealthStatus(),
                    lastUpdate: this.lastChangeTimestamp,
                    isAcceptingTransactions: this.canAcceptTransactions(),
                },
            };
        }
        catch (error) {
            shared_1.Logger.error("Failed to get mempool info:", error);
            throw new Error("Failed to retrieve mempool information");
        }
    }
    calculateFeeMetrics() {
        const fees = Array.from(this.transactions.values()).map((tx) => this.calculateFeePerByte(tx));
        if (fees.length === 0) {
            return {
                mean: 0,
                median: 0,
                min: 0,
                max: 0,
            };
        }
        fees.sort((a, b) => a - b);
        return {
            mean: fees.reduce((sum, fee) => sum + fee, 0) / fees.length,
            median: fees[Math.floor(fees.length / 2)],
            min: fees[0],
            max: fees[fees.length - 1],
        };
    }
    getTransactionTypeDistribution() {
        const distribution = {
            [transaction_model_1.TransactionType.STANDARD]: 0,
            [transaction_model_1.TransactionType.TRANSFER]: 0,
            [transaction_model_1.TransactionType.COINBASE]: 0,
            [transaction_model_1.TransactionType.QUADRATIC_VOTE]: 0,
            [transaction_model_1.TransactionType.POW_REWARD]: 0,
            [transaction_model_1.TransactionType.REGULAR]: 0,
        };
        for (const tx of this.transactions.values()) {
            distribution[tx.type] = (distribution[tx.type] || 0) + 1;
        }
        return distribution;
    }
    getPendingCount() {
        return Array.from(this.transactions.values()).filter((tx) => !tx.blockHeight).length;
    }
    getOldestTransactionAge() {
        const timestamps = Array.from(this.transactions.values()).map((tx) => tx.timestamp);
        return timestamps.length ? Math.min(...timestamps) : 0;
    }
    getYoungestTransactionAge() {
        const timestamps = Array.from(this.transactions.values()).map((tx) => tx.timestamp);
        return timestamps.length ? Math.max(...timestamps) : 0;
    }
    getHealthStatus() {
        const loadFactor = this.transactions.size / this.maxSize;
        const memoryUsage = process.memoryUsage().heapUsed;
        const maxMemory = constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MAX_MEMORY_USAGE;
        if (loadFactor > 0.9 || memoryUsage > maxMemory * 0.9) {
            return "critical";
        }
        else if (loadFactor > 0.7 || memoryUsage > maxMemory * 0.7) {
            return "degraded";
        }
        return "healthy";
    }
    canAcceptTransactions() {
        const health = this.getHealthStatus();
        const memoryOK = process.memoryUsage().heapUsed <
            constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MAX_MEMORY_USAGE;
        const sizeOK = this.transactions.size < this.maxSize;
        return health !== "critical" && memoryOK && sizeOK;
    }
    /**
     * Get detailed information about all transactions in the mempool
     * @param {boolean} verbose - If true, returns detailed information for each transaction
     * @returns {Promise<Record<string, RawMempoolEntry> | string[]>} Mempool transactions
     */
    async getRawMempool(verbose = false) {
        try {
            if (!verbose) {
                return Array.from(this.transactions.keys());
            }
            const result = {};
            for (const [txid, tx] of this.transactions) {
                const ancestors = this.getAncestors(tx);
                const descendants = this.getDescendants(tx);
                result[txid] = {
                    txid,
                    fee: Number(tx.fee),
                    vsize: this.calculateTransactionSize(tx),
                    weight: this.calculateTransactionWeight(tx),
                    time: Math.floor(tx.timestamp / 1000),
                    height: this.blockchain.getCurrentHeight(),
                    descendantcount: descendants.size,
                    descendantsize: this.calculateDescendantSize(descendants),
                    ancestorcount: ancestors.size,
                    ancestorsize: this.calculateAncestorSize(ancestors),
                    depends: Array.from(tx.inputs.map((input) => input.txId)),
                };
            }
            return result;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get raw mempool:", error);
            throw new Error("Failed to retrieve mempool transactions");
        }
    }
    /**
     * Calculate total weight of a transaction
     */
    calculateTransactionWeight(tx) {
        // Weight = (base size * 3) + total size
        const baseSize = this.calculateTransactionSize(tx);
        const totalSize = baseSize; // Simplified for non-segwit
        return baseSize * 3 + totalSize;
    }
    /**
     * Calculate total size of descendant transactions
     */
    calculateDescendantSize(descendants) {
        return Array.from(descendants).reduce((sum, txid) => {
            const tx = this.transactions.get(txid);
            return sum + (tx ? this.calculateTransactionSize(tx) : 0);
        }, 0);
    }
    /**
     * Calculate total size of ancestor transactions
     */
    calculateAncestorSize(ancestors) {
        return Array.from(ancestors).reduce((sum, txid) => {
            const tx = this.transactions.get(txid);
            return sum + (tx ? this.calculateTransactionSize(tx) : 0);
        }, 0);
    }
    /**
     * Get detailed information about a specific transaction in the mempool
     * @param {string} txid - Transaction ID to lookup
     * @returns {Promise<RawMempoolEntry>} Detailed transaction information
     * @throws {Error} If transaction is not found in mempool
     */
    async getMempoolEntry(txid) {
        try {
            // Input validation
            if (!txid || typeof txid !== "string") {
                throw new Error("Invalid transaction ID");
            }
            // Get transaction from mempool
            const tx = this.transactions.get(txid);
            if (!tx) {
                throw new Error(`Transaction ${txid} not found in mempool`);
            }
            // Get ancestry information
            const ancestors = this.getAncestors(tx);
            const descendants = this.getDescendants(tx);
            // Calculate metrics
            const entry = {
                txid,
                fee: Number(tx.fee),
                vsize: this.calculateTransactionSize(tx),
                weight: this.calculateTransactionWeight(tx),
                time: Math.floor(tx.timestamp / 1000),
                height: this.blockchain.getCurrentHeight(),
                descendantcount: descendants.size,
                descendantsize: this.calculateDescendantSize(descendants),
                ancestorcount: ancestors.size,
                ancestorsize: this.calculateAncestorSize(ancestors),
                depends: Array.from(tx.inputs.map((input) => input.txId)),
            };
            shared_1.Logger.debug("Retrieved mempool entry", { txid, size: entry.vsize });
            return entry;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get mempool entry:", error);
            throw error;
        }
    }
    isValidInputScript(script) {
        try {
            if (!script || typeof script !== "string")
                return false;
            const scriptBuffer = Buffer.from(script, "hex");
            let position = 0;
            while (position < scriptBuffer.length) {
                const opcode = scriptBuffer[position];
                position++;
                const validOpcodes = new Set(Object.values(this.SCRIPT_OPCODES));
                if (!validOpcodes.has(opcode)) {
                    shared_1.Logger.warn("Invalid opcode in script", { opcode });
                    return false;
                }
                // Handle push data operations
                if (opcode > 0x00 && opcode < 0x4c) {
                    // Direct push of N bytes
                    position += opcode;
                }
                else if (opcode === this.SCRIPT_OPCODES.OP_PUSHDATA1) {
                    position += 1 + scriptBuffer[position];
                }
                else if (opcode === this.SCRIPT_OPCODES.OP_PUSHDATA2) {
                    position += 2 + scriptBuffer.readUInt16LE(position);
                }
                else if (opcode === this.SCRIPT_OPCODES.OP_PUSHDATA4) {
                    position += 4 + scriptBuffer.readUInt32LE(position);
                }
                // Validate position bounds
                if (position > scriptBuffer.length) {
                    shared_1.Logger.warn("Script size mismatch");
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            shared_1.Logger.error("Input script validation failed:", error);
            return false;
        }
    }
    isValidScriptType(script) {
        try {
            if (!script || typeof script !== "string")
                return false;
            const scriptBuffer = Buffer.from(script, "hex");
            // P2PKH validation (OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG)
            if (scriptBuffer.length === 25 &&
                scriptBuffer[0] === 0x76 && // OP_DUP
                scriptBuffer[1] === 0xa9 && // OP_HASH160
                scriptBuffer[2] === 0x14 && // Push 20 bytes
                scriptBuffer[23] === 0x88 && // OP_EQUALVERIFY
                scriptBuffer[24] === 0xac) {
                // OP_CHECKSIG
                return true;
            }
            // P2SH validation (OP_HASH160 <scriptHash> OP_EQUAL)
            if (scriptBuffer.length === 23 &&
                scriptBuffer[0] === 0xa9 && // OP_HASH160
                scriptBuffer[1] === 0x14 && // Push 20 bytes
                scriptBuffer[22] === 0x87) {
                // OP_EQUAL
                return true;
            }
            // P2WPKH validation (OP_0 <pubKeyHash>)
            if (scriptBuffer.length === 22 &&
                scriptBuffer[0] === 0x00 && // OP_0
                scriptBuffer[1] === 0x14) {
                // Push 20 bytes
                return true;
            }
            // P2WSH validation (OP_0 <scriptHash>)
            if (scriptBuffer.length === 34 &&
                scriptBuffer[0] === 0x00 && // OP_0
                scriptBuffer[1] === 0x20) {
                // Push 32 bytes
                return true;
            }
            // P2TR validation (OP_1 <pubKey>)
            if (scriptBuffer.length === 34 &&
                scriptBuffer[0] === 0x51 && // OP_1
                scriptBuffer[1] === 0x20) {
                // Push 32 bytes
                return true;
            }
            shared_1.Logger.warn("Unknown script type");
            return false;
        }
        catch (error) {
            shared_1.Logger.error("Script type validation failed:", error);
            return false;
        }
    }
}
exports.Mempool = Mempool;
//# sourceMappingURL=mempool.js.map