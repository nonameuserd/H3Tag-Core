"use strict";
/**
 * @fileoverview Blockchain implements the core blockchain functionality including block processing,
 * chain management, consensus coordination, and network synchronization. It integrates PoW mining
 * and voting-based governance through a hybrid consensus mechanism.
 *
 * @module Blockchain
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Blockchain = void 0;
/**
 * Blockchain class manages the core blockchain operations and state.
 *
 * @class Blockchain
 *
 * @property {Block[]} chain - Array of blocks in the blockchain
 * @property {UTXOSet} utxoSet - Unspent transaction output set
 * @property {Mempool} mempool - Transaction memory pool
 * @property {Map<string, Peer>} peers - Connected network peers
 * @property {Block} genesisBlock - Genesis block of the chain
 * @property {number} totalSupply - Total currency supply
 * @property {BlockchainConfig} config - Blockchain configuration
 * @property {HybridDirectConsensus} consensus - Consensus mechanism
 * @property {BlockchainSchema} db - Database interface
 * @property {ShardManager} shardManager - Sharding manager
 * @property {BlockchainSync} sync - Chain synchronization
 * @property {Node} node - Network node instance
 * @property {number} minConfirmations - Minimum confirmations for transaction finality
 * @property {EventEmitter} eventEmitter - Event emitter for blockchain events
 *
 * @example
 * const blockchain = new Blockchain(config);
 * await blockchain.initialize();
 * await blockchain.addBlock(block);
 */
/**
 * Creates a new Blockchain instance
 *
 * @constructor
 * @param {Partial<BlockchainConfig>} config - Optional blockchain configuration
 */
/**
 * Initializes the blockchain asynchronously
 *
 * @async
 * @method initializeAsync
 * @param {Partial<BlockchainConfig>} config - Optional configuration override
 * @returns {Promise<void>}
 * @throws {Error} If initialization fails
 *
 * @example
 * await blockchain.initializeAsync({
 *   network: 'testnet',
 *   maxBlockSize: 2000000
 * });
 */
/**
 * Adds a new block to the chain
 *
 * @async
 * @method addBlock
 * @param {Block} block - Block to add
 * @returns {Promise<void>}
 * @throws {Error} If block validation fails
 *
 * @example
 * const block = await miner.mineBlock();
 * await blockchain.addBlock(block);
 */
/**
 * Gets block by height
 *
 * @method getBlockByHeight
 * @param {number} height - Block height
 * @returns {Block | undefined} Block at height if found
 *
 * @example
 * const block = blockchain.getBlockByHeight(1000);
 */
/**
 * Gets block by hash
 *
 * @method getBlockByHash
 * @param {string} hash - Block hash
 * @returns {Block | undefined} Block with hash if found
 *
 * @example
 * const block = blockchain.getBlockByHash('0x...');
 */
/**
 * Gets current blockchain height
 *
 * @method getCurrentHeight
 * @returns {number} Current chain height
 */
/**
 * Gets chain tip (latest block)
 *
 * @method getChainTip
 * @returns {ChainTip} Current chain tip info
 */
/**
 * Validates a transaction
 *
 * @async
 * @method validateTransaction
 * @param {Transaction} transaction - Transaction to validate
 * @param {boolean} [mempool=false] - Whether transaction is from mempool
 * @returns {Promise<boolean>} True if transaction is valid
 *
 * @example
 * const isValid = await blockchain.validateTransaction(tx);
 */
/**
 * Gets transaction by hash
 *
 * @async
 * @method getTransaction
 * @param {string} hash - Transaction hash
 * @returns {Promise<Transaction | undefined>} Transaction if found
 *
 * @example
 * const tx = await blockchain.getTransaction('0x...');
 */
/**
 * @typedef {Object} ChainTip
 * @property {number} height - Block height
 * @property {string} hash - Block hash
 * @property {number} branchLen - Length of branch
 * @property {'active' | 'valid-fork' | 'valid-headers' | 'invalid'} status - Tip status
 * @property {string} [firstBlockHash] - Hash of first block in branch
 * @property {number} [lastValidatedAt] - Timestamp of last validation
 */
/**
 * @typedef {Object} DbSolution
 * @property {Object} data - Solution data
 * @property {string} data.blockHash - Block hash
 * @property {number} data.nonce - Solution nonce
 * @property {number} data.difficulty - Block difficulty
 * @property {string} data.minerAddress - Miner's address
 * @property {string} data.signature - Solution signature
 * @property {number} timestamp - Solution timestamp
 */
/**
 * @typedef {Object} PowSolution
 * @property {string} blockHash - Block hash
 * @property {number} nonce - Solution nonce
 * @property {number} difficulty - Block difficulty
 * @property {number} timestamp - Solution timestamp
 * @property {string} minerAddress - Miner's address
 * @property {string} signature - Solution signature
 * @property {boolean} [verified] - Whether solution is verified
 */
