import { Logger } from '@h3tag-blockchain/shared';
import { HybridCrypto, KeyManager } from '@h3tag-blockchain/crypto';
import { Block } from './block.model';
import { EventEmitter } from 'events';
import { BLOCKCHAIN_CONSTANTS } from '../blockchain/utils/constants';
import { MerkleTree } from '../utils/merkle';
import { Mutex } from 'async-mutex';
import { Transaction } from './transaction.model';
import { BlockchainSchema } from '../database/blockchain-schema';
import { UTXODatabase } from '../database/uxo-schema';
import { databaseConfig } from '../database/config.database';

enum OpCode {
  // Stack operations
  OP_DUP = 0x76,
  OP_HASH160 = 0xa9,
  OP_EQUAL = 0x87,
  OP_EQUALVERIFY = 0x88,
  OP_CHECKSIG = 0xac,
  OP_0 = 0x00,

  // Size prefixes
  PUSH_20 = 0x14, // Push 20 bytes
  PUSH_32 = 0x20, // Push 32 bytes
}

/**
 * @fileoverview UTXO (Unspent Transaction Output) model definitions for the H3Tag blockchain.
 * Includes UTXO structure, set management, and validation logic for transaction inputs/outputs.
 *
 * @module UTXOModel
 */

/**
 * @class UTXOError
 * @extends Error
 * @description Custom error class for UTXO-related errors
 *
 * @example
 * throw new UTXOError("Invalid UTXO structure");
 */

export class UTXOError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UTXOError';
  }
}

/**
 * @interface UTXO
 * @description Represents an unspent transaction output in the blockchain
 *
 * @property {string} txId - Transaction ID containing this UTXO
 * @property {number} outputIndex - Index of this output in the transaction
 * @property {string} address - Address owning this UTXO
 * @property {bigint} amount - Amount of currency in this UTXO
 * @property {string} script - Locking script
 * @property {string} publicKey - Public key associated with the address
 * @property {string} [signature] - Optional signature for the UTXO
 * @property {number} blockHeight - Block height where this UTXO was created
 * @property {number} timestamp - Creation timestamp
 * @property {number} confirmations - Number of confirmations
 * @property {boolean} spent - Whether this UTXO has been spent
 * @property {Object} currency - Currency information
 */
export interface UTXO {
  /** Unique identifier of the transaction this UTXO belongs to */
  txId: string;

  /** Index of this output in the transaction's output array */
  outputIndex: number;

  /** Amount of TAG stored in this UTXO (in smallest unit) */
  amount: bigint;

  /** Address of the UTXO owner */
  address: string;

  /** Locking script that must be satisfied to spend this UTXO */
  script: string;

  /** Unix timestamp when this UTXO was created */
  timestamp: number;

  /** Optional hybrid cryptographic signature */
  signature?: string;

  /** Whether this UTXO has been spent */
  spent: boolean;

  /** Currency type - always TAG for H3Tag blockchain */
  currency: {
    name: string;
    symbol: string;
    decimals: number;
  };

  /** Block height where this UTXO was created */
  blockHeight?: number;

  /** Merkle root of the UTXO */
  merkleRoot?: string;

  /** Public key associated with the UTXO */
  publicKey: string;

  confirmations: number; // Number of block confirmations
}

/**
 * Script types supported by the system
 */
enum ScriptType {
  P2PKH = 'p2pkh', // Pay to Public Key Hash
  P2SH = 'p2sh', // Pay to Script Hash
  P2WPKH = 'p2wpkh', // Pay to Witness Public Key Hash
  P2WSH = 'p2wsh', // Pay to Witness Script Hash
}

/**
 * @interface ListUnspentOptions
 * @description Options for listing unspent transaction outputs (UTXOs)
 *
 * @property {number} [minConfirmations] - Minimum number of confirmations required
 * @property {number} [maxConfirmations] - Maximum number of confirmations to include
 * @property {string[]} [addresses] - List of addresses to filter UTXOs by
 * @property {bigint} [minAmount] - Minimum amount in smallest currency unit
 * @property {bigint} [maxAmount] - Maximum amount in smallest currency unit
 * @property {boolean} [includeUnsafe] - Whether to include UTXOs that might be unsafe
 * @property {Object} [queryOptions] - Pagination options
 * @property {number} [queryOptions.limit] - Maximum number of UTXOs to return
 * @property {number} [queryOptions.offset] - Number of UTXOs to skip
 *
 * @example
 * const options: ListUnspentOptions = {
 *   minConfirmations: 6,
 *   addresses: ["addr1", "addr2"],
 *   minAmount: BigInt(1000),
 *   queryOptions: { limit: 10 }
 * };
 */
export interface ListUnspentOptions {
  minConfirmations?: number;
  maxConfirmations?: number;
  addresses?: string[];
  minAmount?: bigint;
  maxAmount?: bigint;
  includeUnsafe?: boolean;
  queryOptions?: {
    limit?: number;
    offset?: number;
  };
}

/**
 * @interface TxOutInfo
 * @description Detailed information about a transaction output
 *
 * @property {string} bestblock - Hash of the best block
 * @property {number} confirmations - Number of confirmations
 * @property {bigint} amount - Output amount
 * @property {Object} scriptPubKey - Output script information
 * @property {string} scriptPubKey.asm - Script assembly
 * @property {string} scriptPubKey.hex - Script hex
 * @property {string} scriptPubKey.type - Script type
 * @property {string} scriptPubKey.address - Associated address
 * @property {boolean} coinbase - Whether this is a coinbase output
 * @property {number} timestamp - Creation timestamp
 */
export interface TxOutInfo {
  bestblock: string; // Block hash of the block containing this UTXO
  confirmations: number; // Number of confirmations
  amount: bigint; // Amount in smallest unit
  scriptPubKey: {
    // Information about the output script
    asm: string; // Script in assembly format
    hex: string; // Script in hex format
    type: string; // Type of script (e.g., 'pubkeyhash')
    address: string; // Associated address
  };
  coinbase: boolean; // Whether this is a coinbase transaction
  timestamp?: number; // Timestamp when this UTXO was created
}

