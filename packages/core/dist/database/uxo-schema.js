"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UTXODatabase = void 0;
const level_1 = require("level");
const shared_1 = require("@h3tag-blockchain/shared");
const cache_1 = require("../scaling/cache");
const async_mutex_1 = require("async-mutex");
const retry_1 = require("../utils/retry");
const config_database_1 = require("./config.database");
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
class UTXODatabase {
    constructor(dbPath) {
        this.batch = null;
        this.CACHE_TTL = 300000; // 5 minutes
        this.initialized = false;
        this.transactionInProgress = false;
        if (!dbPath)
            throw new Error("Database path is required");
        this.db = new level_1.Level(`${dbPath}/utxo`, {
            valueEncoding: "json",
            createIfMissing: true,
            cacheSize: 512 * 1024 * 1024, // 512MB cache
            compression: true,
            ...config_database_1.databaseConfig.options,
        });
        this.mutex = new async_mutex_1.Mutex();
        this.cache = new cache_1.Cache({
            ttl: this.CACHE_TTL,
            maxSize: 100000,
            compression: true,
        });
        this.initialize().catch((err) => {
            shared_1.Logger.error("Failed to initialize UTXO database:", err);
            throw err;
        });
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            await this.db.open();
            this.initialized = true;
            shared_1.Logger.info("UTXO database initialized successfully");
        }
        catch (error) {
            shared_1.Logger.error("Failed to initialize UTXO database:", error);
            throw error;
        }
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
    async insertUTXO(utxo) {
        if (!this.initialized)
            throw new Error("Database not initialized");
        if (!this.validateUTXO(utxo))
            throw new Error("Invalid UTXO data");
        return await this.mutex.runExclusive(async () => {
            const key = `utxo:${utxo.txId}:${utxo.outputIndex}`;
            try {
                // Check for existing UTXO
                const existing = await this.getUTXO(utxo.txId, utxo.outputIndex);
                if (existing) {
                    throw new Error("UTXO already exists");
                }
                const batch = this.batch || this.db.batch();
                batch.put(key, JSON.stringify(utxo));
                batch.put(`address:${utxo.address}:${utxo.txId}:${utxo.outputIndex}`, key);
                if (!utxo.spent) {
                    batch.put(`unspent:${utxo.address}:${utxo.amount}:${utxo.txId}`, key);
                }
                if (!this.batch) {
                    await batch.write((err) => {
                        if (err)
                            throw err;
                    });
                }
                this.cache.set(key, utxo, { ttl: this.CACHE_TTL });
                shared_1.Logger.debug("UTXO inserted successfully", {
                    txId: utxo.txId,
                    index: utxo.outputIndex,
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                shared_1.Logger.error("Failed to insert UTXO:", { error: errorMessage });
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
    async getUTXO(txId, outputIndex) {
        if (!this.initialized)
            throw new Error("Database not initialized");
        const key = `utxo:${txId}:${outputIndex}`;
        const cached = this.cache.get(key);
        if (cached) {
            // Refresh TTL on cache hit
            this.cache.set(key, cached, { ttl: this.CACHE_TTL });
            return cached;
        }
        try {
            const data = await this.db.get(key);
            const utxo = this.safeParse(data);
            if (!utxo)
                return null;
            this.cache.set(key, utxo, { ttl: this.CACHE_TTL });
            return utxo;
        }
        catch (error) {
            if (error.notFound)
                return null;
            shared_1.Logger.error("Failed to get UTXO:", error);
            throw new Error("Failed to get UTXO");
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
    async getUnspentUTXOs(address) {
        const utxos = [];
        try {
            for await (const [, value] of this.db.iterator({
                gte: `unspent:${address}:`,
                lte: `unspent:${address}:\xFF`,
            })) {
                const utxoKey = value;
                const utxo = await this.getUTXO(utxoKey.split(":")[1], parseInt(utxoKey.split(":")[2]));
                if (utxo && !utxo.spent)
                    utxos.push(utxo);
            }
            return utxos;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get unspent UTXOs:", error);
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
    async getAllAddresses() {
        const addresses = new Set();
        try {
            for await (const [key] of this.db.iterator({
                gte: "address:",
                lte: "address:\xFF",
            })) {
                const address = key.split(":")[1];
                addresses.add(address);
            }
            return Array.from(addresses);
        }
        catch (error) {
            shared_1.Logger.error("Failed to get all addresses:", error);
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
    async startTransaction() {
        await this.mutex.runExclusive(() => {
            if (this.transactionInProgress) {
                throw new Error("Transaction already in progress");
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
    async commitTransaction() {
        await this.mutex.runExclusive(async () => {
            if (!this.transactionInProgress) {
                throw new Error("No transaction in progress");
            }
            if (this.batch) {
                await (this.batch).write((err) => {
                    if (err)
                        throw err;
                });
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
    async rollbackTransaction() {
        await this.mutex.runExclusive(() => {
            if (!this.transactionInProgress) {
                throw new Error("No transaction in progress");
            }
            if (this.batch) {
                this.batch.clear();
                this.batch = null;
                this.transactionInProgress = false;
            }
        });
    }
    validateUTXO(utxo) {
        return !!(utxo &&
            utxo.txId &&
            typeof utxo.outputIndex === "number" &&
            utxo.address &&
            typeof utxo.amount === "bigint" &&
            typeof utxo.spent === "boolean");
    }
    safeParse(value) {
        try {
            return JSON.parse(value);
        }
        catch (error) {
            shared_1.Logger.error("Failed to parse stored value:", error);
            return null;
        }
    }
}
exports.UTXODatabase = UTXODatabase;
__decorate([
    (0, retry_1.retry)({ maxAttempts: 3, delay: 1000 })
], UTXODatabase.prototype, "insertUTXO", null);
