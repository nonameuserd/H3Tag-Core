"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletDatabase = void 0;
const level_1 = require("level");
const shared_1 = require("@h3tag-blockchain/shared");
const cache_1 = require("../scaling/cache");
const async_mutex_1 = require("async-mutex");
const retry_1 = require("../utils/retry");
const config_database_1 = require("./config.database");
const utxo_model_1 = require("../models/utxo.model");
/**
 * @fileoverview WalletDatabase implements secure storage and management of wallet data.
 * It handles encrypted keystores, UTXO sets, and address management with optimized
 * caching and atomic operations.
 *
 * @module WalletDatabase
 */
/**
 * WalletDatabase manages secure wallet data storage with built-in caching.
 *
 * @class WalletDatabase
 *
 * @property {Level} db - LevelDB database instance
 * @property {Cache<EncryptedKeystore>} cache - Keystore cache
 * @property {Mutex} mutex - Mutex for synchronizing operations
 * @property {number} CACHE_TTL - Cache time-to-live in seconds
 * @property {boolean} isInitialized - Database initialization status
 * @property {UTXOSet} utxoSet - UTXO set manager
 *
 * @example
 * const walletDb = new WalletDatabase('./data/wallet');
 * await walletDb.saveKeystore(address, keystore);
 * const stored = await walletDb.getKeystore(address);
 */