/**
 * @interface UTXOSet
 * @description Manages a set of UTXOs with query and update capabilities
 *
 * @property {Map<string, UTXO>} cache - In-memory cache of UTXOs
 * @property {Map<string, number>} cacheTimestamps - Timestamps for cache entries
 * @property {number} CACHE_EXPIRY - Cache expiration time in milliseconds
 *
 * @method get - Retrieves a UTXO by txId and outputIndex
 * @method add - Adds a new UTXO to the set
 * @method remove - Removes a UTXO from the set
 * @method getBalance - Gets total balance for an address
 * @method getUTXOs - Gets all UTXOs for an address
 */
export class UTXOSet {
  private readonly eventEmitter = new EventEmitter();
  private static readonly CACHE_DURATION = 1000;
  private static readonly MAX_UTXOS = 10000;
  private utxos: Map<string, UTXO> = new Map();
  private readonly merkleTree: MerkleTree;
  private height: number = 0;
  private heightCache: { value: number; timestamp: number } | null = null;
  private lastOperationTimestamp = 0;
  private readonly MIN_OPERATION_INTERVAL = 100; // ms
  private addressIndex: Map<string, Set<string>> = new Map();
  private verificationCache: Map<string, boolean> = new Map();
  private static readonly BATCH_SIZE = 100;
  private static readonly VERIFICATION_TIMEOUT = 5000; // 5 seconds
  private readonly mutex = new Mutex();
  private merkleRoot: string = '';
  private readonly db: UTXODatabase;
  private cache: Map<string, UTXO[]> = new Map();
  private blockchainSchema: BlockchainSchema;
  private readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps: Map<string, number> = new Map();
  private readonly VERIFICATION_CACHE_MAX_SIZE = 10000;

  constructor() {
    this.utxos = new Map();
    this.merkleTree = new MerkleTree();
    this.db = new UTXODatabase(databaseConfig.databases.utxo.path);

    // Set up periodic cache cleanup
    setInterval(() => this.cleanExpiredCache(), 5 * 60 * 1000); // Clean every 5 minutes
  }

  private async createUtxoMerkleRoot(): Promise<string> {
    try {
      const utxoData = Array.from(this.utxos.values()).map(
        (utxo) =>
          `${utxo.txId}:${utxo.outputIndex}:${utxo.amount}:${utxo.address}`,
      );
      return await this.merkleTree.createRoot(utxoData);
    } catch (error) {
      Logger.error('Failed to create UTXO merkle root:', error);
      throw new UTXOError('Failed to create merkle root');
    }
  }

  /**
   * Add a UTXO to the set
   */
  async add(utxo: UTXO): Promise<void> {
    try {
      await this.mutex.waitForUnlock();
      // Check rate limit
      if (!this.checkRateLimit()) {
        throw new UTXOError('Rate limit exceeded');
      }

      // Enforce size limits
      this.enforceSetLimits();

      if (!UTXOSet.validateUtxo(utxo)) {
        throw new UTXOError('Invalid UTXO');
      }

      const key = this.getUtxoKey(utxo);
      if (this.utxos.has(key)) {
        throw new UTXOError('UTXO already exists');
      }

      const signedUtxo = await this.signUtxo({
        ...utxo,
        merkleRoot: await this.createUtxoMerkleRoot(),
        currency: {
          name: BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
          symbol: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
          decimals: BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
        },
      });

      this.utxos.set(this.getUtxoKey(utxo), signedUtxo);
      this.eventEmitter.emit('utxo_added', signedUtxo);
    } finally {
      this.mutex.release();
    }
  }

  private async signUtxo(utxo: UTXO): Promise<UTXO> {
    try {
      const data = Buffer.from(
        JSON.stringify({
          txId: utxo.txId,
          outputIndex: utxo.outputIndex,
          amount: utxo.amount.toString(),
          address: utxo.address,
          timestamp: utxo.timestamp,
        }),
      );

      const keyPair = await HybridCrypto.generateKeyPair();
      const signature = await HybridCrypto.sign(data.toString(), keyPair);

      return {
        ...utxo,
        signature: JSON.stringify(signature),
      };
    } catch (error) {
      Logger.error('UTXO signing failed:', error);
      throw new UTXOError('Failed to sign UTXO');
    }
  }

  /**
   * Find UTXOs for a specific amount
   */
  async findUtxosForAmount(
    address: string,
    targetAmount: bigint,
  ): Promise<UTXO[]> {
    try {
      let sum = BigInt(0);
      const result: UTXO[] = [];

      const addressUtxos = this.getByAddress(address).sort((a, b) =>
        Number(b.amount - a.amount),
      );

      for (const utxo of addressUtxos) {
        if (!(await this.verifyUtxo(utxo))) {
          Logger.warn('Invalid UTXO found:', utxo.txId);
          continue;
        }
        result.push(utxo);
        sum += utxo.amount;
        if (sum >= targetAmount) break;
      }

      if (sum < targetAmount) {
        throw new UTXOError('Insufficient funds');
      }

      return result;
    } catch (error) {
      Logger.error('UTXO search failed:', error);
      throw new UTXOError(
        error instanceof Error ? error.message : 'Failed to find UTXOs',
      );
    }
  }

  /**
   * Verify a UTXO's integrity
   */
  async verifyUtxo(utxo: UTXO): Promise<boolean> {
    try {
      if (!utxo || !utxo.txId || !utxo.merkleRoot) {
        return false;
      }

      // Verify merkle proof
      const utxoData = `${utxo.txId}:${utxo.outputIndex}:${utxo.amount}:${utxo.address}`;
      const isValidMerkle = await this.merkleTree.verify(utxo.merkleRoot, [
        utxoData,
      ]);
      if (!isValidMerkle) return false;

      // Verify signatures
      if (!utxo.signature || !utxo.publicKey) return false;
      return await this.verifySignatures(utxo);
    } catch (error) {
      Logger.error('UTXO verification failed:', error);
      return false;
    }
  }

