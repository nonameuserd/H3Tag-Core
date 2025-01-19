import { UTXO } from './utxo.model';
import { Logger } from '@h3tag-blockchain/shared';
import { MerkleTree } from '../utils/merkle';
import { BLOCKCHAIN_CONSTANTS } from '../blockchain/utils/constants';
import { BlockchainSchema } from '../database/blockchain-schema';
import {
  QuantumCrypto,
  KeyManager,
  HybridCrypto,
  HashUtils,
} from '@h3tag-blockchain/crypto';
import { ProofOfWork } from '../blockchain/consensus/pow';
import { HybridDirectConsensus } from '../blockchain/consensus/hybrid-direct';
import { Blockchain } from '../blockchain/blockchain';
import { Mutex } from 'async-mutex';
import { EventEmitter } from 'events';
import { Mempool } from '../blockchain/mempool';
import { createHash } from 'crypto';

/**
 * @interface Transaction
 * @description Complete transaction structure
 *
 * @property {string} id - Transaction identifier
 * @property {number} version - Transaction version
 * @property {TransactionType} type - Transaction type
 * @property {string} hash - Transaction hash
 * @property {TransactionStatus} status - Transaction status
 * @property {TxInput[]} inputs - Transaction inputs
 * @property {TxOutput[]} outputs - Transaction outputs
 * @property {number} timestamp - Transaction timestamp
 * @property {bigint} fee - Transaction fee
 * @property {number} [lockTime] - Optional lock time
 * @property {string} signature - Transaction signature
 * @property {Object} [powData] - Optional mining data
 * @property {string} sender - Sender's address
 * @property {string} recipient - Recipient's address
 * @property {string} [memo] - Optional transaction memo
 * @property {Object} currency - Currency information
 * @property {number} [blockHeight] - Block height containing transaction
 * @property {number} [nonce] - Transaction nonce
 * @property {Object} [voteData] - Optional voting data
 * @property {boolean} [hasWitness] - Segregated witness flag
 * @property {Object} [witness] - Witness data
 *
 * @method verify - Verifies transaction integrity
 * @method toHex - Converts transaction to hex string
 * @method getSize - Gets transaction size in bytes
 */

export class TransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransactionError';
  }
}

/**
 * @enum TransactionType
 * @description Types of transactions supported by the blockchain
 *
 * @property {string} QUADRATIC_VOTE - Quadratic voting transaction
 * @property {string} POW_REWARD - Mining reward transaction
 * @property {string} STANDARD - Standard value transfer
 * @property {string} TRANSFER - Token transfer transaction
 * @property {string} COINBASE - Block reward transaction
 * @property {string} REGULAR - Regular transaction
 */

export enum TransactionType {
  QUADRATIC_VOTE = 'quadratic_vote', // quadratic voting
  POW_REWARD = 'pow', // For PoW mining rewards
  STANDARD = 'standard', // Standard transaction
  TRANSFER = 'transfer', // Transfer transaction
  COINBASE = 'coinbase', // Coinbase transaction
  REGULAR = 'regular', // Regular transaction
}

/**
 * @enum TransactionStatus
 * @description Status states for transactions
 *
 * @property {string} PENDING - Transaction awaiting confirmation
 * @property {string} CONFIRMED - Transaction confirmed in blockchain
 * @property {string} FAILED - Transaction failed to process
 */
export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

/**
 * @interface TxInput
 * @description Transaction input structure
 *
 * @property {string} txId - Previous transaction ID
 * @property {number} outputIndex - Index of previous output
 * @property {string} signature - Input signature
 * @property {string} publicKey - Sender's public key
 * @property {string} address - Sender's address
 * @property {bigint} amount - Input amount
 * @property {Object} currency - Currency information
 * @property {string} currency.symbol - Currency symbol
 * @property {number} currency.decimals - Decimal places
 * @property {Object} [votingData] - Optional voting information
 * @property {number} confirmations - Number of confirmations
 * @property {string} script - Input script
 * @property {number} sequence - Input sequence number
 */
export interface TxInput {
  txId: string;
  outputIndex: number;
  signature: string;
  publicKey: string;
  address: string;
  amount: bigint;
  currency: {
    symbol: string; // "TAG"
    decimals: number; // 8
  };
  votingData?: {
    powContribution: number;
    personhoodProof: string;
    timestamp: number;
  };
  confirmations: number;
  script: string;
  sequence: number;
}

/**
 * @interface TxOutput
 * @description Transaction output structure
 *
 * @property {string} address - Recipient's address
 * @property {bigint} amount - Output amount
 * @property {string} script - Output script
 * @property {string} [publicKey] - Optional recipient's public key
 * @property {Object} currency - Currency information
 * @property {number} index - Output index in transaction
 * @property {Object} [votingData] - Optional voting information
 */
export interface TxOutput {
  address: string;
  amount: bigint;
  script: string;
  publicKey?: string;
  currency: {
    name: string; // "H3TAG"
    symbol: string; // "TAG"
    decimals: number; // 8
  };
  index: number;
  votingData?: {
    proposal: string;
    choice: boolean;
    quadraticPower: bigint;
    timestamp: number;
  };
  confirmations: number;
}

/**
 * @interface Transaction
 * @description Complete transaction structure
 *
 * @property {string} id - Transaction identifier
 * @property {number} version - Transaction version
 * @property {TransactionType} type - Transaction type
 * @property {string} hash - Transaction hash
 * @property {TransactionStatus} status - Transaction status
 * @property {TxInput[]} inputs - Transaction inputs
 * @property {TxOutput[]} outputs - Transaction outputs
 * @property {number} timestamp - Transaction timestamp
 * @property {bigint} fee - Transaction fee
 * @property {number} [lockTime] - Optional lock time
 * @property {string} signature - Transaction signature
 * @property {Object} [powData] - Optional mining data
 * @property {string} sender - Sender's address
 * @property {string} recipient - Recipient's address
 * @property {string} [memo] - Optional transaction memo
 * @property {Object} currency - Currency information
 * @property {number} [blockHeight] - Block height containing transaction
 * @property {number} [nonce] - Transaction nonce
 * @property {Object} [voteData] - Optional voting data
 * @property {boolean} [hasWitness] - Segregated witness flag
 * @property {Object} [witness] - Witness data
 * @property {Object} transaction - Transaction data
 *
 * @method verify - Verifies transaction integrity
 * @method toHex - Converts transaction to hex string
 * @method getSize - Gets transaction size in bytes
 */
