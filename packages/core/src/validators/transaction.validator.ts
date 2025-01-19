import {
  Transaction,
  TransactionType,
  TxInput,
} from '../models/transaction.model';
import { UTXO, UTXOSet } from '../models/utxo.model';
import { Logger } from '@h3tag-blockchain/shared';
import { HybridCrypto } from '@h3tag-blockchain/crypto';
import { BlockchainSchema } from '../database/blockchain-schema';
import { BLOCKCHAIN_CONSTANTS } from '../blockchain/utils/constants';
import { TransactionValidationError } from './transaction-validation-error';
import { Mutex } from 'async-mutex';
import { DatabaseTransaction } from '../database/database-transaction';
import { createHash } from 'crypto';

export class TransactionValidator {
  private static readonly VOTE_HEIGHT_KEY_PREFIX = 'vote_height:';
  private static readonly db: BlockchainSchema = new BlockchainSchema(); // Assuming Database is imported
  private static readonly voteLock = new Mutex();
  private static readonly voteHeightCache = new Map<string, number>();

  static async validateTransaction(
    tx: Transaction,
    utxoSet: UTXOSet,
    currentHeight: number,
  ): Promise<boolean> {
    const release = await this.voteLock.acquire();
    try {
      await this.validateBasicRequirements(tx, utxoSet);

      if (tx.type === TransactionType.POW_REWARD) {
        await this.validatePoWTransaction(tx);
      } else if (tx.type === TransactionType.QUADRATIC_VOTE) {
        await this.validateVoteTransaction(tx, utxoSet, currentHeight);
      }

      return true;
    } catch (error) {
      Logger.error('Transaction validation failed:', error);
      return false;
    } finally {
      release();
    }
  }

  private static async validateBasicRequirements(
    tx: Transaction,
    utxoSet: UTXOSet,
  ): Promise<void> {
    // Add null/undefined check for tx
    if (!tx) {
      throw new TransactionValidationError(
        'Transaction is null or undefined',
        'INVALID_TRANSACTION',
      );
    }

    // Add type validation
    if (
      typeof tx.type !== 'number' ||
      !Object.values(TransactionType).includes(tx.type)
    ) {
      throw new TransactionValidationError(
        'Invalid transaction type',
        'INVALID_TYPE',
      );
    }

    // Basic structure validation
    if (!tx.id || !tx.inputs || !tx.outputs) {
      throw new TransactionValidationError(
        'Invalid structure',
        'INVALID_STRUCTURE',
      );
    }

    // Size limits
    if (JSON.stringify(tx).length > BLOCKCHAIN_CONSTANTS.MINING.MAX_TX_SIZE) {
      throw new TransactionValidationError(
        `${BLOCKCHAIN_CONSTANTS.CURRENCY.NAME} transaction too large`,
        'EXCESS_SIZE',
      );
    }

    // Input/Output validation
    await this.validateInputsAndOutputs(tx, utxoSet);

    // Signature verification
    await this.validateSignatures(tx);

    // Add version validation
    if (!this.validateTransactionVersion(tx)) {
      throw new TransactionValidationError(
        'Invalid transaction version',
        'INVALID_VERSION',
      );
    }

    // Add size validation
    if (!this.validateTransactionSize(tx)) {
      throw new TransactionValidationError(
        'Transaction size exceeds limit',
        'EXCESS_SIZE',
      );
    }
  }

  private static async validatePoWTransaction(tx: Transaction): Promise<void> {
    // Validate PoW data structure
    if (!tx.powData || typeof tx.powData !== 'object') {
      throw new TransactionValidationError(
        `Invalid ${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} PoW data structure`,
        'INVALID_POW_DATA',
      );
    }

    // Calculate and validate hash
    const hash = await this.calculateTransactionPoW(tx);
    if (!this.isValidHash(hash)) {
      throw new TransactionValidationError(
        'Invalid PoW hash format',
        'INVALID_HASH',
      );
    }

    // Calculate and validate difficulty
    const difficulty = this.calculateHashDifficulty(hash);
    const minDifficulty = BLOCKCHAIN_CONSTANTS.MINING.MIN_DIFFICULTY;

    if (difficulty < minDifficulty) {
      throw new TransactionValidationError(
        `Insufficient PoW difficulty (${difficulty} < ${minDifficulty})`,
        'INSUFFICIENT_POW',
      );
    }

    // Validate timestamp
    const now = Date.now();
    const maxAge = 600000; // 10 minutes
    if (now - tx.powData.timestamp > maxAge) {
      throw new TransactionValidationError(
        'PoW timestamp too old',
        'EXPIRED_POW',
      );
    }
  }