  /**
   * Remove a UTXO from the set
   */
  public remove(utxo: UTXO): boolean {
    try {
      if (!utxo || !UTXOSet.validateUtxo(utxo)) {
        throw new UTXOError('Invalid UTXO for removal');
      }

      const key = this.getUtxoKey(utxo);
      const exists = this.utxos.has(key);
      if (!exists) return false;

      // Remove from main set and index
      const success = this.utxos.delete(key);
      if (success) {
        this.removeFromIndex(utxo);
        this.eventEmitter.emit('utxo_removed', utxo);
      }

      return success;
    } catch (error) {
      Logger.error('Error removing UTXO:', error);
      return false;
    }
  }

  /**
   * Get all UTXOs for a specific address
   */
  public getByAddress(address: string): UTXO[] {
    try {
      if (!address || typeof address !== 'string') {
        throw new UTXOError('Invalid address');
      }

      return Array.from(this.utxos.values())
        .filter((utxo) => !utxo.spent && utxo.address === address)
        .map((utxo) => ({ ...utxo })); // Return defensive copies
    } catch (error) {
      Logger.error('Error retrieving UTXOs by address:', error);
      return [];
    }
  }

  /**
   * Get total balance for an address
   */
  public getBalance(address: string): bigint {
    try {
      if (!address || typeof address !== 'string') {
        throw new UTXOError('Invalid address');
      }

      return this.getByAddress(address).reduce(
        (sum, utxo) => sum + utxo.amount,
        BigInt(0),
      );
    } catch (error) {
      Logger.error('Error calculating address balance:', error);
      return BigInt(0);
    }
  }

  /**
   * Get a specific UTXO by its ID and index
   */
  getUtxo(txId: string, outputIndex: number): UTXO | undefined {
    const key = this.generateKey(txId, outputIndex);
    return this.utxos.get(key);
  }

  /**
   * Check if a UTXO exists
   */
  exists(txId: string, outputIndex: number): boolean {
    const key = this.generateKey(txId, outputIndex);
    return this.utxos.has(key);
  }

  /**
   * Get all UTXOs in the set
   */
  public getAllUtxos(): UTXO[] {
    try {
      // Return a defensive copy of unspent UTXOs
      return Array.from(this.utxos.values())
        .filter((utxo) => !utxo.spent)
        .map((utxo) => ({ ...utxo }));
    } catch (error) {
      Logger.error('Error retrieving UTXOs:', error);
      return [];
    }
  }

  /**
   * Clear all UTXOs
   */
  public clear(): void {
    try {
      this.utxos.clear();
      this.height = 0; // Reset height
      Logger.info('UTXO set cleared successfully');
    } catch (error) {
      Logger.error('Error clearing UTXO set:', error);
      throw new UTXOError('Failed to clear UTXO set');
    }
  }

  /**
   * Get the size of the UTXO set
   */
  public size(): number {
    try {
      return Array.from(this.utxos.values()).filter((utxo) => !utxo.spent)
        .length;
    } catch (error) {
      Logger.error('Error calculating UTXO set size:', error);
      return 0;
    }
  }

  /**
   * Generate a unique key for a UTXO
   */
  private getUtxoKey(utxo: UTXO): string {
    try {
      if (!utxo?.txId || typeof utxo.outputIndex !== 'number') {
        throw new UTXOError('Invalid UTXO for key generation');
      }
      return this.generateKey(utxo.txId, utxo.outputIndex);
    } catch (error) {
      Logger.error('Error generating UTXO key:', error);
      throw new UTXOError('Failed to generate UTXO key');
    }
  }

  /**
   * Generate a unique key from txId and outputIndex
   */
  private generateKey(txId: string, outputIndex: number): string {
    try {
      if (!txId || typeof outputIndex !== 'number' || outputIndex < 0) {
        throw new UTXOError('Invalid parameters for key generation');
      }
      return `${txId.toLowerCase()}:${outputIndex}`;
    } catch (error) {
      Logger.error('Error generating key:', error);
      throw new UTXOError('Failed to generate key');
    }
  }

  getUTXOsForAddress(address: string): UTXO[] {
    return Array.from(this.utxos.values()).filter(
      (utxo) => utxo.address === address,
    );
  }

  /**
   * Validate a UTXO's structure and data types
   */
  static validateUtxo(utxo: UTXO): boolean {
    try {
      if (!utxo || typeof utxo !== 'object') {
        return false;
      }

      const validations = [
        { field: 'txId', type: 'string', minLength: 1 },
        { field: 'outputIndex', type: 'number', minValue: 0 },
        { field: 'amount', type: 'bigint', minValue: BigInt(1) },
        { field: 'address', type: 'string', minLength: 1 },
        { field: 'script', type: 'string' },
        { field: 'timestamp', type: 'number', minValue: 1 },
        { field: 'spent', type: 'boolean' },
        { field: 'currency', type: 'object' },
        {
          field: 'currency.name',
          type: 'string',
          value: BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
        },
        {
          field: 'currency.symbol',
          type: 'string',
          value: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        },
        {
          field: 'currency.decimals',
          type: 'number',
          value: BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
        },
      ];

      return validations.every(({ field, type, minLength, minValue }) => {
        const value = utxo[field as keyof UTXO];

        if (typeof value !== type) return false;
        if (minLength && typeof value === 'string' && value.length < minLength)
          return false;
        if (minValue && typeof value === 'number' && value < minValue)
          return false;
        if (minValue && typeof value === 'bigint' && value < minValue)
          return false;
        if (
          value &&
          typeof value === 'object' &&
          'name' in value &&
          value.name !== BLOCKCHAIN_CONSTANTS.CURRENCY.NAME
        )
          return false;
        if (
          value &&
          typeof value === 'object' &&
          'symbol' in value &&
          value.symbol !== BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL
        )
          return false;
        if (
          value &&
          typeof value === 'object' &&
          'decimals' in value &&
          value.decimals !== BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS
        )
          return false;

        return true;
      });
    } catch (error) {
      Logger.error('UTXO validation failed:', error);
      return false;
    }
  }

