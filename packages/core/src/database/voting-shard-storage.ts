import { Transaction } from "../models/transaction.model";
import { BlockchainSchema } from "./blockchain-schema";
import { Logger } from "@h3tag-blockchain/shared";
import { retry } from "../utils/retry";
import { Cache } from "../scaling/cache";
import { Mutex } from "async-mutex";

/**
 * @fileoverview VotingShardStorage implements sharded storage for blockchain voting data.
 * It provides efficient data partitioning, caching, and atomic operations for scalable
 * vote storage across multiple shards.
 *
 * @module VotingShardStorage
 */

/**
 * VotingShardStorage manages sharded voting data with built-in caching and synchronization.
 *
 * @class VotingShardStorage
 *
 * @property {BlockchainSchema} db - Database instance
 * @property {Cache<Transaction>} cache - Transaction cache
 * @property {Mutex} mutex - Mutex for synchronizing operations
 * @property {number} CACHE_TTL - Cache time-to-live in seconds
 * @property {boolean} initialized - Storage initialization status
 *
 * @example
 * const storage = new VotingShardStorage(db);
 * await storage.saveTransaction(shardId, transaction);
 * const tx = await storage.getTransaction(shardId, hash);
 */

export class VotingShardStorage {
  private readonly db: BlockchainSchema;
  private readonly cache: Cache<Transaction>;
  private readonly mutex: Mutex;
  private readonly CACHE_TTL = 3600; // 1 hour
  private initialized = false;

