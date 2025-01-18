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
                network: {
                    type: params.networkType,
                    port: params.port || 8333,
                    host: params.host || "localhost",
                    seedDomains: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.seedDomains[params.networkType],
                },
                currency: {
                    name: 'H3TAG',
                    symbol: 'TAG',
                    decimals: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
                    initialSupply: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.INITIAL_SUPPLY,
                    maxSupply: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.MAX_SUPPLY,
                    units: {
                        MACRO: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.MACRO,
                        MICRO: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.MICRO,
                        MILLI: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.MILLI,
                        TAG: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.TAG,
                    },
                },
                mining: {
                    blocksPerYear: core_1.BLOCKCHAIN_CONSTANTS.MINING.BLOCKS_PER_YEAR,
                    initialReward: core_1.BLOCKCHAIN_CONSTANTS.MINING.INITIAL_REWARD,
                    blockTime: core_1.BLOCKCHAIN_CONSTANTS.MINING.BLOCK_TIME,
                    halvingInterval: core_1.BLOCKCHAIN_CONSTANTS.MINING.HALVING_INTERVAL,
                    maxHalvings: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_HALVINGS,
                    maxDifficulty: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_DIFFICULTY,
                    targetTimePerBlock: core_1.BLOCKCHAIN_CONSTANTS.MINING.TARGET_TIME_PER_BLOCK,
                    difficulty: core_1.BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY,
                    targetBlockTime: core_1.BLOCKCHAIN_CONSTANTS.MINING.TARGET_BLOCK_TIME,
                    targetTimespan: core_1.BLOCKCHAIN_CONSTANTS.MINING.TARGET_TIMESPAN,
                    maxForkDepth: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_FORK_DEPTH,
                    emergencyPowThreshold: core_1.BLOCKCHAIN_CONSTANTS.MINING.EMERGENCY_POW_THRESHOLD,
                    minPowNodes: core_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_POW_NODES,
                    propagationWindow: core_1.BLOCKCHAIN_CONSTANTS.MINING.PROPAGATION_WINDOW,
                    difficultyAdjustmentInterval: core_1.BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY_ADJUSTMENT_INTERVAL,
                    forkResolutionTimeout: core_1.BLOCKCHAIN_CONSTANTS.MINING.FORK_RESOLUTION_TIMEOUT,
                    hashBatchSize: core_1.BLOCKCHAIN_CONSTANTS.MINING.HASH_BATCH_SIZE,
                    initialDifficulty: core_1.BLOCKCHAIN_CONSTANTS.MINING.INITIAL_DIFFICULTY,
                    minPowScore: core_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_POW_SCORE,
                    maxPropagationTime: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_PROPAGATION_TIME,
                    maxTarget: core_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_TARGET,
                    minDifficulty: core_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_DIFFICULTY,
                    nodeSelectionThreshold: core_1.BLOCKCHAIN_CONSTANTS.MINING.NODE_SELECTION_THRESHOLD,
                    orphanWindow: core_1.BLOCKCHAIN_CONSTANTS.MINING.ORPHAN_WINDOW,
                    minHashthreshold: core_1.BLOCKCHAIN_CONSTANTS.MINING.MIN_HASHRATE,
                },
                votingConstants: {
                    votingPeriodBlocks: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_BLOCKS,
                    votingPeriodMs: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_MS,
                    minPowWork: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_POW_WORK,
                    cooldownBlocks: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.COOLDOWN_BLOCKS,
                    maxVotesPerPeriod: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTES_PER_PERIOD,
                    minAccountAge: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_ACCOUNT_AGE,
                    minPeerCount: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_PEER_COUNT,
                    voteEncryptionVersion: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTE_ENCRYPTION_VERSION,
                    maxVoteSizeBytes: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTE_SIZE_BYTES,
                    votingWeight: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_WEIGHT,
                    minVotesForValidity: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_VOTES_FOR_VALIDITY,
                    votePowerDecay: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTE_POWER_DECAY,
                },
                consensus: {
                    powWeight: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.POW_WEIGHT,
                    voteWeight: core_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_WEIGHT,
                    minPowHashrate: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_POW_HASH_RATE,
                    minVoterCount: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_VOTER_COUNT,
                    minPeriodLength: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_PERIOD_LENGTH,
                    votingPeriod: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTING_PERIOD,
                    minParticipation: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_PARTICIPATION,
                    nodeSelectionTimeout: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.NODE_SELECTION_TIMEOUT,
                    votePowerCap: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTE_POWER_CAP,
                    votingDayPeriod: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTING_DAY_PERIOD,
                    consensusTimeout: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.CONSENSUS_TIMEOUT,
                    emergencyTimeout: core_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.EMERGENCY_TIMEOUT,
                },
                util: {
                    retryAttempts: core_1.BLOCKCHAIN_CONSTANTS.UTIL.RETRY_ATTEMPTS,
                    retryDelayMs: core_1.BLOCKCHAIN_CONSTANTS.UTIL.RETRY_DELAY_MS,
                    cacheTtlHours: core_1.BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL_HOURS,
                    validationTimeoutMs: core_1.BLOCKCHAIN_CONSTANTS.UTIL.VALIDATION_TIMEOUT_MS,
                    initialRetryDelay: core_1.BLOCKCHAIN_CONSTANTS.UTIL.INITIAL_RETRY_DELAY,
                    maxRetryDelay: core_1.BLOCKCHAIN_CONSTANTS.UTIL.MAX_RETRY_DELAY,
                    backoffFactor: core_1.BLOCKCHAIN_CONSTANTS.UTIL.BACKOFF_FACTOR,
                    maxRetries: core_1.BLOCKCHAIN_CONSTANTS.UTIL.MAX_RETRIES,
                    cacheTtl: core_1.BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL,
                    pruneThreshold: core_1.BLOCKCHAIN_CONSTANTS.UTIL.PRUNE_THRESHOLD,
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