  /**
   * Get current UTXO set height
   */
  public getHeight(): number {
    try {
      // Check cache first
      if (
        this.heightCache &&
        Date.now() - this.heightCache.timestamp < UTXOSet.CACHE_DURATION
      ) {
        return this.heightCache.value;
      }

      // Update cache
      this.heightCache = {
        value: this.height,
        timestamp: Date.now(),
      };

      return this.height;
    } catch (error) {
      Logger.error('Error getting UTXO set height:', error);
      return this.heightCache?.value || 0;
    }
  }

  public async verifyBalance(
    address: string,
    amount: bigint,
  ): Promise<boolean> {
    const utxos = this.getUTXOsForAddress(address);
    const totalBalance = utxos.reduce(
      (sum, utxo) => sum + utxo.amount,
      BigInt(0),
    );
    return totalBalance >= amount;
  }

  public async applyBlock(block: Block): Promise<void> {
    try {
      // Remove spent UTXOs
      for (const tx of block.transactions) {
        for (const input of tx.inputs) {
          await this.removeUTXO(input.txId, input.outputIndex);
        }
      }

      // Batch process new UTXOs
      const newUtxos = block.transactions.flatMap((tx) =>
        tx.outputs.map((output, index) => ({
          txHash: tx.hash,
          outputIndex: index,
          amount: output.amount,
          address: output.address,
          publicKey: tx.sender,
        })),
      );

      // Add UTXOs in batch
      await Promise.all(newUtxos.map((utxo) => this.addUTXO(utxo)));

      // Clean cache after block application
      this.cleanExpiredCache();
    } catch (error) {
      Logger.error('Failed to apply block to UTXO set:', error);
      throw error;
    }
  }

  /**
   * Add a new UTXO to the set with validation and error handling
   */
  private async addUTXO(utxo: {
    txHash: string;
    outputIndex: number;
    amount: bigint;
    address: string;
    publicKey: string;
  }): Promise<void> {
    try {
      if (
        !utxo.txHash ||
        !utxo.address ||
        utxo.outputIndex < 0 ||
        utxo.amount <= 0
      ) {
        throw new UTXOError('Invalid UTXO parameters');
      }

      const key = this.generateKey(utxo.txHash, utxo.outputIndex);

      if (this.utxos.has(key)) {
        throw new UTXOError('UTXO already exists');
      }

      // Generate appropriate locking script based on address type
      const script = await this.generateLockingScript(utxo.address);

      const newUtxo: UTXO = {
        txId: utxo.txHash,
        outputIndex: utxo.outputIndex,
        amount: utxo.amount,
        address: utxo.address,
        script,
        timestamp: Date.now(),
        spent: false,
        currency: {
          name: BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
          symbol: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
          decimals: BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
        },
        publicKey: utxo.publicKey,
        confirmations: 0,
      };

      if (!UTXOSet.validateUtxo(newUtxo)) {
        throw new UTXOError('UTXO validation failed');
      }

      await this.add(newUtxo);
      Logger.debug('UTXO added successfully:', key);
    } catch (error) {
      Logger.error('Failed to add UTXO:', error);
      throw new UTXOError(
        error instanceof Error ? error.message : 'Failed to add UTXO',
      );
    }
  }

  /**
   * Generate appropriate locking script based on address type
   */
  private async generateLockingScript(address: string): Promise<string> {
    try {
      if (!address || typeof address !== 'string') {
        throw new UTXOError('Invalid address for script generation');
      }

      // Version control for future script upgrades
      const scriptVersion = '01';

      // Generate address hash
      const addressHash = await KeyManager.addressToHash(address);

      let scriptElements: string[];

      if (address.startsWith('TAG1')) {
        // Native SegWit equivalent
        scriptElements = ['0', addressHash];
      } else if (address.startsWith('TAG3')) {
        // P2SH equivalent
        scriptElements = ['OP_HASH160', addressHash, 'OP_EQUAL'];
      } else if (address.startsWith('TAG')) {
        // Legacy P2PKH
        scriptElements = [
          'OP_DUP',
          'OP_HASH160',
          addressHash,
          'OP_EQUALVERIFY',
          'OP_CHECKSIG',
        ];
      } else {
        throw new UTXOError('Unsupported address format');
      }

      // Build script
      const script = scriptElements.join(' ');

      return `${scriptVersion}:${script}`;
    } catch (error) {
      Logger.error('Error generating locking script:', error);
      throw new UTXOError('Failed to generate locking script');
    }
  }

  /**
   * Detect address type from address string
   */
  private detectAddressType(address: string): ScriptType {
    try {
      // Check address prefix or format to determine type
      if (address.startsWith('1')) return ScriptType.P2PKH;
      if (address.startsWith('3')) return ScriptType.P2SH;
      if (address.startsWith('bc1q')) return ScriptType.P2WPKH;
      if (address.startsWith('bc1p')) return ScriptType.P2WSH;

      // Default to P2PKH if unable to determine
      Logger.warn('Unable to determine address type, defaulting to P2PKH');
      return ScriptType.P2PKH;
    } catch (error) {
      Logger.error('Error detecting address type:', error);
      return ScriptType.P2PKH;
    }
  }

  private async removeUTXO(txHash: string, outputIndex: number): Promise<void> {
    const key = this.generateKey(txHash, outputIndex);
    const utxo = this.utxos.get(key);
    if (utxo) {
      utxo.spent = true;
      this.utxos.delete(key);
    }
  }

