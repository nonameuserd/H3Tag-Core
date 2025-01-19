import { Level } from 'level';
import { Logger } from '@h3tag-blockchain/shared';
import { Cache } from '../scaling/cache';
import { Mutex } from 'async-mutex';
import { retry } from '../utils/retry';
import { PowSolution } from '../blockchain/blockchain';
import { MiningMetrics } from '../monitoring/metrics';
import { databaseConfig } from './config.database';

/**
 * @fileoverview MiningDatabase manages storage and retrieval of mining-related data including
 * PoW solutions, mining metrics, consensus votes, and mining periods. It implements caching
 * and atomic batch operations for efficient data access.
 *
 * @module MiningDatabase
 */

/**
 * MiningDatabase handles persistence of mining operations and consensus data.
 *
 * @class MiningDatabase
 *
 * @property {Level} db - LevelDB database instance
 * @property {Cache} cache - Multi-purpose data cache
 * @property {Mutex} mutex - Mutex for synchronizing operations
 * @property {number} BATCH_SIZE - Maximum batch operation size
 * @property {number} CACHE_TTL - Cache time-to-live in seconds
 * @property {number} MAX_RETRY_ATTEMPTS - Maximum operation retry attempts
 * @property {boolean} initialized - Database initialization status
 *
 * @example
 * const miningDb = new MiningDatabase('./data/mining');
 * await miningDb.storePowSolution(solution);
 * const metrics = await miningDb.getMiningMetrics(height);
 */

/**
 * @typedef {Object} ConsensusVote
 * @property {string} blockHash - Hash of block being voted on
 * @property {string} voterAddress - Address of voter
 * @property {string} voteType - Type of vote
 * @property {bigint} timestamp - Vote timestamp
 * @property {string} signature - Vote signature
 * @property {string} quantumProof - Quantum resistance proof
 * @property {bigint} [weight] - Vote weight
 */

/**
 * @typedef {Object} ConsensusPeriod
 * @property {number} startHeight - Period start height
 * @property {number} endHeight - Period end height
 * @property {bigint} startTime - Period start timestamp
 * @property {bigint} endTime - Period end timestamp
 * @property {number} [participationRate] - Participation rate
 * @property {boolean} [finalDecision] - Final consensus decision
 * @property {number} [totalVotes] - Total votes cast
 * @property {boolean} [quorumReached] - Whether quorum was reached
 */

/**
 * Stores a PoW solution
 *
 * @async
 * @method storePowSolution
 * @param {PowSolution} solution - PoW solution to store
 * @returns {Promise<void>}
 * @throws {Error} If solution is invalid or already exists
 *
 * @example
 * await miningDb.storePowSolution({
 *   blockHash: '0x...',
 *   nonce: 12345n,
 *   minerAddress: '0x...',
 *   timestamp: Date.now(),
 *   signature: '0x...'
 * });
 */

/**
 * Stores mining metrics
 *
 * @async
 * @method storeMiningMetrics
 * @param {MiningMetrics} metrics - Mining metrics to store
 * @returns {Promise<void>}
 * @throws {Error} If metrics are invalid
 *
 * @example
 * await miningDb.storeMiningMetrics({
 *   blockHeight: 1000,
 *   hashRate: 15000n,
 *   difficulty: 100,
 *   timestamp: Date.now()
 * });
 */

/**
 * Stores a consensus vote
 *
 * @async
 * @method storeConsensusVote
 * @param {ConsensusVote} vote - Vote to store
 * @returns {Promise<void>}
 * @throws {Error} If vote is invalid
 *
 * @example
 * await miningDb.storeConsensusVote(vote);
 */

/**
 * Stores a consensus period
 *
 * @async
 * @method storeConsensusPeriod
 * @param {ConsensusPeriod} period - Period to store
 * @returns {Promise<void>}
 * @throws {Error} If period is invalid
 *
 * @example
 * await miningDb.storeConsensusPeriod(period);
 */