  constructor(db: BlockchainSchema) {
    if (!db) throw new Error("Database instance is required");

    this.db = db;
    this.mutex = new Mutex();
    this.cache = new Cache<Transaction>({
      ttl: this.CACHE_TTL,
      maxSize: 10000,
      compression: true,
    });

    this.initialize().catch((err) => {
      Logger.error("Failed to initialize voting shard storage:", err);
      throw err;
    });
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await this.db.ping();
      this.initialized = true;
      Logger.info("Voting shard storage initialized successfully");
    } catch (error) {
      Logger.error("Failed to initialize voting shard storage:", error);
      throw error;
    }
  }

  /**
   * Gets a transaction from a specific shard
   *
   * @async
   * @method getTransaction
   * @param {string} shardId - Shard identifier
   * @param {string} hash - Transaction hash
   * @returns {Promise<Transaction | undefined>} Transaction if found
   * @throws {Error} If storage not initialized or parameters missing
   *
   * @example
   * const tx = await storage.getTransaction('shard1', '0x...');
   */
  @retry({ maxAttempts: 3, delay: 1000 })
  async getTransaction(
    shardId: string,
    hash: string
  ): Promise<Transaction | undefined> {
    if (!this.initialized) throw new Error("Storage not initialized");
    if (!shardId || !hash) throw new Error("Shard ID and hash are required");

    const cacheKey = `tx:${shardId}:${hash}`;
    try {
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.cache.set(cacheKey, cached, { ttl: this.CACHE_TTL }); // Refresh TTL
        return cached;
      }

      const transaction = await this.db.getTransaction(hash);
      if (transaction) {
        this.cache.set(cacheKey, transaction, { ttl: this.CACHE_TTL });
      }
      return transaction;
    } catch (error) {
      Logger.error(
        `Failed to get transaction ${hash} in shard ${shardId}:`,
        error
      );
      return undefined;
    }
  }

  /**
   * Saves a transaction to a specific shard
   *
   * @async
   * @method saveTransaction
   * @param {string} shardId - Shard identifier
   * @param {Transaction} transaction - Transaction to save
   * @returns {Promise<void>}
   * @throws {Error} If storage not initialized, parameters missing, or transaction exists
   *
   * @example
   * await storage.saveTransaction('shard1', transaction);
   */
  @retry({ maxAttempts: 3, delay: 1000 })
  async saveTransaction(
    shardId: string,
    transaction: Transaction
  ): Promise<void> {
    if (!this.initialized) throw new Error("Storage not initialized");
    if (!shardId || !transaction)
      throw new Error("Shard ID and transaction are required");

    return await this.mutex.runExclusive(async () => {
      const key = `tx:${shardId}:${transaction.hash}`;
      try {
        // Check for existing transaction
        const existing = await this.getTransaction(shardId, transaction.hash);
        if (existing) {
          throw new Error("Transaction already exists");
        }

        await this.db.saveTransaction(transaction);
        this.cache.set(key, transaction, { ttl: this.CACHE_TTL });

        Logger.info(
          `Transaction ${transaction.hash} saved in shard ${shardId}`
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        Logger.error(
          `Failed to save transaction ${transaction.hash} in shard ${shardId}:`,
          error
        );
        throw new Error(`Failed to save transaction: ${errorMessage}`);
      }
    });
  }

  /**
   * Deletes a transaction from a specific shard
   *
   * @async
   * @method deleteTransaction
   * @param {string} shardId - Shard identifier
   * @param {string} hash - Transaction hash
   * @returns {Promise<void>}
   * @throws {Error} If storage not initialized or parameters missing
   *
   * @example
   * await storage.deleteTransaction('shard1', '0x...');
   */
  @retry({ maxAttempts: 3, delay: 1000 })
  async deleteTransaction(shardId: string, hash: string): Promise<void> {
    if (!this.initialized) throw new Error("Storage not initialized");
    if (!shardId || !hash) throw new Error("Shard ID and hash are required");

    return await this.mutex.runExclusive(async () => {
      const key = `tx:${shardId}:${hash}`;
      try {
        await this.db.deleteTransaction(hash);
        this.cache.delete(key);
        Logger.info(`Transaction ${hash} deleted from shard ${shardId}`);
      } catch (error) {
        Logger.error(
          `Failed to delete transaction ${hash} from shard ${shardId}:`,
          error
        );
        throw error;
      }
    });
  }

  /**
   * Gets all transactions from a specific shard
   *
   * @async
   * @method getTransactions
   * @param {string} shardId - Shard identifier
   * @returns {Promise<Transaction[]>} Array of transactions
   * @throws {Error} If storage not initialized or shard ID missing
   *
   * @example
   * const transactions = await storage.getTransactions('shard1');
   */
  async getTransactions(shardId: string): Promise<Transaction[]> {
    if (!this.initialized) throw new Error("Storage not initialized");
    if (!shardId) throw new Error("Shard ID is required");

    try {
      return await this.db.getTransactions();
    } catch (error) {
      Logger.error(`Failed to get transactions for shard ${shardId}:`, error);
      return [];
    }
  }

  /**
   * Replicates transactions to a specific shard
   *
   * @async
   * @method replicateShard
   * @param {string} shardId - Shard identifier
   * @param {Transaction[]} transactions - Transactions to replicate
   * @returns {Promise<void>}
   * @throws {Error} If storage not initialized or parameters missing
   *
   * @example
   * await storage.replicateShard('shard1', transactions);
   */
  @retry({ maxAttempts: 3, delay: 1000 })
  async replicateShard(
    shardId: string,
    transactions: Transaction[]
  ): Promise<void> {
    if (!this.initialized) throw new Error("Storage not initialized");
    if (!shardId || !transactions)
      throw new Error("Shard ID and transactions are required");

    return await this.mutex.runExclusive(async () => {
      try {
        await Promise.all(
          transactions.map(async (tx) => {
            await this.saveTransaction(shardId, tx);
          })
        );
        Logger.info(
          `Shard ${shardId} replicated with ${transactions.length} transactions`
        );
      } catch (error) {
        Logger.error(`Failed to replicate shard ${shardId}:`, error);
        throw error;
      }
    });
  }

  /**
   * Closes storage and releases resources
   *
   * @async
   * @method close
   * @returns {Promise<void>}
   *
   * @example
   * await storage.close();
   */
  async close(): Promise<void> {
    if (!this.initialized) return;

    try {
      await this.mutex.runExclusive(async () => {
        await this.db.close();
        this.cache.clear();
        this.initialized = false;
        Logger.info("Voting shard storage closed successfully");
      });
    } catch (error) {
      Logger.error("Error closing voting shard storage:", error);
      throw new Error("Failed to close storage");
    }
  }
}
