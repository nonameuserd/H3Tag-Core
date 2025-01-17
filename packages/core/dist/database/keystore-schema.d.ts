import { EncryptedKeystore } from "../wallet/keystore";
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
export declare class KeystoreDatabase {
    private db;
    constructor(dbPath: string);
    ping(): Promise<boolean>;
    store(address: string, keystore: EncryptedKeystore): Promise<void>;
    get(address: string): Promise<EncryptedKeystore | null>;
    /**
     * Closes the database connection
     */
    close(): Promise<void>;
}
