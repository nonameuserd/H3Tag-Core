import { Level } from 'level';
import { Logger } from '@h3tag-blockchain/shared';
import { Cache } from '../scaling/cache';
import { Mutex } from 'async-mutex';
import { retry } from '../utils/retry';
import { UTXO } from '../models/utxo.model';
import { databaseConfig } from './config.database';
import { AbstractChainedBatch } from 'abstract-leveldown';

/**
 * @fileoverview UTXODatabase implements persistent storage and management of Unspent Transaction Outputs (UTXOs).
 * It provides atomic operations, caching, and efficient querying for UTXO set management with transaction support.
 *
 * @module UTXODatabase
 */

/**
 * UTXODatabase manages the UTXO set with atomic operations and caching.
 *
 * @class UTXODatabase
 *
 * @property {Level} db - LevelDB database instance
 * @property {Mutex} mutex - Mutex for synchronizing operations
 * @property {Cache<UTXO>} cache - UTXO cache with TTL
 * @property {any} batch - Current batch operation
 * @property {number} CACHE_TTL - Cache time-to-live (5 minutes)
 * @property {boolean} initialized - Database initialization status
 * @property {boolean} transactionInProgress - Transaction status flag
 *
 * @example
 * const utxoDb = new UTXODatabase('./data/utxo');
 * await utxoDb.insertUTXO(utxo);
 * const unspent = await utxoDb.getUnspentUTXOs(address);
 */

export class UTXODatabase {
  private readonly db: Level<string, UTXO | string>;
  private readonly mutex: Mutex;
  private readonly cache: Cache<UTXO>;
  private batch: AbstractChainedBatch<string, UTXO | string> | null = null;
  private readonly CACHE_TTL = 300000; // 5 minutes
  private initialized = false;
  private transactionInProgress = false;

