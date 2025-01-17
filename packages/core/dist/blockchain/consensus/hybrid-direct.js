"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridDirectConsensus = void 0;
const events_1 = require("events");
const pow_1 = require("./pow");
const direct_voting_1 = require("./direct-voting");
const shared_1 = require("@h3tag-blockchain/shared");
const async_mutex_1 = require("async-mutex");
const util_1 = require("./direct-voting/util");
const consensus_error_1 = require("../utils/consensus.error");
const validation_error_1 = require("../utils/validation.error");
const blockchain_schema_1 = require("../../database/blockchain-schema");
const audit_1 = require("../../security/audit");
const retry_1 = require("../../utils/retry");
const sync_1 = require("../../network/sync");
const cache_1 = require("../../scaling/cache");
const sharding_1 = require("../../scaling/sharding");
const merkle_1 = require("../../utils/merkle");
const ddos_1 = require("../../security/ddos");
const constants_1 = require("../utils/constants");
const performance_1 = require("../../monitoring/performance");
/**
 * @fileoverview HybridDirectConsensus implements a hybrid consensus mechanism that combines
 * Proof of Work (PoW) with direct voting for blockchain validation and fork resolution.
 * This hybrid approach provides both the security of PoW and the governance benefits of voting.
 *
 * @module HybridDirectConsensus
 */
/**
 * HybridDirectConsensus implements a hybrid consensus mechanism combining PoW and direct voting.
 * It manages block validation, chain fork resolution, and consensus state.
 *
 * @class HybridDirectConsensus
 *
 * @property {ProofOfWork} pow - Handles Proof of Work operations
 * @property {DirectVoting} directVoting - Manages voting operations
 * @property {BlockchainSchema} db - Database instance
 * @property {AuditManager} auditManager - Manages audit logging
 * @property {Cache<boolean>} blockCache - Caches block validation results
 * @property {ShardManager} shardManager - Manages blockchain sharding
 * @property {Mempool} mempool - Manages transaction mempool
 * @property {Blockchain} blockchain - Core blockchain instance
 * @property {MerkleTree} merkleTree - Handles merkle tree operations
 * @property {Performance} performance - Monitors performance metrics
 * @property {RetryStrategy} retryStrategy - Manages operation retries
 * @property {Map<string, Peer>} peers - Manages network peers
 * @property {BlockchainSync} blockchainSync - Handles blockchain synchronization
 * @property {DDoSProtection} ddosProtection - Provides DDoS protection
 *
 * @example
 * const consensus = await HybridDirectConsensus.create(blockchain);
 * const isValid = await consensus.validateBlock(block);
 * if (isValid) {
 *   await consensus.processBlock(block);
 * }
 */
/**
 * Creates a new instance of HybridDirectConsensus
 *
 * @constructor
 * @param {Blockchain} blockchain - Blockchain instance
 */
/**
 * Creates and initializes a new HybridDirectConsensus instance
 *
 * @static
 * @async
 * @method create
 * @param {Blockchain} blockchain - Blockchain instance
 * @returns {Promise<HybridDirectConsensus>} Initialized consensus instance
 */
/**
 * Validates a block using hybrid consensus rules
 *
 * @async
 * @method validateBlock
 * @param {Block} block - Block to validate
 * @returns {Promise<boolean>} True if block is valid
 * @throws {BlockValidationError} If validation fails or times out
 *
 * @example
 * const isValid = await consensus.validateBlock(block);
 * if (!isValid) {
 *   // Handle invalid block
 * }
 */
/**
 * Processes a new block
 *
 * @async
 * @method processBlock
 * @param {Block} block - Block to process
 * @returns {Promise<Block>} Processed block
 * @throws {ConsensusError} If block processing fails or times out
 *
 * @example
 * const processedBlock = await consensus.processBlock(block);
 */
/**
 * Handles chain fork resolution
 *
 * @async
 * @method handleChainFork
 * @param {Block} block - Block causing the fork
 * @returns {Promise<string>} Hash of the winning chain tip
 * @throws {ConsensusError} If fork resolution fails or times out
 */
