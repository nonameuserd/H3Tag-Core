import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { Logger } from '@h3tag-blockchain/shared';
import { HybridKeyPair, HybridCrypto } from '@h3tag-blockchain/crypto';
import { WasmSHA3, SIMD } from '@h3tag-blockchain/crypto';
import { Block, BlockHeader } from '../../models/block.model';
import { BlockchainSchema } from '../../database/blockchain-schema';
import { Mempool } from '../mempool';
import { Blockchain } from '../blockchain';
import { ShardManager } from '../../scaling/sharding';
import { Cache } from '../../scaling/cache';
import { PerformanceMonitor } from '../../monitoring/performance-monitor';
import { MerkleTree } from '../../utils/merkle';
import { DDoSProtection } from '../../security/ddos';
import { BLOCKCHAIN_CONSTANTS } from '../utils/constants';
import { MiningDatabase } from '../../database/mining-schema';
import { MiningMetrics } from '../../monitoring/metrics';
import { DifficultyAdjuster } from '../../mining/difficulty';
import { AuditManager } from '../../security/audit';
import { databaseConfig } from '../../database/config.database';
import { GPUMiner } from '../../mining/gpu';
import { Transaction, TransactionStatus } from '../../models/transaction.model';
import { Node } from '../../network/node';
import { BlockValidator } from '../../validators/block.validator';
import { TransactionType } from '../../models/transaction.model';
import { BlockBuilder } from '../../models/block.model';
import { HealthMonitor } from '../../monitoring/health';
import { WorkerPool } from '../../network/worker-pool';
import { UTXOSet } from '../../models/utxo.model';
import { RetryStrategy } from '../../utils/retry';
import { Mutex } from 'async-mutex';
import { IBlockchainData } from '../blockchain-stats';

interface MiningResult {
  found: boolean;
  nonce: number;
  hash: string;
}

interface MiningHealth {
  isHealthy: boolean;
  hashRate: number;
  workerCount: number;
  cacheHitRate: number;
  lastBlockTime: number;
}

interface MiningInfo {
  powEnabled: boolean;
  mining: boolean;
  hashRate: number;
  difficulty: number;
  networkHashRate: number;
  blockHeight: number;
  lastBlockTime: number;
  workers: {
    total: number;
    active: number;
    idle: number;
  };
  hardware: {
    gpuEnabled: boolean;
    gpuStatus: string;
    cpuThreads: number;
  };
  mempool: {
    pending: number;
    size: number;
  };
  performance: {
    averageBlockTime: number;
    successRate: number;
    cacheHitRate: number;
  };
  network: {
    activeMiners: number;
    participationRate: number;
    targetBlockTime: number;
  };
}

interface BlockTemplate {
  version: number;
  height: number;
  previousHash: string;
  timestamp: number;
  difficulty: number;
  transactions: Transaction[];
  merkleRoot: string;
  target: string;
  minTime: number;
  maxTime: number;
  maxVersion: number;
  minVersion: number;
  defaultVersion: number;
}

export interface BlockInFlight {
  height: number;
  hash: string;
  startTime: number;
  timeout: NodeJS.Timeout;
  attempts: number;
  peer?: string; // Peer ID if block was requested from network
}

interface BlockSizeComponents {
  header: number;
  transactions: number;
  metadata: number;
  total: number;
}

/**
 * @fileoverview ProofOfWork implements the Proof of Work consensus mechanism for block mining
 * and validation. It handles mining operations, difficulty adjustments, and block rewards.
 *
 * @module ProofOfWork
 */

/**
 * ProofOfWork implements the Proof of Work consensus mechanism for block mining and validation.
 * It manages mining operations, worker threads, difficulty adjustments, and block rewards.
 *
 * @class ProofOfWork
 *
 * @property {BlockchainSchema} db - Database instance
 * @property {Mempool} mempool - Transaction mempool instance
 * @property {AuditManager} auditManager - Audit logging manager
 * @property {Worker[]} workers - Mining worker threads
 * @property {Cache<Block>} blockCache - Block validation cache
 * @property {MerkleTree} merkleTree - Merkle tree operations
 * @property {Performance} metrics - Mining performance metrics
 * @property {RetryStrategy} retryStrategy - Operation retry handling
 * @property {boolean} isInterrupted - Mining interrupt flag
 * @property {KeyPair} minerKeyPair - Miner's key pair
 * @property {number} miningFailures - Consecutive mining failures
 *
 * @example
 * const pow = new ProofOfWork(blockchain, mempool, auditManager);
 * await pow.initialize();
 * const block = await pow.createAndMineBlock();
 */

/**
 * Creates a new instance of ProofOfWork
 *
 * @constructor
 * @param {Blockchain} blockchain - Blockchain instance
 * @param {Mempool} mempool - Mempool instance
 * @param {AuditManager} auditManager - Audit manager instance
 */

/**
 * Initializes the mining system
 *
 * @async
 * @method initialize
 * @returns {Promise<void>}
 * @throws {Error} If initialization fails
 */

/**
 * Gets the current network difficulty
 *
 * @async
 * @method getNetworkDifficulty
 * @returns {Promise<number>} Current network difficulty
 */

/**
 * Gets active miners in the network
 *
 * @async
 * @method getActiveMiners
 * @returns {Promise<string[]>} Array of active miner addresses
 */

/**
 * Gets mining participation rate
 *
 * @async
 * @method getParticipationRate
 * @returns {Promise<number>} Participation rate as percentage
 */

/**
 * Creates and mines a new block
 *
 * @async
 * @method createAndMineBlock
 * @returns {Promise<Block>} Mined block
 * @throws {Error} If block creation or mining fails
 *
 * @example
 * const block = await pow.createAndMineBlock();
 * await blockchain.addBlock(block);
 */

/**
 * Validates a block's proof of work
 *
 * @async
 * @method validateBlock
 * @param {Block} block - Block to validate
 * @returns {Promise<boolean>} True if block is valid
 */

/**
 * Submits a mined block
 *
 * @async
 * @method submitBlock
 * @param {Block} block - Block to submit
 * @returns {Promise<boolean>} True if block was accepted
 * @throws {Error} If block validation fails
 */

/**
 * Gets mining information and statistics
 *
 * @async
 * @method getMiningInfo
 * @returns {Promise<MiningInfo>} Current mining status and statistics
 */

/**
 * Gets network hash rate
 *
 * @async
 * @method getNetworkHashPS
 * @param {number} blocks - Number of blocks to analyze (default 120)
 * @param {number} height - Starting block height (-1 for latest)
 * @returns {Promise<number>} Network hash rate in H/s
 */

/**
 * Gets block template for mining
 *
 * @async
 * @method getBlockTemplate
 * @param {string} minerAddress - Address to receive mining reward
 * @returns {Promise<BlockTemplate>} Block template ready for mining
 * @throws {Error} If template generation fails
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
 * @typedef {Object} MiningInfo
 * @property {boolean} powEnabled - Whether PoW mining is enabled
 * @property {boolean} mining - Whether currently mining
 * @property {number} hashRate - Current hash rate
 * @property {number} difficulty - Current network difficulty
 * @property {number} networkHashRate - Network hash rate
 * @property {number} blockHeight - Current block height
 * @property {number} lastBlockTime - Last block timestamp
 * @property {Object} workers - Worker thread statistics
 * @property {Object} hardware - Mining hardware information
 * @property {Object} mempool - Mempool statistics
 * @property {Object} performance - Mining performance metrics
 * @property {Object} network - Network statistics
 */

/**
 * @typedef {Object} BlockTemplate
 * @property {number} version - Block version
 * @property {number} height - Block height
 * @property {string} previousHash - Previous block hash
 * @property {number} timestamp - Block timestamp
 * @property {number} difficulty - Target difficulty
 * @property {Transaction[]} transactions - Block transactions
 * @property {string} merkleRoot - Merkle root of transactions
 * @property {string} target - Target hash in hex
 * @property {number} minTime - Minimum timestamp
 * @property {number} maxTime - Maximum timestamp
 */

/**
 * @typedef {Object} BlockSizeComponents
 * @property {number} header - Size of block header in bytes
 * @property {number} transactions - Size of transactions in bytes
 * @property {number} metadata - Size of metadata in bytes
 * @property {number} total - Total block size in bytes
 */

