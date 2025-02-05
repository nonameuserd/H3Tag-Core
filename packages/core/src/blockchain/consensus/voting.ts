import { EventEmitter } from 'events';
import { Logger } from '@h3tag-blockchain/shared';
import { VotingError } from '../utils/voting-error';
import { Mutex } from 'async-mutex';
import { DirectVotingUtil } from './voting/util';
import { VotingPeriod } from '../../models/vote.model';
import { MerkleTree } from '../../utils/merkle';
import { PerformanceMonitor } from '../../monitoring/performance-monitor';
import { BlockchainSchema } from '../../database/blockchain-schema';
import { BackupManager } from '../../database/backup-manager';
import { Mempool } from '../mempool';
import { BlockchainSync } from '../../network/sync';
import { DDoSProtection } from '../../security/ddos';
import { Vote } from '../../models/vote.model';
import { IVotingSchema } from '../../database/voting-schema';
import { AuditManager } from '../../security/audit';
import { Node } from '../../network/node';
import { BLOCKCHAIN_CONSTANTS } from '../utils/constants';
import { SyncState } from '../../network/sync';
import { AuditEventType } from '../../security/audit';
import { AuditSeverity } from '../../security/audit';
import { Block } from '../../models/block.model';
import { retry } from '../../utils/retry';
import { Validator } from '../../models/validator';
import { Cache } from '../../scaling/cache';
import { CircuitBreaker } from '../../network/circuit-breaker';

/**
 * @fileoverview DirectVoting implements a quadratic voting-based consensus mechanism for blockchain governance
 * and chain selection. It manages voting periods, vote submission, chain fork resolution, and validator participation.
 *
 * @module DirectVoting
 */

/**
 * DirectVoting class implements the direct voting consensus mechanism for blockchain governance
 * and chain selection using quadratic voting power calculations.
 *
 * @class DirectVoting
 *
 * @property {EventEmitter} eventEmitter - Emits voting-related events
 * @property {VotingPeriod | null} currentPeriod - Current active voting period
 * @property {number} nextVotingHeight - Block height when next voting period begins
 * @property {PerformanceMonitor} performanceMonitor - Monitors performance metrics
 * @property {Cache<Vote[]>} cache - Caches vote data
 * @property {MerkleTree} merkleTree - Handles vote merkle tree operations
 * @property {BackupManager} backupManager - Manages voting state backups
 * @property {Mempool} mempool - Manages transaction/vote mempool
 * @property {DDoSProtection} ddosProtection - Provides DDoS protection
 * @property {BlockchainSync} sync - Handles blockchain synchronization
 *
 * @example
 * const voting = new DirectVoting(
 *   blockchainDb,
 *   votingDb,
 *   auditManager,
 *   votingUtil,
 *   node,
 *   sync
 * );
 *
 * await voting.initialize();
 * await voting.submitVote(vote);
 */

/**
 * Creates a new instance of DirectVoting
 *
 * @constructor
 * @param {BlockchainSchema} db - Blockchain database instance
 * @param {IVotingSchema} votingDb - Voting database instance
 * @param {AuditManager} auditManager - Audit logging manager
 * @param {DirectVotingUtil} votingUtil - Voting utility functions
 * @param {Node} node - Network node instance
 * @param {BlockchainSync} sync - Blockchain sync instance
 */

/**
 * Initializes the voting system
 *
 * @async
 * @method initialize
 * @returns {Promise<void>}
 * @throws {VotingError} If initialization fails
 */

/**
 * Submits a vote to the current voting period
 *
 * @async
 * @method submitVote
 * @param {Vote} vote - Vote to be submitted
 * @returns {Promise<boolean>} True if vote was submitted successfully
 * @throws {VotingError} If vote submission fails validation
 *
 * @example
 * const vote = {
 *   voteId: "123",
 *   voter: "0x...",
 *   chainVoteData: {
 *     amount: "1000"
 *   }
 * };
 * const success = await voting.submitVote(vote);
 */

/**
 * Handles chain fork resolution through voting
 *
 * @async
 * @method handleChainFork
 * @param {string} oldChainId - Current chain ID
 * @param {string} newChainId - Proposed new chain ID
 * @param {number} forkHeight - Height at which fork occurred
 * @param {Validator[]} validators - List of validators
 * @returns {Promise<string>} Selected chain ID
 * @throws {Error} If chain IDs are invalid or validators array is empty
 *
 * @example
 * const selectedChain = await voting.handleChainFork(
 *   "chain_1",
 *   "chain_2",
 *   1000,
 *   validators
 * );
 */

/**
 * Gets current voting schedule information
 *
 * @async
 * @method getVotingSchedule
 * @returns {Promise<{
 *   currentPeriod: VotingPeriod | null,
 *   nextVotingHeight: number,
 *   blocksUntilNextVoting: number
 * }>}
 */

/**
 * Validates votes in a block
 *
 * @async
 * @method validateVotes
 * @param {Block} block - Block containing votes to validate
 * @returns {Promise<boolean>} True if all votes are valid
 */

/**
 * Checks if an address has participated in current voting period
 *
 * @async
 * @method hasParticipated
 * @param {string} address - Address to check
 * @returns {Promise<boolean>} True if address has participated
 * @throws {VotingError} If address format is invalid
 */