const utxo_model_1 = require("../models/utxo.model");
const mempool_1 = require("./mempool");
const shared_1 = require("@h3tag-blockchain/shared");
const events_1 = require("events");
const blockchain_schema_1 = require("../database/blockchain-schema");
const hybrid_direct_1 = require("./consensus/hybrid-direct");
const crypto_1 = require("@h3tag-blockchain/crypto");
const sync_1 = require("../network/sync");
const peer_1 = require("../network/peer");
const constants_1 = require("./utils/constants");
const block_validator_1 = require("../validators/block.validator");
const blockchain_stats_1 = require("./blockchain-stats");
const block_model_1 = require("../models/block.model");
const dnsSeed_1 = require("../network/dnsSeed");
const cache_1 = require("../scaling/cache");
const sharding_1 = require("../scaling/sharding");
const health_1 = require("../monitoring/health");
const async_mutex_1 = require("async-mutex");
const node_1 = require("../network/node");
const merkle_1 = require("../utils/merkle");
const transaction_validator_1 = require("../validators/transaction.validator");
const shared_2 = require("@h3tag-blockchain/shared");
const rateLimit_1 = require("../security/rateLimit");
const audit_1 = require("../security/audit");
const circuit_breaker_1 = require("../network/circuit-breaker");
const error_monitor_1 = require("../network/error-monitor");
const metrics_collector_1 = require("../monitoring/metrics-collector");
const retry_1 = require("../utils/retry");
const ddos_1 = require("../security/ddos");
class Blockchain {
    /**
     * Creates a new blockchain instance with the specified configuration
     * @param config Optional blockchain configuration parameters
     */
    constructor(config) {
        this.minConfirmations = 6; // Standard value for most blockchains
        this.heightCache = null;
        this.eventEmitter = new events_1.EventEmitter();
        this.utxoCache = new cache_1.Cache({
            ttl: 300000,
            maxSize: 100000,
            compression: true,
        });
        this.utxoSetCache = new cache_1.Cache({
            ttl: 300000,
            maxSize: 1,
            compression: true,
        });
        this.transactionCache = new cache_1.Cache();
        this.firstTxCache = new cache_1.Cache();
        this.spentTxTracker = new Map();
        this.txLock = new async_mutex_1.Mutex();
        this.MEMPOOL_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours
        this.MAX_MEMPOOL_SIZE = 50000; // Maximum transactions in mempool
        this.blacklistedAddresses = new Set();
        this.MAX_REORG_DEPTH = 100; // Maximum blocks to reorganize
        this.reorgLock = new async_mutex_1.Mutex();
        this.errorHandler = {
            handle: (error, context) => {
                shared_1.Logger.error(`[${context}] ${error.message}`, {
                    stack: error.stack,
                    timestamp: new Date().toISOString(),
                    blockHeight: this.getCurrentHeight(),
                });
                // Emit error event for monitoring
                this.eventEmitter.emit("blockchain_error", {
                    context,
                    error: error.message,
                    timestamp: Date.now(),
                });
            },
        };
        this.cacheLock = new async_mutex_1.Mutex();
        this.circuitBreakers = new Map();
        this.mutex = new async_mutex_1.Mutex();
        this.healthCheckInterval = 60000; // 1 minute
        this.validationInterval = 3600000; // 1 hour
        this.chainLock = new async_mutex_1.Mutex();
        this.metrics = new metrics_collector_1.MetricsCollector("blockchain", 60000);
        this.errorMonitor = new error_monitor_1.ErrorMonitor();
        this.auditManager = new audit_1.AuditManager();
        this.merkleTree = new merkle_1.MerkleTree();
        this.node = new node_1.Node(this, this.db, this.mempool, new shared_2.ConfigService(this.config), this.auditManager);
        this.healthMonitor = new health_1.HealthMonitor({
            interval: 1000,
            thresholds: {
                minPowHashrate: 0.8,
                minPowNodes: 0.8,
                minTagDistribution: 0.8,
                maxTagConcentration: 0.8,
            },
        });
        this.initializeAsync(config);
        this.hybridCrypto = crypto_1.HybridCrypto;
        // Initialize caches with appropriate options
        this.blockCache = new cache_1.Cache({
            ttl: 3600,
            maxSize: 1000,
            compression: true,
            priorityLevels: {
                pow: 3,
                quadratic_vote: 3,
            },
        });
        this.transactionCache = new cache_1.Cache({
            ttl: 1800,
            maxSize: 5000,
            compression: true,
        });
        this.utxoCache = new cache_1.Cache({
            ttl: 300000,
            maxSize: 100000,
            compression: true,
        });
        // Set up periodic maintenance tasks
        setInterval(() => this.cleanupMempool(), 60000); // Clean mempool every minute
        setInterval(() => this.updatePeerScores(), 300000); // Update peer scores every 5 minutes
        // Initialize rate limiter cleanup
        setInterval(() => {
            const now = Date.now();
            const keys = this.rateLimiter.getActiveKeys();
            keys.forEach((key) => {
                if (now - this.rateLimiter.getLastAccess(key) > 60000) {
                    this.rateLimiter.resetLimit(key);
                }
            });
        }, 60000);
        // Initialize peer manager
        this.peerManager = new peer_1.Peer(this.config.network.host, this.config.network.port || 8333, {
            minPingInterval: 30000,
            handshakeTimeout: 5000,
            maxBanScore: 100,
        }, new shared_2.ConfigService(this.config), this.db);
        // Set up peer event handlers
        this.peerManager.eventEmitter.on("peer_banned", this.handlePeerBanned.bind(this));
        this.peerManager.eventEmitter.on("peer_violation", this.handlePeerViolation.bind(this));
        this.rateLimiter = new rateLimit_1.RateLimit({
            windowMs: 60000,
            maxRequests: {
                pow: 200,
                qudraticVote: 100,
                default: 50,
            },
        }, this.auditManager);
        // Initialize error monitoring
        this.errorMonitor.setThreshold("CONSENSUS_ERROR", 5);
        this.errorMonitor.setThreshold("NETWORK_ERROR", 10);
        this.errorMonitor.onThresholdExceeded((type, count) => {
            shared_1.Logger.alert(`Error threshold exceeded for ${type}: ${count} occurrences`);
        });
        this.circuitBreakers.set("network", new circuit_breaker_1.CircuitBreaker({
            failureThreshold: 0.5,
            monitorInterval: 30000,
            resetTimeout: 60000,
        }));
        this.circuitBreakers.set("consensus", new circuit_breaker_1.CircuitBreaker({
            failureThreshold: 0.5,
            monitorInterval: 30000,
            resetTimeout: 60000,
        }));
        // Initialize metrics collector with blockchain namespace
        this.metrics = new metrics_collector_1.MetricsCollector("blockchain", 60000); // Flush every minute
        // Initialize retry strategy with configuration
        this.retryStrategy = new retry_1.RetryStrategy({
            maxAttempts: 3,
            delay: 1000,
            exponentialBackoff: true,
            maxDelay: 10000,
            retryableErrors: [
                /network error/i,
                /timeout/i,
                "Connection refused",
                "ECONNRESET",
            ],
            jitterFactor: 0.25,
        });
        // Bind event handlers
        this.boundSyncCompleted = this.handleSyncCompleted.bind(this);
        this.boundSyncError = this.handleSyncError.bind(this);
        // Add listeners
        this.sync.on("sync_completed", this.boundSyncCompleted);
        this.sync.on("sync_error", this.boundSyncError);
        // Start periodic health checks
        this.healthCheckTimer = setInterval(async () => {
            try {
                const isHealthy = await this.healthCheck();
                if (!isHealthy) {
                    shared_1.Logger.warn("Blockchain health check failed");
                    this.metrics.increment("health_check_failures");
                    this.eventEmitter.emit("health_check_failed");
                }
            }
            catch (error) {
                shared_1.Logger.error("Health check error:", error);
            }
        }, this.healthCheckInterval);
        // Start periodic validation
        this.startPeriodicValidation();
        // Start blockchain on initialization
        this.start().catch((error) => {
            shared_1.Logger.error("Failed to start blockchain:", error);
        });
        this.ddosProtection = new ddos_1.DDoSProtection({
            maxRequests: {
                default: 300,
                pow: 100,
                qudraticVote: 100,
            },
            windowMs: 60000,
            blockDuration: 1800000, // 30 minutes
        }, this.auditManager);
    }
    /**
     * Initializes blockchain components asynchronously
     * @param config Optional blockchain configuration
     * @throws Error if initialization fails
     */
    async initializeAsync(config) {
        try {
            await crypto_1.KeyManager.initialize();
            this.config = this.initializeConfig(config);
            this.db = new blockchain_schema_1.BlockchainSchema();
            this.peers = new Map();
            this.totalSupply = 0;
            // Load chain state from database
            const chainState = await this.db.getChainState();
            if (chainState) {
                // Rebuild chain from database
                this.chain = await this.db.getBlocksFromHeight(0, chainState.height + 1);
            }
            else {
                // Initialize new chain with genesis block
                this.chain = [];
                this.genesisBlock = this.createGenesisBlock();
                await this.db.saveBlock(this.genesisBlock);
                this.chain.push(this.genesisBlock);
            }
            // Initialize core components
            this.utxoSet = new utxo_model_1.UTXOSet();
            this.mempool = new mempool_1.Mempool(this);
            // Give BlockValidator access to this blockchain instance
            block_validator_1.BlockValidator.setBlockchain({
                getCurrentHeight: () => this.getCurrentHeight(),
                getLatestBlock: () => this.getLatestBlock(),
                getMempool: () => this.getMempool(),
                getBlockchainStats: () => this.getBlockchainStats(),
            });
            // Initialize shard manager
            this.shardManager = new sharding_1.ShardManager({
                shardCount: 16,
                votingShards: 8,
                powShards: 8,
                maxShardSize: 1000000,
                replicationFactor: 3,
                reshardThreshold: 0.8,
                syncInterval: 60000,
            }, this.db);
            // Initialize consensus with 4-year voting period
            this.consensus = new hybrid_direct_1.HybridDirectConsensus(this);
            // Initialize other components
            this.sync = new sync_1.BlockchainSync(this, this.mempool, this.peers, this.consensusPublicKey, this.db);
            // Setup event listeners
            this.setupEventListeners();
            // Initialize keys
            await this.initializeKeys();
            // Add memory monitoring
            this.monitorMemoryUsage();
        }
        catch (error) {
            this.errorHandler.handle(error, "initialization");
            throw error; // Rethrow to prevent partial initialization
        }
    }
    /**
     * Initializes keys for consensus
     * @returns Promise<void>
     */
    async initializeKeys() {
        const keyPair = await crypto_1.QuantumCrypto.generateKeyPair();
        this.consensusPublicKey = {
            publicKey: keyPair.publicKey.toString("hex"),
        };
    }
    /**
     * Sets up event listeners
     * @returns void
     */
    setupEventListeners() {
        // Fix: Store references to bound listeners for cleanup
        this.boundSyncCompleted = () => this.eventEmitter.emit("blockchain_synced");
        this.boundSyncError = (error) => {
            shared_1.Logger.error("Blockchain sync error:", error);
            this.eventEmitter.emit("sync_error", error);
        };
        this.sync.on("sync_completed", this.boundSyncCompleted);
        this.sync.on("sync_error", this.boundSyncError);
    }
    /**
     * Creates a new blockchain instance
     * @param config Optional blockchain configuration
     * @returns Promise<Blockchain> New blockchain instance
     */
    static async create(config) {
        if (!Blockchain.instance) {
            Blockchain.instance = new Blockchain(config);
            await Blockchain.instance.initializeAsync(config);
        }
        return Blockchain.instance;
    }
    /**
     * Create the genesis block
     */
    createGenesisBlock() {
        const timestamp = Date.now();
        const block = {
            header: {
                version: 1,
                previousHash: "0".repeat(64),
                merkleRoot: "",
                validatorMerkleRoot: "",
                timestamp,
                difficulty: 1,
                nonce: 0,
                height: 0,
                miner: "0".repeat(40),
                totalTAG: 0,
                blockReward: 50,
                fees: 0,
                consensusData: {
                    powScore: 0,
                    votingScore: 0,
                    participationRate: 0,
                    periodId: 0,
                },
                signature: "",
                publicKey: "",
                hash: "",
                minerAddress: "",
                target: "",
            },
            transactions: [],
            votes: [],
            validators: [],
            hash: "",
            timestamp: timestamp,
            verifyHash: async () => {
                const calculatedHash = await crypto_1.HybridCrypto.hash(JSON.stringify(block.header));
                return calculatedHash === block.hash;
            },
            verifySignature: async () => {
                return crypto_1.HybridCrypto.verify(block.hash, block.header.signature, block.header.publicKey);
            },
            getHeaderBase: () => block.getHeaderBase(),
            isComplete() {
                return !!(this.hash &&
                    this.header &&
                    this.transactions?.length >= 0 &&
                    this.header.merkleRoot &&
                    this.header.timestamp &&
                    this.header.nonce);
            },
        };
        block.hash = this.calculateBlockHash(block);
        return block;
    }
    /**
     * Adds a new block to the blockchain
     * @param block The block to be added
     * @returns Promise<boolean> True if block was added successfully
     * @throws Error if block validation fails
     */
    async addBlock(block) {
        return this.withErrorBoundary("addBlock", async () => {
            const startTime = performance.now();
            const release = await this.chainLock.acquire();
            try {
                // System health validation
                if (!(await this.healthCheck())) {
                    throw new Error("UNHEALTHY_STATE, System unhealthy, cannot add block");
                }
                // Validate block before processing
                await this.validateBlockPreAdd(block);
                // Create immutable chain copy for atomic update
                const chainCopy = [...this.chain];
                chainCopy.push(block);
                // Atomic updates with rollback on failure
                try {
                    await this.db.startTransaction();
                    await this.db.saveBlock(block);
                    await this.db.updateChainState({
                        height: this.chain.length - 1,
                        lastBlockHash: block.hash,
                        timestamp: Date.now(),
                    });
                    await this.utxoSet.applyBlock(block);
                    // Update chain reference only after successful DB update
                    this.chain = chainCopy;
                    await this.db.commitTransaction();
                    // Post-commit updates that can be retried if failed
                    await this.updatePostBlockAdd(block);
                    this.metrics.emitMetrics(block, performance.now() - startTime);
                    return true;
                }
                catch (error) {
                    shared_1.Logger.error("Block addition failed, rolling back:", error);
                    throw new Error(error.message);
                }
            }
            finally {
                release();
            }
        });
    }
    async validateBlockPreAdd(block) {
        const [signatureValid, consensusValid] = await Promise.all([
            crypto_1.HybridCrypto.verify(block.hash, block.header.signature, block.header.publicKey),
            this.consensus.pow.validateBlock(block),
        ]);
        if (!signatureValid) {
            throw new Error("INVALID_SIGNATURE, Invalid block signature");
        }
        if (!consensusValid) {
            throw new Error("CONSENSUS_INVALID, Block failed consensus validation");
        }
    }
    /**
     * Calculate block hash
     */
    calculateBlockHash(block) {
        const header = block.header;
        const data = header.version +
            header.previousHash +
            header.merkleRoot +
            header.timestamp +
            header.difficulty +
            header.nonce;
        return crypto_1.HashUtils.sha3(data);
    }
    /**
     * Get block by hash with caching and validation
     */
    async getBlock(hash) {
        try {
            // Check cache first
            const cachedBlock = this.blockCache.get(hash);
            if (cachedBlock) {
                return Promise.resolve(cachedBlock);
            }
            // If not in cache, get from database
            return this.db
                .getBlock(hash)
                .then((block) => {
                if (block) {
                    this.blockCache.set(hash, block);
                }
                return block;
            })
                .catch((error) => {
                shared_1.Logger.error("Error retrieving block from database:", error);
                return undefined;
            });
        }
        catch (error) {
            shared_1.Logger.error("Error retrieving block:", error);
            return Promise.resolve(undefined);
        }
    }
    /**
     * Get block by height
     */
    getBlockByHeight(height) {
        return this.chain[height];
    }
    /**
     * Get current chain height with caching
     * @returns number The current blockchain height
     */
    getHeight() {
        try {
            // Use cached height if available
            if (this.heightCache?.value !== undefined &&
                Date.now() - (this.heightCache.timestamp || 0) <
                    constants_1.BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL) {
                return this.heightCache.value;
            }
            // Calculate new height
            const height = Math.max(0, this.chain.length - 1);
            // Update cache
            this.heightCache = {
                value: height,
                timestamp: Date.now(),
            };
            // Update metrics
            this.metrics.gauge("blockchain_height", height);
            return height;
        }
        catch (error) {
            shared_1.Logger.error("Error getting blockchain height:", error);
            // Fallback to calculating height directly
            return Math.max(0, this.chain.length - 1);
        }
    }
    /**
     * Get UTXO set
     */
    async getUTXOSet() {
        try {
            // Check cache first
            const cachedUtxoSet = this.utxoSetCache.get("current");
            if (cachedUtxoSet) {
                return cachedUtxoSet;
            }
            // Validate and cache UTXO set
            if (!this.utxoSet.validate()) {
                this.rebuildUTXOSet();
            }
            this.utxoSetCache.set("current", this.utxoSet);
            return this.utxoSet;
        }
        catch (error) {
            shared_1.Logger.error("Error getting UTXO set:", error);
            throw error;
        }
    }
    /**
     * Rebuilds UTXO set
     */
    rebuildUTXOSet() {
        try {
            const newUtxoSet = new utxo_model_1.UTXOSet();
            // Rebuild from genesis block
            for (const block of this.chain) {
                for (const tx of block.transactions) {
                    // Remove spent outputs
                    for (const input of tx.inputs) {
                        const utxo = newUtxoSet.getUtxo(input.txId, input.outputIndex);
                        if (utxo) {
                            newUtxoSet.remove(utxo);
                        }
                    }
                    // Add new outputs
                    tx.outputs.forEach((output, index) => {
                        newUtxoSet.add({
                            txId: tx.id,
                            outputIndex: index,
                            amount: output.amount,
                            address: output.address,
                            script: output.script || "",
                            timestamp: block.header.timestamp,
                            spent: false,
                            currency: {
                                name: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
                                symbol: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
                                decimals: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
                            },
                            publicKey: tx.sender,
                            confirmations: 0,
                        });
                    });
                }
            }
            this.utxoSet = newUtxoSet;
            shared_1.Logger.info("UTXO set rebuilt successfully");
        }
        catch (error) {
            shared_1.Logger.error("Failed to rebuild UTXO set:", error);
            throw error;
        }
    }
    /**
     * Get current difficulty
     */
    getCurrentDifficulty() {
        try {
            // If chain is empty or only genesis block exists, return initial difficulty
            if (this.chain.length <= 1) {
                return constants_1.BLOCKCHAIN_CONSTANTS.MINING.INITIAL_DIFFICULTY;
            }
            const latestBlock = this.chain[this.chain.length - 1];
            if ((latestBlock.header.height + 1) %
                constants_1.BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY_ADJUSTMENT_INTERVAL !==
                0) {
                return latestBlock.header.difficulty;
            }
            const lastAdjustmentBlock = this.chain[this.chain.length -
                constants_1.BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY_ADJUSTMENT_INTERVAL];
            if (!lastAdjustmentBlock) {
                return latestBlock.header.difficulty;
            }
            const actualTimespan = latestBlock.header.timestamp - lastAdjustmentBlock.header.timestamp;
            let adjustedTimespan = actualTimespan;
            adjustedTimespan = Math.max(actualTimespan / constants_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_ADJUSTMENT_FACTOR, actualTimespan * constants_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_ADJUSTMENT_FACTOR);
            const newDifficulty = (latestBlock.header.difficulty *
                constants_1.BLOCKCHAIN_CONSTANTS.MINING.TARGET_TIMESPAN) /
                adjustedTimespan;
            return Math.max(newDifficulty, constants_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_DIFFICULTY);
        }
        catch (error) {
            shared_1.Logger.error("Error calculating difficulty:", error);
            return constants_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_DIFFICULTY;
        }
    }
    /**
     * Validate the entire chain
     */
    async validateChain() {
        try {
            for (let i = 1; i < this.chain.length; i++) {
                const currentBlock = this.chain[i];
                const previousBlock = this.chain[i - 1];
                // Validate block hash
                if (currentBlock.hash !==
                    this.consensus.pow.calculateBlockHash(currentBlock)) {
                    return false;
                }
                // Validate previous hash reference
                if (currentBlock.header.previousHash !== previousBlock.hash) {
                    return false;
                }
                // Validate block using consensus rules
                if (!(await this.consensus.validateBlock(currentBlock))) {
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            shared_1.Logger.error("Chain validation failed:", error);
            return false;
        }
    }
    /**
     * Get chain state
     */
    getState() {
        return {
            chain: [...this.chain],
            utxoSet: this.utxoSet,
            height: this.getHeight(),
            totalSupply: this.getTotalSupply(),
        };
    }
    getMempool() {
        return this.mempool;
    }
    getTotalSupply() {
        return this.totalSupply;
    }
    async getPowSolutions(minerAddress, sinceTimestamp) {
        try {
            const solutions = (await this.db.find({
                type: "pow_solution",
                "data.minerAddress": minerAddress,
                timestamp: { $gte: sinceTimestamp },
            }));
            return solutions.map((sol) => ({
                blockHash: sol.data.blockHash,
                nonce: sol.data.nonce,
                difficulty: sol.data.difficulty,
                timestamp: sol.timestamp,
                minerAddress: sol.data.minerAddress,
                signature: sol.data.signature,
            }));
        }
        catch (error) {
            shared_1.Logger.error("Failed to get PoW solutions:", error);
            return [];
        }
    }
    getConfig() {
        return {
            blockchain: {
                maxSupply: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.MAX_SUPPLY,
                blockTime: constants_1.BLOCKCHAIN_CONSTANTS.MINING.BLOCK_TIME,
            },
        };
    }
    async start() {
        // Add event listener for mined blocks
        this.consensus.pow.on("blockMined", async (data) => {
            await this.handleBlockMined(data.block);
        });
        await this.sync.startSync();
    }
    async stop() {
        // Remove event listener
        this.consensus.pow.off("blockMined", this.handleBlockMined);
        crypto_1.KeyManager.shutdown();
        await this.sync.stop();
    }
    /**
     * Get blockchain stats
     */
    getBlockchainStats() {
        return new blockchain_stats_1.BlockchainStats({
            getConsensusMetrics: this.getConsensusMetrics,
            getCurrentHeight: this.getCurrentHeight,
            getLatestBlock: this.getLatestBlock,
            getTransaction: this.getTransaction,
            getCurrencyDetails: this.getCurrencyDetails,
            calculateBlockReward: this.calculateBlockReward,
            getConfirmedUtxos: this.getConfirmedUtxos,
            getHeight: this.getHeight,
            getBlockByHeight: this.getBlockByHeight,
            getCurrentDifficulty: this.getCurrentDifficulty,
            getState: this.getState,
        });
    }
    getCurrentHeight() {
        return this.chain.length - 1;
    }
    getLatestBlock() {
        if (this.chain.length === 0)
            return null;
        return this.chain[this.chain.length - 1];
    }
    /**
     * Calculates the merkle root for a given set of transactions
     * @param transactions Transactions to calculate the merkle root for
     * @returns Promise<string> The merkle root
     */
    async calculateMerkleRoot(transactions) {
        try {
            const txData = transactions.map((tx) => {
                try {
                    return JSON.stringify({
                        id: tx.id,
                        sender: tx.sender,
                        recipients: tx.outputs.map((o) => o.address),
                        amount: tx.outputs.reduce((sum, o) => {
                            const amount = BigInt(o.amount);
                            if (amount < 0n)
                                throw new Error("Negative amount");
                            return sum + amount;
                        }, 0n),
                    });
                }
                catch (error) {
                    throw new Error(`Invalid transaction data: ${error.message}`);
                }
            });
            return await this.merkleTree.createRoot(txData);
        }
        catch (error) {
            shared_1.Logger.error("Merkle root calculation failed:", error);
            throw error;
        }
    }
    /**
     * Mines a new block
     * @param transactions Transactions to include in the block
     * @returns Promise<Block> Newly mined block
     */
    async mineNewBlock(transactions) {
        const previousBlock = this.getLatestBlock();
        const nextHeight = previousBlock ? previousBlock.header.height + 1 : 0;
        // Calculate merkle root for transactions
        const merkleRoot = await this.calculateMerkleRoot(transactions);
        const blockBuilder = new block_model_1.BlockBuilder(previousBlock ? previousBlock.hash : "", constants_1.BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY, this.auditManager);
        blockBuilder.header.height = nextHeight;
        blockBuilder.header.merkleRoot = merkleRoot;
        await blockBuilder.setTransactions(transactions);
        const newBlock = await blockBuilder.build({
            address: this.config.wallet.address,
            publicKey: this.config.wallet.publicKey,
            privateKey: this.config.wallet.privateKey,
        });
        // Sign the block before consensus
        await this.signBlock(newBlock, this.config.wallet.privateKey);
        // Use hybrid consensus to mine and validate block
        const minedBlock = await this.consensus.processBlock(newBlock);
        await this.addBlock(minedBlock);
        return minedBlock;
    }
    /**
     * Gets transaction by hash
     * @param hash Transaction hash
     * @returns Promise<Transaction|undefined> Transaction if found
     */
    async getTransaction(hash) {
        return this.withErrorBoundary("getTransaction", async () => {
            // Try cache first
            const cached = this.transactionCache.get(hash);
            if (cached)
                return cached;
            // If not in cache, try shards
            return await this.shardManager.getTransaction(hash);
        });
    }
    /**
     * Get currency details including current supply
     */
    getCurrencyDetails() {
        return {
            name: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
            symbol: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
            decimals: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
            totalSupply: this.getTotalSupply(),
            maxSupply: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.MAX_SUPPLY,
            circulatingSupply: this.getCirculatingSupply(),
        };
    }
    /**
     * Calculate block reward at given height with additional security and precision
     */
    calculateBlockReward(height) {
        try {
            // Validate height
            if (height < 0) {
                shared_1.Logger.warn("Invalid block height for reward calculation", { height });
                return BigInt(0);
            }
            // Get currency details
            const currency = {
                name: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
                symbol: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
                decimals: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
                maxSupply: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.MAX_SUPPLY,
            };
            // Check max supply
            const currentSupply = this.getTotalSupply();
            if (currentSupply >= currency.maxSupply) {
                return BigInt(0);
            }
            // Calculate halvings with safety bounds
            const halvingInterval = constants_1.BLOCKCHAIN_CONSTANTS.MINING.HALVING_INTERVAL;
            const maxHalvings = constants_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_HALVINGS;
            const halvings = Math.min(Math.floor(height / halvingInterval), maxHalvings);
            // Calculate reward using BigInt
            const initialReward = constants_1.BLOCKCHAIN_CONSTANTS.MINING.INITIAL_REWARD;
            const reward = initialReward >> BigInt(halvings);
            // Apply minimum reward check
            const minReward = constants_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_REWARD;
            return reward > minReward ? reward : minReward;
        }
        catch (error) {
            shared_1.Logger.error("Error calculating block reward:", error);
            return BigInt(0);
        }
    }
    /**
     * Get circulating supply (excluding burned/locked tokens)
     */
    getCirculatingSupply() {
        return Number(this.utxoSet.getTotalValue());
    }
    /**
     * Get confirmed UTXOs for an address
     * @param address Address to get UTXOs for
     * @returns Promise<Array<{ txid: string; vout: number; amount: number; confirmations: number; }>> Confirmed UTXOs
     */
    async getConfirmedUtxos(address) {
        const utxos = await this.db.getUtxosByAddress(address);
        return utxos.filter((utxo) => utxo.confirmations >= this.minConfirmations);
    }
    /**
     * Initializes blockchain configuration
     * @param config Partial blockchain configuration
     * @returns Blockchain configuration
     */
    initializeConfig(config) {
        return {
            currency: config?.currency || {
                name: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
                symbol: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
                decimals: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
                maxSupply: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.MAX_SUPPLY,
                initialSupply: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.INITIAL_SUPPLY,
                units: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS,
            },
            consensus: config?.consensus || {
                powWeight: constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.POW_WEIGHT,
                voteWeight: constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_WEIGHT,
                minPowHashrate: constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_POW_HASH_RATE,
                minVoterCount: constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_VOTER_COUNT,
                minPeriodLength: constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_PERIOD_LENGTH,
                votingPeriod: constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTING_PERIOD,
                minParticipation: constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_PARTICIPATION,
                votePowerCap: constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTE_POWER_CAP,
                votingDayPeriod: constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTING_DAY_PERIOD,
                consensusTimeout: constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.CONSENSUS_TIMEOUT,
                emergencyTimeout: constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.EMERGENCY_TIMEOUT,
            },
            mining: config?.mining || {
                blocksPerYear: constants_1.BLOCKCHAIN_CONSTANTS.MINING.BLOCKS_PER_YEAR,
                initialReward: constants_1.BLOCKCHAIN_CONSTANTS.MINING.INITIAL_REWARD,
                halvingInterval: constants_1.BLOCKCHAIN_CONSTANTS.MINING.HALVING_INTERVAL,
                maxHalvings: constants_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_HALVINGS,
                blockTime: constants_1.BLOCKCHAIN_CONSTANTS.MINING.BLOCK_TIME,
                maxDifficulty: constants_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_DIFFICULTY,
                targetTimePerBlock: constants_1.BLOCKCHAIN_CONSTANTS.MINING.TARGET_TIME_PER_BLOCK,
                difficulty: constants_1.BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY,
                minHashthreshold: constants_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_HASHRATE,
                minPowNodes: constants_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_POW_NODES,
                maxForkDepth: constants_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_FORK_DEPTH,
                emergencyPowThreshold: constants_1.BLOCKCHAIN_CONSTANTS.MINING.EMERGENCY_POW_THRESHOLD,
                minPowScore: constants_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_POW_SCORE,
                forkResolutionTimeout: constants_1.BLOCKCHAIN_CONSTANTS.MINING.FORK_RESOLUTION_TIMEOUT,
                difficultyAdjustmentInterval: constants_1.BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY_ADJUSTMENT_INTERVAL,
                initialDifficulty: constants_1.BLOCKCHAIN_CONSTANTS.MINING.INITIAL_DIFFICULTY,
                hashBatchSize: constants_1.BLOCKCHAIN_CONSTANTS.MINING.HASH_BATCH_SIZE,
                minDifficulty: constants_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_DIFFICULTY,
                chainDecisionThreshold: constants_1.BLOCKCHAIN_CONSTANTS.MINING.CHAIN_DECISION_THRESHOLD,
                orphanWindow: constants_1.BLOCKCHAIN_CONSTANTS.MINING.ORPHAN_WINDOW,
                propagationWindow: constants_1.BLOCKCHAIN_CONSTANTS.MINING.PROPAGATION_WINDOW,
                maxPropagationTime: constants_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_PROPAGATION_TIME,
                targetTimespan: constants_1.BLOCKCHAIN_CONSTANTS.MINING.TARGET_TIMESPAN,
                targetBlockTime: constants_1.BLOCKCHAIN_CONSTANTS.MINING.TARGET_BLOCK_TIME,
                maxTarget: constants_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_TARGET,
            },
            util: config?.util || {
                retryAttempts: constants_1.BLOCKCHAIN_CONSTANTS.UTIL.RETRY_ATTEMPTS,
                retryDelayMs: constants_1.BLOCKCHAIN_CONSTANTS.UTIL.RETRY_DELAY_MS,
                cacheTtlHours: constants_1.BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL_HOURS,
                validationTimeoutMs: constants_1.BLOCKCHAIN_CONSTANTS.UTIL.VALIDATION_TIMEOUT_MS,
                initialRetryDelay: constants_1.BLOCKCHAIN_CONSTANTS.UTIL.INITIAL_RETRY_DELAY,
                maxRetryDelay: constants_1.BLOCKCHAIN_CONSTANTS.UTIL.MAX_RETRY_DELAY,
                backoffFactor: constants_1.BLOCKCHAIN_CONSTANTS.UTIL.BACKOFF_FACTOR,
                maxRetries: constants_1.BLOCKCHAIN_CONSTANTS.UTIL.MAX_RETRIES,
                cacheTtl: constants_1.BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL,
                pruneThreshold: constants_1.BLOCKCHAIN_CONSTANTS.UTIL.PRUNE_THRESHOLD,
            },
            votingConstants: config?.votingConstants || {
                votingPeriodBlocks: constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_BLOCKS,
                votingPeriodMs: constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_MS,
                minPowWork: constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_POW_WORK,
                cooldownBlocks: constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.COOLDOWN_BLOCKS,
                maxVotesPerPeriod: constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTES_PER_PERIOD,
                minAccountAge: constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_ACCOUNT_AGE,
                minPeerCount: constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_PEER_COUNT,
                voteEncryptionVersion: constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTE_ENCRYPTION_VERSION,
                maxVoteSizeBytes: constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTE_SIZE_BYTES,
                votingWeight: constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_WEIGHT,
                minVotesForValidity: constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_VOTES_FOR_VALIDITY,
                votePowerDecay: constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTE_POWER_DECAY,
            },
            wallet: config?.wallet || {
                address: "",
                publicKey: async () => {
                    const keyPair = await crypto_1.KeyManager.generateKeyPair();
                    return typeof keyPair.publicKey === "function"
                        ? await keyPair.publicKey()
                        : keyPair.publicKey;
                },
                privateKey: async () => {
                    const keyPair = await crypto_1.KeyManager.generateKeyPair();
                    return typeof keyPair.privateKey === "function"
                        ? await keyPair.privateKey()
                        : keyPair.privateKey;
                },
            },
            network: config?.network || {
                type: dnsSeed_1.NetworkType.MAINNET,
                port: 3000,
                seedDomains: process.env.SEED_NODES
                    ? JSON.parse(process.env.SEED_DOMAINS)
                    : [],
                host: `https://${config?.network?.host || "localhost"}:${config?.network?.port || 3000}`,
            },
        };
    }
    /**
     * Get maximum allowed transaction size based on network conditions
     * @returns {number} Maximum transaction size in bytes
     */
    async getMaxTransactionSize() {
        try {
            const currentHeight = this.getCurrentHeight();
            const networkHealth = await this.healthMonitor.getNetworkHealth();
            // Reduce max size if network is congested
            if (!networkHealth.isHealthy) {
                return Math.floor(constants_1.BLOCKCHAIN_CONSTANTS.UTIL.BASE_MAX_SIZE * 0.75);
            }
            // Allow larger transactions after certain height (network maturity)
            const maturityHeight = 50000;
            if (currentHeight > maturityHeight) {
                // Calculate dynamic max size based on network conditions
                const mempoolSize = this.mempool.getSize();
                const maxMempoolSize = this.mempool.maxSize;
                const mempoolUsageRatio = mempoolSize / maxMempoolSize;
                // Adjust max size based on mempool usage
                const dynamicMaxSize = Math.floor(constants_1.BLOCKCHAIN_CONSTANTS.UTIL.BASE_MAX_SIZE *
                    (1 - mempoolUsageRatio * 0.5) // Reduce by up to 50% based on mempool usage
                );
                // Never exceed absolute maximum
                return Math.min(dynamicMaxSize, constants_1.BLOCKCHAIN_CONSTANTS.UTIL.ABSOLUTE_MAX_SIZE);
            }
            // Default to base size for young network
            return constants_1.BLOCKCHAIN_CONSTANTS.UTIL.BASE_MAX_SIZE;
        }
        catch (error) {
            shared_1.Logger.error("Error calculating max transaction size:", error);
            // Fall back to conservative limit if there's an error
            return constants_1.BLOCKCHAIN_CONSTANTS.UTIL.BASE_MAX_SIZE;
        }
    }
    /**
     * Cleans up resources and stops blockchain operations
     */
    async dispose() {
        try {
            // Stop blockchain before cleanup
            await this.stop();
            if (this.healthCheckTimer) {
                clearTimeout(this.healthCheckTimer);
            }
            if (this.validationTimer) {
                clearTimeout(this.validationTimer);
            }
            const cleanupTasks = [
                this.metrics.dispose(),
                this.sync?.dispose(),
                this.mempool?.dispose(),
                this.consensus?.dispose(),
                this.db?.close(),
                ...Array.from(this.circuitBreakers.values()).map((breaker) => breaker.dispose()),
            ];
            await Promise.allSettled(cleanupTasks);
            // Clear all caches and references
            this.blockCache.clear();
            this.transactionCache.clear();
            this.utxoCache.clear();
            this.heightCache = null;
            this.utxoSetCache = null;
            this.peers.clear();
            this.eventEmitter.removeAllListeners();
        }
        catch (error) {
            shared_1.Logger.error("Error during blockchain disposal:", error);
            throw error;
        }
    }
    monitorMemoryUsage() {
        setInterval(() => {
            const memoryUsage = process.memoryUsage();
            const heapUsed = memoryUsage.heapUsed / 1024 / 1024; // MB
            const maxSize = parseInt(process.env.NODE_OPTIONS?.match(/--max-old-space-size=(\d+)/)?.[1] ||
                "2048");
            if (heapUsed > constants_1.BLOCKCHAIN_CONSTANTS.UTIL.PRUNE_THRESHOLD * maxSize) {
                this.pruneMemory();
            }
        }, 60000);
    }
    pruneMemory() {
        // Clear caches
        const blockEntries = Array.from(this.blockCache.entries());
        blockEntries
            .slice(Math.floor(blockEntries.length / 2))
            .forEach(([key]) => this.blockCache.delete(key));
        const txEntries = Array.from(this.transactionCache.entries());
        txEntries
            .slice(Math.floor(txEntries.length / 2))
            .forEach(([key]) => this.transactionCache.delete(key));
    }
    async getConsensusMetrics() {
        const metrics = this.consensus.getMetrics();
        const activeVoters = await metrics.voting.activeVoters;
        const participation = await metrics.voting.participationRate;
        return {
            powHashrate: metrics.pow.averageHashRate,
            activeVoters: activeVoters.length,
            participation,
            currentParticipation: participation,
        };
    }
    getNode() {
        if (!this.node) {
            throw new Error("Node not initialized");
        }
        return this.node;
    }
    // Add method to sign blocks using HybridCrypto
    async signBlock(block, privateKey) {
        try {
            block.header.signature = await crypto_1.HybridCrypto.sign(block.hash, privateKey);
        }
        catch (error) {
            shared_1.Logger.error("Error signing block:", error);
            throw error;
        }
    }
    // Update transaction handling
    async addTransaction(tx) {
        try {
            // Size validation first - cheapest check
            if (!this.validateTransactionSize(tx)) {
                throw new Error("Transaction size exceeds limit");
            }
            // Add nonce check to prevent replay attacks
            const expectedNonce = await this.db.getAccountNonce(tx.sender);
            if (tx.nonce !== expectedNonce) {
                throw new Error("Invalid transaction nonce");
            }
            // Add amount validation
            if (!this.validateTransactionAmount(tx)) {
                throw new Error("Invalid transaction amount");
            }
            // Verify signature with timeout
            const isValidSignature = await Promise.race([
                crypto_1.HybridCrypto.verify(tx.id, tx.signature, tx.sender),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Signature verification timeout")), 5000)),
            ]);
            if (!isValidSignature) {
                throw new Error("Invalid transaction signature");
            }
            // Add DDoS protection for transaction submissions
            if (!this.ddosProtection.checkRequest("blockchain_tx", tx.sender)) {
                shared_1.Logger.warn(`DDoS protection blocked blockchain transaction from ${tx.sender}`);
                return false;
            }
            // Add to mempool and cache
            this.mempool.addTransaction(tx);
            this.transactionCache.set(tx.id, tx);
            return true;
        }
        catch (error) {
            this.errorHandler.handle(error, "addTransaction");
            return false;
        }
    }
    /**
     * Gets the first transaction for an address
     * @param address Address to get the first transaction for
     * @returns Promise<{ blockHeight: number } | null> First transaction for the address
     */
    async getFirstTransactionForAddress(address) {
        try {
            // Check cache first
            const cacheKey = `first_tx:${address}`;
            const cached = this.firstTxCache.get(cacheKey);
            if (cached)
                return cached;
            // Query database with pagination for efficiency
            const batchSize = 1000;
            let currentHeight = this.getCurrentHeight();
            while (currentHeight > 0) {
                const startHeight = Math.max(0, currentHeight - batchSize);
                const blocks = await this.db.getBlocksFromHeight(startHeight, currentHeight);
                for (const block of blocks) {
                    for (const tx of block.transactions) {
                        if (tx.sender === address ||
                            tx.outputs.some((out) => out.address === address)) {
                            const result = { blockHeight: block.header.height };
                            this.firstTxCache.set(cacheKey, result);
                            return result;
                        }
                    }
                }
                currentHeight = startHeight - 1;
            }
            return null;
        }
        catch (error) {
            shared_1.Logger.error("Error getting first transaction:", error);
            return null;
        }
    }
    /**
     * Validates transaction amount
     * @param tx Transaction to validate
     * @returns Promise<boolean> True if transaction amount is valid
     */
    async validateTransactionAmount(tx) {
        try {
            // Fix: Use BigInt for all calculations
            const totalInput = await this.calculateInputAmount(tx.inputs);
            const totalOutput = tx.outputs.reduce((sum, out) => sum + BigInt(out.amount), 0n);
            const fee = BigInt(this.calculateTransactionFee(tx));
            // Check for overflow
            if (totalInput > BigInt(Number.MAX_SAFE_INTEGER)) {
                return false;
            }
            return totalInput >= totalOutput + fee;
        }
        catch {
            return false;
        }
    }
    /**
     * Calculates the total amount of inputs for a given transaction
     * @param inputs Inputs to calculate the total amount for
     * @returns Promise<bigint> Total amount of inputs
     */
    async calculateInputAmount(inputs) {
        let total = 0n;
        for (const input of inputs) {
            const utxo = await this.utxoSet.getUtxo(input.txId, input.outputIndex);
            if (!utxo || utxo.spent) {
                throw new Error("Invalid or spent UTXO");
            }
            total += BigInt(utxo.amount);
        }
        return total;
    }
    /**
     * Checks and marks spent transactions
     * @param tx Transaction to check and mark
     * @returns Promise<boolean> True if transaction is valid
     */
    async checkAndMarkSpent(tx) {
        const release = await this.txLock.acquire();
        try {
            for (const input of tx.inputs) {
                const key = `${input.txId}:${input.outputIndex}`;
                const spentOutputs = this.spentTxTracker.get(input.txId) || new Set();
                if (spentOutputs.has(input.outputIndex)) {
                    return false; // Double-spend detected
                }
                spentOutputs.add(input.outputIndex);
                this.spentTxTracker.set(input.txId, spentOutputs);
            }
            return true;
        }
        finally {
            release();
        }
    }
    /**
     * Processes a payment transaction
     * @param tx Transaction to process
     * @returns Promise<boolean> True if transaction is processed successfully
     */
    async processPayment(tx) {
        return this.withErrorBoundary("processPayment", async () => {
            const startTime = Date.now();
            // Validate and process transaction
            if (!(await this.validateTransaction(tx))) {
                return false;
            }
            // Check double-spend
            if (!(await this.checkAndMarkSpent(tx))) {
                return false;
            }
            const timeoutPromise = new Promise((_, reject) => {
                const timeout = setTimeout(() => {
                    clearTimeout(timeout);
                    reject(new Error("Payment processing timeout"));
                }, 10000);
            });
            // Process with timeout
            try {
                this.metrics.histogram("payment_processing_time", Date.now() - startTime);
                this.metrics.gauge("mempool_size", this.mempool.getSize());
                await Promise.race([this.addTransaction(tx), timeoutPromise]);
                this.metrics.increment("successful_payments");
                return true;
            }
            catch (error) {
                shared_1.Logger.error("Payment processing failed:", error);
                this.metrics.increment("payment_errors");
                await this.rollbackTransaction(tx);
                return false;
            }
        });
    }
    /**
     * Cleans up mempool
     */
    cleanupMempool() {
        const before = this.mempool.getSize();
        try {
            const now = Date.now();
            const transactions = this.mempool.getTransactions();
            for (const tx of transactions) {
                // Remove expired transactions
                if (now - tx.timestamp > this.MEMPOOL_EXPIRY_TIME) {
                    this.mempool.removeTransaction(tx.id);
                    continue;
                }
                // Remove transactions from blacklisted addresses
                if (this.blacklistedAddresses.has(tx.sender)) {
                    this.mempool.removeTransaction(tx.id);
                    continue;
                }
            }
            // If mempool is still too large, remove oldest transactions
            if (this.mempool.getSize() > this.MAX_MEMPOOL_SIZE) {
                const sortedTxs = transactions.sort((a, b) => a.timestamp - b.timestamp);
                const excessCount = this.mempool.getSize() - this.MAX_MEMPOOL_SIZE;
                sortedTxs.slice(0, excessCount).forEach((tx) => {
                    this.mempool.removeTransaction(tx.id);
                });
            }
            const after = this.mempool.getSize();
            // Record cleanup metrics
            this.metrics.gauge("mempool_size", after);
            this.metrics.histogram("mempool_cleanup_removed", before - after);
        }
        catch (error) {
            this.metrics.increment("mempool_cleanup_errors");
            throw error;
        }
    }
    /**
     * Handles chain reorganization when a new chain tip is received
     * @param newChainTip The new chain tip block
     * @returns Promise<boolean> True if reorganization was successful
     */
    async handleChainReorganization(newChainTip) {
        return this.withErrorBoundary("chainReorganization", async () => {
            const release = await this.reorgLock.acquire();
            const reorgSnapshot = await this.db.createSnapshot();
            try {
                const commonAncestor = await this.findCommonAncestor(newChainTip);
                if (!commonAncestor)
                    return false;
                const reorgDepth = this.getCurrentHeight() - commonAncestor.header.height;
                if (reorgDepth > this.MAX_REORG_DEPTH)
                    return false;
                // Fix: Use transaction for atomic updates
                await this.db.executeTransaction(async () => {
                    await this.rollbackToBlock(commonAncestor.header.height);
                    const newBlocks = await this.getNewChainBlocks(commonAncestor, newChainTip);
                    for (const block of newBlocks) {
                        if (!(await this.addBlock(block))) {
                            throw new Error("Reorg failed");
                        }
                    }
                });
                await this.db.commitSnapshot(reorgSnapshot);
                return true;
            }
            catch (error) {
                await this.db.rollbackSnapshot(reorgSnapshot);
                this.errorHandler.handle(error, "chainReorganization");
                return false;
            }
            finally {
                await release();
            }
        });
    }
    /**
     * Finds the common ancestor between two blocks
     * @param newTip The new chain tip block
     * @returns Promise<Block | null> The common ancestor block or null if not found
     */
    async findCommonAncestor(newTip) {
        let currentBlock = newTip;
        const maxSearchDepth = this.MAX_REORG_DEPTH;
        for (let i = 0; i < maxSearchDepth && currentBlock; i++) {
            const localBlock = await this.getBlock(currentBlock.header.previousHash);
            if (localBlock) {
                return localBlock;
            }
            currentBlock = await this.getBlock(currentBlock.header.previousHash);
        }
        return null;
    }
    /**
     * Validates transaction size
     * @param tx Transaction to validate
     * @returns boolean True if transaction size is valid
     */
    validateTransactionSize(tx) {
        // Check total size of transaction
        const txString = JSON.stringify(tx);
        const sizeInBytes = Buffer.from(txString).length;
        // Typical max size is 1MB (1048576 bytes)
        const MAX_TX_SIZE = 1048576;
        return sizeInBytes <= MAX_TX_SIZE;
    }
    /**
     * Calculates the transaction fee
     * @param tx Transaction to calculate fee for
     * @returns bigint Transaction fee
     */
    calculateTransactionFee(tx) {
        return transaction_validator_1.TransactionValidator.calculateTransactionFee(tx);
    }
    /**
     * Validates a transaction
     * @param tx Transaction to validate
     * @returns Promise<boolean> True if transaction is valid
     */
    async validateTransaction(tx) {
        return Promise.race([
            transaction_validator_1.TransactionValidator.validateTransaction(tx, this.utxoSet, this.getCurrentHeight()),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Transaction validation timeout")), 5000)),
        ]);
    }
    /**
     * Adds a new peer to the blockchain
     * @param peerUrl Peer URL to add
     * @returns Promise<boolean> True if peer was added successfully
     */
    async addPeer(peerUrl) {
        try {
            const peer = new peer_1.Peer(peerUrl, this.config.network.port || 8333, {
                minPingInterval: 30000,
                handshakeTimeout: 5000,
                maxBanScore: 100,
            }, new shared_2.ConfigService(this.config), this.db);
            await peer.handshake();
            this.peers.set(peer.getId(), peer);
            shared_1.Logger.info(`Successfully added peer: ${peerUrl}`);
            this.eventEmitter.emit("peer_added", { url: peerUrl });
            return true;
        }
        catch (error) {
            shared_1.Logger.error(`Failed to add peer ${peerUrl}:`, error);
            return false;
        }
    }
    /**
     * Handles peer ban
     * @param data Peer ban data
     */
    handlePeerBanned(data) {
        shared_1.Logger.warn(`Peer banned: ${data.address}`);
        // Additional handling like notifying other peers
        this.eventEmitter.emit("peer_banned", data);
    }
    /**
     * Handles peer violation
     * @param data Peer violation data
     */
    handlePeerViolation(data) {
        shared_1.Logger.warn(`Peer violation: ${data.violation}`);
        this.eventEmitter.emit("peer_violation", data);
    }
    /**
     * Updates peer scores
     */
    async updatePeerScores() {
        try {
            for (const [peerId, peer] of this.peers.entries()) {
                // Get peer metrics
                const blockHeight = await peer.getBlockHeight();
                const minedBlocks = await peer.getMinedBlocks();
                const voteParticipation = await peer.getVoteParticipation();
                // Calculate score adjustments
                let scoreAdjustment = 0;
                // Height sync bonus
                if (Math.abs(this.getCurrentHeight() - blockHeight) <= 1) {
                    scoreAdjustment += 1;
                }
                // Mining participation bonus
                if (minedBlocks > 0) {
                    scoreAdjustment += 1;
                }
                // Voting participation bonus
                if (voteParticipation > 0.5) {
                    scoreAdjustment += 1;
                }
                // Update peer score
                this.peerManager.adjustPeerScore(scoreAdjustment);
            }
        }
        catch (error) {
            shared_1.Logger.error("Failed to update peer scores:", error);
        }
    }
    /**
     * Rolls back to a specific block height
     * @param height Block height to rollback to
     * @returns Promise<void>
     */
    async rollbackToBlock(height) {
        try {
            const currentHeight = this.getCurrentHeight();
            for (let i = currentHeight; i > height; i--) {
                const blockHash = await this.db.getBlockHashByHeight(i);
                if (blockHash) {
                    const block = await this.getBlock(blockHash);
                    if (block) {
                        await this.revertBlock(block);
                    }
                }
            }
            await this.db.setChainHead(height);
        }
        catch (error) {
            shared_1.Logger.error("Error rolling back blocks:", error);
            throw error;
        }
    }
    /**
     * Gets new chain blocks
     * @param commonAncestor The common ancestor block
     * @param newTip The new chain tip block
     * @returns Promise<Block[]> New chain blocks
     */
    async getNewChainBlocks(commonAncestor, newTip) {
        const blocks = [];
        let currentBlock = newTip;
        while (currentBlock.header.height > commonAncestor.header.height) {
            blocks.unshift(currentBlock); // Add to front to maintain order
            const prevBlock = await this.getBlock(currentBlock.header.previousHash);
            if (!prevBlock)
                break;
            currentBlock = prevBlock;
        }
        return blocks;
    }
    /**
     * Reverts a block
     * @param block Block to revert
     * @returns Promise<void>
     */
    async revertBlock(block) {
        try {
            // Revert transactions in reverse order
            for (const tx of block.transactions.reverse()) {
                await this.utxoSet.revertTransaction(tx);
                this.mempool.addTransaction(tx);
            }
            // Update chain state
            await this.db.setChainHead(block.header.height - 1);
            shared_1.Logger.info(`Reverted block at height ${block.header.height}`);
        }
        catch (error) {
            shared_1.Logger.error("Error reverting block:", error);
            throw error;
        }
    }
    /**
     * Wraps operations with circuit breaker for critical operations
     * @param operation Name of the operation being performed
     * @param action Function to execute within error boundary
     * @returns Promise<T> Result of operation
     * @throws Error if action fails
     */
    async withCircuitBreaker(operation, action) {
        const breaker = this.circuitBreakers.get(operation);
        if (!breaker) {
            throw new Error(`No circuit breaker found for operation: ${operation}`);
        }
        if (breaker.isOpen()) {
            throw new Error(`Circuit breaker is open for operation: ${operation}`);
        }
        try {
            const result = await action();
            breaker.recordSuccess();
            return result;
        }
        catch (error) {
            breaker.recordFailure();
            throw error;
        }
    }
    /**
     * Syncs with a peer
     * @param peer Peer to sync with
     * @returns Promise<void>
     */
    async syncWithPeer(peer) {
        return this.withErrorBoundary("peerSync", async () => {
            // Validate UTXO set before sync
            await this.validateAndUpdateUTXOSet();
            await this.sync.synchronize(peer);
        });
    }
    /**
     * Rolls back a transaction
     * @param tx Transaction to rollback
     * @returns Promise<void>
     */
    async rollbackTransaction(tx) {
        try {
            // Remove from mempool
            this.mempool.removeTransaction(tx.id);
            // Remove from cache
            this.transactionCache.delete(tx.id);
            // Reset nonce
            await this.db.executeTransaction(async () => {
                const currentNonce = await this.db.getAccountNonce(tx.sender);
                if (currentNonce === tx.nonce) {
                    await this.db.put(`nonce:${tx.sender}`, (tx.nonce - 1).toString());
                }
            });
        }
        catch (error) {
            shared_1.Logger.error("Error rolling back transaction:", error);
            throw error;
        }
    }
    /**
     * Handles sync completion
     */
    handleSyncCompleted() {
        // Handle sync completion
        this.metrics.increment("sync_completed");
    }
    /**
     * Handles sync error
     * @param error Sync error
     */
    handleSyncError(error) {
        // Handle sync error
        shared_1.Logger.error("Sync error:", error);
        this.metrics.increment("sync_errors");
    }
    /**
     * Validates and updates the UTXO set
     * @throws Error if validation fails
     */
    async validateAndUpdateUTXOSet() {
        return this.withErrorBoundary("utxoValidation", async () => {
            const release = await this.cacheLock.acquire();
            try {
                if (!this.utxoSet.validate()) {
                    shared_1.Logger.warn("UTXO set validation failed, rebuilding...");
                    this.rebuildUTXOSet();
                }
                this.utxoSetCache.set("current", this.utxoSet);
            }
            finally {
                release();
            }
        });
    }
    /**
     * Performs health check on blockchain system
     * @returns Promise<boolean> True if system is healthy
     */
    async healthCheck() {
        return this.withCircuitBreaker("health", async () => {
            const isDbConnected = await this.db.ping();
            const isChainValid = await this.validateChain();
            const isPeerConnected = this.peers.size > 0;
            return isDbConnected && isChainValid && isPeerConnected;
        });
    }
    /**
     * Wraps operations with error boundary for consistent error handling
     * @param operation Name of the operation being performed
     * @param action Function to execute within error boundary
     * @returns Promise<T> Result of the action
     * @throws Error if action fails
     */
    async withErrorBoundary(operation, action) {
        try {
            return await action();
        }
        catch (error) {
            this.errorHandler.handle(error, operation);
            throw error;
        }
    }
    /**
     * Starts periodic validation of blockchain state
     */
    startPeriodicValidation() {
        this.validationTimer = setInterval(async () => {
            try {
                await this.validateAndUpdateUTXOSet();
            }
            catch (error) {
                shared_1.Logger.error("UTXO validation failed:", error);
                this.metrics.increment("utxo_validation_failures");
            }
        }, this.validationInterval);
    }
    async getValidatorCount() {
        try {
            const validators = await this.db.getValidators();
            return validators.length;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get validator count:", error);
            return 0;
        }
    }
    async handleBlockMined(block) {
        return this.withErrorBoundary("handleBlockMined", async () => {
            // Validate the block first
            const isValid = await this.consensus.validateBlock(block);
            if (!isValid) {
                throw new Error("Mined block validation failed");
            }
            // Add block to chain
            const added = await this.addBlock(block);
            if (!added) {
                throw new Error("Failed to add mined block to chain");
            }
            // Update mempool and UTXO set
            await this.utxoSet.applyBlock(block);
            block.transactions.forEach((tx) => {
                this.mempool.removeTransaction(tx.id);
            });
            // Emit metrics
            this.metrics.gauge("block_height", this.getCurrentHeight());
            this.metrics.gauge("transactions_count", block.transactions.length);
            // Broadcast to network
            await this.node.broadcastBlock(block);
        });
    }
    async getUTXO(txId, outputIndex) {
        const release = await this.cacheLock.acquire();
        try {
            // Check cache first
            const cacheKey = `utxo:${txId}:${outputIndex}`;
            const cachedUtxo = this.utxoCache.get(cacheKey);
            if (cachedUtxo)
                return cachedUtxo;
            // Get from UTXO set
            const utxo = await this.utxoSet.get(txId, outputIndex);
            if (!utxo)
                return null;
            // Cache the result
            this.utxoCache.set(cacheKey, utxo, { ttl: 300000 }); // 5 minute TTL
            // Log for monitoring
            shared_1.Logger.debug("UTXO retrieved", {
                txId,
                outputIndex,
                spent: utxo.spent,
            });
            return utxo;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get UTXO:", {
                txId,
                outputIndex,
                error: error instanceof Error ? error.message : "Unknown error",
            });
            return null;
        }
        finally {
            release();
        }
    }
    async getDynamicBlockSize(block) {
        return block_validator_1.BlockValidator.calculateDynamicBlockSize(block);
    }
    getVersion() {
        return constants_1.BLOCKCHAIN_CONSTANTS.VERSION;
    }
    hasBlock(hash) {
        return (this.blockCache.has(hash) ||
            this.chain.some((block) => block.hash === hash));
    }
    async validateBlock(block) {
        return this.consensus.validateBlock(block);
    }
    async verifyBlock(block) {
        try {
            // Verify block hash
            const validHash = await block.verifyHash();
            if (!validHash)
                return false;
            // Verify block signature
            const validSignature = await block.verifySignature();
            if (!validSignature)
                return false;
            // Verify transactions
            for (const tx of block.transactions) {
                if (!(await tx.verify()))
                    return false;
            }
            return true;
        }
        catch (error) {
            shared_1.Logger.error("Block verification failed:", error);
            return false;
        }
    }
    async processVote(vote) {
        try {
            // Verify vote signature
            const isValid = await crypto_1.HybridCrypto.verify(vote.blockHash, vote.signature, vote.voter);
            if (!isValid) {
                throw new Error("Invalid vote signature");
            }
            // Store vote in database
            await this.db.put(`vote:${vote.blockHash}:${vote.voter}`, JSON.stringify(vote));
            shared_1.Logger.info(`Vote processed for block ${vote.blockHash} by ${vote.voter}`);
        }
        catch (error) {
            shared_1.Logger.error("Vote processing failed:", error);
            throw error;
        }
    }
    /**
     * Gets the consensus public key for the blockchain
     * @returns string The consensus public key
     */
    getConsensusPublicKey() {
        return this.consensusPublicKey.publicKey;
    }
    static getInstance(config) {
        if (!Blockchain.instance) {
            Blockchain.instance = new Blockchain(config);
        }
        return Blockchain.instance;
    }
    /**
     * Gets information about all known chain tips
     * @returns Promise<ChainTip[]> Array of chain tips information
     */
    async getChainTips() {
        try {
            const tips = [];
            const processedHashes = new Set();
            const currentHeight = this.getCurrentHeight();
            // Add current active chain tip
            const activeBlock = this.getLatestBlock();
            if (activeBlock) {
                tips.push({
                    height: currentHeight,
                    hash: activeBlock.hash,
                    branchLen: 0,
                    status: "active",
                    lastValidatedAt: Date.now(),
                });
                processedHashes.add(activeBlock.hash);
            }
            // Get all known blocks at current height
            const blocksAtHeight = await this.db.getBlocksByHeight(currentHeight);
            // Process alternative chain tips
            for (const block of blocksAtHeight) {
                if (processedHashes.has(block.hash))
                    continue;
                let branchLen = 0;
                let currentBlock = block;
                let firstBlockHash = block.hash;
                let isValid = true;
                // Traverse down the chain to find branch length and validity
                while (currentBlock && currentBlock.header.height > 0) {
                    // Try to find the block in our main chain
                    const mainChainBlock = this.getBlockByHeight(currentBlock.header.height);
                    if (mainChainBlock && mainChainBlock.hash === currentBlock.hash) {
                        break; // Found the fork point
                    }
                    branchLen++;
                    // Validate the block
                    isValid = isValid && (await this.validateBlock(currentBlock));
                    if (!isValid)
                        break;
                    // Get previous block
                    const prevBlock = await this.getBlock(currentBlock.header.previousHash);
                    if (!prevBlock)
                        break;
                    currentBlock = prevBlock;
                    firstBlockHash = currentBlock.hash;
                }
                // Determine status
                let status;
                if (!isValid) {
                    status = "invalid";
                }
                else if (await this.verifyBlock(block)) {
                    status = "valid-fork";
                }
                else {
                    status = "valid-headers";
                }
                tips.push({
                    height: block.header.height,
                    hash: block.hash,
                    branchLen,
                    status,
                    firstBlockHash,
                    lastValidatedAt: Date.now(),
                });
                processedHashes.add(block.hash);
            }
            // Sort tips by height descending
            tips.sort((a, b) => b.height - a.height);
            // Add metrics
            this.metrics.gauge("chain_tips_count", tips.length);
            this.metrics.gauge("valid_forks_count", tips.filter((tip) => tip.status === "valid-fork").length);
            return tips;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get chain tips:", error);
            throw error;
        }
    }
    async getVerificationProgress() {
        return this.sync ? await this.sync.getVerificationProgress() : 1;
    }
    getChainWork() {
        const latestBlock = this.getLatestBlock();
        return latestBlock ? this.calculateChainWork(latestBlock) : "0x0";
    }
    isInitialBlockDownload() {
        return this.sync ? this.sync.isInitialBlockDownload() : false;
    }
    calculateChainWork(block) {
        try {
            let work = BigInt(block.header.difficulty);
            // Multiply by height to account for cumulative work
            work *= BigInt(block.header.height);
            // Adjust for hybrid consensus by considering validators
            if (block.validators && block.validators.length > 0) {
                const validatorWeight = BigInt(block.validators.length *
                    constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.VALIDATOR_WEIGHT);
                work += validatorWeight;
            }
            // Convert to hex string with '0x' prefix
            return "0x" + work.toString(16);
        }
        catch (error) {
            shared_1.Logger.error("Chain work calculation failed:", error);
            return "0x0";
        }
    }
    getConsensus() {
        return this.consensus;
    }
    async hasTransaction(hash) {
        // Check cache and chain
        return !!(this.transactionCache.has(hash) || (await this.getTransaction(hash)));
    }
    async isUTXOSpent(input) {
        const utxo = await this.getUTXO(input.txId, input.outputIndex);
        return !utxo || utxo.spent;
    }
    async updatePostBlockAdd(block) {
        try {
            await Promise.all([
                // Update mempool
                this.mempool.removeTransactions(block.transactions),
                // Update UTXO cache
                this.utxoSet.applyBlock(block),
                // Update block cache
                this.blockCache.set(block.hash, block),
                // Update consensus state
                this.consensus.updateState(block),
                // Notify peers of new block
                this.node.broadcastBlock(block),
            ]);
            // Update metrics
            this.metrics.gauge("blockchain_height", this.getHeight());
            this.metrics.histogram("transactions_per_block", block.transactions.length);
        }
        catch (error) {
            shared_1.Logger.error("Post-block update failed:", error);
            // Use retry decorator instead of queue
            await this.retryPostBlockAdd(block);
        }
    }
    async retryPostBlockAdd(block) {
        await this.updatePostBlockAdd(block);
    }
}
__decorate([
    (0, retry_1.retry)({
        maxAttempts: 3,
        delay: 500,
        exponentialBackoff: true,
        maxDelay: 5000,
        retryableErrors: ["Rate limit exceeded", /timeout/i],
    })
], Blockchain.prototype, "processPayment", null);
__decorate([
    (0, retry_1.retry)({
        maxAttempts: 3,
        delay: 1000,
        exponentialBackoff: true,
        maxDelay: 5000,
    })
], Blockchain.prototype, "retryPostBlockAdd", null);
exports.Blockchain = Blockchain;
//# sourceMappingURL=blockchain.js.map