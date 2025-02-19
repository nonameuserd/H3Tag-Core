import { Level } from 'level';
import { Logger } from '@h3tag-blockchain/shared';
import { Vote, VotingPeriod } from '../models/vote.model';
import { Transaction, TransactionType } from '../models/transaction.model';
import { retry } from '../utils/retry';
import { Mutex } from 'async-mutex';
import { Block, BlockHeader } from '../models/block.model';
import { Cache } from '../scaling/cache';
import { databaseConfig } from './config.database';
import { IVotingSchema, VotingDatabase } from './voting-schema';
import { EventEmitter } from 'events';
import { Validator } from '../models/validator';
import { BLOCKCHAIN_CONSTANTS } from '../blockchain/utils/constants';
import { createHash } from 'crypto';
import { PerformanceMonitor } from '../monitoring/performance-monitor';
import { AuditEventType, AuditManager } from '../security/audit';
import { MetricsCollector } from '../monitoring/metrics-collector';
import { AbstractBatch, AbstractChainedBatch } from 'abstract-leveldown';
import { gzip } from 'zlib';
import { promisify } from 'util';
import { UTXO } from '../models/utxo.model';
import { promises as fs } from 'fs';
import crypto from 'crypto';

/**
 * @fileoverview BlockchainSchema implements the database schema and operations for blockchain data storage.
 * It handles block, transaction, and UTXO persistence with optimized caching and atomic batch operations.
 *
 * @module BlockchainSchema
 */

/**
 * BlockchainSchema manages blockchain data persistence with LevelDB.
 *
 * @class BlockchainSchema
 *
 * @property {Level} db - LevelDB database instance
 * @property {Mutex} mutex - Mutex for synchronizing operations
 * @property {number} BATCH_SIZE - Maximum batch operation size
 * @property {AuditManager} auditManager - Audit logging manager
 * @property {EventEmitter} eventEmitter - Event emitter for database events
 * @property {MetricsCollector} metricsCollector - Metrics collection instance
 * @property {Cache} cache - Multi-purpose data cache
 * @property {Cache} transactionCache - Transaction-specific cache
 * @property {Cache} blockCache - Block-specific cache
 * @property {Cache} validatorMetricsCache - Validator metrics cache
 * @property {Cache} votingPowerCache - Voting power cache
 * @property {Cache} slashingHistoryCache - Slashing history cache
 * @property {string} dbPath - Database directory path
 *
 * @example
 * const schema = new BlockchainSchema('./data/blockchain');
 * await schema.initialize();
 * await schema.saveBlock(block);
 */

/**
 * @typedef {Object} ValidatorPerformance
 * @property {number} successfulValidations - Number of successful validations
 * @property {number} totalOpportunities - Total validation opportunities
 */

/**
 * @typedef {Object} ValidatorStats
 * @property {number} currentLoad - Current validator load
 * @property {number} maxCapacity - Maximum validator capacity
 */

/**
 * @typedef {Object} ShardData
 * @property {string[]} data - Shard data array
 * @property {number} lastSync - Last synchronization timestamp
 * @property {number} version - Shard data version
 * @property {string} checksum - Data integrity checksum
 * @property {Object} metadata - Shard metadata
 * @property {number} metadata.size - Data size in bytes
 * @property {boolean} metadata.compressed - Compression status
 * @property {number} metadata.createdAt - Creation timestamp
 * @property {number} metadata.updatedAt - Last update timestamp
 */

/**
 * Creates a new voting period
 *
 * @async
 * @method createVotingPeriod
 * @param {number} startBlock - Period start block
 * @param {number} endBlock - Period end block
 * @returns {Promise<number>} New voting period ID
 * @throws {Error} If period creation fails
 *
 * @example
 * const periodId = await schema.createVotingPeriod(1000, 2000);
 */

/**
 * Records a vote in the database
 *
 * @async
 * @method recordVote
 * @param {Vote} vote - Vote to record
 * @param {number} periodId - Voting period ID
 * @returns {Promise<boolean>} True if vote was recorded
 * @throws {Error} If vote recording fails
 *
 * @example
 * const success = await schema.recordVote(vote, periodId);
 */

/**
 * Gets UTXOs by address
 *
 * @async
 * @method getUtxosByAddress
 * @param {string} address - Address to query
 * @returns {Promise<Array<{
 *   txid: string;
 *   vout: number;
 *   amount: number;
 *   confirmations: number;
 * }>>} Array of UTXOs
 *
 * @example
 * const utxos = await schema.getUtxosByAddress(address);
 */

/**
 * Gets current blockchain height
 *
 * @async
 * @method getCurrentHeight
 * @returns {Promise<number>} Current height
 *
 * @example
 * const height = await schema.getCurrentHeight();
 */

/**
 * Gets unique addresses with balance
 *
 * @async
 * @method getUniqueAddressesWithBalance
 * @returns {Promise<number>} Number of unique addresses
 */

/**
 * Gets total supply
 *
 * @async
 * @method getTotalSupply
 * @returns {Promise<bigint>} Total supply
 */

/**
 * Compacts the database
 *
 * @async
 * @method compact
 * @returns {Promise<void>}
 * @throws {Error} If compaction fails
 */

/**
 * Closes database connection
 *
 * @async
 * @method close
 * @returns {Promise<void>}
 */

/**
 * Creates database backup
 *
 * @async
 * @method backup
 * @param {string} path - Backup destination path
 * @returns {Promise<void>}
 * @throws {Error} If backup fails
 */

interface ChainState {
  height: number;
  lastBlockHash: string;
  timestamp: number;
}

interface ValidatorPerformance {
  successfulValidations: number;
  totalOpportunities: number;
}

interface ValidatorStats {
  currentLoad: number;
  maxCapacity: number;
}

interface ShardData {
  data: string[];
  lastSync: number;
  version: number;
  checksum: string;
  metadata: {
    size: number;
    compressed: boolean;
    createdAt: number;
    updatedAt: number;
  };
}

interface QueryResult {
  id: string;
  name: string;
  [key: string]: unknown; // Index signature to allow dynamic property access
}

interface QueryResponse {
  rows: QueryResult[];
  count: number;
  timestamp: number;
}

export class BlockchainSchema {
  public db: Level;
  private mutex: Mutex;
  private readonly auditManager: AuditManager | null = null;
  private readonly eventEmitter: EventEmitter | null = null;
  private readonly metricsCollector: MetricsCollector | null = null;
  private readonly votingSchema: VotingDatabase | null = null;
  readonly cache: Cache<
    Block | { signature: string } | { balance: bigint; holdingPeriod: number }
  >;
  private readonly dbPath: string;
  private transactionCache = new Cache<string | Transaction>();
  private blockCache = new Cache<Block>();
  private readonly validatorMetricsCache = new Cache<number>({
    ttl: 300000,
    maxSize: 1000,
  });
  private readonly votingPowerCache = new Cache<bigint>({
    ttl: 300000,
    maxSize: 1000,
  });
  private readonly slashingHistoryCache = new Cache<
    Array<{ timestamp: number; reason: string }>
  >({
    ttl: 300000, // 5 minutes
    maxSize: 1000,
  });
  private readonly shardMutex = new Mutex();
  private readonly performanceMonitor = new PerformanceMonitor('database');
  private readonly SHARD_VERSION = 1;
  private abstractTransaction: AbstractBatch[] | null = null;
  private transaction: AbstractChainedBatch<string, string> | null = null;
  private transactionOperations: AbstractBatch[] = [];
  private heightCache = new Cache<string>();
  private votingDb: IVotingSchema | null = null;
  private transactionLock = new Mutex();
  private transactionStartTime: number | null = null;
  private transactionLocks = new Map<string, Mutex>();
  private readonly CACHE_TTL = 3600; // 1 hour
  private _transactionLockRelease: (() => void) | undefined;
  /**
   * Constructor for Database
   * @param dbPath Path to the database
   */
  constructor(dbPath = './data/blockchain') {
    this.dbPath = dbPath;

    // Remove valueEncoding so that we work with string values and preserve manual JSON (de)serialization.
    this.db = new Level(dbPath, {
      ...databaseConfig.options,
    });
    this.mutex = new Mutex();
    this.cache = new Cache<
      Block | { signature: string } | { balance: bigint; holdingPeriod: number }
    >({
      ttl: 3600,
      maxSize: 10000,
      compression: true,
      priorityLevels: { pow: 2, default: 1 },
      onEvict: (key, value) => {
        // Cleanup evicted items
        if (value && typeof value === 'object' && 'hash' in value) {
          this.db
            .put(`block:${key}`, JSON.stringify(value))
            .catch((e) => Logger.error('Failed to persist evicted block:', e));
        }
      },
    });
  }

  /**
   * Get the database path
   * @returns string Database path
   */
  getPath(): string {
    return this.dbPath;
  }

  /**
   * Create a new voting period
   * @param startBlock Start block number
   * @param endBlock End block number
   * @returns Promise<number> New voting period ID
   */
  @retry({ maxAttempts: 3, delay: 1000 })
  async createVotingPeriod(
    startBlock: number,
    endBlock: number,
  ): Promise<number> {
    try {
      const periodId = Date.now();
      await this.db.put(
        `voting_period:${periodId}`,
        JSON.stringify({
          startBlock,
          endBlock,
          totalEligibleVoters: await this.getUniqueAddressesWithBalance(),
          minimumParticipation: 0.1,
          status: 'active',
          createdAt: Date.now(),
        }),
      );
      return periodId;
    } catch (error) {
      Logger.error('Failed to create voting period:', error);
      throw error;
    }
  }

