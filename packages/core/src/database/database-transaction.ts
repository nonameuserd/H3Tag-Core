import { BlockchainSchema } from './blockchain-schema';
import { Logger } from '@h3tag-blockchain/shared';
import { AbstractChainedBatch } from 'abstract-leveldown';

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

export class DatabaseTransaction {
  private batch: AbstractChainedBatch;
  private operations: Array<{
    type: 'put' | 'del';
    key: string;
    value?: string;
  }> = [];
  private committed = false;
  private rolledBack = false;

  constructor(private readonly db: BlockchainSchema) {
    this.batch = db.db.batch();
  }

  put(key: string, value: string): void {
    this.validateTransactionState();
    if (!key || !value) {
      throw new Error('Key and value must be provided');
    }
    this.operations.push({ type: 'put', key, value });
    this.batch.put(key, value);
  }

  delete(key: string): void {
    this.validateTransactionState();
    if (!key) {
      throw new Error('Key must be provided');
    }
    this.operations.push({ type: 'del', key });
    this.batch.del(key);
  }

  async commit(): Promise<void> {
    this.validateTransactionState();

    try {
      await new Promise<void>((resolve, reject) => {
        this.batch.write((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      this.committed = true;
      Logger.debug(
        `Transaction committed with ${this.operations.length} operations`,
      );
    } catch (error: unknown) {
      Logger.error('Transaction commit failed:', error);
      await this.rollback();
      throw new Error(
        'Transaction commit failed: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      );
    }
  }

  async rollback(): Promise<void> {
    if (this.committed || this.rolledBack) return;

    try {
      const reverseBatch = this.db.db.batch();

      const keyStates = new Map<string, string | null>();

      for (const op of this.operations) {
        if (!keyStates.has(op.key)) {
          try {
            const value = await this.db.db.get(op.key);
            keyStates.set(op.key, value);
          } catch (err) {
            if (err instanceof Error) {
              keyStates.set(
                op.key,
                JSON.stringify({ value: null, timestamp: Date.now() }),
              );
            } else {
              throw err;
            }
          }
        }
      }

      for (const key of keyStates.keys()) {
        const originalValue = keyStates.get(key);
        if (originalValue === null) {
          reverseBatch.del(key);
        } else {
          reverseBatch.put(key, originalValue ?? '');
        }
      }

      await new Promise<void>((resolve, reject) => {
        reverseBatch.write((error: unknown) => {
          if (error instanceof Error) reject(error);
          else resolve();
        });
      });

      this.rolledBack = true;
      Logger.debug(
        `Transaction rolled back ${this.operations.length} operations`,
      );
    } catch (error) {
      Logger.error('Transaction rollback failed:', error);
      throw new Error(
        'Transaction rollback failed: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      );
    }
  }

  /**
   * Validates the current transaction state
   * @throws {Error} If the transaction is in an invalid state
   */
  private validateTransactionState(): void {
    if (this.committed && this.rolledBack) {
      throw new Error(
        'Transaction in invalid state: both committed and rolled back',
      );
    }
    if (this.committed) {
      throw new Error('Transaction already committed');
    }
    if (this.rolledBack) {
      throw new Error('Transaction already rolled back');
    }
  }

  /**
   * Returns whether the transaction is active (neither committed nor rolled back)
   */
  public isActive(): boolean {
    return !this.committed && !this.rolledBack;
  }

  /**
   * Returns the number of pending operations in the transaction
   */
  public getOperationCount(): number {
    return this.operations.length;
  }

  /**
   * Returns whether the transaction has any pending operations
   */
  public hasPendingOperations(): boolean {
    return this.operations.length > 0;
  }

  /**
   * Returns whether the transaction has been committed
   */
  public isCommitted(): boolean {
    return this.committed;
  }

  /**
   * Returns whether the transaction has been rolled back
   */
  public isRolledBack(): boolean {
    return this.rolledBack;
  }

  /**
   * Returns the current state of the transaction
   */
  public getTransactionState():
    | 'active'
    | 'committed'
    | 'rolled_back'
    | 'invalid' {
    if (this.committed && this.rolledBack) return 'invalid';
    if (this.committed) return 'committed';
    if (this.rolledBack) return 'rolled_back';
    return 'active';
  }
}