class WalletDatabase {
    constructor(dbPath) {
        this.CACHE_TTL = 3600; // 1 hour
        this.isInitialized = false;
        if (!dbPath)
            throw new Error("Database path is required");
        this.db = new level_1.Level(`${dbPath}/wallet`, {
            valueEncoding: "json",
            createIfMissing: true,
            compression: true,
            ...config_database_1.databaseConfig.options,
        });
        this.mutex = new async_mutex_1.Mutex();
        this.utxoSet = new utxo_model_1.UTXOSet();
        this.cache = new cache_1.Cache({
            ttl: this.CACHE_TTL,
            maxSize: 1000,
            compression: true,
            priorityLevels: { active: 2, default: 1 },
        });
        this.initialize().catch((err) => {
            shared_1.Logger.error("Failed to initialize wallet database:", err);
            throw err;
        });
    }
    async initialize() {
        try {
            await this.db.open();
            this.isInitialized = true;
            shared_1.Logger.info("Wallet database initialized successfully");
        }
        catch (error) {
            shared_1.Logger.error("Failed to initialize wallet database:", error);
            throw error;
        }
    }
    async saveKeystore(address, keystore) {
        if (!this.isInitialized)
            throw new Error("Database not initialized");
        if (!address || !keystore)
            throw new Error("Address and keystore are required");
        return await this.mutex.runExclusive(async () => {
            const key = `keystore:${address}`;
            try {
                // Check for existing keystore
                const existing = await this.getKeystore(address);
                if (existing) {
                    throw new Error("Keystore already exists for this address");
                }
                const batch = this.db.batch();
                batch.put(key, JSON.stringify(keystore));
                batch.put(`address:${address}`, key);
                await batch.write();
                this.cache.set(key, keystore, { ttl: this.CACHE_TTL });
                shared_1.Logger.debug("Keystore saved successfully", { address });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                shared_1.Logger.error("Failed to save keystore:", {
                    error: errorMessage,
                    address,
                });
                throw new Error(`Failed to save keystore: ${errorMessage}`);
            }
        });
    }
    /**
     * Retrieves an encrypted keystore
     *
     * @async
     * @method getKeystore
     * @param {string} address - Wallet address
     * @returns {Promise<EncryptedKeystore | null>} Keystore if found
     * @throws {Error} If address is missing
     *
     * @example
     * const keystore = await walletDb.getKeystore('0x...');
     */
    async getKeystore(address) {
        if (!this.isInitialized)
            throw new Error("Database not initialized");
        if (!address)
            throw new Error("Address is required");
        const key = `keystore:${address}`;
        try {
            const cached = this.cache.get(key);
            if (cached) {
                // Refresh TTL on cache hit
                this.cache.set(key, cached, { ttl: this.CACHE_TTL });
                return cached;
            }
            const data = await this.db.get(key);
            const keystore = this.safeParse(data);
            if (!keystore)
                return null;
            this.cache.set(key, keystore, { ttl: this.CACHE_TTL });
            return keystore;
        }
        catch (error) {
            if (error.notFound)
                return null;
            shared_1.Logger.error("Failed to retrieve keystore:", { error, address });
            throw new Error("Failed to retrieve keystore");
        }
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
    /**
     * Deletes a keystore
     *
     * @async
     * @method deleteKeystore
     * @param {string} address - Wallet address
     * @returns {Promise<void>}
     * @throws {Error} If deletion fails
     *
     * @example
     * await walletDb.deleteKeystore('0x...');
     */
    async deleteKeystore(address) {
        return await this.mutex.runExclusive(async () => {
            try {
                const key = `keystore:${address}`;
                await this.db.del(key);
                await this.db.del(`address:${address}`);
                this.cache.delete(key);
                shared_1.Logger.debug("Keystore deleted successfully", { address });
            }
            catch (error) {
                shared_1.Logger.error("Failed to delete keystore:", error);
                throw error;
            }
        });
    }
    /**
     * Lists all wallet addresses
     *
     * @async
     * @method listWallets
     * @returns {Promise<string[]>} Array of wallet addresses
     *
     * @example
     * const wallets = await walletDb.listWallets();
     */
    async listWallets() {
        const addresses = [];
        try {
            for await (const [key, value] of this.db.iterator({
                gte: "address:",
                lte: "address:\xFF",
            })) {
                addresses.push(key.split(":")[1]);
            }
            return addresses;
        }
        catch (error) {
            shared_1.Logger.error("Failed to list wallets:", error);
            throw error;
        }
    }
    /**
     * Gets UTXOs for an address
     *
     * @async
     * @method getUtxos
     * @param {string} address - Wallet address
     * @returns {Promise<UTXO[]>} Array of UTXOs
     *
     * @example
     * const utxos = await walletDb.getUtxos('0x...');
     */
    async getUtxos(address) {
        return this.utxoSet.getByAddress(address);
    }
    /**
     * Closes database connection
     *
     * @async
     * @method close
     * @returns {Promise<void>}
     *
     * @example
     * await walletDb.close();
     */
    async close() {
        if (!this.isInitialized)
            return;
        try {
            await this.mutex.runExclusive(async () => {
                await this.db.close();
                this.cache.clear();
                this.isInitialized = false;
                shared_1.Logger.info("Wallet database closed successfully");
            });
        }
        catch (error) {
            shared_1.Logger.error("Error closing wallet database:", error);
            throw new Error("Failed to close database");
        }
    }
    /**
     * Gets address index
     *
     * @async
     * @method getAddressIndex
     * @param {string} address - Wallet address
     * @returns {Promise<number>} Address index
     *
     * @example
     * const index = await walletDb.getAddressIndex('0x...');
     */
    async getAddressIndex(address) {
        try {
            const key = `addressIndex:${address}`;
            const data = await this.db.get(key);
            return parseInt(data) || 0;
        }
        catch (error) {
            if (error.notFound)
                return 0;
            shared_1.Logger.error("Failed to get address index:", error);
            throw error;
        }
    }
    /**
     * Saves a derived address
     *
     * @async
     * @method saveAddress
     * @param {string} masterAddress - Master wallet address
     * @param {string} newAddress - Derived address
     * @param {number} index - Derivation index
     * @returns {Promise<void>}
     *
     * @example
     * await walletDb.saveAddress(masterAddress, derivedAddress, 1);
     */
    async saveAddress(masterAddress, newAddress, index) {
        await this.mutex.runExclusive(async () => {
            await this.db.put(`addressIndex:${masterAddress}`, index.toString());
            await this.db.put(`address:${newAddress}`, masterAddress);
        });
    }
}
__decorate([
    (0, retry_1.retry)({ maxAttempts: 3, delay: 1000 })
], WalletDatabase.prototype, "saveKeystore", null);
exports.WalletDatabase = WalletDatabase;
//# sourceMappingURL=wallet-schema.js.map