/**
 * Gets votes by address
 *
 * @async
 * @method getVotesByAddress
 * @param {string} address - Address to get votes for
 * @returns {Promise<Vote[]>} Array of votes for the address
 * @throws {VotingError} If address format is invalid or retrieval fails
 */

/**
 * Gets votes for multiple addresses
 *
 * @async
 * @method getVotesByAddresses
 * @param {string[]} addresses - Addresses to get votes for
 * @returns {Promise<Record<string, Vote[]>>} Map of addresses to their votes
 * @throws {Error} If addresses format is invalid
 */

/**
 * Cleans up resources and stops voting system
 *
 * @async
 * @method dispose
 * @returns {Promise<void>}
 */

/**
 * Performs health check of voting system
 *
 * @async
 * @method healthCheck
 * @returns {Promise<boolean>} True if system is healthy
 */

/**
 * Gets current voting metrics
 *
 * @method getVotingMetrics
 * @returns {{
 *   currentPeriod: VotingPeriod | null,
 *   totalVotes: number,
 *   activeVoters: Promise<string[]>,
 *   participationRate: Promise<number>
 * }}
 */

/**
 * @typedef {Object} VotingPeriod
 * @property {number} periodId
 * @property {number} startBlock
 * @property {number} endBlock
 * @property {number} startTime
 * @property {number} endTime
 * @property {'active' | 'completed'} status
 * @property {Map<string, Vote>} votes
 * @property {boolean} isAudited
 * @property {string} votesMerkleRoot
 * @property {string} [type]        // Optional type identifier
 * @property {number} [createdAt]
 * @property {number} [startHeight]
 * @property {number} [endHeight]
 */

/**
 * @typedef {Object} Vote
 * @property {string} voteId - Unique vote identifier
 * @property {string} voter - Address of voter
 * @property {Object} chainVoteData - Chain-specific vote data
 * @property {string} chainVoteData.amount - Voting power amount
 * @property {number} timestamp - Vote submission timestamp
 */
export class DirectVoting {
  private readonly eventEmitter = new EventEmitter();
  private currentPeriod: VotingPeriod | null = null;
  private nextVotingHeight: number = 0;
  private readonly performanceMonitor: PerformanceMonitor;
  private isShuttingDown = false;
  private cache: Cache<Vote[]> | null = null;
  private readonly merkleTree: MerkleTree;
  private backupManager: BackupManager | null = null;
  private networkFailureCount = 0;
  private readonly MAX_FAILURES = 3;
  private readonly RESET_INTERVAL = 300000; // 5 minutes
  private votingScheduleTimer?: NodeJS.Timeout;
  private cacheCleanupTimer?: NodeJS.Timeout;
  private networkResetTimer?: NodeJS.Timeout;
  private ddosProtection: DDoSProtection | null = null;
  private readonly sync: BlockchainSync;
  private startVotingHeight: number = 0;
  private endVotingHeight: number = 0;
  private rateCache: Cache<number> | null = null;
  private voteMutex = new Mutex();
  private periodMutex = new Mutex();
  private validators: Validator[] = [];
  private circuitBreaker: CircuitBreaker | null = null;
  private readonly VOTE_BATCH_SIZE = 100; // Batch size for vote processing
  private readonly VOTE_CACHE_SIZE = 10000; // Cache size for vote data
  private readonly VALIDATOR_CACHE_TTL = 300000; // 5 minutes
  private readonly VOTE_PROCESSING_CONCURRENCY = 10; // Max concurrent vote processing
  private readonly MERKLE_TREE_CACHE_SIZE = 1000; // Cache size for merkle tree calculations
  private initializationPromise: Promise<void>;
  private participationCache: Cache<boolean> | null = new Cache<boolean>({
    maxSize: 1000, // adjust as needed
    ttl: 300000, // 5 minutes, adjust as needed
  });
  private periodCheckInterval?: NodeJS.Timeout;

  /**
   * Creates a new instance of DirectVoting
   * @param config Configuration options for direct voting
   * @param node Network node instance
   * @param db Database instance
   * @param votingDb Voting database instance
   * @param eventEmitter Event emitter for voting events
   */
  constructor(
    private readonly db: BlockchainSchema,
    private readonly votingDb: IVotingSchema,
    private readonly auditManager: AuditManager,
    private readonly votingUtil: DirectVotingUtil,
    private readonly node: Node,
    sync: BlockchainSync,
    private readonly mempool: Mempool,
  ) {
    this.sync = sync;
    this.merkleTree = new MerkleTree();
    this.performanceMonitor = new PerformanceMonitor('direct_voting');
    this.initializationPromise = this.initializeVotingSchedule().catch(
      (error) => {
        Logger.error('Failed to initialize voting schedule:', error);
        throw error;
      },
    );

    // periodic cache cleanup
    this.cacheCleanupTimer = setInterval(() => this.cleanupCache(), 3600000); // Clean every hour
    // this.backupManager = new BackupManager(databaseConfig.path);

    // error handler for event emitter
    this.eventEmitter.on('error', (error) => {
      Logger.error('EventEmitter error:', error);
      this.logAudit('event_emitter_error', { error: error.message });
    });

    // periodic reset of network failure count
    this.networkResetTimer = setInterval(() => {
      if (this.networkFailureCount > 0) {
        this.networkFailureCount = 0;
        Logger.debug('Network failure count reset');
      }
    }, this.RESET_INTERVAL);

    // Initialize DDoS protection
    this.ddosProtection = new DDoSProtection(
      {
        maxRequests: {
          default: 100,
          quadraticVote: 100,
          pow: 100,
        },
        windowMs: 60000, // 1 minute
        blockDuration: 300000, // 5 minutes,
        banThreshold: 5,
      },
      this.auditManager,
    );

    this.setupIntervals();

    // Initialize validators in constructor
    this.validators = [];
    this.loadValidators().catch((error) =>
      Logger.error('Failed to load validators:', error),
    );

    this.rateCache = new Cache<number>({
      maxSize: this.VOTE_CACHE_SIZE,
      ttl: this.VALIDATOR_CACHE_TTL,
    });

    // Instantiate the cache instance with proper parameters
    this.cache = new Cache<Vote[]>({
      maxSize: this.VOTE_CACHE_SIZE,
      ttl: BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL, // adjust as needed
    });
  }