/**
 * Retrieves a PoW solution
 *
 * @async
 * @method getPowSolution
 * @param {string} blockHash - Block hash
 * @param {bigint} nonce - Solution nonce
 * @returns {Promise<PowSolution | null>} Solution if found
 *
 * @example
 * const solution = await miningDb.getPowSolution(blockHash, nonce);
 */

/**
 * Retrieves mining metrics
 *
 * @async
 * @method getMiningMetrics
 * @param {number} blockHeight - Block height
 * @returns {Promise<MiningMetrics | null>} Metrics if found
 *
 * @example
 * const metrics = await miningDb.getMiningMetrics(blockHeight);
 */

/**
 * Retrieves miner solutions
 *
 * @async
 * @method getMinerSolutions
 * @param {string} minerAddress - Miner's address
 * @param {number} [limit=100] - Maximum solutions to return
 * @returns {Promise<PowSolution[]>} Array of solutions
 *
 * @example
 * const solutions = await miningDb.getMinerSolutions(minerAddress);
 */

/**
 * Retrieves metrics in time range
 *
 * @async
 * @method getMetricsInRange
 * @param {bigint} startTime - Range start timestamp
 * @param {bigint} endTime - Range end timestamp
 * @returns {Promise<MiningMetrics[]>} Array of metrics
 *
 * @example
 * const metrics = await miningDb.getMetricsInRange(start, end);
 */

/**
 * Disposes database resources
 *
 * @async
 * @method dispose
 * @returns {Promise<void>}
 *
 * @example
 * await miningDb.dispose();
 */

interface ConsensusVote {
  blockHash: string;
  voterAddress: string;
  voteType: string;
  timestamp: bigint;
  signature: string;
  quantumProof: string;
  weight?: bigint;
}

interface ConsensusPeriod {
  startHeight: number;
  endHeight: number;
  startTime: bigint;
  endTime: bigint;
  participationRate?: number;
  finalDecision?: boolean;
  totalVotes?: number;
  quorumReached?: boolean;
}

export class MiningDatabase {
  private db: Level;
  private cache: Cache<
    PowSolution | MiningMetrics | ConsensusVote | ConsensusPeriod
  >;
  private mutex: Mutex;
  private readonly BATCH_SIZE = 1000;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private initialized: boolean = false;

  constructor(dbPath: string) {
    if (!dbPath) throw new Error('Database path is required');

    this.db = new Level(`${dbPath}/mining`, {
      valueEncoding: 'json',
      ...databaseConfig.options,
    });

    this.mutex = new Mutex();

    this.cache = new Cache<
      PowSolution | MiningMetrics | ConsensusVote | ConsensusPeriod
    >({
      ttl: this.CACHE_TTL,
      maxSize: 10000,
      compression: true,
      priorityLevels: { pow: 2, default: 1 },
    });

    this.initialize().catch((error) => {
      Logger.error('Failed to initialize mining database:', error);
      throw error;
    });
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return; // Prevent re-initialization
    try {
      await this.db.open();
      this.initialized = true;
      Logger.info('Mining database initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize mining database:', error);
      throw error;
    }
  }

