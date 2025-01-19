import { Transaction } from "../models/transaction.model";
import { BlockchainSchema } from "./blockchain-schema";
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
export declare class VotingShardStorage {
    private readonly db;
    private readonly cache;
    private readonly mutex;
    private readonly CACHE_TTL;
    private initialized;
    constructor(db: BlockchainSchema);
    private initialize;
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
    getTransaction(shardId: string, hash: string): Promise<Transaction | undefined>;
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
    saveTransaction(shardId: string, transaction: Transaction): Promise<void>;
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
    deleteTransaction(shardId: string, hash: string): Promise<void>;
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
    getTransactions(shardId: string): Promise<Transaction[]>;
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
    replicateShard(shardId: string, transactions: Transaction[]): Promise<void>;
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
    close(): Promise<void>;
}