  private static async validateVoteTransaction(
    tx: Transaction,
    utxoSet: UTXOSet,
    currentHeight: number,
  ): Promise<void> {
    // Validate transaction type
    if (tx.type !== TransactionType.QUADRATIC_VOTE) {
      throw new TransactionValidationError(
        'Invalid transaction type for vote',
        'INVALID_VOTE_TYPE',
      );
    }

    // Validate vote data structure
    if (
      !tx.voteData ||
      typeof tx.voteData !== 'object' ||
      !tx.voteData.proposal ||
      typeof tx.voteData.vote !== 'boolean'
    ) {
      throw new TransactionValidationError(
        'Invalid vote data structure',
        'INVALID_VOTE_DATA',
      );
    }

    // Calculate quadratic voting power
    const committedAmount = await this.calculateVotingPower(tx, utxoSet);
    const quadraticPower = Math.floor(Math.sqrt(Number(committedAmount)));

    if (
      quadraticPower < BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_VOTE_AMOUNT
    ) {
      throw new TransactionValidationError(
        `Insufficient quadratic voting power (${quadraticPower})`,
        'INSUFFICIENT_VOTING_POWER',
      );
    }

    // Validate cooldown period
    const [lastVoted, utxo] = await Promise.all([
      tx.inputs[0]?.publicKey
        ? this.getLastVoteHeight(tx.inputs[0].publicKey)
        : 0,
      utxoSet.get(tx.inputs[0].txId, tx.inputs[0].outputIndex),
    ]);

    if (!utxo) {
      throw new TransactionValidationError(
        'Invalid input UTXO',
        'INVALID_INPUT',
      );
    }

    if (
      currentHeight - lastVoted <
      BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.COOLDOWN_BLOCKS
    ) {
      throw new TransactionValidationError(
        'Vote cooldown period not met',
        'VOTE_COOLDOWN',
      );
    }

    // Update last vote height
    await this.setLastVoteHeight(utxo.address, currentHeight);
  }

  private static async calculateVotingPower(
    tx: Transaction,
    utxoSet: UTXOSet,
  ): Promise<number> {
    const utxos = await this.getTransactionUTXOs(tx, utxoSet);
    const totalAmount = utxos.reduce(
      (sum, utxo) => sum + utxo.amount,
      BigInt(0),
    );

    // Convert to quadratic voting power
    const quadraticPower = Math.floor(Math.sqrt(Number(totalAmount)));

    // Ensure minimum voting power
    return Math.max(quadraticPower, 0);
  }

  private static async validateSignatures(tx: Transaction): Promise<void> {
    try {
      // Add input array validation
      if (!Array.isArray(tx.inputs)) {
        throw new TransactionValidationError(
          'Invalid inputs array',
          'INVALID_INPUTS',
        );
      }

      // Add concurrent signature verification with timeout
      const verificationPromises = tx.inputs.map((input) => {
        return Promise.race([
          this.verifyInputSignature(input, tx.id),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Signature verification timeout')),
              5000,
            ),
          ),
        ]);
      });