export class ProofOfWork {
  private readonly eventEmitter = new EventEmitter();
  private isInterrupted = false;
  public isMining = false;
  private readonly MAX_NONCE = Number.MAX_SAFE_INTEGER;
  private readonly db: BlockchainSchema;
  private readonly miningDb: MiningDatabase;
  private workers: Worker[] = [];
  private readonly NUM_WORKERS = cpus().length;
  private metrics?: MiningMetrics;
  private readonly mempool?: Mempool;
  private readonly target: bigint;
  private difficultyAdjuster?: DifficultyAdjuster;
  private gpuMiner?: GPUMiner;
  private readonly blockchain: Blockchain;
  private readonly node?: Node;
  private readonly nonceCache: Cache<MiningResult>;
  private readonly shardManager: ShardManager;
  private blockValidator?: {
    validateBlock: (block: Block) => Promise<boolean>;
  };
  private readonly blockCache: Cache<Block> = new Cache({
    maxSize: 1000,
    ttl: BLOCKCHAIN_CONSTANTS.MINING.CACHE_TTL,
    onEvict: async (key, block) => {
      try {
        await this.persistBlock(block);
      } catch (error) {
        Logger.error(`Failed to persist evicted block ${key}:`, error);
      }
    },
  });
  private readonly performanceMonitor: PerformanceMonitor;
  private readonly healthMonitor: HealthMonitor;
  private merkleTree: MerkleTree;
  private readonly gpuCircuitBreaker = {
    failures: 0,
    lastFailure: 0,
    threshold: 3,
    resetTimeout: 300000, // 5 minutes
    isOpen(): boolean {
      return (
        this.failures >= this.threshold &&
        Date.now() - this.lastFailure < this.resetTimeout
      );
    },
    recordFailure(): void {
      this.failures++;
      this.lastFailure = Date.now();
    },
  };
  private workerPool: WorkerPool;
  private readonly auditManager?: AuditManager;
  private readonly minerKeyPair?: HybridKeyPair;
  private ddosProtection?: DDoSProtection;
  private readonly templateCache: Cache<BlockTemplate>;
  private minTime: number = 0;
  private lastBlockTime: number = Date.now();
  private readonly blocksInFlight = new Map<number, BlockInFlight>();
  private readonly MAX_BLOCKS_IN_FLIGHT = 16;
  private readonly BLOCK_TIMEOUT = 60000; // 1 minute
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private miningFailures: number = 0;
  private readonly MAX_FAILURES = 5;
  private readonly retryStrategy: RetryStrategy;
  private readonly txSelectionLock = new Mutex();
  private readonly HASH_BATCH_SIZE = 1000; // Optimized batch size for hashing
  private readonly GPU_FALLBACK_THRESHOLD = 3; // Number of GPU failures before fallback
  private readonly CACHE_PREFETCH_SIZE = 100; // Number of blocks to prefetch
  private readonly MERKLE_TREE_CACHE_SIZE = 1000; // Cache size for merkle tree calculations
  private readonly WORKER_POOL_OVERSUBSCRIBE = 1.5; // Oversubscribe worker pool for better CPU utilization

  /**
   * Creates a new ProofOfWork instance
   * @param blockchain Reference to the blockchain instance
   */
  constructor(blockchain: Blockchain) {
    this.blockchain = blockchain;
    this.db = new BlockchainSchema();
    this.miningDb = new MiningDatabase(databaseConfig.databases.mining.path);
    this.workerPool = new WorkerPool(
      Math.ceil(this.NUM_WORKERS * this.WORKER_POOL_OVERSUBSCRIBE),
      '../../mining/worker.ts',
    );
    this.target = this.calculateTarget(
      BLOCKCHAIN_CONSTANTS.MINING.INITIAL_DIFFICULTY,
    );
    this.nonceCache = new Cache<MiningResult>({
      ttl: 600,
      maxSize: 5000,
      compression: true,
      priorityLevels: { pow: 3, default: 1 },
      onEvict: (key, value) => {
        Logger.info(`Evicting cache item with key: ${key}`);
        if (value && value.hash) {
          this.merkleTree.removeHash(value.hash);
          this.blockCache.delete(value.hash); // Clean up block cache
        }
      },
    });

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

    this.performanceMonitor = new PerformanceMonitor('pow');

    this.healthMonitor = new HealthMonitor({
      interval: 60000, // 1 minute
      thresholds: {
        minPowHashrate: 1000000,
        minPowNodes: 3,
      },
    });

    this.merkleTree = new MerkleTree();

    this.ddosProtection = new DDoSProtection(
      {
        maxRequests: {
          default: 50,
          pow: 100,
          qudraticVote: 100,
        },
        windowMs: 30000, // 30 seconds
        blockDuration: 900000, // 15 minutes
      },
      this.auditManager || new AuditManager(),
    );

    this.templateCache = new Cache<BlockTemplate>({
      ttl: 3600,
      maxSize: 1000,
    });

    this.retryStrategy = new RetryStrategy({
      maxAttempts: BLOCKCHAIN_CONSTANTS.UTIL.RETRY_ATTEMPTS,
      delay: BLOCKCHAIN_CONSTANTS.UTIL.RETRY_DELAY_MS,
    });
  }

  /**
   * Initializes PoW components including workers and GPU miner
   * @throws Error if initialization fails
   */
  async initialize(): Promise<void> {
    try {
      await Promise.all([WasmSHA3.initialize(), SIMD.initialize()]);

      // Initialize worker pool
      this.workers = await Promise.all(
        Array(this.NUM_WORKERS)
          .fill(0)
          .map(() => {
            const worker = new Worker('./worker.js');
            return new Promise<Worker>((resolve, reject) => {
              worker.once('online', () => resolve(worker));
              worker.once('error', (error) => reject(error));
            });
          }),
      );

      if (!this.workers.length) {
        throw new Error('Worker initialization failed');
      }

      this.metrics = MiningMetrics.getInstance();
      this.difficultyAdjuster = new DifficultyAdjuster(
        this.blockchain as IBlockchainData,
      );

      // Initialize block validation
      const validateBlock = async (block: Block): Promise<boolean> => {
        // Validate block reward
        const expectedReward = this.blockchain.calculateBlockReward(
          block.header.height,
        );
        const actualReward = block.transactions[0]?.outputs[0]?.amount || 0;

        if (actualReward > expectedReward) {
          Logger.warn('Invalid block reward', {
            expected: expectedReward,
            actual: actualReward,
            height: block.header.height,
          });
          return false;
        }

        // Validate block structure
        if (!this.validateBlockStructure(block)) {
          Logger.error('Invalid block structure');
          return false;
        }

        // Validate hash and difficulty
        const calculatedHash = this.calculateBlockHash(block);
        if (block.hash !== calculatedHash) {
          Logger.error('Block hash mismatch');
          return false;
        }

        const target = this.getTarget(block.header.difficulty);
        if (BigInt(`0x${block.hash}`) > target) {
          Logger.error('Block hash does not meet difficulty target');
          return false;
        }

        // Validate difficulty adjustment
        const expectedDifficulty = await this.calculateNextDifficulty(block);
        if (block.header.difficulty !== expectedDifficulty) {
          Logger.error('Invalid block difficulty');
          return false;
        }

        // Full block validation
        return BlockValidator.validateBlock(
          block,
          null, // previousBlock (null for genesis)
          new UTXOSet(), // UTXOSet instance
        );
      };

      this.blockValidator = { validateBlock };

      try {
        this.gpuMiner = new GPUMiner();
        await this.gpuMiner.initialize();
      } catch (error: unknown) {
        Logger.warn('GPU mining not available, falling back to CPU', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        this.metrics?.recordError('gpu_init');
      }

      // Start mining loop if configured to do so
      if (BLOCKCHAIN_CONSTANTS.MINING.AUTO_MINE) {
        this.startMining();
      }

      Logger.info('ProofOfWork initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize ProofOfWork:', error);
      throw error;
    }
  }

  /**
   * Mines a new block using available mining strategies
   * @param block Block structure to mine
   * @returns Promise<Block> Mined block with valid nonce
   * @throws Error if mining fails after max retries
   */
  public async mineBlock(block: Block): Promise<Block> {
    return this.withErrorBoundary('mineBlock', async () => {
      const startTime = performance.now();

      // Check cache before mining
      const cachedBlock = this.checkCache(block);
      if (cachedBlock) {
        Logger.info('Found cached mining solution');
        this.emitSuccess(
          cachedBlock,
          cachedBlock.header.nonce,
          this.calculateHashRate(
            cachedBlock.header.nonce,
            performance.now() - startTime,
          ),
          startTime,
        );
        return cachedBlock;
      }

      // Prepare block header before mining
      await this.prepareHeaderBase(block);

      // Add block to inflight tracking
      this.addInflightBlock(block);

      let timestampInterval: NodeJS.Timeout | undefined;

      try {
        // Update block timestamp periodically during mining
        const updateTimestamp = () => {
          block.header.timestamp = Math.floor(Date.now() / 1000);
        };
        timestampInterval = setInterval(updateTimestamp, 1000);

        while (!this.isInterrupted && block.header.nonce < this.MAX_NONCE) {
          // Update merkle root if mempool changed
          await this.txSelectionLock.runExclusive(async () => {
            if (await this.mempool?.hasChanged()) {
              block.header.merkleRoot = await this.merkleTree.createRoot(
                block.transactions.map((tx) => tx.hash),
              );
            }
          });

          // Try mining with different strategies (GPU, CPU, etc.)
          const result = await this.tryMiningStrategies(block);
          if (result) {
            clearInterval(timestampInterval);

            // Cache the successful mining result
            const cacheKey = `${result.header.previousHash}-${result.header.merkleRoot}`;
            this.nonceCache.set(cacheKey, {
              found: true,
              nonce: result.header.nonce,
              hash: result.hash,
            });

            this.emitSuccess(
              result,
              result.header.nonce,
              this.calculateHashRate(
                result.header.nonce,
                performance.now() - startTime,
              ),
              startTime,
            );

            // Store the solution when found
            await this.miningDb.storePowSolution({
              blockHash: result.hash,
              nonce: result.header.nonce,
              minerAddress: result.header.minerAddress,
              timestamp: Date.now(),
              signature: result.header.signature || '',
              difficulty: result.header.difficulty,
            });

            // Store mining metrics
            const metricsData = MiningMetrics.getInstance();
            metricsData.updateMetrics({
              hashRate: this.metrics?.hashRate || 0,
              difficulty: result.header.difficulty,
              blockTime: this.metrics?.blockTime || 0,
              tagFees: this.metrics?.tagFees || 0,
              tagVolume: this.metrics?.tagVolume || 0,
            });

            await this.miningDb.storeMiningMetrics(metricsData);

            this.updateMetrics(startTime, result.header.nonce, true); // Add metrics update
            return result;
          }

          // Check if we need to update block structure
          if (await this.shouldUpdateStructure(block)) {
            throw new Error('Block structure needs update');
          }

          block.header.nonce += BLOCKCHAIN_CONSTANTS.MINING.BATCH_SIZE;

          // Emit progress periodically
          if (block.header.nonce % 1000 === 0) {
            const hashRate = this.calculateHashRate(
              block.header.nonce,
              performance.now() - startTime,
            );
            this.emitProgress(block.header.nonce, hashRate, startTime);
          }
        }

        throw new Error('Mining failed: nonce space exhausted');
      } catch (error) {
        this.updateMetrics(startTime, block.header.nonce, false); // Add metrics update for failures
        Logger.error('Mining failed:', error);
        throw error;
      } finally {
        this.removeInflightBlock(block.header.height);
        // Clear the interval if it was set
        if (timestampInterval) {
          clearInterval(timestampInterval);
        }
      }
    });
  }

  /**
   * Handles error boundary for mining operations
   * @param operation Name of operation being performed
   * @param action Function to execute within boundary
   * @returns Promise<T> Result of operation
   */
  private async withErrorBoundary<T>(
    operation: string,
    action: () => Promise<T>,
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      Logger.error(`Error in ${operation}:`, error);
      this.metrics?.recordError(operation);
      throw error;
    }
  }