  public async initialize(): Promise<void> {
    await this.initializationPromise;
    await this.mempool?.initialize();
    await this.ddosProtection?.initialize();
    await this.transitionPeriod();
    Logger.info('DirectVoting initialized');
  }

  /**
   * Initializes the voting schedule
   * @returns Promise<void>
   */
  private async initializeVotingSchedule(): Promise<void> {
    const perfMarker = this.performanceMonitor.start('init_schedule');
    try {
      // Try to recover from backup first
      try {
        await this.recoverFromBackup();
      } catch (error) {
        Logger.warn(
          'Failed to recover from backup, continuing with fresh initialization:',
          error,
        );
      }

      const currentHeight = await this.db.getCurrentHeight();
      this.nextVotingHeight =
        Math.ceil(
          currentHeight /
            BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_BLOCKS,
        ) * BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_BLOCKS;

      Logger.info(
        `Next voting period starts at block ${this.nextVotingHeight}`,
      );

      await this.scheduleNextVotingPeriod();
      await this.logAudit('voting_schedule_initialized', {
        nextVotingHeight: this.nextVotingHeight,
        currentHeight,
      });
    } catch (error) {
      Logger.error('Failed to initialize voting schedule:', error);
      throw new VotingError(
        'INIT_FAILED',
        'Failed to initialize voting schedule',
      );
    } finally {
      this.performanceMonitor.end(perfMarker);
    }
  }

  /**
   * Recovers voting state from backup
   * @returns Promise<void>
   */
  private async recoverFromBackup(): Promise<void> {
    const latestBackup = await this.backupManager?.getLatestBackup();
    if (latestBackup) {
      await this.backupManager?.restoreBackup(latestBackup);
      Logger.info('Successfully recovered voting state from backup');
      await this.logAudit('voting_state_recovered', {
        backupPath: latestBackup,
      });
    }
  }

  /**
   * Schedules the next voting period
   * @returns Promise<void>
   */
  private async scheduleNextVotingPeriod(): Promise<void> {
    // Clear existing timer if any
    if (this.votingScheduleTimer) {
      clearTimeout(this.votingScheduleTimer);
    }

    try {
      const avgBlockTime = await this.calculateAverageBlockTime();
      const currentHeight = await this.db.getCurrentHeight();
      const blocksUntilVoting = this.nextVotingHeight - currentHeight;

      if (blocksUntilVoting <= 0) {
        Logger.info(
          'Blocks until voting period are <= 0, starting voting period immediately',
        );
        await this.startVotingPeriod();
        return;
      }

      const msUntilVoting = blocksUntilVoting * avgBlockTime;
      const MAX_TIMEOUT = 2147483647; // Max safe setTimeout value

      if (msUntilVoting > MAX_TIMEOUT) {
        Logger.info('msUntilVoting exceeds MAX_TIMEOUT, deferring scheduling');
        setTimeout(() => this.scheduleNextVotingPeriod(), MAX_TIMEOUT);
      } else {
        this.votingScheduleTimer = setTimeout(async () => {
          if (!this.isShuttingDown) {
            await this.startVotingPeriod();
          }
        }, msUntilVoting);
      }
    } catch (error) {
      Logger.error('Failed to schedule next voting period:', error);
      // Retry after a delay
      setTimeout(() => this.scheduleNextVotingPeriod(), 60000);
    }
  }

  /**
   * Starts a new voting period
   * @throws {VotingError} If starting period fails
   */
  public async startVotingPeriod(): Promise<void> {
    const perfMarker = this.performanceMonitor.start('start_period');
    try {
      if (!(await this.isNetworkStable())) {
        throw new VotingError(
          'NETWORK_UNSTABLE',
          'Network conditions not suitable for voting',
        );
      }

      this.currentPeriod = {
        periodId: Date.now(),
        startBlock: this.nextVotingHeight,
        endBlock:
          this.nextVotingHeight +
          BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_BLOCKS,
        startTime: Date.now(),
        endTime:
          Date.now() + BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_MS,
        status: 'active',
        type: 'node_selection',
        votes: {},
        isAudited: false,
        createdAt: Date.now(),
        votesMerkleRoot: '',
        startHeight: this.startVotingHeight,
        endHeight: this.endVotingHeight,
      };

      this.nextVotingHeight +=
        BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_BLOCKS;
      await this.scheduleNextVotingPeriod();

      if (!this.currentPeriod) {
        throw new VotingError(
          'INVALID_PERIOD',
          'Failed to start voting period',
        );
      }

      await this.logAudit('voting_period_started', {
        periodId: this.currentPeriod.periodId,
        startBlock: this.currentPeriod.startBlock,
        endBlock: this.currentPeriod.endBlock,
      });

      this.eventEmitter.emit('votingPeriodStarted', this.currentPeriod);
    } catch (error) {
      Logger.error('Failed to start voting period:', error);
      throw new VotingError(
        'START_PERIOD_FAILED',
        'Failed to start voting period',
      );
    } finally {
      this.performanceMonitor.end(perfMarker);
    }
  }