  /**
   * Record a vote
   * @param vote Vote to record
   * @param periodId Voting period ID
   * @returns Promise<boolean> True if vote was recorded successfully
   */
  async recordVote(vote: Vote, periodId: number): Promise<boolean> {
    return await this.mutex.runExclusive(async () => {
      const batch = this.db.batch();
      try {
        const existingVoteData = await this.db
          .get(`vote:${periodId}:${vote.voter}`)
          .catch(() => null);
        if (existingVoteData) {
          throw new Error('Voter has already voted in this period');
        }

        if (!vote.signature) {
          throw new Error('Invalid vote: missing signature');
        }

        const voteId = `${periodId}:${vote.voter}`;
        batch.put(
          `vote:${voteId}`,
          this.jsonStringify({
            ...vote,
            timestamp: Date.now(),
            version: '1.0',
          })
        );
        // Process reward logic after fetching and validating period data
        const periodData = await this.db.get(`voting_period:${periodId}`);
        const period = JSON.parse(periodData);
        const reward = period.status === 'active' ? 100 : 50;
        batch.put(
          `vote_incentive:${voteId}`,
          JSON.stringify({
            reward,
            timestamp: Date.now(),
            processed: false,
          }),
        );

        await batch.write();
        return true;
      } catch (error: unknown) {
        Logger.error('Failed to record vote:', error);
        return false;
      }
    });
  }

