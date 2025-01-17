import { BlockchainSchema } from "./blockchain-schema";
/**
 * @fileoverview DatabaseTransaction implements atomic database operations with rollback support.
 * It provides ACID guarantees for database operations and handles transaction lifecycle management.
 *
 * @module DatabaseTransaction
 */
/**
 * DatabaseTransaction manages atomic database operations with rollback capability.
 *
 * @class DatabaseTransaction
 *
 * @property {AbstractChainedBatch} batch - LevelDB batch operation instance
 * @property {Array<{ type: 'put' | 'del'; key: string; value?: string }>} operations - Pending operations
 * @property {boolean} committed - Transaction commit status
 * @property {boolean} rolledBack - Transaction rollback status
 *
 * @example
 * const tx = new DatabaseTransaction(db);
 * try {
 *   tx.put('key1', 'value1');
 *   tx.put('key2', 'value2');
 *   await tx.commit();
 * } catch (error) {
 *   await tx.rollback();
 * }
 */
/**
 * Creates a new database transaction
 *
 * @constructor
 * @param {BlockchainSchema} db - Database instance
 */
/**
 * Adds a put operation to the transaction
 *
 * @method put
 * @param {string} key - Key to store
 * @param {string} value - Value to store
 * @throws {Error} If transaction state is invalid or parameters are missing
 *
 * @example
 * transaction.put('user:123', JSON.stringify({ name: 'Alice' }));
 */
/**
 * Adds a delete operation to the transaction
 *
 * @method delete
 * @param {string} key - Key to delete
 * @throws {Error} If transaction state is invalid or key is missing
 *
 * @example
 * transaction.delete('user:123');
 */
/**
 * Commits all pending operations atomically
 *
 * @async
 * @method commit
 * @returns {Promise<void>}
 * @throws {Error} If commit fails or transaction state is invalid
 *
 * @example
 * await transaction.commit();
 */
/**
 * Rolls back all pending operations
 *
 * @async
 * @method rollback
 * @returns {Promise<void>}
 * @throws {Error} If rollback fails
 *
 * @example
 * await transaction.rollback();
 */
/**
 * Validates the current transaction state
 *
 * @private
 * @method validateTransactionState
 * @throws {Error} If transaction is in an invalid state
 */
/**
 * Returns whether the transaction is active
 *
 * @method isActive
 * @returns {boolean} True if transaction is active
 *
 * @example
 * if (transaction.isActive()) {
 *   await transaction.commit();
 * }
 */
/**
 * Returns the number of pending operations
 *
 * @method getOperationCount
 * @returns {number} Number of pending operations
 */
/**
 * Returns whether the transaction has pending operations
 *
 * @method hasPendingOperations
 * @returns {boolean} True if transaction has pending operations
 */
/**
 * Returns whether the transaction has been committed
 *
 * @method isCommitted
 * @returns {boolean} True if transaction is committed
 */
/**
 * Returns whether the transaction has been rolled back
 *
 * @method isRolledBack
 * @returns {boolean} True if transaction is rolled back
 */
/**
 * Returns the current state of the transaction
 *
 * @method getTransactionState
 * @returns {'active' | 'committed' | 'rolled_back' | 'invalid'} Current transaction state
 *
 * @example
 * const state = transaction.getTransactionState();
 * if (state === 'active') {
 *   await transaction.commit();
 * }
 */
export declare class DatabaseTransaction {
    private readonly db;
    private batch;
    private operations;
    private committed;
    private rolledBack;
    constructor(db: BlockchainSchema);
    put(key: string, value: string): void;
    delete(key: string): void;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    /**
     * Validates the current transaction state
     * @throws {Error} If the transaction is in an invalid state
     */
    private validateTransactionState;
    /**
     * Returns whether the transaction is active (neither committed nor rolled back)
     */
    isActive(): boolean;
    /**
     * Returns the number of pending operations in the transaction
     */
    getOperationCount(): number;
    /**
     * Returns whether the transaction has any pending operations
     */
    hasPendingOperations(): boolean;
    /**
     * Returns whether the transaction has been committed
     */
    isCommitted(): boolean;
    /**
     * Returns whether the transaction has been rolled back
     */
    isRolledBack(): boolean;
    /**
     * Returns the current state of the transaction
     */
    getTransactionState(): "active" | "committed" | "rolled_back" | "invalid";
}
