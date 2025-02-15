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
  private cache: Cache<string>;
  private mutex: Mutex;
  private readonly BATCH_SIZE = 1000;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private initialized = false;

  constructor(dbPath: string) {
    if (!dbPath) throw new Error('Database path is required');

    this.db = new Level(`${dbPath}/mining`, {
      valueEncoding: 'json',
      ...databaseConfig.options,
    });

    this.mutex = new Mutex();

    this.cache = new Cache<string>({
      ttl: this.CACHE_TTL,
      maxSize: 10000,
      compression: true,
      priorityLevels: { pow: 2, default: 1 },
    });

    // Initialize immediately in constructor
    this.db.open().then(() => {
      this.initialized = true;
      Logger.info('Mining database initialized successfully');
    }).catch((error) => {
      Logger.error('Failed to initialize mining database:', error);
      throw error;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private serializeForStorage(data: any): string {
    // Filter out private properties for MiningMetrics
    const toSerialize = data instanceof MiningMetrics ? {
      totalBlocks: data.totalBlocks,
      successfulBlocks: data.successfulBlocks,
      lastMiningTime: data.lastMiningTime,
      averageHashRate: data.averageHashRate,
      totalTAGMined: data.totalTAGMined,
      currentBlockReward: data.currentBlockReward,
      tagTransactionsCount: data.tagTransactionsCount,
      timestamp: data.timestamp,
      blockHeight: data.blockHeight,
      hashRate: data.hashRate,
      difficulty: data.difficulty,
      blockTime: data.blockTime,
      tagVolume: data.tagVolume,
      tagFees: data.tagFees,
      lastBlockTime: data.lastBlockTime,
      syncedHeaders: data.syncedHeaders,
      syncedBlocks: data.syncedBlocks,
      whitelistedPeers: data.whitelistedPeers,
      blacklistedPeers: data.blacklistedPeers
    } : data;

    return JSON.stringify(toSerialize, (_, value) =>
      typeof value === 'bigint' ? value.toString() + 'n' : value
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private deserializeFromStorage(data: string): any {
    const parsed = JSON.parse(data, (_, value) => {
      if (typeof value === 'string' && value.endsWith('n')) {
        return BigInt(value.slice(0, -1));
      }
      return value;
    });

    // If this is a metrics object, create a new instance with the parsed data
    if (parsed && typeof parsed === 'object' && 'blockHeight' in parsed) {
      const metrics = MiningMetrics.getInstance();
      Object.assign(metrics, parsed);
      return metrics;
    }

    return parsed;
  }

  @retry({ maxAttempts: 3, delay: 1000 })
  async storePowSolution(solution: PowSolution): Promise<void> {
    await this.waitForInitialization();

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
        let opCount = 0;

        const serializedSolution = this.serializeForStorage(solution);
        batch.put(key, serializedSolution);
        opCount++;

        // Index by miner address with timestamp for ordering
        const minerKey = `miner:${solution.minerAddress}:${solution.timestamp}`;
        batch.put(minerKey, key);
        opCount++;

        if (opCount > this.BATCH_SIZE) {
          throw new Error('Batch size exceeds allowed limit');
        }
        await batch.write();
        this.cache.set(key, serializedSolution);

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

  private async waitForInitialization(): Promise<void> {
    if (this.initialized) return;
    
    let attempts = 0;
    const maxAttempts = 10;
    const delay = 100;

    while (!this.initialized && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delay));
      attempts++;
    }

    if (!this.initialized) {
      throw new Error('Database failed to initialize');
    }
  }

  @retry({ maxAttempts: 3, delay: 1000 })
  async storeMiningMetrics(metrics: MiningMetrics): Promise<void> {
    await this.waitForInitialization();
    const key = `metrics:${metrics.blockHeight}`;
    try {
      // Validate metrics
      if (!this.validateMiningMetrics(metrics)) {
        throw new Error('Invalid mining metrics');
      }

      const serializedMetrics = this.serializeForStorage(metrics);
      await this.db.put(key, serializedMetrics);
      this.cache.set(key, serializedMetrics);

      // Updated: Store the full metrics object for time-series data
      const timeKey = `metrics:time:${metrics.timestamp}`;
      await this.db.put(timeKey, serializedMetrics);

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
      const key = `consensus_vote:${vote.blockHash}:${vote.voterAddress}`;
      try {
        // Validate vote
        if (!this.validateConsensusVote(vote)) {
          throw new Error('Invalid consensus vote');
        }

        const serializedVote = this.serializeForStorage(vote);
        const batch = this.db.batch();
        let opCount = 0;

        // Store main record
        batch.put(key, serializedVote);
        opCount++;

        // Update: Use the same prefix for the timestamp index as well
        batch.put(`consensus_vote:time:${vote.timestamp}`, key);
        opCount++;

        if (opCount > this.BATCH_SIZE) {
          throw new Error('Batch size exceeds allowed limit');
        }
        await batch.write();
        this.cache.set(key, serializedVote);

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

      const serializedPeriod = this.serializeForStorage(period);
      await this.db.put(key, serializedPeriod);
      this.cache.set(key, serializedPeriod);

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
    await this.waitForInitialization();

    const key = `pow:${blockHash}:${nonce}`;
    try {
      // Try cache first
      const cached = this.cache.get(key);
      if (cached) {
        // Refresh TTL on cache hit
        this.cache.set(key, cached);
        return this.deserializeFromStorage(cached);
      }

      const solution = await this.db.get(key);
      if (!solution) return null;
      
      this.cache.set(key, solution);
      return this.deserializeFromStorage(solution);
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return null;
      Logger.error('Failed to retrieve PoW solution:', error);
      throw new Error('Failed to retrieve PoW solution');
    }
  }

  async getMiningMetrics(blockHeight: number): Promise<MiningMetrics | null> {
    await this.waitForInitialization();
    const key = `metrics:${blockHeight}`;
    try {
      const cached = this.cache.get(key);
      if (cached) {
        this.cache.set(key, cached);
        return this.deserializeFromStorage(cached as string);
      }

      const metricsString = await this.db.get(key);
      if (!metricsString) return null;
      
      this.cache.set(key, metricsString);
      return this.deserializeFromStorage(metricsString);
    } catch (error: unknown) {
      if (this.isNotFoundError(error)) return null;
      Logger.error('Failed to retrieve mining metrics:', error);
      throw error;
    }
  }

  async getConsensusVote(
    blockHash: string,
    voterAddress: string,
  ): Promise<ConsensusVote | null> {
    await this.waitForInitialization();
    const key = `consensus_vote:${blockHash}:${voterAddress}`;
    try {
      const cached = this.cache.get(key);
      if (cached) {
        this.cache.set(key, cached);
        return this.deserializeFromStorage(cached as string);
      }

      const voteString = await this.db.get(key);
      if (!voteString) return null;
      
      this.cache.set(key, voteString);
      return this.deserializeFromStorage(voteString);
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return null;
      Logger.error('Failed to retrieve consensus vote:', error);
      throw error;
    }
  }

  async getConsensusPeriod(
    startHeight: number,
  ): Promise<ConsensusPeriod | null> {
    await this.waitForInitialization();
    const key = `period:${startHeight}`;
    try {
      const cached = this.cache.get(key);
      if (cached) {
        return this.deserializeFromStorage(cached as string);
      }

      const periodString = await this.db.get(key);
      if (!periodString) return null;
      
      this.cache.set(key, periodString);
      return this.deserializeFromStorage(periodString);
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return null;
      Logger.error('Failed to retrieve consensus period:', error);
      throw error;
    }
  }

  // Query methods
  async getMinerSolutions(
    minerAddress: string,
    limit = 100,
  ): Promise<PowSolution[]> {
    await this.waitForInitialization();
    const solutions: PowSolution[] = [];
    try {
      for await (const [, value] of this.db.iterator({
        gte: `miner:${minerAddress}:`,
        lte: `miner:${minerAddress}:\xFF`,
        limit,
      })) {
        try {
          const solutionKey = value as string;
          const solutionData = await this.db.get(solutionKey);
          if (solutionData) {
            const solution = this.deserializeFromStorage(solutionData);
            solutions.push(solution);
          }
        } catch (error) {
          Logger.error('Error parsing miner solution:', error);
          continue;
        }
      }
      return solutions;
    } catch (error: unknown) {
      Logger.error(
        'Failed to retrieve miner solutions:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }

  async getMetricsInRange(
    startTime: bigint,
    endTime: bigint,
  ): Promise<MiningMetrics[]> {
    await this.waitForInitialization();
    const metrics: MiningMetrics[] = [];
    try {
      for await (const [, value] of this.db.iterator({
        gte: `metrics:time:${startTime}`,
        lte: `metrics:time:${endTime}`,
      })) {
        try {
          const metric = this.deserializeFromStorage(value);
          metrics.push(metric);
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
      solution.nonce !== undefined &&
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

  private isNotFoundError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'notFound' in error;
  }
}
