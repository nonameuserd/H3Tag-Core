/**
 * @fileoverview Blockchain implements the core blockchain functionality including block processing,
 * chain management, consensus coordination, and network synchronization. It integrates PoW mining
 * and voting-based governance through a hybrid consensus mechanism.
 *
 * @module Blockchain
 */

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

import { UTXO, UTXOSet } from '../models/utxo.model';
import { Mempool } from './mempool';
import { BlockchainConfig } from '@h3tag-blockchain/shared';
import { Logger } from '@h3tag-blockchain/shared';
import { EventEmitter } from 'events';
import { BlockchainSchema } from '../database/blockchain-schema';
import { HybridDirectConsensus } from './consensus/hybrid-direct';
import {
  HybridCrypto,
  QuantumCrypto,
  KeyManager,
  HashUtils,
} from '@h3tag-blockchain/crypto';
import { BlockchainSync } from '../network/sync';
import { Peer } from '../network/peer';
import { BLOCKCHAIN_CONSTANTS } from './utils/constants';
import { BlockValidator } from '../validators/block.validator';
import { BlockchainStats } from './blockchain-stats';
import { Transaction } from '../models/transaction.model';
import { Block, BlockBuilder } from '../models/block.model';
import { Cache } from '../scaling/cache';
import { ShardManager } from '../scaling/sharding';
import { HealthMonitor } from '../monitoring/health';
import { Mutex } from 'async-mutex';
import { Node } from '../network/node';
import { MerkleTree } from '../utils/merkle';
import { TransactionValidator } from '../validators/transaction.validator';
import { ConfigService } from '@h3tag-blockchain/shared';
import { RateLimit } from '../security/rateLimit';
import { AuditManager } from '../security/audit';
import { CircuitBreaker } from '../network/circuit-breaker';
import { ErrorMonitor } from '../network/error-monitor';
import { MetricsCollector } from '../monitoring/metrics-collector';
import { retry, RetryStrategy } from '../utils/retry';
import { DDoSProtection } from '../security/ddos';
import { Vote } from '../models/vote.model';

interface DbSolution {
  data: {
    blockHash: string;
    nonce: number;
    difficulty: number;
    minerAddress: string;
    signature: string;
  };
  timestamp: number;
}

export interface PowSolution {
  blockHash: string;
  nonce: number;
  difficulty: number;
  timestamp: number;
  minerAddress: string;
  signature: string;
  verified?: boolean;
}

interface ChainTip {
  height: number;
  hash: string;
  branchLen: number; // Length of branch
  status: 'active' | 'valid-fork' | 'valid-headers' | 'invalid';
  firstBlockHash?: string; // Hash of the first block in the branch
  lastValidatedAt?: number;
}

export class Blockchain {
  private static instance: Blockchain;
  private chain: Block[] = [];
  private utxoSet: UTXOSet = new UTXOSet();
  private mempool: Mempool;
  private consensus: HybridDirectConsensus;
  private peers: Map<string, Peer> = new Map();
  private genesisBlock: Block = this.createGenesisBlock();
  private totalSupply: number = 0;
  private config: BlockchainConfig = this.initializeConfig();
  public db: BlockchainSchema = new BlockchainSchema();
  private shardManager: ShardManager = new ShardManager(
    {
      shardCount: 16,
      votingShards: 8,
      powShards: 8,
      maxShardSize: 1000000,
      replicationFactor: 3,
      reshardThreshold: 0.8,
      syncInterval: 60000,
    },
    this.db,
  );
  private consensusPublicKey: { publicKey: string }; // Declare first
  private sync: BlockchainSync;
  private node: Node;
  private readonly minConfirmations: number = 6; // Standard value for most blockchains

  private heightCache: { value: number; timestamp: number } | null = null;
  private readonly eventEmitter = new EventEmitter();
  private readonly utxoCache = new Cache<UTXO>({
    ttl: 300000,
    maxSize: 100000,
    compression: true,
  });
  private utxoSetCache = new Cache<UTXOSet>({
    ttl: 300000,
    maxSize: 1,
    compression: true,
  });
  private blockCache: Cache<Block>;
  private readonly healthMonitor: HealthMonitor;
  private readonly transactionCache = new Cache<Transaction>();
  private readonly firstTxCache = new Cache<{ blockHeight: number }>();
  private readonly hybridCrypto: typeof HybridCrypto;
  private merkleTree: MerkleTree;
  private readonly spentTxTracker = new Map<string, Set<number>>();
  private readonly txLock = new Mutex();
  private readonly MEMPOOL_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_MEMPOOL_SIZE = 50000; // Maximum transactions in mempool
  private readonly blacklistedAddresses = new Set<string>();
  private readonly rateLimiter: RateLimit;
  private readonly MAX_REORG_DEPTH = 100; // Maximum blocks to reorganize
  private readonly reorgLock = new Mutex();
  private readonly errorMonitor: ErrorMonitor;
  private readonly errorHandler = {
    handle: (error: Error, context: string): void => {
      Logger.error(`[${context}] ${error.message}`, {
        stack: error.stack,
        timestamp: new Date().toISOString(),
        blockHeight: this.getCurrentHeight(),
      });

      // Emit error event for monitoring
      this.eventEmitter.emit('blockchain_error', {
        context,
        error: error.message,
        timestamp: Date.now(),
      });
    },
  };
  private readonly peerManager: Peer;
  private readonly auditManager: AuditManager;
  private readonly cacheLock = new Mutex();
  private readonly circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private readonly metrics: MetricsCollector;
  private readonly retryStrategy: RetryStrategy;
  private boundSyncCompleted: () => void;
  private boundSyncError: (error: Error) => void;
  private readonly mutex = new Mutex();
  private readonly healthCheckInterval = 60000; // 1 minute
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private readonly validationInterval = 3600000; // 1 hour
  private validationTimer: NodeJS.Timeout | null = null;
  private ddosProtection: DDoSProtection;
  private readonly chainLock = new Mutex();

