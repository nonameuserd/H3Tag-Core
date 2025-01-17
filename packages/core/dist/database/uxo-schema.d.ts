import { UTXO } from '../models/utxo.model';
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
export declare class UTXODatabase {
    private readonly db;
    private readonly mutex;
    private readonly cache;
    private batch;
    private readonly CACHE_TTL;
    private initialized;
    private transactionInProgress;
    constructor(dbPath: string);
    private initialize;
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
    insertUTXO(utxo: UTXO): Promise<void>;
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
    getUTXO(txId: string, outputIndex: number): Promise<UTXO | null>;
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
    getUnspentUTXOs(address: string): Promise<UTXO[]>;
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
    getAllAddresses(): Promise<string[]>;
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
    startTransaction(): Promise<void>;
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
    commitTransaction(): Promise<void>;
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
    rollbackTransaction(): Promise<void>;
    private validateUTXO;
    private safeParse;
}