  async get(txId: string, outputIndex: number): Promise<UTXO | null> {
    const key = `${txId}:${outputIndex}`;
    return this.utxos.get(key) || null;
  }

  async set(txId: string, outputIndex: number, utxo: UTXO): Promise<void> {
    const key = `${txId}:${outputIndex}`;
    this.utxos.set(key, utxo);
  }

  /**
   * Get total value of all unspent outputs
   */
  public getTotalValue(): bigint {
    try {
      return Array.from(this.utxos.values())
        .filter((utxo) => !utxo.spent)
        .reduce((sum, utxo) => sum + utxo.amount, BigInt(0));
    } catch (error) {
      Logger.error('Error calculating total UTXO value:', error);
      return BigInt(0);
    }
  }

  public validate(): boolean {
    try {
      return Array.from(this.utxos.values()).every(
        (utxo) => UTXOSet.validateUtxo(utxo) && this.verifyUtxo(utxo),
      );
    } catch (error) {
      Logger.error('UTXO set validation failed:', error);
      return false;
    }
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    if (now - this.lastOperationTimestamp < this.MIN_OPERATION_INTERVAL) {
      return false;
    }
    this.lastOperationTimestamp = now;
    return true;
  }

  private enforceSetLimits(): void {
    if (this.size() > UTXOSet.MAX_UTXOS) {
      throw new UTXOError('UTXO set size limit exceeded');
    }
  }

  public async addBatch(utxos: UTXO[]): Promise<void> {
    await Promise.all(utxos.map((utxo) => this.add(utxo)));
  }

  private indexByAddress(utxo: UTXO): void {
    const addressUtxos = this.addressIndex.get(utxo.address) || new Set();
    addressUtxos.add(this.getUtxoKey(utxo));
    this.addressIndex.set(utxo.address, addressUtxos);
  }

  public async verifySignatures(utxo: UTXO): Promise<boolean> {
    try {
      const cacheKey = `verify:${utxo.txId}:${utxo.outputIndex}`;

      // Check cache first
      const cached = this.verificationCache.get(cacheKey);
      if (cached !== undefined) return cached;

      // Implement cache size management before adding new entries
      if (this.verificationCache.size >= this.VERIFICATION_CACHE_MAX_SIZE) {
        // Clear oldest 20% of entries
        const entriesToDelete = Math.floor(
          this.VERIFICATION_CACHE_MAX_SIZE * 0.2,
        );
        const entries = Array.from(this.verificationCache.keys());
        for (let i = 0; i < entriesToDelete; i++) {
          this.verificationCache.delete(entries[i]);
        }
      }

      // Prepare data once for verification
      const data = Buffer.from(
        JSON.stringify({
          txId: utxo.txId,
          outputIndex: utxo.outputIndex,
          amount: utxo.amount.toString(),
          address: utxo.address,
          timestamp: utxo.timestamp,
        }),
      );

      // Run verification
      const isValidSignature = await HybridCrypto.verify(
        data.toString(),
        JSON.parse(utxo.signature),
        JSON.parse(utxo.publicKey),
      );

      // Cache and return result
      this.verificationCache.set(cacheKey, isValidSignature);
      return isValidSignature;
    } catch (error) {
      Logger.error('UTXO signature verification failed:', error);
      return false;
    }
  }

  async verifyBatch(utxos: UTXO[]): Promise<boolean[]> {
    return Promise.all(
      utxos
        .map((utxo) => this.verifyWithTimeout(utxo))
        .map((p) => p.catch(() => false)),
    );
  }

  private async verifyWithTimeout(utxo: UTXO): Promise<boolean> {
    try {
      return await Promise.race([
        this.verifySignatures(utxo),
        new Promise<boolean>((_, reject) =>
          setTimeout(
            () => reject('Verification timeout'),
            UTXOSet.VERIFICATION_TIMEOUT,
          ),
        ),
      ]);
    } catch {
      return false;
    }
  }

  private removeFromIndex(utxo: UTXO): void {
    const addressSet = this.addressIndex.get(utxo.address);
    if (addressSet) {
      addressSet.delete(this.getUtxoKey(utxo));
      if (addressSet.size === 0) {
        this.addressIndex.delete(utxo.address);
      }
    }
  }

  public async revertTransaction(tx: Transaction): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      // Start atomic operation
      await this.db.startTransaction();

      // Track changes for rollback
      const changes: { type: 'unspend' | 'remove'; utxo: UTXO }[] = [];

      // Unspend inputs
      for (const input of tx.inputs) {
        const utxo = await this.get(input.txId, input.outputIndex);
        if (utxo) {
          changes.push({ type: 'unspend', utxo: { ...utxo } });
          utxo.spent = false;
          await this.set(input.txId, input.outputIndex, utxo);
          this.removeFromIndex(utxo); // Update indexes
        }
      }

      // Remove created outputs
      for (let i = 0; i < tx.outputs.length; i++) {
        const utxo: UTXO = {
          txId: tx.id,
          outputIndex: i,
          amount: tx.outputs[i].amount,
          address: tx.outputs[i].address,
          script: tx.outputs[i].script,
          timestamp: tx.timestamp, // Use tx timestamp instead of current time
          spent: false,
          currency: {
            name: BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
            symbol: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
            decimals: BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
          },
          publicKey: tx.outputs[i].publicKey,
          confirmations: 0,
        };
        changes.push({ type: 'remove', utxo });
        await this.remove(utxo);
        this.removeFromIndex(utxo);
      }

      // Update merkle tree
      await this.updateMerkleTree();

      // Commit changes
      await this.db.commitTransaction();

      // Emit events
      this.eventEmitter.emit('transaction_reverted', {
        txId: tx.id,
        timestamp: Date.now(),
        changes,
      });

