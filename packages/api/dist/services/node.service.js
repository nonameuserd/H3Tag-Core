"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@h3tag-blockchain/core");
const crypto_1 = require("@h3tag-blockchain/crypto");
/**
 * @swagger
 * tags:
 *   name: Nodes
 *   description: Blockchain node management endpoints
 */
let NodeService = class NodeService {
    constructor(configService, blockchainSchema, auditManager) {
        this.configService = configService;
        this.blockchainSchema = blockchainSchema;
        this.auditManager = auditManager;
        this.nodes = new Map();
    }
    /**
     * @swagger
     * /nodes:
     *   post:
     *     summary: Create a new blockchain node
     *     tags: [Nodes]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateNodeDto'
     *     responses:
     *       201:
     *         description: Node created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/NodeResponseDto'
     *       400:
     *         description: Invalid parameters or node creation failed
     */
    async createNode(params) {
        try {
            // Initialize blockchain with complete config
            const blockchain = await core_1.Blockchain.create({
                currency: {
                    name: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
                    symbol: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
                    decimals: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
                    initialSupply: BigInt(core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.INITIAL_SUPPLY),
                    maxSupply: BigInt(core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.MAX_SUPPLY),
                    units: {
                        MACRO: BigInt(core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.MACRO),
                        MICRO: BigInt(core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.MICRO),
                        MILLI: BigInt(core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.MILLI),
                        TAG: BigInt(core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.TAG),
                    },
                },
                network: {
                    type: {
                        MAINNET: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.type.MAINNET,
                        TESTNET: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.type.TESTNET,
                        DEVNET: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.type.DEVNET,
                    },
                    port: {
                        MAINNET: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.port.MAINNET,
                        TESTNET: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.port.TESTNET,
                        DEVNET: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.port.DEVNET,
                    },
                    host: {
                        MAINNET: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.host.MAINNET,
                        TESTNET: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.host.TESTNET,
                        DEVNET: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.host.DEVNET,
                    },
                    seedDomains: {
                        MAINNET: process.env.SEED_NODES_MAINNET
                            ? JSON.parse(process.env.SEED_NODES_MAINNET)
                            : [],
                        TESTNET: process.env.SEED_NODES_TESTNET
                            ? JSON.parse(process.env.SEED_NODES_TESTNET)
                            : [],
                        DEVNET: process.env.SEED_NODES_DEVNET
                            ? JSON.parse(process.env.SEED_NODES_DEVNET)
                            : [],
                    },
                },
                mining: {
                    adjustmentInterval: core_1.BLOCKCHAIN_CONSTANTS.MINING.ADJUSTMENT_INTERVAL,
                    maxAttempts: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_ATTEMPTS,
                    currentVersion: core_1.BLOCKCHAIN_CONSTANTS.MINING.CURRENT_VERSION,
                    maxVersion: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_VERSION,
                    minVersion: core_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_VERSION,
                    autoMine: core_1.BLOCKCHAIN_CONSTANTS.MINING.AUTO_MINE,
                    batchSize: core_1.BLOCKCHAIN_CONSTANTS.MINING.BATCH_SIZE,
                    blocksPerYear: core_1.BLOCKCHAIN_CONSTANTS.MINING.BLOCKS_PER_YEAR,
                    initialReward: core_1.BLOCKCHAIN_CONSTANTS.MINING.INITIAL_REWARD,
                    minReward: core_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_REWARD,
                    blockReward: core_1.BLOCKCHAIN_CONSTANTS.MINING.BLOCK_REWARD,
                    halvingInterval: core_1.BLOCKCHAIN_CONSTANTS.MINING.HALVING_INTERVAL,
                    maxHalvings: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_HALVINGS,
                    blockTime: core_1.BLOCKCHAIN_CONSTANTS.MINING.BLOCK_TIME,
                    maxBlockTime: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_BLOCK_TIME,
                    cacheTtl: core_1.BLOCKCHAIN_CONSTANTS.MINING.CACHE_TTL,
                    difficulty: core_1.BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY,
                    difficultyAdjustmentInterval: core_1.BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY_ADJUSTMENT_INTERVAL,
                    maxDifficulty: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_DIFFICULTY,
                    targetTimePerBlock: core_1.BLOCKCHAIN_CONSTANTS.MINING.TARGET_TIME_PER_BLOCK,
                    minHashrate: core_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_HASHRATE,
                    minPowNodes: core_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_POW_NODES,
                    maxForkDepth: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_FORK_DEPTH,
                    emergencyPowThreshold: core_1.BLOCKCHAIN_CONSTANTS.MINING.EMERGENCY_POW_THRESHOLD,
                    minPowScore: core_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_POW_SCORE,
                    forkResolutionTimeoutMs: core_1.BLOCKCHAIN_CONSTANTS.MINING.FORK_RESOLUTION_TIMEOUT_MS,
                    forkResolutionTimeout: core_1.BLOCKCHAIN_CONSTANTS.MINING.FORK_RESOLUTION_TIMEOUT,
                    hashBatchSize: core_1.BLOCKCHAIN_CONSTANTS.MINING.HASH_BATCH_SIZE,
                    maxTarget: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_TARGET,
                    minDifficulty: core_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_DIFFICULTY,
                    initialDifficulty: core_1.BLOCKCHAIN_CONSTANTS.MINING.INITIAL_DIFFICULTY,
                    maxAdjustmentFactor: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_ADJUSTMENT_FACTOR,
                    voteInfluence: core_1.BLOCKCHAIN_CONSTANTS.MINING.VOTE_INFLUENCE,
                    minVotesWeight: core_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_VOTES_WEIGHT,
                    maxChainLength: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_CHAIN_LENGTH,
                    minRewardContribution: core_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_REWARD_CONTRIBUTION,
                    maxBlockSize: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_BLOCK_SIZE,
                    minBlockSize: core_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_BLOCK_SIZE,
                    maxTransactions: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_TRANSACTIONS,
                    minBlocksMined: core_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_BLOCKS_MINED,
                    maxTxSize: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_TX_SIZE,
                    minFeePerByte: core_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_FEE_PER_BYTE,
                    maxSupply: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_SUPPLY,
                    safeConfirmationTime: core_1.BLOCKCHAIN_CONSTANTS.MINING.SAFE_CONFIRMATION_TIME,
                    maxPropagationTime: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_PROPAGATION_TIME,
                    nodeSelectionThreshold: core_1.BLOCKCHAIN_CONSTANTS.MINING.NODE_SELECTION_THRESHOLD,
                    orphanWindow: core_1.BLOCKCHAIN_CONSTANTS.MINING.ORPHAN_WINDOW,
                    propagationWindow: core_1.BLOCKCHAIN_CONSTANTS.MINING.PROPAGATION_WINDOW,
                    targetTimespan: core_1.BLOCKCHAIN_CONSTANTS.MINING.TARGET_TIMESPAN,
                    targetBlockTime: core_1.BLOCKCHAIN_CONSTANTS.MINING.TARGET_BLOCK_TIME,
                },
                consensus: {
                    baseDifficulty: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.BASE_DIFFICULTY,
                    baseReward: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.BASE_REWARD,
                    consensusTimeout: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.CONSENSUS_TIMEOUT,
                    emergencyTimeout: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.EMERGENCY_TIMEOUT,
                    halvingInterval: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.HALVING_INTERVAL,
                    initialReward: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.INITIAL_REWARD,
                    maxForkLength: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MAX_FORK_LENGTH,
                    maxSafeReward: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MAX_SAFE_REWARD,
                    minParticipation: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_PARTICIPATION,
                    minPeriodLength: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_PERIOD_LENGTH,
                    minPowHashRate: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_POW_HASH_RATE,
                    minReward: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_REWARD,
                    minVoterCount: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_VOTER_COUNT,
                    nodeSelectionTimeout: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.NODE_SELECTION_TIMEOUT,
                    powWeight: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.POW_WEIGHT,
                    votingPeriod: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTING_PERIOD,
                    votePowerCap: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTE_POWER_CAP,
                    votingDayPeriod: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTING_DAY_PERIOD,
                    validatorWeight: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.VALIDATOR_WEIGHT,
                    voteCollectionTimeout: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTE_COLLECTION_TIMEOUT,
                },
                votingConstants: {
                    cacheDuration: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.CACHE_DURATION,
                    cooldownBlocks: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.COOLDOWN_BLOCKS,
                    maturityPeriod: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MATURITY_PERIOD,
                    maxVoteSizeBytes: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTE_SIZE_BYTES,
                    maxVotesPerPeriod: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTES_PER_PERIOD,
                    maxVotesPerWindow: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTES_PER_WINDOW,
                    maxVotingPower: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTING_POWER,
                    minAccountAge: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_ACCOUNT_AGE,
                    minPeerCount: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_PEER_COUNT,
                    minPowContribution: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_POW_CONTRIBUTION,
                    minPowWork: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_POW_WORK,
                    periodCheckInterval: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.PERIOD_CHECK_INTERVAL,
                    votingPeriodBlocks: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_BLOCKS,
                    votingPeriodMs: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_MS,
                    minVoteAmount: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_VOTE_AMOUNT,
                    minVotesForValidity: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_VOTES_FOR_VALIDITY,
                    minVotingPower: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_VOTING_POWER,
                    rateLimitWindow: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.RATE_LIMIT_WINDOW,
                    reputationThreshold: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.REPUTATION_THRESHOLD,
                    voteEncryptionVersion: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTE_ENCRYPTION_VERSION,
                    votingWeight: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_WEIGHT,
                    votePowerDecay: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTE_POWER_DECAY,
                },
                util: {
                    processingTimeoutMs: core_1.BLOCKCHAIN_CONSTANTS.UTIL.PROCESSING_TIMEOUT_MS,
                    retryAttempts: core_1.BLOCKCHAIN_CONSTANTS.UTIL.RETRY_ATTEMPTS,
                    absoluteMaxSize: core_1.BLOCKCHAIN_CONSTANTS.UTIL.ABSOLUTE_MAX_SIZE,
                    backoffFactor: core_1.BLOCKCHAIN_CONSTANTS.UTIL.BACKOFF_FACTOR,
                    baseMaxSize: core_1.BLOCKCHAIN_CONSTANTS.UTIL.BASE_MAX_SIZE,
                    cacheTtlHours: core_1.BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL_HOURS,
                    retryDelayMs: core_1.BLOCKCHAIN_CONSTANTS.UTIL.RETRY_DELAY_MS,
                    cacheTtl: core_1.BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL,
                    cache: {
                        ttlMs: core_1.BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL,
                        ttlHours: core_1.BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL_HOURS,
                        cleanupIntervalMs: core_1.BLOCKCHAIN_CONSTANTS.UTIL.CACHE.CLEANUP_INTERVAL_MS,
                    },
                    initialRetryDelay: core_1.BLOCKCHAIN_CONSTANTS.UTIL.INITIAL_RETRY_DELAY,
                    maxRetries: core_1.BLOCKCHAIN_CONSTANTS.UTIL.MAX_RETRIES,
                    maxRetryDelay: core_1.BLOCKCHAIN_CONSTANTS.UTIL.MAX_RETRY_DELAY,
                    pruneThreshold: core_1.BLOCKCHAIN_CONSTANTS.UTIL.PRUNE_THRESHOLD,
                    staleThreshold: core_1.BLOCKCHAIN_CONSTANTS.UTIL.STALE_THRESHOLD,
                    validationTimeoutMs: core_1.BLOCKCHAIN_CONSTANTS.UTIL.VALIDATION_TIMEOUT_MS,
                    retry: {
                        backoffFactor: core_1.BLOCKCHAIN_CONSTANTS.UTIL.BACKOFF_FACTOR,
                        initialDelayMs: core_1.BLOCKCHAIN_CONSTANTS.UTIL.INITIAL_RETRY_DELAY,
                        maxAttempts: core_1.BLOCKCHAIN_CONSTANTS.UTIL.MAX_RETRIES,
                        maxDelayMs: core_1.BLOCKCHAIN_CONSTANTS.UTIL.MAX_RETRY_DELAY,
                    },
                },
                transaction: {
                    currentVersion: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.CURRENT_VERSION,
                    maxInputs: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_INPUTS,
                    maxOutputs: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_OUTPUTS,
                    maxSize: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIZE,
                    amountLimits: {
                        min: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.AMOUNT_LIMITS.MIN,
                        max: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.AMOUNT_LIMITS.MAX,
                        decimals: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.AMOUNT_LIMITS.DECIMALS,
                    },
                    maxMessageAge: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_MESSAGE_AGE,
                    maxPubkeySize: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_PUBKEY_SIZE,
                    maxScriptSize: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SCRIPT_SIZE,
                    maxTimeDrift: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_TIME_DRIFT,
                    maxSignatureSize: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIGNATURE_SIZE,
                    maxTotalInput: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_TOTAL_INPUT,
                    maxTxVersion: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_TX_VERSION,
                    mempool: {
                        highCongestionThreshold: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.HIGH_CONGESTION_THRESHOLD,
                        maxMb: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MAX_MB,
                        evictionInterval: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.EVICTION_INTERVAL,
                        feeRateMultiplier: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.FEE_RATE_MULTIPLIER,
                        minFeeRate: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_FEE_RATE,
                        cleanupInterval: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.CLEANUP_INTERVAL,
                        maxMemoryUsage: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MAX_MEMORY_USAGE,
                        minSize: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_SIZE,
                    },
                    minInputAge: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MIN_INPUT_AGE,
                    minTxVersion: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MIN_TX_VERSION,
                    processingTimeout: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.PROCESSING_TIMEOUT,
                    required: core_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.REQUIRED,
                },
                validator: {
                    minBlockProduction: core_1.BLOCKCHAIN_CONSTANTS.VALIDATOR.MIN_BLOCK_PRODUCTION,
                    minValidatorUptime: core_1.BLOCKCHAIN_CONSTANTS.VALIDATOR.MIN_VALIDATOR_UPTIME,
                    minVoteParticipation: core_1.BLOCKCHAIN_CONSTANTS.VALIDATOR.MIN_VOTE_PARTICIPATION,
                },
                backupValidatorConfig: {
                    maxBackupAttempts: core_1.BLOCKCHAIN_CONSTANTS.BACKUP_VALIDATOR_CONFIG.MAX_BACKUP_ATTEMPTS,
                    backupSelectionTimeout: core_1.BLOCKCHAIN_CONSTANTS.BACKUP_VALIDATOR_CONFIG.BACKUP_SELECTION_TIMEOUT,
                    minBackupReputation: core_1.BLOCKCHAIN_CONSTANTS.BACKUP_VALIDATOR_CONFIG.MIN_BACKUP_REPUTATION,
                    minBackupUptime: core_1.BLOCKCHAIN_CONSTANTS.BACKUP_VALIDATOR_CONFIG.MIN_BACKUP_UPTIME,
                },
                version: 1, // Set the version
                minSafeConfirmations: 6,
                maxSafeUtxoAmount: 1000000000000,
                coinbaseMaturity: 100,
                userAgent: "/H3Tag:1.0.0/",
                protocolVersion: 1,
                maxMempoolSize: 50000,
                minRelayTxFee: 0.00001,
                minPeers: 3,
                message: {
                    prefix: "\x18H3Tag Signed Message:\n",
                    maxLength: 100000,
                    minLength: 1,
                },
                wallet: {
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
            });
            // Create mempool
            const mempool = new core_1.Mempool(blockchain);
            // Create node instance
            const node = new core_1.Node(blockchain, this.blockchainSchema, mempool, this.configService, this.auditManager);
            // Start the node
            await node.start();
            // Generate unique node ID
            const nodeId = `node-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 9)}`;
            // Store node instance
            this.nodes.set(nodeId, node);
            return {
                nodeId,
                status: "running",
                endpoint: `${params.host || "localhost"}:${params.port || 3000}`,
                networkType: params.networkType,
                peerCount: node.getPeerCount(),
                region: params.region,
            };
        }
        catch (error) {
            throw new Error(`Failed to create node: ${error.message}`);
        }
    }
    /**
     * @swagger
     * /nodes/{nodeId}/status:
     *   get:
     *     summary: Get node status information
     *     tags: [Nodes]
     *     parameters:
     *       - in: path
     *         name: nodeId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Node status retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/NodeStatusDto'
     *       404:
     *         description: Node not found
     */
    async getNodeStatus(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) {
            throw new Error("Node not found");
        }
        return {
            nodeId,
            status: "running",
            peerCount: node.getPeerCount(),
            bannedPeers: node.getBannedPeers(),
            address: node.getAddress(),
        };
    }
    /**
     * @swagger
     * /nodes/{nodeId}:
     *   delete:
     *     summary: Stop and remove a node
     *     tags: [Nodes]
     *     parameters:
     *       - in: path
     *         name: nodeId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Node stopped successfully
     *         schema:
     *           type: boolean
     *       404:
     *         description: Node not found
     */
    async stopNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node)
            return false;
        await node.stop();
        this.nodes.delete(nodeId);
        return true;
    }
    /**
     * @swagger
     * /nodes/{nodeId}/validators:
     *   get:
     *     summary: Get active validators for a node
     *     tags: [Nodes]
     *     parameters:
     *       - in: path
     *         name: nodeId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Active validators retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   address:
     *                     type: string
     *       404:
     *         description: Node not found
     */
    async getActiveValidators(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) {
            throw new Error("Node not found");
        }
        return node.getActiveValidators();
    }
    async discoverPeers(nodeId) {
        try {
            const node = this.nodes.get(nodeId);
            if (!node) {
                throw new Error("Node not found");
            }
            // Initial peer count
            const initialPeerCount = node.getPeerCount();
            // Trigger peer discovery
            await node.discoverPeers();
            // Get updated peer count
            const newPeerCount = node.getPeerCount();
            return {
                discoveredPeers: Math.max(0, newPeerCount - initialPeerCount),
                totalPeers: newPeerCount,
                peerMetrics: {
                    current: newPeerCount,
                    minimum: node.getConfig().minPeers,
                },
            };
        }
        catch (error) {
            common_1.Logger.error("Failed to discover peers:", error);
            throw error;
        }
    }
    async connectToPeer(nodeId, peerAddress) {
        try {
            const node = this.nodes.get(nodeId);
            if (!node) {
                throw new Error("Node not found");
            }
            // Connect to peer
            await node.connectToPeer(peerAddress);
            // Get peer info
            const peer = node.getPeer(peerAddress);
            if (!peer) {
                throw new Error("Failed to get peer information after connection");
            }
            return {
                status: "connected",
                address: peerAddress,
                version: peer.getVersion().toString(),
                height: peer.getHeight(),
                connectedAt: new Date().toISOString(),
            };
        }
        catch (error) {
            common_1.Logger.error("Failed to connect to peer:", error);
            throw error;
        }
    }
};
exports.NodeService = NodeService;
exports.NodeService = NodeService = __decorate([
    (0, common_1.Injectable)()
], NodeService);