  /**
   * Creates a new blockchain instance with the specified configuration
   * @param config Optional blockchain configuration parameters
   */
  constructor(config?: BlockchainConfig) {
    this.metrics = new MetricsCollector('blockchain', 60000);
    this.errorMonitor = new ErrorMonitor();
    this.auditManager = new AuditManager();
    this.merkleTree = new MerkleTree();

    this.healthMonitor = new HealthMonitor({
      interval: 1000,
      thresholds: {
        minPowHashrate: 0.8,
        minPowNodes: 0.8,
        minTagDistribution: 0.8,
        maxTagConcentration: 0.8,
      },
    });
    this.initializeAsync(config);
    this.hybridCrypto = HybridCrypto;

    // Initialize caches with appropriate options
    this.blockCache = new Cache<Block>({
      ttl: 3600, // 1 hour
      maxSize: 1000,
      compression: true,
      priorityLevels: {
        pow: 3,
        quadratic_vote: 3,
      },
    });

    this.transactionCache = new Cache<Transaction>({
      ttl: 1800, // 30 minutes
      maxSize: 5000,
      compression: true,
    });

    this.utxoCache = new Cache<UTXO>({
      ttl: 300000, // 5 minutes
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
    this.peerManager = new Peer(
      this.config.network.host.MAINNET,
      this.config.network.port.MAINNET,
      {
        minPingInterval: 30000,
        handshakeTimeout: 5000,
        maxBanScore: 100,
      },
      ConfigService.getInstance(this.config),
      this.db,
    );

    // Set up peer event handlers
    this.peerManager.eventEmitter.on(
      'peer_banned',
      this.handlePeerBanned.bind(this),
    );
    this.peerManager.eventEmitter.on(
      'peer_violation',
      this.handlePeerViolation.bind(this),
    );

    this.rateLimiter = new RateLimit(
      {
        windowMs: 60000,
        maxRequests: {
          pow: 200,
          qudraticVote: 100,
          default: 50,
        },
      },
      this.auditManager,
    );

    // Initialize error monitoring
    this.errorMonitor.setThreshold('CONSENSUS_ERROR', 5);
    this.errorMonitor.setThreshold('NETWORK_ERROR', 10);
    this.errorMonitor.onThresholdExceeded((type, count) => {
      Logger.alert(
        `Error threshold exceeded for ${type}: ${count} occurrences`,
      );
    });

    this.circuitBreakers.set(
      'network',
      new CircuitBreaker({
        failureThreshold: 0.5,
        monitorInterval: 30000,
        resetTimeout: 60000,
      }),
    );
    this.circuitBreakers.set(
      'consensus',
      new CircuitBreaker({
        failureThreshold: 0.5,
        monitorInterval: 30000,
        resetTimeout: 60000,
      }),
    );

    // Initialize metrics collector with blockchain namespace
    this.metrics = new MetricsCollector('blockchain', 60000); // Flush every minute

    // Initialize retry strategy with configuration
    this.retryStrategy = new RetryStrategy({
      maxAttempts: 3,
      delay: 1000,
      exponentialBackoff: true,
      maxDelay: 10000,
      retryableErrors: [
        /network error/i,
        /timeout/i,
        'Connection refused',
        'ECONNRESET',
      ],
      jitterFactor: 0.25,
    });

    // Bind event handlers
    this.boundSyncCompleted = this.handleSyncCompleted.bind(this);
    this.boundSyncError = this.handleSyncError.bind(this);
    
    // Start periodic health checks
    this.healthCheckTimer = setInterval(async () => {
      try {
        const isHealthy = await this.healthCheck();
        if (!isHealthy) {
          Logger.warn('Blockchain health check failed');
          this.metrics.increment('health_check_failures');
          this.eventEmitter.emit('health_check_failed');
        }
      } catch (error) {
        Logger.error('Health check error:', error);
      }
    }, this.healthCheckInterval);

    // Start periodic validation
    this.startPeriodicValidation();

    // Start blockchain on initialization
    this.start().catch((error) => {
      Logger.error('Failed to start blockchain:', error);
    });

    this.ddosProtection = new DDoSProtection(
      {
        maxRequests: {
          default: 300,
          pow: 100,
          qudraticVote: 100,
        },
        windowMs: 60000,
        blockDuration: 1800000, // 30 minutes
      },
      this.auditManager,
    );

  // Initialize mempool first
    this.mempool = new Mempool(this);

    this.consensusPublicKey = { publicKey: '' }; // Initialize first
    this.sync = new BlockchainSync( // Initialize after
      this,
      this.peers,
      this.consensusPublicKey,
      this.db,
      this.mempool
    );

    this.node = new Node(
      this,
      this.db,
      this.mempool,
      ConfigService.getInstance(this.config),
      this.auditManager,
    );

    // Add listeners after sync initialization
    this.sync.on('sync_completed', this.boundSyncCompleted);
    this.sync.on('sync_error', this.boundSyncError);

    // Initialize consensus
    this.consensus = new HybridDirectConsensus(this);

    // Link mempool and consensus
    this.mempool.setConsensus(this.consensus);
  }

  /**
   * Initializes blockchain components asynchronously
   * @param config Optional blockchain configuration
   * @throws Error if initialization fails
   */
  private async initializeAsync(config?: BlockchainConfig): Promise<void> {
    try {
      await KeyManager.initialize();
      this.config = this.initializeConfig(config);
      this.db = new BlockchainSchema();
      this.peers = new Map();
      this.totalSupply = 0;

      // Load chain state from database
      const chainState = await this.db.getChainState();
      if (chainState) {
        // Rebuild chain from database
        this.chain = await this.db.getBlocksFromHeight(
          0,
          chainState.height + 1,
        );
      } else {
        // Initialize new chain with genesis block
        this.chain = [];
        this.genesisBlock = this.createGenesisBlock();
        await this.db.saveBlock(this.genesisBlock);
        this.chain.push(this.genesisBlock);
      }

      // Initialize core components
      this.utxoSet = new UTXOSet();
      this.mempool = new Mempool(this);

      // Give BlockValidator access to this blockchain instance
      BlockValidator.setBlockchain({
        getCurrentHeight: () => this.getCurrentHeight(),
        getLatestBlock: () => this.getLatestBlock(),
        getMempool: () => this.getMempool(),
        getBlockchainStats: () => this.getBlockchainStats(),
      });

      // Initialize shard manager
      this.shardManager = new ShardManager(
        {
          shardCount: 16,
          votingShards: 8,
          powShards: 8,
          maxShardSize: 1000000,
          replicationFactor: 3,
          reshardThreshold: 0.8,
          syncInterval: 60000,
        },
        this.db,
      );

      // Initialize consensus with 4-year voting period
      this.consensus = new HybridDirectConsensus(this);

      // Initialize other components
      this.sync = new BlockchainSync(
        this,
        this.peers,
        this.consensusPublicKey,
        this.db,
        this.mempool,
      );

      // Setup event listeners
      this.setupEventListeners();

      // Initialize keys
      await this.initializeKeys();

      // Add memory monitoring
      this.monitorMemoryUsage();
    } catch (error) {
      this.errorHandler.handle(error as Error, 'initialization');
      throw error; // Rethrow to prevent partial initialization
    }
  }

  /**
   * Initializes keys for consensus
   * @returns Promise<void>
   */
  private async initializeKeys(): Promise<void> {
    const keyPair = await QuantumCrypto.generateKeyPair();
    this.consensusPublicKey = {
      publicKey: keyPair.publicKey.toString('hex'),
    };
  }

  /**
   * Sets up event listeners
   * @returns void
   */
  private setupEventListeners(): void {
    // Fix: Store references to bound listeners for cleanup
    this.boundSyncCompleted = () => this.eventEmitter.emit('blockchain_synced');
    this.boundSyncError = (error) => {
      Logger.error('Blockchain sync error:', error);
      this.eventEmitter.emit('sync_error', error);
    };

    this.sync.on('sync_completed', this.boundSyncCompleted);
    this.sync.on('sync_error', this.boundSyncError);
  }

  /**
   * Creates a new blockchain instance
   * @param config Optional blockchain configuration
   * @returns Promise<Blockchain> New blockchain instance
   */
  public static async create(config?: BlockchainConfig): Promise<Blockchain> {
    if (!Blockchain.instance) {
      Blockchain.instance = new Blockchain(config);
      await Blockchain.instance.initializeAsync(config);
    }
    return Blockchain.instance;
  }

  /**
   * Create the genesis block
   */
  private createGenesisBlock(): Block {
    const timestamp = Date.now();
    const block: Block = {
      header: {
        version: 1,
        previousHash: '0'.repeat(64),
        merkleRoot: '',
        validatorMerkleRoot: '',
        timestamp,
        difficulty: 1,
        nonce: 0,
        height: 0,
        miner: '0'.repeat(40),
        totalTAG: 0,
        blockReward: 50,
        locator: [],
        hashStop: '',
        fees: 0,
        consensusData: {
          powScore: 0,
          votingScore: 0,
          participationRate: 0,
          periodId: 0,
        },
        signature: '',
        publicKey: '',
        hash: '',
        minerAddress: '',
        target: '',
      },
      transactions: [],
      votes: [],
      validators: [],
      hash: '',
      timestamp: timestamp,
      verifyHash: async () => {
        const calculatedHash = await HybridCrypto.hash(
          JSON.stringify(block.header),
        );
        return calculatedHash === block.hash;
      },
      verifySignature: async () => {
        return HybridCrypto.verify(
          block.hash || '',
          block.header.signature || '',
          block.header.publicKey || '',
        );
      },
      getHeaderBase: () => block.getHeaderBase(),
      isComplete(): boolean {
        return !!(
          this.hash &&
          this.header &&
          this.transactions?.length >= 0 &&
          this.header.merkleRoot &&
          this.header.timestamp &&
          this.header.nonce
        );
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
  public async addBlock(block: Block): Promise<boolean> {
    return this.withErrorBoundary('addBlock', async () => {
      const startTime = performance.now();
      const release = await this.chainLock.acquire();

      try {
        // System health validation
        if (!(await this.healthCheck())) {
          throw new Error(
            'UNHEALTHY_STATE, System unhealthy, cannot add block',
          );
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
        } catch (error: unknown) {
          Logger.error('Block addition failed, rolling back:', error);
          throw new Error(error as string);
        }
      } finally {
        release();
      }
    });
  }

  private async validateBlockPreAdd(block: Block): Promise<void> {
    const [signatureValid, consensusValid] = await Promise.all([
      HybridCrypto.verify(
        block.hash || '',
        block.header.signature || '',
        block.header.publicKey || '',
      ),
      this.consensus.pow.validateBlock(block),
    ]);

    if (!signatureValid) {
      throw new Error('INVALID_SIGNATURE, Invalid block signature');
    }
    if (!consensusValid) {
      throw new Error('CONSENSUS_INVALID, Block failed consensus validation');
    }
  }

  /**
   * Calculate block hash
   */
  private calculateBlockHash(block: Block): string {
    const header = block.header;
    const data =
      header.version +
      header.previousHash +
      header.merkleRoot +
      header.timestamp +
      header.difficulty +
      header.nonce;

    return HashUtils.sha3(data);
  }

  /**
   * Get block by hash with caching and validation
   */
  public async getBlock(hash: string): Promise<Block | undefined | null> {
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
          Logger.error('Error retrieving block from database:', error);
          return undefined;
        });
    } catch (error: unknown) {
      Logger.error('Error retrieving block:', error as Error);
      return Promise.resolve(undefined);
    }
  }

  /**
   * Get block by height
   */
  getBlockByHeight(height: number): Block | undefined {
    return this.chain[height];
  }

  /**
   * Get current chain height with caching
   * @returns number The current blockchain height
   */
  public getHeight(): number {
    try {
      // Use cached height if available
      if (
        this.heightCache?.value !== undefined &&
        Date.now() - (this.heightCache.timestamp || 0) <
          BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL
      ) {
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
      this.metrics.gauge('blockchain_height', height);

      return height;
    } catch (error) {
      Logger.error('Error getting blockchain height:', error);
      // Fallback to calculating height directly
      return Math.max(0, this.chain.length - 1);
    }
  }

  /**
   * Get UTXO set
   */
  public async getUTXOSet(): Promise<UTXOSet> {
    try {
      // Check cache first
      const cachedUtxoSet = this.utxoSetCache.get('current');
      if (cachedUtxoSet) {
        return cachedUtxoSet;
      }

      // Validate and cache UTXO set
      if (!this.utxoSet.validate()) {
        this.rebuildUTXOSet();
      }

      this.utxoSetCache.set('current', this.utxoSet);
      return this.utxoSet;
    } catch (error) {
      Logger.error('Error getting UTXO set:', error);
      throw error;
    }
  }

  /**
   * Rebuilds UTXO set
   */
  private rebuildUTXOSet(): void {
    try {
      const newUtxoSet = new UTXOSet();

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
              script: output.script || '',
              timestamp: block.header.timestamp,
              spent: false,
              currency: {
                name: BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
                symbol: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
                decimals: BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
              },
              publicKey: tx.sender,
              confirmations: 0,
            });
          });
        }
      }

      this.utxoSet = newUtxoSet;
      Logger.info('UTXO set rebuilt successfully');
    } catch (error) {
      Logger.error('Failed to rebuild UTXO set:', error);
      throw error;
    }
  }

  /**
   * Get current difficulty
   */
  public getCurrentDifficulty(): number {
    try {
      // If chain is empty or only genesis block exists, return initial difficulty
      if (this.chain.length <= 1) {
        return BLOCKCHAIN_CONSTANTS.MINING.INITIAL_DIFFICULTY;
      }

      const latestBlock = this.chain[this.chain.length - 1];

      if (
        (latestBlock.header.height + 1) %
          BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY_ADJUSTMENT_INTERVAL !==
        0
      ) {
        return latestBlock.header.difficulty;
      }

      const lastAdjustmentBlock =
        this.chain[
          this.chain.length -
            BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY_ADJUSTMENT_INTERVAL
        ];
      if (!lastAdjustmentBlock) {
        return latestBlock.header.difficulty;
      }

      const actualTimespan =
        latestBlock.header.timestamp - lastAdjustmentBlock.header.timestamp;
      let adjustedTimespan = actualTimespan;

      adjustedTimespan = Math.max(
        actualTimespan / BLOCKCHAIN_CONSTANTS.MINING.MAX_ADJUSTMENT_FACTOR,
        actualTimespan * BLOCKCHAIN_CONSTANTS.MINING.MAX_ADJUSTMENT_FACTOR,
      );
      const newDifficulty =
        (latestBlock.header.difficulty *
          BLOCKCHAIN_CONSTANTS.MINING.TARGET_TIMESPAN) /
        adjustedTimespan;

      return Math.max(
        newDifficulty,
        BLOCKCHAIN_CONSTANTS.MINING.MIN_DIFFICULTY,
      );
    } catch (error) {
      Logger.error('Error calculating difficulty:', error);
      return BLOCKCHAIN_CONSTANTS.MINING.MIN_DIFFICULTY;
    }
  }

  /**
   * Validate the entire chain
   */
  public async validateChain(): Promise<boolean> {
    try {
      for (let i = 1; i < this.chain.length; i++) {
        const currentBlock = this.chain[i];
        const previousBlock = this.chain[i - 1];

        // Validate block hash
        if (
          currentBlock.hash !==
          this.consensus.pow.calculateBlockHash(currentBlock)
        ) {
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
    } catch (error) {
      Logger.error('Chain validation failed:', error);
      return false;
    }
  }

  /**
   * Get chain state
   */
  getState(): {
    chain: Block[];
    utxoSet: UTXOSet;
    height: number;
    totalSupply: number;
  } {
    return {
      chain: [...this.chain],
      utxoSet: this.utxoSet,
      height: this.getHeight(),
      totalSupply: this.getTotalSupply(),
    };
  }

  public getMempool(): Mempool {
    return this.mempool;
  }

  public getTotalSupply(): number {
    return this.totalSupply;
  }

  public async getPowSolutions(
    minerAddress: string,
    sinceTimestamp: number,
  ): Promise<PowSolution[]> {
    try {
      const solutions = (await this.db.find({
        type: 'pow_solution',
        'data.minerAddress': minerAddress,
        timestamp: { $gte: sinceTimestamp },
      })) as unknown as DbSolution[];

      return solutions.map((sol) => ({
        blockHash: sol.data.blockHash,
        nonce: sol.data.nonce,
        difficulty: sol.data.difficulty,
        timestamp: sol.timestamp,
        minerAddress: sol.data.minerAddress,
        signature: sol.data.signature,
      }));
    } catch (error) {
      Logger.error('Failed to get PoW solutions:', error);
      return [];
    }
  }

  public getConfig() {
    return {
      blockchain: {
        maxSupply: BLOCKCHAIN_CONSTANTS.CURRENCY.MAX_SUPPLY,
        blockTime: BLOCKCHAIN_CONSTANTS.MINING.BLOCK_TIME,
      },
    };
  }

  public async start(): Promise<void> {
    // Add event listener for mined blocks
    this.consensus.pow.on('blockMined', async (data: Block) => {
      await this.handleBlockMined(data);
    });

    await this.sync.startSync();
  }

  public async stop(): Promise<void> {
    // Remove event listener
    this.consensus.pow.off('blockMined', this.handleBlockMined);

    KeyManager.shutdown();
    await this.sync.stop();
  }

  /**
   * Get blockchain stats
   */
  public getBlockchainStats(): BlockchainStats {
    return new BlockchainStats({
      getConsensusMetrics: this.getConsensusMetrics as () => Promise<{
        powHashrate: number;
        activeVoters: number;
        participation: number;
        currentParticipation: number;
      }>,
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

  public getCurrentHeight(): number {
    return this.chain.length - 1;
  }

  public getLatestBlock(): Block | null {
    if (this.chain.length === 0) return null;
    return this.chain[this.chain.length - 1];
  }

  /**
   * Calculates the merkle root for a given set of transactions
   * @param transactions Transactions to calculate the merkle root for
   * @returns Promise<string> The merkle root
   */
  private async calculateMerkleRoot(
    transactions: Transaction[],
  ): Promise<string> {
    try {
      const txData = transactions.map((tx) => {
        try {
          return JSON.stringify({
            id: tx.id,
            sender: tx.sender,
            recipients: tx.outputs.map((o) => o.address),
            amount: tx.outputs.reduce((sum, o) => {
              const amount = BigInt(o.amount);
              if (amount < 0n) throw new Error('Negative amount');
              return sum + amount;
            }, 0n),
          });
        } catch (error: unknown) {
          if (error instanceof Error) {
            throw new Error(`Invalid transaction data: ${error.message}`);
          }
          throw new Error('Invalid transaction data');
        }
      });
      return await this.merkleTree.createRoot(txData);
    } catch (error) {
      Logger.error('Merkle root calculation failed:', error);
      throw error;
    }
  }

  /**
   * Mines a new block
   * @param transactions Transactions to include in the block
   * @returns Promise<Block> Newly mined block
   */
  public async mineNewBlock(transactions: Transaction[]): Promise<Block> {
    const previousBlock = this.getLatestBlock();
    const nextHeight = previousBlock ? previousBlock.header.height + 1 : 0;

    // Calculate merkle root for transactions
    const merkleRoot = await this.calculateMerkleRoot(transactions);

    const blockBuilder = new BlockBuilder(
      previousBlock ? previousBlock.hash : '',
      BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY,
      this.auditManager,
    );

    blockBuilder.header.height = nextHeight;
    blockBuilder.header.merkleRoot = merkleRoot;
    await blockBuilder.setTransactions(transactions);

    const newBlock = await blockBuilder.build({
      address: this.config.wallet.address,
      publicKey: this.config.wallet.publicKey,
      privateKey: this.config.wallet.privateKey,
    });

    // Sign the block before consensus
    await this.signBlock(
      newBlock,
      this.config.wallet.privateKey as string,
    );

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
  public async getTransaction(hash: string): Promise<Transaction | undefined> {
    return this.withErrorBoundary('getTransaction', async () => {
      // Try cache first
      const cached = this.transactionCache.get(hash);
      if (cached) return cached;

      // If not in cache, try shards
      return await this.shardManager.getTransaction(hash);
    });
  }

  /**
   * Get currency details including current supply
   */
  public getCurrencyDetails() {
    return {
      name: BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
      symbol: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
      decimals: BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
      totalSupply: this.getTotalSupply(),
      maxSupply: BLOCKCHAIN_CONSTANTS.CURRENCY.MAX_SUPPLY,
      circulatingSupply: this.getCirculatingSupply(),
    };
  }

  /**
   * Calculate block reward at given height with additional security and precision
   */
  public calculateBlockReward(height: number): bigint {
    try {
      // Validate height
      if (height < 0) {
        Logger.warn('Invalid block height for reward calculation', { height });
        return BigInt(0);
      }

      // Get currency details
      const currency = {
        name: BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
        symbol: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        decimals: BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
        maxSupply: BLOCKCHAIN_CONSTANTS.CURRENCY.MAX_SUPPLY,
      };

      // Check max supply
      const currentSupply = this.getTotalSupply();
      if (currentSupply >= currency.maxSupply) {
        return BigInt(0);
      }

      // Calculate halvings with safety bounds
      const halvingInterval = BLOCKCHAIN_CONSTANTS.MINING.HALVING_INTERVAL;
      const maxHalvings = BLOCKCHAIN_CONSTANTS.MINING.MAX_HALVINGS;
      const halvings = Math.min(
        Math.floor(height / halvingInterval),
        maxHalvings,
      );

      // Calculate reward using BigInt
      const initialReward = BLOCKCHAIN_CONSTANTS.MINING.INITIAL_REWARD;
      const reward = initialReward >> BigInt(halvings);

      // Apply minimum reward check
      const minReward = BLOCKCHAIN_CONSTANTS.MINING.MIN_REWARD;
      return reward > minReward ? reward : minReward;
    } catch (error) {
      Logger.error('Error calculating block reward:', error);
      return BigInt(0);
    }
  }

  /**
   * Get circulating supply (excluding burned/locked tokens)
   */
  private getCirculatingSupply(): number {
    return Number(this.utxoSet.getTotalValue());
  }

  /**
   * Get confirmed UTXOs for an address
   * @param address Address to get UTXOs for
   * @returns Promise<Array<{ txid: string; vout: number; amount: number; confirmations: number; }>> Confirmed UTXOs
   */
  async getConfirmedUtxos(address: string): Promise<UTXO[]> {
    const utxos = await this.db.getUtxosByAddress(address);
    return utxos.filter((utxo) => utxo.confirmations >= this.minConfirmations);
  }

  /**
   * Initializes blockchain configuration
   * @param config Partial blockchain configuration
   * @returns Blockchain configuration
   */
  private initializeConfig(config?: BlockchainConfig): BlockchainConfig {
    return {
      currency: config?.currency || {
        name: BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
        symbol: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        decimals: BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
        initialSupply: BigInt(BLOCKCHAIN_CONSTANTS.CURRENCY.INITIAL_SUPPLY),
        maxSupply: BigInt(BLOCKCHAIN_CONSTANTS.CURRENCY.MAX_SUPPLY),
        units: {
          MACRO: BigInt(BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.MACRO),
          MICRO: BigInt(BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.MICRO),
          MILLI: BigInt(BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.MILLI),
          TAG: BigInt(BLOCKCHAIN_CONSTANTS.CURRENCY.UNITS.TAG),
        },
      },
      network: config?.network || {
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
      mining: config?.mining || {
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
        maxAdjustmentFactor: BLOCKCHAIN_CONSTANTS.MINING.MAX_ADJUSTMENT_FACTOR,
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
      },
      consensus: config?.consensus || {
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
      votingConstants: config?.votingConstants || {
        cacheDuration: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.CACHE_DURATION,
        cooldownBlocks: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.COOLDOWN_BLOCKS,
        maturityPeriod: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MATURITY_PERIOD,
        maxVoteSizeBytes:
          BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTE_SIZE_BYTES,
        maxVotesPerPeriod:
          BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTES_PER_PERIOD,
        maxVotesPerWindow:
          BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTES_PER_WINDOW,
        maxVotingPower: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTING_POWER,
        minAccountAge: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_ACCOUNT_AGE,
        minPeerCount: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_PEER_COUNT,
        minPowContribution:
          BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_POW_CONTRIBUTION,
        minPowWork: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_POW_WORK,
        periodCheckInterval:
          BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.PERIOD_CHECK_INTERVAL,
        votingPeriodBlocks:
          BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_BLOCKS,
        votingPeriodMs: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_MS,
        minVoteAmount: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_VOTE_AMOUNT,
        minVotesForValidity:
          BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_VOTES_FOR_VALIDITY,
        minVotingPower: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_VOTING_POWER,
        rateLimitWindow:
          BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.RATE_LIMIT_WINDOW,
        reputationThreshold:
          BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.REPUTATION_THRESHOLD,
        voteEncryptionVersion:
          BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTE_ENCRYPTION_VERSION,
        votingWeight: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_WEIGHT,
        votePowerDecay: BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTE_POWER_DECAY,
      },
      util: config?.util || {
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
      transaction: config?.transaction || {
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
        mempool: {
          highCongestionThreshold:
            BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.HIGH_CONGESTION_THRESHOLD,
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
        },
        minInputAge: BLOCKCHAIN_CONSTANTS.TRANSACTION.MIN_INPUT_AGE,
        minTxVersion: BLOCKCHAIN_CONSTANTS.TRANSACTION.MIN_TX_VERSION,
        processingTimeout: BLOCKCHAIN_CONSTANTS.TRANSACTION.PROCESSING_TIMEOUT,
        required: BLOCKCHAIN_CONSTANTS.TRANSACTION.REQUIRED,
      },
      validator: {
        minBlockProduction: BLOCKCHAIN_CONSTANTS.VALIDATOR.MIN_BLOCK_PRODUCTION,
        minValidatorUptime: BLOCKCHAIN_CONSTANTS.VALIDATOR.MIN_VALIDATOR_UPTIME,
        minVoteParticipation:
          BLOCKCHAIN_CONSTANTS.VALIDATOR.MIN_VOTE_PARTICIPATION,
      },
      backupValidatorConfig: config?.backupValidatorConfig || {
        maxBackupAttempts:
          BLOCKCHAIN_CONSTANTS.BACKUP_VALIDATOR_CONFIG.MAX_BACKUP_ATTEMPTS,
        backupSelectionTimeout:
          BLOCKCHAIN_CONSTANTS.BACKUP_VALIDATOR_CONFIG.BACKUP_SELECTION_TIMEOUT,
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
      wallet: config?.wallet || {
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
    };
  }

  /**
   * Get maximum allowed transaction size based on network conditions
   * @returns {number} Maximum transaction size in bytes
   */
  public async getMaxTransactionSize(): Promise<number> {
    try {
      const currentHeight = this.getCurrentHeight();
      const networkHealth = await this.healthMonitor.getNetworkHealth();

      // Reduce max size if network is congested
      if (!networkHealth.isHealthy) {
        return Math.floor(BLOCKCHAIN_CONSTANTS.UTIL.BASE_MAX_SIZE * 0.75);
      }

      // Allow larger transactions after certain height (network maturity)
      const maturityHeight = 50_000;
      if (currentHeight > maturityHeight) {
        // Calculate dynamic max size based on network conditions
        const mempoolSize = this.mempool.getSize();
        const maxMempoolSize = this.mempool.maxSize;
        const mempoolUsageRatio = mempoolSize / maxMempoolSize;

        // Adjust max size based on mempool usage
        const dynamicMaxSize = Math.floor(
          BLOCKCHAIN_CONSTANTS.UTIL.BASE_MAX_SIZE *
            (1 - mempoolUsageRatio * 0.5), // Reduce by up to 50% based on mempool usage
        );

        // Never exceed absolute maximum
        return Math.min(
          dynamicMaxSize,
          BLOCKCHAIN_CONSTANTS.UTIL.ABSOLUTE_MAX_SIZE,
        );
      }

      // Default to base size for young network
      return BLOCKCHAIN_CONSTANTS.UTIL.BASE_MAX_SIZE;
    } catch (error) {
      Logger.error('Error calculating max transaction size:', error);
      // Fall back to conservative limit if there's an error
      return BLOCKCHAIN_CONSTANTS.UTIL.BASE_MAX_SIZE;
    }
  }

  /**
   * Cleans up resources and stops blockchain operations
   */
  public async dispose(): Promise<void> {
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
        this.db?.close(), // Add database closure
        ...Array.from(this.circuitBreakers.values()).map((breaker) =>
          breaker.dispose(),
        ),
      ];

      await Promise.allSettled(cleanupTasks);

      // Clear all caches and references
      this.blockCache.clear();
      this.transactionCache.clear();
      this.utxoCache.clear();
      this.heightCache = null;
      this.utxoSetCache = new Cache<UTXOSet>();
      this.peers.clear();
      this.eventEmitter.removeAllListeners();
    } catch (error) {
      Logger.error('Error during blockchain disposal:', error);
      throw error;
    }
  }

  private monitorMemoryUsage(): void {
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const heapUsed = memoryUsage.heapUsed / 1024 / 1024; // MB
      const maxSize = parseInt(
        process.env.NODE_OPTIONS?.match(/--max-old-space-size=(\d+)/)?.[1] ||
          '2048',
      );

      if (heapUsed > BLOCKCHAIN_CONSTANTS.UTIL.PRUNE_THRESHOLD * maxSize) {
        this.pruneMemory();
      }
    }, 60000);
  }

  private pruneMemory(): void {
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

  public async getConsensusMetrics() {
    const metrics = this.consensus.getMetrics();
    const activeVoters = await metrics?.voting?.activeVoters || [];
    const participation = await metrics?.voting?.participationRate || 0;

    return {
      powHashrate: metrics.pow.averageHashRate,
      activeVoters: activeVoters.length,
      participation,
      currentParticipation: participation,
    };
  }

  public getNode(): Node {
    if (!this.node) {
      throw new Error('Node not initialized');
    }
    return this.node;
  }

  // Add method to sign blocks using HybridCrypto
  private async signBlock(
    block: Block,
    privateKey: string,
  ): Promise<void> {
    try {
      const keyPair = await HybridCrypto.generateKeyPair(privateKey);
      block.header.signature = await HybridCrypto.sign(block.hash, keyPair);
    } catch (error) {
      Logger.error('Error signing block:', error);
      throw error;
    }
  }

  // Update transaction handling
  public async addTransaction(tx: Transaction): Promise<boolean> {
    try {
      // Size validation first - cheapest check
      if (!this.validateTransactionSize(tx)) {
        throw new Error('Transaction size exceeds limit');
      }

      // Add nonce check to prevent replay attacks
      const expectedNonce = await this.db.getAccountNonce(tx.sender);
      if (tx.nonce !== expectedNonce) {
        throw new Error('Invalid transaction nonce');
      }

      // Add amount validation
      if (!this.validateTransactionAmount(tx)) {
        throw new Error('Invalid transaction amount');
      }

      // Verify signature with timeout
      const isValidSignature = await Promise.race([
        HybridCrypto.verify(tx.id, tx.signature, tx.sender),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Signature verification timeout')),
            5000,
          ),
        ),
      ]);

      if (!isValidSignature) {
        throw new Error('Invalid transaction signature');
      }

      // Add DDoS protection for transaction submissions
      if (!this.ddosProtection.checkRequest('blockchain_tx', tx.sender)) {
        Logger.warn(
          `DDoS protection blocked blockchain transaction from ${tx.sender}`,
        );
        return false;
      }

      // Add to mempool and cache
      this.mempool.addTransaction(tx);
      this.transactionCache.set(tx.id, tx);
      return true;
    } catch (error) {
      this.errorHandler.handle(error as Error, 'addTransaction');
      return false;
    }
  }

  /**
   * Gets the first transaction for an address
   * @param address Address to get the first transaction for
   * @returns Promise<{ blockHeight: number } | null> First transaction for the address
   */
  public async getFirstTransactionForAddress(
    address: string,
  ): Promise<{ blockHeight: number } | null> {
    try {
      // Check cache first
      const cacheKey = `first_tx:${address}`;
      const cached = this.firstTxCache.get(cacheKey);
      if (cached) return cached;

      // Query database with pagination for efficiency
      const batchSize = 1000;
      let currentHeight = this.getCurrentHeight();

      while (currentHeight > 0) {
        const startHeight = Math.max(0, currentHeight - batchSize);
        const blocks = await this.db.getBlocksFromHeight(
          startHeight,
          currentHeight,
        );

        for (const block of blocks) {
          for (const tx of block.transactions) {
            if (
              tx.sender === address ||
              tx.outputs.some((out) => out.address === address)
            ) {
              const result = { blockHeight: block.header.height };
              this.firstTxCache.set(cacheKey, result);
              return result;
            }
          }
        }

        currentHeight = startHeight - 1;
      }

      return null;
    } catch (error) {
      Logger.error('Error getting first transaction:', error);
      return null;
    }
  }

  /**
   * Validates transaction amount
   * @param tx Transaction to validate
   * @returns Promise<boolean> True if transaction amount is valid
   */
  public async validateTransactionAmount(tx: Transaction): Promise<boolean> {
    try {
      // Fix: Use BigInt for all calculations
      const totalInput = await this.calculateInputAmount(tx.inputs);
      const totalOutput = tx.outputs.reduce(
        (sum, out) => sum + BigInt(out.amount),
        0n,
      );
      const fee = BigInt(this.calculateTransactionFee(tx));

      // Check for overflow
      if (totalInput > BigInt(Number.MAX_SAFE_INTEGER)) {
        return false;
      }

      return totalInput >= totalOutput + fee;
    } catch {
      return false;
    }
  }

  /**
   * Calculates the total amount of inputs for a given transaction
   * @param inputs Inputs to calculate the total amount for
   * @returns Promise<bigint> Total amount of inputs
   */
  private async calculateInputAmount(
    inputs: Array<{ txId: string; outputIndex: number }>,
  ): Promise<bigint> {
    let total = 0n;
    for (const input of inputs) {
      const utxo = await this.utxoSet.getUtxo(input.txId, input.outputIndex);
      if (!utxo || utxo.spent) {
        throw new Error('Invalid or spent UTXO');
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
  private async checkAndMarkSpent(tx: Transaction): Promise<boolean> {
    const release = await this.txLock.acquire();
    try {
      for (const input of tx.inputs) {
        const spentOutputs = this.spentTxTracker.get(input.txId) || new Set();

        if (spentOutputs.has(input.outputIndex)) {
          return false; // Double-spend detected
        }

        spentOutputs.add(input.outputIndex);
        this.spentTxTracker.set(input.txId, spentOutputs);
      }
      return true;
    } finally {
      release();
    }
  }

  /**
   * Processes a payment transaction
   * @param tx Transaction to process
   * @returns Promise<boolean> True if transaction is processed successfully
   */
  @retry({
    maxAttempts: 3,
    delay: 500,
    exponentialBackoff: true,
    maxDelay: 5000,
    retryableErrors: ['Rate limit exceeded', /timeout/i],
  })
  public async processPayment(tx: Transaction): Promise<boolean> {
    return this.withErrorBoundary('processPayment', async () => {
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
          reject(new Error('Payment processing timeout'));
        }, 10000);
      });

      // Process with timeout
      try {
        this.metrics.histogram(
          'payment_processing_time',
          Date.now() - startTime,
        );
        this.metrics.gauge('mempool_size', this.mempool.getSize());
        await Promise.race([this.addTransaction(tx), timeoutPromise]);
        this.metrics.increment('successful_payments');

        return true;
      } catch (error) {
        Logger.error('Payment processing failed:', error);
        this.metrics.increment('payment_errors');
        await this.rollbackTransaction(tx);
        return false;
      }
    });
  }

  /**
   * Cleans up mempool
   */
  private cleanupMempool(): void {
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
        const sortedTxs = transactions.sort(
          (a, b) => a.timestamp - b.timestamp,
        );
        const excessCount = this.mempool.getSize() - this.MAX_MEMPOOL_SIZE;
        sortedTxs.slice(0, excessCount).forEach((tx) => {
          this.mempool.removeTransaction(tx.id);
        });
      }

      const after = this.mempool.getSize();

      // Record cleanup metrics
      this.metrics.gauge('mempool_size', after);
      this.metrics.histogram('mempool_cleanup_removed', before - after);
    } catch (error) {
      this.metrics.increment('mempool_cleanup_errors');
      throw error;
    }
  }

  /**
   * Handles chain reorganization when a new chain tip is received
   * @param newChainTip The new chain tip block
   * @returns Promise<boolean> True if reorganization was successful
   */
  public async handleChainReorganization(newChainTip: Block): Promise<boolean> {
    return this.withErrorBoundary('chainReorganization', async () => {
      const release = await this.reorgLock.acquire();
      const reorgSnapshot = await this.db.createSnapshot();

      try {
        const commonAncestor = await this.findCommonAncestor(newChainTip);
        if (!commonAncestor) return false;

        const reorgDepth =
          this.getCurrentHeight() - commonAncestor.header.height;
        if (reorgDepth > this.MAX_REORG_DEPTH) return false;

        // Fix: Use transaction for atomic updates
        await this.db.executeTransaction(async () => {
          await this.rollbackToBlock(commonAncestor.header.height);
          const newBlocks = await this.getNewChainBlocks(
            commonAncestor,
            newChainTip,
          );

          for (const block of newBlocks) {
            if (!(await this.addBlock(block))) {
              throw new Error('Reorg failed');
            }
          }
        });

        await this.db.commitSnapshot(reorgSnapshot);
        return true;
      } catch (error) {
        await this.db.rollbackSnapshot(reorgSnapshot);
        this.errorHandler.handle(error as Error, 'chainReorganization');
        return false;
      } finally {
        await release();
      }
    });
  }

  /**
   * Finds the common ancestor between two blocks
   * @param newTip The new chain tip block
   * @returns Promise<Block | null> The common ancestor block or null if not found
   */
  private async findCommonAncestor(
    newTip: Block | null | undefined,
  ): Promise<Block | null> {
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
  private validateTransactionSize(tx: Transaction): boolean {
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
  private calculateTransactionFee(tx: Transaction): bigint {
    return TransactionValidator.calculateTransactionFee(tx);
  }

  /**
   * Validates a transaction
   * @param tx Transaction to validate
   * @returns Promise<boolean> True if transaction is valid
   */
  public async validateTransaction(tx: Transaction): Promise<boolean> {
    return Promise.race([
      TransactionValidator.validateTransaction(
        tx,
        this.utxoSet,
        this.getCurrentHeight(),
      ),
      new Promise<boolean>((_, reject) =>
        setTimeout(
          () => reject(new Error('Transaction validation timeout')),
          5000,
        ),
      ),
    ]);
  }

  /**
   * Adds a new peer to the blockchain
   * @param peerUrl Peer URL to add
   * @returns Promise<boolean> True if peer was added successfully
   */
  public async addPeer(peerUrl: string): Promise<boolean> {
    try {
      const peer = new Peer(
        peerUrl,
        this.config.network.port.MAINNET,
        {
          minPingInterval: 30000,
          handshakeTimeout: 5000,
          maxBanScore: 100,
        },
        new ConfigService(this.config),
        this.db,
      );

      await peer.handshake();
      this.peers.set(peer.getId(), peer);
      Logger.info(`Successfully added peer: ${peerUrl}`);
      this.eventEmitter.emit('peer_added', { url: peerUrl });
      return true;
    } catch (error) {
      Logger.error(`Failed to add peer ${peerUrl}:`, error);
      return false;
    }
  }

  /**
   * Handles peer ban
   * @param data Peer ban data
   */
  private handlePeerBanned(data: { peerId: string; address: string }): void {
    Logger.warn(`Peer banned: ${data.address}`);
    this.eventEmitter.emit('peer_banned', data);
  }

  /**
   * Handles peer violation
   * @param data Peer violation data
   */
  private handlePeerViolation(data: {
    peerId: string;
    violation: string;
    severity: number;
  }): void {
    Logger.warn(`Peer violation: ${data.violation}`);
    this.eventEmitter.emit('peer_violation', data);
  }

  /**
   * Updates peer scores
   */
  private async updatePeerScores(): Promise<void> {
    try {
      for (const peer of this.peers.values()) {
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
    } catch (error) {
      Logger.error('Failed to update peer scores:', error);
    }
  }

  /**
   * Rolls back to a specific block height
   * @param height Block height to rollback to
   * @returns Promise<void>
   */
  private async rollbackToBlock(height: number): Promise<void> {
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
    } catch (error) {
      Logger.error('Error rolling back blocks:', error);
      throw error;
    }
  }

  /**
   * Gets new chain blocks
   * @param commonAncestor The common ancestor block
   * @param newTip The new chain tip block
   * @returns Promise<Block[]> New chain blocks
   */
  private async getNewChainBlocks(
    commonAncestor: Block,
    newTip: Block,
  ): Promise<Block[]> {
    const blocks: Block[] = [];
    let currentBlock = newTip;

    while (currentBlock.header.height > commonAncestor.header.height) {
      blocks.unshift(currentBlock); // Add to front to maintain order
      const prevBlock = await this.getBlock(currentBlock.header.previousHash);
      if (!prevBlock) break;
      currentBlock = prevBlock;
    }

    return blocks;
  }

  /**
   * Reverts a block
   * @param block Block to revert
   * @returns Promise<void>
   */
  private async revertBlock(block: Block): Promise<void> {
    try {
      // Revert transactions in reverse order
      for (const tx of block.transactions.reverse()) {
        await this.utxoSet.revertTransaction(tx);
        this.mempool.addTransaction(tx);
      }

      // Update chain state
      await this.db.setChainHead(block.header.height - 1);
      Logger.info(`Reverted block at height ${block.header.height}`);
    } catch (error) {
      Logger.error('Error reverting block:', error);
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
  private async withCircuitBreaker<T>(
    operation: string,
    action: () => Promise<T>,
  ): Promise<T> {
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
    } catch (error) {
      breaker.recordFailure();
      throw error;
    }
  }

  /**
   * Syncs with a peer
   * @param peer Peer to sync with
   * @returns Promise<void>
   */
  public async syncWithPeer(peer: Peer): Promise<void> {
    return this.withErrorBoundary('peerSync', async () => {
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
  private async rollbackTransaction(tx: Transaction): Promise<void> {
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
    } catch (error) {
      Logger.error('Error rolling back transaction:', error);
      throw error;
    }
  }

  /**
   * Handles sync completion
   */
  private handleSyncCompleted(): void {
    // Handle sync completion
    this.metrics.increment('sync_completed');
  }

  /**
   * Handles sync error
   * @param error Sync error
   */
  private handleSyncError(error: Error): void {
    // Handle sync error
    Logger.error('Sync error:', error);
    this.metrics.increment('sync_errors');
  }

  /**
   * Validates and updates the UTXO set
   * @throws Error if validation fails
   */
  private async validateAndUpdateUTXOSet(): Promise<void> {
    return this.withErrorBoundary('utxoValidation', async () => {
      const release = await this.cacheLock.acquire();
      try {
        if (!this.utxoSet.validate()) {
          Logger.warn('UTXO set validation failed, rebuilding...');
          this.rebuildUTXOSet();
        }
        this.utxoSetCache.set('current', this.utxoSet);
      } finally {
        release();
      }
    });
  }

  /**
   * Performs health check on blockchain system
   * @returns Promise<boolean> True if system is healthy
   */
  public async healthCheck(): Promise<boolean> {
    return this.withCircuitBreaker('health', async () => {
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
  private async withErrorBoundary<T>(
    operation: string,
    action: () => Promise<T>,
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      this.errorHandler.handle(error as Error, operation);
      throw error;
    }
  }

  /**
   * Starts periodic validation of blockchain state
   */
  private startPeriodicValidation(): void {
    this.validationTimer = setInterval(async () => {
      try {
        await this.validateAndUpdateUTXOSet();
      } catch (error) {
        Logger.error('UTXO validation failed:', error);
        this.metrics.increment('utxo_validation_failures');
      }
    }, this.validationInterval);
  }

  public async getValidatorCount(): Promise<number> {
    try {
      const validators = await this.db.getValidators();
      return validators.length;
    } catch (error) {
      Logger.error('Failed to get validator count:', error);
      return 0;
    }
  }

  private async handleBlockMined(block: Block): Promise<void> {
    return this.withErrorBoundary('handleBlockMined', async () => {
      // Validate the block first
      const isValid = await this.consensus.validateBlock(block);
      if (!isValid) {
        throw new Error('Mined block validation failed');
      }

      // Add block to chain
      const added = await this.addBlock(block);
      if (!added) {
        throw new Error('Failed to add mined block to chain');
      }

      // Update mempool and UTXO set
      await this.utxoSet.applyBlock(block);
      block.transactions.forEach((tx) => {
        this.mempool.removeTransaction(tx.id);
      });

      // Emit metrics
      this.metrics.gauge('block_height', this.getCurrentHeight());
      this.metrics.gauge('transactions_count', block.transactions.length);

      // Broadcast to network
      await this.node.broadcastBlock(block);
    });
  }

  public async getUTXO(
    txId: string,
    outputIndex: number,
  ): Promise<UTXO | null> {
    const release = await this.cacheLock.acquire();
    try {
      // Check cache first
      const cacheKey = `utxo:${txId}:${outputIndex}`;
      const cachedUtxo = this.utxoCache.get(cacheKey);
      if (cachedUtxo) return cachedUtxo;

      // Get from UTXO set
      const utxo = await this.utxoSet.get(txId, outputIndex);
      if (!utxo) return null;

      // Cache the result
      this.utxoCache.set(cacheKey, utxo, { ttl: 300000 }); // 5 minute TTL

      // Log for monitoring
      Logger.debug('UTXO retrieved', {
        txId,
        outputIndex,
        spent: utxo.spent,
      });

      return utxo;
    } catch (error) {
      Logger.error('Failed to get UTXO:', {
        txId,
        outputIndex,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    } finally {
      release();
    }
  }

  public async getDynamicBlockSize(block: Block): Promise<number> {
    return BlockValidator.calculateDynamicBlockSize(block);
  }

  public getVersion(): number {
    return BLOCKCHAIN_CONSTANTS.VERSION;
  }

  public hasBlock(hash: string): boolean {
    return (
      this.blockCache.has(hash) ||
      this.chain.some((block) => block.hash === hash)
    );
  }

  public async validateBlock(block: Block): Promise<boolean> {
    return this.consensus.validateBlock(block);
  }

  public async verifyBlock(block: Block): Promise<boolean> {
    try {
      // Verify block hash
      const validHash = await block.verifyHash();
      if (!validHash) return false;

      // Verify block signature
      const validSignature = await block.verifySignature();
      if (!validSignature) return false;

      // Verify transactions
      for (const tx of block.transactions) {
        if (!(await tx.verify())) return false;
      }

      return true;
    } catch (error) {
      Logger.error('Block verification failed:', error);
      return false;
    }
  }

  public async processVote(vote: Vote): Promise<void> {
    try {
      // Verify vote signature
      const isValid = await HybridCrypto.verify(
        vote.blockHash,
        vote.signature,
        vote.voter,
      );

      if (!isValid) {
        throw new Error('Invalid vote signature');
      }

      // Store vote in database
      await this.db.put(
        `vote:${vote.blockHash}:${vote.voter}`,
        JSON.stringify(vote),
      );

      Logger.info(
        `Vote processed for block ${vote.blockHash} by ${vote.voter}`,
      );
    } catch (error) {
      Logger.error('Vote processing failed:', error);
      throw error;
    }
  }

  /**
   * Gets the consensus public key for the blockchain
   * @returns string The consensus public key
   */
  public getConsensusPublicKey(): string {
    return this.consensusPublicKey.publicKey;
  }

  public static getInstance(config?: BlockchainConfig): Blockchain {
    if (!Blockchain.instance) {
      Blockchain.instance = new Blockchain(config);
    }
    return Blockchain.instance;
  }

  /**
   * Gets information about all known chain tips
   * @returns Promise<ChainTip[]> Array of chain tips information
   */
  public async getChainTips(): Promise<ChainTip[]> {
    try {
      const tips: ChainTip[] = [];
      const processedHashes = new Set<string>();
      const currentHeight = this.getCurrentHeight();

      // Add current active chain tip
      const activeBlock = this.getLatestBlock();
      if (activeBlock) {
        tips.push({
          height: currentHeight,
          hash: activeBlock.hash,
          branchLen: 0,
          status: 'active',
          lastValidatedAt: Date.now(),
        });
        processedHashes.add(activeBlock.hash);
      }

      // Get all known blocks at current height
      const blocksAtHeight = await this.db.getBlocksByHeight(currentHeight);

      // Process alternative chain tips
      for (const block of blocksAtHeight) {
        if (processedHashes.has(block.hash)) continue;

        let branchLen = 0;
        let currentBlock = block;
        let firstBlockHash = block.hash;
        let isValid = true;

        // Traverse down the chain to find branch length and validity
        while (currentBlock && currentBlock.header.height > 0) {
          // Try to find the block in our main chain
          const mainChainBlock = this.getBlockByHeight(
            currentBlock.header.height,
          );

          if (mainChainBlock && mainChainBlock.hash === currentBlock.hash) {
            break; // Found the fork point
          }

          branchLen++;

          // Validate the block
          isValid = isValid && (await this.validateBlock(currentBlock));
          if (!isValid) break;

          // Get previous block
          const previousBlock = await this.getBlock(
            currentBlock.header.previousHash,
          );
          if (!previousBlock) {
            throw new Error('Previous block not found'); // Handle the error as needed
          }

          currentBlock = previousBlock; // Assign only if previousBlock is valid
          firstBlockHash = currentBlock.hash;
        }

        // Determine status
        let status: ChainTip['status'];
        if (!isValid) {
          status = 'invalid';
        } else if (await this.verifyBlock(block)) {
          status = 'valid-fork';
        } else {
          status = 'valid-headers';
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
      this.metrics.gauge('chain_tips_count', tips.length);
      this.metrics.gauge(
        'valid_forks_count',
        tips.filter((tip) => tip.status === 'valid-fork').length,
      );

      return tips;
    } catch (error) {
      Logger.error('Failed to get chain tips:', error);
      throw error;
    }
  }

  public async getVerificationProgress(): Promise<number> {
    return this.sync ? await this.sync.getVerificationProgress() : 1;
  }

  public getChainWork(): string {
    const latestBlock = this.getLatestBlock();
    return latestBlock ? this.calculateChainWork(latestBlock) : '0x0';
  }

  public isInitialBlockDownload(): boolean {
    return this.sync ? this.sync.isInitialBlockDownload() : false;
  }

  private calculateChainWork(block: Block): string {
    try {
      let work = BigInt(block.header.difficulty);

      // Multiply by height to account for cumulative work
      work *= BigInt(block.header.height);

      // Adjust for hybrid consensus by considering validators
      if (block.validators && block.validators.length > 0) {
        const validatorWeight = BigInt(
          block.validators.length *
            BLOCKCHAIN_CONSTANTS.CONSENSUS.VALIDATOR_WEIGHT,
        );
        work += validatorWeight;
      }

      // Convert to hex string with '0x' prefix
      return '0x' + work.toString(16);
    } catch (error) {
      Logger.error('Chain work calculation failed:', error);
      return '0x0';
    }
  }

  public getConsensus(): HybridDirectConsensus {
    return this.consensus;
  }

  public async hasTransaction(hash: string): Promise<boolean> {
    // Check cache and chain
    return !!(
      this.transactionCache.has(hash) || (await this.getTransaction(hash))
    );
  }

  public async isUTXOSpent(input: {
    txId: string;
    outputIndex: number;
  }): Promise<boolean> {
    const utxo = await this.getUTXO(input.txId, input.outputIndex);
    return !utxo || utxo.spent;
  }

  private async updatePostBlockAdd(block: Block): Promise<void> {
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
      this.metrics.gauge('blockchain_height', this.getHeight());
      this.metrics.histogram(
        'transactions_per_block',
        block.transactions.length,
      );
    } catch (error) {
      Logger.error('Post-block update failed:', error);
      // Use retry decorator instead of queue
      await this.retryPostBlockAdd(block);
    }
  }

  @retry({
    maxAttempts: 3,
    delay: 1000,
    exponentialBackoff: true,
    maxDelay: 5000,
  })
  private async retryPostBlockAdd(block: Block): Promise<void> {
    await this.updatePostBlockAdd(block);
  }
}