  /**
   * Submits a vote to the current voting period
   * @param vote Vote to be submitted
   * @returns Promise<boolean> True if vote was submitted successfully
   */
  public async submitVote(vote: Vote): Promise<boolean> {
    const perfMarker = this.performanceMonitor.start('submit_vote');
    return await this.voteMutex.runExclusive(async () => {
      try {
        if (!this.currentPeriod || this.currentPeriod.status !== 'active') {
          throw new VotingError('INACTIVE_PERIOD', 'No active voting period');
        }
        const isValid = await this.validateVoteBatch([vote]);
        if (!isValid) return false;
        return await this.votingDb.transaction(async (tx) => {
          await this.processVote(vote, tx);
          return true;
        });
      } finally {
        this.performanceMonitor.end(perfMarker);
      }
    });
  }

  // Add batch validation
  private async validateVoteBatch(votes: Vote[]): Promise<boolean> {
    try {
      const validationPromises = votes.map((vote) =>
        this.validateVoteSubmission(vote)
          .then(() => true)
          .catch(() => false),
      );
      const results = await Promise.all(validationPromises);
      return results.every((result) => result === true);
    } catch (error) {
      Logger.error('Batch validation failed:', error);
      return false;
    }
  }

  /**
   * Validates a vote submission
   * @param vote Vote to validate
   * @throws {VotingError} If validation fails
   */
  private async validateVoteSubmission(vote: Vote): Promise<void> {
    // Add period snapshot at start to prevent race conditions
    const period = this.currentPeriod;
    if (!period || period.status !== 'active') {
      throw new VotingError('INACTIVE_PERIOD', 'No active voting period');
    }

    // Use the snapshotted period
    const currentHeight = await this.db.getCurrentHeight();
    if (currentHeight < period.startBlock || currentHeight > period.endBlock) {
      throw new VotingError(
        'OUTSIDE_WINDOW',
        'Outside of voting period window',
      );
    }

    if (!vote.chainVoteData) {
      throw new VotingError(
        'INVALID_VOTE_TYPE',
        'Only chain selection votes are supported',
      );
    }

    if (
      Buffer.from(JSON.stringify(vote)).length >
      BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTE_SIZE_BYTES
    ) {
      throw new VotingError(
        'VOTE_TOO_LARGE',
        'Vote exceeds maximum size limit',
      );
    }
  }

  /**
   * Handles chain fork resolution through voting
   * @param oldChainId Current chain ID
   * @param newChainId Proposed new chain ID
   * @param forkHeight Height at which fork occurred
   * @returns Promise<string> Selected chain ID
   */
  public async handleChainFork(
    oldChainId: string,
    newChainId: string,
    forkHeight: number,
    validators: Validator[],
  ): Promise<string> {
    const perfMarker = this.performanceMonitor.start('handle_chain_fork');

    try {
      // Parallelize operations
      const [networkStable, period] = await Promise.all([
        this.isNetworkStable(),
        this.votingUtil.initializeChainVotingPeriod(
          oldChainId,
          newChainId,
          forkHeight,
        ),
      ]);

      if (!networkStable) {
        Logger.warn('Network not stable for chain selection');
        return oldChainId;
      }

      const voteTally = await this.votingUtil.collectVotes(period, validators);
      return await this.votingUtil.processVotingResults(
        voteTally,
        oldChainId,
        newChainId,
      );
    } finally {
      this.performanceMonitor.end(perfMarker);
    }
  }