export interface Transaction {
  id: string;
  version: number;
  type: TransactionType;
  hash: string;
  status: TransactionStatus;
  inputs: TxInput[];
  outputs: TxOutput[];
  transaction: {
    hash: string;
    timestamp: number;
    fee: bigint;
    lockTime?: number;
    signature: string;
  };
  timestamp: number;
  fee: bigint;
  lockTime?: number;
  signature: string;
  powData?: {
    nonce: string;
    difficulty: number;
    timestamp: number;
  };
  sender: string;
  recipient: string;
  memo?: string;
  currency: {
    name: string; // "H3TAG"
    symbol: string; // "TAG"
    decimals: number; // 8
  };
  blockHeight?: number;
  nonce?: number;
  voteData?: {
    proposal: string;
    vote: boolean;
    weight: number;
  };
  hasWitness?: boolean;
  witness?: {
    stack: string[]; // Witness data stack
  };
  verify(): Promise<boolean>;
  toHex(): string;
  getSize(): number;
}

/**
 * @class TransactionBuilder
 * @description Builder pattern implementation for creating new transactions
 *
 * @property {number} MAX_INPUTS - Maximum number of inputs allowed
 * @property {number} MAX_OUTPUTS - Maximum number of outputs allowed
 *
 * @example
 * const builder = new TransactionBuilder();
 * await builder.addInput(txId, outputIndex, publicKey, amount);
 * await builder.addOutput(address, amount);
 * const transaction = await builder.build();
 */
export class TransactionBuilder {
  static mempool: Mempool;

  public type: TransactionType;
  private timestamp: number;
  private fee: bigint;
  private static readonly MAX_INPUTS = 1500; // Bitcoin-like limit
  private static readonly MAX_OUTPUTS = 1500;
  private inputs: TxInput[] = [];
  private outputs: TxOutput[] = [];
  private readonly merkleTree: MerkleTree;
  private readonly db: BlockchainSchema;
  private static readonly blockchain = new Blockchain();
  private static readonly pow = new ProofOfWork(TransactionBuilder.blockchain);
  private static readonly hybridDirect = new HybridDirectConsensus(
    TransactionBuilder.blockchain,
  );
  private readonly mutex = new Mutex();
  private signature: string = '';
  private sender: string = '';
  private emitter: EventEmitter;

  constructor() {
    this.type = TransactionType.STANDARD;
    this.timestamp = Date.now();
    this.merkleTree = new MerkleTree();
    this.db = new BlockchainSchema();
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(10);
  }

  public static setMempool(mempoolInstance: Mempool): void {
    TransactionBuilder.mempool = mempoolInstance;
  }

  /**
   * Adds an input to the transaction
   * @param {string} txId - Previous transaction ID
   * @param {number} outputIndex - Index of output in previous transaction
   * @param {string} publicKey - Sender's public key
   * @param {bigint} amount - Amount to spend
   * @returns {Promise<this>} Builder instance for chaining
   * @throws {TransactionError} If input parameters are invalid
   */
  async addInput(
    txId: string, // Previous transaction ID
    outputIndex: number, // Index of output in previous transaction
    publicKey: string, // Sender's public key
    amount: bigint, // Amount to spend
  ): Promise<this> {
    const release = await this.mutex.acquire();
    try {
      // Add transaction lock
      const txLock = await this.db.lockTransaction(txId);
      try {
        // Input validation
        if (!txId?.match(/^[a-f0-9]{64}$/i)) {
          throw new TransactionError('Invalid transaction ID format');
        }
        if (outputIndex < 0 || !Number.isInteger(outputIndex)) {
          throw new TransactionError('Invalid output index');
        }
        if (
          !publicKey ||
          amount <= BigInt(0) ||
          amount > BLOCKCHAIN_CONSTANTS.TRANSACTION.AMOUNT_LIMITS.MAX
        ) {
          throw new TransactionError('Invalid input parameters');
        }
        if (this.inputs.length >= TransactionBuilder.MAX_INPUTS) {
          throw new TransactionError('Maximum inputs reached');
        }

        // Verify UTXO exists and is unspent
        const utxo = await this.db.getUTXO(txId, outputIndex);
        if (!utxo || utxo.spent) {
          throw new TransactionError('UTXO not found or already spent');
        }
        // Mark UTXO as pending
        await this.db.markUTXOPending(txId, outputIndex);
      } finally {
        await txLock();
        await this.db.unlockTransaction(txId);
      }

      // Check for duplicate inputs
      const isDuplicate = this.inputs.some(
        (input) => input.txId === txId && input.outputIndex === outputIndex,
      );
      if (isDuplicate) {
        throw new TransactionError('Duplicate input detected');
      }

      // Check total input amount
      const totalInputAmount = this.inputs.reduce(
        (sum, input) => sum + input.amount,
        BigInt(0),
      );
      if (
        totalInputAmount + amount >
        BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_TOTAL_INPUT
      ) {
        throw new TransactionError('Total input amount exceeds limit');
      }

      // Check input age
      const inputTx = await this.db.getTransaction(txId);
      if (
        !inputTx ||
        Date.now() - inputTx.timestamp <
          BLOCKCHAIN_CONSTANTS.TRANSACTION.MIN_INPUT_AGE
      ) {
        throw new TransactionError('Input too recent');
      }

      const input: TxInput = {
        txId,
        outputIndex,
        signature: '', // Set during signing
        publicKey,
        amount,
        currency: {
          symbol: 'TAG',
          decimals: 8,
        },
        address: await KeyManager.deriveAddress(publicKey),
        confirmations: 0,
        script: await this.generateInputScript(publicKey),
        sequence: 0xffffffff, // Maximum sequence number by default
      };

      if (!this.validateCurrency(input.currency, amount)) {
        throw new TransactionError('Invalid currency amount or configuration');
      }

      this.inputs.push(input);
      return this;
    } finally {
      release();
    }
  }

  private async generateInputScript(publicKey: string): Promise<string> {
    try {
      // Add version prefix
      const scriptVersion = '01';

      // Input validation
      if (!publicKey) {
        throw new TransactionError('Invalid public key');
      }

      // Get address from public key
      const address = await KeyManager.deriveAddress(publicKey);

      // Check address type and generate appropriate script
      let script: string;
      if (address.startsWith('TAG1')) {
        // Native SegWit equivalent for our blockchain
        script = `0 ${await KeyManager.getPublicKeyHash(publicKey)}`;
      } else if (address.startsWith('TAG3')) {
        // Script Hash equivalent for our blockchain
        script = `OP_HASH160 ${await KeyManager.addressToHash(
          address,
        )} OP_EQUAL`;
      } else if (address.startsWith('TAG')) {
        // Legacy address equivalent
        script = `OP_DUP OP_HASH160 ${await KeyManager.addressToHash(
          address,
        )} OP_EQUALVERIFY OP_CHECKSIG`;
      } else {
        throw new TransactionError('Unsupported address format');
      }

      return `${scriptVersion}:${script}`;
    } catch (error) {
      Logger.error('Script generation failed:', error);
      throw new TransactionError('Failed to generate input script');
    }
  }