  private async tryMiningStrategies(block: Block): Promise<Block | null> {
    const startTime = performance.now();

    try {
      // Add prefetching for better cache utilization
      await this.prefetchCache(block.header.height);

      // Try GPU mining with batch size
      if (this.gpuMiner && !this.gpuCircuitBreaker.isOpen()) {
        try {
          const gpuResult = await this.gpuMiner.mine(
            block,
            this.target,
            this.HASH_BATCH_SIZE,
          );
          if (gpuResult) {
            block.header.nonce = gpuResult.nonce;
            block.hash = gpuResult.hash;
            return block;
          }
        } catch (error) {
          this.gpuCircuitBreaker.recordFailure();
          if (this.gpuCircuitBreaker.failures >= this.GPU_FALLBACK_THRESHOLD) {
            Logger.warn('GPU mining failed, permanently falling back to CPU');
            this.gpuMiner = undefined; // Permanently disable GPU mining
          }
          Logger.warn('GPU mining failed, trying parallel CPU mining', error);
        }
      }

      const parallelResult = await this.tryParallelMining(block);
      if (parallelResult) return parallelResult;

      // Fallback to CPU mining
      return await this.tryCPUMining(block);
    } catch (error) {
      this.updateMetrics(startTime, block.header.nonce, false);
      Logger.error('Mining failed:', error);
      throw error;
    }
  }

  private getTarget(difficulty: number): bigint {
    return BLOCKCHAIN_CONSTANTS.MINING.MAX_TARGET / BigInt(difficulty);
  }

