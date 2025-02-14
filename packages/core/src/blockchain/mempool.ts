import { Transaction, TransactionType } from '../models/transaction.model';
import { UTXO, UTXOSet } from '../models/utxo.model';
import { Logger } from '@h3tag-blockchain/shared';
import { HybridDirectConsensus } from './consensus/hybrid-direct';
import { Blockchain } from './blockchain';
import { HealthMonitor } from '../monitoring/health';
import { AuditEventType, AuditSeverity } from '../security/audit';
import { AuditManager } from '../security/audit';
import { FileAuditStorage } from '../security/fileAuditStorage';
import { Mutex } from 'async-mutex';
import { Cache } from '../scaling/cache';
import { Validator } from '../models/validator';
import { TransactionBuilder } from '../models/transaction.model';
import { BLOCKCHAIN_CONSTANTS } from './utils/constants';
import { DDoSProtection } from '../security/ddos';
import { Node } from '../network/node';
import { performance } from 'perf_hooks';

/**
 * @fileoverview Mempool manages unconfirmed transactions before they are included in blocks.
 * It implements transaction validation, fee-based prioritization, and memory management with
 * configurable limits and eviction policies.
 *
 * @module Mempool
 */

/**
 * Mempool class manages unconfirmed transactions with fee prioritization and ancestor/descendant tracking.
 *
 * @class Mempool
 *
 * @property {Map<string, Transaction>} transactions - Map of transactions in mempool
 * @property {Map<number, Set<string>>} feeRateBuckets - Fee rate-based transaction grouping
 * @property {Map<string, Set<string>>} ancestorMap - Transaction ancestor relationships
 * @property {Map<string, Set<string>>} descendantMap - Transaction descendant relationships
 * @property {HybridDirectConsensus} consensus - Consensus mechanism instance
 * @property {Blockchain} blockchain - Blockchain instance
 * @property {Node} node - Network node instance
 * @property {HealthMonitor} healthMonitor - Mempool health monitoring
 * @property {AuditManager} auditManager - Audit logging manager
 * @property {Cache} cache - Transaction cache
 * @property {DDoSProtection} ddosProtection - DDoS protection
 *
 * @example
 * const mempool = new Mempool(blockchain);
 * await mempool.addTransaction(transaction);
 * const pendingTxs = mempool.getPendingTransactions();
 */

/**
 * @typedef {Object} MempoolInfo
 * @property {number} size - Number of transactions
 * @property {number} bytes - Total size in bytes
 * @property {number} usage - Memory usage
 * @property {number} maxSize - Maximum size limit
 * @property {number} maxMemoryUsage - Maximum memory limit
 * @property {number} currentMemoryUsage - Current memory usage
 * @property {number} loadFactor - Current load factor
 * @property {Object} fees - Fee statistics
 * @property {Object} transactions - Transaction statistics
 * @property {Object} age - Transaction age statistics
 * @property {Object} health - Health status
 */

/**
 * @typedef {Object} FeeMetrics
 * @property {number} mean - Mean fee rate
 * @property {number} median - Median fee rate
 * @property {number} min - Minimum fee rate
 * @property {number} max - Maximum fee rate
 */

/**
 * @typedef {Object} RawMempoolEntry
 * @property {string} txid - Transaction ID
 * @property {number} fee - Transaction fee
 * @property {number} vsize - Virtual size
 * @property {number} weight - Transaction weight
 * @property {number} time - Entry timestamp
 * @property {number} height - Entry height
 * @property {number} descendantcount - Number of descendants
 * @property {number} descendantsize - Size of descendants
 * @property {number} ancestorcount - Number of ancestors
 * @property {number} ancestorsize - Size of ancestors
 * @property {string[]} depends - Dependencies
 */

/**
 * Creates a new Mempool instance
 *
 * @constructor
 * @param {Blockchain} blockchain - Blockchain instance
 */

/**
 * Adds a transaction to the mempool
 *
 * @async
 * @method addTransaction
 * @param {Transaction} transaction - Transaction to add
 * @param {boolean} [broadcast=true] - Whether to broadcast to peers
 * @returns {Promise<boolean>} True if transaction was added
 * @throws {Error} If transaction is invalid or mempool is full
 *
 * @example
 * const success = await mempool.addTransaction(tx);
 * if (success) {
 *   console.log('Transaction added to mempool');
 * }
 */

/**
 * Removes transactions from mempool
 *
 * @method removeTransactions
 * @param {Transaction[]} transactions - Transactions to remove
 * @returns {void}
 */

/**
 * Gets mempool information and statistics
 *
 * @method getMempoolInfo
 * @returns {MempoolInfo} Mempool statistics
 *
 * @example
 * const info = mempool.getMempoolInfo();
 * console.log(`Mempool size: ${info.size} transactions`);
 */

/**
 * Gets fee metrics for mempool transactions
 *
 * @method getFeeMetrics
 * @returns {FeeMetrics} Fee statistics
 */

/**
 * Gets transactions ordered by fee rate
 *
 * @method getTransactionsByFeeRate
 * @param {number} [limit] - Maximum transactions to return
 * @returns {Transaction[]} Ordered transactions
 */

/**
 * Validates transaction for mempool acceptance
 *
 * @async
 * @method validateTransaction
 * @param {Transaction} transaction - Transaction to validate
 * @returns {Promise<boolean>} True if transaction is valid
 * @throws {Error} If validation fails
 */

/**
 * Checks if transaction exists in mempool
 *
 * @method hasTransaction
 * @param {string} txid - Transaction ID
 * @returns {boolean} True if transaction exists
 */

/**
 * Gets ancestor transactions
 *
 * @method getAncestors
 * @param {string} txid - Transaction ID
 * @returns {Set<string>} Ancestor transaction IDs
 */

/**
 * Gets descendant transactions
 *
 * @method getDescendants
 * @param {string} txid - Transaction ID
 * @returns {Set<string>} Descendant transaction IDs
 */

/**
 * Cleans up expired transactions
 *
 * @private
 * @method cleanupExpiredTransactions
 * @returns {void}
 */

/**
 * Updates mempool state after block addition
 *
 * @async
 * @method updateAfterBlock
 * @param {Block} block - New block
 * @returns {Promise<void>}
 */

interface MempoolInfo {
  size: number;
  bytes: number;
  usage: number;
  maxSize: number;
  maxMemoryUsage: number;
  currentMemoryUsage: number;
  loadFactor: number;

  fees: {
    base: number;
    current: number;
    mean: number;
    median: number;
    min: number;
    max: number;
  };

  transactions: {
    total: number;
    pending: number;
    distribution: Record<TransactionType, number>;
  };

  age: {
    oldest: number;
    youngest: number;
  };

  health: {
    status: 'healthy' | 'degraded' | 'critical';
    lastUpdate: number;
    isAcceptingTransactions: boolean;
  };
}

interface FeeMetrics {
  mean: number;
  median: number;
  min: number;
  max: number;
}

interface RawMempoolEntry {
  txid: string;
  fee: number;
  vsize: number;
  weight: number;
  time: number;
  height: number;
  descendantcount: number;
  descendantsize: number;
  ancestorcount: number;
  ancestorsize: number;
  depends: string[];
}

interface PerformanceMarker {
  label: string;
  startTime: number;
  startMemory: number;
}

interface VoteTransaction extends Transaction {
  _processedVote?: boolean;
}

/**
 * Mempool class for managing unconfirmed transactions
 * @class
 * @description Handles transaction queuing, validation, and fee-based prioritization
 */
export class Mempool {
  private readonly transactions: Map<string, Transaction>;
  private readonly feeRateBuckets: Map<number, Set<string>>;
  private readonly ancestorMap: Map<string, Set<string>>;
  private readonly descendantMap: Map<string, Set<string>>;
  private consensus: HybridDirectConsensus | undefined;
  private readonly blockchain: Blockchain;
  private readonly node: Node | undefined;