  /**
   * Checks if network conditions are stable enough for voting
   * @returns Promise<boolean> True if network is stable
   */
  private async isNetworkStable(): Promise<boolean> {
    try {
      const peers = this.node.getPeerCount();
      const isSynced = this.sync.getState() === SyncState.SYNCED;

      if (
        peers < BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_PEER_COUNT ||
        !isSynced
      ) {
        this.networkFailureCount++;
        if (this.networkFailureCount >= this.MAX_FAILURES) {
          await this.logAudit('network_circuit_breaker_triggered', {
            failures: this.networkFailureCount,
          });
          return false;
        }
      } else {
        this.networkFailureCount = 0;
      }

      return (
        peers >= BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MIN_PEER_COUNT &&
        isSynced
      );
    } catch (error) {
      this.networkFailureCount++;
      Logger.error('Network stability check failed:', error);
      await this.logAudit('network_stability_check_failed', {
        error: (error as Error).message || 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Gets list of active voters in current period
   * @returns Promise<string[]> Array of voter addresses
   */
  @retry({
    maxAttempts: 3,
    delay: 1000,
    exponentialBackoff: true,
  })
  public async getActiveVoters(): Promise<string[]> {
    const perfMarker = this.performanceMonitor.start('get_active_voters');
    try {
      if (this.currentPeriod?.type !== 'node_selection') {
        return [];
      }

      const votes = await this.votingDb.getVotesByPeriod(
        this.currentPeriod.periodId,
      );
      return Array.from(
        new Set(votes.filter((v) => v.chainVoteData).map((v) => v.voter)),
      );
    } finally {
      this.performanceMonitor.end(perfMarker);
    }
  }

  /**
   * Logs audit events for voting actions
   * @param action Action being audited
   * @param data Additional audit data
   */
  private async logAudit(
    action: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.auditManager?.logEvent({
      type: AuditEventType.TYPE,
      action,
      data,
      timestamp: Date.now(),
      votingPeriod: this.currentPeriod?.periodId,
      severity: AuditSeverity.INFO,
      source: 'direct-voting',
      details: data,
    });
  }

  /**
   * Cleans up resources and stops voting system
   */
  public async close(): Promise<void> {
    return this.dispose();
  }

  /**
   * Gets current voting schedule information
   * @returns Current period, next voting height and blocks until next voting
   */
  public async getVotingSchedule(): Promise<{
    currentPeriod: VotingPeriod | null;
    nextVotingHeight: number;
    blocksUntilNextVoting: number;
  }> {
    const currentHeight = await this.getCurrentHeight();
    return {
      currentPeriod: this.currentPeriod,
      nextVotingHeight: this.nextVotingHeight,
      blocksUntilNextVoting: Math.max(0, this.nextVotingHeight - currentHeight),
    };
  }

  /**
   * Gets current height of the blockchain
   * @returns Promise<number> Current height
   */
  @retry({
    maxAttempts: 3,
    delay: 1000,
    exponentialBackoff: true,
  })
  private async getCurrentHeight(): Promise<number> {
    return this.db.getCurrentHeight();
  }

  /**
   * Gets current voting metrics
   * @returns Object containing various voting metrics
   */
  public async getVotingMetrics() {
    const totalVotes = await this.votingDb.getTotalVotes();
    const activeVoters = await this.getActiveVoters();
    const participationRate = await this.getParticipationRate();
    return {
      currentPeriod: this.currentPeriod,
      totalVotes,
      activeVoters,
      participationRate,
    };
  }

  /**
   * Calculates current participation rate
   * @returns Promise<number> Participation rate between 0 and 1
   */
  public async getParticipationRate(): Promise<number> {
    const cacheKey = `participation:${this.currentPeriod?.periodId}`;
    const cached = this.rateCache?.get(cacheKey);
    if (cached !== undefined) return cached;

    const [activeVoters, totalEligibleVoters] = await Promise.all([
      this.getActiveVoters(),
      this.votingDb.getTotalEligibleVoters(),
    ]);

    if (!totalEligibleVoters || totalEligibleVoters <= 0) {
      Logger.warn('No eligible voters found');
      return 0;
    }

    const rate = activeVoters.length / totalEligibleVoters;
    const boundedRate = Math.min(1, Math.max(0, rate));
    this.rateCache?.set(cacheKey, boundedRate);
    return boundedRate;
  }

  /**
   * Performs health check of voting system
   * @returns Promise<boolean> True if system is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const votingSchedule = await this.getVotingSchedule();
      const participation = await this.getParticipationRate();

      return (
        votingSchedule !== null &&
        participation >= BLOCKCHAIN_CONSTANTS.CONSENSUS.MIN_PARTICIPATION
      );
    } catch (error) {
      Logger.error('DirectVoting health check failed:', error);
      return false;
    }
  }

  /**
   * Creates merkle root from votes
   * @param votes Array of votes to create root from
   * @returns Promise<string> Merkle root hash
   */
  private async createVoteMerkleRoot(votes: Vote[]): Promise<string> {
    const voteData = votes.map((vote) =>
      JSON.stringify({
        voteId: vote.voteId,
        voter: vote.voter,
        timestamp: vote.timestamp,
      }),
    );
    return await this.merkleTree.createRoot(voteData);
  }

  /**
   * Validates votes in a block
   * @param block Block containing votes to validate
   * @returns Promise<boolean> True if all votes are valid
   */
  public async validateVotes(block: Block): Promise<boolean> {
    try {
      // Basic structure validation
      if (!block?.votes || !Array.isArray(block.votes)) {
        Logger.error('Invalid votes structure in block');
        return false;
      }

      // 1. Validate voting period
      const votingSchedule = await this.getVotingSchedule();
      if (!votingSchedule.currentPeriod) {
        Logger.warn('No active voting period in schedule');
        return false;
      }

      // 2. Validator set validation
      const [expectedValidators, activeValidators] = await Promise.all([
        this.mempool?.getExpectedValidators(),
        this.node?.getActiveValidators(),
      ]);

      const expectedValidatorSet = new Set(
        (expectedValidators || []).map((v) => v.address),
      );
      const presentValidators = new Set(
        (activeValidators || []).map((v) => v.address),
      );

      // Check for missing validators
      const absentValidators = Array.from(expectedValidatorSet).filter(
        (validator) => !presentValidators.has(validator),
      );

      // Handle absent validators
      await Promise.all(
        absentValidators.map((validator) =>
          this.mempool?.handleValidationFailure(
            `validator_absence:${block.hash}`,
            validator,
          ),
        ),
      );

      // Verify minimum validator threshold
      const minimumValidators = Math.ceil(
        (expectedValidators?.length || 0) * 0.67,
      ); // 2/3 majority
      if (presentValidators.size < minimumValidators) {
        Logger.warn(
          `Insufficient validators: ${presentValidators.size}/${minimumValidators}`,
        );
        return false;
      }

      // 3. Merkle root validation
      const votesMerkleRoot = await this.createVoteMerkleRoot(block.votes);
      if (votesMerkleRoot !== block.header.validatorMerkleRoot) {
        Logger.error('Invalid votes merkle root');
        return false;
      }

      // 4. Timestamp validation
      const now = Date.now();
      const MAX_TIME_DRIFT = 300000; // 5 minutes

      // 5. Vote validation
      for (const vote of block.votes) {
        // Time drift check
        if (Math.abs(vote.timestamp - now) > MAX_TIME_DRIFT) {
          Logger.error(`Vote timestamp outside range: ${vote.voteId}`);
          return false;
        }

        // Vote validity check
        if (!(await this.validateVote(vote, block.validators))) {
          Logger.error(`Invalid vote: ${vote.voteId}`);
          return false;
        }
      }

      // 6. Signature validation
      const validSignatures = await this.validateVoteSignatures(
        block.votes,
        block.validators,
      );

      return absentValidators.length === 0 && validSignatures;
    } catch (error) {
      Logger.error('Vote validation failed:', error);
      return false;
    }
  }

  /**
   * Validates a vote
   * @param vote Vote to validate
   * @param validators Validators to validate against
   * @returns Promise<boolean> True if vote is valid
   */
  public async validateVote(
    vote: Vote,
    validators: Validator[],
  ): Promise<boolean> {
    try {
      // Validate voter is in validator set
      const validator = validators.find((v) => v.address === vote.voter);
      if (!validator) return false;

      // Validate vote timing
      if (
        !this.currentPeriod ||
        vote.timestamp < this.currentPeriod.startTime ||
        vote.timestamp > this.currentPeriod.endTime
      ) {
        return false;
      }

      // Validate signature
      return await this.votingUtil.verifyVote(
        vote,
        new Map(validators.map((v) => [v.address, v])),
      );
    } catch (error) {
      Logger.error('Vote validation failed:', error);
      return false;
    }
  }

  /**
   * Cleans up cache
   */
  private cleanupCache(): void {
    // Always clear if cache exists
    if (!this.cache) return;

    const currentTime = Date.now();
    const MAX_CACHE_AGE = 3600000; // 1 hour
    const MAX_CACHE_SIZE = 10000;
    const CLEANUP_THRESHOLD = 0.8; // Clean when 80% full

    if (this.cache.size() < MAX_CACHE_SIZE * CLEANUP_THRESHOLD) {
      return;
    }

    // Remove entries that are too old or if the cache is too large
    for (const [key, value] of Array.from(this.cache.entries())) {
      const votes = value as Vote[];
      if (
        votes.length > 0 &&
        (currentTime - votes[0].timestamp > MAX_CACHE_AGE ||
          this.cache.size() > MAX_CACHE_SIZE)
      ) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Calculates average block time
   * @returns Promise<number> Average block time in milliseconds
   */
  private async calculateAverageBlockTime(): Promise<number> {
    // Default to 10 minutes (600000ms) if calculation not possible
    try {
      const lastBlocks = await this.db.getLastNBlocks(100);
      if (lastBlocks.length < 2) return 600000;

      const timeSum = lastBlocks.reduce((sum, block, i) => {
        if (i === 0) return 0;
        return (
          sum + (block.header.timestamp - lastBlocks[i - 1].header.timestamp)
        );
      }, 0);

      return timeSum / (lastBlocks.length - 1);
    } catch (error) {
      Logger.warn('Failed to calculate average block time:', error);
      return 600000; // fallback to 10 minutes
    }
  }

  /**
   * Validates vote signatures
   * @param votes Votes to validate
   * @param validators Validators to validate against
   * @returns Promise<boolean> True if all signatures are valid
   */
  private async validateVoteSignatures(
    votes: Vote[],
    validators: Validator[],
  ): Promise<boolean> {
    try {
      for (const vote of votes) {
        const isValid = await this.votingUtil.verifyVote(
          vote,
          new Map(validators.map((v) => [v.address, v])),
        );
        if (!isValid) return false;
      }
      return true;
    } catch (error) {
      Logger.error('Vote signature validation failed:', error);
      return false;
    }
  }

  /**
   * Checks if an address has participated in the current voting period
   * @param address Address to check
   * @returns Promise<boolean> True if address has participated
   */
  @retry({
    maxAttempts: 3,
    delay: 1000,
    exponentialBackoff: true,
  })
  public async hasParticipated(address: string): Promise<boolean> {
    const perfMarker = this.performanceMonitor.start('check_participation');
    try {
      if (!address || typeof address !== 'string') {
        throw new VotingError('INVALID_ADDRESS', 'Invalid address format');
      }
      const cacheKey = `participation:${this.currentPeriod?.periodId}:${address}`;
      const cached = this.participationCache?.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
      const activeVoters = await this.getActiveVoters();
      const hasVoted = activeVoters.includes(address);
      // Use the participationCache for booleans.
      this.participationCache?.set(cacheKey, hasVoted);
      await this.logAudit('participation_check', {
        address,
        periodId: this.currentPeriod?.periodId,
        hasVoted,
        timestamp: Date.now(),
      });
      return hasVoted;
    } catch (error) {
      Logger.error('Failed to check participation:', error);
      await this.logAudit('participation_check_failed', {
        address,
        error: (error as Error).message,
      });
      return false;
    } finally {
      this.performanceMonitor.end(perfMarker);
    }
  }

  public async getValidators(): Promise<Validator[]> {
    return this.db.getValidators();
  }

  public getCurrentPeriod(): VotingPeriod {
    if (!this.currentPeriod) {
      throw new VotingError('NO_ACTIVE_PERIOD', 'No active voting period');
    }
    return this.currentPeriod;
  }

  @retry({ maxAttempts: 3, delay: 1000, exponentialBackoff: true })
  public async getVotesByAddress(address: string): Promise<Vote[]> {
    const perfMarker = this.performanceMonitor.start('get_votes_by_address');

    try {
      // Validate address format
      if (!address || typeof address !== 'string') {
        throw new VotingError('INVALID_ADDRESS', 'Invalid address format');
      }

      // Check cache first
      const cacheKey = `votes:${address}`;
      const cached = this.cache?.get(cacheKey);
      if (cached) {
        return cached as Vote[];
      }

      // Get votes from database
      const votes = await this.votingDb.getVotesByAddress(address);

      // Cache the results
      this.cache?.set(cacheKey, votes, {
        ttl: BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL,
      });

      await this.logAudit('votes_retrieved', {
        address,
        count: votes.length,
        timestamp: Date.now(),
      });

      return votes;
    } catch (error) {
      Logger.error('Failed to retrieve votes:', error);
      await this.logAudit('votes_retrieval_failed', {
        address,
        error: (error as Error).message,
      });
      throw new VotingError('RETRIEVAL_FAILED', 'Could not retrieve votes');
    } finally {
      this.performanceMonitor.end(perfMarker);
    }
  }

  public async getVotesByAddresses(
    addresses: string[],
  ): Promise<Record<string, Vote[]>> {
    try {
      // Validate the addresses array
      if (
        !Array.isArray(addresses) ||
        addresses.some((addr) => typeof addr !== 'string')
      ) {
        throw new Error('Invalid addresses format');
      }

      // Retrieve votes for each address in batch
      const votesByAddress: Record<string, Vote[]> = {};

      // Fetch votes for each address
      for (const address of addresses) {
        const votes = await this.votingDb.getVotesByAddress(address);
        votesByAddress[address] = votes || []; // Store votes or empty array if none found
      }

      return votesByAddress; // Return the mapping of addresses to their votes
    } catch (error) {
      Logger.error(
        `Failed to retrieve votes for addresses ${addresses.join(', ')}:`,
        error,
      );
      throw new Error('Could not retrieve votes. Please try again later.');
    }
  }

  private async transitionPeriod(): Promise<void> {
    return this.periodMutex.runExclusive(async () => {
      if (!this.currentPeriod || this.currentPeriod.status !== 'active') return;
      // Finalize the current period
      const finalizedPeriod = await this.finalizePeriod();
      this.eventEmitter.emit('votingPeriodEnded', finalizedPeriod);

      // Initialize a new period
      await this.initializeNewPeriod();

      // Update the current period
      this.currentPeriod.status = 'active';
      await this.votingDb.storePeriod(this.currentPeriod);
      this.eventEmitter.emit('votingPeriodStarted', this.currentPeriod);
    });
  }

  // Add method to load validators
  private async loadValidators(): Promise<void> {
    this.validators = await this.db.getValidators();
  }

  private async finalizePeriod(): Promise<VotingPeriod> {
    if (!this.currentPeriod) {
      throw new Error('No active period to finalize');
    }
    try {
      const currentHeight = await this.db.getCurrentHeight();
      const finalizedPeriod: VotingPeriod = {
        ...this.currentPeriod,
        endBlock: currentHeight,
        endHeight: currentHeight,
        status: 'completed',
        endTime: Date.now(),
        isAudited: true,
      };
      await this.votingDb.createVotingPeriod(finalizedPeriod);
      Logger.info(`Voting period ${finalizedPeriod.periodId} finalized`);
      return finalizedPeriod;
    } catch (error) {
      Logger.error('Failed to finalize voting period:', error);
      throw error;
    }
  }

  private async initializeNewPeriod(): Promise<void> {
    try {
      const now = Date.now();
      const currentHeight = await this.db.getCurrentHeight();
      const newPeriod: VotingPeriod = {
        periodId: this.currentPeriod ? this.currentPeriod.periodId + 1 : 1,
        startTime: now,
        endTime: now + BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_MS,
        startBlock: currentHeight,
        endBlock: 0, // Will be set when period ends
        startHeight: currentHeight,
        endHeight: 0,
        status: 'active',
        type: 'node_selection',
        votes: {},
        isAudited: false,
        createdAt: now,
        votesMerkleRoot: '',
      };

      this.currentPeriod = newPeriod;
      await this.votingDb.createVotingPeriod(newPeriod);
      Logger.info(`New voting period initialized: ${newPeriod.periodId}`);
    } catch (error) {
      Logger.error('Failed to initialize new period:', error);
      throw error;
    }
  }

  /**
   * Disposes of the DirectVotingSystem
   * @returns Promise<void>
   */
  public async dispose(): Promise<void> {
    this.isShuttingDown = true;

    // Clear all timers
    if (this.votingScheduleTimer) clearTimeout(this.votingScheduleTimer);
    if (this.cacheCleanupTimer) clearInterval(this.cacheCleanupTimer);
    if (this.networkResetTimer) clearInterval(this.networkResetTimer);
    if (this.periodCheckInterval) clearInterval(this.periodCheckInterval);

    try {
      // Clear caches
      this.cache?.clear();
      this.rateCache?.clear();
      this.participationCache?.clear();

      // Close connections
      await Promise.all([
        this.votingUtil.dispose(),
        this.node.close(),
        this.votingDb.close(),
        this.backupManager?.cleanup(),
      ]);

      // Reset state
      this.currentPeriod = null;
      this.validators = [];
    } catch (error) {
      Logger.error('Error during voting system cleanup:', error);
      throw error;
    }
  }

  private setupIntervals(): void {
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;

    this.periodCheckInterval = setInterval(async () => {
      try {
        if (this.isShuttingDown) {
          clearInterval(this.periodCheckInterval);
          return;
        }
        await this.transitionPeriod();
        consecutiveFailures = 0;
      } catch (error) {
        consecutiveFailures++;
        Logger.error('Period transition failed:', error);
        try {
          await this.logAudit('period_transition_failed', {
            error: (error as Error).message,
            timestamp: Date.now(),
          });
        } catch (e) {
          Logger.error('Failed to log audit:', e);
        }
        if (consecutiveFailures > MAX_CONSECUTIVE_FAILURES) {
          clearInterval(this.periodCheckInterval);
          Logger.error('Stopping period check due to repeated failures');
        }
      }
    }, BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.PERIOD_CHECK_INTERVAL);
  }

  private async acquireLocks<T>(operation: () => Promise<T>): Promise<T> {
    // Always acquire locks in the same order
    const lock1 = this.voteMutex;
    const lock2 = this.periodMutex;

    const release1 = await lock1.acquire();
    try {
      const release2 = await lock2.acquire();
      try {
        return await operation();
      } finally {
        release2();
      }
    } finally {
      release1();
    }
  }

  /**
   * Updates voting state atomically
   * @param operation Function that receives current state and returns updated state
   * @returns Promise<void>
   */
  public async updateVotingState(
    operation: (currentState: VotingPeriod) => Promise<VotingPeriod | false>,
  ): Promise<VotingPeriod | false> {
    const transaction = this.db.getTransactionExecutor<VotingPeriod | false>();
    const transactionOperation = async () => {
      const snapshot = this.currentPeriod ? { ...this.currentPeriod } : null;

      if (!snapshot) {
        throw new Error('No active voting period');
      }

      try {
        const updatedState = await operation(snapshot);
        if (updatedState === false) return false;

        this.currentPeriod = updatedState;
        await this.votingDb.updateVotingPeriod(updatedState);

        await this.auditManager.logEvent({
          type: AuditEventType.TYPE,
          severity: AuditSeverity.INFO,
          source: 'voting_state_update',
          details: {
            periodId: updatedState.periodId,
            timestamp: Date.now(),
          },
        });

        return updatedState;
      } catch (error) {
        Logger.error('Failed to update voting state:', error);
        throw error;
      }
    };

    return transaction(transactionOperation);
  }

  // Add vote processing optimization
  private async processVote(
    vote: Vote,
    tx: { put: (key: string, value: string) => Promise<void> },
  ): Promise<void> {
    const amountStr = vote.chainVoteData?.amount;
    if (!amountStr) {
      throw new VotingError('INVALID_VOTE_AMOUNT', 'Vote amount is not provided');
    }
    const voteAmount = parseFloat(amountStr);
    if (isNaN(voteAmount)) {
      throw new VotingError('INVALID_VOTE_AMOUNT', 'Vote amount is not a valid number');
    }
    const quadraticPower = BigInt(Math.floor(Math.sqrt(voteAmount)));
    const enrichedVote = {
      ...vote,
      votingPower: quadraticPower.toString(),
      timestamp: Date.now(),
    };

    await this.votingDb.storeVote(enrichedVote, tx);
    await this.updateMerkleTree(enrichedVote, tx);
  }

  // Optimize merkle tree updates
  private async updateMerkleTree(
    vote: Vote,
    tx: { put: (key: string, value: string) => Promise<void> },
  ): Promise<void> {
    if (!tx?.put) {
      Logger.error('Invalid transaction object provided to updateMerkleTree.');
      throw new Error('Invalid transaction');
    }
    await tx.put(
      vote.voteId,
      JSON.stringify({
        voteId: vote.voteId,
        voter: vote.voter,
        timestamp: vote.timestamp,
      }),
    );
  }
}