  constructor(dbPath: string) {
    if (!dbPath) throw new Error('Database path is required');

    this.db = new Level<string, UTXO | string>(`${dbPath}/utxo`, {
      valueEncoding: 'json',
      ...databaseConfig.options,
    });

    this.mutex = new Mutex();
    this.cache = new Cache<UTXO>({
      ttl: this.CACHE_TTL,
      maxSize: 100000,
      compression: true,
    });

    this.initialize().catch((err) => {
      Logger.error('Failed to initialize UTXO database:', err);
      throw err;
    });
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await this.db.open();
      this.initialized = true;
      Logger.info('UTXO database initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize UTXO database:', error);
      throw error;
    }
  }

  private batchWrite(
    batch: AbstractChainedBatch<string, UTXO | string>,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      batch.write((error: unknown) => {
        if (error instanceof Error) reject(error);
        else resolve();
      });
    });
  }

  /**
   * Inserts a new UTXO into the database
   *
   * @async
   * @method insertUTXO
   * @param {UTXO} utxo - UTXO to insert
   * @returns {Promise<void>}
   * @throws {Error} If UTXO is invalid or already exists
   *
   * @example
   * await utxoDb.insertUTXO({
   *   txId: '0x...',
   *   outputIndex: 0,
   *   address: '0x...',
   *   amount: 1000n,
   *   spent: false
   * });
   */
  @retry({ maxAttempts: 3, delay: 1000 })
  async insertUTXO(utxo: UTXO): Promise<void> {
    if (!this.initialized) throw new Error('Database not initialized');
    if (!this.validateUTXO(utxo)) throw new Error('Invalid UTXO data');

    return await this.mutex.runExclusive(async () => {
      const key = `utxo:${utxo.txId}:${utxo.outputIndex}`;
      try {
        // Check for existing UTXO
        const existing = await this.getUTXO(utxo.txId, utxo.outputIndex);
        if (existing) {
          throw new Error('UTXO already exists');
        }

        const batch = this.batch || this.db.batch();

        batch.put(key, utxo);
        batch.put(
          `address:${utxo.address}:${utxo.txId}:${utxo.outputIndex}`,
          key,
        );

        if (!utxo.spent) {
          batch.put(`unspent:${utxo.address}:${utxo.amount}:${utxo.txId}`, key);
        }

        if (!this.batch) {
          await this.batchWrite(batch);
        }

        this.cache.set(key, utxo, { ttl: this.CACHE_TTL });

        Logger.debug('UTXO inserted successfully', {
          txId: utxo.txId,
          index: utxo.outputIndex,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        Logger.error('Failed to insert UTXO:', { error: errorMessage });
        throw new Error(`Failed to insert UTXO: ${errorMessage}`);
      }
    });
  }

  /**
   * Retrieves a UTXO by transaction ID and output index
   *
   * @async
   * @method getUTXO
   * @param {string} txId - Transaction ID
   * @param {number} outputIndex - Output index
   * @returns {Promise<UTXO | null>} UTXO if found
   *
   * @example
   * const utxo = await utxoDb.getUTXO(txId, outputIndex);
   */
  async getUTXO(txId: string, outputIndex: number): Promise<UTXO | null> {
    if (!this.initialized) throw new Error('Database not initialized');

    const key = `utxo:${txId}:${outputIndex}`;
    const cached = this.cache.get(key);
    if (cached) {
      // Refresh TTL on cache hit
      this.cache.set(key, cached, { ttl: this.CACHE_TTL });
      return cached;
    }

    try {
      const utxo = (await this.db.get(key, {
        valueEncoding: 'json',
      })) as UTXO;
      if (!utxo) return null;

      this.cache.set(key, utxo, { ttl: this.CACHE_TTL });
      return utxo;
    } catch (error: unknown) {
      if (this.isNotFoundError(error)) return null;
      Logger.error(
        'Failed to get UTXO:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw new Error('Failed to get UTXO');
    }
  }

  /**
   * Gets all unspent UTXOs for an address
   *
   * @async
   * @method getUnspentUTXOs
   * @param {string} address - Wallet address
   * @returns {Promise<UTXO[]>} Array of unspent UTXOs
   *
   * @example
   * const unspentUtxos = await utxoDb.getUnspentUTXOs(address);
   */
  async getUnspentUTXOs(address: string): Promise<UTXO[]> {
    const utxos: UTXO[] = [];
    try {
      for await (const [, value] of this.db.iterator({
        gte: `unspent:${address}:`,
        lte: `unspent:${address}:\xFF`,
      })) {
        const utxoKey = value as string;
        const utxo = await this.getUTXO(
          utxoKey.split(':')[1],
          parseInt(utxoKey.split(':')[2]),
        );
        if (utxo && !utxo.spent) utxos.push(utxo);
      }
      return utxos;
    } catch (error) {
      Logger.error('Failed to get unspent UTXOs:', error);
      throw error;
    }
  }

  /**
   * Gets all addresses with UTXOs
   *
   * @async
   * @method getAllAddresses
   * @returns {Promise<string[]>} Array of addresses
   *
   * @example
   * const addresses = await utxoDb.getAllAddresses();
   */
  async getAllAddresses(): Promise<string[]> {
    const addresses = new Set<string>();
    try {
      for await (const [key] of this.db.iterator({
        gte: 'address:',
        lte: 'address:\xFF',
      })) {
        const address = key.split(':')[1];
        addresses.add(address);
      }
      return Array.from(addresses);
    } catch (error) {
      Logger.error('Failed to get all addresses:', error);
      throw error;
    }
  }

  /**
   * Starts a new database transaction
   *
   * @async
   * @method startTransaction
   * @returns {Promise<void>}
   * @throws {Error} If transaction is already in progress
   *
   * @example
   * await utxoDb.startTransaction();
   */
  async startTransaction(): Promise<void> {
    await this.mutex.runExclusive(() => {
      if (this.transactionInProgress) {
        throw new Error('Transaction already in progress');
      }
      this.batch = this.db.batch();
      this.transactionInProgress = true;
    });
  }

  /**
   * Commits the current transaction
   *
   * @async
   * @method commitTransaction
   * @returns {Promise<void>}
   * @throws {Error} If no transaction is in progress
   *
   * @example
   * await utxoDb.commitTransaction();
   */
  async commitTransaction(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      if (!this.transactionInProgress) {
        throw new Error('No transaction in progress');
      }
      if (this.batch) {
        await this.batchWrite(this.batch);
        this.batch = null;
        this.transactionInProgress = false;
      }
    });
  }

  /**
   * Rolls back the current transaction
   *
   * @async
   * @method rollbackTransaction
   * @returns {Promise<void>}
   * @throws {Error} If no transaction is in progress
   *
   * @example
   * await utxoDb.rollbackTransaction();
   */
  async rollbackTransaction(): Promise<void> {
    await this.mutex.runExclusive(() => {
      if (!this.transactionInProgress) {
        throw new Error('No transaction in progress');
      }
      if (this.batch) {
        this.batch.clear();
        this.batch = null;
        this.transactionInProgress = false;
      }
    });
  }

  private validateUTXO(utxo: UTXO): boolean {
    return !!(
      utxo &&
      utxo.txId &&
      typeof utxo.outputIndex === 'number' &&
      utxo.address &&
      typeof utxo.amount === 'bigint' &&
      typeof utxo.spent === 'boolean'
    );
  }

  private isNotFoundError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'notFound' in error;
  }
}
