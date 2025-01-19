import { EncryptedKeystore } from "../wallet/keystore";
import { UTXO } from "../models/utxo.model";
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
export declare class WalletDatabase {
    private db;
    private cache;
    private mutex;
    private readonly CACHE_TTL;
    private isInitialized;
    private utxoSet;
    constructor(dbPath: string);
    private initialize;
    saveKeystore(address: string, keystore: EncryptedKeystore): Promise<void>;
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
    getKeystore(address: string): Promise<EncryptedKeystore | null>;
    private safeParse;
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
    deleteKeystore(address: string): Promise<void>;
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
    listWallets(): Promise<string[]>;
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
    getUtxos(address: string): Promise<UTXO[]>;
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
    close(): Promise<void>;
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
    getAddressIndex(address: string): Promise<number>;
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
    saveAddress(masterAddress: string, newAddress: string, index: number): Promise<void>;
}