  @retry({ maxAttempts: 3, delay: 1000 })
  async storePowSolution(solution: PowSolution): Promise<void> {
    if (!this.initialized) throw new Error('Database not initialized');

    return await this.mutex.runExclusive(async () => {
      const key = `pow:${solution.blockHash}:${solution.nonce}`;
      try {
        // Validate solution
        if (!this.validatePowSolution(solution)) {
          throw new Error('Invalid PoW solution');
        }

        // Check for existing solution
        const existing = await this.getPowSolution(
          solution.blockHash,
          BigInt(solution.nonce),
        );
        if (existing) {
          throw new Error('PoW solution already exists');
        }

        // Store in batch for atomicity
        const batch = this.db.batch();

        // Store main record
        batch.put(key, JSON.stringify(solution));

        // Index by miner address with timestamp for ordering
        const minerKey = `miner:${solution.minerAddress}:${solution.timestamp}`;
        batch.put(minerKey, key);

        await batch.write();
        this.cache.set(key, solution, { ttl: this.CACHE_TTL });

        Logger.debug('PoW solution stored successfully', {
          blockHash: solution.blockHash,
          miner: solution.minerAddress,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        Logger.error('Failed to store PoW solution:', { error: errorMessage });
        throw new Error(`Failed to store PoW solution: ${errorMessage}`);
      }
    });
  }

  @retry({ maxAttempts: 3, delay: 1000 })
  async storeMiningMetrics(metrics: MiningMetrics): Promise<void> {
    const key = `metrics:${metrics.blockHeight}`;
    try {
      // Validate metrics
      if (!this.validateMiningMetrics(metrics)) {
        throw new Error('Invalid mining metrics');
      }

      await this.db.put(key, JSON.stringify(metrics));
      this.cache.set(key, metrics);

      // Store time-series data for analytics
      const timeKey = `metrics:time:${metrics.timestamp}`;
      await this.db.put(timeKey, JSON.stringify(metrics.blockHeight));

      Logger.debug('Mining metrics stored successfully', {
        blockHeight: metrics.blockHeight,
        hashRate: metrics.hashRate.toString(),
      });
    } catch (error) {
      Logger.error('Failed to store mining metrics:', error);
      throw error;
    }
  }

  @retry({ maxAttempts: 3, delay: 1000 })
  async storeConsensusVote(vote: ConsensusVote): Promise<void> {
    return await this.mutex.runExclusive(async () => {
      const key = `vote:${vote.blockHash}:${vote.voterAddress}`;
      try {
        // Validate vote
        if (!this.validateConsensusVote(vote)) {
          throw new Error('Invalid consensus vote');
        }

        const batch = this.db.batch();

        // Store main record
        batch.put(key, JSON.stringify(vote));

        // Index by timestamp for time-based queries
        batch.put(`vote:time:${vote.timestamp}`, key);

        await batch.write();
        this.cache.set(key, vote);

        Logger.debug('Consensus vote stored successfully', {
          blockHash: vote.blockHash,
          voter: vote.voterAddress,
        });
      } catch (error) {
        Logger.error('Failed to store consensus vote:', error);
        throw error;
      }
    });
  }

  @retry({ maxAttempts: 3, delay: 1000 })
  async storeConsensusPeriod(period: ConsensusPeriod): Promise<void> {
    const key = `period:${period.startHeight}`;
    try {
      // Validate period
      if (!this.validateConsensusPeriod(period)) {
        throw new Error('Invalid consensus period');
      }

      await this.db.put(key, JSON.stringify(period));
      this.cache.set(key, period);

      Logger.debug('Consensus period stored successfully', {
        startHeight: period.startHeight,
        endHeight: period.endHeight,
      });
    } catch (error) {
      Logger.error('Failed to store consensus period:', error);
      throw error;
    }
  }

  // Retrieval methods
  async getPowSolution(
    blockHash: string,
    nonce: bigint,
  ): Promise<PowSolution | null> {
    if (!this.initialized) throw new Error('Database not initialized');

    const key = `pow:${blockHash}:${nonce}`;
    try {
      // Try cache first
      const cached = this.cache.get(key) as PowSolution;
      if (cached) {
        // Refresh TTL on cache hit
        this.cache.set(key, cached, { ttl: this.CACHE_TTL });
        return cached;
      }

      const solution = await this.db.get(key);
      const parsed = this.safeParse<PowSolution>(solution);
      if (!parsed) return null;

      // Cache with TTL
      this.cache.set(key, parsed, { ttl: this.CACHE_TTL });
      return parsed;
    } catch (error) {
      if (error.notFound) return null;
      Logger.error('Failed to retrieve PoW solution:', error);
      throw new Error('Failed to retrieve PoW solution');
    }
  }

  async getMiningMetrics(blockHeight: number): Promise<MiningMetrics | null> {
    const key = `metrics:${blockHeight}`;
    try {
      const cached = this.cache.get(key) as MiningMetrics;
      if (cached) return cached;

      const metrics = await this.db.get(key);
      this.cache.set(key, JSON.parse(metrics));
      return JSON.parse(metrics);
    } catch (error) {
      if (error.notFound) return null;
      Logger.error('Failed to retrieve mining metrics:', error);
      throw error;
    }
  }

  async getConsensusVote(
    blockHash: string,
    voterAddress: string,
  ): Promise<ConsensusVote | null> {
    const key = `consensus_vote:${blockHash}:${voterAddress}`;
    try {
      const cached = this.cache.get(key) as ConsensusVote;
      if (cached) return cached;

      const vote = await this.db.get(key);
      this.cache.set(key, JSON.parse(vote));
      return JSON.parse(vote);
    } catch (error) {
      if (error.notFound) return null;
      Logger.error('Failed to retrieve consensus vote:', error);
      throw error;
    }
  }

  async getConsensusPeriod(
    startHeight: number,
  ): Promise<ConsensusPeriod | null> {
    const key = `period:${startHeight}`;
    try {
      const cached = this.cache.get(key) as ConsensusPeriod;
      if (cached) return cached;

      const period = await this.db.get(key);
      this.cache.set(key, JSON.parse(period));
      return JSON.parse(period);
    } catch (error) {
      if (error.notFound) return null;
      Logger.error('Failed to retrieve consensus period:', error);
      throw error;
    }
  }

  // Query methods
  async getMinerSolutions(
    minerAddress: string,
    limit = 100,
  ): Promise<PowSolution[]> {
    const solutions: PowSolution[] = [];
    try {
      for await (const [, value] of this.db.iterator({
        gte: `miner:${minerAddress}:`,
        lte: `miner:${minerAddress}:\xFF`,
        limit,
      })) {
        solutions.push(JSON.parse(value));
      }
      return solutions;
    } catch (error) {
      Logger.error('Failed to retrieve miner solutions:', error);
      throw error;
    }
  }

  async getMetricsInRange(
    startTime: bigint,
    endTime: bigint,
  ): Promise<MiningMetrics[]> {
    const metrics: MiningMetrics[] = [];
    try {
      for await (const [, value] of this.db.iterator({
        gte: `metrics:time:${startTime}`,
        lte: `metrics:time:${endTime}`,
      })) {
        try {
          metrics.push(JSON.parse(value));
        } catch (error) {
          if (error instanceof SyntaxError) {
            Logger.error('Invalid JSON in metrics:', error);
            continue;
          }
          throw error;
        }
      }
      return metrics;
    } catch (error) {
      Logger.error('Failed to retrieve metrics range:', error);
      throw error;
    }
  }

  // Validation methods
  private validatePowSolution(solution: PowSolution): boolean {
    return !!(
      solution.blockHash &&
      solution.nonce &&
      solution.minerAddress &&
      solution.timestamp &&
      solution.signature
    );
  }

  private validateMiningMetrics(metrics: MiningMetrics): boolean {
    return !!(
      metrics.blockHeight >= 0 &&
      metrics.hashRate >= BigInt(0) &&
      metrics.difficulty >= 0 &&
      metrics.timestamp
    );
  }

  private validateConsensusVote(vote: ConsensusVote): boolean {
    return !!(
      vote.blockHash &&
      vote.voterAddress &&
      vote.voteType &&
      vote.timestamp &&
      vote.signature
    );
  }

  private validateConsensusPeriod(period: ConsensusPeriod): boolean {
    return !!(
      period.startHeight >= 0 &&
      period.endHeight > period.startHeight &&
      period.startTime &&
      period.endTime > period.startTime
    );
  }

  // Cleanup method
  public async dispose(): Promise<void> {
    try {
      await this.db.close();
      this.cache.clear(true);
      this.initialized = false;
    } catch (error) {
      Logger.error('Error during mining database disposal:', error);
      throw new Error('Failed to dispose mining database');
    }
  }

  private safeParse<T>(value: string): T | null {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      Logger.error('Failed to parse stored value:', error);
      return null;
    }
  }
}