  /**
   * Adds an output to the transaction
   * @param {string} address - Recipient's address
   * @param {bigint} amount - Amount to send
   * @param {number} confirmations - Confirmations
   * @returns {Promise<this>} Builder instance for chaining
   * @throws {TransactionError} If output parameters are invalid
   */
  async addOutput(
    address: string, // Recipient's address
    amount: bigint, // Amount to send
    confirmations: number,
  ): Promise<this> {
    // Output validation
    if (!this.isValidAddress(address)) {
      throw new TransactionError('Invalid address format');
    }
    if (confirmations < 0) {
      throw new TransactionError('Invalid confirmations');
    }
    if (amount <= 0) {
      throw new TransactionError('Invalid amount');
    }
    if (this.outputs.length >= TransactionBuilder.MAX_OUTPUTS) {
      throw new TransactionError('Maximum outputs reached');
    }

    const script = await this.generateOutputScript(address, amount);

    this.outputs.push({
      address,
      amount,
      script,
      currency: {
        name: 'H3TAG',
        symbol: 'TAG',
        decimals: 8,
      },
      index: this.outputs.length,
      confirmations: confirmations,
    });

    return this;
  }

  private async generateOutputScript(
    address: string,
    amount: bigint,
  ): Promise<string> {
    try {
      // Input validation
      if (!address || !amount) {
        throw new TransactionError('Invalid script parameters');
      }

      // Version control for future script upgrades
      const scriptVersion = '01';

      // Generate address hash
      const addressHash = await KeyManager.addressToHash(address);

      // Script constants
      const SCRIPT_CONSTANTS = {
        MAX_SCRIPT_SIZE: 10000,
      };

      // Amount validation
      if (
        amount < BLOCKCHAIN_CONSTANTS.TRANSACTION.AMOUNT_LIMITS.MIN ||
        amount > BLOCKCHAIN_CONSTANTS.TRANSACTION.AMOUNT_LIMITS.MAX
      ) {
        throw new TransactionError('Invalid amount range');
      }

      let scriptElements: string[];

      // Generate script based on address type
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
        throw new TransactionError('Unsupported address format');
      }

      // Build script
      const script = scriptElements.join(' ');

      // Validate script size
      if (script.length > SCRIPT_CONSTANTS.MAX_SCRIPT_SIZE) {
        throw new TransactionError('Script size exceeds limit');
      }

      // Format: version:script
      return `${scriptVersion}:${script}`;
    } catch (error) {
      Logger.error('Script generation failed:', error);
      throw new TransactionError(
        error instanceof TransactionError
          ? error.message
          : 'Script generation failed',
      );
    }
  }

  /**
   * Build the transaction
   * @returns Promise<Transaction> The built transaction
   * @throws TransactionError If the transaction cannot be built
   */
  async build(): Promise<Transaction> {
    const release = await this.mutex.acquire();
    try {
      // 1. Validate structure
      if (!this.inputs.length || !this.outputs.length) {
        throw new TransactionError('Transaction must have inputs and outputs');
      }

      // 2. Calculate and validate amounts
      const inputAmount = TransactionBuilder.calculateInputAmount(
        this.inputs.map((input) => ({
          amount: input.amount,
          address: input.address,
          txId: input.txId,
          outputIndex: input.outputIndex,
          script: input.signature,
          timestamp: this.timestamp,
          spent: false,
          currency: {
            name: 'TAG',
            symbol: 'TAG',
            decimals: 8,
          },
          publicKey: input.publicKey,
          confirmations: input.confirmations,
        })),
      );
      const outputAmount = TransactionBuilder.calculateOutputAmount(
        this.outputs,
      );

      if (inputAmount < outputAmount) {
        throw new TransactionError('Insufficient input amount');
      }

      const fee = inputAmount - outputAmount;
      const hash = await this.calculateTransactionHash();
      const tx: Transaction = {
        id: hash,
        version: BLOCKCHAIN_CONSTANTS.TRANSACTION.CURRENT_VERSION,
        type: this.type,
        hash,
        status: TransactionStatus.PENDING,
        inputs: this.inputs,
        outputs: this.outputs,
        timestamp: this.timestamp,
        fee,
        signature: '',
        sender: await this.deriveSenderAddress(this.inputs[0].publicKey),
        currency: {
          name: 'H3TAG',
          symbol: 'TAG',
          decimals: 8,
        },
        transaction: {
          hash: hash,
          timestamp: Date.now(),
          fee: fee,
          signature: '',
        },
        recipient: '',
        memo: '',
        verify: async () => await this.verify(),
        toHex: () => JSON.stringify(tx),
        getSize: () => this.getSize(),
      };

      // Get dynamic fee requirements from mempool
      const txSize = TransactionBuilder.calculateTransactionSize(tx);
      const minRequiredFee = await this.getDynamicMinFee(txSize);
      const maxAllowedFee = await this.getDynamicMaxFee(txSize);

      // Validate fee against dynamic thresholds
      if (fee < minRequiredFee || fee > maxAllowedFee) {
        throw new TransactionError(
          `Invalid fee amount: ${fee}. Must be between ${minRequiredFee} and ${maxAllowedFee}`,
        );
      }

      // Check transaction size
      const maxMempoolSize = await TransactionBuilder.mempool.getMaxSize();
      if (txSize > maxMempoolSize) {
        throw new TransactionError(
          `Transaction size ${txSize} exceeds current mempool limit ${maxMempoolSize}`,
        );
      }

      // Add UTXO validation
      for (const input of this.inputs) {
        const utxo = await TransactionBuilder.blockchain.getUTXO(
          input.txId,
          input.outputIndex,
        );
        if (!utxo || utxo.spent) {
          throw new TransactionError(
            `UTXO ${input.txId}:${input.outputIndex} is already spent or doesn't exist`,
          );
        }
        // Verify amount matches
        if (utxo.amount !== input.amount) {
          throw new TransactionError(
            `Input amount mismatch for UTXO ${input.txId}:${input.outputIndex}`,
          );
        }
      }

      return tx;
    } catch (error) {
      Logger.error('Transaction build failed:', error);
      throw new TransactionError(
        error instanceof TransactionError ? error.message : 'Build failed',
      );
    } finally {
      release();
    }
  }

  private async calculateTransactionHash(): Promise<string> {
    try {
      const txData = {
        inputs: this.inputs.map((input) => ({
          txId: input.txId,
          outputIndex: input.outputIndex,
          publicKey: input.publicKey,
        })),
        outputs: this.outputs,
        timestamp: this.timestamp,
      };

      const merkleRoot = await this.merkleTree.createRoot([
        JSON.stringify(txData.inputs),
        JSON.stringify(txData.outputs),
        txData.timestamp.toString(),
      ]);

      return merkleRoot;
    } catch (error) {
      Logger.error('Transaction hash calculation failed:', {
        error,
        inputCount: this.inputs.length,
        outputCount: this.outputs.length,
      });

      if (error instanceof Error) {
        throw new TransactionError(`Merkle tree error: ${error.message}`);
      } else if (error instanceof Error) {
        throw new TransactionError(
          `JSON serialization error: ${error.message}`,
        );
      } else {
        throw new TransactionError(
          `Failed to calculate transaction hash: ${error.message}`,
        );
      }
    }
  }

  private async deriveSenderAddress(publicKey: string): Promise<string> {
    try {
      if (!publicKey) {
        Logger.warn('No public key provided for sender derivation');
        return '';
      }

      return await KeyManager.deriveAddress(publicKey);
    } catch (error) {
      Logger.error('Failed to derive sender address', { error });
      return '';
    }
  }

  private isValidAddress(address: string): boolean {
    try {
      // Input sanitization
      if (!address || typeof address !== 'string') {
        Logger.error('Invalid address input type', { type: typeof address });
        return false;
      }

      // Length check before regex to prevent ReDoS attacks
      if (address.length < 31 || address.length > 46) {
        Logger.warn('Address length out of bounds', { length: address.length });
        return false;
      }

      // Basic format validation
      const H3TAG_ADDRESS_REGEX = /^TAG[a-zA-Z0-9]{30,45}$/;
      if (!H3TAG_ADDRESS_REGEX.test(address)) {
        Logger.warn('Address failed format validation', {
          address: address.substring(0, 8) + '...',
        });
        return false;
      }

      // Checksum validation
      const checksumValid = this.validateAddressChecksum(address);
      if (!checksumValid) {
        Logger.error('Address checksum validation failed', {
          address: address.substring(0, 8) + '...',
        });
        return false;
      }

      // Network prefix validation
      const network = this.validateNetworkPrefix(address);
      if (!network) {
        Logger.error('Invalid network prefix', {
          prefix: address.substring(0, 3),
        });
        return false;
      }

      Logger.debug('Address validation successful', {
        network,
        length: address.length,
        prefix: address.substring(0, 3),
      });

      return true;
    } catch (error) {
      Logger.error('Address validation error', { error });
      return false;
    }
  }

  private validateAddressChecksum(address: string): boolean {
    try {
      const decodedArray = Uint8Array.from(HashUtils.fromBase58(address));
      const payload = decodedArray.slice(0, -4);
      const checksum = decodedArray.slice(-4);
      const calculatedChecksum = Buffer.from(
        HashUtils.doubleSha256(Buffer.from(payload).toString('hex')).slice(
          0,
          4,
        ),
      );

      return (
        Buffer.from(checksum).toString('hex') ===
        calculatedChecksum.toString('hex')
      );
    } catch (error) {
      Logger.error('Checksum validation failed', { error });
      return false;
    }
  }

  private validateNetworkPrefix(address: string): string | null {
    const networkPrefixes = {
      TAG: 'mainnet',
      THX: 'testnet',
      DBX: 'devnet',
    };

    const prefix = address.substring(0, 3);
    return networkPrefixes[prefix] || null;
  }

  private async hashAddress(address: string): Promise<string> {
    try {
      // Use quantum-safe hash function
      const addressBuffer = Buffer.from(address);
      const hashBuffer = await QuantumCrypto.nativeHash(addressBuffer);
      return hashBuffer.toString('hex');
    } catch (error) {
      Logger.error('Address hashing failed', { error, address });
      throw new TransactionError('Failed to hash address');
    }
  }

  /**
   * Verify transaction
   * @param tx Transaction to verify
   * @returns Promise<boolean> True if the transaction is valid, false otherwise
   * it's been used in block.validator.ts
   */
  static async verify(tx: Transaction): Promise<boolean> {
    try {
      // 1. Input validation
      if (!tx?.hash || !tx?.inputs?.length || !tx?.outputs?.length) {
        Logger.warn('Invalid transaction structure', { txId: tx?.hash });
        return false;
      }

      // 2. Verify merkle tree
      const merkleTree = new MerkleTree();
      const txData = [
        JSON.stringify(tx.inputs),
        JSON.stringify(tx.outputs),
        tx.timestamp.toString(),
      ];

      const isValidHash = await merkleTree.verify(tx.hash, txData);
      if (!isValidHash) {
        Logger.warn('Invalid merkle hash', { txId: tx.hash });
        return false;
      }

      if (tx.type === TransactionType.POW_REWARD) {
        if (
          !(await TransactionBuilder.pow.validateReward(tx, tx.blockHeight))
        ) {
          Logger.warn('Invalid PoW', { txId: tx.hash });
          return false;
        }
      }

      if (tx.type === TransactionType.QUADRATIC_VOTE) {
        if (
          !(await TransactionBuilder.hybridDirect.validateParticipationReward(
            tx,
            tx.blockHeight,
          ))
        ) {
          Logger.warn('Invalid participation reward', { txId: tx.hash });
          return false;
        }
      }

      // 4. Verify each input's signatures
      for (const input of tx.inputs) {
        try {
          const isValid = await HybridCrypto.verify(
            tx.hash,
            input.signature,
            TransactionBuilder.safeJsonParse(input.publicKey),
          );
          // Add null check and explicit false return
          if (!isValid || isValid === null) {
            Logger.warn('Invalid signature detected', { txId: tx.hash });
            return false;
          }
        } catch (error) {
          Logger.error('Signature verification failed', { error });
          return false;
        }
      }

      // 5. Verify amounts and other business rules
      const isValidStructure = this.validateTransaction(tx, []);
      if (!isValidStructure) {
        Logger.warn('Invalid transaction structure', { txId: tx.hash });
        return false;
      }

      // Add UTXO double-spend check
      const spentUTXOs = new Set<string>();
      for (const input of tx.inputs) {
        const utxoKey = `${input.txId}:${input.outputIndex}`;

        // Check for duplicate inputs within the same transaction
        if (spentUTXOs.has(utxoKey)) {
          Logger.warn('Double-spend attempt within transaction', {
            txId: tx.hash,
          });
          return false;
        }
        spentUTXOs.add(utxoKey);

        // Verify UTXO exists and is unspent
        const utxo = await TransactionBuilder.blockchain.getUTXO(
          input.txId,
          input.outputIndex,
        );
        if (!utxo || utxo.spent) {
          Logger.warn("UTXO already spent or doesn't exist", { txId: tx.hash });
          return false;
        }
      }

      return true;
    } catch (error) {
      Logger.error('Transaction verification failed', {
        error,
        txId: tx?.hash,
        inputCount: tx?.inputs?.length,
      });
      return false;
    }
  }

  /**
   * Safely parses a JSON string
   * @param {string} str - JSON string to parse
   * @returns {any} Parsed object
   * @throws {TransactionError} If parsing fails
   */
  static safeJsonParse(str: string): any {
    try {
      // Add input validation
      if (typeof str !== 'string') {
        throw new TransactionError('Invalid input type for JSON parsing');
      }
      // Add size limit check
      if (str.length > BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIZE) {
        throw new TransactionError('JSON string exceeds size limit');
      }
      const parsed = JSON.parse(str);
      // Add parsed object validation
      if (typeof parsed !== 'object' || parsed === null) {
        throw new TransactionError('Invalid JSON structure');
      }
      return parsed;
    } catch (error) {
      Logger.error('JSON parse failed', { error });
      throw new TransactionError('Invalid JSON format');
    }
  }

  /**
   * Calculate total input amount with overflow protection
   * @param utxos The UTXOs to calculate the input amount from
   * @returns The total input amount
   * @throws TransactionError If the input amount calculation fails
   */
  static calculateInputAmount(utxos: UTXO[]): bigint {
    return utxos.reduce((sum, utxo) => {
      try {
        const amount = BigInt(utxo.amount);
        const newSum = sum + amount;
        // Add overflow check
        if (newSum < sum || newSum < amount) {
          throw new TransactionError('Input amount overflow');
        }
        return newSum;
      } catch (error) {
        throw new TransactionError(`Invalid amount format: ${error.message}`);
      }
    }, BigInt(0));
  }

  /**
   * Calculate total output amount with overflow protection
   */
  static calculateOutputAmount(outputs: TxOutput[]): bigint {
    try {
      return outputs.reduce((sum, output) => {
        if (!output?.amount) {
          throw new TransactionError('Invalid output amount');
        }
        const newSum = sum + BigInt(output.amount);
        if (newSum < sum) {
          throw new TransactionError('Output amount overflow');
        }
        return newSum;
      }, BigInt(0));
    } catch (error) {
      Logger.error('Output amount calculation failed:', error);
      throw new TransactionError('Output calculation failed');
    }
  }

  /**
   * Validate transaction structure and amounts
   */
  static async validateTransaction(
    tx: Transaction,
    utxos: UTXO[],
  ): Promise<boolean> {
    try {
      if (
        !tx?.version ||
        tx.version !== BLOCKCHAIN_CONSTANTS.TRANSACTION.CURRENT_VERSION
      ) {
        Logger.warn('Invalid transaction version', {
          txId: tx?.hash,
          version: tx?.version,
        });
        return false;
      }

      // 1. Basic structure validation
      if (!tx?.hash || !tx?.inputs?.length || !tx?.outputs?.length) {
        Logger.warn('Invalid transaction structure', { txId: tx?.hash });
        return false;
      }

      // 2. Validate input/output counts
      if (
        tx.inputs.length > BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_INPUTS ||
        tx.outputs.length > BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_OUTPUTS
      ) {
        Logger.warn('Too many inputs/outputs', {
          txId: tx.hash,
          inputs: tx.inputs.length,
          outputs: tx.outputs.length,
        });
        return false;
      }

      // 3. Calculate amounts with overflow protection
      const inputAmount = this.calculateInputAmount(utxos);
      const outputAmount = this.calculateOutputAmount(tx.outputs);

      // 4. Validate amounts
      if (inputAmount < outputAmount) {
        Logger.warn('Insufficient inputs', {
          txId: tx.hash,
          inputAmount: inputAmount.toString(),
          outputAmount: outputAmount.toString(),
        });
        return false;
      }

      // 5. Validate fee
      const fee = inputAmount - outputAmount;
      if (
        fee < (await this.mempool.getMinFeeRate()) ||
        fee > (await this.mempool.getMaxFeeRate())
      ) {
        Logger.warn('Invalid fee', {
          txId: tx.hash,
          fee: fee.toString(),
        });
        return false;
      }

      // Add UTXO amount validation
      for (let i = 0; i < tx.inputs.length; i++) {
        const input = tx.inputs[i];
        const utxo = utxos[i];
        if (!utxo || input.amount !== utxo.amount) {
          return false;
        }
      }

      const txSize = TransactionBuilder.calculateTransactionSize(tx);
      if (txSize > BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIZE) {
        Logger.warn('Transaction too large', { size: txSize });
        return false;
      }

      // Add timestamp validation
      const currentTime = Date.now();
      const maxFutureTime = currentTime + 15 * 60 * 1000; // 15 minutes
      const minPastTime = currentTime - 2 * 60 * 60 * 1000; // 2 hours

      if (tx.timestamp > maxFutureTime || tx.timestamp < minPastTime) {
        Logger.warn('Invalid transaction timestamp', {
          txId: tx.hash,
          timestamp: tx.timestamp,
          currentTime,
        });
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Transaction validation failed:', {
        error,
        txId: tx?.hash,
      });
      return false;
    }
  }

  /**
   * Calculate transaction size
   * @param tx Transaction to calculate size for
   * @returns Size of the transaction in bytes
   * @throws TransactionError If size calculation fails
   */
  static calculateTransactionSize(tx: Transaction): number {
    try {
      const txData = {
        inputs: tx.inputs,
        outputs: tx.outputs,
        metadata: {
          version: BLOCKCHAIN_CONSTANTS.TRANSACTION.CURRENT_VERSION,
          type: tx.type,
          timestamp: tx.timestamp,
        },
      };
      const serialized = JSON.stringify(txData);
      return Buffer.from(serialized).length;
    } catch (error) {
      Logger.error('Failed to calculate transaction size', { error });
      throw new TransactionError('Failed to serialize transaction');
    }
  }

  public async verify(): Promise<boolean> {
    try {
      const message = JSON.stringify({
        inputs: this.inputs,
        outputs: this.outputs,
        timestamp: this.timestamp,
        fee: this.fee,
      });

      const isValidSignature = await HybridCrypto.verify(
        message,
        this.signature,
        this.sender,
      );
      if (!isValidSignature) return false;

      // Verify amounts
      const totalInput = this.inputs.reduce(
        (sum, input) => sum + input.amount,
        BigInt(0),
      );
      const totalOutput = this.outputs.reduce(
        (sum, output) => sum + output.amount,
        BigInt(0),
      );

      return totalInput >= totalOutput + this.fee;
    } catch (error) {
      Logger.error('Transaction verification failed:', error);
      return false;
    }
  }

  public setSignature(signature: string): this {
    this.signature = signature;
    return this;
  }

  public setSender(sender: string): this {
    this.sender = sender;
    return this;
  }

  public setFee(fee: bigint): this {
    if (fee < 0) {
      throw new TransactionError('Fee cannot be negative');
    }
    this.fee = fee;
    return this;
  }

  /**
   * Get detailed transaction information
   * @param txId Transaction ID to fetch
   * @returns Promise<Transaction | null> Transaction details or null if not found
   * @throws TransactionError If there's an error fetching the transaction
   */
  public async getTransaction(txId: string): Promise<Transaction | null> {
    const release = await this.mutex.acquire();
    try {
      // Input validation
      if (!txId?.match(/^[a-f0-9]{64}$/i)) {
        throw new TransactionError('Invalid transaction ID format');
      }

      // Fetch transaction from database
      const tx = await this.db.getTransaction(txId);
      if (!tx) {
        Logger.debug('Transaction not found', { txId });
        return null;
      }

      // Fetch and attach UTXO information
      const utxos: UTXO[] = [];
      for (const input of tx.inputs) {
        const utxo = await this.db.getUTXO(input.txId, input.outputIndex);
        if (utxo) {
          utxos.push({
            txId: utxo.txId,
            outputIndex: utxo.outputIndex,
            amount: BigInt(utxo.amount),
            address: utxo.address,
            script: utxo.script,
            timestamp: utxo.timestamp,
            spent: utxo.spent,
            currency: {
              name: 'H3Tag',
              symbol: 'TAG',
              decimals: 8,
            },
            publicKey: utxo.publicKey,
            confirmations: utxo.confirmations,
          });
        }
      }

      // Validate transaction
      const isValid = await TransactionBuilder.validateTransaction(tx, utxos);
      if (!isValid) {
        Logger.warn('Retrieved invalid transaction', { txId });
        return null;
      }

      // Calculate confirmations
      const currentHeight = await TransactionBuilder.blockchain.getHeight();
      if (tx.blockHeight) {
        tx.inputs = tx.inputs.map((input) => ({
          ...input,
          confirmations: currentHeight - tx.blockHeight + 1,
        }));
      }

      Logger.debug('Transaction retrieved successfully', {
        txId,
        type: tx.type,
        status: tx.status,
      });

      return tx;
    } catch (error) {
      Logger.error('Failed to get transaction:', {
        error,
        txId,
      });
      throw new TransactionError(`Failed to get transaction: ${error.message}`);
    } finally {
      release();
    }
  }

  /**
   * Broadcast a raw transaction to the network
   * @param rawTx Serialized transaction data
   * @returns Promise<string> Transaction ID if successful
   * @throws TransactionError if validation or broadcast fails
   */
  public async sendRawTransaction(rawTx: string): Promise<string> {
    try {
      // Input validation
      if (!rawTx || typeof rawTx !== 'string') {
        throw new TransactionError('Invalid raw transaction format');
      }

      // Deserialize and validate transaction
      const tx = await this.deserializeTransaction(rawTx);
      if (!(await tx.verify())) {
        throw new TransactionError('Transaction verification failed');
      }

      // Check if transaction already exists
      const existingTx = await this.db.getTransaction(tx.id);
      if (existingTx) {
        throw new TransactionError('Transaction already exists');
      }

      // Emit transaction for network broadcast
      this.emitter.emit('transaction:broadcast', tx);

      return tx.id;
    } catch (error) {
      Logger.error('Failed to send raw transaction:', error);
      throw new TransactionError(
        error instanceof TransactionError
          ? error.message
          : 'Failed to send transaction',
      );
    }
  }

  private async deserializeTransaction(rawTx: string): Promise<Transaction> {
    try {
      const txData = JSON.parse(rawTx);

      // Validate required fields
      if (!txData.inputs || !txData.outputs || !txData.type) {
        throw new TransactionError('Missing required transaction fields');
      }

      // Build transaction object
      const tx: Transaction = {
        ...txData,
        id: await this.calculateTransactionHash(),
        status: TransactionStatus.PENDING,
        timestamp: Date.now(),
        verify: async () => await TransactionBuilder.verify(tx),
      };

      return tx;
    } catch (error) {
      throw new TransactionError('Invalid transaction format');
    }
  }

  /**
   * Get raw transaction data
   * @param txId Transaction ID to fetch
   * @returns Promise<string> Raw transaction data in serialized format
   * @throws TransactionError If there's an error fetching or serializing the transaction
   */
  public async getRawTransaction(txId: string): Promise<string> {
    const release = await this.mutex.acquire();
    try {
      // Input validation
      if (!txId?.match(/^[a-f0-9]{64}$/i)) {
        throw new TransactionError('Invalid transaction ID format');
      }

      // Fetch transaction
      const tx = await this.db.getTransaction(txId);
      if (!tx) {
        throw new TransactionError('Transaction not found');
      }

      // Prepare transaction data for serialization
      const rawTx = {
        version: tx.version,
        type: tx.type,
        inputs: tx.inputs.map((input) => ({
          txId: input.txId,
          outputIndex: input.outputIndex,
          signature: input.signature,
          publicKey: input.publicKey,
          amount: input.amount.toString(), // Convert BigInt to string
          script: input.script,
          address: input.address,
        })),
        outputs: tx.outputs.map((output) => ({
          address: output.address,
          amount: output.amount.toString(), // Convert BigInt to string
          script: output.script,
          index: output.index,
          currency: output.currency,
        })),
        timestamp: tx.timestamp,
        fee: tx.fee.toString(), // Convert BigInt to string
        signature: tx.signature,
        sender: tx.sender,
        recipient: tx.recipient,
        hash: tx.hash,
        currency: tx.currency,
      };

      // Add optional fields if they exist
      if (tx.memo) rawTx['memo'] = tx.memo;
      if (tx.lockTime) rawTx['lockTime'] = tx.lockTime;
      if (tx.powData) rawTx['powData'] = tx.powData;
      if (tx.voteData) rawTx['voteData'] = tx.voteData;
      if (tx.blockHeight) rawTx['blockHeight'] = tx.blockHeight;
      if (tx.nonce) rawTx['nonce'] = tx.nonce;

      // Serialize with proper formatting
      const serialized = JSON.stringify(rawTx, null, 2);

      // Validate serialized data size
      if (
        Buffer.from(serialized).length >
        BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIZE
      ) {
        throw new TransactionError('Serialized transaction exceeds size limit');
      }

      Logger.debug('Raw transaction retrieved successfully', {
        txId,
        size: Buffer.from(serialized).length,
      });

      return serialized;
    } catch (error) {
      Logger.error('Failed to get raw transaction:', {
        error,
        txId,
      });
      throw new TransactionError(
        `Failed to get raw transaction: ${error.message}`,
      );
    } finally {
      release();
    }
  }

  /**
   * Decode a raw transaction hex string
   * @param rawTx Raw transaction hex string
   * @returns Promise<Transaction> Decoded transaction
   * @throws TransactionError If decoding fails
   */
  public static async decodeRawTransaction(
    rawTx: string,
  ): Promise<Transaction> {
    try {
      // Input validation
      if (!rawTx || typeof rawTx !== 'string') {
        throw new TransactionError('Invalid raw transaction format');
      }

      // Parse the JSON string
      let txData: any;
      try {
        txData = JSON.parse(rawTx);
      } catch (error) {
        throw new TransactionError('Invalid transaction JSON format');
      }

      // Validate required fields
      const requiredFields = [
        'version',
        'type',
        'inputs',
        'outputs',
        'timestamp',
      ];
      for (const field of requiredFields) {
        if (!txData[field]) {
          throw new TransactionError(`Missing required field: ${field}`);
        }
      }

      // Convert amounts back to BigInt
      txData.inputs = txData.inputs.map((input: any) => ({
        ...input,
        amount: BigInt(input.amount),
      }));

      txData.outputs = txData.outputs.map((output: any) => ({
        ...output,
        amount: BigInt(output.amount),
      }));

      if (txData.fee) {
        txData.fee = BigInt(txData.fee);
      }

      // Create Transaction object
      const tx: Transaction = {
        ...txData,
        verify: async () => await TransactionBuilder.verify(tx),
        toHex: () => rawTx,
      };

      // Validate transaction structure
      if (!(await TransactionBuilder.verify(tx))) {
        throw new TransactionError('Invalid transaction structure');
      }

      Logger.debug('Transaction decoded successfully', {
        txId: tx.id,
        type: tx.type,
        inputCount: tx.inputs.length,
        outputCount: tx.outputs.length,
      });

      return tx;
    } catch (error) {
      Logger.error('Failed to decode transaction:', error);
      throw new TransactionError(
        error instanceof TransactionError
          ? error.message
          : 'Failed to decode transaction',
      );
    }
  }

  public getSize(): number {
    const inputSize = this.inputs.reduce((sum, input) => {
      return (
        sum + (input.signature?.length || 0) + (input.publicKey?.length || 0)
      );
    }, 0);

    const outputSize = this.outputs.reduce((sum, output) => {
      return sum + (output.script?.length || 0);
    }, 0);

    return inputSize + outputSize + 8; // 8 bytes for version and locktime
  }

  /**
   * Sign a message using hybrid cryptography (classical + quantum-resistant)
   * @param {string} message - Message to sign
   * @param {string} privateKey - Classical private key in hex format (64 characters)
   * @returns {Promise<string>} Combined signature hash that includes:
   *   - Classical ECC signature (secp256k1)
   *   - Dilithium quantum-resistant signature
   *   - Kyber key encapsulation
   * @throws {TransactionError} If signing fails or input validation fails
   */
  public static async signMessage(
    message: string,
    privateKey: string,
  ): Promise<string> {
    try {
      // Input validation
      if (!message || typeof message !== 'string') {
        throw new TransactionError('Invalid message format');
      }
      if (!privateKey?.match(/^[a-f0-9]{64}$/i)) {
        throw new TransactionError('Invalid private key format');
      }

      // Prepare message for signing
      const messagePrefix = BLOCKCHAIN_CONSTANTS.MESSAGE.PREFIX;
      const messageBuffer = Buffer.from(messagePrefix + message);
      const messageHash = createHash('sha256').update(messageBuffer).digest();

      // Sign message hash
      const signature = await HybridCrypto.sign(messageHash.toString('hex'), {
        privateKey: privateKey,
        publicKey:
          HybridCrypto.TRADITIONAL_CURVE.keyFromPrivate(privateKey).getPublic(
            'hex',
          ),
        address: HashUtils.sha256(
          HybridCrypto.TRADITIONAL_CURVE.keyFromPrivate(privateKey).getPublic(
            'hex',
          ),
        ),
      });

      // Encode signature
      const encodedSignature = signature;

      Logger.debug('Message signed successfully', {
        messageLength: message.length,
        signatureLength: encodedSignature.length,
      });

      return encodedSignature;
    } catch (error) {
      Logger.error('Message signing failed:', error);
      throw new TransactionError(
        error instanceof TransactionError
          ? error.message
          : 'Failed to sign message',
      );
    }
  }

  /**
   * Verify a message signature using hybrid cryptography
   * @param {string} message - Original message that was signed
   * @param {string} signature - Hybrid signature hash to verify
   * @param {string} publicKey - Public key in hex format
   * @returns {Promise<boolean>} True if signature is valid
   * @throws {TransactionError} If verification fails due to invalid input
   */
  public static async verifyMessage(
    message: string,
    signature: string,
    publicKey: string,
  ): Promise<boolean> {
    try {
      // Input validation
      if (!message || typeof message !== 'string') {
        throw new TransactionError('Invalid message format');
      }
      if (!signature?.match(/^[a-f0-9]{128}$/i)) {
        throw new TransactionError('Invalid signature format');
      }
      if (!publicKey?.match(/^[a-f0-9]{130}$/i)) {
        throw new TransactionError('Invalid public key format');
      }

      // Prepare message for verification
      const messagePrefix = BLOCKCHAIN_CONSTANTS.MESSAGE.PREFIX;
      const messageBuffer = Buffer.from(messagePrefix + message);
      const messageHash = createHash('sha256').update(messageBuffer).digest();

      // Verify using HybridCrypto
      const isValid = await HybridCrypto.verify(
        messageHash.toString('hex'),
        signature,
        HashUtils.sha256(publicKey),
      );

      Logger.debug('Message verification completed', {
        messageLength: message.length,
        signatureLength: signature.length,
        isValid,
      });

      return isValid;
    } catch (error) {
      Logger.error('Message verification failed:', error);
      throw new TransactionError(
        error instanceof TransactionError
          ? error.message
          : 'Failed to verify message',
      );
    }
  }

  /**
   * Validates a blockchain address format and checksum
   * @param {string} address - The address to validate
   * @returns {boolean} True if the address is valid
   */
  public static validateAddress(address: string): boolean {
    try {
      // 1. Basic input validation
      if (!address || typeof address !== 'string') {
        Logger.warn('Invalid address input type', { type: typeof address });
        return false;
      }

      // 2. Length validation (25-34 chars is standard for base58 addresses)
      if (address.length < 25 || address.length > 34) {
        Logger.warn('Address length out of bounds', { length: address.length });
        return false;
      }

      // 3. Prefix validation with network type check
      const networkType = this.getNetworkType();
      const validPrefix =
        networkType === 'mainnet'
          ? 'TAG'
          : networkType === 'testnet'
            ? 'THX'
            : 'DBX';

      if (!address.startsWith(validPrefix)) {
        Logger.warn('Invalid address prefix', {
          prefix: address.substring(0, 3),
          expected: validPrefix,
        });
        return false;
      }

      // 4. Character set validation (base58 alphabet) - after prefix
      const base58Part = address.slice(3);
      const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
      if (!base58Regex.test(base58Part)) {
        Logger.warn('Invalid base58 characters in address');
        return false;
      }

      // 5. Version and checksum validation
      const decoded = HashUtils.fromBase58(base58Part);
      if (decoded.length !== 25) {
        // 1 version + 1 quantum + 20 hash + 4 checksum
        Logger.warn('Invalid decoded length', { length: decoded.length });
        return false;
      }

      const [version, quantumVersion] = decoded;
      if (
        version !== 0x00 ||
        (quantumVersion !== 0x00 && quantumVersion !== 0x01)
      ) {
        Logger.warn('Invalid version bytes', { version, quantumVersion });
        return false;
      }

      // 6. Checksum validation
      const decodedArray = Uint8Array.from(decoded);
      const payload = decodedArray.slice(0, -4);
      const checksum = decodedArray.slice(-4);
      const calculatedChecksum = Buffer.from(
        HashUtils.doubleSha256(Buffer.from(payload).toString('hex')).slice(
          0,
          4,
        ),
      );

      return (
        Buffer.from(checksum).toString('hex') ===
        calculatedChecksum.toString('hex')
      );
    } catch (error) {
      Logger.error('Address validation error', { error, address });
      return false;
    }
  }

  private static getNetworkType(): string {
    return (
      BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.type?.toString() || 'MAINNET'
    ).toLowerCase();
  }

  public cleanup(): void {
    this.emitter.removeAllListeners();
  }

  private validateCurrency(
    currency: { symbol: string; decimals: number },
    amount: bigint,
  ): boolean {
    // Basic currency validation
    if (currency.symbol !== 'TAG') return false;

    // Handle whole number amounts
    if (amount % BigInt(1) === BigInt(0)) return true;

    // For decimal amounts, check if they match the currency's decimal places
    const amountStr = amount.toString();
    const decimalPlaces = amountStr.includes('.')
      ? amountStr.split('.')[1].length
      : 0;

    return decimalPlaces <= currency.decimals;
  }

  /**
   * Calculate minimum required fee based on current network conditions
   * @param txSize Transaction size in bytes
   * @returns Promise<bigint> Minimum required fee
   */
  private async getDynamicMinFee(txSize: number): Promise<bigint> {
    try {
      // Get base fee rate from mempool
      const baseFeeRate = await TransactionBuilder.mempool.getMinFeeRate();

      // Calculate minimum fee based on transaction size
      const minFee = BigInt(Math.ceil(txSize * Number(baseFeeRate)));

      // Never go below absolute minimum fee
      return BigInt(
        Math.max(
          Number(minFee),
          Number(BLOCKCHAIN_CONSTANTS.TRANSACTION.MIN_FEE),
        ),
      );
    } catch (error) {
      Logger.warn('Failed to get dynamic min fee, using fallback:', error);
      // Fallback to static minimum
      return BigInt(BLOCKCHAIN_CONSTANTS.TRANSACTION.MIN_FEE);
    }
  }

  /**
   * Calculate maximum allowed fee based on current network conditions
   * @param txSize Transaction size in bytes
   * @returns Promise<bigint> Maximum allowed fee
   */
  private async getDynamicMaxFee(txSize: number): Promise<bigint> {
    try {
      // Calculate dynamic max fee based on congestion
      const baseMaxFee = await TransactionBuilder.mempool.getBaseFeeRate();
      const dynamicMaxFee = baseMaxFee * txSize;

      // Never exceed absolute maximum fee
      return BigInt(
        Math.min(
          Number(dynamicMaxFee),
          Number(await TransactionBuilder.mempool.getMaxFeeRate()),
        ),
      );
    } catch (error) {
      Logger.warn('Failed to get dynamic max fee, using fallback:', error);
      // Fallback to static maximum
      return BigInt(await TransactionBuilder.mempool.getMaxFeeRate());
    }
  }
}