/**
 * Validates participation reward transaction
 *
 * @async
 * @method validateParticipationReward
 * @param {Transaction} transaction - Reward transaction to validate
 * @param {number} currentHeight - Current blockchain height
 * @returns {Promise<boolean>} True if reward is valid
 */
/**
 * Gets consensus metrics
 *
 * @method getMetrics
 * @returns {{
 *   pow: Object,
 *   voting: Object,
 *   votingPeriod: number,
 *   minimumParticipation: number,
 *   performance: Object,
 *   cache: {
 *     size: number,
 *     hitRate: number,
 *     evictionCount: number
 *   },
 *   retryStats: Object
 * }}
 */
/**
 * Performs health check of consensus system
 *
 * @async
 * @method healthCheck
 * @returns {Promise<boolean>} True if system is healthy
 */
/**
 * Starts continuous mining process
 *
 * @method startMining
 * @returns {void}
 */
/**
 * Stops the mining process
 *
 * @method stopMining
 * @returns {void}
 */
/**
 * Disposes of the consensus system
 *
 * @async
 * @method dispose
 * @returns {Promise<void>}
 */
/**
 * @typedef {Object} CacheMetrics
 * @property {number} hitRate - Cache hit rate
 * @property {number} size - Current cache size
 * @property {number} memoryUsage - Memory usage in bytes
 * @property {number} evictionCount - Number of cache evictions
 */
/**
 * @typedef {Object} CircuitBreaker
 * @property {number} failures - Number of consecutive failures
 * @property {number} lastFailure - Timestamp of last failure
 * @property {number} threshold - Failure threshold before opening
 * @property {number} resetTimeout - Time before resetting failures
 */
