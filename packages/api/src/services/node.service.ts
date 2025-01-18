import { Injectable, Logger } from "@nestjs/common";
import {
  Node,
  Blockchain,
  Mempool,
  AuditManager,
  BlockchainSchema,
  BLOCKCHAIN_CONSTANTS,
} from "@h3tag-blockchain/core";
import {
  CreateNodeDto,
  NodeResponseDto,
  NodeStatusDto,
  PeerDiscoveryResponseDto,
  PeerConnectionResponseDto,
} from "../dtos/node.dto";
import { ConfigService } from "@h3tag-blockchain/shared";
import { KeyManager } from "@h3tag-blockchain/crypto";

/**
 * @swagger
 * tags:
 *   name: Nodes
 *   description: Blockchain node management endpoints
 */
@Injectable()
export class NodeService {
  private nodes: Map<string, Node> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly blockchainSchema: BlockchainSchema,
    private readonly auditManager: AuditManager
  ) {}

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
  async createNode(params: CreateNodeDto): Promise<NodeResponseDto> {
    try {
      // Initialize blockchain with complete config
      const blockchain = await Blockchain.create({
        network: {
          type: params.networkType,
          port: params.port || 8333,
          host: params.host || "localhost",
          seedDomains: BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.seedDomains[params.networkType],
        },
        currency: {
          name: 'H3TAG',
          symbol: 'TAG',
          decimals: BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
          initialSupply: BLOCKCHAIN_CONSTANTS.CURRENCY.INITIAL_SUPPLY,
          maxSupply: BLOCKCHAIN_CONSTANTS.CURRENCY.MAX_SUPPLY,
          units: {
            MACRO: BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.MACRO,
            MICRO: BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.MICRO,
            MILLI: BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.MILLI,
            TAG: BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.TAG,
          },
        },
        mining: {
          blocksPerYear: BLOCKCHAIN_CONSTANTS.MINING.BLOCKS_PER_YEAR,
          initialReward: BLOCKCHAIN_CONSTANTS.MINING.INITIAL_REWARD,
          blockTime: BLOCKCHAIN_CONSTANTS.MINING.BLOCK_TIME,
          halvingInterval: BLOCKCHAIN_CONSTANTS.MINING.HALVING_INTERVAL,
          maxHalvings: BLOCKCHAIN_CONSTANTS.MINING.MAX_HALVINGS,
          maxDifficulty: BLOCKCHAIN_CONSTANTS.MINING.MAX_DIFFICULTY,
          targetTimePerBlock: BLOCKCHAIN_CONSTANTS.MINING.TARGET_TIME_PER_BLOCK,
          difficulty: BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY,
          targetBlockTime: BLOCKCHAIN_CONSTANTS.MINING.TARGET_BLOCK_TIME,
          targetTimespan: BLOCKCHAIN_CONSTANTS.MINING.TARGET_TIMESPAN,
          maxForkDepth: BLOCKCHAIN_CONSTANTS.MINING.MAX_FORK_DEPTH,
          emergencyPowThreshold: BLOCKCHAIN_CONSTANTS.MINING.EMERGENCY_POW_THRESHOLD,
          minPowNodes: BLOCKCHAIN_CONSTANTS.MINING.MIN_POW_NODES,
          propagationWindow: BLOCKCHAIN_CONSTANTS.MINING.PROPAGATION_WINDOW,
          difficultyAdjustmentInterval: BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY_ADJUSTMENT_INTERVAL,
          forkResolutionTimeout: BLOCKCHAIN_CONSTANTS.MINING.FORK_RESOLUTION_TIMEOUT,
          hashBatchSize: BLOCKCHAIN_CONSTANTS.MINING.HASH_BATCH_SIZE,
          initialDifficulty: BLOCKCHAIN_CONSTANTS.MINING.INITIAL_DIFFICULTY,
          minPowScore: BLOCKCHAIN_CONSTANTS.MINING.MIN_POW_SCORE,
          maxPropagationTime: BLOCKCHAIN_CONSTANTS.MINING.MAX_PROPAGATION_TIME,
          maxTarget: BLOCKCHAIN_CONSTANTS.MINING.MAX_TARGET,
          minDifficulty: BLOCKCHAIN_CONSTANTS.MINING.MIN_DIFFICULTY,
          nodeSelectionThreshold: BLOCKCHAIN_CONSTANTS.MINING.NODE_SELECTION_THRESHOLD,
          orphanWindow: BLOCKCHAIN_CONSTANTS.MINING.ORPHAN_WINDOW,
          minHashthreshold: BLOCKCHAIN_CONSTANTS.MINING.MIN_HASHRATE,
        },
        votingConstants: {
          votingPeriodBlocks:
          BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_BLOCKS,
        votingPeriodMs: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_MS,
        minPowWork: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_POW_WORK,
        cooldownBlocks: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.COOLDOWN_BLOCKS,
        maxVotesPerPeriod:
          BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTES_PER_PERIOD,
        minAccountAge: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_ACCOUNT_AGE,
        minPeerCount: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_PEER_COUNT,
        voteEncryptionVersion:
          BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTE_ENCRYPTION_VERSION,
        maxVoteSizeBytes:
          BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTE_SIZE_BYTES,
        votingWeight: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_WEIGHT,
        minVotesForValidity:
          BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_VOTES_FOR_VALIDITY,
        votePowerDecay: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTE_POWER_DECAY,
        },

        consensus: {
          powWeight: BLOCKCHAIN_CONSTANTS.CONSENSUS.POW_WEIGHT,
          voteWeight: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_WEIGHT,
          minPowHashrate: BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_POW_HASH_RATE,
          minVoterCount: BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_VOTER_COUNT,
          minPeriodLength: BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_PERIOD_LENGTH,
          votingPeriod: BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTING_PERIOD,
          minParticipation: BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_PARTICIPATION,
          nodeSelectionTimeout:
            BLOCKCHAIN_CONSTANTS.CONSENSUS.NODE_SELECTION_TIMEOUT,
          votePowerCap: BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTE_POWER_CAP,
          votingDayPeriod: BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTING_DAY_PERIOD,
          consensusTimeout: BLOCKCHAIN_CONSTANTS.CONSENSUS.CONSENSUS_TIMEOUT,
          emergencyTimeout: BLOCKCHAIN_CONSTANTS.CONSENSUS.EMERGENCY_TIMEOUT,
        },
        util: {
          retryAttempts: BLOCKCHAIN_CONSTANTS.UTIL.RETRY_ATTEMPTS,
        retryDelayMs: BLOCKCHAIN_CONSTANTS.UTIL.RETRY_DELAY_MS,
        cacheTtlHours: BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL_HOURS,
        validationTimeoutMs: BLOCKCHAIN_CONSTANTS.UTIL.VALIDATION_TIMEOUT_MS,
        initialRetryDelay: BLOCKCHAIN_CONSTANTS.UTIL.INITIAL_RETRY_DELAY,
        maxRetryDelay: BLOCKCHAIN_CONSTANTS.UTIL.MAX_RETRY_DELAY,
        backoffFactor: BLOCKCHAIN_CONSTANTS.UTIL.BACKOFF_FACTOR,
        maxRetries: BLOCKCHAIN_CONSTANTS.UTIL.MAX_RETRIES,
        cacheTtl: BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL,
        pruneThreshold: BLOCKCHAIN_CONSTANTS.UTIL.PRUNE_THRESHOLD,
        },
        wallet: {
          address: "",
        publicKey: async (): Promise<string> => {
          const keyPair = await KeyManager.generateKeyPair();
          return typeof keyPair.publicKey === "function"
            ? await keyPair.publicKey()
            : keyPair.publicKey;
        },
        privateKey: async (): Promise<string> => {
          const keyPair = await KeyManager.generateKeyPair();
          return typeof keyPair.privateKey === "function"
            ? await keyPair.privateKey()
            : keyPair.privateKey;
        },
        },
      });

      // Create mempool
      const mempool = new Mempool(blockchain);

      // Create node instance
      const node = new Node(
        blockchain,
        this.blockchainSchema,
        mempool,
        this.configService,
        this.auditManager
      );

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
    } catch (error) {
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
  async getNodeStatus(nodeId: string): Promise<NodeStatusDto> {
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
  async stopNode(nodeId: string): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

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
  async getActiveValidators(nodeId: string): Promise<{ address: string }[]> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error("Node not found");
    }
    return node.getActiveValidators();
  }

  async discoverPeers(nodeId: string): Promise<PeerDiscoveryResponseDto> {
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
    } catch (error) {
      Logger.error("Failed to discover peers:", error);
      throw error;
    }
  }

  async connectToPeer(
    nodeId: string,
    peerAddress: string
  ): Promise<PeerConnectionResponseDto> {
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
    } catch (error) {
      Logger.error("Failed to connect to peer:", error);
      throw error;
    }
  }
}