      await Promise.all(verificationPromises);
    } catch (error) {
      Logger.error('Signature validation failed:', error);
      if (error instanceof TransactionValidationError) {
        throw error;
      }
      throw new TransactionValidationError(
        'Signature validation failed',
        'VALIDATION_ERROR',
      );
    }
  }

  private static async calculateTransactionPoW(
    tx: Transaction,
  ): Promise<string> {
    try {
      // Create immutable copy with timestamp
      const data = {
        ...tx,
        powData: {
          ...tx.powData,
          timestamp: Date.now(),
          version: '1.0',
        },
      };

      // Generate deterministic buffer
      const dataString = JSON.stringify(data, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      );

      // Calculate classical hash using SHA3-256
      const classicalHash = createHash('sha3-256')
        .update(Buffer.from(dataString))
        .digest('hex');

      if (!this.isValidHash(classicalHash)) {
        throw new TransactionValidationError(
          'Invalid classical hash format',
          'INVALID_HASH',
        );
      }

      // Create hybrid hash
      const hybridHash = await HybridCrypto.hash(classicalHash);

      if (!this.isValidHash(hybridHash)) {
        throw new TransactionValidationError(
          'Invalid hybrid hash format',
          'INVALID_HASH',
        );
      }

      return hybridHash;
    } catch (error) {
      Logger.error('PoW calculation failed:', error);
      throw new TransactionValidationError(
        'PoW calculation failed',
        'POW_CALCULATION_ERROR',
      );
    }
  }

  private static isValidHash(hash: string): boolean {
    return (
      typeof hash === 'string' &&
      hash.length === 64 &&
      /^[0-9a-f]{64}$/i.test(hash)
    );
  }

  private static async validateInputsAndOutputs(
    tx: Transaction,
    utxoSet: UTXOSet,
  ): Promise<void> {
    try {
      if (!tx.inputs?.length || !tx.outputs?.length) {
        throw new TransactionValidationError(
          'Empty inputs or outputs',
          'INVALID_STRUCTURE',
        );
      }

      // Validate input/output counts
      if (
        tx.inputs.length > BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_INPUTS ||
        tx.outputs.length > BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_OUTPUTS
      ) {
        throw new TransactionValidationError(
          'Too many inputs or outputs',
          'EXCESS_INPUTS_OUTPUTS',
        );
      }

      // Validate individual amounts
      for (const output of tx.outputs) {
        if (output.amount <= BigInt(0)) {
          throw new TransactionValidationError(
            'Invalid output amount',
            'INVALID_AMOUNT',
          );
        }
      }

      // Validate total amounts
      const inputSum = await this.calculateInputSum(tx, utxoSet);
      const outputSum = tx.outputs.reduce(
        (sum, output) => sum + output.amount,
        BigInt(0),
      );

      if (inputSum < outputSum) {
        throw new TransactionValidationError(
          'Insufficient input amount',
          'INSUFFICIENT_FUNDS',
        );
      }

      // Validate no duplicate inputs
      const inputIds = new Set();
      for (const input of tx.inputs) {
        const inputId = `${input.txId}:${input.outputIndex}`;
        if (inputIds.has(inputId)) {
          throw new TransactionValidationError(
            'Duplicate input detected',
            'DUPLICATE_INPUT',
          );
        }
        inputIds.add(inputId);
      }
    } catch (error) {
      Logger.error('Input/output validation failed:', error);
      if (error instanceof TransactionValidationError) {
        throw error;
      }
      throw new TransactionValidationError(
        'Input/output validation failed',
        'VALIDATION_ERROR',
      );
    }
  }

  private static async calculateInputSum(
    tx: Transaction,
    utxoSet: UTXOSet,
  ): Promise<bigint> {
    let sum = BigInt(0);
    for (const input of tx.inputs) {
      const utxo = await utxoSet.get(input.txId, input.outputIndex);
      if (!utxo || utxo.spent) {
        throw new TransactionValidationError(
          'Invalid input UTXO',
          'INVALID_INPUT',
        );
      }
      sum += utxo.amount;
    }
    return sum;
  }

  private static async getTransactionUTXOs(
    tx: Transaction,
    utxoSet: UTXOSet,
  ): Promise<UTXO[]> {
    const utxos: UTXO[] = [];
    for (const input of tx.inputs) {
      const utxo = await utxoSet.get(input.txId, input.outputIndex);
      if (utxo && !utxo.spent) {
        utxos.push(utxo);
      }
    }
    return utxos;
  }

  private static async getLastVoteHeight(address: string): Promise<number> {
    try {
      const key = `${this.VOTE_HEIGHT_KEY_PREFIX}${address}`;
      const height = await this.db.get(key);
      return height ? Number(height) : 0;
    } catch (error) {
      Logger.error('Failed to get last vote height:', error);
      return 0;
    }
  }

  private static async setLastVoteHeight(
    address: string,
    height: number,
  ): Promise<void> {
    const key = `${this.VOTE_HEIGHT_KEY_PREFIX}${address}`;
    const release = await this.voteLock.acquire();

    try {
      const dbTx = new DatabaseTransaction(this.db);
      await dbTx.put(key, height.toString());
      await dbTx.put(`${key}:timestamp`, Date.now().toString());
      await dbTx.commit();

      // Update cache if exists
      if (this.voteHeightCache?.has(address)) {
        this.voteHeightCache.set(address, height);
      }
    } catch (error) {
      Logger.error('Failed to set last vote height:', error);
      throw new TransactionValidationError(
        'Failed to update vote height',
        'DB_ERROR',
      );
    } finally {
      release();
    }
  }

  private static calculateHashDifficulty(hash: string): number {
    try {
      // Validate hash format
      if (!/^[0-9a-f]{64}$/i.test(hash)) {
        throw new TransactionValidationError(
          'Invalid hash format',
          'INVALID_HASH',
        );
      }

      // Optimize binary conversion by checking hex digits directly
      let leadingZeros = 0;
      for (const char of hash) {
        const hexValue = parseInt(char, 16);
        if (hexValue === 0) {
          leadingZeros += 4;
        } else {
          // Count remaining leading zeros in this hex digit
          const bits = hexValue.toString(2).padStart(4, '0');
          for (const bit of bits) {
            if (bit === '0') {
              leadingZeros++;
            } else {
              return leadingZeros;
            }
          }
          break;
        }
      }
      return leadingZeros;
    } catch (error) {
      Logger.error('Hash difficulty calculation failed:', error);
      throw new TransactionValidationError(
        'Difficulty calculation failed',
        'DIFFICULTY_ERROR',
      );
    }
  }

  private static async verifyInputSignature(
    input: TxInput,
    txId: string,
  ): Promise<boolean> {
    if (!input?.signature || !input?.publicKey) {
      throw new TransactionValidationError(
        'Missing signature data',
        'INVALID_SIGNATURE',
      );
    }

    return HybridCrypto.verify(txId, input.signature, input.publicKey);
  }

  /**
   * Validates transaction size against network limits
   */
  public static validateTransactionSize(tx: Transaction): boolean {
    try {
      const txSize = this.calculateTransactionSize(tx);
      return txSize <= BLOCKCHAIN_CONSTANTS.MINING.MAX_TX_SIZE;
    } catch (error) {
      Logger.error('Transaction size validation failed:', error);
      return false;
    }
  }

  /**
   * Calculates required transaction fee based on size
   */
  public static calculateTransactionFee(tx: Transaction): bigint {
    try {
      const txSize = this.calculateTransactionSize(tx);
      return BigInt(txSize) * BLOCKCHAIN_CONSTANTS.MINING.MIN_FEE_PER_BYTE;
    } catch (error) {
      Logger.error('Transaction fee calculation failed:', error);
      throw new TransactionValidationError(
        'Fee calculation failed',
        'FEE_CALCULATION_ERROR',
      );
    }
  }

  /**
   * Calculates transaction size in bytes
   */
  public static calculateTransactionSize(tx: Transaction): number {
    try {
      // Create a sanitized copy for size calculation
      const sizingTx = {
        id: tx.id,
        version: tx.version,
        type: tx.type,
        timestamp: tx.timestamp,
        sender: tx.sender,
        nonce: tx.nonce,
        inputs: tx.inputs,
        outputs: tx.outputs,
        signature: tx.signature,
      };

      // Convert to buffer to get actual byte size
      return Buffer.from(JSON.stringify(sizingTx)).length;
    } catch (error) {
      Logger.error('Transaction size calculation failed:', error);
      throw new TransactionValidationError(
        'Size calculation failed',
        'SIZE_CALCULATION_ERROR',
      );
    }
  }

  /**
   * Validates transaction version
   */
  public static validateTransactionVersion(tx: Transaction): boolean {
    try {
      if (!tx.version) {
        throw new TransactionValidationError(
          'Missing transaction version',
          'MISSING_VERSION',
        );
      }

      return (
        tx.version >= BLOCKCHAIN_CONSTANTS.TRANSACTION.MIN_TX_VERSION &&
        tx.version <= BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_TX_VERSION
      );
    } catch (error) {
      Logger.error('Transaction version validation failed:', error);
      return false;
    }
  }
}