class HybridDirectConsensus {
    /**
     * Creates a new instance of HybridDirectConsensus
     * @param db Database instance
     * @param pow Proof of Work instance
     * @param directVoting Direct voting instance
     * @param merkleTree Merkle tree instance
     * @param auditManager Audit manager instance
     * @param blockCache Block cache instance
     * @param shardManager Shard manager instance
     * @param performance Performance monitor instance
     * @param retryStrategy Retry strategy instance
     */
    constructor(blockchain) {
        this.eventEmitter = new events_1.EventEmitter();
        this.isDisposed = false;
        this.forkLock = new async_mutex_1.Mutex();
        this.circuitBreaker = {
            failures: 0,
            lastFailure: 0,
            threshold: 5,
            resetTimeout: 60000, // 1 minute
        };
        this.cacheLock = new async_mutex_1.Mutex();
        this.isInitialized = false;
        this.forkResolutionLock = new async_mutex_1.Mutex();
        this.blockchain = blockchain;
        this.db = new blockchain_schema_1.BlockchainSchema();
        this.merkleTree = new merkle_1.MerkleTree();
        this.auditManager = new audit_1.AuditManager();
        this.pow = new pow_1.ProofOfWork(this.blockchain);
        this.blockchainSync = new sync_1.BlockchainSync(this.blockchain, this.mempool, this.peers, { publicKey: this.consensusPublicKey }, this.db);
        // Initialize after dependencies
        this.directVoting = new direct_voting_1.DirectVoting(this.db, this.db.getVotingSchema(), this.auditManager, new util_1.DirectVotingUtil(this.db, this.auditManager), this.blockchain.getNode(), this.blockchainSync);
        // Add async initialization method
        this.initialize().catch((error) => shared_1.Logger.error("Failed to initialize HybridDirectConsensus:", error));
        // Add cleanup handler
        this.registerCleanupHandler();
        // Initialize caches and sharding
        this.blockCache = new cache_1.Cache({
            ttl: constants_1.BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL_HOURS * 3600,
            maxSize: 10000,
            compression: true,
            priorityLevels: {
                pow: 3,
                consensus: 2,
                quadratic_vote: 3,
            },
            onEvict: (key) => this.handleCacheEviction(key),
        });
        this.shardManager = new sharding_1.ShardManager({
            shardCount: 16,
            votingShards: 8,
            powShards: 8,
            maxShardSize: 1000000,
            replicationFactor: 3,
            reshardThreshold: 0.8,
            syncInterval: 60000,
        }, this.db);
        this.retryStrategy = new retry_1.RetryStrategy({
            maxAttempts: constants_1.BLOCKCHAIN_CONSTANTS.UTIL.RETRY_ATTEMPTS,
            delay: constants_1.BLOCKCHAIN_CONSTANTS.UTIL.RETRY_DELAY_MS,
        });
        this.ddosProtection = new ddos_1.DDoSProtection({
            maxRequests: {
                default: 200,
                pow: 100,
                qudraticVote: 100,
            },
            windowMs: 60000,
            blockDuration: 600000, // 10 minutes
        }, this.auditManager);
        this.consensusPublicKey = blockchain.getConsensusPublicKey();
    }
    static async create(blockchain) {
        const instance = new HybridDirectConsensus(blockchain);
        await instance.initialize();
        return instance;
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            await this.cleanupCircuitBreaker();
            await this.warmupCache();
            await this.directVoting.initialize();
            await this.pow.initialize();
            this.isInitialized = true;
        }
        catch (error) {
            shared_1.Logger.error("Failed to initialize HybridDirectConsensus:", error);
            await this.dispose();
            throw error;
        }
    }
    async validateBlock(block) {
        const validationTimer = performance_1.Performance.startTimer("block_validation");
        let timeoutId = setTimeout(() => { }, constants_1.BLOCKCHAIN_CONSTANTS.UTIL.VALIDATION_TIMEOUT_MS);
        try {
            const result = await Promise.race([
                this._validateBlock(block),
                new Promise((_, reject) => {
                    timeoutId = setTimeout(() => {
                        reject(new validation_error_1.BlockValidationError("Validation timeout exceeded"));
                    }, constants_1.BLOCKCHAIN_CONSTANTS.UTIL.VALIDATION_TIMEOUT_MS);
                }),
            ]);
            if (!result) {
                await this.mempool.handleValidationFailure(`block_validation:${block.header.height}`, block.validators.map((v) => v.address).join(","));
            }
            return result;
        }
        catch (error) {
            shared_1.Logger.error("Block validation failed:", error);
            await this.mempool.handleValidationFailure(`block_validation:${block.header.height}`, block.validators.map((v) => v.address).join(","));
            return false;
        }
        finally {
            clearTimeout(timeoutId);
            const duration = performance_1.Performance.stopTimer(validationTimer);
            this.emitMetric("validation_duration", duration);
        }
    }
    /**
     * Validates a block
     * @param block Block to validate
     * @returns Promise<boolean> True if block is valid
     */
    async _validateBlock(block) {
        return await this.cacheLock.runExclusive(async () => {
            try {
                let cached;
                try {
                    cached = this.blockCache.get(block.hash);
                    if (cached !== undefined)
                        return cached;
                }
                catch (error) {
                    shared_1.Logger.warn("Cache read error:", error);
                }
                // Clean up circuit breaker before checking
                this.cleanupCircuitBreaker();
                // Check circuit breaker
                if (this.isCircuitOpen()) {
                    throw new consensus_error_1.ConsensusError("Circuit breaker is open");
                }
                // 1. Verify merkle root (fast check)
                if (!(await this.verifyMerkleRoot(block))) {
                    return false;
                }
                // 2. Validate PoW
                const powValid = await this.pow.validateBlock(block);
                if (!powValid) {
                    await this.logValidationFailure(block, "Invalid PoW");
                    return false;
                }
                // 3. Check if this is a fork point requiring voting
                if (await this.isForkPoint(block)) {
                    // Check if we're in a voting period
                    const votingSchedule = await this.directVoting.getVotingSchedule();
                    if (votingSchedule.currentPeriod?.status === "active") {
                        // Handle through voting
                        const chainDecision = await this.handleChainFork(block);
                        if (!chainDecision) {
                            await this.logValidationFailure(block, "Chain fork rejected by vote");
                            return false;
                        }
                    }
                    else {
                        // Outside voting period - use PoW only with higher threshold
                        const powScore = await this.calculatePowScore(block);
                        if (powScore < constants_1.BLOCKCHAIN_CONSTANTS.MINING.EMERGENCY_POW_THRESHOLD) {
                            await this.logValidationFailure(block, "Insufficient PoW for fork outside voting period");
                            return false;
                        }
                    }
                }
                // Log successful validation
                await this.logSuccessfulValidation(block);
                const result = true;
                try {
                    this.blockCache.set(block.hash, result);
                }
                catch (error) {
                    shared_1.Logger.warn("Cache write error:", error);
                }
                return result;
            }
            catch (error) {
                this.recordFailure();
                throw error;
            }
        });
    }
    /**
     * Checks if a block is a fork point
     * @param block Block to check
     * @returns Promise<boolean> True if block is a fork point
     */
    async isForkPoint(block) {
        const existingBlock = await this.db.getBlockByHeight(block.header.height);
        return existingBlock && existingBlock.hash !== block.header.previousHash;
    }
    /**
     * Handles chain fork resolution
     * @param block Block causing the fork
     * @returns Promise<string> Hash of the winning chain tip
     * @throws Error if fork resolution fails or times out
     */
    async handleChainFork(block) {
        return this.forkResolutionLock.runExclusive(async () => {
            // First check DDoS protection within the lock
            if (!this.ddosProtection.checkRequest("fork_resolution", block.header.miner)) {
                throw new consensus_error_1.ConsensusError("Rate limit exceeded for fork resolution");
            }
            const forkTimer = performance_1.Performance.startTimer("fork_resolution");
            try {
                return await Promise.race([
                    this._handleChainFork(block),
                    new Promise((_, reject) => {
                        setTimeout(() => {
                            reject(new consensus_error_1.ConsensusError("Fork resolution timeout exceeded"));
                        }, constants_1.BLOCKCHAIN_CONSTANTS.MINING.FORK_RESOLUTION_TIMEOUT_MS);
                    }),
                ]);
            }
            finally {
                const duration = performance_1.Performance.stopTimer(forkTimer);
                this.emitMetric("fork_resolution_duration", duration);
            }
        });
    }
    /**
     * Handles chain fork resolution
     * @param block Block causing the fork
     * @returns Promise<string> Hash of the winning chain tip
     * @throws Error if fork resolution fails or times out
     */
    async _handleChainFork(block) {
        const metrics = {
            attempts: 0,
            success: false,
            startTime: Date.now(),
        };
        try {
            metrics.attempts++;
            return await this.forkLock.runExclusive(async () => {
                // Validate fork length
                const currentHeight = this.blockchain.getCurrentHeight();
                const maxForkLength = constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MAX_FORK_LENGTH;
                if (block.header.height < currentHeight - maxForkLength) {
                    throw new consensus_error_1.ConsensusError("Fork exceeds maximum length");
                }
                const existingBlock = await this.db.getBlockByHeight(block.header.height);
                if (!existingBlock)
                    return block.hash;
                // Validate block timestamps
                if (block.header.timestamp < existingBlock.header.timestamp) {
                    throw new consensus_error_1.ConsensusError("Fork block timestamp invalid");
                }
                // DirectVoting handles vote calculation
                const winningHash = await Promise.race([
                    this.directVoting.handleChainFork(existingBlock.hash, block.hash, block.header.height, block.validators),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Fork resolution deadlock")), constants_1.BLOCKCHAIN_CONSTANTS.MINING.FORK_RESOLUTION_TIMEOUT_MS)),
                ]);
                metrics.success = true;
                return winningHash;
            });
        }
        finally {
            this.emitMetric("fork_resolution_attempts", metrics.attempts);
            this.emitMetric("fork_resolution_success", metrics.success ? 1 : 0);
            this.emitMetric("fork_resolution_time", Date.now() - metrics.startTime);
        }
    }
    /**
     * Calculates PoW score for a block
     * @param block Block to calculate score for
     * @returns Promise<number> PoW score
     */
    async calculatePowScore(block) {
        const difficulty = block.header.difficulty;
        const networkDifficulty = await this.pow.getNetworkDifficulty();
        return difficulty / networkDifficulty;
    }
    /**
     * Processes a new block
     * @param block Block to process
     * @returns Promise<Block> Processed block
     * @throws Error if block processing fails
     */
    async processBlock(block) {
        const processingTimer = performance_1.Performance.startTimer("block_processing");
        let timeoutId = setTimeout(() => { }, constants_1.BLOCKCHAIN_CONSTANTS.UTIL.PROCESSING_TIMEOUT_MS);
        try {
            const result = await Promise.race([
                this._processBlock(block),
                new Promise((_, reject) => {
                    timeoutId = setTimeout(() => {
                        reject(new consensus_error_1.ConsensusError("Block processing timeout exceeded"));
                    }, constants_1.BLOCKCHAIN_CONSTANTS.UTIL.PROCESSING_TIMEOUT_MS);
                }),
            ]);
            return result;
        }
        catch (error) {
            shared_1.Logger.error("Block processing failed:", error);
            throw error;
        }
        finally {
            clearTimeout(timeoutId);
            const duration = performance_1.Performance.stopTimer(processingTimer);
            this.emitMetric("block_processing_duration", duration);
        }
    }
    async _processBlock(block) {
        try {
            // 1. Create merkle root with timeout
            const txHashes = block.transactions.map((tx) => tx.hash);
            block.header.merkleRoot = await this.merkleTree.createRoot(txHashes);
            // 2. Mine block using PoW with circuit breaker
            let attempts = 0;
            const maxAttempts = constants_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_ATTEMPTS;
            while (attempts < maxAttempts) {
                try {
                    const minedBlock = await this.pow.mineBlock(block);
                    // 3. Log successful mining
                    await this.auditManager.logEvent({
                        type: audit_1.AuditEventType.POW_BLOCK,
                        severity: audit_1.AuditSeverity.INFO,
                        source: block.header.miner,
                        details: {
                            blockHash: minedBlock.hash,
                            height: minedBlock.header.height,
                            difficulty: minedBlock.header.difficulty,
                        },
                    });
                    return minedBlock;
                }
                catch (error) {
                    attempts++;
                    if (attempts >= maxAttempts)
                        throw error;
                    // Exponential backoff
                    await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempts), 30000)));
                }
            }
            throw new Error("Block processing failed after max attempts");
        }
        catch (error) {
            shared_1.Logger.error("Block processing error:", error);
            throw error;
        }
    }
    /**
     * Verifies merkle root of a block
     * @param block Block to verify
     * @returns Promise<boolean> True if merkle root is valid
     */
    async verifyMerkleRoot(block) {
        try {
            const txHashes = block.transactions.map((tx) => tx.hash);
            const computedRoot = await this.merkleTree.createRoot(txHashes);
            if (!computedRoot) {
                throw new Error("Failed to compute merkle root");
            }
            const isValid = computedRoot === block.header.merkleRoot;
            if (!isValid) {
                await this.logValidationFailure(block, "Merkle root mismatch");
            }
            return isValid;
        }
        catch (error) {
            shared_1.Logger.error("Merkle root verification failed:", error);
            await this.auditManager.logEvent({
                type: audit_1.AuditEventType.MERKLE_ERROR,
                severity: audit_1.AuditSeverity.ERROR,
                source: block.header.miner,
                details: { error: error.message },
            });
            return false;
        }
    }
    /**
     * Logs validation failure event
     * @param block Block that failed validation
     * @param reason Failure reason
     */
    async logValidationFailure(block, reason) {
        await this.auditManager.logEvent({
            type: audit_1.AuditEventType.VALIDATION_FAILED,
            severity: audit_1.AuditSeverity.WARNING,
            source: block.header.miner,
            details: { blockHash: block.hash, reason },
        });
    }
    /**
     * Logs successful validation event
     * @param block Validated block
     */
    async logSuccessfulValidation(block) {
        await this.auditManager.logEvent({
            type: audit_1.AuditEventType.VALIDATION_SUCCESS,
            severity: audit_1.AuditSeverity.INFO,
            source: block.header.miner,
            details: { blockHash: block.hash },
        });
    }
    /**
     * Logs validation error event
     * @param block Block that caused error
     * @param error Error details
     */
    async logValidationError(block, error) {
        await this.auditManager.logEvent({
            type: audit_1.AuditEventType.VALIDATION_ERROR,
            severity: audit_1.AuditSeverity.ERROR,
            source: block.header.miner,
            details: { blockHash: block.hash, error: error.message },
        });
    }
    /**
     * Gets consensus metrics
     * @returns Object containing various consensus metrics
     */
    getMetrics() {
        return {
            pow: this.pow.getMetrics(),
            voting: this.directVoting.getVotingMetrics(),
            votingPeriod: constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTING_PERIOD,
            minimumParticipation: constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_PARTICIPATION,
            performance: performance_1.Performance.getInstance().getMetrics(),
            cache: {
                size: this.blockCache.size(),
                hitRate: this.blockCache.getHitRate(),
                evictionCount: this.blockCache.getEvictionCount(),
            },
            retryStats: this.retryStrategy.getStats(),
        };
    }
    /**
     * Performs health check of consensus system
     * @returns Promise<boolean> True if system is healthy
     */
    async healthCheck() {
        if (this.isDisposed)
            return false;
        try {
            const [powHealth, votingHealth, dbHealth, cacheMetrics] = await Promise.all([
                this.pow.healthCheck(),
                this.directVoting.healthCheck(),
                this.db.ping(),
                this.validateCacheIntegrity(),
                this.getCacheMetrics(),
            ]);
            // Check cache health
            const isCacheHealthy = cacheMetrics.hitRate > 0.5 &&
                cacheMetrics.size < this.blockCache.maxSize &&
                cacheMetrics.memoryUsage <
                    Number(process.env.MAX_MEMORY_USAGE || Infinity);
            const isHealthy = powHealth && votingHealth && dbHealth && isCacheHealthy;
            if (!isHealthy) {
                shared_1.Logger.warn("Hybrid consensus health check failed", {
                    pow: powHealth,
                    voting: votingHealth,
                    db: dbHealth,
                    cache: cacheMetrics,
                });
            }
            return isHealthy;
        }
        catch (error) {
            shared_1.Logger.error("Health check failed:", error);
            return false;
        }
    }
    async validateCacheIntegrity() {
        return {
            hitRate: this.blockCache.getHitRate(),
            size: this.blockCache.size(),
            memoryUsage: process.memoryUsage().heapUsed,
            evictionCount: this.blockCache.getEvictionCount(),
        };
    }
    /**
     * Disposes of the consensus system
     * @returns Promise<void>
     */
    async dispose() {
        if (this.isDisposed)
            return;
        process.off("beforeExit", this.cleanupHandler);
        process.off("SIGINT", this.cleanupHandler);
        process.off("SIGTERM", this.cleanupHandler);
        this.blockCache.clear();
        await this.directVoting.close();
        await this.pow.dispose();
        this.isDisposed = true;
    }
    /**
     * Registers an event listener
     * @param event Event name
     * @param listener Event handler function
     */
    on(event, listener) {
        this.eventEmitter.on(event, listener);
    }
    off(event, listener) {
        this.eventEmitter.off(event, listener);
    }
    /**
     * Emits a metric event
     * @param name Metric name
     * @param value Metric value
     */
    emitMetric(name, value) {
        this.eventEmitter.emit("metric", {
            name,
            value,
            timestamp: Date.now(),
        });
    }
    /**
     * Handles cache eviction
     * @param key Cache key being evicted
     */
    handleCacheEviction(key) {
        try {
            // Add proper cleanup
            if (this.blockCache.has(key)) {
                this.blockCache.delete(key);
            }
            shared_1.Logger.debug(`Cache entry evicted: ${key}`);
        }
        catch (error) {
            shared_1.Logger.error(`Cache eviction error for key ${key}:`, error);
        }
    }
    /**
     * Checks if circuit breaker is open
     * @returns boolean True if circuit breaker is open
     */
    isCircuitOpen() {
        const now = Date.now();
        if (now - this.circuitBreaker.lastFailure >
            this.circuitBreaker.resetTimeout) {
            this.circuitBreaker.failures = 0;
            return false;
        }
        return this.circuitBreaker.failures >= this.circuitBreaker.threshold;
    }
    /**
     * Records a failure for circuit breaker
     */
    recordFailure() {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailure = Date.now();
    }
    /**
     * Warms up block cache with recent blocks
     * @param recentBlocks Number of recent blocks to cache
     */
    async warmupCache(recentBlocks = 100) {
        const retryOptions = {
            maxAttempts: 3,
            backoffMs: 1000,
            maxBackoffMs: 5000,
        };
        return this.cacheLock.runExclusive(async () => {
            const warmupWithRetry = async () => {
                try {
                    const latestHeight = await this.db.getCurrentHeight();
                    const startHeight = Math.max(0, latestHeight - recentBlocks);
                    // Use batch processing to avoid memory issues
                    const BATCH_SIZE = 20;
                    for (let height = startHeight; height <= latestHeight; height += BATCH_SIZE) {
                        const endHeight = Math.min(height + BATCH_SIZE, latestHeight);
                        const blocks = await Promise.all(Array.from({ length: endHeight - height + 1 }, (_, i) => this.db.getBlockByHeight(height + i)));
                        blocks.forEach((block) => {
                            if (block) {
                                this.blockCache.set(block.hash, true, {
                                    priority: 3,
                                    ttl: constants_1.BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL_HOURS * 3600,
                                });
                            }
                        });
                        // Allow other operations to proceed between batches
                        await new Promise((resolve) => setTimeout(resolve, 0));
                    }
                    shared_1.Logger.info(`Cache warmup completed for blocks ${startHeight} to ${latestHeight}`);
                }
                catch (error) {
                    shared_1.Logger.error("Cache warmup failed:", error);
                    throw error;
                }
            };
            // Implement retry logic
            let lastError = null;
            for (let attempt = 1; attempt <= retryOptions.maxAttempts; attempt++) {
                try {
                    await warmupWithRetry();
                    return;
                }
                catch (error) {
                    lastError = error;
                    if (attempt < retryOptions.maxAttempts) {
                        const backoff = Math.min(retryOptions.backoffMs * Math.pow(2, attempt - 1), retryOptions.maxBackoffMs);
                        await new Promise((resolve) => setTimeout(resolve, backoff));
                    }
                }
            }
            throw new Error(`Cache warmup failed after ${retryOptions.maxAttempts} attempts: ${lastError?.message}`);
        });
    }
    async validateParticipationReward(transaction, currentHeight) {
        try {
            // Verify PoW participation
            const hasValidPoW = await this.pow.validateWork(transaction.sender, await this.pow.getNetworkDifficulty());
            if (!hasValidPoW)
                return false;
            // Verify voting participation
            const hasVoted = await this.directVoting.hasParticipated(transaction.sender);
            if (!hasVoted)
                return false;
            // Verify reward amount matches consensus rules
            const expectedReward = await this.calculateParticipationReward(currentHeight);
            return transaction.outputs[0]?.amount === expectedReward;
        }
        catch (error) {
            shared_1.Logger.error("Participation reward validation failed:", error);
            return false;
        }
    }
    async calculateParticipationReward(height) {
        try {
            // Base reward
            let reward = constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.BASE_REWARD;
            // Adjust based on hybrid participation
            const votingRate = await this.directVoting.getParticipationRate();
            const powRate = await this.pow.getParticipationRate();
            const hybridRate = (votingRate + powRate) / 2;
            // Safely perform BigInt operations with bounds checking
            const safeMultiply = (a, b) => {
                const result = a * b;
                if (result < 0n ||
                    result > constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MAX_SAFE_REWARD) {
                    throw new Error("Reward calculation overflow");
                }
                return result;
            };
            const safeDivide = (a, b) => {
                if (b === 0n)
                    throw new Error("Division by zero");
                return a / b;
            };
            // Higher participation = lower rewards (to incentivize early participation)
            const participationFactor = BigInt(Math.floor(100 - hybridRate));
            reward = safeDivide(safeMultiply(reward, participationFactor), 100n);
            // Adjust based on block height (halving)
            const halvingInterval = constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.HALVING_INTERVAL;
            const halvings = Math.floor(height / halvingInterval);
            if (halvings > 64) {
                // Prevent excessive right shifts
                throw new Error("Halving calculation overflow");
            }
            reward = reward >> BigInt(halvings);
            // Network difficulty adjustment
            const difficultyFactor = await this.pow.getNetworkDifficulty(); // Kept the original network difficulty call
            const difficultyBigInt = BigInt(difficultyFactor);
            reward = safeDivide(safeMultiply(reward, difficultyBigInt), BigInt(constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.BASE_DIFFICULTY));
            // Minimum reward protection
            return reward > constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_REWARD
                ? reward
                : constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_REWARD;
        }
        catch (error) {
            shared_1.Logger.error("Failed to calculate participation reward:", error);
            return constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_REWARD;
        }
    }
    /**
     * Manual mining - mines a single block
     */
    async mineBlock() {
        return this.withErrorBoundary("mineBlock", async () => {
            const block = await this.pow.createAndMineBlock();
            if (await this.validateBlock(block)) {
                await this.blockchain.addBlock(block);
                return block;
            }
            throw new consensus_error_1.ConsensusError("Block validation failed");
        });
    }
    /**
     * Starts continuous mining process
     */
    startMining() {
        if (!this.isDisposed) {
            this.pow.startMining();
            shared_1.Logger.info("Hybrid consensus mining started");
        }
    }
    /**
     * Stops the mining process
     */
    stopMining() {
        this.pow.stopMining();
        shared_1.Logger.info("Hybrid consensus mining stopped");
    }
    async withErrorBoundary(operation, fn) {
        try {
            return await fn();
        }
        catch (error) {
            shared_1.Logger.error(`Error in ${operation}:`, error);
            throw error;
        }
    }
    cleanupCircuitBreaker() {
        const now = Date.now();
        if (now - this.circuitBreaker.lastFailure >
            this.circuitBreaker.resetTimeout) {
            this.circuitBreaker.failures = 0;
        }
    }
    registerCleanupHandler() {
        this.cleanupHandler = async () => {
            if (!this.isDisposed) {
                await this.dispose();
            }
        };
        process.on("beforeExit", this.cleanupHandler);
        process.on("SIGINT", this.cleanupHandler);
        process.on("SIGTERM", this.cleanupHandler);
    }
    getCacheMetrics() {
        return {
            size: this.blockCache.size(),
            hitRate: this.blockCache.getHitRate(),
            evictionCount: this.blockCache.getEvictionCount(),
            memoryUsage: process.memoryUsage().heapUsed,
        };
    }
    /**
     * Updates consensus state after new block addition
     * @param block The newly added block
     */
    async updateState(block) {
        try {
            // Update voting state
            await this.directVoting.updateVotingState(async (currentState) => {
                // Process block and return updated voting state
                return {
                    ...currentState,
                    lastBlockHash: block.hash,
                    height: block.header.height,
                    timestamp: block.header.timestamp,
                };
            });
            // Update PoW state
            await this.pow.updateDifficulty(block);
            // Update cache
            this.blockCache.set(block.hash, true);
        }
        catch (error) {
            shared_1.Logger.error("Failed to update consensus state:", error);
            throw error;
        }
    }
}
exports.HybridDirectConsensus = HybridDirectConsensus;
//# sourceMappingURL=hybrid-direct.js.map