  // Add missing required properties with defaults
  private readonly MAX_ANCESTORS = 25;
  private readonly MAX_DESCENDANTS = 25;
  private readonly RBF_INCREMENT = 1.1;
  readonly maxSize: number = 50000;
  private readonly maxTransactionAge: number = 72 * 60 * 60 * 1000; // 72 hours
  private readonly healthMonitor: HealthMonitor;
  private readonly auditManager: AuditManager;
  private readonly reputationSystem: Map<string, number>;
  private readonly lastVoteHeight: Map<string, number>;
  private readonly voteCounter: Map<string, number>;
  private readonly cache = new Cache<Map<string, number>>({
    ttl: 300000, // 5 minutes
    maxSize: 1000,
    onEvict: (key: string, value: Map<string, number> | undefined) => {
      if (!value) return;
      try {
        // Clear the map
        value.clear();

        // Log eviction event
        Logger.debug('Cache entry evicted', {
          key,
          valueSize: value.size,
          timestamp: Date.now(),
        });

        // Trigger garbage collection if needed
        if (process.memoryUsage().heapUsed > 1024 * 1024 * 512) {
          // 512MB
          global.gc?.();
        }
      } catch (error) {
        Logger.error('Cache eviction error:', {
          key,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
  private readonly AUDIT_DIR = './audit-logs';
  private readonly reputationMutex = new Mutex();
  private readonly performanceMonitor = {
    start: (label: string): PerformanceMarker => {
      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      Logger.debug('Performance monitoring started', {
        label,
        startTime,
        startMemory,
      });

      return {
        label,
        startTime,
        startMemory,
      };
    },

    end: (marker: PerformanceMarker): void => {
      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      const duration = endTime - marker.startTime;
      const memoryDiff = endMemory - marker.startMemory;

      Logger.debug('Performance monitoring ended', {
        label: marker.label,
        duration: `${duration.toFixed(2)}ms`,
        memoryUsed: `${(memoryDiff / 1024 / 1024).toFixed(2)}MB`,
        totalHeap: `${(endMemory / 1024 / 1024).toFixed(2)}MB`,
      });
    },
  };
  private readonly powCache = new Cache<number>({
    ttl: 300000, // 5 minutes
    maxSize: 1000,
  });

  // Add new constants for absence penalties
  private readonly VALIDATOR_PENALTIES = {
    MISSED_VALIDATION: -5,
    MISSED_VOTE: -3,
    CONSECUTIVE_MISS_MULTIPLIER: 1.5,
    MAX_CONSECUTIVE_MISSES: 3,
  } as const;

  // Add tracking for consecutive misses
  private readonly consecutiveMisses: Map<string, number> = new Map();

  // Track active and backup validators
  private activeValidators: Map<
    string,
    {
      primary: string;
      backups: string[];
      lastRotation: number;
    }
  > = new Map();

  private lastChangeTimestamp = Date.now();

  private cleanupInterval: NodeJS.Timeout | undefined;

  // Change the type so that each cache entry includes its own timestamp.
  private readonly mempoolStateCache: Map<string, { value: string; timestamp: number }> = new Map();

  // Updated transactionMutexes to include both the Mutex and its creation timestamp.
  private readonly transactionMutexes = new Map<string, { mutex: Mutex; createdAt: number }>();

  private lastValidFee: number = Number(
    BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_FEE_RATE,
  );

  private ddosProtection: DDoSProtection;

  public size: number = 0;
  public bytes: number = 0;
  public usage: number = 0;

  // Add a configurable property for the base fee rate.
  private baseMinFee: number;

  private inputIndex: Map<string, string> = new Map(); // Key: `${txId}-${outputIndex}`, Value: Transaction hash

  constructor(blockchain: Blockchain, baseMinFee?: number) {
    this.blockchain = blockchain;
    this.transactions = new Map();
    this.feeRateBuckets = new Map();
    this.ancestorMap = new Map();
    this.descendantMap = new Map();
    this.reputationSystem = new Map();
    this.lastVoteHeight = new Map();
    this.voteCounter = new Map();
    // Use the provided base fee or default to the constant.
    this.baseMinFee = baseMinFee !== undefined
      ? Number(baseMinFee)
      : Number(BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_FEE_RATE);

    // Initialize fee rate buckets
    this.initializeFeeRateBuckets();

    this.healthMonitor = new HealthMonitor({
      interval: 60000, // 1 minute
      thresholds: {
        minPowNodes: 3,
        minPowHashrate: 1000000,
        minTagDistribution: 0.1,
        maxTagConcentration: 0.25,
      },
    });

    this.auditManager = new AuditManager(
      new FileAuditStorage({
        baseDir: this.AUDIT_DIR,
        compression: true,
        maxRetries: 3,
        retryDelay: 1000,
        maxConcurrentWrites: 5,
      }),
    );

    // Initialize vote tracking
    this.initializeVoteTracking();

    // Start periodic cleanup
    this.initializeCleanupInterval();

    // Initialize DDoS protection
    this.ddosProtection = new DDoSProtection(
      {
        maxRequests: {
          default: 150,
          pow: 100,
          quadraticVote: 100,
        },
        windowMs: 60000,
        blockDuration: 1200000, // 20 minutes
      },
      this.auditManager,
    );

    // Note: Call mempool.initialize() after construction
  }

  /**
   * Initializes the mempool and its dependencies.
   * Must be called after construction and before using the mempool.
   */
  public async initialize(): Promise<void> {
    try {
      await this.auditManager.initialize();
      Logger.info('Mempool initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize mempool:', error);
      throw error;
    }
  }

  private async initializeVoteTracking(): Promise<void> {
    // Load reputation data
    const reputationData = await this.loadReputationData();
    Array.from(reputationData).forEach(([address, reputation]) => {
      this.reputationSystem.set(address, reputation);
    });

    // Reset vote counters periodically
    setInterval(() => {
      this.voteCounter.clear();
    }, BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.RATE_LIMIT_WINDOW * 1000).unref();
  }

  private async validateVoteEligibility(address: string): Promise<boolean> {
    try {
      const currentHeight = this.blockchain.getCurrentHeight();
      const accountAge = await this.getAccountAge(address);
      const reputation = this.reputationSystem.get(address) || 0;
      const lastVoteHeight = this.lastVoteHeight.get(address) || 0;
      const votesInWindow = this.voteCounter.get(address) || 0;

      // Add PoW validation using consensus mechanism
      const baseDifficulty = BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY || 0;
      const isValid = await this.consensus?.pow?.validateWork(address, baseDifficulty);

      // Check all requirements including PoW validation
      return (
        (accountAge >= BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_ACCOUNT_AGE &&
          isValid &&
          reputation >=
            BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.REPUTATION_THRESHOLD &&
          currentHeight - lastVoteHeight >=
            BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.COOLDOWN_BLOCKS &&
          votesInWindow <
            BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTES_PER_WINDOW) ||
        false
      );
    } catch (error) {
      Logger.error('Error validating vote eligibility:', error);
      return false;
    }
  }

  private async updateVoteTracking(address: string): Promise<void> {
    const currentHeight = this.blockchain.getCurrentHeight();
    this.lastVoteHeight.set(address, currentHeight);
    this.voteCounter.set(address, (this.voteCounter.get(address) || 0) + 1);
  }

  public async addTransaction(transaction: Transaction): Promise<boolean> {
    // Ensure mutex exists
    if (!this.transactionMutexes.has(transaction.hash)) {
      this.transactionMutexes.set(transaction.hash, {
        mutex: new Mutex(),
        createdAt: Date.now(),
      });
    }

    const mutex = this.transactionMutexes.get(transaction.hash)!;
    const release = await mutex.mutex.acquire();

    try {
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(
          () => reject(new Error('Transaction processing timeout')),
          30000,
        );
      });

      const result = await Promise.race([
        this.processTransaction(transaction),
        timeoutPromise,
      ]);

      // Clean up mutex after successful processing
      if (result) {
        this.transactionMutexes.delete(transaction.hash);
      }

      return result;
    } catch (error) {
      Logger.error('Transaction processing failed', {
        txId: transaction.hash,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    } finally {
      release();
    }
  }

  private async processTransaction(transaction: Transaction): Promise<boolean> {
    // Check network health
    const health = await this.healthMonitor.getNetworkHealth();
    if (!health.isHealthy) {
      await this.auditManager.log(AuditEventType.MEMPOOL_HEALTH_CHECK_FAILED, {
        health,
        severity: AuditSeverity.HIGH,
      });
      return false;
    }

    // Validate transaction size and fees
    if (!this.validateTransactionSize(transaction)) {
      Logger.warn(`Transaction ${transaction.hash} failed size validation`);
      return false;
    }

    // Validate UTXO inputs for double-spending
    const inputsValid = await this.validateTransactionInputs(transaction);
    if (!inputsValid) {
      Logger.warn(`Transaction ${transaction.hash} failed UTXO validation`);
      return false;
    }

    // Process the transaction based on type
    switch (transaction.type) {
      case TransactionType.QUADRATIC_VOTE: {
        const isEligible = await this.validateVoteEligibility(
          transaction.sender,
        );
        if (!isEligible) return false;
        await this.handleVoteTransaction(transaction);
        await this.updateVoteTracking(transaction.sender);
        break; // Ensure to break out of the case
      }

      case TransactionType.POW_REWARD: {
        const isValidPoW = await this.consensus?.pow?.validateReward(
          transaction,
          this.blockchain.getCurrentHeight(),
        );
        if (!isValidPoW) return false;
        break; // Ensure to break out of the case
      }

      default: {
        const isValid = await this.validateTransaction(
          transaction,
          await this.blockchain.getUTXOSet(),
          this.blockchain.getCurrentHeight(),
        );
        if (!isValid) return false;
        break; // Ensure to break out of the case
      }
    }

    // RBF and ancestry checks
    const rbfAccepted = await this.handleRBF(transaction);
    if (!rbfAccepted) return false;

    if (!this.checkAncestryLimits(transaction)) return false;

    await this.addToMempool(transaction);
    return true;
  }

  private async addToMempool(transaction: Transaction): Promise<void> {
    this.transactions.set(transaction.hash, transaction);
    this.updateInputIndex(transaction);
    this.updateAncestryMaps(transaction);
    await this.updateFeeBuckets(transaction);
  }

  private async handleVoteTransaction(vote: Transaction): Promise<void> {
    const voteTx = vote as VoteTransaction;
    // Ensure the vote is processed only once to avoid duplicate handling.
    if (voteTx._processedVote) {
      Logger.debug(`Vote transaction ${vote.id} already processed.`);
      return;
    }
    voteTx._processedVote = true;

    const sender = vote.sender;

    // Check rate limits for the sender.
    const currentVoteCount = this.voteCounter.get(sender) || 0;
    if (currentVoteCount >= BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTES_PER_WINDOW) {
      Logger.warn(`Vote rate limit exceeded for ${sender}`);
      return;
    }

    // Add DDoS protection: if blocked, immediately return.
    if (!this.ddosProtection.checkRequest('vote_tx', sender)) {
      Logger.warn(`DDoS protection blocked vote from ${sender}`);
      return;
    }

    // Retrieve UTXO set and eligible voting UTXOs only once.
    const utxoSet = await this.blockchain.getUTXOSet();
    const votingUtxos = await utxoSet.findUtxosForVoting(sender);
    if (!votingUtxos || votingUtxos.length === 0) {
      Logger.warn('No eligible UTXOs for voting', { sender });
      return;
    }

    // Calculate voting power using quadratic voting logic.
    const votingPower = utxoSet.calculateVotingPower(votingUtxos);
    if (votingPower <= BigInt(0)) {
      Logger.warn('Invalid or insufficient voting power', { sender });
      return;
    }

    // Update vote counter for rate limiting.
    this.voteCounter.set(sender, currentVoteCount + 1);

    // Update the vote transaction with vote data.
    voteTx.voteData = {
      proposal: vote.id,
      vote: true,
      weight: Number(votingPower),
    };

    try {
      // Directly add the processed vote transaction to the mempool to avoid recursive processing.
      await this.addToMempool(voteTx);
      await this.auditManager.log(AuditEventType.VOTE_TRANSACTION_ADDED, {
        sender,
        votingPower: votingPower.toString(),
        utxoCount: votingUtxos.length,
        severity: AuditSeverity.INFO,
      });
    } catch (error: unknown) {
      Logger.error('Error handling vote transaction:', error);
      await this.auditManager.log(AuditEventType.VOTE_TRANSACTION_FAILED, {
        error: error instanceof Error ? error.message : 'Unknown error',
        severity: AuditSeverity.ERROR,
      });
    }
  }

  /**
   * Retrieves a transaction by its ID
   * @param {string} txId - Transaction ID to lookup
   * @returns {Transaction | undefined} Transaction if found, undefined otherwise
   * @throws {Error} If there's an error accessing the mempool
   */
  getTransaction(txId: string): Transaction | undefined {
    // Add DDoS protection for transaction lookups
    if (
      !this.ddosProtection.checkRequest('get_tx', this.node?.getAddress() || '')
    ) {
      Logger.warn('DDoS protection blocked transaction lookup');
      return undefined;
    }

    try {
      if (!txId) {
        Logger.warn('Invalid transaction ID requested');
        return undefined;
      }

      const tx = this.transactions.get(txId);
      Logger.debug(
        `Transaction ${txId} ${tx ? 'found' : 'not found'} in mempool`,
      );
      return tx;
    } catch (error) {
      Logger.error('Error retrieving transaction:', error);
      return undefined;
    }
  }

  /**
   * Checks if a transaction exists in the mempool
   * @param {string} txId - Transaction ID to check
   * @returns {boolean} True if transaction exists, false otherwise
   */
  hasTransaction(txId: string): boolean {
    try {
      if (!txId) {
        Logger.warn('Invalid transaction ID checked');
        return false;
      }
      return this.transactions.has(txId);
    } catch (error) {
      Logger.error('Error checking transaction existence:', error);
      return false;
    }
  }

  /**
   * Gets the current size of the mempool
   * @returns {number} Number of transactions in mempool
   */
  getSize(): number {
    try {
      const size = this.transactions.size;
      Logger.debug(`Current mempool size: ${size}`);
      return size;
    } catch (error) {
      Logger.error('Error getting mempool size:', error);
      return 0;
    }
  }

  /**
   * Clears all transactions from the mempool
   * @throws {Error} If clearing the mempool fails
   */
  clear(): void {
    try {
      const previousSize = this.transactions.size;
      this.transactions.clear();
      this.feeRateBuckets.clear();
      this.ancestorMap.clear();
      this.descendantMap.clear();
      Logger.info(`Mempool cleared. Previous size: ${previousSize}`);
    } catch (error) {
      Logger.error('Error clearing mempool:', error);
      throw new Error('Failed to clear mempool');
    }
  }

  /**
   * Retrieves pending transactions based on criteria
   * @param {Object} options - Filter options
   * @param {number} [options.limit] - Maximum number of transactions to return
   * @param {number} [options.minFeeRate] - Minimum fee rate in sat/byte
   * @returns {Promise<Transaction[]>} Array of pending transactions
   */
  async getPendingTransactions(
    options: {
      limit?: number;
      minFeeRate?: number;
    } = {},
  ): Promise<Transaction[]> {
    try {
      const { limit, minFeeRate } = options;

      let transactions = Array.from(this.transactions.values());

      // Apply fee rate filter if specified
      if (minFeeRate !== undefined) {
        transactions = transactions.filter(
          (tx) => this.calculateFeePerByte(tx) >= minFeeRate,
        );
      }

      // Sort by fee rate (highest first)
      transactions.sort(
        (a, b) => this.calculateFeePerByte(b) - this.calculateFeePerByte(a),
      );

      // Apply limit if specified
      if (limit !== undefined) {
        transactions = transactions.slice(0, limit);
      }

      Logger.debug(`Retrieved ${transactions.length} pending transactions`);
      return transactions;
    } catch (error) {
      Logger.error('Error retrieving pending transactions:', error);
      throw new Error('Failed to retrieve pending transactions');
    }
  }

  /**
   * Estimates transaction fee based on mempool state
   * @param {number} targetBlocks - Target number of blocks for confirmation
   * @returns {number} Estimated fee rate in TAG satoshis/byte
   */
  estimateFee(targetBlocks: number): number {
    let totalFeeRate = 0;
    let count = 0;

    // Calculate average fee rate from recent transactions
    Array.from(this.feeRateBuckets.entries()).forEach(([rate, txs]) => {
      if (txs.size > 0) {
        totalFeeRate += rate * txs.size;
        count += txs.size;
      }
    });

    // Adjust based on target blocks (higher for faster confirmation)
    const baseFeeRate = count > 0 ? totalFeeRate / count : 1;
    const adjustedRate = baseFeeRate * (1 + 1 / targetBlocks);

    // Ensure minimum fee rate (0.00000001 TAG/byte)
    return Math.max(adjustedRate, 0.00000001);
  }

  /**
   * Removes transactions that are included in a block
   * @param {Transaction[]} transactions - Array of transactions to remove
   */
  public removeTransactions(transactions: Transaction[]): void {
    if (!transactions || !Array.isArray(transactions)) {
      throw new Error('INVALID_INPUT');
    }
    transactions.forEach((tx) => {
      this.removeTransaction(tx.id);
    });
  }

  /**
   * Gets all UTXOs for a specific address from mempool transactions
   * @param {string} address - Address to get UTXOs for
   * @returns {UTXO[]} Array of unspent transaction outputs
   */
  getPendingUTXOsForAddress(address: string): UTXO[] {
    return Array.from(this.transactions.values()).flatMap((tx) =>
      tx.outputs
        .filter((output) => output.address === address)
        .map((output, index) => ({
          txId: tx.id,
          outputIndex: index,
          address: output.address,
          publicKey: output.publicKey || '',
          amount: output.amount,
          script: output.script,
          timestamp: tx.timestamp,
          spent: false,
          currency: {
            name: 'H3Tag',
            symbol: 'TAG',
            decimals: 8,
          },
          confirmations: 0,
        })),
    );
  }

  private initializeFeeRateBuckets(): void {
    // Initialize fee rate buckets (in sat/byte)
    const buckets = [1, 2, 5, 10, 20, 50, 100, 200, 500];
    buckets.forEach((rate) => this.feeRateBuckets.set(rate, new Set()));
  }

  private async handleRBF(transaction: Transaction): Promise<boolean> {
    // Retrieve the IDs of conflicting transactions (with overlapping inputs)
    const conflictingTransactionIds = this.findConflictingTransactions(transaction);
    if (conflictingTransactionIds.size === 0) return true;

    // Map each conflicting transaction ID to its fee rate from the mempool
    const conflictingFeeRates = Array.from(conflictingTransactionIds).map(txId => {
      const conflictingTx = this.transactions.get(txId);
      return conflictingTx ? this.calculateFeePerByte(conflictingTx) : 0;
    });

    // Use the highest fee rate among the conflicting transactions as basis for RBF check
    const maxOldFeeRate = Math.max(...conflictingFeeRates);

    // Compute the fee rate for the new (replacement) transaction
    const newFeeRate = this.calculateFeePerByte(transaction);

    Logger.debug('RBF check', { 
      newFeeRate, 
      maxOldFeeRate, 
      requiredFeeRate: maxOldFeeRate * this.RBF_INCREMENT 
    });

    // Ensure the new transaction's fee rate exceeds the highest conflicting fee rate by the required multiplier
    return newFeeRate > maxOldFeeRate * this.RBF_INCREMENT;
  }

  private findConflictingTransactions(tx: Transaction): Set<string> {
    const conflicts = new Set<string>();
    
    // Build a set of input keys used by the new transaction.
    const newTxInputKeys = new Set<string>();
    for (const input of tx.inputs) {
      const key = `${input.txId}:${input.outputIndex}`;
      newTxInputKeys.add(key);
    }
    
    // Check for duplicate inputs within the new transaction (self-conflict).
    const seenKeys = new Set<string>();
    for (const key of newTxInputKeys) {
      if (seenKeys.has(key)) {
        conflicts.add(tx.id);
        break;
      }
      seenKeys.add(key);
    }
    
    // Iterate over all mempool transactions and check for overlapping inputs.
    for (const [, memTx] of this.transactions) {
      // Skip the new transaction if somehow present.
      if (memTx.id === tx.id) continue;
      
      for (const input of memTx.inputs) {
        const key = `${input.txId}:${input.outputIndex}`;
        if (newTxInputKeys.has(key)) {
          conflicts.add(memTx.id);
          // Break out early once a conflict is found for this mempool tx.
          break;
        }
      }
    }
    
    return conflicts;
  }

  private checkAncestryLimits(tx: Transaction): boolean {
    const ancestors = this.getAncestors(tx);
    const descendants = this.getDescendants(tx);
    return (
      ancestors.size <= this.MAX_ANCESTORS &&
      descendants.size <= this.MAX_DESCENDANTS
    );
  }

  private getAncestors(tx: Transaction): Set<string> {
    const ancestors = new Set<string>();
    tx.inputs.forEach((input) => {
      const parentTx = this.transactions.get(input.txId);
      if (parentTx) {
        ancestors.add(parentTx.id);
        const parentAncestors = this.ancestorMap.get(parentTx.id) || new Set();
        parentAncestors.forEach((a) => ancestors.add(a));
      }
    });
    return ancestors;
  }

  private getDescendants(tx: Transaction): Set<string> {
    return this.descendantMap.get(tx.id) || new Set();
  }

  /**
   * Calculate fee per byte for transaction
   */
  private calculateFeePerByte(transaction: Transaction): number {
    try {
      const size = this.calculateTransactionSize(transaction);
      if (size === 0) return 0;

      // Use bigint for precise calculation
      const feeBI = BigInt(transaction.fee);
      const sizeBI = BigInt(size);

      // Calculate fee per byte with precision
      const feePerByte = Number((feeBI * BigInt(1e8)) / sizeBI) / 1e8;

      // Ensure minimum fee rate
      return Math.max(
        Number(feePerByte),
        Number(BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_FEE_RATE),
      );
    } catch (error) {
      Logger.error('Fee calculation error', {
        txId: transaction.hash,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return Number(BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_FEE_RATE);
    }
  }

  /**
   * Get transaction size in bytes
   */
  private getTransactionSize(transaction: Transaction): number {
    // Rough estimation of transaction size
    const baseSize = 10; // Version, locktime, etc.
    const inputSize = transaction.inputs.length * 180; // Average input size
    const outputSize = transaction.outputs.length * 34; // Average output size
    return baseSize + inputSize + outputSize;
  }

  /**
   * Get all transactions in mempool
   */
  getTransactions(): Transaction[] {
    return Array.from(this.transactions.values());
  }

  private updateAncestryMaps(transaction: Transaction): void {
    // Update ancestor map
    const ancestors = this.getAncestors(transaction);
    this.ancestorMap.set(transaction.hash, ancestors);

    // Update descendant map
    transaction.inputs.forEach((input) => {
      const parentTx = this.transactions.get(input.txId);
      if (parentTx) {
        const descendants = this.descendantMap.get(parentTx.id) || new Set();
        descendants.add(transaction.hash);
        this.descendantMap.set(parentTx.id, descendants);
      }
    });
  }

  private async updateFeeBuckets(transaction: Transaction): Promise<void> {
    try {
      const oldBucket = this.findFeeBucket(transaction);
      if (oldBucket) {
        oldBucket.delete(transaction.hash);
      }

      const feeRate = this.calculateFeePerByte(transaction);
      const newBucket = this.getOrCreateFeeBucket(feeRate);
      newBucket.add(transaction.hash);
    } catch (error: unknown) {
      // Add cleanup
      Logger.error('Fee bucket update failed:', error);
      await this.auditManager?.log(AuditEventType.FEE_BUCKET_UPDATE_FAILED, {
        txId: transaction.hash,
        error: (error as Error).message,
        severity: AuditSeverity.ERROR,
      });
    }
  }

  public removeTransaction(txId: string): void {
    try {
      const tx = this.transactions.get(txId);
      if (!tx) {
        Logger.warn(`Transaction ${txId} not found in mempool`);
        return;
      }

      // Remove transaction from the main transactions map
      this.transactions.delete(txId);

      // Remove transaction from all fee rate buckets
      for (const bucket of this.feeRateBuckets.values()) {
        bucket.delete(txId);
      }

      // Remove associated input index entries for this transaction
      for (const [key, value] of this.inputIndex.entries()) {
        if (value === tx.hash) {
          this.inputIndex.delete(key);
        }
      }

      // Remove the transaction mutex if it exists
      if (this.transactionMutexes.has(tx.hash)) {
        this.transactionMutexes.delete(tx.hash);
      }

      // Remove the transaction's ID from all ancestor and descendant sets in other transactions
      this.ancestorMap.forEach((ancestors) => {
        ancestors.delete(txId);
      });
      this.descendantMap.forEach((descendants) => {
        descendants.delete(txId);
      });

      // Remove the entry for this transaction from the ancestry maps
      this.ancestorMap.delete(txId);
      this.descendantMap.delete(txId);

      Logger.debug(`Transaction ${txId} removed from mempool and cleaned up.`);
    } catch (error) {
      Logger.error(`Failed to remove transaction ${txId}:`, error);
    }
  }

  public async validateTransaction(
    transaction: Transaction,
    utxoSet: UTXOSet,
    currentHeight: number,
  ): Promise<boolean> {
    const perfMarker = this.performanceMonitor.start('validate_transaction');

    try {
      if (!this.validateBasicStructure(transaction)) {
        return false;
      }

      const txSize = this.getTransactionSize(transaction);
      const maxSize = await this.blockchain.getMaxTransactionSize();
      if (txSize > maxSize) {
        Logger.warn('Transaction exceeds size limit', {
          txId: transaction.hash,
          size: txSize,
          maxAllowed: maxSize,  
        });
        return false;
      }

      if (
        transaction.version !== BLOCKCHAIN_CONSTANTS.TRANSACTION.CURRENT_VERSION
      ) {
        Logger.warn('Invalid transaction version', {
          txId: transaction.hash,
          version: transaction.version,
          required: BLOCKCHAIN_CONSTANTS.TRANSACTION.CURRENT_VERSION,
        });
        return false;
      }

      const now = Date.now();
      if (transaction.timestamp > now + 7200000) {
        // 2 hours in future
        Logger.warn('Transaction timestamp too far in future', {
          txId: transaction.hash,
          timestamp: transaction.timestamp,
          currentTime: now,
        });
        return false;
      }

      if (!(await TransactionBuilder.verify(transaction))) {
        Logger.warn('Core transaction verification failed', {
          txId: transaction.hash,
        });
        return false;
      }

      if (!(await this.validateUTXOs(transaction, utxoSet))) {
        return false;
      }

      if (!(await this.validateMempoolState(transaction, utxoSet))) {
        return false;
      }

      // Add PoW validation for specific transaction types
      if (transaction.type === TransactionType.POW_REWARD) {
        const powContribution = await this.getPowContribution(
          transaction.sender,
        );

        // Check coinbase maturity (100 blocks)
        if (currentHeight < BLOCKCHAIN_CONSTANTS.MINING.MIN_BLOCKS_MINED) {
          Logger.warn('Coinbase not yet mature', {
            txId: transaction.hash,
            currentHeight,
            requiredMaturity: BLOCKCHAIN_CONSTANTS.MINING.MIN_BLOCKS_MINED,
          });
          return false;
        }

        if (powContribution <= 0) {
          Logger.warn('Invalid PoW contribution', { txId: transaction.hash });
          return false;
        }
      }

      if (transaction.type === TransactionType.QUADRATIC_VOTE) {
        const votingWeight = await this.getVotingContribution(
          transaction.sender,
        );
        if (votingWeight <= 0) {
          Logger.warn('Invalid voting weight', { txId: transaction.hash });
          return false;
        }
      }

      Logger.debug('Transaction validation successful', {
        txId: transaction.hash,
        size: txSize,
        inputs: transaction.inputs.length,
        outputs: transaction.outputs.length,
      });

      return true;
    } catch (error: unknown) {
      Logger.error('Transaction validation failed:', {
        error,
        txHash: transaction.hash,
        stack: new Error().stack,
      });
      await this.auditManager.log(
        AuditEventType.TRANSACTION_VALIDATION_FAILED,
        {
          txId: transaction?.hash,
          error: (error as Error).message,
          severity: AuditSeverity.ERROR,
        },
      );
      throw new Error('VALIDATION_FAILED');
    } finally {
      if (typeof perfMarker !== 'undefined') {
        this.performanceMonitor.end(perfMarker);
      }
    }
  }

  private validateBasicStructure(tx: Transaction): boolean {
    return !!(
      tx &&
      tx.hash && // updated to use hash
      tx.version &&
      Array.isArray(tx.inputs) &&
      Array.isArray(tx.outputs) &&
      tx.inputs.length > 0 &&
      tx.outputs.length > 0 &&
      tx.inputs.length <= BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_INPUTS &&
      tx.outputs.length <= BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_OUTPUTS
    );
  }

  private async validateUTXOs(
    tx: Transaction,
    utxoSet: UTXOSet,
  ): Promise<boolean> {
    try {
      // 1. Check for double-spend within mempool
      const hasDoubleSpend = tx.inputs.some((input) =>
        Array.from(this.transactions.values()).some((tx) =>
          tx.inputs.some(
            (i) => i.txId === input.txId && i.outputIndex === input.outputIndex,
          ),
        ),
      );

      if (hasDoubleSpend) {
        Logger.warn('Double-spend detected in mempool', {
          txId: tx.id,
        });
        return false;
      }

      // 4. Validate UTXO availability
      const utxoChecks = await Promise.all(
        tx.inputs.map(async (input) => {
          const utxo = await utxoSet.get(input.txId, input.outputIndex);
          if (!utxo || utxo.spent) {
            Logger.warn('Invalid or spent UTXO', {
              txId: tx.id,
              utxoId: input.txId,
              outputIndex: input.outputIndex,
            });
            return false;
          }
          return true;
        }),
      );

      if (utxoChecks.includes(false)) return false;

      return true;
    } catch (error) {
      Logger.error('UTXO validation error:', error);
      return false;
    }
  }

  private async validateMempoolState(
    transaction: Transaction,
    utxoSet: UTXOSet,
  ): Promise<boolean> {
    try {
      //Fee requirements
      const txSize = this.getTransactionSize(transaction);
      const feeRate = this.calculateFeePerByte(transaction);
      const minFeeRate = await this.getMinFeeRate();

      if (feeRate < minFeeRate) {
        Logger.warn('Insufficient fee rate', {
          txId: transaction.hash,
          feeRate: feeRate.toString(),
          minRequired: minFeeRate.toString(),
          size: txSize,
        });
        return false;
      }

      // Dynamic fee requirements during high congestion
      if (
        this.transactions.size >
        BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.HIGH_CONGESTION_THRESHOLD
      ) {
        const dynamicMinFee = await this.calculateDynamicMinFee();
        if (feeRate < dynamicMinFee) {
          Logger.warn('Fee too low during high congestion', {
            txId: transaction.hash,
            feeRate: feeRate.toString(),
            requiredRate: dynamicMinFee.toString(),
          });
          return false;
        }
      }

      // 1. Check for double-spend within mempool
      const doubleSpendChecks = await Promise.all(
        transaction.inputs.map(async (input) => {
          const isDoubleSpend = Array.from(this.transactions.values()).some(
            (tx) =>
              tx.inputs.some(
                (i) =>
                  i.txId === input.txId && i.outputIndex === input.outputIndex,
              ),
          );

          if (isDoubleSpend) {
            Logger.warn('Double-spend detected in mempool', {
              txId: transaction.hash,
            });
            return false;
          }
          return true;
        }),
      );

      if (doubleSpendChecks.includes(false)) return false;

      if (this.transactions.size >= (await this.getMaxSize())) {
        const minFeeRate = this.estimateFee(1);
        const txFeeRate = this.calculateFeePerByte(transaction);

        if (txFeeRate < minFeeRate) {
          Logger.warn('Fee too low for full mempool', {
            txId: transaction.hash,
            feeRate: txFeeRate,
            minFeeRate,
          });
          return false;
        }
      }

      // 3. Check ancestry limits
      if (!this.checkAncestryLimits(transaction)) {
        Logger.warn('Transaction exceeds ancestry limits', {
          txId: transaction.hash,
        });
        return false;
      }

      // 4. Validate UTXO availability
      const utxoChecks = await Promise.all(
        transaction.inputs.map(async (input) => {
          const utxo = await utxoSet.get(input.txId, input.outputIndex);
          if (!utxo || utxo.spent) {
            Logger.warn('UTXO not found or spent', {
              txId: transaction.hash,
              inputTxId: input.txId,
            });
            return false;
          }
          return true;
        }),
      );

      if (utxoChecks.includes(false)) return false;

      // 5. Check transaction age
      if (Date.now() - transaction.timestamp > this.maxTransactionAge) {
        Logger.warn('Transaction too old', { txId: transaction.hash });
        return false;
      }

      // Double Spend Check using index
      for (const input of transaction.inputs) {
        const key = `${input.txId}-${input.outputIndex}`;
        if (this.inputIndex.has(key)) {
          Logger.warn('Double-spend detected in mempool', { txId: transaction.hash });
          return false;
        }
      }

      return true;
    } catch (error) {
      Logger.error('Mempool state validation failed:', error);
      return false;
    }
  }

  private async calculateDynamicMinFee(): Promise<number> {
    try {
      // Get current mempool metrics
      const currentSize = this.transactions.size;
      const maxSize = await this.getMaxSize();
      const baseMinFee = this.baseMinFee;
      
      // Calculate congestion levels
      const congestionFactor = currentSize / maxSize;
      
      // Progressive fee scaling based on congestion levels
      let multiplier: number;
      if (congestionFactor <= 0.5) {
        multiplier = 1;
      } else if (congestionFactor <= 0.75) {
        multiplier = 1 + (congestionFactor - 0.5) * 2;
      } else if (congestionFactor <= 0.9) {
        multiplier = 2 + Math.pow(congestionFactor - 0.75, 2) * 8;
      } else {
        multiplier = 4 + Math.pow(congestionFactor - 0.9, 2) * 16;
      }
      
      // Calculate final fee rate with safety bounds
      const dynamicFee = Math.floor(baseMinFee * multiplier);
      const maxFee = baseMinFee * 20; // Cap at 20x base fee
      
      Logger.debug('Dynamic fee calculation', {
        congestion: `${(congestionFactor * 100).toFixed(2)}%`,
        multiplier: multiplier.toFixed(2),
        baseFee: baseMinFee,
        dynamicFee,
      });
      
      return Math.min(dynamicFee, maxFee);
    } catch (error: unknown) {
      Logger.error('Dynamic fee calculation failed:', error);
      // Add audit log for fee calculation failure
      this.auditManager?.log(AuditEventType.FEE_CALCULATION_FAILED, {
        error: (error as Error).message,
        severity: AuditSeverity.ERROR,
      });
      // Use a more reasonable fallback
      return Math.max(
        this.baseMinFee,
        this.lastValidFee || this.baseMinFee * 2,
      );
    }
  }

  private removeOldTransactions(): void {
    try {
      const now = Date.now();
      let removedCount = 0;

      Array.from(this.transactions.entries()).forEach(([txId, tx]) => {
        if (now - tx.timestamp > this.maxTransactionAge) {
          this.removeTransaction(txId);
          removedCount++;
        }
      });

      if (removedCount > 0) {
        Logger.info(
          `Removed ${removedCount} expired transactions from mempool`,
        );
        this.auditManager?.log(AuditEventType.OLD_TRANSACTIONS_REMOVED, {
          count: removedCount,
          timestamp: now,
          severity: AuditSeverity.INFO,
        });
      }
    } catch (error) {
      Logger.error('Failed to remove old transactions:', error);
    }
  }

  public async dispose(): Promise<void> {
    try {
      // Clear cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = undefined;
      }

      // Dispose of health monitor
      if (this.healthMonitor) {
        await this.healthMonitor.dispose();
      }

      // Dispose of audit manager
      if (this.auditManager) {
        await this.auditManager.dispose();
      }

      // Dispose of DDoS protection
      if (this.ddosProtection) {
        await this.ddosProtection.dispose();
      }

      // Clear all maps
      this.transactions.clear();
      this.feeRateBuckets.clear();
      this.ancestorMap.clear();
      this.descendantMap.clear();
      this.reputationSystem.clear();
      this.lastVoteHeight.clear();
      this.voteCounter.clear();
      this.inputIndex.clear();
      this.transactionMutexes.clear();
      this.mempoolStateCache.clear();
      this.consecutiveMisses.clear();
      this.activeValidators.clear();

      // Clear caches
      this.cache.clear();
      this.powCache.clear();

      Logger.info('Mempool disposed successfully');
    } catch (error) {
      Logger.error('Error disposing mempool:', error);
      throw error;
    }
  }

  private async getAccountAge(address: string): Promise<number> {
    try {
      const firstTx =
        await this.blockchain.getFirstTransactionForAddress(address);
      if (!firstTx) return 0;
      const currentHeight = this.blockchain.getCurrentHeight();
      return currentHeight - firstTx.blockHeight;
    } catch (error) {
      Logger.error('Error getting account age:', error);
      return 0;
    }
  }

  private async getPowContribution(address: string): Promise<number> {
    try {
      const cacheKey = `pow_contribution:${address}`;
      const cached = this.powCache.get(cacheKey);
      if (cached !== undefined) return cached;

      // Validate PoW work with retries
      const maxRetries = 3;
      let retryCount = 0;
      let contribution = 0;

      while (retryCount < maxRetries) {
        try {
          const baseDifficulty = BLOCKCHAIN_CONSTANTS.MINING.DIFFICULTY || 0;
          const isValid = await this.consensus?.pow?.validateWork(address, baseDifficulty);
          contribution = isValid ? 1 : 0;
          break;
        } catch (error) {
          retryCount++;
          if (retryCount === maxRetries) throw error;
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * retryCount),
          );
        }
      }

      // Cache result for 5 minutes
      this.powCache.set(cacheKey, contribution, { ttl: 300000 });

      // Log for monitoring
      await this.auditManager.log(AuditEventType.POW_CONTRIBUTION_CHECKED, {
        address,
        contribution,
        retries: retryCount,
        severity: AuditSeverity.INFO,
      });

      return contribution;
    } catch (error: unknown) {
      Logger.error('Error getting PoW contribution:', error);
      await this.auditManager.log(AuditEventType.POW_CONTRIBUTION_FAILED, {
        address,
        error: (error as Error).message,
        severity: AuditSeverity.ERROR,
      });
      return 0;
    }
  }

  private async loadReputationData(): Promise<Map<string, number>> {
    const perfMarker = this.performanceMonitor.start('load_reputation_data');
    try {
      const cacheKey = 'validator_reputation';
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const reputationData = new Map<string, number>();
      const validators = await this.blockchain.db.getValidators();

      await Promise.all(
        validators.map(async (validator) => {
          const reputation = await this.calculateValidatorReputation(validator);
          reputationData.set(validator.address, reputation);
        }),
      );

      // Cache results for 5 minutes
      this.cache.set(cacheKey, reputationData, { ttl: 300000 });

      // Log metrics
      await this.auditManager.log(AuditEventType.REPUTATION_DATA_LOADED, {
        validatorCount: validators.length,
        timestamp: Date.now(),
        severity: AuditSeverity.INFO,
      });

      return reputationData;
    } catch (error: unknown) {
      Logger.error('Failed to load reputation data:', error);
      await this.auditManager.log(AuditEventType.REPUTATION_LOAD_FAILED, {
        error: (error as Error).message,
        severity: AuditSeverity.ERROR,
      });
      return new Map();
    } finally {
      if (typeof perfMarker !== 'undefined') {
        this.performanceMonitor.end(perfMarker);
      }
    }
  }

  private async calculateValidatorReputation(
    validator: Validator,
  ): Promise<number> {
    try {
      // Get historical performance data
      const uptime = await this.blockchain.db.getValidatorUptime(
        validator.address,
      );
      const voteParticipation = await this.blockchain.db.getVoteParticipation(
        validator.address,
      );
      const blockProduction = await this.blockchain.db.getBlockProduction(
        validator.address,
      );
      const slashingHistory = await this.blockchain.db.getSlashingHistory(
        validator.address,
      );

      // Calculate weighted reputation score
      let reputation = 100; // Base score

      // Uptime impact (30%)
      reputation += uptime * 30 - 30;

      // Vote participation impact (25%)
      reputation += voteParticipation * 25 - 25;

      // Block production impact (25%)
      reputation += blockProduction * 25 - 25;

      // Slashing penalties (20% max penalty)
      const slashingPenalty = Math.min(slashingHistory.length * 5, 20);
      reputation -= slashingPenalty;

      // Ensure reputation stays within bounds
      return Math.max(0, Math.min(100, reputation));
    } catch (error) {
      Logger.error(
        `Failed to calculate reputation for ${validator.address}:`,
        error,
      );
      return 0;
    }
  }

  // Method to update validator reputation
  public async updateValidatorReputation(
    validatorAddress: string,
    reputationChange: number,
    reason: string,
  ): Promise<boolean> {
    const release = await this.reputationMutex.acquire();
    try {
      // Get current reputation
      const currentReputation =
        this.reputationSystem.get(validatorAddress) || 0;
      const newReputation = Math.max(
        0,
        Math.min(100, currentReputation + reputationChange),
      );

      // Update in-memory state
      this.reputationSystem.set(validatorAddress, newReputation);

      // Persist to database
      await this.blockchain.db.updateValidatorReputation(validatorAddress, {
        reputation: newReputation,
        lastUpdate: Date.now(),
        reason,
        change: reputationChange,
      });

      // Clear cache
      this.cache.delete('validator_reputation');

      // Audit trail
      await this.auditManager.log(AuditEventType.REPUTATION_UPDATED, {
        validator: validatorAddress,
        oldReputation: currentReputation,
        newReputation,
        reason,
        change: reputationChange,
        severity: AuditSeverity.INFO,
      });

      return true;
    } catch (error: unknown) {
      Logger.error('Failed to update validator reputation:', error);
      await this.auditManager.log(AuditEventType.REPUTATION_UPDATE_FAILED, {
        validator: validatorAddress,
        error: (error as Error).message,
        severity: AuditSeverity.ERROR,
      });
      return false;
    } finally {
      release();
    }
  }

  // Add method to handle validator absence
  public async handleValidatorAbsence(validatorAddress: string): Promise<void> {
    try {
      // Get consecutive misses
      const misses = (this.consecutiveMisses.get(validatorAddress) || 0) + 1;
      this.consecutiveMisses.set(validatorAddress, misses);

      // Calculate penalty with multiplier for consecutive misses
      const penalty =
        this.VALIDATOR_PENALTIES.MISSED_VALIDATION *
        Math.pow(
          this.VALIDATOR_PENALTIES.CONSECUTIVE_MISS_MULTIPLIER,
          misses - 1,
        );

      // Update reputation
      await this.updateValidatorReputation(
        validatorAddress,
        penalty,
        `Missed validation duty (${misses} consecutive misses)`,
      );

      // If too many consecutive misses, consider temporary suspension
      if (misses >= this.VALIDATOR_PENALTIES.MAX_CONSECUTIVE_MISSES) {
        await this.auditManager.log(AuditEventType.VALIDATOR_SUSPENSION, {
          validator: validatorAddress,
          consecutiveMisses: misses,
          severity: AuditSeverity.HIGH,
        });
        // Implement suspension logic here
      }
    } catch (error: unknown) {
      Logger.error('Failed to handle validator absence:', error);
      await this.auditManager.log(
        AuditEventType.VALIDATOR_ABSENCE_HANDLING_FAILED,
        {
          validator: validatorAddress,
          error: (error as Error).message,
          severity: AuditSeverity.ERROR,
        },
      );
    }
  }

  // Add method to reset consecutive misses when validator participates
  public resetConsecutiveMisses(validatorAddress: string): void {
    this.consecutiveMisses.delete(validatorAddress);
  }

  /**
   * Select backup validator when primary fails
   */
  public async selectBackupValidator(
    validationTask: string,
    failedValidator: string,
  ): Promise<string | null> {
    const perfMarker = this.performanceMonitor.start('select_backup_validator');

    try {
      // Get current validator set
      const currentValidators = await this.getEligibleBackupValidators();

      // Remove failed validator from consideration
      const eligibleBackups = currentValidators.filter(
        (v) =>
          v.address !== failedValidator &&
          !this.activeValidators
            .get(validationTask)
            ?.backups.includes(v.address),
      );

      // Sort by composite score (reputation, uptime, and recent performance)
      const rankedBackups = await this.rankBackupValidators(eligibleBackups);

      // Select best available backup
      const selectedBackup = rankedBackups[0]?.address;

      if (selectedBackup) {
        // Update active validators tracking
        const current = this.activeValidators.get(validationTask) || {
          primary: failedValidator,
          backups: [],
          lastRotation: Date.now(),
        };

        current.backups.push(selectedBackup);
        this.activeValidators.set(validationTask, current);

        // Log the backup selection
        await this.auditManager.log(AuditEventType.BACKUP_VALIDATOR_SELECTED, {
          task: validationTask,
          failed: failedValidator,
          selected: selectedBackup,
          attempt: current.backups.length,
          severity: AuditSeverity.INFO,
        });

        return selectedBackup;
      }

      return null;
    } catch (error: unknown) {
      Logger.error('Failed to select backup validator:', error);
      await this.auditManager.log(AuditEventType.BACKUP_SELECTION_FAILED, {
        task: validationTask,
        error: (error as Error).message,
        severity: AuditSeverity.ERROR,
      });
      return null;
    } finally {
      if (typeof perfMarker !== 'undefined') {
        this.performanceMonitor.end(perfMarker);
      }
    }
  }

  /**
   * Get list of validators eligible to serve as backups
   */
  private async getEligibleBackupValidators(): Promise<Validator[]> {
    try {
      const allValidators = await this.blockchain.db.getValidators();

      return allValidators.filter((validator) => {
        const reputation = this.reputationSystem.get(validator.address) || 0;
        const isEligible =
          reputation >=
            BLOCKCHAIN_CONSTANTS.BACKUP_VALIDATOR_CONFIG
              .MIN_BACKUP_REPUTATION &&
          validator.uptime >=
            BLOCKCHAIN_CONSTANTS.BACKUP_VALIDATOR_CONFIG.MIN_BACKUP_UPTIME &&
          !this.isValidatorOverloaded(validator.address);

        return isEligible;
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get eligible backup validators:', error);
      } else {
        Logger.error('Failed to get eligible backup validators:', error);
      }
      return [];
    }
  }

  /**
   * Rank backup validators based on multiple criteria
   */
  public async rankBackupValidators(
    validators: Validator[],
  ): Promise<Array<Validator & { score: number }>> {
    try {
      const ranked = await Promise.all(
        validators.map(async (validator) => {
          const reputation = this.reputationSystem.get(validator.address) || 0;
          const recentPerformance = await this.getRecentPerformanceScore(
            validator.address,
          );
          const loadFactor = await this.getValidatorLoadFactor(
            validator.address,
          );

          // Calculate composite score (0-100)
          const score =
            reputation * 0.4 + // 40% weight on reputation
            recentPerformance * 0.3 + // 30% weight on recent performance
            validator.uptime * 100 * 0.2 + // 20% weight on uptime
            (1 - loadFactor) * 100 * 0.1; // 10% weight on available capacity

          return { ...validator, score };
        }),
      );

      // Sort by score (highest first)
      return ranked.sort((a, b) => b.score - a.score);
    } catch (error) {
      Logger.error('Failed to rank backup validators:', error);
      return [];
    }
  }

  /**
   * Check if validator is currently overloaded
   */
  private isValidatorOverloaded(address: string): boolean {
    let activeCount = 0;

    // Count active validation tasks
    Array.from(this.activeValidators.entries()).forEach(([, info]) => {
      if (info.primary === address || info.backups.includes(address)) {
        activeCount++;
      }
    });

    // Consider overloaded if handling more than 3 tasks
    return activeCount >= 3;
  }

  /**
   * Calculate recent performance score (0-100)
   */
  private async getRecentPerformanceScore(address: string): Promise<number> {
    try {
      const recentBlocks = 100; // Look at last 100 blocks
      const performance = await this.blockchain.db.getValidatorPerformance(
        address,
        recentBlocks,
      );

      return (
        (performance.successfulValidations / performance.totalOpportunities) *
        100
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get validator performance:', error);
      } else {
        Logger.error('Failed to get validator performance:', error);
      }
      return 0;
    }
  }

  /**
   * Calculate validator's current load factor (0-1)
   */
  private async getValidatorLoadFactor(address: string): Promise<number> {
    try {
      const stats = await this.blockchain.db.getValidatorStats(address);
      return stats.currentLoad / stats.maxCapacity;
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get validator load:', error);
      } else {
        Logger.error('Failed to get validator load:', error);
      }
      return 1; // Assume fully loaded on error
    }
  }

  // Add method to handle validation failure
  public async handleValidationFailure(
    validationTask: string,
    failedValidator: string,
  ): Promise<boolean> {
    try {
      // Log and penalize the absent validator
      await this.handleValidatorAbsence(failedValidator);

      // Try to find a backup validator
      const backupValidator = await this.selectBackupValidator(
        validationTask,
        failedValidator,
      );

      if (backupValidator) {
        await this.auditManager.log(AuditEventType.VALIDATOR_BACKUP_ASSIGNED, {
          task: validationTask,
          failed: failedValidator,
          backup: backupValidator,
          severity: AuditSeverity.INFO,
        });
        return true;
      }

      // No backup found
      await this.auditManager.log(AuditEventType.VALIDATOR_BACKUP_FAILED, {
        task: validationTask,
        failed: failedValidator,
        severity: AuditSeverity.HIGH,
      });
      return false;
    } catch (error) {
      Logger.error('Failed to handle validation failure:', error);
      return false;
    }
  }

  public async getExpectedValidators(): Promise<Validator[]> {
    try {
      let validators: Validator[] = [];
      const validatorCount = await this.blockchain.db.getValidatorCount();

      const validatorPromises = Array.from({ length: validatorCount }, (_, i) =>
        this.blockchain.db.getValidator(`validator_${i}`),
      );

      validators = (await Promise.all(validatorPromises)).filter(
        (validator) => validator && validator.isActive,
      ) as Validator[];

      return validators;
    } catch (error) {
      Logger.error('Failed to get expected validators:', error);
      return [];
    }
  }

  public async hasChanged(): Promise<boolean> {
    try {
      const currentTransactions = this.getTransactions()
        .map((tx) => tx.hash)
        .join('');
      const cacheKey = 'mempool_state';
      const cachedState = this.mempoolStateCache.get(cacheKey);

      if (cachedState?.value !== currentTransactions) {
        this.mempoolStateCache.set(cacheKey, {
          value: currentTransactions,
          timestamp: Date.now(),
        });
        this.lastChangeTimestamp = Date.now();
        return true;
      }

      return false;
    } catch (error) {
      Logger.error('Error checking mempool changes:', error);
      return false;
    }
  }

  /**
   * Add an input to a pending transaction
   * @param txId Transaction ID to add input to
   * @param input Input to add
   * @returns Promise<boolean> True if input was added successfully
   */
  public async addTransactionInput(
    txId: string,
    input: {
      previousTxId: string;
      outputIndex: number;
      publicKey: string;
      amount: bigint;
    },
  ): Promise<boolean> {
    // Add mutex for the specific transaction instead of global mutex
    const txMutex = await this.getMutexForTransaction(txId);
    const release = await txMutex.acquire();

    try {
      // Get existing transaction
      const transaction = this.transactions.get(txId);
      if (!transaction) {
        Logger.warn('Transaction not found for input addition', { txId });
        return false;
      }

      // Create transaction builder
      const txBuilder = new TransactionBuilder();
      txBuilder.type = transaction.type;

      // Add new input
      await txBuilder.addInput(
        input.previousTxId,
        input.outputIndex,
        input.publicKey,
        input.amount,
      );

      // Add existing inputs
      await Promise.all(
        transaction.inputs.map(async (existingInput) => {
          await txBuilder.addInput(
            existingInput.txId,
            existingInput.outputIndex,
            existingInput.publicKey,
            existingInput.amount,
          );
        }),
      );

      // Add existing outputs
      await Promise.all(
        transaction.outputs.map(async (output) => {
          await txBuilder.addOutput(
            output.address,
            output.amount,
            output.confirmations,
          );
        }),
      );

      // Build updated transaction
      const updatedTx = await txBuilder.build();

      // Validate updated transaction
      const isValid = await this.validateTransaction(
        updatedTx,
        await this.blockchain.getUTXOSet(),
        this.blockchain.getCurrentHeight(),
      );

      if (!isValid) {
        Logger.warn('Updated transaction validation failed', { txId });
        return false;
      }

      // Update transaction in mempool
      this.transactions.set(txId, updatedTx);
      this.updateFeeBuckets(updatedTx);

      await this.auditManager.log(AuditEventType.TRANSACTION_INPUT_ADDED, {
        txId,
        inputTxId: input.previousTxId,
        amount: input.amount.toString(),
        severity: AuditSeverity.INFO,
      });

      return true;
    } catch (error) {
      Logger.error('Failed to add transaction input:', error);
      return false;
    } finally {
      release();
    }
  }

  /**
   * Add an output to a pending transaction
   * @param txId Transaction ID to add output to
   * @param output Output to add
   * @returns Promise<boolean> True if output was added successfully
   */
  public async addTransactionOutput(
    txId: string,
    output: {
      address: string;
      amount: bigint;
      confirmations: number;
    },
  ): Promise<boolean> {
    // Validate transaction ID format
    if (!txId?.match(/^[a-f0-9]{64}$/i)) {
      Logger.warn('Invalid transaction ID format');
      return false;
    }

    // Validate output parameters
    if (
      !output?.address ||
      !output?.amount ||
      output.amount <= BigInt(0) ||
      !output.confirmations
    ) {
      Logger.warn('Invalid output parameters');
      return false;
    }

    // Use the existing per-transaction mutex
    const txMutex = this.getMutexForTransaction(txId);
    const release = await txMutex.acquire();

    try {
      // Retrieve the existing transaction
      const transaction = this.transactions.get(txId);
      if (!transaction) {
        Logger.warn('Transaction not found for output addition', { txId });
        return false;
      }

      // Build the updated transaction using the TransactionBuilder
      const txBuilder = new TransactionBuilder();
      txBuilder.type = transaction.type;

      // Re-add existing inputs to builder
      await Promise.all(
        transaction.inputs.map(async (input) => {
          await txBuilder.addInput(
            input.txId,
            input.outputIndex,
            input.publicKey,
            input.amount,
          );
        }),
      );

      // Re-add existing outputs to builder
      await Promise.all(
        transaction.outputs.map(async (existingOutput) => {
          await txBuilder.addOutput(
            existingOutput.address,
            existingOutput.amount,
            existingOutput.confirmations,
          );
        }),
      );

      await txBuilder.addOutput(
        output.address,
        output.amount,
        output.confirmations,
      );

      // Build the updated transaction
      const updatedTx = await txBuilder.build();

      // Validate the updated transaction
      const isValid = await this.validateTransaction(
        updatedTx,
        await this.blockchain.getUTXOSet(),
        this.blockchain.getCurrentHeight(),
      );

      if (!isValid) {
        Logger.warn('Updated transaction validation failed', { txId });
        return false;
      }

      // Update the transaction in the mempool and await fee bucket update for proper synchronization
      this.transactions.set(txId, updatedTx);
      await this.updateFeeBuckets(updatedTx);

      // Log success in audit
      await this.auditManager.log(AuditEventType.TRANSACTION_OUTPUT_ADDED, {
        txId,
        address: output.address,
        amount: output.amount.toString(),
        severity: AuditSeverity.INFO,
      });

      return true;
    } catch (error) {
      Logger.error('Failed to add transaction output:', error);
      return false;
    } finally {
      release();
    }
  }

  // Add cache cleanup
  private cleanupCache(): void {
    const now = Date.now();
    this.mempoolStateCache.forEach((entry, key) => {
      if (now - entry.timestamp > this.maxTransactionAge) {
        this.mempoolStateCache.delete(key);
      }
    });
  }

  private initializeCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      try {
        this.removeOldTransactions();
        this.cleanupCache();
        this.updateDynamicFees();
        this.cleanupOldFeeBuckets();
      } catch (error) {
        Logger.error('Cleanup interval failed:', error);
      }
    }, BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.CLEANUP_INTERVAL).unref();
  }

  private calculateTransactionSize(transaction: Transaction): number {
    try {
      // Basic validation
      if (!transaction?.inputs?.length || !transaction?.outputs?.length) {
        throw new Error('Invalid transaction structure');
      }

      let size = 0;
      const SIZES = {
        VERSION: 4,
        LOCKTIME: 4,
        INPUT_BASE: 41, // outpoint (36) + sequence (4) + varInt (1)
        OUTPUT_BASE: 9, // value (8) + varInt (1)
        WITNESS_FLAG: 2,
        INPUT_SEQUENCE: 4,
      };

      // Base size
      size += SIZES.VERSION + SIZES.LOCKTIME;

      // Input size with validation
      size += this.getVarIntSize(transaction.inputs.length);
      transaction.inputs.forEach((input) => {
        size += SIZES.INPUT_BASE;

        // Script validation
        if (input.script) {
          const scriptSize = Buffer.from(input.script).length;
          if (scriptSize > BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SCRIPT_SIZE) {
            throw new Error(`Input script too large: ${scriptSize} bytes`);
          }
          size += scriptSize;
        }

        // Public key validation and size
        if (input.publicKey) {
          const pubKeySize = Buffer.from(input.publicKey, 'base64').length;
          if (pubKeySize > BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_PUBKEY_SIZE) {
            throw new Error(`Public key too large: ${pubKeySize} bytes`);
          }
          size += pubKeySize;
        }

        // Signature size if present
        if (input.signature) {
          const sigSize = Buffer.from(input.signature, 'base64').length;
          if (sigSize > BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIGNATURE_SIZE) {
            throw new Error(`Signature too large: ${sigSize} bytes`);
          }
          size += sigSize;
        }

        size += SIZES.INPUT_SEQUENCE;
      });

      // Output size with validation
      size += this.getVarIntSize(transaction.outputs.length);
      transaction.outputs.forEach((output) => {
        size += SIZES.OUTPUT_BASE;

        if (output.script) {
          const scriptSize = Buffer.from(output.script).length;
          if (scriptSize > BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SCRIPT_SIZE) {
            throw new Error(`Output script too large: ${scriptSize} bytes`);
          }
          size += scriptSize;
        }
      });

      // Witness data if present
      if (transaction.hasWitness && transaction.witness?.stack?.length) {
        size += SIZES.WITNESS_FLAG;
        size += this.getVarIntSize(transaction.witness.stack.length);

        transaction.witness.stack.forEach((witnessData) => {
          const witnessSize = Buffer.from(witnessData, 'hex').length;
          size += this.getVarIntSize(witnessSize) + witnessSize;
        });
      }

      return size;
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Transaction size calculation failed:', {
          txId: transaction?.id,
          error: error.message,
        });
      }
      return Number.MAX_SAFE_INTEGER; // Force validation failure
    }
  }

  private getVarIntSize(value: number): number {
    if (value < 0xfd) return 1;
    if (value <= 0xffff) return 3;
    if (value <= 0xffffffff) return 5;
    return 9;
  }

  /**
   * Retrieves a mutex for the given transaction, creating one if necessary.
   * The returned mutex is scheduled for cleanup if no new activity occurs within maxTransactionAge.
   */
  private getMutexForTransaction(txId: string): Mutex {
    let record = this.transactionMutexes.get(txId);
    if (!record) {
      // Create a new mutex record with the current timestamp.
      record = {
        mutex: new Mutex(),
        createdAt: Date.now(),
      };
      this.transactionMutexes.set(txId, record);

      // Schedule a cleanup check after maxTransactionAge milliseconds.
      setTimeout(() => {
        // If the mutex record is older than maxTransactionAge and the transaction no longer exists in the mempool, remove it.
        if (Date.now() - record!.createdAt > this.maxTransactionAge) {
          if (!this.transactions.has(txId)) {
            this.transactionMutexes.delete(txId);
            Logger.debug(`Mutex for transaction ${txId} cleaned up after inactivity.`);
          }
        }
      }, this.maxTransactionAge);
    }
    return record.mutex;
  }

  private findFeeBucket(transaction: Transaction): Set<string> | undefined {
    try {
      // Get fee rate with precision handling
      const feeRate =
        Math.round(this.calculateFeePerByte(transaction) * 100000) / 100000;

      // Find closest bucket within tolerance
      const RATE_TOLERANCE = 0.00001;
      const matchingBucket = Array.from(this.feeRateBuckets.entries()).find(
        ([rate]) => Math.abs(rate - feeRate) < RATE_TOLERANCE,
      );

      if (matchingBucket) {
        Logger.debug('Found fee bucket', {
          txId: transaction.hash,
          feeRate,
          bucketRate: matchingBucket[0],
        });
        return matchingBucket[1];
      }

      // Create new bucket if none found
      if (!this.feeRateBuckets.has(feeRate)) {
        Logger.debug('Creating new fee bucket', {
          txId: transaction.hash,
          feeRate,
        });
        this.feeRateBuckets.set(feeRate, new Set());
        return this.feeRateBuckets.get(feeRate);
      }

      return undefined;
    } catch (error) {
      Logger.error('Error finding fee bucket:', error);
      return undefined;
    }
  }

  private getOrCreateFeeBucket(feeRate: number): Set<string> {
    try {
      const normalizedRate = Math.round(feeRate * 100000) / 100000;
      let bucket = this.feeRateBuckets.get(normalizedRate);

      if (!bucket) {
        bucket = new Set<string>();
        this.feeRateBuckets.set(normalizedRate, bucket);
      }

      return bucket;
    } catch (error) {
      Logger.error('Error managing fee bucket:', error);
      return new Set<string>();
    }
  }

  private cleanupOldFeeBuckets(): void {
    try {
      const BUCKET_CONSOLIDATION_THRESHOLD = 1000; // Max number of buckets
      const MIN_BUCKET_SIZE = 5; // Minimum transactions per bucket

      // Remove empty buckets
      Array.from(this.feeRateBuckets.entries()).forEach(([rate, bucket]) => {
        if (bucket.size === 0) {
          this.feeRateBuckets.delete(rate);
        }
      });

      // Consolidate buckets if there are too many
      if (this.feeRateBuckets.size > BUCKET_CONSOLIDATION_THRESHOLD) {
        const sortedRates = Array.from(this.feeRateBuckets.keys()).sort(
          (a, b) => a - b,
        );

        sortedRates.slice(0, -1).forEach((currentRate, i) => {
          const nextRate = sortedRates[i + 1];
          const currentBucket = this.feeRateBuckets.get(currentRate)!;

          if (currentBucket.size < MIN_BUCKET_SIZE) {
            const nextBucket = this.feeRateBuckets.get(nextRate)!;
            // Merge into next bucket
            currentBucket.forEach((txId) => nextBucket.add(txId));
            this.feeRateBuckets.delete(currentRate);
          }
        });
      }

      Logger.debug('Fee buckets cleaned up', {
        bucketCount: this.feeRateBuckets.size,
        totalTransactions: Array.from(this.feeRateBuckets.values()).reduce(
          (sum, bucket) => sum + bucket.size,
          0,
        ),
      });
    } catch (error) {
      Logger.error('Fee bucket cleanup failed:', error);
    }
  }

  private async updateDynamicFees(): Promise<void> {
    try {
      const newFee = await this.calculateDynamicMinFee();
      this.lastValidFee = newFee;

      Logger.debug('Updated dynamic fees', {
        newFee,
        timestamp: Date.now(),
      });
    } catch (error) {
      Logger.error('Failed to update dynamic fees:', error);
    }
  }

  private async getVotingContribution(address: string): Promise<number> {
    try {
      const utxoSet = await this.blockchain.getUTXOSet();
      const votingUtxos = await utxoSet.findUtxosForVoting(address);
      return Number(utxoSet.calculateVotingPower(votingUtxos));
    } catch (error) {
      Logger.error('Error getting voting contribution:', error);
      return 0;
    }
  }

  private async validateTransactionInputs(tx: Transaction): Promise<boolean> {
    try {
      // Validate inputs without re-acquiring the transaction mutex
      const spentUTXOs = new Set<string>();
      const validationPromises = tx.inputs.map(async (input) => {
        const utxoKey = `${input.txId}:${input.outputIndex}`;
        if (spentUTXOs.has(utxoKey)) {
          throw new Error(`Double-spend detected within transaction: ${utxoKey}`);
        }

        const [utxo, isSpentInMempool] = await Promise.all([
          this.blockchain.getUTXO(input.txId, input.outputIndex),
          this.isUTXOSpentInMempool(input.txId, input.outputIndex),
        ]);

        if (!utxo || utxo.spent || isSpentInMempool) {
          throw new Error(`Invalid or spent UTXO: ${utxoKey}`);
        }

        spentUTXOs.add(utxoKey);
        return true;
      });

      await Promise.all(validationPromises);
      return true;
    } catch (error) {
      Logger.error('Transaction input validation failed', {
        txId: tx.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  private async isUTXOSpentInMempool(
    txId: string,
    outputIndex: number,
  ): Promise<boolean> {
    return Array.from(this.transactions.values()).some((tx) =>
      tx.inputs.some(
        (input) => input.txId === txId && input.outputIndex === outputIndex,
      ),
    );
  }

  private async validateTransactionSize(
    transaction: Transaction,
  ): Promise<boolean> {
    const size = this.calculateTransactionSize(transaction);

    if (size > (await this.getMaxSize())) {
      Logger.warn('Transaction exceeds maximum size', {
        txId: transaction.hash, // use hash consistently
        size,
        maxSize: await this.getMaxSize(),
      });
      return false;
    }

    const minFeeRate = await this.getMinFeeRate();
    // Convert to BigInt before multiplication
    const minFee = BigInt(Math.floor(size * minFeeRate));

    if (transaction.fee < minFee) {
      Logger.warn('Transaction fee too low for size', {
        txId: transaction.hash, // use hash consistently
        fee: transaction.fee.toString(),
        minFee: minFee.toString(),
      });
      return false;
    }

    return true;
  }

  private updateMetrics(tx: Transaction) {
    this.size = this.transactions.size;
    // Use the local helper for consistent size calculation
    this.bytes += this.calculateTransactionSize(tx);
    this.usage = this.calculateUsage();
  }

  private calculateUsage(): number {
    return Array.from(this.transactions.values()).reduce(
      (sum, tx) => sum + tx.getSize(),
      0,
    );
  }

  /**
   * Get detailed information about the current state of the mempool
   * @returns {Promise<MempoolInfo>} Detailed mempool statistics and status
   */
  public async getMempoolInfo(): Promise<MempoolInfo> {
    try {
      // Calculate size metrics
      const bytes = Array.from(this.transactions.values()).reduce(
        (sum, tx) => sum + this.calculateTransactionSize(tx),
        0,
      );

      // Get fee metrics
      const feeMetrics = this.calculateFeeMetrics();

      // Calculate load metrics
      const maxMemory =
        BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MAX_MEMORY_USAGE;
      const memoryUsage = process.memoryUsage().heapUsed;
      const loadFactor = this.transactions.size / this.maxSize;

      // Get transaction type distribution
      const typeDistribution = this.getTransactionTypeDistribution();

      return {
        size: this.transactions.size,
        bytes,
        usage: this.usage,
        maxSize: this.maxSize,
        maxMemoryUsage: maxMemory,
        currentMemoryUsage: memoryUsage,
        loadFactor,

        fees: {
          base: await this.getMinFeeRate(),
          current: this.lastValidFee,
          mean: feeMetrics.mean,
          median: feeMetrics.median,
          min: feeMetrics.min,
          max: feeMetrics.max,
        },

        transactions: {
          total: this.transactions.size,
          pending: this.getPendingCount(),
          distribution: typeDistribution,
        },

        age: {
          oldest: this.getOldestTransactionAge(),
          youngest: this.getYoungestTransactionAge(),
        },

        health: {
          status: this.getHealthStatus(),
          lastUpdate: this.lastChangeTimestamp,
          isAcceptingTransactions: this.canAcceptTransactions(),
        },
      };
    } catch (error) {
      Logger.error('Failed to get mempool info:', error);
      throw new Error('Failed to retrieve mempool information');
    }
  }

  private calculateFeeMetrics(): FeeMetrics {
    const fees = Array.from(this.transactions.values()).map((tx) =>
      this.calculateFeePerByte(tx),
    );

    if (fees.length === 0) {
      return {
        mean: 0,
        median: 0,
        min: 0,
        max: 0,
      };
    }

    fees.sort((a, b) => a - b);

    return {
      mean: fees.reduce((sum, fee) => sum + fee, 0) / fees.length,
      median: fees[Math.floor(fees.length / 2)],
      min: fees[0],
      max: fees[fees.length - 1],
    };
  }

  private getTransactionTypeDistribution(): Record<TransactionType, number> {
    const distribution: Record<TransactionType, number> = {
      [TransactionType.STANDARD]: 0,
      [TransactionType.TRANSFER]: 0,
      [TransactionType.COINBASE]: 0,
      [TransactionType.QUADRATIC_VOTE]: 0,
      [TransactionType.POW_REWARD]: 0,
      [TransactionType.REGULAR]: 0,
    };

    Array.from(this.transactions.values()).forEach((tx) => {
      distribution[tx.type] = (distribution[tx.type] || 0) + 1;
    });

    return distribution;
  }

  private getPendingCount(): number {
    return Array.from(this.transactions.values()).filter(
      (tx) => !tx.blockHeight,
    ).length;
  }

  private getOldestTransactionAge(): number {
    const timestamps = Array.from(this.transactions.values()).map(
      (tx) => tx.timestamp,
    );
    return timestamps.length ? Math.min(...timestamps) : 0;
  }

  private getYoungestTransactionAge(): number {
    const timestamps = Array.from(this.transactions.values()).map(
      (tx) => tx.timestamp,
    );
    return timestamps.length ? Math.max(...timestamps) : 0;
  }

  private getHealthStatus(): 'healthy' | 'degraded' | 'critical' {
    const loadFactor = this.transactions.size / this.maxSize;
    const memoryUsage = process.memoryUsage().heapUsed;
    const maxMemory = BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MAX_MEMORY_USAGE;

    if (loadFactor > 0.9 || memoryUsage > maxMemory * 0.9) {
      return 'critical';
    } else if (loadFactor > 0.7 || memoryUsage > maxMemory * 0.7) {
      return 'degraded';
    }
    return 'healthy';
  }

  private canAcceptTransactions(): boolean {
    const health = this.getHealthStatus();
    const memoryOK =
      process.memoryUsage().heapUsed <
      BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MAX_MEMORY_USAGE;
    const sizeOK = this.transactions.size < this.maxSize;

    return health !== 'critical' && memoryOK && sizeOK;
  }

  /**
   * Get detailed information about all transactions in the mempool
   * @param {boolean} verbose - If true, returns detailed information for each transaction
   * @returns {Promise<Record<string, RawMempoolEntry> | string[]>} Mempool transactions
   */
  public async getRawMempool(
    verbose: boolean = false,
  ): Promise<Record<string, RawMempoolEntry> | string[]> {
    try {
      if (!verbose) {
        return Array.from(this.transactions.keys());
      }

      const result: Record<string, RawMempoolEntry> = {};

      Array.from(this.transactions.entries()).forEach(([txid, tx]) => {
        const ancestors = this.getAncestors(tx);
        const descendants = this.getDescendants(tx);

        result[txid] = {
          txid,
          fee: Number(tx.fee),
          vsize: this.calculateTransactionSize(tx),
          weight: this.calculateTransactionWeight(tx),
          time: Math.floor(tx.timestamp / 1000),
          height: this.blockchain.getCurrentHeight(),
          descendantcount: descendants.size,
          descendantsize: this.calculateDescendantSize(descendants),
          ancestorcount: ancestors.size,
          ancestorsize: this.calculateAncestorSize(ancestors),
          depends: Array.from(tx.inputs.map((input) => input.txId)),
        };
      });

      return result;
    } catch (error) {
      Logger.error('Failed to get raw mempool:', error);
      throw new Error('Failed to retrieve mempool transactions');
    }
  }

  /**
   * Calculate total weight of a transaction
   */
  private calculateTransactionWeight(tx: Transaction): number {
    // Weight = (base size * 3) + total size
    const baseSize = this.calculateTransactionSize(tx);
    const totalSize = baseSize; // Simplified for non-segwit
    return baseSize * 3 + totalSize;
  }

  /**
   * Calculate total size of descendant transactions
   */
  private calculateDescendantSize(descendants: Set<string>): number {
    return Array.from(descendants).reduce((sum, txid) => {
      const tx = this.transactions.get(txid);
      return sum + (tx ? this.calculateTransactionSize(tx) : 0);
    }, 0);
  }

  /**
   * Calculate total size of ancestor transactions
   */
  private calculateAncestorSize(ancestors: Set<string>): number {
    return Array.from(ancestors).reduce((sum, txid) => {
      const tx = this.transactions.get(txid);
      return sum + (tx ? this.calculateTransactionSize(tx) : 0);
    }, 0);
  }

  /**
   * Get detailed information about a specific transaction in the mempool
   * @param {string} txid - Transaction ID to lookup
   * @returns {Promise<RawMempoolEntry>} Detailed transaction information
   * @throws {Error} If transaction is not found in mempool
   */
  public async getMempoolEntry(txid: string): Promise<RawMempoolEntry> {
    try {
      // Input validation
      if (!txid || typeof txid !== 'string') {
        throw new Error('Invalid transaction ID');
      }

      // Get transaction from mempool
      const tx = this.transactions.get(txid);
      if (!tx) {
        throw new Error(`Transaction ${txid} not found in mempool`);
      }

      // Get ancestry information
      const ancestors = this.getAncestors(tx);
      const descendants = this.getDescendants(tx);

      // Calculate metrics
      const entry: RawMempoolEntry = {
        txid,
        fee: Number(tx.fee),
        vsize: this.calculateTransactionSize(tx),
        weight: this.calculateTransactionWeight(tx),
        time: Math.floor(tx.timestamp / 1000),
        height: this.blockchain.getCurrentHeight(),
        descendantcount: descendants.size,
        descendantsize: this.calculateDescendantSize(descendants),
        ancestorcount: ancestors.size,
        ancestorsize: this.calculateAncestorSize(ancestors),
        depends: Array.from(tx.inputs.map((input) => input.txId)),
      };

      Logger.debug('Retrieved mempool entry', { txid, size: entry.vsize });
      return entry;
    } catch (error) {
      Logger.error('Failed to get mempool entry:', error);
      throw error;
    }
  }

  private isValidInputScript(script: string): boolean {
    try {
      if (!script || typeof script !== 'string') return false;

      // Check for our supported script formats
      if (script.startsWith('0 ')) {
        // Native SegWit equivalent (TAG1)
        return /^0 [a-f0-9]{40}$/i.test(script);
      } else if (script.startsWith('OP_HASH160')) {
        // P2SH equivalent (TAG3)
        return /^OP_HASH160 [a-f0-9]{40} OP_EQUAL$/i.test(script);
      } else if (script.startsWith('OP_DUP')) {
        // Legacy P2PKH (TAG)
        return /^OP_DUP OP_HASH160 [a-f0-9]{40} OP_EQUALVERIFY OP_CHECKSIG$/i.test(
          script,
        );
      }

      Logger.warn('Unsupported script format');
      return false;
    } catch (error) {
      Logger.error('Input script validation failed:', error);
      return false;
    }
  }

  private isValidScriptType(script: string): boolean {
    try {
      if (!script || typeof script !== 'string') return false;

      // Check script version and format
      const [version, scriptContent] = script.split(':');
      if (version !== '01') return false;

      return this.isValidInputScript(scriptContent);
    } catch (error) {
      Logger.error('Script type validation failed:', error);
      return false;
    }
  }

  public async getCongestionFactor(): Promise<number> {
    try {
      const currentSize = this.transactions.size;
      // Use the constant MAX_SIZE directly to avoid circular dependency
      const maxSize = BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MAX_SIZE;
      return Math.min(currentSize / maxSize, 1);
    } catch (error) {
      Logger.error('Failed to get congestion factor:', error);
      return 0.5; // Return moderate congestion on error
    }
  }

  public async getMinFeeRate(): Promise<number> {
    try {
      return this.calculateDynamicMinFee();
    } catch (error) {
      Logger.error('Failed to get min fee rate:', error);
      return Number(BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_FEE_RATE);
    }
  }

  public async getMaxSize(): Promise<number> {
    try {
      const baseMaxSize = BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MAX_SIZE;
      // Calculate congestion directly here instead of calling getCongestionFactor
      const currentSize = this.transactions.size;
      const congestionFactor = Math.min(currentSize / baseMaxSize, 1);

      // More gradual size reduction based on congestion
      const dynamicSize = Math.floor(
        baseMaxSize * (1 - congestionFactor * 0.3),
      );

      // Never go below minimum viable transaction size
      const minViableSize = BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_SIZE;
      return Math.max(dynamicSize, minViableSize);
    } catch (error) {
      Logger.error('Failed to get max size:', error);
      // Fallback to conservative size limit
      return BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MAX_SIZE;
    }
  }

  public async getMaxFeeRate(): Promise<number> {
    try {
      const minFee = await this.getMinFeeRate();
      // Cap maximum fee at 20x the minimum fee
      return minFee * 20;
    } catch (error) {
      Logger.error('Failed to get max fee rate:', error);
      return Number(BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_FEE_RATE) * 20;
    }
  }

  public async getBaseFeeRate(): Promise<number> {
    try {
      // Get base fee rate from network conditions
      const congestionFactor = await this.getCongestionFactor();
      const baseFee = Number(
        BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_FEE_RATE,
      );
      return Math.floor(baseFee * (1 + congestionFactor));
    } catch (error) {
      Logger.error('Failed to get base fee rate:', error);
      return Number(BLOCKCHAIN_CONSTANTS.TRANSACTION.MEMPOOL.MIN_FEE_RATE);
    }
  }

  // Add a method to set consensus after initialization
  public setConsensus(consensus: HybridDirectConsensus): void {
    this.consensus = consensus;
  }

  // Then, in updateAncestryMaps (or immediately in addToMempool), update the index:
  private updateInputIndex(tx: Transaction): void {
    for (const input of tx.inputs) {
      const key = `${input.txId}-${input.outputIndex}`;
      this.inputIndex.set(key, tx.hash);
    }
  }
}
