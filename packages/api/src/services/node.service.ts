import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Node,
  Blockchain,
  Mempool,
  AuditManager,
  BlockchainSchema,
  BLOCKCHAIN_CONSTANTS,
} from '@h3tag-blockchain/core';
import {
  CreateNodeDto,
  NodeResponseDto,
  NodeStatusDto,
  PeerDiscoveryResponseDto,
  PeerConnectionResponseDto,
} from '../dtos/node.dto';
import { ConfigService } from '@h3tag-blockchain/shared';
import { KeyManager } from '@h3tag-blockchain/crypto';

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
    private readonly auditManager: AuditManager,
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
        currency: {
          name: BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
          symbol: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
          decimals: BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
          initialSupply: BLOCKCHAIN_CONSTANTS.CURRENCY.INITIAL_SUPPLY,
          maxSupply: BLOCKCHAIN_CONSTANTS.CURRENCY.MAX_SUPPLY,
          units: {
            MACRO: BigInt(BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.MACRO),
            MICRO: BigInt(BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.MICRO),
            MILLI: BigInt(BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.MILLI),
            TAG: BigInt(BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.TAG),
          },
        },
        network: {
          type: {
            MAINNET: BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.type.MAINNET,
            TESTNET: BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.type.TESTNET,
            DEVNET: BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.type.DEVNET,
          },
          port: {
            MAINNET: BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.port.MAINNET,
            TESTNET: BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.port.TESTNET,
            DEVNET: BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.port.DEVNET,
          },
          host: {
            MAINNET: BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.host.MAINNET,
            TESTNET: BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.host.TESTNET,
            DEVNET: BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.host.DEVNET,
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
          adjustmentInterval: BLOCKCHAIN_CONSTANTS.MINING.ADJUSTMENT_INTERVAL,
          maxAttempts: BLOCKCHAIN_CONSTANTS.MINING.MAX_ATTEMPTS,
          currentVersion: BLOCKCHAIN_CONSTANTS.MINING.CURRENT_VERSION,
          maxVersion: BLOCKCHAIN_CONSTANTS.MINING.MAX_VERSION,
          minVersion: BLOCKCHAIN_CONSTANTS.MINING.MIN_VERSION,
          autoMine: BLOCKCHAIN_CONSTANTS.MINING.AUTO_MINE,
          batchSize: BLOCKCHAIN_CONSTANTS.MINING.BATCH_SIZE,
          blocksPerYear: BLOCKCHAIN_CONSTANTS.MINING.BLOCKS_PER_YEAR,
          initialReward: BLOCKCHAIN_CONSTANTS.MINING.INITIAL_REWARD,
          minReward: BLOCKCHAIN_CONSTANTS.MINING.MIN_REWARD,
          blockReward: BLOCKCHAIN_CONSTANTS.MINING.BLOCK_REWARD,
          halvingInterval: BLOCKCHAIN_CONSTANTS.MINING.HALVING_INTERVAL,
          maxHalvings: BLOCKCHAIN_CONSTANTS.MINING.MAX_HALVINGS,
          blockTime: BLOCKCHAIN_CONSTANTS.MINING.BLOCK_TIME,
          maxBlockTime: BLOCKCHAIN_CONSTANTS.MINING.MAX_BLOCK_TIME,
          cacheTtl: BLOCKCHAIN_CONSTANTS.MINING.CACHE_TTL,
          difficulty: BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY,
          difficultyAdjustmentInterval:
            BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY_ADJUSTMENT_INTERVAL,
          maxDifficulty: BLOCKCHAIN_CONSTANTS.MINING.MAX_DIFFICULTY,
          targetTimePerBlock: BLOCKCHAIN_CONSTANTS.MINING.TARGET_TIME_PER_BLOCK,
          minHashrate: BLOCKCHAIN_CONSTANTS.MINING.MIN_HASHRATE,
          minPowNodes: BLOCKCHAIN_CONSTANTS.MINING.MIN_POW_NODES,
          maxForkDepth: BLOCKCHAIN_CONSTANTS.MINING.MAX_FORK_DEPTH,
          emergencyPowThreshold:
            BLOCKCHAIN_CONSTANTS.MINING.EMERGENCY_POW_THRESHOLD,
          minPowScore: BLOCKCHAIN_CONSTANTS.MINING.MIN_POW_SCORE,
          forkResolutionTimeoutMs:
            BLOCKCHAIN_CONSTANTS.MINING.FORK_RESOLUTION_TIMEOUT_MS,
          forkResolutionTimeout:
            BLOCKCHAIN_CONSTANTS.MINING.FORK_RESOLUTION_TIMEOUT,
          hashBatchSize: BLOCKCHAIN_CONSTANTS.MINING.HASH_BATCH_SIZE,
          maxTarget: BLOCKCHAIN_CONSTANTS.MINING.MAX_TARGET,
          minDifficulty: BLOCKCHAIN_CONSTANTS.MINING.MIN_DIFFICULTY,
          initialDifficulty: BLOCKCHAIN_CONSTANTS.MINING.INITIAL_DIFFICULTY,
          maxAdjustmentFactor:
            BLOCKCHAIN_CONSTANTS.MINING.MAX_ADJUSTMENT_FACTOR,
          voteInfluence: BLOCKCHAIN_CONSTANTS.MINING.VOTE_INFLUENCE,
          minVotesWeight: BLOCKCHAIN_CONSTANTS.MINING.MIN_VOTES_WEIGHT,
          maxChainLength: BLOCKCHAIN_CONSTANTS.MINING.MAX_CHAIN_LENGTH,
          minRewardContribution:
            BLOCKCHAIN_CONSTANTS.MINING.MIN_REWARD_CONTRIBUTION,
          maxBlockSize: BLOCKCHAIN_CONSTANTS.MINING.MAX_BLOCK_SIZE,
          minBlockSize: BLOCKCHAIN_CONSTANTS.MINING.MIN_BLOCK_SIZE,
          maxTransactions: BLOCKCHAIN_CONSTANTS.MINING.MAX_TRANSACTIONS,
          minBlocksMined: BLOCKCHAIN_CONSTANTS.MINING.MIN_BLOCKS_MINED,
          maxTxSize: BLOCKCHAIN_CONSTANTS.MINING.MAX_TX_SIZE,
          minFeePerByte: BLOCKCHAIN_CONSTANTS.MINING.MIN_FEE_PER_BYTE,
          maxSupply: BLOCKCHAIN_CONSTANTS.MINING.MAX_SUPPLY,
          safeConfirmationTime:
            BLOCKCHAIN_CONSTANTS.MINING.SAFE_CONFIRMATION_TIME,
          maxPropagationTime: BLOCKCHAIN_CONSTANTS.MINING.MAX_PROPAGATION_TIME,
          nodeSelectionThreshold:
            BLOCKCHAIN_CONSTANTS.MINING.NODE_SELECTION_THRESHOLD,
          orphanWindow: BLOCKCHAIN_CONSTANTS.MINING.ORPHAN_WINDOW,
          propagationWindow: BLOCKCHAIN_CONSTANTS.MINING.PROPAGATION_WINDOW,
          targetTimespan: BLOCKCHAIN_CONSTANTS.MINING.TARGET_TIMESPAN,
          targetBlockTime: BLOCKCHAIN_CONSTANTS.MINING.TARGET_BLOCK_TIME,
          maxPropagationWindow: 10000,
        },
        consensus: {
          baseDifficulty: BLOCKCHAIN_CONSTANTS.CONSENSUS.BASE_DIFFICULTY,
          baseReward: BLOCKCHAIN_CONSTANTS.CONSENSUS.BASE_REWARD,
          consensusTimeout: BLOCKCHAIN_CONSTANTS.CONSENSUS.CONSENSUS_TIMEOUT,
          emergencyTimeout: BLOCKCHAIN_CONSTANTS.CONSENSUS.EMERGENCY_TIMEOUT,
          halvingInterval: BLOCKCHAIN_CONSTANTS.CONSENSUS.HALVING_INTERVAL,
          initialReward: BLOCKCHAIN_CONSTANTS.CONSENSUS.INITIAL_REWARD,
          maxForkLength: BLOCKCHAIN_CONSTANTS.CONSENSUS.MAX_FORK_LENGTH,
          maxSafeReward: BLOCKCHAIN_CONSTANTS.CONSENSUS.MAX_SAFE_REWARD,
          minParticipation: BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_PARTICIPATION,
          minPeriodLength: BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_PERIOD_LENGTH,
          minPowHashRate: BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_POW_HASH_RATE,
          minReward: BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_REWARD,
          minVoterCount: BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_VOTER_COUNT,
          nodeSelectionTimeout:
            BLOCKCHAIN_CONSTANTS.CONSENSUS.NODE_SELECTION_TIMEOUT,
          powWeight: BLOCKCHAIN_CONSTANTS.CONSENSUS.POW_WEIGHT,
          votingPeriod: BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTING_PERIOD,
          votePowerCap: BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTE_POWER_CAP,
          votingDayPeriod: BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTING_DAY_PERIOD,
          validatorWeight: BLOCKCHAIN_CONSTANTS.CONSENSUS.VALIDATOR_WEIGHT,
          voteCollectionTimeout:
            BLOCKCHAIN_CONSTANTS.CONSENSUS.VOTE_COLLECTION_TIMEOUT,
        },
        votingConstants: {
          cacheDuration: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.CACHE_DURATION,
          cooldownBlocks: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.COOLDOWN_BLOCKS,
          maturityPeriod: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MATURITY_PERIOD,
          maxVoteSizeBytes:
            BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTE_SIZE_BYTES,
          maxVotesPerPeriod:
            BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTES_PER_PERIOD,
          maxVotesPerWindow:
            BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTES_PER_WINDOW,
          maxVotingPower:
            BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTING_POWER,
          minAccountAge: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_ACCOUNT_AGE,
          minPeerCount: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_PEER_COUNT,
          minPowContribution:
            BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_POW_CONTRIBUTION,
          minPowWork: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_POW_WORK,
          periodCheckInterval:
            BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.PERIOD_CHECK_INTERVAL,
          votingPeriodBlocks:
            BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_BLOCKS,
          votingPeriodMs:
            BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_MS,
          minVoteAmount: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_VOTE_AMOUNT,
          minVotesForValidity:
            BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_VOTES_FOR_VALIDITY,
          minVotingPower:
            BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_VOTING_POWER,
          rateLimitWindow:
            BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.RATE_LIMIT_WINDOW,
          reputationThreshold:
            BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.REPUTATION_THRESHOLD,
          voteEncryptionVersion:
            BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTE_ENCRYPTION_VERSION,
          votingWeight: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_WEIGHT,
          votePowerDecay:
            BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTE_POWER_DECAY,
        },
        util: {
          processingTimeoutMs: BLOCKCHAIN_CONSTANTS.UTIL.PROCESSING_TIMEOUT_MS,
          retryAttempts: BLOCKCHAIN_CONSTANTS.UTIL.RETRY_ATTEMPTS,
          absoluteMaxSize: BLOCKCHAIN_CONSTANTS.UTIL.ABSOLUTE_MAX_SIZE,
          backoffFactor: BLOCKCHAIN_CONSTANTS.UTIL.BACKOFF_FACTOR,
          baseMaxSize: BLOCKCHAIN_CONSTANTS.UTIL.BASE_MAX_SIZE,
          cacheTtlHours: BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL_HOURS,
          retryDelayMs: BLOCKCHAIN_CONSTANTS.UTIL.RETRY_DELAY_MS,
          cacheTtl: BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL,
          cache: {
            ttlMs: BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL,
            ttlHours: BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL_HOURS,
            cleanupIntervalMs:
              BLOCKCHAIN_CONSTANTS.UTIL.CACHE.CLEANUP_INTERVAL_MS,
          },
          initialRetryDelay: BLOCKCHAIN_CONSTANTS.UTIL.INITIAL_RETRY_DELAY,
          maxRetries: BLOCKCHAIN_CONSTANTS.UTIL.MAX_RETRIES,
          maxRetryDelay: BLOCKCHAIN_CONSTANTS.UTIL.MAX_RETRY_DELAY,
          pruneThreshold: BLOCKCHAIN_CONSTANTS.UTIL.PRUNE_THRESHOLD,
          staleThreshold: BLOCKCHAIN_CONSTANTS.UTIL.STALE_THRESHOLD,
          validationTimeoutMs: BLOCKCHAIN_CONSTANTS.UTIL.VALIDATION_TIMEOUT_MS,
          retry: {
            backoffFactor: BLOCKCHAIN_CONSTANTS.UTIL.BACKOFF_FACTOR,
            initialDelayMs: BLOCKCHAIN_CONSTANTS.UTIL.INITIAL_RETRY_DELAY,
            maxAttempts: BLOCKCHAIN_CONSTANTS.UTIL.MAX_RETRIES,
            maxDelayMs: BLOCKCHAIN_CONSTANTS.UTIL.MAX_RETRY_DELAY,
          },
        },
        transaction: {
          currentVersion: BLOCKCHAIN_CONSTANTS.TRANSACTION.CURRENT_VERSION,
          maxInputs: BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_INPUTS,
          maxOutputs: BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_OUTPUTS,
          maxSize: BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIZE,
          amountLimits: {
            min: BLOCKCHAIN_CONSTANTS.TRANSACTION.AMOUNT_LIMITS.MIN,
            max: BLOCKCHAIN_CONSTANTS.TRANSACTION.AMOUNT_LIMITS.MAX,
            decimals: BLOCKCHAIN_CONSTANTS.TRANSACTION.AMOUNT_LIMITS.DECIMALS,
          },
          maxMessageAge: BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_MESSAGE_AGE,
          maxPubkeySize: BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_PUBKEY_SIZE,
          maxScriptSize: BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SCRIPT_SIZE,
          maxTimeDrift: BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_TIME_DRIFT,
          maxSignatureSize: BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIGNATURE_SIZE,
          maxTotalInput: BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_TOTAL_INPUT,
          maxTxVersion: BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_TX_VERSION,
          maxBlockSize: BLOCKCHAIN_CONSTANTS.MINING.MAX_BLOCK_SIZE,
          maxTxSize: BLOCKCHAIN_CONSTANTS.MINING.MAX_TX_SIZE,
          minFee: BLOCKCHAIN_CONSTANTS.TRANSACTION.MIN_FEE,
          mempool: {
            highCongestionThreshold:
              BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL
                .HIGH_CONGESTION_THRESHOLD,
            maxMb: BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MAX_MB,
            evictionInterval:
              BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.EVICTION_INTERVAL,
            feeRateMultiplier:
              BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.FEE_RATE_MULTIPLIER,
            minFeeRate: BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_FEE_RATE,
            cleanupInterval:
              BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.CLEANUP_INTERVAL,
            maxMemoryUsage:
              BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MAX_MEMORY_USAGE,
            minSize: BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_SIZE,
            maxSize: BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MAX_SIZE,
          },
          minInputAge: BLOCKCHAIN_CONSTANTS.TRANSACTION.MIN_INPUT_AGE,
          minTxVersion: BLOCKCHAIN_CONSTANTS.TRANSACTION.MIN_TX_VERSION,
          processingTimeout:
            BLOCKCHAIN_CONSTANTS.TRANSACTION.PROCESSING_TIMEOUT,
          required: BLOCKCHAIN_CONSTANTS.TRANSACTION.REQUIRED,
        },
        validator: {
          minBlockProduction:
            BLOCKCHAIN_CONSTANTS.VALIDATOR.MIN_BLOCK_PRODUCTION,
          minValidatorUptime:
            BLOCKCHAIN_CONSTANTS.VALIDATOR.MIN_VALIDATOR_UPTIME,
          minVoteParticipation:
            BLOCKCHAIN_CONSTANTS.VALIDATOR.MIN_VOTE_PARTICIPATION,
        },
        backupValidatorConfig: {
          maxBackupAttempts:
            BLOCKCHAIN_CONSTANTS.BACKUP_VALIDATOR_CONFIG.MAX_BACKUP_ATTEMPTS,
          backupSelectionTimeout:
            BLOCKCHAIN_CONSTANTS.BACKUP_VALIDATOR_CONFIG
              .BACKUP_SELECTION_TIMEOUT,
          minBackupReputation:
            BLOCKCHAIN_CONSTANTS.BACKUP_VALIDATOR_CONFIG.MIN_BACKUP_REPUTATION,
          minBackupUptime:
            BLOCKCHAIN_CONSTANTS.BACKUP_VALIDATOR_CONFIG.MIN_BACKUP_UPTIME,
        },
        version: 1, // Set the version
        minSafeConfirmations: 6,
        maxSafeUtxoAmount: 1_000_000_000_000,
        coinbaseMaturity: 100,
        userAgent: '/H3Tag:1.0.0/',
        protocolVersion: 1,
        maxMempoolSize: 50000,
        minRelayTxFee: 0.00001,
        minPeers: 3,
        message: {
          prefix: '\x18H3Tag Signed Message:\n',
          maxLength: 100000,
          minLength: 1,
        },
        wallet: {
          address: '',
          publicKey: async (): Promise<string> => {
            const keyPair = await KeyManager.generateKeyPair();
            return typeof keyPair.publicKey === 'function'
              ? await keyPair.publicKey()
              : keyPair.publicKey;
          },
          privateKey: async (): Promise<string> => {
            const keyPair = await KeyManager.generateKeyPair();
            return typeof keyPair.privateKey === 'function'
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
        this.auditManager,
      );

      // Start the node
      await node.start();

      // Generate a unique node id using substring (avoiding deprecated substr)
      const nodeId = `node-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      // Store node instance
      this.nodes.set(nodeId, node);

      return {
        nodeId,
        status: 'running',
        endpoint: `${params.host || 'localhost'}:${params.port || 3000}`,
        networkType: params.networkType,
        peerCount: node.getPeerCount(),
        region: params.region,
      };
    } catch (error: unknown) {
      Logger.error('Failed to create node:', error);
      throw new Error(
        `Failed to create node: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
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
      throw new NotFoundException('Node not found');
    }

    return {
      nodeId,
      status: 'running',
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
      throw new NotFoundException('Node not found');
    }
    return node.getActiveValidators();
  }

  async discoverPeers(nodeId: string): Promise<PeerDiscoveryResponseDto> {
    try {
      const node = this.nodes.get(nodeId);
      if (!node) {
        throw new NotFoundException('Node not found');
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
      Logger.error('Failed to discover peers:', error);
      throw error;
    }
  }

  async connectToPeer(
    nodeId: string,
    peerAddress: string,
  ): Promise<PeerConnectionResponseDto> {
    try {
      const node = this.nodes.get(nodeId);
      if (!node) {
        throw new NotFoundException('Node not found');
      }

      // Connect to peer
      await node.connectToPeer(peerAddress);

      // Get peer info
      const peer = node.getPeer(peerAddress);
      if (!peer) {
        throw new Error('Failed to get peer information after connection');
      }

      return {
        status: 'connected',
        address: peerAddress,
        version: peer.getVersion()?.toString() || 'Unknown',
        height: peer.getHeight(),
        connectedAt: new Date().toISOString(),
      };
    } catch (error) {
      Logger.error('Failed to connect to peer:', error);
      throw error;
    }
  }
}