  /**
   * Get UTXOs by address
   * @param address Address to get UTXOs for
   * @returns Promise<UTXO[]> UTXOs for the address
   */
  @retry({ maxAttempts: 3, delay: 1000 })
  async getUtxosByAddress(address: string): Promise<UTXO[]> {
    const utxos: UTXO[] = [];
    const currentHeight = await this.getCurrentHeight();

    try {
      for await (const [key, rawValue] of this.db.iterator({
        gte: `utxo:${address}:`,
        lte: `utxo:${address}:\xFF`,
      })) {
        try {
          const value = this.jsonParse(rawValue);
          if (this.isValidUtxo(value) && !value.spent) {
            utxos.push({
              ...value,
              amount: BigInt(value.amount),
              confirmations: Math.max(
                currentHeight - (value.blockHeight || 0) + 1,
              ),
            });
          }
        } catch (parseError) {
          Logger.error(`Invalid UTXO data for ${key}:`, parseError);
          continue;
        }
      }
      return utxos;
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get UTXOs:', error);
      } else {
        Logger.error('Failed to get UTXOs:', error);
      }
      throw error;
    }
  }

  private isValidUtxo(utxo: UTXO): utxo is UTXO {
    return (
      utxo &&
      typeof utxo.txId === 'string' &&
      typeof utxo.outputIndex === 'number' &&
      (typeof utxo.amount === 'number' || typeof utxo.amount === 'bigint') &&
      typeof utxo.blockHeight === 'number' &&
      typeof utxo.address === 'string'
    );
  }

  /**
   * Get the current block height
   * @returns Promise<number> Current block height
   */
  async getCurrentHeight(): Promise<number> {
    try {
      const height = await this.db.get('current_height');
      const parsedHeight = parseInt(height);
      if (isNaN(parsedHeight)) {
        throw new Error('Invalid height value');
      }
      return parsedHeight;
    } catch (error) {
      if (error instanceof Error && 'notFound' in error) {
        Logger.warn('Current height not found, returning 0');
        return 0; // Return a known default if key is missing
      }
      Logger.error('Failed to get current height:', error);
      throw error;
    }
  }

  /**
   * Get the number of unique addresses with balance
   * @returns Promise<number> Number of unique addresses with balance
   */
  async getUniqueAddressesWithBalance(): Promise<number> {
    const addresses = new Set<string>();

    try {
      const iterator = this.db.iterator({
        gte: 'utxo:',
        lte: 'utxo:\xFF',
      });
      if (!iterator || typeof iterator[Symbol.asyncIterator] !== 'function') {
        return 0;
      }
      for await (const [, rawValue] of iterator) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const value: any = JSON.parse(rawValue);
        if (!value.spent) {
          addresses.add(value.address);
        }
      }
      return addresses.size;
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get unique addresses:', error);
      } else {
        Logger.error('Failed to get unique addresses:', error);
      }
      throw error;
    }
  }

  /**
   * Get the total supply of the blockchain
   * @returns Promise<bigint> Total supply
   */
  async getTotalSupply(): Promise<bigint> {
    try {
      let totalSupply = BigInt(0);

      // Sum all unspent UTXOs
      for await (const [, rawValue] of this.db.iterator({
        gte: 'utxo:',
        lte: 'utxo:\xFF',
      })) {
        const utxo = JSON.parse(rawValue);
        if (!utxo.spent) {
          totalSupply += BigInt(utxo.amount);
        }
      }

      return totalSupply;
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get total supply:', error);
      } else {
        Logger.error('Failed to get total supply:', error);
      }
      throw new Error(
        `Database error: Failed to get total supply - ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Compact the database
   * @returns Promise<void>
   */
  async compact(): Promise<void> {
    const batch = this.db.batch();
    const now = Date.now();
    const TWO_MONTHS = 60 * 60 * 1000 * 24 * 60;
    const currentHeight = await this.getCurrentHeight();

    try {
      Logger.info('Starting database compaction...');
      let processedCount = 0;

      for await (const [key, value] of this.db.iterator()) {
        const shouldDelete = await this.shouldDelete(key, JSON.parse(value), {
          now,
          TWO_MONTHS,
          currentHeight,
        });

        if (shouldDelete) {
          batch.del(key);
          processedCount++;
        }

        // Log progress every 10000 entries
        if (processedCount % 10000 === 0) {
          Logger.info(
            `Compaction progress: ${processedCount} entries processed`,
          );
        }
      }

      await batch.write();
      Logger.info(
        `Database compaction completed. Removed ${processedCount} entries.`,
      );
    } catch (error) {
      Logger.error('Database compaction failed:', error);
      throw error;
    }
  }

  /**
   * Determine if a key should be deleted
   * @param key Key to check
   * @param value Value of the key
   * @param context Context object
   * @returns Promise<boolean> True if the key should be deleted
   */
  private async shouldDelete(
    key: string,
    value: {
      processed: boolean;
      timestamp: number;
      deleted: boolean;
      deletedAt: number;
      endBlock: number;
    },
    context: {
      now: number;
      TWO_MONTHS: number;
      currentHeight: number;
    },
  ): Promise<boolean> {
    // Delete old processed votes
    if (key.startsWith('vote:') && value.processed) {
      return context.now - value.timestamp > context.TWO_MONTHS;
    }

    // Delete old transactions from inactive shards
    if (key.startsWith('shard:') && value.deleted) {
      return context.now - value.deletedAt > context.TWO_MONTHS;
    }

    // Delete old voting periods
    if (key.startsWith('voting_period:')) {
      return value.endBlock < context.currentHeight - 10000;
    }

    // Keep all UTXO records for audit purposes
    if (key.startsWith('utxo:')) {
      return false;
    }

    return false;
  }

  /**
   * Close the database connection
   * @returns Promise<void>
   */
  async close(): Promise<void> {
    try {
      Logger.info('Closing database connection...');
      await this.db.close();
      Logger.info('Database connection closed successfully');
    } catch (error) {
      Logger.error('Failed to close database:', error);
      throw error;
    }
  }

  /**
   * Backup the database
   * @param path Path to backup to
   * @returns Promise<void>
   */
  async backup(path: string): Promise<void> {
    try {
      Logger.info(`Starting database backup to ${path}`);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${path}/backup-${timestamp}`;

      // Create backup directory
      await fs.mkdir(backupPath, { recursive: true });

      // Stream all data to backup files
      const batchSize = 10000;
      let batch: { key: string; value: unknown }[] = [];
      let fileCounter = 0;

      for await (const [key, value] of this.db.iterator()) {
        batch.push({ key, value });

        if (batch.length >= batchSize) {
          const fileName = `${backupPath}/batch-${fileCounter}.json`;
          const hash = crypto.createHash('sha256');
          const data = JSON.stringify(batch);

          hash.update(data);
          await fs.writeFile(fileName, data);
          await fs.writeFile(`${fileName}.sha256`, hash.digest('hex'));

          batch = [];
          fileCounter++;

          Logger.info(
            `Backup progress: ${fileCounter * batchSize} entries written`,
          );
        }
      }

      // Write remaining entries
      if (batch.length > 0) {
        const fileName = `${backupPath}/batch-${fileCounter}.json`;
        const hash = crypto.createHash('sha256');
        const data = JSON.stringify(batch);

        hash.update(data);
        await fs.writeFile(fileName, data);
        await fs.writeFile(`${fileName}.sha256`, hash.digest('hex'));
      }

      // Write backup metadata
      await fs.writeFile(
        `${backupPath}/metadata.json`,
        JSON.stringify({
          timestamp: Date.now(),
          totalFiles: fileCounter + 1,
          totalEntries: fileCounter * batchSize + batch.length,
          version: '1.0',
        }),
      );

      Logger.info(`Database backup completed successfully at ${backupPath}`);
    } catch (error) {
      Logger.error('Database backup failed:', error);
      throw error;
    }
  }

  /**
   * Find data in the database
   * @param query Query object
   * @returns Promise<any[]> Found data
   */
  async find(query: { [key: string]: unknown }): Promise<QueryResult[]> {
    const results: QueryResult[] = [];
    try {
      for await (const [key, value] of this.db.iterator()) {
        try {
          const data = JSON.parse(value);
          if (this.matchesQuery(data, query)) {
            results.push(data);
          }
        } catch (parseError) {
          Logger.error(`Failed to parse value for key ${key}:`, parseError);
          continue;
        }
      }
      return results;
    } catch (error) {
      Logger.error('Database find failed:', error);
      throw error;
    }
  }

  private matchesQuery(
    data: QueryResult,
    query: { [key: string]: unknown },
  ): boolean {
    return Object.entries(query).every(([k, v]) => {
      const path = k.split('.');
      let current = data;
      for (const key of path) {
        if (current === undefined || current === null) return false;
        current = current[key] as QueryResult;
      }
      return current === v;
    });
  }

  /**
   * Get a value from the database
   * @param key Key to get
   * @returns Promise<string> Value
   */
  async get(key: string): Promise<string> {
    try {
      return await this.db.get(key);
    } catch (error) {
      Logger.error('Database get failed:', error);
      throw error;
    }
  }

  /**
   * Query the database
   * @param sql SQL query string
   * @param params Query parameters
   * @returns Promise<QueryResponse> Query results with metadata
   */
  async query(
    sql: string,
    params: Array<string | number> = [],
  ): Promise<QueryResponse> {
    try {
      const results: QueryResult[] = [];
      const startTime = Date.now();

      // For LevelDB, we'll simulate basic SQL-like queries
      for await (const [key, value] of this.db.iterator()) {
        try {
          const data = JSON.parse(value) as QueryResult;

          // Simple filtering based on the first parameter
          if (params[0] && key.includes(String(params[0]))) {
            results.push(data);
          }
        } catch (parseError) {
          Logger.error(`Failed to parse value for key ${key}:`, parseError);
          continue;
        }
      }

      return {
        rows: results,
        count: results.length,
        timestamp: startTime,
      };
    } catch (error) {
      Logger.error('Database query failed:', error);
      throw error;
    }
  }

  /**
   * Get a range of blocks from the database
   * @param startHeight Start block height
   * @param endHeight End block height
   * @returns Promise<Block[]> Blocks in the range
   */
  async getBlockRange(
    startHeight: number,
    endHeight: number,
  ): Promise<Block[]> {
    const BATCH_SIZE = 100;
    const batchCount = Math.ceil((endHeight - startHeight + 1) / BATCH_SIZE);
    const batchStartHeights = Array.from(
      { length: batchCount },
      (_, i) => startHeight + i * BATCH_SIZE,
    );

    const batchPromises = batchStartHeights.map(async (batchStart) => {
      const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, endHeight);
      const currentBatch: AbstractBatch[] = [];
      const batchBlocks: Block[] = [];

      for await (const [, value] of this.db.iterator({
        gte: `block:${batchStart}`,
        lte: `block:${batchEnd}`,
        valueEncoding: 'json',
      })) {
        const block = JSON.parse(value) as Block;
        batchBlocks.push(block);
        currentBatch.push({
          type: 'put',
          key: `block:${block.header.height}`,
          value: JSON.stringify(block),
        });
      }
      if (currentBatch.length > 0) {
        await this.db.batch(currentBatch);
      }
      return batchBlocks;
    });
    const batches = await Promise.all(batchPromises);
    return batches.flat();
  }

  /**
   * Get the token holders
   * @returns Promise<Array<{ address: string; balance: bigint }>> Token holders
   */
  async getTokenHolders(): Promise<
    Array<{ address: string; balance: bigint }>
  > {
    const holders = new Map<string, bigint>();

    try {
      for await (const [, rawValue] of this.db.iterator({
        gte: 'utxo:',
        lte: 'utxo:\xFF',
      })) {
        const utxo: UTXO = JSON.parse(rawValue);
        if (!utxo.spent) {
          const current = holders.get(utxo.address) || BigInt(0);
          holders.set(utxo.address, current + BigInt(utxo.amount));
        }
      }

      return Array.from(holders.entries()).map(([address, balance]) => ({
        address,
        balance,
      }));
    } catch (error) {
      Logger.error('Failed to get token holders:', error);
      throw error;
    }
  }

  /**
   * Get the token balance for an address
   * @param address Address to get balance for
   * @returns Promise<{ balance: bigint; holdingPeriod: number }> Token balance and holding period
   */
  async getTokenBalance(
    address: string,
  ): Promise<{ balance: bigint; holdingPeriod: number }> {
    const cacheKey = `token_balance:${address}`;
    try {
      const cached = this.cache.get(cacheKey) as
        | { balance: bigint; holdingPeriod: number }
        | undefined;
      if (
        cached &&
        typeof cached.balance === 'bigint' &&
        typeof cached.holdingPeriod === 'number'
      ) {
        this.cache.set(cacheKey, cached, { ttl: this.CACHE_TTL });
        return cached;
      }

      let balance = BigInt(0);
      let earliestUtxo = Date.now();

      for await (const [key, rawValue] of this.db.iterator({
        gte: `utxo:${address}:`,
        lte: `utxo:${address}:\xFF`,
      })) {
        try {
          const utxo = JSON.parse(rawValue);
          if (!utxo.spent) {
            balance += BigInt(utxo.amount);
            earliestUtxo = Math.min(earliestUtxo, utxo.blockHeight);
          }
        } catch (parseError) {
          Logger.error(`Invalid UTXO data for ${key}:`, parseError);
          continue;
        }
      }

      const result = {
        balance,
        holdingPeriod: Date.now() - earliestUtxo,
      };

      this.cache.set(cacheKey, result, { ttl: this.CACHE_TTL });
      return result;
    } catch (error) {
      Logger.error(`Failed to get token balance for ${address}:`, error);
      throw error;
    }
  }

  /**
   * Remove a delegation
   * @param delegator Delegator to remove
   * @returns Promise<void>
   */
  async removeDelegation(delegator: string): Promise<void> {
    const key = `delegation:${delegator}`;
    try {
      const batch = this.db.batch();
      batch.del(key);
      batch.del(`delegator_index:${delegator}`);

      await batch.write();
      this.cache.delete(key);
    } catch (error: unknown) {
      Logger.error(`Failed to remove delegation for ${delegator}:`, error);
      throw new Error(
        `Database error: Failed to remove delegation - ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get an auditor's signature for a vote
   * @param auditorId Auditor ID
   * @param voteId Vote ID
   * @returns Promise<string> Auditor's signature
   */
  async getAuditorSignature(
    auditorId: string,
    voteId: string,
  ): Promise<string> {
    const key = `auditor_signature:${auditorId}:${voteId}`;
    try {
      // Check cache first
      const cached = this.cache.get(key) as { signature: string } | undefined;
      if (cached) {
        this.cache.set(key, cached, { ttl: this.CACHE_TTL });
        return cached.signature;
      }

      const data = await this.db.get(key);
      const result = JSON.parse(data);

      // Cache the result
      this.cache.set(key, result);
      return result.signature;
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return '';
      Logger.error(
        `Failed to get auditor signature for ${auditorId}:${voteId}:`,
        error,
      );
      throw new Error(
        `Database error: Failed to get auditor signature - ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Calculate the Gini coefficient for token distribution
   * @returns Promise<number> Gini coefficient
   */
  async calculateTokenDistributionGini(): Promise<number> {
    try {
      const holders = await this.getTokenHolders();
      if (holders.length === 0) return 0;

      const balances = holders.map((h) => Number(h.balance));
      const mean = balances.reduce((a, b) => a + b, 0) / balances.length;
      let sumOfAbsoluteDifferences = 0;

      for (let i = 0; i < balances.length; i++) {
        for (let j = 0; j < balances.length; j++) {
          sumOfAbsoluteDifferences += Math.abs(balances[i] - balances[j]);
        }
      }

      return (
        sumOfAbsoluteDifferences /
        (2 * balances.length * balances.length * mean)
      );
    } catch (error) {
      Logger.error('Failed to calculate Gini coefficient:', error);
      throw error;
    }
  }

  /**
   * Get the latest vote for a voter
   * @param voterAddress Voter address
   * @returns Promise<Vote | null> Latest vote or null if not found
   */
  async getLatestVote(voterAddress: string): Promise<Vote | null> {
    try {
      const votes = this.db.iterator({
        gte: `vote:${voterAddress}:`,
        lte: `vote:${voterAddress}:\xFF`,
        reverse: true,
        limit: 1,
      });

      for await (const [, value] of votes) {
        return JSON.parse(value);
      }

      return null;
    } catch (error) {
      Logger.error(`Failed to get latest vote for ${voterAddress}:`, error);
      return null;
    }
  }

  /**
   * Get blocks by miner
   * @param minerAddress Miner address
   * @returns Promise<Block[]> Blocks by miner
   */
  async getBlocksByMiner(minerAddress: string): Promise<Block[]> {
    try {
      const blocks: Block[] = [];
      const iterator = this.db.iterator({
        gte: `block:miner:${minerAddress}:`,
        lte: `block:miner:${minerAddress}:\xFF`,
      });

      for await (const [, value] of iterator) {
        blocks.push(JSON.parse(value));
      }

      return blocks;
    } catch (error) {
      Logger.error(`Failed to get blocks for miner ${minerAddress}:`, error);
      return [];
    }
  }

  /**
   * Get votes by voter
   * @param voterAddress Voter address
   * @returns Promise<Vote[]> Votes by voter
   */
  async getVotesByVoter(voterAddress: string): Promise<Vote[]> {
    try {
      const votes: Vote[] = [];
      const iterator = this.db.iterator({
        gte: `vote:${voterAddress}:`,
        lte: `vote:${voterAddress}:\xFF`,
        limit: 10000,
      });

      for await (const [, value] of iterator) {
        votes.push(JSON.parse(value));
      }
      return votes;
    } catch (error) {
      Logger.error(`Failed to get votes for voter ${voterAddress}:`, error);
      return [];
    }
  }

  /**
   * Put a value in the database
   * @param key Key to put
   * @param value Value to put
   * @returns Promise<void>
   */
  async put(key: string, value: string): Promise<void> {
    try {
      await this.db.put(key, value);
    } catch (error) {
      Logger.error('Failed to put value in database:', error);
      throw error;
    }
  }

  /**
   * Get a transaction by its hash
   * @param hash Transaction hash
   * @returns Promise<Transaction | undefined> Transaction or undefined if not found
   */
  public async getTransaction(hash: string): Promise<Transaction | undefined> {
    try {
      const key = `transactions:${hash}`;
      const cached = this.transactionCache.get(key);
      if (cached) {
        // If the cached value is a string, then parse it; otherwise use it as is.
        const transaction = typeof cached === 'string' ? this.jsonParse(cached) : cached;
        this.transactionCache.set(key, cached, { ttl: this.CACHE_TTL });
        return transaction;
      }

      const data = await this.db.get(key);
      const transaction = this.jsonParse(data);

      // Cache the serialized data (string)
      this.transactionCache.set(key, data, { ttl: this.CACHE_TTL });
      return transaction;
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return undefined;
      Logger.error(`Failed to get transaction ${hash}:`, error);
      throw new Error(
        `Database error: Failed to get transaction - ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Save a transaction to the database
   * @param transaction Transaction to save
   * @returns Promise<void>
   */
  async saveTransaction(transaction: Transaction): Promise<void> {
    const key = `transactions:${transaction.hash}`;
    const batch = this.db.batch();

    try {
      // Validate transaction before saving
      if (!this.isValidTransaction(transaction)) {
        throw new Error('Invalid transaction data');
      }

      // Serialize for database storage using our custom BigInt replacer
      const serializedTransaction = this.jsonStringify(transaction);

      batch.put(key, serializedTransaction);
      batch.put(
        `tx_type:${transaction.type}:${transaction.hash}`,
        transaction.hash,
      );

      await batch.write();

      // Cache the serialized transaction (string) to avoid BigInt serialization errors
      this.transactionCache.set(key, serializedTransaction);
    } catch (error: unknown) {
      Logger.error(`Failed to save transaction ${transaction.hash}:`, error);
      throw new Error(
        `Database error: Failed to save transaction - ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private isValidTransaction(tx: Transaction): boolean {
    return (
      tx &&
      typeof tx.hash === 'string' &&
      tx.hash.length > 0 &&
      typeof tx.type === 'string' &&
      Array.isArray(tx.inputs) &&
      Array.isArray(tx.outputs)
    );
  }

  /**
   * Delete a transaction by its hash
   * @param hash Transaction hash
   * @returns Promise<void>
   */
  async deleteTransaction(hash: string): Promise<void> {
    try {
      const key = `transactions:${hash}`;
      const tx = await this.getTransaction(hash);
      if (tx) {
        const batch = this.db.batch();
        batch.del(key);
        batch.del(`tx_type:${tx.type}:${hash}`);
        await batch.write();
        this.cache.delete(key);
      }
    } catch (error: unknown) {
      Logger.error(`Failed to delete transaction ${hash}:`, error);
      throw new Error(
        `Database error: Failed to delete transaction - ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get transactions by type
   * @param type Transaction type (optional)
   * @returns Promise<Transaction[]> Transactions
   */
  async getTransactions(type?: TransactionType): Promise<Transaction[]> {
    try {
      const transactions: Transaction[] = [];
      const prefix = type ? `tx_type:${type}:` : 'transactions:';

      for await (const [key, value] of this.db.iterator({
        gte: prefix,
        lte: prefix + '\xFF',
      })) {
        const hash = type ? value : key.split(':')[1];
        const tx = await this.getTransaction(hash);
        if (tx) transactions.push(tx);
      }

      return transactions;
    } catch (error: unknown) {
      Logger.error('Failed to get transactions:', error);
      throw new Error(
        `Database error: Failed to get transactions - ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get the balance for an address
   * @param address Address to get balance for
   * @returns Promise<bigint> Balance
   */
  async getBalance(address: string): Promise<bigint> {
    try {
      let balance = BigInt(0);

      // Sum all unspent UTXOs for the address
      for await (const [, rawValue] of this.db.iterator({
        gte: `utxo:${address}:`,
        lte: `utxo:${address}:\xFF`,
      })) {
        const utxo = JSON.parse(rawValue);
        if (!utxo.spent) {
          balance += BigInt(utxo.amount);
        }
      }

      return balance;
    } catch (error: unknown) {
      Logger.error(`Failed to get balance for ${address}:`, error);
      throw new Error(
        `Database error: Failed to get balance - ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get the voting schema
   * @returns IVotingSchema Voting schema
   */
  public getVotingSchema(): IVotingSchema | null {
    return this.votingDb || null;
  }

  /**
   * Get votes by period
   * @param periodId Voting period ID
   * @returns Promise<Vote[]> Votes by period
   */
  async getVotesByPeriod(periodId: number): Promise<Vote[]> {
    const votes: Vote[] = [];
    try {
      for await (const [, value] of this.db.iterator({
        gte: `vote:${periodId}:`,
        lte: `vote:${periodId}:\xFF`,
      })) {
        votes.push(JSON.parse(value));
      }
      return votes;
    } catch (error: unknown) {
      Logger.error('Failed to get votes by period:', error);
      return [];
    }
  }

  /**
   * Get a block by its height
   * @param height Block height
   * @returns Promise<Block | null> Block or null if not found
   */
  async getBlockByHeight(height: number): Promise<Block | null> {
    try {
      const key = `block:height:${height}`;
      const cached = this.blockCache.get(key);
      if (cached) {
        this.blockCache.set(key, cached, { ttl: this.CACHE_TTL });
        return cached;
      }

      const value = await this.db.get(key);
      const block = JSON.parse(value);
      this.blockCache.set(key, block);
      return block;
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return null;
      Logger.error('Failed to get block by height:', error);
      return null;
    }
  }

  /**
   * Get the total number of eligible voters
   * @returns Promise<number> Total number of eligible voters
   */
  async getTotalEligibleVoters(): Promise<number> {
    try {
      const voters = new Set<string>();
      for await (const [, value] of this.db.iterator({
        gte: 'voter:',
        lte: 'voter:\xFF',
      })) {
        const voter = JSON.parse(value);
        if (voter.eligible) voters.add(voter.address);
      }
      return voters.size;
    } catch (error) {
      Logger.error('Failed to get total eligible voters:', error);
      return 0;
    }
  }

  /**
   * Ping the database
   * @returns Promise<boolean> True if the database is accessible
   */
  async ping(): Promise<boolean> {
    const startTime = Date.now();

    try {
      // Try multiple health check queries in parallel
      const results = await Promise.all([
        this.db.get('current_height').catch((e) => ({ error: e })),
        this.db.get('last_block').catch((e) => ({ error: e })),
        this.db.get('network_status').catch((e) => ({ error: e })),
      ]);

      // Check responses with proper type guard
      const isAccessible = results.some(
        (result) =>
          typeof result === 'string' ||
          ('error' in result && result.error.notFound),
      );

      const latency = Date.now() - startTime;
      Logger.debug('Database ping latency:', { latency, isAccessible });
      this.emitMetric('db_ping_latency', latency);

      return isAccessible;
    } catch (error) {
      Logger.error('Database ping failed:', error);
      this.emitMetric('db_ping_failure', 1);
      return false;
    }
  }

  /**
   * Emit a metric
   * @param name Metric name
   * @param value Metric value
   */
  private emitMetric(name: string, value: number): void {
    this.eventEmitter?.emit('metric', {
      name,
      value,
      timestamp: Date.now(),
      component: 'database',
    });
  }

  /**
   * Verify a signature
   * @param address Address to verify
   * @param message Message to verify
   * @param signature Signature to verify
   * @returns Promise<boolean> True if the signature is valid
   */
  async verifySignature(
    address: string,
    message: string,
    signature: string,
  ): Promise<boolean> {
    try {
      const key = `signature:${address}:${message}`;
      const storedSignature = await this.db.get(key);
      return storedSignature === signature;
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return false;
      Logger.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Get the chain state
   * @returns Promise<ChainState | null> Chain state or null if not found
   */
  async getChainState(): Promise<ChainState | null> {
    try {
      const state = await this.db.get('chain_state');
      return JSON.parse(state);
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return null;
      throw error;
    }
  }

  /**
   * Update the chain state
   * @param state Chain state
   * @returns Promise<void>
   */
  async updateChainState(state: ChainState): Promise<void> {
    await this.db.put('chain_state', JSON.stringify(state));
  }

  /**
   * Get blocks from a specific height
   * @param startHeight Start block height
   * @param endHeight End block height
   * @returns Promise<Block[]> Blocks in the range
   */
  async getBlocksFromHeight(
    startHeight: number,
    endHeight: number,
  ): Promise<Block[]> {
    try {
      const blocks: Block[] = [];
      for (let height = startHeight; height <= endHeight; height++) {
        const block = await this.getBlockByHeight(height);
        if (block) blocks.push(block);
      }
      return blocks;
    } catch (error: unknown) {
      Logger.error(
        'Failed to get blocks from height:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      return [];
    }
  }

  /**
   * Save a block to the database
   * @param block Block to save
   * @returns Promise<void>
   */
  async saveBlock(block: Block): Promise<void> {
    try {
      const batch = this.db.batch();
      batch.put(`block:height:${block.header.height}`, JSON.stringify(block));
      batch.put(`block:hash:${block.hash}`, JSON.stringify(block));
      await batch.write();
      this.blockCache.set(block.hash, block);
    } catch (error) {
      Logger.error('Failed to save block:', error);
      throw error;
    }
  }

  /**
   * Get a block by its hash
   * @param hash Block hash
   * @returns Promise<Block | null> Block or null if not found
   */
  async getBlock(hash: string): Promise<Block | null> {
    try {
      const key = `block:hash:${hash}`;
      const cachedBlock = this.blockCache.get(hash);
      if (cachedBlock) {
        this.blockCache.set(hash, cachedBlock, { ttl: this.CACHE_TTL });
        return cachedBlock;
      }

      try {
        const value = await this.db.get(key);
        if (!value) return null;
        
        const block = this.jsonParse(value);
        this.blockCache.set(hash, block, { ttl: this.CACHE_TTL });
        return block;
      } catch (dbError: unknown) {
        if (dbError && typeof dbError === 'object' && 'notFound' in dbError) {
          return null;
        }
        throw dbError;
      }
    } catch (error: unknown) {
      Logger.error('Failed to get block by hash:', error);
      throw error;
    }
  }

  /**
   * Get validators
   * @returns Promise<Validator[]> Validators
   */
  async getValidators(): Promise<Validator[]> {
    try {
      const validators: Validator[] = [];

      for await (const [, value] of this.db.iterator({
        gte: 'validator:',
        lte: 'validator:\xFF',
      })) {
        try {
          const validator = this.jsonParse(value);
          const address = validator.address;

          // Get validator metrics
          const [uptime, voteParticipation, blockProduction, slashingHistory] =
            await Promise.all([
              this.getValidatorUptime(address),
              this.getVoteParticipation(address),
              this.getBlockProduction(address),
              this.getSlashingHistory(address),
            ]);

          // Validator selection criteria
          if (
            validator.isActive &&
            uptime >= BLOCKCHAIN_CONSTANTS.VALIDATOR.MIN_VALIDATOR_UPTIME &&
            voteParticipation >=
              BLOCKCHAIN_CONSTANTS.VALIDATOR.MIN_VOTE_PARTICIPATION &&
            blockProduction >=
              BLOCKCHAIN_CONSTANTS.VALIDATOR.MIN_BLOCK_PRODUCTION &&
            slashingHistory.length === 0 // No slashing history
          ) {
            validators.push({
              ...validator,
              metrics: {
                uptime,
                voteParticipation,
                blockProduction,
              },
            });
          }
        } catch (parseError) {
          Logger.error('Failed to parse validator data:', parseError);
          continue;
        }
      }

      // Sort by voting participation and block production
      return validators.sort(
        (a, b) =>
          b.metrics.voteParticipation - a.metrics.voteParticipation ||
          b.metrics.blockProduction - a.metrics.blockProduction,
      );
    } catch (error) {
      Logger.error('Failed to get validators:', error);
      return [];
    }
  }

  /**
   * Update a validator's reputation
   * @param address Validator address
   * @param update Reputation update
   * @returns Promise<void>
   */
  async updateValidatorReputation(
    address: string,
    update: {
      reputation: number;
      lastUpdate: number;
      reason: string;
      change: number;
    },
  ): Promise<void> {
    try {
      const key = `validator:${address}`;
      const validator = JSON.parse(await this.db.get(key));

      validator.reputation = update.reputation;
      validator.reputationHistory = validator.reputationHistory || [];
      validator.reputationHistory.push({
        timestamp: update.lastUpdate,
        change: update.change,
        reason: update.reason,
        newValue: update.reputation,
      });

      await this.db.put(key, JSON.stringify(validator));
    } catch (error) {
      Logger.error('Failed to update validator reputation:', error);
      throw error;
    }
  }

  /**
   * Get a validator's uptime
   * @param address Validator address
   * @returns Promise<number> Uptime
   */
  async getValidatorUptime(address: string): Promise<number> {
    try {
      const cacheKey = `validator_uptime:${address}`;
      const cached = this.validatorMetricsCache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
      // Try to get the uptime directly (provided by mock during tests)
      const value = await this.db.get(cacheKey);
      const uptime = parseFloat(value);
      this.validatorMetricsCache.set(cacheKey, uptime, { ttl: this.CACHE_TTL });
      return uptime;
    } catch (error) {
      // Fallback: return default value if not set
      Logger.error('Failed to get validator uptime:', error);
      return 0;
    }
  }

  /**
   * Get a validator's vote participation
   * @param address Validator address
   * @returns Promise<number> Vote participation
   */
  async getVoteParticipation(address: string): Promise<number> {
    try {
      const cacheKey = `vote_participation:${address}`;
      const cached = this.validatorMetricsCache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
      const value = await this.db.get(cacheKey);
      const participation = parseFloat(value);
      this.validatorMetricsCache.set(cacheKey, participation, { ttl: this.CACHE_TTL });
      return participation;
    } catch (error) {
      Logger.error('Failed to get validator vote participation:', error);
      return 0;
    }
  }

  /**
   * Get a validator's block production
   * @param address Validator address
   * @returns Promise<number> Block production
   */
  async getBlockProduction(address: string): Promise<number> {
    try {
      const cacheKey = `block_production:${address}`;
      const cached = this.validatorMetricsCache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
      // Use direct get from db (mock returns '0.95' in tests)
      const value = await this.db.get(cacheKey);
      const production = parseFloat(value);
      this.validatorMetricsCache.set(cacheKey, production, { ttl: this.CACHE_TTL });
      return production;
    } catch (error) {
      Logger.error('Failed to get validator block production:', error);
      return 0;
    }
  }

  /**
   * Get a validator's slashing history
   * @param address Validator address
   * @returns Promise<Array<{ timestamp: number; reason: string }>> Slashing history
   */
  async getSlashingHistory(
    address: string,
  ): Promise<Array<{ timestamp: number; reason: string }>> {
    try {
      const cacheKey = `slashing_history:${address}`;
      const cached = this.slashingHistoryCache.get(cacheKey);
      if (cached !== undefined) {
        this.slashingHistoryCache.set(cacheKey, cached, {
          ttl: this.CACHE_TTL,
        });
        return cached;
      }

      const history: Array<{ timestamp: number; reason: string }> = [];

      // Get all slashing events for this validator
      for await (const [, value] of this.db.iterator({
        gte: `slash:${address}:`,
        lte: `slash:${address}:\xFF`,
      })) {
        const slashEvent = JSON.parse(value);
        history.push({
          timestamp: slashEvent.timestamp,
          reason: slashEvent.reason,
        });
      }

      // Sort by timestamp descending
      history.sort((a, b) => b.timestamp - a.timestamp);

      this.slashingHistoryCache.set(cacheKey, history, { ttl: 300000 });
      return history;
    } catch (error) {
      Logger.error(`Failed to get slashing history for ${address}:`, error);
      return [];
    }
  }

  /**
   * Get a validator's expected block count
   * @param address Validator address
   * @returns Promise<number> Expected block count
   */
  private async getExpectedBlockCount(address: string): Promise<number> {
    try {
      const validator = await this.getValidator(address);
      if (!validator) return 0;

      // Consider multiple factors for block production rights:
      const metrics = {
        // 1. PoW contribution (40%) - measured by hash power contribution
        powScore: await this.getPowContribution(address),

        // 2. Token holder votes (40%) - direct voting weight from token holders
        voteWeight: await this.getTokenHolderVotes(address),

        // 3. Historical reliability (20%) - uptime, previous blocks, etc
        reliabilityScore: await this.getValidatorReliability(address),
      };

      // Calculate composite score (0-1)
      const compositeScore =
        metrics.powScore * 0.4 +
        metrics.voteWeight * 0.4 +
        metrics.reliabilityScore * 0.2;

      // Expected blocks out of 1000 based on composite score
      return Math.floor(1000 * compositeScore);
    } catch (error) {
      Logger.error(
        `Failed to calculate expected block count for ${address}:`,
        error,
      );
      return 0;
    }
  }

  /**
   * Get a validator's hash power contribution
   * @param address Validator address
   * @returns Promise<number> Hash power contribution
   */
  private async getPowContribution(address: string): Promise<number> {
    // Calculate normalized hash power contribution (0-1)
    const hashPower = await this.getValidatorHashPower(address);
    const totalHashPower = await this.getTotalNetworkHashPower();
    return hashPower / totalHashPower;
  }

  /**
   * Get a validator's token holder votes
   * @param address Validator address
   * @returns Promise<number> Token holder votes
   */
  private async getTokenHolderVotes(address: string): Promise<number> {
    // Get direct votes from token holders
    const validatorVotes = await this.getVotesForValidator(address);
    const totalVotes = (await this.votingDb?.getTotalVotes()) || 0;
    return validatorVotes / totalVotes;
  }

  /**
   * Get a validator's reliability
   * @param address Validator address
   * @returns Promise<number> Reliability
   */
  private async getValidatorReliability(address: string): Promise<number> {
    // Combine uptime, block production history, and other metrics
    const uptime = await this.getValidatorUptime(address);
    const blockSuccess = await this.getBlockProductionSuccess(address);
    const responseTime = await this.getAverageResponseTime(address);

    return uptime * 0.4 + blockSuccess * 0.4 + responseTime * 0.2;
  }

  /**
   * Get a validator's hash power
   * @param address Validator address
   * @returns Promise<number> Hash power
   */
  private async getValidatorHashPower(address: string): Promise<number> {
    try {
      const cacheKey = `validator_hashpower:${address}`;
      const cached = this.validatorMetricsCache.get(cacheKey);
      if (cached !== undefined) {
        this.validatorMetricsCache.set(cacheKey, cached, {
          ttl: this.CACHE_TTL,
        });
        return cached;
      }

      // Get last 100 blocks mined by validator
      let totalDifficulty = BigInt(0);
      let blockCount = 0;
      const now = Date.now();
      const ONE_HOUR = 3600000;

      for await (const [, value] of this.db.iterator({
        gte: `block:miner:${address}:${now - ONE_HOUR}`,
        lte: `block:miner:${address}:${now}`,
      })) {
        const block = JSON.parse(value);
        totalDifficulty += BigInt(block.header.difficulty);
        blockCount++;
      }

      // Calculate hash power as average difficulty per block
      const hashPower =
        blockCount > 0 ? Number(totalDifficulty) / blockCount : 0;
      this.validatorMetricsCache.set(cacheKey, hashPower, { ttl: 60000 }); // 1 min cache
      return hashPower;
    } catch (error) {
      Logger.error(`Failed to get validator hash power for ${address}:`, error);
      return 0;
    }
  }

  /**
   * Get the total network hash power
   * @returns Promise<number> Total network hash power
   */
  private async getTotalNetworkHashPower(): Promise<number> {
    try {
      const cacheKey = 'network_hashpower';
      const cached = this.validatorMetricsCache.get(cacheKey);
      if (cached !== undefined) {
        this.validatorMetricsCache.set(cacheKey, cached, {
          ttl: this.CACHE_TTL,
        });
        return cached;
      }

      // Get last 100 blocks network-wide
      let totalDifficulty = BigInt(0);
      let blockCount = 0;
      const now = Date.now();
      const ONE_HOUR = 3600000;

      for await (const [, value] of this.db.iterator({
        gte: `block:timestamp:${now - ONE_HOUR}`,
        lte: `block:timestamp:${now}`,
      })) {
        const block = JSON.parse(value);
        totalDifficulty += BigInt(block.header.difficulty);
        blockCount++;
      }

      const networkHashPower =
        blockCount > 0 ? Number(totalDifficulty) / blockCount : 0;
      this.validatorMetricsCache.set(cacheKey, networkHashPower, {
        ttl: 60000,
      });
      return networkHashPower;
    } catch (error) {
      Logger.error('Failed to get network hash power:', error);
      return 0;
    }
  }

  /**
   * Get a validator's block production success
   * @param address Validator address
   * @returns Promise<number> Block production success
   */
  private async getBlockProductionSuccess(address: string): Promise<number> {
    try {
      const cacheKey = `block_success:${address}`;
      const cached = this.validatorMetricsCache.get(cacheKey);
      if (cached !== undefined) {
        this.validatorMetricsCache.set(cacheKey, cached, {
          ttl: this.CACHE_TTL,
        });
        return cached;
      }

      let successfulBlocks = 0;
      let totalAttempts = 0;
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000;

      // Count successful blocks and failed attempts
      for await (const [, value] of this.db.iterator({
        gte: `block_attempt:${address}:${now - ONE_DAY}`,
        lte: `block_attempt:${address}:${now}`,
      })) {
        const attempt = JSON.parse(value);
        totalAttempts++;
        if (attempt.success) successfulBlocks++;
      }

      const successRate =
        totalAttempts > 0 ? successfulBlocks / totalAttempts : 0;
      this.validatorMetricsCache.set(cacheKey, successRate, { ttl: 300000 });
      return successRate;
    } catch (error) {
      Logger.error(
        `Failed to get block production success for ${address}:`,
        error,
      );
      return 0;
    }
  }

  /**
   * Get a validator's average response time
   * @param address Validator address
   * @returns Promise<number> Average response time
   */
  private async getAverageResponseTime(address: string): Promise<number> {
    try {
      const cacheKey = `response_time:${address}`;
      const cached = this.validatorMetricsCache.get(cacheKey);
      if (cached !== undefined) {
        this.validatorMetricsCache.set(cacheKey, cached, {
          ttl: this.CACHE_TTL,
        });
        return cached;
      }

      let totalResponseTime = 0;
      let responseCount = 0;
      const now = Date.now();
      const ONE_HOUR = 3600000;

      // Calculate average response time from heartbeats
      for await (const [, value] of this.db.iterator({
        gte: `validator_heartbeat:${address}:${now - ONE_HOUR}`,
        lte: `validator_heartbeat:${address}:${now}`,
      })) {
        const heartbeat = JSON.parse(value);
        if (heartbeat.responseTime) {
          totalResponseTime += heartbeat.responseTime;
          responseCount++;
        }
      }

      // Normalize to 0-1 range where 1 is best (lowest response time)
      const avgResponseTime =
        responseCount > 0 ? totalResponseTime / responseCount : 0;
      const normalizedScore = Math.max(
        0,
        Math.min(1, 1 - avgResponseTime / 1000),
      ); // Assuming 1000ms is worst acceptable

      this.validatorMetricsCache.set(cacheKey, normalizedScore, { ttl: 60000 });
      return normalizedScore;
    } catch (error) {
      Logger.error(
        `Failed to get average response time for ${address}:`,
        error,
      );
      return 0;
    }
  }

  /**
   * Get a validator's votes
   * @param address Validator address
   * @returns Promise<number> Votes
   */
  private async getVotesForValidator(address: string): Promise<number> {
    try {
      const cacheKey = `validator_votes:${address}`;
      const cached = this.validatorMetricsCache.get(cacheKey);
      if (cached !== undefined) {
        this.validatorMetricsCache.set(cacheKey, cached, {
          ttl: this.CACHE_TTL,
        });
        return cached;
      }

      let totalVotingPower = BigInt(0);
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000;

      // Sum up voting power from token holders
      for await (const [, value] of this.db.iterator({
        gte: `vote:validator:${address}:${now - ONE_DAY}`,
        lte: `vote:validator:${address}:${now}`,
      })) {
        const vote = JSON.parse(value);
        totalVotingPower += BigInt(vote.votingPower);
      }

      const votingScore =
        Number(totalVotingPower) / Number(await this.getTotalVotingPower());
      this.validatorMetricsCache.set(cacheKey, votingScore, { ttl: 300000 });
      return votingScore;
    } catch (error) {
      Logger.error(`Failed to get votes for validator ${address}:`, error);
      return 0;
    }
  }

  /**
   * Get the total voting power
   * @returns Promise<bigint> Total voting power
   */
  private async getTotalVotingPower(): Promise<bigint> {
    try {
      const cacheKey = 'total_voting_power';
      const cached = this.votingPowerCache.get(cacheKey);
      if (cached !== undefined) {
        this.votingPowerCache.set(cacheKey, cached, { ttl: this.CACHE_TTL });
        return BigInt(cached);
      }

      let total = BigInt(0);
      for await (const [, value] of this.db.iterator({
        gte: 'token_holder:',
        lte: 'token_holder:\xFF',
      })) {
        const holder = JSON.parse(value);
        total += BigInt(holder.balance);
      }

      this.votingPowerCache.set(cacheKey, total, { ttl: this.CACHE_TTL });
      return total;
    } catch (error) {
      Logger.error('Failed to get total voting power:', error);
      return BigInt(0);
    }
  }

  /**
   * Get voting periods
   * @param since Start time
   * @returns Promise<VotingPeriod[]> Voting periods
   */
  private async getVotingPeriods(since: number): Promise<VotingPeriod[]> {
    const periods: VotingPeriod[] = [];
    for await (const [, value] of this.db.iterator({
      gte: `voting_period:${since}`,
      lte: `voting_period:${Date.now()}`,
    })) {
      periods.push(JSON.parse(value));
    }
    return periods;
  }

  /**
   * Get a vote in a specific period
   * @param address Validator address
   * @param periodId Voting period ID
   * @returns Promise<Vote | null> Vote or null if not found
   */
  private async getVoteInPeriod(
    address: string,
    periodId: number,
  ): Promise<Vote | null> {
    try {
      const vote = await this.db.get(`vote:${periodId}:${address}`);
      return JSON.parse(vote);
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return null;
      throw error;
    }
  }

  /**
   * Get a validator by its address
   * @param address Validator address
   * @returns Promise<Validator | null> Validator or null if not found
   */
  async getValidator(address: string): Promise<Validator | null> {
    try {
      const key = `validator:${address}`;
      const data = await this.db.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return null;
      Logger.error(`Failed to get validator ${address}:`, error);
      return null;
    }
  }

  /**
   * Get the total number of validators
   * @returns Promise<number> Total number of validators
   */
  async getValidatorCount(): Promise<number> {
    try {
      let count = 0;
      const iterator = this.db.iterator({
        gte: 'validator:',
        lte: 'validator:\xFF',
      });

      for await (const [key, value] of iterator) {
        try {
          const validator = JSON.parse(value);
          if (validator && typeof validator === 'object') {
            count++;
          }
        } catch (parseError) {
          Logger.error(`Invalid validator data for ${key}:`, parseError);
          continue;
        }
      }
      return count;
    } catch (error: unknown) {
      Logger.error(
        'Failed to get validator count:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      return 0;
    }
  }

  /**
   * Get the last N blocks
   * @param n Number of blocks to get
   * @returns Promise<Block[]> Last N blocks
   */
  async getLastNBlocks(n: number): Promise<Block[]> {
    try {
      const currentHeight = await this.getCurrentHeight();
      const startHeight = Math.max(0, currentHeight - n);

      // Use existing getBlockRange method
      const lastBlocks = await this.getBlocksFromHeight(
        startHeight,
        currentHeight,
      );

      // Sort by height descending to ensure correct order
      return lastBlocks.sort((a, b) => b.header.height - a.header.height);
    } catch (error) {
      Logger.error('Failed to get last N blocks:', error);
      return [];
    }
  }

  /**
   * Get the nonce for an account
   * @param address Account address
   * @returns Promise<number> Nonce
   */
  async getAccountNonce(address: string): Promise<number> {
    if (!address) {
      throw new Error('Address is required');
    }
    try {
      const nonce = await this.db.get(`nonce:${address}`);
      return parseInt(nonce) || 0;
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return 0;
      Logger.error('Failed to get account nonce:', error);
      throw error;
    }
  }

  /**
   * Get the block hash by its height
   * @param height Block height
   * @returns Promise<string | null> Block hash or null if not found
   */
  async getBlockHashByHeight(height: number): Promise<string | null> {
    try {
      const block = await this.db.get(`block:height:${height}`);
      return JSON.parse(block).hash;
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return null;
      Logger.error('Failed to get block hash by height:', error);
      throw error;
    }
  }

  /**
   * Set the chain head
   * @param height Block height
   * @returns Promise<void>
   */
  async setChainHead(height: number): Promise<void> {
    try {
      const blockHash = await this.getBlockHashByHeight(height);
      await this.db.put(
        'chain:head',
        JSON.stringify({
          height,
          hash: blockHash,
          timestamp: Date.now(),
        }),
      );
    } catch (error) {
      Logger.error('Failed to set chain head:', error);
      throw error;
    }
  }

  /**
   * Execute a database transaction
   * @param callback Callback function to execute
   * @returns Promise<T> Result of the callback
   */
  async executeTransaction<T>(callback: () => Promise<T>): Promise<T> {
    return await this.mutex.runExclusive(async () => {
      try {
        await this.startTransaction();
        const result = await callback();
        await this.commitTransaction();
        return result;
      } catch (error) {
        await this.rollbackTransaction();
        throw error;
      }
    });
  }

  /**
   * Create a snapshot
   * @returns Promise<string> Snapshot ID
   */
  public async createSnapshot(): Promise<string> {
    const snapshotId = Date.now().toString();
    await this.put(
      `snapshot:${snapshotId}`,
      JSON.stringify({
        chainHead: await this.getChainHead(),
        timestamp: Date.now(),
      }),
    );
    return snapshotId;
  }

  /**
   * Commit a snapshot
   * @param snapshotId Snapshot ID
   * @returns Promise<void>
   */
  public async commitSnapshot(snapshotId: string): Promise<void> {
    await this.del(`snapshot:${snapshotId}`);
  }

  /**
   * Rollback a snapshot
   * @param snapshotId Snapshot ID
   * @returns Promise<void>
   */
  public async rollbackSnapshot(snapshotId: string): Promise<void> {
    const snapshot = JSON.parse(await this.get(`snapshot:${snapshotId}`));
    await this.setChainHead(snapshot.chainHead);
    await this.del(`snapshot:${snapshotId}`);
  }

  /**
   * Get the chain head
   * @returns Promise<number> Chain head height
   */
  async getChainHead(): Promise<number> {
    try {
      const head = await this.get('chain:head');
      return head ? JSON.parse(head).height : 0;
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return 0;
      throw error;
    }
  }

  /**
   * Delete a key from the database
   * @param key Key to delete
   * @returns Promise<void>
   */
  async del(key: string): Promise<void> {
    try {
      await this.db.del(key);
    } catch (error) {
      Logger.error(`Failed to delete key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get a validator's performance
   * @param address Validator address
   * @param blockCount Number of blocks to consider
   * @returns Promise<ValidatorPerformance> Validator performance
   */
  async getValidatorPerformance(
    address: string,
    blockCount: number,
  ): Promise<ValidatorPerformance> {
    try {
      let successfulValidations = 0;
      let totalOpportunities = 0;
      const currentHeight = await this.getCurrentHeight();
      const startHeight = currentHeight - blockCount;

      for await (const [, value] of this.db.iterator({
        gte: `validator_performance:${address}:${startHeight}`,
        lte: `validator_performance:${address}:${currentHeight}`,
      })) {
        const record = JSON.parse(value);
        successfulValidations += record.successful ? 1 : 0;
        totalOpportunities++;
      }

      return { successfulValidations, totalOpportunities };
    } catch (error) {
      Logger.error('Failed to get validator performance:', error);
      return { successfulValidations: 0, totalOpportunities: 0 };
    }
  }

  /**
   * Get a validator's stats
   * @param address Validator address
   * @returns Promise<ValidatorStats> Validator stats
   */
  async getValidatorStats(address: string): Promise<ValidatorStats> {
    try {
      const value = await this.db.get(`validator_stats:${address}`);
      return JSON.parse(value);
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error)
        return {
          currentLoad: 0,
          maxCapacity: 100,
        };
      throw error;
    }
  }

  /**
   * Get a UTXO by its transaction ID and output index
   * @param txId Transaction ID
   * @param outputIndex Output index
   * @returns Promise<UTXO | null> UTXO or null if not found
   */
  async getUTXO(txId: string, outputIndex: number): Promise<UTXO | null> {
    try {
      const utxoData = await this.get(`utxo:${txId}:${outputIndex}`);
      if (!utxoData) return null;
      const parsedUTXO = JSON.parse(utxoData);
      if (parsedUTXO && parsedUTXO.amount !== undefined) {
        parsedUTXO.amount = BigInt(parsedUTXO.amount);
      }
      return parsedUTXO;
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return null;
      Logger.error('Failed to get UTXO:', error);
      throw error;
    }
  }

  /**
   * Start a database transaction
   * @returns Promise<void>
   */
  public async beginTransaction(): Promise<void> {
    if (this.transaction) {
      throw new Error('Transaction already in progress');
    }
    this.abstractTransaction = [];
  }

  /**
   * Commit a database transaction
   * @returns Promise<void>
   */
  public async commit(): Promise<void> {
    if (!this.transaction) {
      throw new Error('No transaction in progress');
    }
    try {
      if (this.abstractTransaction) {
        await this.db.batch(this.abstractTransaction);
      }
      this.transaction = null;
    } catch (error: unknown) {
      Logger.error(
        'Failed to commit transaction:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      await this.rollback();
      throw error;
    }
  }

  /**
   * Rollback a database transaction
   * @returns Promise<void>
   */
  public async rollback(): Promise<void> {
    if (!this.transaction) {
      throw new Error('No transaction in progress');
    }
    this.transaction = null;
  }

  /**
   * Add a transaction operation
   * @param operation Transaction operation
   */
  protected addToTransaction(operation: AbstractBatch): void {
    if (!this.transaction) {
      throw new Error('No transaction in progress');
    }
    if (this.abstractTransaction) {
      this.abstractTransaction.push(operation);
    }
  }

  /**
   * Sync a shard
   * @param shardId Shard ID
   * @param data Data to sync
   * @returns Promise<void>
   */
  @retry({
    maxAttempts: 3,
    delay: 1000,
    exponentialBackoff: true,
  })
  public async syncShard(shardId: number, data: string[]): Promise<void> {
    const perfMarker = this.performanceMonitor.start('sync_shard');
    const release = await this.shardMutex.acquire();

    try {
      // Validate inputs
      if (typeof shardId !== 'number' || shardId < 0) {
        throw new Error('Invalid shard ID');
      }
      if (!Array.isArray(data)) {
        throw new Error('Invalid shard data');
      }

      // Calculate checksum
      const checksum = this.calculateChecksum(data);

      // Check if update is needed by comparing checksums
      const existingShard = await this.getShardData(shardId);
      if (existingShard && existingShard.checksum === checksum) {
        Logger.debug(`Shard ${shardId} already up to date`);
        return;
      }

      // Prepare shard data
      const shardData: ShardData = {
        data,
        lastSync: Date.now(),
        version: this.SHARD_VERSION,
        checksum,
        metadata: {
          size: data.length,
          compressed: false,
          createdAt: existingShard?.metadata.createdAt || Date.now(),
          updatedAt: Date.now(),
        },
      };

      // Compress if data is large
      if (JSON.stringify(data).length > 1024 * 100) {
        // 100KB
        shardData.data = await this.compressData(data);
        shardData.metadata.compressed = true;
      }

      // Store shard data
      await this.db.put(`shard:${shardId}`, JSON.stringify(shardData));

      // Update metrics
      if (this.metricsCollector) {
        this.metricsCollector.gauge('shard_size', data.length);
        this.metricsCollector.increment('shard_sync_success');
      }

      Logger.info(`Shard ${shardId} synced successfully`, {
        size: data.length,
        checksum,
      });
    } catch (error: unknown) {
      if (this.metricsCollector) {
        this.metricsCollector.increment('shard_sync_failure');
      }
      Logger.error(
        `Failed to sync shard ${shardId}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );

      if (this.auditManager) {
        this.auditManager.log(AuditEventType.SHARD_SYNC_FAILED, {
          shardId,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
        });
      }

      throw error;
    } finally {
      this.performanceMonitor.end(perfMarker);
      release();
    }
  }

  private async getShardData(shardId: number): Promise<ShardData | null> {
    try {
      const data = await this.db.get(`shard:${shardId}`);
      return data ? JSON.parse(data) : null;
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return null;
      throw error;
    }
  }

  private calculateChecksum(data: string[]): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  private async compressData(data: string[]): Promise<string[]> {
    const gzipAsync = promisify(gzip);
    const compressedData = await Promise.all(
      data.map(async (item) => {
        const compressed = await gzipAsync(Buffer.from(item));
        return compressed.toString('base64');
      }),
    );
    return compressedData;
  }

  @retry({
    maxAttempts: 3,
    delay: 1000,
    exponentialBackoff: true,
  })
  public async getRecentTransactions(
    limit = 100,
  ): Promise<Transaction[]> {
    const perfMarker = this.performanceMonitor.start('get_recent_transactions');

    try {
      // Input validation
      if (limit <= 0 || limit > 1000) {
        throw new Error('Invalid limit: must be between 1 and 1000');
      }

      // Get latest block height
      const currentHeight = await this.getCurrentHeight();
      const startHeight = Math.max(0, currentHeight - 100); // Look back 100 blocks

      // Query transactions from recent blocks
      const transactions: Transaction[] = [];
      for (
        let height = currentHeight;
        height > startHeight && transactions.length < limit;
        height--
      ) {
        const block = await this.getBlockByHeight(height);
        if (block?.transactions) {
          transactions.push(...block.transactions);
        }
      }

      // Sort by timestamp descending and limit
      const recentTxs = transactions
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      this.metricsCollector?.gauge(
        'recent_transactions_count',
        recentTxs.length,
      );
      return recentTxs;
    } catch (error) {
      Logger.error('Failed to get recent transactions:', error);
      this.metricsCollector?.increment('recent_transactions_error');
      throw error;
    } finally {
      this.performanceMonitor.end(perfMarker);
    }
  }

  public async getLastAccess(id: string): Promise<number> {
    try {
      const data = await this.db.get(`access:${id}`);
      return data ? parseInt(data) : 0;
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return 0;
      throw error;
    }
  }

  public async updateLastAccess(id: string): Promise<void> {
    await this.db.put(`access:${id}`, Date.now().toString());
  }

  public async startTransaction(): Promise<void> {
    if (this.transaction) {
      throw new Error('Transaction already in progress');
    }
    // Acquire lock only if no transaction is in progress.
    this._transactionLockRelease = await this.transactionLock.acquire();
    try {
      this.transaction = this.db.batch();
      this.transactionOperations = [];
      this.transactionStartTime = Date.now();
      // Start transaction timeout monitor
      this.startTransactionMonitor();
    } catch (error) {
      if (this._transactionLockRelease) {
        this._transactionLockRelease();
      }
      this._transactionLockRelease = undefined;
      throw error;
    }
  }

  private startTransactionMonitor(): void {
    const TRANSACTION_TIMEOUT = 30000; // 30 seconds

    setTimeout(async () => {
      if (
        this.transaction &&
        Date.now() - (this.transactionStartTime ?? 0) > TRANSACTION_TIMEOUT
      ) {
        Logger.warn('Transaction timeout detected, initiating rollback');
        await this.rollbackTransaction();
      }
    }, TRANSACTION_TIMEOUT);
  }

  public async commitTransaction(): Promise<void> {
    if (!this.transaction) {
      throw new Error('No active transaction');
    }

    try {
      await this.mutex.runExclusive(async () => {
        // Wrap the batch write in a Promise to catch errors.
        await new Promise<void>((resolve, reject) => {
          this.transaction!.write((error) => {
            if (error) {
              Logger.error('Transaction write failed:', error);
              return reject(new Error(`Transaction write failed: ${error.message}`));
            }
            resolve();
          });
        });
      });
      await this.persistOperations(this.transactionOperations);

      // Only clear after successful persistence
      this.transaction = null;
      this.transactionOperations = [];
    } catch (error: unknown) {
      await this.rollbackTransaction();
      throw new Error(
        `Transaction commit failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      // Release the transaction lock whether commit succeeded or not.
      if (this._transactionLockRelease) {
        this._transactionLockRelease();
      }
      this._transactionLockRelease = undefined;
    }
  }

  public async rollbackTransaction(): Promise<void> {
    try {
      if (this.transaction) {
        await this.mutex.runExclusive(async () => {
          // Clear any pending operations
          this.transaction = null;
          this.transactionOperations = [];

          // Invalidate affected caches
          await this.invalidateAffectedCaches();
        });
      }
    } catch (error: unknown) {
      Logger.error('Transaction rollback failed:', error);
      throw new Error(
        `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      // Always release the transaction lock.
      if (this._transactionLockRelease) {
        this._transactionLockRelease();
      }
      this._transactionLockRelease = undefined;
    }
  }

  private async invalidateAffectedCaches(): Promise<void> {
    const affectedKeys = this.transactionOperations.map((op) => op.key);
    for (const key of affectedKeys) {
      if (key.startsWith('transactions:')) {
        this.transactionCache.delete(key);
      } else if (key.startsWith('block:')) {
        this.blockCache.delete(key);
      }
    }
  }

  private async persistOperations(operations: AbstractBatch[]): Promise<void> {
    if (!operations.length) return;

    try {
      // Validate operations before persisting
      this.validateOperations(operations);

      // Split into smaller batches if needed
      const BATCH_SIZE = 1000;
      for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        const batch = operations.slice(i, i + BATCH_SIZE);
        await this.db.batch(batch);

        // Update metrics
        this.metricsCollector?.gauge('batch_operations_count', batch.length);
      }

      // Audit log
      this.auditManager?.log(AuditEventType.TRANSACTION_COMMIT, {
        operationCount: operations.length,
        timestamp: Date.now(),
      });
    } catch (error: unknown) {
      Logger.error('Failed to persist operations:', error);
      throw new Error(
        `Operation persistence failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private validateOperations(operations: AbstractBatch[]): void {
    for (const op of operations) {
      if (!op.key || typeof op.key !== 'string') {
        throw new Error(`Invalid operation key: ${op.key}`);
      }
      if (op.type === 'put' && !op.value) {
        throw new Error(`Missing value for put operation on key: ${op.key}`);
      }
    }
  }

  async getSeeds(): Promise<
    Array<{
      address: string;
      services: number;
      lastSeen: number;
      attempts: number;
      failures: number;
      latency: number;
      score: number;
    }>
  > {
    try {
      const seeds = [];
      for await (const [, value] of this.db.iterator({
        gte: 'seed:',
        lte: 'seed:\xFF',
      })) {
        seeds.push(JSON.parse(value));
      }
      return seeds;
    } catch (error) {
      Logger.error('Failed to get seeds:', error);
      return [];
    }
  }

  async saveSeeds(seeds: Array<[string, unknown]>): Promise<void> {
    try {
      const batch = this.db.batch();
      for (const [address, seed] of seeds) {
        batch.put(`seed:${address}`, JSON.stringify(seed));
      }
      await batch.write();
    } catch (error) {
      Logger.error('Failed to save seeds:', error);
      throw error;
    }
  }

  public async getActiveValidators(): Promise<{ address: string }[]> {
    try {
      const validators = [];
      for await (const [, value] of this.db.iterator({
        gte: 'validator:',
        lte: 'validator:\xFF',
      })) {
        const validator = JSON.parse(value);
        if (validator.active && validator.lastSeen > Date.now() - 3600000) {
          // Active in last hour
          validators.push({ address: validator.address });
        }
      }
      return validators;
    } catch (error) {
      Logger.error('Failed to get active validators:', error);
      return [];
    }
  }

  public async getTagHolderCount(): Promise<number> {
    try {
      const holders = new Set<string>();
      for await (const [, rawValue] of this.db.iterator({
        gte: 'utxo:',
        lte: 'utxo:\xFF',
      })) {
        const utxo = JSON.parse(rawValue);
        if (!utxo.spent && utxo.tags?.length > 0) {
          holders.add(utxo.address);
        }
      }
      return holders.size;
    } catch (error) {
      Logger.error('Failed to get tag holder count:', error);
      return 0;
    }
  }

  public async getTagDistribution(): Promise<number> {
    try {
      const tagCounts = new Map<string, number>();
      for await (const [, rawValue] of this.db.iterator({
        gte: 'utxo:',
        lte: 'utxo:\xFF',
      })) {
        const utxo = JSON.parse(rawValue);
        if (!utxo.spent && utxo.tags?.length > 0) {
          utxo.tags.forEach((tag: string) => {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          });
        }
      }

      // Calculate Gini coefficient for tag distribution
      const values = Array.from(tagCounts.values());
      return this.calculateGiniCoefficient(values);
    } catch (error) {
      Logger.error('Failed to get tag distribution:', error);
      return 0;
    }
  }

  private calculateGiniCoefficient(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const totalDiff = values.reduce(
      (sum, val) =>
        sum + values.reduce((diff, other) => diff + Math.abs(val - other), 0),
      0,
    );
    return totalDiff / (2 * values.length * values.length * mean);
  }

  async getBlockByHash(hash: string): Promise<Block | null> {
    try {
      const block = await this.db.get(`block:${hash}`);
      return block ? JSON.parse(block) : null;
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return null;
      Logger.error('Failed to get block by hash:', error);
      throw error;
    }
  }

  /**
   * Get all blocks at a specific height
   * @param height Block height
   * @returns Promise<Block[]> Blocks at the specified height
   */
  async getBlocksByHeight(height: number): Promise<Block[]> {
    try {
      const blocks: Block[] = [];
      for await (const [, value] of this.db.iterator({
        gte: `block:height:${height}`,
        lte: `block:height:${height}\xFF`,
      })) {
        blocks.push(JSON.parse(value));
      }
      return blocks;
    } catch (error) {
      Logger.error(`Failed to get blocks at height ${height}:`, error);
      return [];
    }
  }

  public iterator(options: { gte: string; lte: string }) {
    return this.db.iterator(options);
  }

  async getVotingEndHeight(): Promise<number> {
    try {
      const cacheKey = 'voting_end_height';
      const cached = this.heightCache.get(cacheKey);
      if (cached !== undefined && typeof cached === 'string') {
        return parseInt(cached);
      }

      // Get from database
      const height = await this.db.get('end_height');
      const endHeight = parseInt(height) || 0;

      // Cache the result
      await this.heightCache.set(cacheKey, endHeight.toString(), {
        ttl: BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL,
      });

      return endHeight;
    } catch (error: unknown) {
      Logger.error('Failed to get voting end height:', error);
      if (error instanceof Error && 'notFound' in error) return 0;
      throw error;
    }
  }

  async getVotingStartHeight(): Promise<number> {
    try {
      const cacheKey = 'voting_start_height';
      const cached = this.heightCache.get(cacheKey);
      if (cached !== undefined && typeof cached === 'string') {
        return parseInt(cached);
      }

      // Get from database
      const height = await this.db.get('start_height');
      const startHeight = parseInt(height) || 0;

      // Cache the result
      await this.heightCache.set(cacheKey, startHeight.toString(), {
        ttl: BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL,
      });

      return startHeight;
    } catch (error: unknown) {
      Logger.error('Failed to get voting start height:', error);
      if (error instanceof Error && 'notFound' in error) return 0;
      throw error;
    }
  }

  public getTransactionExecutor<T>(): (
    operation: () => Promise<T>,
  ) => Promise<T> {
    return (operation: () => Promise<T>) => this.mutex.runExclusive(operation);
  }

  /**
   * Updates block difficulty in database
   */
  public async updateDifficulty(
    blockHash: string,
    difficulty: number,
  ): Promise<void> {
    try {
      await this.db.put(`difficulty:${blockHash}`, difficulty.toString());
    } catch (error) {
      Logger.error('Failed to update difficulty:', error);
      throw error;
    }
  }

  async lockTransaction(txId: string): Promise<() => Promise<void>> {
    if (!this.transactionLocks.has(txId)) {
      this.transactionLocks.set(txId, new Mutex());
    }
    const mutex = this.transactionLocks.get(txId)!;
    const release = await mutex.acquire();
    return async () => {
      release();
    };
  }

  async unlockTransaction(txId: string): Promise<void> {
    const mutex = this.transactionLocks.get(txId);
    if (mutex) {
      this.transactionLocks.delete(txId);
    }
  }

  async markUTXOPending(txId: string, outputIndex: number): Promise<void> {
    try {
      const key = `utxo:${txId}:${outputIndex}`;
      const utxo = await this.db.get(key);
      if (utxo) {
        const updatedUtxo = { ...JSON.parse(utxo), pending: true };
        await this.db.put(key, JSON.stringify(updatedUtxo));
      }
    } catch (error) {
      Logger.error('Failed to mark UTXO as pending:', error);
      throw error;
    }
  }

  /**
   * Get block height by hash
   * @param hash Block hash
   * @returns Promise<number | null> Block height or null if not found
   */
  async getBlockHeight(hash: string): Promise<number | null> {
    try {
      const block = await this.getBlock(hash);
      return block ? block.header.height : null;
    } catch (error) {
      Logger.error('Failed to get block height:', error);
      return null;
    }
  }

  public async hasBlock(hash: string): Promise<boolean> {
    try {
      const key = `block:${hash}`;
      const cached = this.cache.get(key);
      if (cached) return true;

      await this.db.get(key);
      return true;
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return false;
      throw error;
    }
  }

  public async hasTransaction(hash: string): Promise<boolean> {
    try {
      const key = `tx:${hash}`;
      const cached = this.transactionCache.get(key);
      if (cached) return true;

      await this.db.get(key);
      return true;
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return false;
      throw error;
    }
  }

  async getHeaders(
    locator: string[],
    hashStop: string,
  ): Promise<BlockHeader[]> {
    try {
      const headers = [];
      for await (const [, value] of this.db.iterator({
        gte: `header:${locator[0]}`,
        lte: `header:${hashStop}`,
        limit: 1000,
      })) {
        headers.push(JSON.parse(value));
      }
      return headers;
    } catch (error: unknown) {
      Logger.error('Failed to get headers:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  async getBlocks(locator: string[], hashStop: string): Promise<Block[]> {
    try {
      const blocks = [];
      for await (const [, value] of this.db.iterator({
        gte: `block:${locator[0]}`,
        lte: `block:${hashStop}`,
        limit: 1000,
      })) {
        blocks.push(JSON.parse(value));
      }
      return blocks;
    } catch (error: unknown) {
      Logger.error('Failed to get blocks:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /* Added helper method for JSON stringification with BigInt support */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private jsonStringify(obj: any): string {
    return JSON.stringify(obj, (key, value) => typeof value === 'bigint' ? value.toString() : value);
  }

  /* Added helper method for JSON parsing with BigInt support */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private jsonParse(str: string): any {
    return JSON.parse(str, (key, value) => {
      if (typeof value === 'string' && /^\d+$/.test(value)) {
        try {
          return BigInt(value);
        } catch {
          return value;
        }
      }
      return value;
    });
  }
}