/**
 * Estimates the fee for a transaction based on its size and current network conditions
 * @param {number} targetBlocks - Number of blocks within which the transaction should be included
 * @returns {Promise<bigint>} Estimated fee in smallest currency unit
 */
export async function estimateFee(targetBlocks: number = 6): Promise<bigint> {
  try {
    // Input validation
    if (targetBlocks < 1 || targetBlocks > 1008) {
      // 1008 blocks = 1 week
      throw new TransactionError('Invalid target block range (1-1008)');
    }

    // Base fee calculation constants
    const BASE_FEE = await TransactionBuilder.mempool.getBaseFeeRate();
    const MIN_FEE = BigInt(await TransactionBuilder.mempool.getMinFeeRate());
    const MAX_FEE = BigInt(await TransactionBuilder.mempool.getMaxFeeRate());

    // Congestion-based multiplier
    const congestionMultiplier = Math.max(1, (20 - targetBlocks) / 10);

    // Dynamic fee calculation based on target confirmation blocks
    let estimatedFee = BigInt(
      Math.floor(
        Number(BASE_FEE) *
          congestionMultiplier *
          (1 + (Math.log(targetBlocks) / Math.log(2)) * 0.1),
      ),
    );

    // Apply network conditions adjustment
    const networkMultiplier = await getNetworkConditionsMultiplier();
    estimatedFee =
      (estimatedFee * BigInt(Math.ceil(networkMultiplier * 100))) / BigInt(100);

    // Ensure fee is within acceptable range
    estimatedFee = estimatedFee < MIN_FEE ? MIN_FEE : estimatedFee;
    estimatedFee = estimatedFee > MAX_FEE ? MAX_FEE : estimatedFee;

    Logger.debug('Fee estimation', {
      targetBlocks,
      estimatedFee: estimatedFee.toString(),
      congestionMultiplier,
      networkMultiplier,
    });

    return estimatedFee;
  } catch (error) {
    Logger.error('Fee estimation failed:', error);
    throw new TransactionError('Failed to estimate fee');
  }
}

/**
 * Get network conditions multiplier for fee adjustment
 * @returns {Promise<number>} Network conditions multiplier
 */
async function getNetworkConditionsMultiplier(): Promise<number> {
  try {
    const mempoolInfo = await this.mempool.getMempoolInfo();
    const loadFactor = mempoolInfo.loadFactor;

    // Progressive scaling based on mempool load
    if (loadFactor <= 0.5) return 1.0;
    if (loadFactor <= 0.75) return 1.0 + (loadFactor - 0.5) * 2;
    if (loadFactor <= 0.9) return 1.5 + (loadFactor - 0.75) * 4;
    return 2.1 + (loadFactor - 0.9) * 8;
  } catch (error) {
    Logger.warn('Failed to get network conditions:', error);
    return 1.0; // Conservative fallback
  }
}
