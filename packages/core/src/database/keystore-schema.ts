import { Level } from 'level';
import { EncryptedKeystore } from '../wallet/keystore';
import { databaseConfig } from './config.database';

/**
 * @fileoverview KeystoreDatabase manages encrypted keystore storage and retrieval.
 * It implements secure storage patterns for encrypted wallet keystores with validation
 * and health checks.
 *
 * @module KeystoreDatabase
 */

/**
 * KeystoreDatabase manages secure storage of encrypted keystores.
 *
 * @class KeystoreDatabase
 *
 * @property {Level} db - LevelDB database instance
 *
 * @example
 * const keystore = new KeystoreDatabase('./data/keystore');
 * await keystore.store(address, encryptedKeystore);
 * const stored = await keystore.get(address);
 */

/**
 * Creates a new KeystoreDatabase instance
 *
 * @constructor
 * @param {string} dbPath - Path to database directory
 */

/**
 * Checks database health
 *
 * @async
 * @method ping
 * @returns {Promise<boolean>} True if database is healthy
 *
 * @example
 * const isHealthy = await keystore.ping();
 * if (!isHealthy) {
 *   console.error('Keystore database is not accessible');
 * }
 */

/**
 * Stores an encrypted keystore
 *
 * @async
 * @method store
 * @param {string} address - Wallet address
 * @param {EncryptedKeystore} keystore - Encrypted keystore data
 * @returns {Promise<void>}
 * @throws {Error} If address or keystore is missing
 *
 * @example
 * await keystore.store(walletAddress, encryptedData);
 */

/**
 * Retrieves an encrypted keystore
 *
 * @async
 * @method get
 * @param {string} address - Wallet address
 * @returns {Promise<EncryptedKeystore | null>} Keystore if found, null otherwise
 * @throws {Error} If address is missing
 *
 * @example
 * const keystore = await keystoreDb.get(walletAddress);
 * if (keystore) {
 *   // Process keystore
 * }
 */

/**
 * Closes the database connection
 *
 * @async
 * @method close
 * @returns {Promise<void>}
 *
 * @example
 * await keystoreDb.close();
 */

export class KeystoreDatabase {
  private db: Level;

  constructor(dbPath: string) {
    this.db = new Level(`${dbPath}/keystore`, {
      valueEncoding: 'json',
      ...databaseConfig.options,
    });
  }

  async ping(): Promise<boolean> {
    try {
      await this.db.get('__health_check__');
      return true;
    } catch (error) {
      if (error && 'notFound' in error) return true; // DB is accessible but key not found
      return false;
    }
  }

  async store(address: string, keystore: EncryptedKeystore): Promise<void> {
    if (!address) throw new Error('Address is required');
    if (!keystore) throw new Error('Keystore is required');

    await this.db.put(`keystore:${address}`, JSON.stringify(keystore));
  }

  async get(address: string): Promise<EncryptedKeystore | null> {
    if (!address) throw new Error('Address is required');

    try {
      const value = await this.db.get(`keystore:${address}`);
      return JSON.parse(value) as EncryptedKeystore;
    } catch (error) {
      if (error && 'notFound' in error) return null;
      throw error;
    }
  }

  /**
   * Closes the database connection
   */
  async close(): Promise<void> {
    await this.db.close();
  }
}
