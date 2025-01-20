import { Level } from 'level';
import { Logger } from '@h3tag-blockchain/shared';
import { Cache } from '../scaling/cache';
import { Mutex } from 'async-mutex';
import { retry } from '../utils/retry';
import { EncryptedKeystore } from '../wallet/keystore';
import { databaseConfig } from './config.database';
import { UTXO, UTXOSet } from '../models/utxo.model';

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

export class WalletDatabase {
  private db: Level;
  private cache: Cache<EncryptedKeystore>;
  private mutex: Mutex;
  private readonly CACHE_TTL = 3600; // 1 hour
  private isInitialized = false;
  private utxoSet: UTXOSet;

  constructor(dbPath: string) {
    if (!dbPath) throw new Error('Database path is required');

    this.db = new Level(`${dbPath}/wallet`, {
      valueEncoding: 'json',
      ...databaseConfig.options,
    });

    this.mutex = new Mutex();
    this.utxoSet = new UTXOSet();

    this.cache = new Cache<EncryptedKeystore>({
      ttl: this.CACHE_TTL,
      maxSize: 1000,
      compression: true,
      priorityLevels: { active: 2, default: 1 },
    });

    this.initialize().catch((err) => {
      Logger.error('Failed to initialize wallet database:', err);
      throw err;
    });
  }

  private async initialize(): Promise<void> {
    try {
      await this.db.open();
      this.isInitialized = true;
      Logger.info('Wallet database initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize wallet database:', error);
      throw error;
    }
  }

  @retry({ maxAttempts: 3, delay: 1000 })
  async saveKeystore(
    address: string,
    keystore: EncryptedKeystore,
  ): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    if (!address || !keystore)
      throw new Error('Address and keystore are required');

    return await this.mutex.runExclusive(async () => {
      const key = `keystore:${address}`;
      try {
        // Check for existing keystore
        const existing = await this.getKeystore(address);
        if (existing) {
          throw new Error('Keystore already exists for this address');
        }

        const batch = this.db.batch();
        batch.put(key, JSON.stringify(keystore));
        batch.put(`address:${address}`, key);
        await batch.write();

        this.cache.set(key, keystore, { ttl: this.CACHE_TTL });
        Logger.debug('Keystore saved successfully', { address });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        Logger.error('Failed to save keystore:', {
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
  async getKeystore(address: string): Promise<EncryptedKeystore | null> {
    if (!this.isInitialized) throw new Error('Database not initialized');
    if (!address) throw new Error('Address is required');

    const key = `keystore:${address}`;
    try {
      const cached = this.cache.get(key);
      if (cached) {
        // Refresh TTL on cache hit
        this.cache.set(key, cached, { ttl: this.CACHE_TTL });
        return cached;
      }

      const data = await this.db.get(key);
      const keystore = this.safeParse<EncryptedKeystore>(data);
      if (!keystore) return null;

      this.cache.set(key, keystore, { ttl: this.CACHE_TTL });
      return keystore;
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return null;
      Logger.error('Failed to retrieve keystore:', { error, address });
      throw new Error('Failed to retrieve keystore');
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
  async deleteKeystore(address: string): Promise<void> {
    return await this.mutex.runExclusive(async () => {
      try {
        const key = `keystore:${address}`;
        await this.db.del(key);
        await this.db.del(`address:${address}`);
        this.cache.delete(key);
        Logger.debug('Keystore deleted successfully', { address });
      } catch (error) {
        Logger.error('Failed to delete keystore:', error);
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
  async listWallets(): Promise<string[]> {
    const addresses: string[] = [];
    try {
      for await (const [key] of this.db.iterator({
        gte: 'address:',
        lte: 'address:\xFF',
      })) {
        addresses.push(key.split(':')[1]);
      }
      return addresses;
    } catch (error) {
      Logger.error('Failed to list wallets:', error);
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
  async getUtxos(address: string): Promise<UTXO[]> {
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
  async close(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await this.mutex.runExclusive(async () => {
        await this.db.close();
        this.cache.clear();
        this.isInitialized = false;
        Logger.info('Wallet database closed successfully');
      });
    } catch (error) {
      Logger.error('Error closing wallet database:', error);
      throw new Error('Failed to close database');
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
  async getAddressIndex(address: string): Promise<number> {
    try {
      const key = `addressIndex:${address}`;
      const data = await this.db.get(key);
      return parseInt(data) || 0;
    } catch (error: unknown) {
      if (error instanceof Error && 'notFound' in error) return 0;
      Logger.error('Failed to get address index:', error instanceof Error ? error.message : 'Unknown error');
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
  async saveAddress(
    masterAddress: string,
    newAddress: string,
    index: number,
  ): Promise<void> {
    await this.mutex.runExclusive(async () => {
      await this.db.put(`addressIndex:${masterAddress}`, index.toString());
      await this.db.put(`address:${newAddress}`, masterAddress);
    });
  }
}