      Logger.info('Transaction reverted successfully', {
        txId: tx.id,
        inputCount: tx.inputs.length,
        outputCount: tx.outputs.length,
      });
    } catch (error) {
      // Rollback on failure
      await this.db.rollbackTransaction();

      Logger.error('Failed to revert transaction:', {
        error,
        txId: tx.id,
      });

      throw new UTXOError(
        `Failed to revert transaction ${tx.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    } finally {
      release();
      this.cleanupCache(); // Cleanup any cached data
    }
  }

  async spendUTXO(txId: string, outputIndex: number): Promise<boolean> {
    const release = await this.mutex.acquire();
    try {
      const utxo = await this.get(txId, outputIndex);

      // Check if UTXO exists and isn't already spent
      if (!utxo || utxo.spent) {
        return false;
      }

      // Verify UTXO before spending
      if (!(await this.verifyUtxo(utxo))) {
        throw new UTXOError('Invalid UTXO');
      }

      // Mark as spent and update
      utxo.spent = true;
      await this.set(txId, outputIndex, utxo);
      this.eventEmitter.emit('utxo_spent', utxo);

      return true;
    } finally {
      release();
    }
  }

  async applyTransaction(tx: Transaction): Promise<boolean> {
    const release = await this.mutex.acquire();
    try {
      // Add input validation
      if (
        !tx ||
        !tx.id ||
        !Array.isArray(tx.inputs) ||
        !Array.isArray(tx.outputs)
      ) {
        throw new UTXOError('Invalid transaction format');
      }

      // Add total input/output amount validation
      const inputAmount = await this.calculateInputAmount(tx.inputs);
      const outputAmount = tx.outputs.reduce(
        (sum, output) => sum + output.amount,
        BigInt(0),
      );

      if (inputAmount < outputAmount) {
        throw new UTXOError('Transaction inputs less than outputs');
      }

      // Verify all inputs exist and are unspent
      for (const input of tx.inputs) {
        const utxo = await this.get(input.txId, input.outputIndex);
        if (!utxo || utxo.spent || !this.isUtxoSafe(utxo)) {
          throw new UTXOError('Input UTXO not found or already spent');
        }
      }

      // Atomically spend inputs and create outputs
      for (const input of tx.inputs) {
        await this.spendUTXO(input.txId, input.outputIndex);
      }

      // Create new UTXOs for outputs
      for (let i = 0; i < tx.outputs.length; i++) {
        const output = tx.outputs[i];
        await this.add({
          txId: tx.id,
          outputIndex: i,
          amount: output.amount,
          address: output.address,
          script: output.script,
          timestamp: Date.now(),
          spent: false,
          currency: {
            name: BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
            symbol: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
            decimals: BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
          },
          publicKey: output.publicKey,
          confirmations: 0,
        });
      }

      return true;
    } catch (error) {
      // Rollback on failure
      await this.rollbackTransaction(tx);
      throw error;
    } finally {
      release();
    }
  }

  private async calculateInputAmount(
    inputs: Array<{ txId: string; outputIndex: number }>,
  ): Promise<bigint> {
    let total = BigInt(0);
    for (const input of inputs) {
      const utxo = await this.get(input.txId, input.outputIndex);
      if (!utxo) {
        throw new UTXOError(
          `Input UTXO not found: ${input.txId}:${input.outputIndex}`,
        );
      }
      total += utxo.amount;
    }
    return total;
  }

  private async updateMerkleTree(): Promise<void> {
    try {
      const utxoData = Array.from(this.utxos.values()).map((utxo) =>
        JSON.stringify({
          txId: utxo.txId,
          outputIndex: utxo.outputIndex,
          amount: utxo.amount.toString(),
          address: utxo.address,
        }),
      );

      this.merkleRoot = await this.merkleTree.createRoot(utxoData);
      Logger.debug('Updated UTXO merkle tree', { root: this.merkleRoot });
    } catch (error) {
      Logger.error('Failed to update merkle tree:', error);
      throw new UTXOError('Failed to update merkle tree');
    }
  }

  private cleanupCache(): void {
    this.heightCache = null;
    this.verificationCache.clear();
    this.merkleTree.clearCache();
  }

  private async rollbackTransaction(tx: Transaction): Promise<void> {
    try {
      await this.db.rollbackTransaction();
      await this.revertTransaction(tx);
      this.cleanExpiredCache(); // Clean cache after rollback
    } catch (error) {
      Logger.error('Failed to rollback transaction:', error);
      throw new UTXOError('Rollback failed');
    }
  }

  public async findUtxosForVoting(address: string): Promise<UTXO[]> {
    const release = await this.mutex.acquire();
    try {
      // Clean expired entries before checking cache
      this.cleanExpiredCache();

      // Check cache first
      const cacheKey = `voting_utxos:${address}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      // Find eligible UTXOs
      const utxos = Array.from(this.utxos.values()).filter((utxo) => {
        const meetsMinAmount =
          utxo.amount >= BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_VOTING_POWER;
        const isUnspent = !utxo.spent;
        const isCorrectAddress = utxo.address === address;
        const isMatured =
          Date.now() - utxo.timestamp >=
          BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MATURITY_PERIOD;

        return meetsMinAmount && isUnspent && isCorrectAddress && isMatured;
      });

      // Verify UTXOs in parallel
      const verificationResults = await Promise.all(
        utxos.map((utxo) => this.verifyUtxo(utxo)),
      );

      const validUtxos = utxos.filter((_, index) => verificationResults[index]);

      // Cache results
      this.cache.set(cacheKey, validUtxos);
      this.cacheTimestamps.set(cacheKey, Date.now());

      Logger.debug('Found voting UTXOs', {
        address,
        count: validUtxos.length,
        totalAmount: validUtxos.reduce(
          (sum, utxo) => sum + utxo.amount,
          BigInt(0),
        ),
      });

      return validUtxos;
    } catch (error) {
      Logger.error('Failed to find voting UTXOs:', {
        error,
        address,
      });
      return [];
    } finally {
      release();
    }
  }

  public calculateVotingPower(utxos: UTXO[]): bigint {
    try {
      if (!Array.isArray(utxos) || utxos.length === 0) {
        return BigInt(0);
      }

      // Add safety check for maximum array length
      if (utxos.length > 1000) {
        Logger.warn('Excessive number of UTXOs for voting power calculation');
        utxos = utxos.slice(0, 1000);
      }

      const totalPower = utxos.reduce((power, utxo) => {
        try {
          // Use BigInt throughout calculation to prevent overflow
          const amount = utxo.amount;
          if (amount <= BigInt(0)) {
            return power;
          }

          // Safe square root calculation for BigInt
          const sqrt = this.bigIntSqrt(amount);
          return power + sqrt;
        } catch (error) {
          Logger.error('Error calculating individual UTXO power:', {
            error,
            utxo: utxo.txId,
          });
          return power;
        }
      }, BigInt(0));

      return totalPower;
    } catch (error) {
      Logger.error('Failed to calculate voting power:', error);
      return BigInt(0);
    }
  }

  private bigIntSqrt(value: bigint): bigint {
    if (value < BigInt(0)) {
      throw new Error('Square root of negative numbers is not supported');
    }

    if (value < BigInt(2)) {
      return value;
    }

    let x0 = value / BigInt(2);
    let x1 = (x0 + value / x0) / BigInt(2);

    while (x1 < x0) {
      x0 = x1;
      x1 = (x0 + value / x0) / BigInt(2);
    }

    return x0;
  }

  /**
   * List unspent transaction outputs with filtering options
   * @param options Filtering options for listing UTXOs
   * @returns Promise<UTXO[]> Array of matching UTXOs
   */
  public async listUnspent(options: ListUnspentOptions = {}): Promise<UTXO[]> {
    const release = await this.mutex.acquire();
    try {
      let utxos: UTXO[] = [];

      if (options.addresses?.length) {
        // Get UTXOs for specific addresses
        for (const address of options.addresses) {
          const addressUtxos = await this.db.getUnspentUTXOs(address);
          utxos.push(...addressUtxos);
        }
      } else {
        // Get all UTXOs if no addresses specified
        const allAddresses = await this.db.getAllAddresses();
        for (const address of allAddresses) {
          const addressUtxos = await this.db.getUnspentUTXOs(address);
          utxos.push(...addressUtxos);
        }
      }

      // Apply filters
      utxos = utxos.filter((utxo) => {
        if (options.minAmount && utxo.amount < options.minAmount) return false;
        if (options.maxAmount && utxo.amount > options.maxAmount) return false;
        if (
          options.minConfirmations &&
          utxo.confirmations < options.minConfirmations
        )
          return false;
        return true;
      });

      // Apply pagination
      const { limit = 1000, offset = 0 } = options.queryOptions || {};
      utxos = utxos.slice(offset, offset + limit);

      return utxos;
    } finally {
      release();
    }
  }

  /**
   * Check if a UTXO is considered safe to spend
   * @param utxo UTXO to check
   * @returns boolean indicating if UTXO is safe
   */
  private isUtxoSafe(utxo: UTXO): boolean {
    try {
      // Check if UTXO has required confirmations
      if (!utxo.blockHeight) return false;

      const confirmations = this.getHeight() - utxo.blockHeight + 1;
      if (confirmations < BLOCKCHAIN_CONSTANTS.MIN_SAFE_CONFIRMATIONS) {
        return false;
      }

      // Check if UTXO has valid signature
      if (!utxo.signature || !utxo.publicKey) {
        return false;
      }

      // Check if UTXO amount is within safe limits
      if (
        utxo.amount <= BigInt(0) ||
        utxo.amount > BigInt(BLOCKCHAIN_CONSTANTS.MAX_SAFE_UTXO_AMOUNT)
      ) {
        return false;
      }

      // Check if UTXO script is standard
      if (!this.isStandardScript(utxo.script)) {
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Error checking UTXO safety:', error);
      return false;
    }
  }

  /**
   * Check if a script is considered standard
   * @param script Script to check
   * @returns boolean indicating if script is standard
   */
  private isStandardScript(script: string): boolean {
    try {
      // Check for standard script patterns
      return Object.values(ScriptType).some((type) => {
        switch (type) {
          case ScriptType.P2PKH:
            return script.startsWith('OP_DUP OP_HASH160');
          case ScriptType.P2SH:
            return script.startsWith('OP_HASH160');
          case ScriptType.P2WPKH:
          case ScriptType.P2WSH:
            return script.startsWith('OP_0');
          default:
            return false;
        }
      });
    } catch (error) {
      Logger.error('Error checking script standardness:', error);
      return false;
    }
  }

  /**
   * Get detailed information about an unspent transaction output
   * @param txId Transaction ID
   * @param n Output index
   * @param includeMempool Whether to include mempool transactions
   * @returns Detailed UTXO information or null if not found/spent
   */
  public async getTxOut(
    txId: string,
    n: number,
    includeMempool: boolean = true,
  ): Promise<TxOutInfo | null> {
    const release = await this.mutex.acquire();
    try {
      // Get the UTXO
      const utxo = await this.get(txId, n);

      // Return null if UTXO doesn't exist or is spent
      if (!utxo || utxo.spent) {
        return null;
      }

      // If not including mempool and UTXO is not confirmed, return null
      if (!includeMempool && !utxo.blockHeight) {
        return null;
      }

      // Check if this is a coinbase transaction
      const isCoinbase = await this.isCoinbaseTransaction(txId);

      // If it's a coinbase, check maturity
      if (isCoinbase && !(await this.isCoinbaseMature(txId))) {
        Logger.debug('Immature coinbase transaction', { txId });
        return null;
      }

      // Get the block information
      const blockInfo = await this.blockchainSchema.getBlockByHeight(
        utxo.blockHeight || 0,
      );

      // Parse the script
      const scriptInfo = this.parseScript(utxo.script);

      const txOutInfo: TxOutInfo = {
        bestblock: blockInfo?.hash || '',
        confirmations: utxo.confirmations || 0,
        amount: utxo.amount,
        scriptPubKey: {
          asm: scriptInfo.asm,
          hex: scriptInfo.hex,
          type: scriptInfo.type,
          address: utxo.address,
        },
        coinbase: isCoinbase,
        timestamp: utxo.timestamp,
      };

      Logger.debug('Retrieved UTXO information', {
        txId,
        outputIndex: n,
        amount: utxo.amount.toString(),
        confirmations: txOutInfo.confirmations,
        isCoinbase,
      });

      return txOutInfo;
    } catch (error) {
      Logger.error('Failed to get transaction output:', {
        error,
        txId,
        outputIndex: n,
      });
      throw new UTXOError(
        `Failed to get transaction output: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    } finally {
      release();
    }
  }

  /**
   * Parse a script into its components
   * @param script Script string to parse
   * @returns Parsed script information
   */
  private parseScript(script: string): {
    asm: string;
    hex: string;
    type: string;
  } {
    try {
      // Add input validation
      if (!script || typeof script !== 'string') {
        throw new Error('Invalid script input');
      }

      // Parse version and script content
      const [version, scriptContent] = script.split(':');
      if (!version || !scriptContent) {
        throw new Error('Invalid script format');
      }

      // Validate version
      if (version !== '01') {
        Logger.warn('Unsupported script version:', version);
        return {
          asm: '',
          hex: '',
          type: 'nonstandard',
        };
      }

      // Convert script content to hex while maintaining opcodes
      let hex: string;
      try {
        // Split the script into parts
        const parts = scriptContent.split(' ');
        const hexParts = parts.map((part) => {
          if (part.startsWith('OP_')) {
            // Convert opcode to hex
            return Buffer.from([OpCode[part as keyof typeof OpCode]]).toString(
              'hex',
            );
          } else {
            // Convert data to hex
            return Buffer.from(part, 'hex').toString('hex');
          }
        });
        hex = hexParts.join('');
      } catch {
        hex = '';
        Logger.error('Failed to convert script to hex');
      }

      // Determine script type based on content
      const type = this.determineScriptType(scriptContent);

      return {
        asm: scriptContent,
        hex,
        type,
      };
    } catch (error) {
      Logger.error('Failed to parse script:', error);
      return {
        asm: '',
        hex: '',
        type: 'nonstandard',
      };
    }
  }

  private determineScriptType(script: string): string {
    if (!script) return 'nonstandard';

    if (
      script.startsWith('OP_DUP OP_HASH160') &&
      script.includes('OP_EQUALVERIFY OP_CHECKSIG')
    ) {
      return 'p2pkh'; // Legacy address
    }
    if (script.startsWith('OP_HASH160') && script.endsWith('OP_EQUAL')) {
      return 'p2sh'; // Script hash
    }
    if (script.startsWith('0')) {
      // Check if it's P2WPKH or P2WSH based on the data length
      const parts = script.split(' ');
      if (parts.length === 2) {
        return parts[1].length === 40 ? 'p2wpkh' : 'p2wsh';
      }
    }

    return 'nonstandard';
  }

  /**
   * Check if a transaction is a coinbase transaction
   * A coinbase transaction must:
   * 1. Be the first transaction in a block
   * 2. Have exactly one input
   * 3. Have input txid of all zeros
   * 4. Have input vout index of 0xFFFFFFFF (-1)
   *
   * @param txId Transaction ID to check
   * @returns boolean indicating if transaction is coinbase
   */
  private async isCoinbaseTransaction(txId: string): Promise<boolean> {
    try {
      // Get the transaction from the blockchain
      const transaction = await this.blockchainSchema.getTransaction(txId);
      if (!transaction) {
        return false;
      }

      // Check if it's the first transaction in its block
      const block = await this.blockchainSchema.getBlockByHeight(
        transaction.blockHeight,
      );
      if (!block || block.transactions[0].id !== txId) {
        return false;
      }

      // Check input characteristics
      if (transaction.inputs.length !== 1) {
        return false;
      }

      const input = transaction.inputs[0];

      // Check for null input (all zeros) and specific vout index
      const isNullInput =
        input.txId ===
        '0000000000000000000000000000000000000000000000000000000000000000';
      const hasMaxVout = input.outputIndex === 0xffffffff;

      // Verify coinbase script length (2-100 bytes as per BIP34)
      const scriptLength = Buffer.from(input.script, 'hex').length;
      const hasValidScriptLength = scriptLength >= 2 && scriptLength <= 100;

      return isNullInput && hasMaxVout && hasValidScriptLength;
    } catch (error) {
      Logger.error('Error checking coinbase transaction:', {
        error,
        txId,
      });
      return false;
    }
  }

  /**
   * Validate coinbase maturity
   * Coinbase transactions must have at least COINBASE_MATURITY (100) confirmations
   * before they can be spent
   *
   * @param txId Transaction ID to check
   * @returns boolean indicating if coinbase is mature
   */
  private async isCoinbaseMature(txId: string): Promise<boolean> {
    try {
      const transaction = await this.blockchainSchema.getTransaction(txId);
      if (!transaction || !transaction.blockHeight) {
        return false;
      }

      const currentHeight = await this.blockchainSchema.getCurrentHeight();
      const confirmations = currentHeight - transaction.blockHeight + 1;

      return confirmations >= BLOCKCHAIN_CONSTANTS.COINBASE_MATURITY;
    } catch (error) {
      Logger.error('Error checking coinbase maturity:', {
        error,
        txId,
      });
      return false;
    }
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.cacheTimestamps.entries()) {
      if (now - timestamp > this.CACHE_EXPIRY) {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
      }
    }
  }
}