  private validateBlockStructure(block: Block): boolean {
    try {
      // Basic null/undefined checks
      if (!block || !block.header) {
        Logger.error('Invalid block: missing block or header');
        return false;
      }

      // Required header fields validation
      const requiredFields: Array<{
        field: keyof BlockHeader;
        type: string;
        min: number;
      }> = [
        { field: 'version', type: 'number', min: 1 },
        { field: 'nonce', type: 'number', min: 0 },
        { field: 'difficulty', type: 'number', min: 1 },
        { field: 'timestamp', type: 'number', min: 1 },
        { field: 'height', type: 'number', min: 0 },
      ];

      for (const { field, type, min } of requiredFields) {
        if (
          typeof block.header[field] !== type ||
          (typeof block.header[field] === 'number' && block.header[field] < min)
        ) {
          Logger.error(`Invalid block: invalid ${field}`);
          return false;
        }
      }

      // Hash validations
      if (
        !this.isValidHash(block.header.previousHash) ||
        !this.isValidHash(block.header.merkleRoot)
      ) {
        Logger.error('Invalid block: invalid hashes');
        return false;
      }

      // Transaction validation
      if (
        !Array.isArray(block.transactions) ||
        block.transactions.length === 0
      ) {
        Logger.error('Invalid block: missing transactions');
        return false;
      }

      // Coinbase transaction must be first
      if (!this.isCoinbaseTransaction(block.transactions[0])) {
        Logger.error('Invalid block: first transaction must be coinbase');
        return false;
      }

      // Size limits
      if (
        this.calculateBlockSize(block).total >
        BLOCKCHAIN_CONSTANTS.MINING.MAX_BLOCK_SIZE
      ) {
        Logger.error('Invalid block: exceeds maximum size');
        return false;
      }

      if (block.header.version < BLOCKCHAIN_CONSTANTS.MINING.MIN_VERSION) {
        Logger.error('Invalid block: version too low');
        return false;
      }

      if (block.header.timestamp > Date.now() + 60000) {
        // 1 minute in future
        Logger.error('Invalid block: timestamp in future');
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Block validation error:', error);
      return false;
    }
  }

  /**
   * Calculates hash rate from mining results
   * @param nonce Final nonce value
   * @param timeTaken Time taken to find nonce in ms
   * @returns number Calculated hash rate
   */
  private calculateHashRate(hashes: number, timeInMs: number): number {
    const safeTime = timeInMs > 0 ? timeInMs : 1;
    return (hashes * 1000) / safeTime; // Hashes per second
  }

  /**
   * Updates mining metrics
   * @param startTime Start time of mining
   * @param nonce Nonce used for mining
   * @param success True if mining was successful
   */
  private updateMetrics(
    startTime: number,
    nonce: number,
    success: boolean,
  ): void {
    if (this.metrics) {
      const timeElapsed = performance.now() - startTime;
      this.metrics.totalBlocks++;
      if (success) this.metrics.successfulBlocks++;
      this.metrics.lastMiningTime = timeElapsed;
      this.metrics.averageHashRate =
        (this.metrics.averageHashRate * (this.metrics.totalBlocks - 1) +
          this.calculateHashRate(nonce, timeElapsed)) /
        this.metrics.totalBlocks;
    }
  }

  /**
   * Emits progress event for block mining
   * @param nonce Nonce used for mining
   * @param hashRate Hash rate of mining
   * @param startTime Start time of mining
   */
  private emitProgress(
    nonce: number,
    hashRate: number,
    startTime: number,
  ): void {
    this.eventEmitter.emit('miningProgress', {
      nonce,
      hashRate: `${(hashRate / 1000000).toFixed(2)} MH/s`,
      timeElapsed: `${((performance.now() - startTime) / 1000).toFixed(2)}s`,
    });
  }

  /**
   * Emits success event for block mining
   * @param block Block that was mined
   * @param nonce Nonce used for mining
   * @param hashRate Hash rate of mining
   * @param startTime Start time of mining
   */
  private emitSuccess(
    block: Block,
    nonce: number,
    hashRate: number,
    startTime: number,
  ): void {
    this.eventEmitter.emit('blockMined', {
      blockHeight: block.header.height,
      nonce,
      hashRate: `${(hashRate / 1000000).toFixed(2)} MH/s`,
      timeElapsed: `${((performance.now() - startTime) / 1000).toFixed(2)}s`,
      difficulty: block.header.difficulty,
    });
  }

  public getMetrics() {
    return { ...this.metrics };
  }

  public interruptMining(): void {
    this.isInterrupted = true;
  }

  public resumeMining(): void {
    this.isInterrupted = false;
  }

  /**
   * Calculates next difficulty
   * @param lastBlock Block to calculate from
   * @returns Promise<number> Next difficulty
   */
  private async calculateNextDifficulty(lastBlock: Block): Promise<number> {
    if (
      lastBlock.header.height %
        BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY_ADJUSTMENT_INTERVAL !==
      0
    ) {
      return lastBlock.header.difficulty;
    }

    const prevAdjustmentBlock = await this.getBlockByHeight(
      lastBlock.header.height -
        BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY_ADJUSTMENT_INTERVAL,
    );

    const timeExpected =
      BLOCKCHAIN_CONSTANTS.MINING.TARGET_TIME_PER_BLOCK *
      BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY_ADJUSTMENT_INTERVAL;
    const timeActual =
      lastBlock.header.timestamp - prevAdjustmentBlock.header.timestamp;

    // Adjust difficulty based on SHA3's faster processing
    let adjustment = (timeExpected / timeActual) * 0.75; // 25% more conservative
    adjustment = Math.max(0.25, Math.min(adjustment, 4.0)); // Limit adjustment range

    const newDifficulty = lastBlock.header.difficulty * adjustment;

    // Ensure difficulty doesn't drop too low for security
    return Math.max(
      newDifficulty,
      BLOCKCHAIN_CONSTANTS.MINING.INITIAL_DIFFICULTY / 4,
    );
  }

  /**
   * Gets block by height
   * @param height Block height
   * @returns Promise<Block> Block at specified height
   */
  private async getBlockByHeight(height: number): Promise<Block> {
    try {
      const blockData = await this.db.get(`block:${height}`);
      const block = JSON.parse(blockData) as Block;

      // Verify merkle root
      const txHashes = block.transactions.map((tx: Transaction) => tx.hash);
      const calculatedMerkleRoot = await this.merkleTree.createRoot(txHashes);

      if (calculatedMerkleRoot !== block.header.merkleRoot) {
        throw new Error('Invalid merkle root');
      }

      return {
        header: {
          version: block.header.version || 0,
          height: block.header.height,
          timestamp: block.header.timestamp,
          previousHash: block.header.previousHash,
          merkleRoot: calculatedMerkleRoot,
          validatorMerkleRoot: block.header.validatorMerkleRoot || '',
          difficulty: block.header.difficulty,
          locator: block.header.locator || [],
          hashStop: block.header.hashStop || '',
          nonce: block.header.nonce,
          miner: block.header.miner || '',
          totalTAG: block.header.totalTAG || 0,
          blockReward: block.header.blockReward || 0,
          fees: block.header.fees || 0,
          consensusData: block.header.consensusData || {},
          signature: block.header.signature || '',
          publicKey: block.header.publicKey || '',
          hash: block.hash || '',
          minerAddress: block.header.minerAddress || '',
          target: block.header.target || '',
        },
        hash: block.hash,
        transactions: block.transactions,
        votes: block.votes || [],
        validators: block.validators || [],
        timestamp: block.timestamp,
        verifyHash: async () => {
          const calculatedHash = await HybridCrypto.hash(JSON.stringify(block));
          return calculatedHash === block.hash;
        },
        verifySignature: async () => {
          return HybridCrypto.verify(
            block.hash,
            block.header.signature || '',
            block.header.publicKey || '',
          );
        },
        getHeaderBase: () => block.getHeaderBase(),
        isComplete(): boolean {
          return !!(
            block.hash &&
            block.header &&
            block.transactions?.length >= 0 &&
            block.header.merkleRoot &&
            block.header.timestamp &&
            block.header.nonce
          );
        },
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        Logger.error('Invalid JSON in block data:', error);
        throw new Error('Invalid block data format');
      }
      Logger.error('Failed to retrieve block:', error);
      throw error;
    }
  }

  /**
   * Calculates block hash
   * @param block Block to calculate hash for
   * @returns string Calculated hash
   */
  public calculateBlockHash(block: Block): string {
    const header = block.header;
    const data =
      header.version +
      header.previousHash +
      header.merkleRoot +
      header.timestamp +
      header.difficulty +
      header.nonce;

    // this can be replaced with a faster more secured hashing algorithm
    return createHash('sha3-256').update(data).digest('hex');
  }

  /**
   * Gets block by height
   * @param height Block height
   * @returns Promise<Block> Block at specified height
   */
  public async getBlock(height: number): Promise<Block> {
    try {
      // Get block using height index
      const blockData = await this.db.get(`block:height:${height}`);

      if (!blockData) {
        throw new Error(`Block at height ${height} not found`);
      }

      const block = JSON.parse(blockData) as Block;

      return {
        header: {
          version: block.header.version || 0,
          height: block.header.height,
          timestamp: block.header.timestamp,
          previousHash: block.header.previousHash,
          merkleRoot: block.header.merkleRoot,
          validatorMerkleRoot: block.header.validatorMerkleRoot || '',
          difficulty: block.header.difficulty,
          locator: block.header.locator || [],
          hashStop: block.header.hashStop || '',
          nonce: block.header.nonce,
          miner: block.header.miner || '',
          totalTAG: block.header.totalTAG || 0,
          blockReward: block.header.blockReward || 0,
          fees: block.header.fees || 0,
          consensusData: block.header.consensusData || {},
          signature: block.header.signature || '',
          publicKey: block.header.publicKey || '',
          hash: block.hash || '',
          minerAddress: block.header.minerAddress || '',
          target: block.header.target || '',
        },
        hash: block.hash,
        transactions: block.transactions,
        votes: block.votes || [],
        validators: block.validators || [],
        timestamp: block.timestamp,
        verifyHash: async () => {
          const calculatedHash = await HybridCrypto.hash(JSON.stringify(block));
          return calculatedHash === block.hash;
        },
        verifySignature: async () => {
          return HybridCrypto.verify(
            block.hash,
            block.header.signature || '',
            block.header.publicKey || '',
          );
        },
        getHeaderBase: () => block.getHeaderBase(),
        isComplete(): boolean {
          return !!(
            block.hash &&
            block.header &&
            block.transactions?.length >= 0 &&
            block.header.merkleRoot &&
            block.header.timestamp &&
            block.header.nonce
          );
        },
      };
    } catch (error) {
      Logger.error('Failed to get block:', error);
      throw error;
    }
  }

  private async prepareHeaderBase(block: Block): Promise<void> {
    try {
      const txHashes = block.transactions.map((tx) => tx.hash);

      // Use cached merkle tree if available
      const cacheKey = `merkle:${txHashes.join('')}`;
      const cachedRoot = this.merkleTree.getCachedRoot(cacheKey);

      if (cachedRoot) {
        block.header.merkleRoot = cachedRoot;
      } else {
        block.header.merkleRoot = await this.merkleTree.createRoot(txHashes);
        this.merkleTree.cacheRoot(cacheKey, block.header.merkleRoot);
      }
    } catch (error) {
      Logger.error('Failed to prepare block header:', error);
      throw error;
    }
  }

  /**
   * Calculates mining target based on difficulty
   * @param difficulty Current mining difficulty
   * @returns bigint Target value that hash must be below
   */
  private calculateTarget(difficulty: number): bigint {
    if (difficulty <= 0) {
      throw new Error('Invalid difficulty value');
    }
    return (
      BLOCKCHAIN_CONSTANTS.MINING.MAX_TARGET / BigInt(Math.floor(difficulty))
    );
  }

  /**
   * Checks cache for previous mining results
   * @param block Block to check
   * @returns Block with nonce and hash if found, null otherwise
   */
  private checkCache(block: Block): Block | null {
    const cacheKey = `${block.header.previousHash}-${block.header.merkleRoot}`;
    const cached = this.nonceCache.get(cacheKey);

    if (cached && cached.found) {
      block.header.nonce = cached.nonce;
      block.hash = cached.hash;
      return block;
    }

    return null;
  }

  /**
   * Validates block's proof of work
   * @param block Block to validate
   * @returns Promise<boolean> True if block meets difficulty target
   */
  public async validateBlock(block: Block): Promise<boolean> {
    const perfMarker = this.performanceMonitor.start('validate_block');

    try {
      // Parallelize validation checks
      const [hashValid, structureValid, difficultyValid] = await Promise.all([
        this.validateBlockHash(block),
        this.validateBlockStructure(block),
        this.validateBlockDifficulty(block),
      ]);

      return hashValid && structureValid && difficultyValid;
    } finally {
      this.performanceMonitor.end(perfMarker);
    }
  }

  private async validateBlockHash(block: Block): Promise<boolean> {
    const calculatedHash = this.calculateBlockHash(block);
    return block.hash === calculatedHash;
  }

  private async validateBlockDifficulty(block: Block): Promise<boolean> {
    const target = this.getTarget(block.header.difficulty);
    return BigInt(`0x${block.hash}`) <= target;
  }

  /**
   * Validates block's merkle root
   * @param block Block to validate
   * @returns Promise<boolean> True if merkle root is valid
   */
  public async validateBlockMerkleRoot(block: Block): Promise<boolean> {
    try {
      const merkleTree = new MerkleTree();
      const txHashes = block.transactions.map((tx) => tx.hash);

      // Verify transactions against stored merkle root
      return await merkleTree.verify(block.header.merkleRoot, txHashes);
    } catch (error) {
      Logger.error('Block merkle root validation failed:', error);
      return false;
    }
  }

  /**
   * Cleans up mining workers
   * @returns Promise<void>
   */
  private async cleanupWorkers(): Promise<void> {
    try {
      await Promise.all(
        this.workers.map(async (worker) => {
          await worker.terminate(); // Properly terminate workers
        }),
      );
      this.workers = [];
    } catch (error) {
      Logger.error('Failed to cleanup workers:', error);
    }
  }

  /**
   * Cleans up mining resources
   */
  public async dispose(): Promise<void> {
    this.isInterrupted = true;
    this.stopMining();
    await this.nonceCache.shutdown();
    await this.blockCache.shutdown();
    await this.cleanupWorkers();
    this.eventEmitter.removeAllListeners();
  }

  public on(event: string, listener: (...args: Block[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  public off(event: string, listener: (...args: Block[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * Validates proof of work for a given hash
   * @param hash Hash to validate
   * @param minWork Minimum work required
   * @returns Promise<boolean> True if hash meets work requirement
   */
  public async validateWork(
    data: string,
    difficulty: number,
  ): Promise<boolean> {
    // Add DDoS protection for PoW validation
    if (!this.ddosProtection?.checkRequest('pow_validation', data)) {
      Logger.warn(`DDoS protection blocked PoW validation from ${data}`);
      return false;
    }

    const perfMarker = this.performanceMonitor.start('validate_work');

    try {
      if (!data || typeof data !== 'string') {
        throw new Error('Invalid data input');
      }

      if (
        difficulty < BLOCKCHAIN_CONSTANTS.MINING.MIN_DIFFICULTY ||
        difficulty > BLOCKCHAIN_CONSTANTS.MINING.MAX_DIFFICULTY
      ) {
        throw new Error('Difficulty out of valid range');
      }

      // Calculate classical hash first
      const classicalHash = await this.calculateClassicalHash(data);

      // Create hybrid hash
      const finalHash = await HybridCrypto.hash(classicalHash);

      const target = this.calculateTarget(difficulty);
      const hashValue = BigInt(`0x${finalHash}`);
      const isValid = hashValue <= target;

      return isValid;
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('PoW validation failed:', error.message);
      } else {
        Logger.error('PoW validation failed:', error);
      }
      return false;
    } finally {
      this.performanceMonitor.end(perfMarker);
    }
  }

  /**
   * Calculates classical hash for a given data
   * @param data Data to hash
   * @returns Promise<string> Hashed data
   */
  private async calculateClassicalHash(data: string): Promise<string> {
    if (!data) {
      throw new Error('Invalid input data');
    }

    try {
      const hash = createHash('sha3-256')
        .update(Buffer.from(data))
        .digest('hex');

      if (!hash || hash.length !== 64) {
        throw new Error('Invalid hash generated');
      }

      return hash;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Hash calculation failed: ${error.message}`);
      } else {
        throw new Error('Hash calculation failed: Unknown error occurred');
      }
    }
  }

  /**
   * Gets maximum target value
   * @returns bigint Maximum target value
   */
  public getMaxTarget(): bigint {
    return BLOCKCHAIN_CONSTANTS.MINING.MAX_TARGET;
  }

  /**
   * Gets minimum difficulty
   * @returns number Minimum difficulty
   */
  public getMinDifficulty(): number {
    return BLOCKCHAIN_CONSTANTS.MINING.MIN_DIFFICULTY;
  }

  /**
   * Gets maximum difficulty
   * @returns number Maximum difficulty
   */
  public getMaxDifficulty(): number {
    return BLOCKCHAIN_CONSTANTS.MINING.MAX_DIFFICULTY;
  }

  /**
   * Gets network difficulty
   * @returns Promise<number> Network difficulty
   */
  async getNetworkDifficulty(): Promise<number> {
    try {
      // Get last N blocks
      const recentBlocks = await this.getRecentBlocks(
        BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY_ADJUSTMENT_INTERVAL,
      ); // ~2 weeks of blocks

      // Calculate average block time
      const averageBlockTime = this.calculateAverageBlockTime(recentBlocks);

      // Adjust difficulty based on target block time
      const currentDifficulty = recentBlocks[0].header.difficulty;
      const targetBlockTime = BLOCKCHAIN_CONSTANTS.MINING.TARGET_TIME_PER_BLOCK;

      return currentDifficulty * (targetBlockTime / averageBlockTime);
    } catch (error) {
      Logger.error('Failed to calculate network difficulty:', error);
      return this.getMinDifficulty();
    }
  }

  /**
   * Gets recent blocks
   * @param count Number of blocks to get
   * @returns Promise<Block[]> Recent blocks
   */
  private async getRecentBlocks(
    count: number,
    offset: number = 0,
  ): Promise<Block[]> {
    try {
      const currentHeight = await this.db.getCurrentHeight();
      const blocks: Block[] = [];

      for (
        let height = currentHeight - offset;
        height > currentHeight - count - offset && height > 0;
        height--
      ) {
        const block = await this.db.getBlockByHeight(height);
        if (block) blocks.push(block);
      }

      return blocks;
    } catch (error) {
      Logger.error('Failed to get recent blocks:', error);
      return [];
    }
  }

  /**
   * Calculates average block time
   * @param blocks Blocks to calculate from
   * @returns number Average block time in milliseconds
   */
  private calculateAverageBlockTime(blocks: Block[]): number {
    if (blocks.length < 2)
      return BLOCKCHAIN_CONSTANTS.MINING.TARGET_TIME_PER_BLOCK;

    const timeDeltas = blocks
      .slice(1)
      .map(
        (block, i) =>
          (block.header.timestamp as number) -
          (blocks[i].header.timestamp as number),
      );

    return (
      timeDeltas.reduce((sum, delta) => sum + delta, 0) / timeDeltas.length
    );
  }

  /**
   * Performs health check of PoW node
   * @returns Promise<boolean> True if node is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const health = await this.healthMonitor.getNetworkHealth();
      return (
        health.isHealthy &&
        health.powNodeCount >=
          (this.healthMonitor?.config?.thresholds?.minPowNodes || 0)
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('PoW health check failed:', error.message);
      } else {
        Logger.error('PoW health check failed:', error);
      }
      return false;
    }
  }

  /**
   * Checks mining health
   * @returns Promise<MiningHealth> Mining health
   */
  public async checkMiningHealth(): Promise<MiningHealth> {
    const now = Date.now();
    const health: MiningHealth = {
      isHealthy: true,
      hashRate: this.metrics?.averageHashRate || 0,
      workerCount: this.workers.length,
      cacheHitRate: this.blockCache.getHitRate(),
      lastBlockTime: now - (this.metrics?.lastBlockTime || 0),
    };

    // Check thresholds
    if (health.hashRate < BLOCKCHAIN_CONSTANTS.MINING.MIN_HASHRATE) {
      health.isHealthy = false;
    }
    if (health.workerCount < this.NUM_WORKERS / 2) {
      health.isHealthy = false;
    }
    if (health.lastBlockTime > BLOCKCHAIN_CONSTANTS.MINING.MAX_BLOCK_TIME) {
      health.isHealthy = false;
    }

    return health;
  }

  public async validateReward(
    transaction: Transaction,
    currentHeight: number,
  ): Promise<boolean> {
    try {
      // Validate block reward
      const expectedReward =
        this.blockchain.calculateBlockReward(currentHeight);
      const actualReward = transaction.outputs[0]?.amount || BigInt(0);

      if (actualReward > expectedReward) {
        Logger.warn('Invalid PoW reward amount', {
          expected: expectedReward.toString(),
          actual: actualReward.toString(),
          height: currentHeight,
        });
        return false;
      }

      // Validate miner's proof of work
      const isValidPoW = await this.validateWork(
        transaction.sender,
        await this.getNetworkDifficulty(),
      );

      return isValidPoW;
    } catch (error) {
      Logger.error('PoW reward validation failed:', error);
      return false;
    }
  }

  public async getParticipationRate(): Promise<number> {
    try {
      const activeMiners = await this.getActiveMiners();
      const totalValidators = await this.blockchain.getValidatorCount();
      return totalValidators > 0
        ? (activeMiners.length / totalValidators) * 100
        : 0;
    } catch (error) {
      Logger.error('Failed to get PoW participation rate:', error);
      return 0;
    }
  }

  private async getActiveMiners(limit: number = 1000): Promise<string[]> {
    try {
      const activeWindow = BLOCKCHAIN_CONSTANTS.MINING.ADJUSTMENT_INTERVAL;
      const miners = new Set<string>();

      // Use streaming approach for memory efficiency
      const BATCH_SIZE = 100;
      let processedBlocks = 0;

      while (processedBlocks < activeWindow && miners.size < limit) {
        const blocks = await this.getRecentBlocks(BATCH_SIZE, processedBlocks);

        if (blocks.length === 0) break;

        blocks.forEach((block) => {
          if (block.header.miner) {
            miners.add(block.header.miner);
          }
        });

        processedBlocks += blocks.length;

        // Free up memory
        blocks.length = 0;

        // Allow GC to run
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      return Array.from(miners);
    } catch (error) {
      Logger.error('Failed to get active miners:', error);
      return [];
    }
  }

  private async shouldUpdateStructure(block: Block): Promise<boolean> {
    try {
      // Check if new transactions are available
      if (await this.mempool?.hasChanged()) {
        return true;
      }

      // Check if block is too old (>10 seconds)
      const now = Math.floor(Date.now() / 1000);
      if (now - block.header.timestamp > 10) {
        return true;
      }

      return false;
    } catch (error) {
      Logger.error('Error checking block structure:', error);
      return false;
    }
  }

  private isValidHash(hash: string): boolean {
    try {
      // Early return for invalid input
      if (!hash || typeof hash !== 'string') {
        return false;
      }

      // Check length first (most efficient)
      if (hash.length !== 64) {
        return false;
      }

      // Use case-sensitive validation
      const HASH_REGEX = /^[0-9a-f]{64}$/;
      if (!HASH_REGEX.test(hash)) {
        return false;
      }

      // Additional entropy validation
      const zeroCount = (hash.match(/0/g) || []).length;
      if (zeroCount > 60) {
        // Suspicious number of zeros
        Logger.warn('Suspicious hash detected with too many zeros');
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Hash validation error:', error);
      return false;
    }
  }

  private isCoinbaseTransaction(tx: Transaction): boolean {
    return (
      tx &&
      tx.type === TransactionType.POW_REWARD &&
      !tx.inputs.length && // No inputs for coinbase
      tx.outputs.length === 1
    ); // Single output for block reward
  }

  private calculateBlockSize(block: Block): BlockSizeComponents {
    // Use Buffer for more accurate byte size calculation
    const headerSize = Buffer.from(JSON.stringify(block.header)).length;

    // Calculate transaction sizes
    let txSize = 0;
    const txSizes = new Map<string, number>();

    for (const tx of block.transactions) {
      // Cache transaction sizes
      if (!txSizes.has(tx.hash)) {
        const size = this.calculateTransactionSize(tx);
        txSizes.set(tx.hash, size);
      }
      txSize += txSizes.get(tx.hash) || 0;
    }

    // Calculate metadata size (signatures, etc.)
    const metadataSize = Buffer.from(
      JSON.stringify({
        validators: block.validators,
        signature: block.header.signature,
        timestamp: block.timestamp,
      }),
    ).length;

    return {
      header: headerSize,
      transactions: txSize,
      metadata: metadataSize,
      total: headerSize + txSize + metadataSize,
    };
  }

  private calculateTransactionSize(tx: Transaction): number {
    const inputSize = tx.inputs.reduce(
      (sum, input) => sum + Buffer.from(JSON.stringify(input)).length,
      0,
    );

    const outputSize = tx.outputs.reduce(
      (sum, output) => sum + Buffer.from(JSON.stringify(output)).length,
      0,
    );

    const metadataSize = Buffer.from(
      JSON.stringify({
        type: tx.type,
        timestamp: tx.timestamp,
        signature: tx.signature,
      }),
    ).length;

    return inputSize + outputSize + metadataSize;
  }

  public async getDynamicBlockSize(block: Block): Promise<number> {
    return BlockValidator.calculateDynamicBlockSize(block);
  }

  private async constructBlock(transactions: Transaction[]): Promise<Block> {
    const previousBlock = this.blockchain.getLatestBlock();
    const height = this.blockchain.getCurrentHeight() + 1;

    // Get dynamic block size limit
    const maxBlockSize = await this.blockchain.getDynamicBlockSize(
      previousBlock as Block,
    );

    // Filter transactions to fit within dynamic size limit
    let blockSize = 0;
    const selectedTxs: Transaction[] = [];

    for (const tx of transactions) {
      const txSize = JSON.stringify(tx).length;
      if (blockSize + txSize <= maxBlockSize) {
        selectedTxs.push(tx);
        blockSize += txSize;
      } else {
        break;
      }
    }

    // Construct block with selected transactions
    const builder = new BlockBuilder(
      previousBlock?.hash || '',
      await this.getNetworkDifficulty(),
      this.auditManager as AuditManager,
    );

    const block = await (
      await builder
        .setHeight(height)
        .setPreviousHash(previousBlock?.hash || '')
        .setTimestamp(Date.now())
        .setTransactions(selectedTxs)
    ).build(this.minerKeyPair as HybridKeyPair);

    // Prepare the block header base before returning
    await this.prepareHeaderBase(block);

    return block;
  }

  /**
   * Creates and mines a new block with transactions from mempool
   * @returns Promise<Block> The mined block
   */
  public async createAndMineBlock(): Promise<Block> {
    return this.withErrorBoundary('createAndMineBlock', async () => {
      // Get pending transactions from mempool
      const pendingTransactions = await this.mempool?.getPendingTransactions();

      // Create coinbase transaction for block reward
      const blockReward = this.blockchain.calculateBlockReward(
        this.blockchain.getCurrentHeight() + 1,
      );
      const coinbaseTransaction =
        await this.createCoinbaseTransaction(blockReward);

      // Add coinbase as first transaction
      const transactions = [
        coinbaseTransaction,
        ...(pendingTransactions || []),
      ];

      // Construct the block
      const block = await this.constructBlock(transactions);

      // Mine the block
      const minedBlock = await this.mineBlock(block);

      return minedBlock;
    });
  }

  /**
   * Verifies a coinbase transaction
   * @param tx Transaction to verify
   * @returns Promise<boolean> True if valid
   */
  private async verifyCoinbaseTransaction(tx: Transaction): Promise<boolean> {
    try {
      // Basic structure validation
      if (!this.isCoinbaseTransaction(tx)) {
        Logger.warn('Invalid coinbase transaction structure');
        return false;
      }

      // Validate output count
      if (tx.outputs.length !== 1) {
        Logger.warn('Coinbase transaction must have exactly one output');
        return false;
      }

      // Validate amounts
      const output = tx.outputs[0];
      if (!output || output.amount <= 0n) {
        Logger.warn('Invalid coinbase output amount');
        return false;
      }

      // Validate block reward
      const expectedReward = await this.blockchain.calculateBlockReward(
        this.blockchain.getCurrentHeight() + 1,
      );
      if (output.amount > expectedReward) {
        Logger.warn('Coinbase reward exceeds allowed amount', {
          actual: output.amount.toString(),
          expected: expectedReward.toString(),
        });
        return false;
      }

      // Validate script
      if (!output.script || output.script.length < 8) {
        Logger.warn('Invalid coinbase script');
        return false;
      }

      // Validate currency
      if (
        !output.currency ||
        output.currency.symbol !== BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL
      ) {
        Logger.warn('Invalid currency in coinbase transaction');
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Coinbase transaction validation error:', error);
      return false;
    }
  }

  /**
   * Creates a coinbase transaction for block reward
   * @param reward Block reward amount
   * @returns Promise<Transaction> Coinbase transaction
   */
  private async createCoinbaseTransaction(
    reward: bigint,
  ): Promise<Transaction> {
    const tx: Transaction = {
      type: TransactionType.POW_REWARD,
      transaction: {
        hash: '',
        timestamp: Date.now(),
        fee: 0n,
        lockTime: 0,
        signature: '',
      },
      sender: 'coinbase',
      inputs: [],
      outputs: [
        {
          address: this.minerKeyPair?.address || '',
          amount: reward,
          script: await this.generateCoinbaseScript(), // Generate coinbase script
          currency: {
            name: BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
            symbol: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
            decimals: BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
          },
          index: 0,
          confirmations: 0,
        },
      ],
      timestamp: Date.now(),
      fee: 0n,
      version: 1,
      status: TransactionStatus.PENDING,
      currency: {
        name: BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
        symbol: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        decimals: BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
      },
      id: '',
      hash: '',
      signature: '',
      recipient: this.minerKeyPair?.address || '',
      verify: async () => {
        return await this.verifyCoinbaseTransaction(tx);
      },
      toHex: () => JSON.stringify(tx),
      getSize: () => tx.getSize(),
    };

    // Generate hash and ID
    tx.hash = await HybridCrypto.hash(JSON.stringify(tx));
    tx.id = tx.hash;

    // Sign the transaction
    tx.signature = await HybridCrypto.sign(
      tx.hash,
      this.minerKeyPair as HybridKeyPair,
    );

    return tx;
  }

  /**
   * Generates a coinbase script
   * Format: <block_height> <arbitrary_data> <extra_nonce>
   */
  private async generateCoinbaseScript(): Promise<string> {
    const blockHeight = this.blockchain.getCurrentHeight() + 1;
    const minerTag = 'H3TAG-POW-MINER'; // to identify our miner
    const extraNonce = Math.floor(Math.random() * 100000); // Random extra nonce

    // Combine components in hex format
    const script = [
      blockHeight.toString(16).padStart(8, '0'), // Height in hex
      Buffer.from(minerTag).toString('hex'), // Convert ASCII to hex
      extraNonce.toString(16).padStart(8, '0'), // Extra nonce in hex
    ].join('');

    return script;
  }

  /**
   * Starts the mining loop
   */
  public async startMining(): Promise<void> {
    this.isMining = true; // Set isMining to true
    while (!this.isInterrupted) {
      try {
        const block = await this.createAndMineBlock();

        // Validate the mined block
        if (await this.validateBlock(block)) {
          // Add block to blockchain with retry
          await this.retryStrategy.execute(async () => {
            await this.blockchain.addBlock(block);

            // Remove mined transactions from mempool
            this.mempool?.removeTransactions(block.transactions);

            Logger.info(
              `Successfully mined block at height ${block.header.height}`,
            );
            this.metrics?.recordSuccessfulMine();
          });
        } else {
          Logger.warn('Mined block failed validation');
          this.metrics?.recordFailedMine('validation');
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          Logger.error('Mining loop error:', error.message);
          this.metrics?.recordFailedMine(error.message);
        } else {
          Logger.error('Mining loop error:', error);
          this.metrics?.recordFailedMine('Unknown error');
        }

        // Circuit breaker pattern
        this.miningFailures++;
        if (this.miningFailures >= this.MAX_FAILURES) {
          this.stopMining();
          Logger.error('Mining stopped due to repeated failures');
          break;
        }

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.min(5000 * Math.pow(2, this.miningFailures), 30000),
          ),
        );
      }
    }
  }

  /**
   * Stops the mining loop
   */
  public stopMining(): void {
    this.isMining = false; // Set isMining to false
    this.isInterrupted = true;
  }

  /**
   * Gets comprehensive mining status information
   * @returns Promise<MiningInfo> Current mining status
   */
  public async getMiningInfo(): Promise<MiningInfo> {
    try {
      // Get mempool stats
      const pendingTxs = await this.mempool?.getPendingTransactions();
      const mempoolSize = this.mempool?.getSize();

      // Get network stats
      const activeMiners = await this.getActiveMiners();
      const participationRate = await this.getParticipationRate();
      const networkDifficulty = await this.getNetworkDifficulty();

      // Calculate network hashrate based on difficulty and target block time
      const networkHashRate =
        (networkDifficulty * 2 ** 32) /
        BLOCKCHAIN_CONSTANTS.MINING.TARGET_TIME_PER_BLOCK;

      // Get worker stats
      const activeWorkers = this.workers.filter(
        (w) => w.threadId !== null,
      ).length;

      // Get performance metrics
      const recentBlocks = await this.getRecentBlocks(100);
      const averageBlockTime = this.calculateAverageBlockTime(recentBlocks);

      const miningInfo: MiningInfo = {
        powEnabled: BLOCKCHAIN_CONSTANTS.MINING.AUTO_MINE,
        mining: !this.isInterrupted,
        hashRate: this.metrics?.averageHashRate || 0,
        difficulty: networkDifficulty,
        networkHashRate,
        blockHeight: this.blockchain.getCurrentHeight(),
        lastBlockTime: this.metrics?.lastBlockTime || 0,

        workers: {
          total: this.NUM_WORKERS,
          active: activeWorkers,
          idle: this.NUM_WORKERS - activeWorkers,
        },

        hardware: {
          gpuEnabled: !!this.gpuMiner && !this.gpuCircuitBreaker.isOpen(),
          gpuStatus: this.getGPUStatus(),
          cpuThreads: this.NUM_WORKERS,
        },

        mempool: {
          pending: pendingTxs?.length || 0,
          size: mempoolSize || 0,
        },

        performance: {
          averageBlockTime,
          successRate:
            (this.metrics?.successfulBlocks ||
              0 / Math.max(this.metrics?.totalBlocks || 1, 1)) * 100,
          cacheHitRate: this.blockCache.getHitRate(),
        },

        network: {
          activeMiners: activeMiners.length,
          participationRate,
          targetBlockTime: BLOCKCHAIN_CONSTANTS.MINING.TARGET_TIME_PER_BLOCK,
        },
      };

      return miningInfo;
    } catch (error) {
      Logger.error('Failed to get mining info:', error);
      throw error;
    }
  }

  /**
   * Gets current GPU mining status
   * @returns string Status of GPU mining
   */
  private getGPUStatus(): string {
    if (!this.gpuMiner) {
      return 'Not Available';
    }
    if (this.gpuCircuitBreaker.isOpen()) {
      return 'Circuit Breaker Open';
    }
    return 'Active';
  }

  /**
   * Calculates network hash rate in hashes per second
   * @param blocks Number of blocks to look back (default 120)
   * @param height Block height to start from (default -1 for latest)
   * @returns Promise<number> Network hash rate in H/s
   */
  public async getNetworkHashPS(
    blocks: number = 120,
    height: number = -1,
  ): Promise<number> {
    try {
      // Get current height if -1
      if (height === -1) {
        height = this.blockchain.getCurrentHeight();
      }

      // Ensure valid parameters
      if (height < 0 || blocks < 1) {
        throw new Error('Invalid parameters');
      }

      // Get recent blocks
      const recentBlocks = await this.getRecentBlocks(blocks);
      if (recentBlocks.length < 2) {
        // If insufficient blocks, estimate from difficulty
        const difficulty = await this.getNetworkDifficulty();
        return (
          (difficulty * 2 ** 32) /
          BLOCKCHAIN_CONSTANTS.MINING.TARGET_TIME_PER_BLOCK
        );
      }

      // Calculate time span
      const firstBlock = recentBlocks[recentBlocks.length - 1];
      const lastBlock = recentBlocks[0];
      const timeSpan = lastBlock.header.timestamp - firstBlock.header.timestamp;

      // Avoid division by zero and ensure minimum timespan
      if (timeSpan <= 0) {
        return 0;
      }

      // Calculate work done in this period
      let totalWork = BigInt(0);
      for (const block of recentBlocks) {
        totalWork += this.getBlockWork(block.header.difficulty);
      }

      // Convert to hashes per second
      // Work is in hashes, timeSpan in seconds
      const hashPS = Number(totalWork) / timeSpan;

      return Math.max(0, hashPS);
    } catch (error) {
      Logger.error('Failed to calculate network hash rate:', error);
      return 0;
    }
  }

  /**
   * Calculates the amount of work for a given difficulty
   * @param difficulty Block difficulty
   * @returns bigint Amount of work (hashes) required
   */
  private getBlockWork(difficulty: number): bigint {
    try {
      // Work is proportional to difficulty * 2^32
      return BigInt(Math.floor(difficulty)) * BigInt(2) ** BigInt(32);
    } catch (error) {
      Logger.error('Failed to calculate block work:', error);
      return BigInt(0);
    }
  }

  /**
   * Generates a block template for mining
   * @param minerAddress Address to receive mining reward
   * @returns Promise<BlockTemplate> Block template ready for mining
   */
  public async getBlockTemplate(minerAddress: string): Promise<BlockTemplate> {
    return this.withErrorBoundary('getBlockTemplate', async () => {
      // Validate miner address
      if (!minerAddress || typeof minerAddress !== 'string') {
        throw new Error('Invalid miner address');
      }

      // Get current blockchain state
      const currentHeight = this.blockchain.getCurrentHeight();
      const previousBlock = await this.blockchain.getLatestBlock();
      const networkDifficulty = await this.getNetworkDifficulty();

      // Calculate block reward
      const blockReward = this.blockchain.calculateBlockReward(
        currentHeight + 1,
      );

      // Create coinbase transaction
      const coinbaseTransaction =
        await this.createCoinbaseTransaction(blockReward);
      coinbaseTransaction.outputs[0].address = minerAddress; // Set miner as recipient

      // Get pending transactions from mempool
      const pendingTransactions = await this.mempool?.getPendingTransactions();

      // Calculate dynamic block size limit
      const maxBlockSize = await this.getDynamicBlockSize(
        previousBlock as Block,
      );

      // Select and validate transactions
      const selectedTransactions = await this.selectTransactions(
        pendingTransactions || [],
        maxBlockSize,
        coinbaseTransaction,
      );

      // Calculate merkle root
      const merkleRoot = await this.merkleTree.createRoot(
        selectedTransactions.map((tx) => tx.hash),
      );

      // Calculate target from difficulty
      const target = this.calculateTarget(networkDifficulty).toString(16);

      // Get network time boundaries
      const currentTime = Math.floor(Date.now() / 1000);
      const minTime = (previousBlock as Block).header.timestamp;
      const maxTime = currentTime + 7200; // 2 hours in the future

      const template: BlockTemplate = {
        version: BLOCKCHAIN_CONSTANTS.MINING.CURRENT_VERSION,
        height: currentHeight + 1,
        previousHash: (previousBlock as Block).hash,
        timestamp: currentTime,
        difficulty: networkDifficulty,
        transactions: selectedTransactions,
        merkleRoot,
        target,
        minTime,
        maxTime,
        maxVersion: BLOCKCHAIN_CONSTANTS.MINING.MAX_VERSION,
        minVersion: BLOCKCHAIN_CONSTANTS.MINING.MIN_VERSION,
        defaultVersion: BLOCKCHAIN_CONSTANTS.MINING.CURRENT_VERSION,
      };

      // Cache template for validation
      const templateHash = await HybridCrypto.hash(JSON.stringify(template));
      this.templateCache.set(templateHash, template);

      return template;
    });
  }

  /**
   * Selects and validates transactions for block template
   * @param transactions Available transactions
   * @param maxBlockSize Maximum block size
   * @param coinbase Coinbase transaction
   * @returns Promise<Transaction[]> Selected valid transactions
   */
  private async selectTransactions(
    transactions: Transaction[],
    maxBlockSize: number,
    coinbase: Transaction,
  ): Promise<Transaction[]> {
    return this.txSelectionLock.runExclusive(async () => {
      const selected: Transaction[] = [coinbase];
      let currentSize = JSON.stringify(coinbase).length;

      // Create immutable copy of transactions
      const txSnapshot = [...transactions].map((tx) => ({ ...tx }));

      // Sort by fee per byte
      const sortedTxs = txSnapshot.sort((a, b) => {
        const aSize = JSON.stringify(a).length;
        const bSize = JSON.stringify(b).length;
        return Number(b.fee / BigInt(bSize) - a.fee / BigInt(aSize));
      });

      // Track processed transactions to prevent duplicates
      const processedTxs = new Set<string>();

      for (const tx of sortedTxs) {
        // Skip if already processed
        if (processedTxs.has(tx.hash)) continue;

        const txSize = JSON.stringify(tx).length;

        // Check size limit
        if (currentSize + txSize > maxBlockSize) {
          continue;
        }

        // Validate transaction
        try {
          if (await this.validateTemplateTransaction(tx)) {
            // Double-check transaction hasn't been included elsewhere
            if (!(await this.blockchain.hasTransaction(tx.hash))) {
              selected.push(tx);
              currentSize += txSize;
              processedTxs.add(tx.hash);
            }
          }
        } catch (error) {
          Logger.warn(
            `Invalid transaction ${tx.hash} for block template:`,
            error,
          );
          continue;
        }
      }

      return selected;
    });
  }

  /**
   * Validates a transaction for inclusion in block template
   * @param tx Transaction to validate
   * @returns Promise<boolean> True if transaction is valid
   */
  private async validateTemplateTransaction(tx: Transaction): Promise<boolean> {
    try {
      // Add size validation
      if (JSON.stringify(tx).length > BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIZE)
        return false;

      // Add timestamp validation
      if (
        Math.abs(tx.timestamp - Date.now()) >
        BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_TIME_DRIFT
      )
        return false;

      // Check if transaction is already in blockchain
      const exists = await this.blockchain.hasTransaction(tx.hash);
      if (exists) return false;

      // Verify transaction signature
      if (!(await tx.verify())) return false;

      // Check if inputs are still available (not double spent)
      for (const input of tx.inputs) {
        if (await this.blockchain.isUTXOSpent(input)) {
          return false;
        }
      }

      // Validate transaction against current state
      return await this.blockchain.validateTransaction(tx);
    } catch (error) {
      Logger.error(`Transaction validation failed for ${tx.hash}:`, error);
      return false;
    }
  }

  /**
   * Submit a mined block to the network
   * @param block The mined block to submit
   * @returns Promise<boolean> True if block was accepted
   * @throws Error if block validation fails
   */
  public async submitBlock(block: Block): Promise<boolean> {
    return this.withErrorBoundary('submitBlock', async () => {
      try {
        // Basic block structure validation
        if (!block || !block.header || !block.transactions) {
          throw new Error('Invalid block structure');
        }

        // Verify block hash meets difficulty target
        const blockHash = this.calculateBlockHash(block);
        if (!this.meetsTarget(blockHash, block.header.target)) {
          throw new Error('Block hash does not meet target difficulty');
        }

        // Verify block header
        if (!(await this.validateBlockHeader(block))) {
          throw new Error('Invalid block header');
        }

        // Verify coinbase transaction
        const coinbase = block.transactions[0];
        if (!(await this.verifyCoinbaseTransaction(coinbase))) {
          throw new Error('Invalid coinbase transaction');
        }

        // Verify all other transactions
        for (let i = 1; i < block.transactions.length; i++) {
          if (
            !(await this.validateTemplateTransaction(block.transactions[i]))
          ) {
            throw new Error(`Invalid transaction at index ${i}`);
          }
        }

        // Verify merkle root
        const calculatedRoot = await this.merkleTree.createRoot(
          block.transactions.map((tx) => tx.hash),
        );
        if (calculatedRoot !== block.header.merkleRoot) {
          throw new Error('Invalid merkle root');
        }

        // Try to add block to blockchain
        const added = await this.blockchain.addBlock(block);
        if (!added) {
          throw new Error('Failed to add block to blockchain');
        }

        // Remove block transactions from mempool
        this.mempool?.removeTransactions(block.transactions);

        // Update mining metrics
        this.metrics?.updateMetrics({
          blockTime: block.header.timestamp - this.lastBlockTime,
        });
        this.lastBlockTime = block.header.timestamp;

        // Emit block added event
        this.eventEmitter.emit('blockAdded', block);

        Logger.info(
          `Block ${block.hash} successfully added at height ${block.header.height}`,
        );
        return true;
      } catch (error) {
        Logger.error('Block submission failed:', error);
        throw error;
      }
    });
  }

  /**
   * Validates block header fields
   * @param block Block to validate header
   * @returns Promise<boolean> True if header is valid
   */
  private async validateBlockHeader(block: Block): Promise<boolean> {
    try {
      // Check version is within allowed range
      if (
        block.header.version < BLOCKCHAIN_CONSTANTS.MINING.MIN_VERSION ||
        block.header.version > BLOCKCHAIN_CONSTANTS.MINING.MAX_VERSION
      ) {
        return false;
      }

      // Verify previous block exists and hash matches (await the async call)
      const prevBlock = await this.blockchain.getBlockByHeight(block.header.height - 1);
      if (!prevBlock || prevBlock.hash !== block.header.previousHash) {
        return false;
      }

      // Check timestamp is within allowed range
      const now = Math.floor(Date.now() / 1000);
      if (block.header.timestamp < this.minTime || block.header.timestamp > now + 7200) {
        return false;
      }

      // Verify difficulty matches expected difficulty
      const expectedDifficulty = await this.getNetworkDifficulty();
      if (block.header.difficulty !== expectedDifficulty) {
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Block header validation failed:', error);
      return false;
    }
  }

  /**
   * Checks if a hash meets the target difficulty
   * @param hash Hash to check
   * @param target Target difficulty in hex
   * @returns boolean True if hash meets target
   */
  private meetsTarget(hash: string, target: string): boolean {
    // Convert hex strings to BigInt for comparison
    const hashNum = BigInt(`0x${hash}`);
    const targetNum = BigInt(`0x${target}`);
    return hashNum <= targetNum;
  }

  private addInflightBlock(block: Block): void {
    const height = block.header.height;

    // Check if we're at capacity
    if (this.blocksInFlight.size >= this.MAX_BLOCKS_IN_FLIGHT) {
      throw new Error('Too many blocks in flight');
    }

    // Check if block is already in flight
    if (this.blocksInFlight.has(height)) {
      Logger.warn(`Block ${height} already in flight`);
      return;
    }

    // Create timeout handler
    const timeout = setTimeout(() => {
      this.handleBlockTimeout(height);
    }, this.BLOCK_TIMEOUT);

    // Track the block
    this.blocksInFlight.set(height, {
      height,
      hash: block.hash,
      startTime: Date.now(),
      timeout,
      attempts: 1,
    });

    // Update metrics
    this.metrics?.gauge('blocks_in_flight', this.blocksInFlight.size);
    Logger.debug(`Added block ${height} to in-flight tracking`);
  }

  private removeInflightBlock(height: number): void {
    const block = this.blocksInFlight.get(height);
    if (block) {
      clearTimeout(block.timeout);
      this.blocksInFlight.delete(height);
      this.metrics?.gauge('blocks_in_flight', this.blocksInFlight.size);
      Logger.debug(`Removed block ${height} from in-flight tracking`);
    }
  }

  private handleBlockTimeout(height: number): void {
    const block = this.blocksInFlight.get(height);
    if (!block) return;

    Logger.warn(
      `Block ${height} timed out after ${Date.now() - block.startTime}ms`,
    );

    if (block.attempts >= this.MAX_RETRY_ATTEMPTS) {
      Logger.error(`Block ${height} failed after ${block.attempts} attempts`);
      this.removeInflightBlock(height);
      this.eventEmitter.emit('blockFailed', {
        height,
        attempts: block.attempts,
      });
      return;
    }

    // Retry with backoff
    block.attempts++;
    block.startTime = Date.now();
    block.timeout = setTimeout(() => {
      this.handleBlockTimeout(height);
    }, this.BLOCK_TIMEOUT * block.attempts);

    this.eventEmitter.emit('blockRetry', {
      height,
      attempts: block.attempts,
      timeoutMs: this.BLOCK_TIMEOUT * block.attempts,
    });
  }

  public getInflightBlocks(): BlockInFlight[] {
    return Array.from(this.blocksInFlight.values());
  }

  private async persistBlock(block: Block): Promise<void> {
    if (!block.isComplete()) return;
    await this.db.saveBlock(block);
  }

  /**
   * Updates difficulty after new block
   */
  public async updateDifficulty(block: Block): Promise<void> {
    const currentDifficulty = await this.calculateNextDifficulty(block);
    await this.db.updateDifficulty(block.hash, currentDifficulty);
  }

  // Add cache prefetching
  private async prefetchCache(currentHeight: number): Promise<void> {
    try {
      const heights = Array.from(
        { length: this.CACHE_PREFETCH_SIZE },
        (_, i) => currentHeight + i + 1,
      );
      await Promise.all(
        heights.map((height) => this.blockCache.prefetch(`block:${height}`)),
      );
    } catch (error) {
      Logger.warn('Cache prefetch failed:', error);
    }
  }

    /**
   * Attempts parallel mining
   * @param block Block to mine
   * @returns Promise<Block | null> Mined block or null if failed
   */

  private async tryParallelMining(
    block: Block,
  ): Promise<Block | null> {
    const workers = await Promise.all(
      Array(Math.ceil(this.NUM_WORKERS * this.WORKER_POOL_OVERSUBSCRIBE))
        .fill(0)
        .map(async () => {
          const worker = await this.workerPool.getWorker();
          return {
            worker,
            release: () => this.workerPool.releaseWorker(worker),
          };
        }),
    );

    try {
      const results = await Promise.race<MiningResult>(
        workers.map(
          ({ worker }) =>
            new Promise<MiningResult>((resolve) => {
              worker.once('message', resolve);
              worker.postMessage({
                start: block.header.nonce,
                end: Math.min(
                  block.header.nonce + this.HASH_BATCH_SIZE,
                  this.MAX_NONCE,
                ),
                target: this.target.toString(),
                headerBase: block.getHeaderBase(),
                batchSize: this.HASH_BATCH_SIZE,
              });
            }),
        ),
      );

      if (results?.found) {
        block.header.nonce = results.nonce!;
        block.hash = results.hash!;
        return block;
      }
      return null;
    } finally {
      workers.forEach(({ release }) => release());
    }
  }


  /**
   * Attempts parallel CPU mining
   * @param block Block to mine
   * @returns Promise<Block | null> Mined block or null if failed
   * 
   */
  private async tryCPUMining(block: Block): Promise<Block | null> {
    const worker = await this.workerPool.getWorker();
    try {
      const result = await new Promise<MiningResult>((resolve, reject) => {
        worker.once('message', resolve);
        worker.once('error', reject);
        worker.postMessage({
          start: block.header.nonce,
          end: Math.min(
            block.header.nonce + this.HASH_BATCH_SIZE,
            this.MAX_NONCE,
          ),
          target: this.target.toString(),
          headerBase: block.getHeaderBase(),
          batchSize: this.HASH_BATCH_SIZE,
        });
      });

      if (result.found) {
        block.header.nonce = result.nonce!;
        block.hash = result.hash!;
        return block;
      }
      return null;
    } finally {
      this.workerPool.releaseWorker(worker);
    }
  }
}
