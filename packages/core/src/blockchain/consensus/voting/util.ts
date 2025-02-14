import { Mutex } from 'async-mutex';
import { Logger } from '@h3tag-blockchain/shared';
import { EventEmitter } from 'events';
import { BlockchainSchema } from '../../../database/blockchain-schema';
import { AuditManager } from '../../../security/audit';
import { BackupManager } from '../../../database/backup-manager';
import { Validator } from '../../../models/validator';
import { Vote } from '../../../models/vote.model';
import { VotingPeriod } from '../../../models/vote.model';
import { BLOCKCHAIN_CONSTANTS } from '../../utils/constants';
import { AuditEventType } from '../../../security/audit';
import { AuditSeverity } from '../../../security/audit';
import { MetricsCollector } from '../../../monitoring/metrics-collector';
import { CircuitBreaker } from '../../../network/circuit-breaker';
import { DDoSProtection } from '../../../security/ddos';

export interface VoteTally {
  approved: bigint;
  rejected: bigint;
  totalVotes: number;
  uniqueVoters: number;
  participationRate: number;
  timestamp: number;
}

/**
 * Custom Error for when fork depth exceeds allowed production limits.
 */
export class ForkDepthError extends Error {
  cause: object;
  constructor(message: string, cause: object) {
    super(message);
    this.cause = cause;
    this.name = 'ForkDepthError';
  }
}

interface VoteCacheEntry {
  value: boolean;
  timestamp: number;
}

export class DirectVotingUtil {
  private readonly voteMutex = new Mutex();
  private readonly metrics: MetricsCollector;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly backupManager: BackupManager;
  private readonly eventEmitter = new EventEmitter();
  private readonly ddosProtection: DDoSProtection;
  private readonly voteCache = new Map<string, VoteCacheEntry>();
  
  // Define TTL in milliseconds (adjust as needed)
  private readonly VOTE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Constructor for DirectVotingUtil
   * @param db Database instance
   * @param auditManager Audit manager instance
   */
  constructor(
    private readonly db: BlockchainSchema,
    private readonly auditManager: AuditManager,
  ) {
    this.metrics = new MetricsCollector('node_selection');
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 30000,
    });
    this.backupManager = new BackupManager(db.getPath());
    this.ddosProtection = new DDoSProtection(
      {
        maxRequests: {
          pow: 200,
          quadraticVote: 100,
          default: 50,
        },
      },
      this.auditManager,
    );
  }

  /**
   * Initializes a chain voting period
   * @param oldChainId Old chain ID
   * @param newChainId New chain ID
   * @param forkHeight Fork height
   * @returns Promise<VotingPeriod> Initialized voting period
   */
  public async initializeChainVotingPeriod(
    oldChainId: string,
    newChainId: string,
    forkHeight: number,
  ): Promise<VotingPeriod> {
    const currentHeight = await this.db.getCurrentHeight();
    const startVotingHeight = await this.db.getVotingStartHeight();
    const endVotingHeight = await this.db.getVotingEndHeight();

    // Validate that start/end voting heights were retrieved successfully.
    if (startVotingHeight == null || endVotingHeight == null) {
      Logger.error('Voting start or end height is undefined', {
        startVotingHeight,
        endVotingHeight,
      });
      throw new Error('Voting start/end height undefined');
    }

    const forkDepth = currentHeight - forkHeight;

    if (forkDepth > BLOCKCHAIN_CONSTANTS.MINING.MAX_FORK_DEPTH) {
      const metadata = {
        currentHeight,
        forkHeight,
        forkDepth,
        maxAllowed: BLOCKCHAIN_CONSTANTS.MINING.MAX_FORK_DEPTH,
      };
      Logger.error('Fork depth exceeds maximum allowed', metadata);
      throw new ForkDepthError(
        `Fork depth exceeds maximum allowed: current depth ${forkDepth} exceeds max allowed ${BLOCKCHAIN_CONSTANTS.MINING.MAX_FORK_DEPTH}`,
        metadata,
      );
    }

    return {
      periodId: Date.now(),
      startBlock: currentHeight,
      endBlock:
        currentHeight +
        BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_BLOCKS,
      startTime: Date.now(),
      endTime: Date.now() + BLOCKCHAIN_CONSTANTS.CONSENSUS.CONSENSUS_TIMEOUT,
      status: 'active',
      createdAt: Date.now(),
      votes: {},
      isAudited: false,
      type: 'node_selection',
      chainId: newChainId,
      forkHeight,
      competingChains: {
        oldChainId,
        newChainId,
        commonAncestorHeight: forkHeight,
      },
      startHeight: startVotingHeight,
      endHeight: endVotingHeight,
    };
  }

  /**
   * Collects votes for a given voting period
   * @param period Voting period
   * @param validators Validators
   * @returns Promise<VoteTally> Tally of votes
   */
  public async collectVotes(
    period: VotingPeriod,
    validators: Validator[],
  ): Promise<VoteTally> {
    return this.voteMutex.runExclusive(async () => {
      const periodSnapshot = { ...period };
      
      if (periodSnapshot.status !== 'active' && 
          periodSnapshot.status !== 'completed') {
        throw new Error('Invalid voting period status');
      }

      if (!validators || validators.length === 0) {
        throw new Error('No validators provided');
      }

      const BATCH_SIZE = 1000;
      let offset = 0;
      const validVotes: Vote[] = [];

      const validatorMap = new Map(validators.map(v => [v.address, v]));

      while (true) {
        const votesBatch = Object.values(periodSnapshot.votes).slice(
          offset,
          offset + BATCH_SIZE,
        );

        if (votesBatch.length === 0) break;

        const batchResults = await Promise.allSettled(
          votesBatch.map((vote) =>
            this.verifyVote(vote as Vote, validatorMap).then((isValid) => (isValid ? vote : null)),
          ),
        );

        // Use a type predicate that checks for a fulfilled result with a non-null vote.
        validVotes.push(
          ...batchResults
            .filter((result): result is PromiseFulfilledResult<Vote> =>
              result.status === 'fulfilled' && result.value !== null,
            )
            .map((result) => result.value),
        );

        offset += BATCH_SIZE;
      }

      return this.tallyVotes(validVotes);
    });
  }

  /**
   * Tallys votes for a given voting period
   * @param votes Votes to tally
   * @returns Promise<VoteTally> Tally of votes
   */
  private async tallyVotes(votes: Vote[]): Promise<VoteTally> {
    try {
      // Initialize counters for valid votes only
      let approved = 0n;
      let rejected = 0n;
      let validCount = 0;

      // Validate that votes is an array (just in case)
      if (!votes || !Array.isArray(votes)) {
        throw new Error('Invalid votes array');
      }

      // Loop through votes and only count those with a valid "approve" flag
      for (const vote of votes) {
        if (typeof vote.approve !== 'boolean') {
          Logger.warn(`Vote ${vote.voteId} missing a valid 'approve' property, skipping in tally.`);
          continue; // Skip vote if approve is not set as a boolean
        }
        validCount++;
        if (vote.approve) {
          approved++;
        } else {
          rejected++;
        }
      }

      const tally: VoteTally = {
        approved,
        rejected,
        totalVotes: validCount,
        uniqueVoters: new Set(votes.filter(v => typeof v.approve === 'boolean').map((v) => v.voter)).size,
        // Use precise division (without BigInt division rounding) for participation rate.
        participationRate: validCount > 0 ? Number(approved) / validCount : 0,
        timestamp: Date.now(),
      };

      return tally;
    } catch (error) {
      Logger.error('Tallying votes failed:', error);
      throw error;
    }
  }

  /**
   * Emits voting progress
   * @param currentVotes Current votes
   * @param totalVotes Total votes
   * @param startTime Start time
   */
  private emitProgress(
    currentVotes: number,
    totalVotes: number,
    startTime: number,
  ): void {
    const elapsed = Date.now() - startTime;
    const rate = (currentVotes / elapsed) * 1000; // votes per second
    this.eventEmitter.emit('votingProgress', {
      currentVotes,
      totalVotes,
      rate,
      elapsed,
    });
  }

  /**
   * Processes voting results
   * @param tally Vote tally
   * @param oldChainId Old chain ID
   * @param newChainId New chain ID
   * @returns Promise<string> New chain ID if selected, old chain ID otherwise
   */
  public async processVotingResults(
    tally: VoteTally,
    oldChainId: string,
    newChainId: string,
  ): Promise<string> {
    let timer;
    try {
      timer = this.metrics?.startTimer('voting.process_duration');

      const totalVotes = tally.approved + tally.rejected;
      if (totalVotes === BigInt(0)) {
        Logger.warn('No valid votes received');
        return oldChainId;
      }

      const approvalRatio = Number(tally.approved) / Number(totalVotes);

      // Record metrics if available
      if (this.metrics) {
        this.metrics.gauge('voting.approval_ratio', approvalRatio);
        this.metrics.gauge('voting.total_votes', tally.totalVotes);
        this.metrics.gauge('voting.unique_voters', tally.uniqueVoters);
      }

      if (
        approvalRatio >= BLOCKCHAIN_CONSTANTS.MINING.NODE_SELECTION_THRESHOLD
      ) {
        await this.auditManager.logEvent({
          type: AuditEventType.SECURITY,
          severity: AuditSeverity.INFO,
          source: 'node_selection',
          details: {
            result: 'new_chain_selected',
            newChainId,
            approvalRatio,
            totalVotes: tally.totalVotes,
          },
        });
        return newChainId;
      }
      return oldChainId;
    } catch (error: unknown) {
      Logger.error('Processing voting results failed:', error);
      await this.auditManager.logEvent({
        type: AuditEventType.SECURITY,
        severity: AuditSeverity.CRITICAL,
        source: 'node_selection',
        details: {
          stack: error instanceof Error ? error.stack || error.message : String(error)
        }
      });
      throw error;
    } finally {
      if (timer) {
        try {
          timer();
        } catch (error) {
          Logger.error('Failed to end metrics timer:', error);
        }
      }
    }
  }

  /**
   * Verifies a vote
   * @param vote Vote to verify
   * @param validatorMap Validators to verify against
   * @returns Promise<boolean> True if vote is valid
   */
  public async verifyVote(
    vote: Vote,
    validatorMap: Map<string, Validator>,
  ): Promise<boolean> {
    // Update cache key to include vote.signature for additional uniqueness.
    const cacheKey = `${vote.voter}:${vote.timestamp}:${vote.signature}`;
    const now = Date.now();

    // Check cache first and evict expired entry
    if (this.voteCache.has(cacheKey)) {
      const entry = this.voteCache.get(cacheKey);
      if (entry && now - entry.timestamp < this.VOTE_CACHE_TTL) {
        return entry.value;
      } else {
        this.voteCache.delete(cacheKey);
      }
    }

    // DDoS protection check
    if (!this.ddosProtection.checkRequest(`vote_verify:${vote.voter}`, vote.voter)) {
      await this.auditManager.logEvent({
        type: AuditEventType.SECURITY,
        severity: AuditSeverity.WARNING,
        source: 'ddos_protection',
        details: { 
          voter: vote.voter,
          timestamp: now,
          requestType: 'vote_verify'
        }
      });
      throw new Error('Rate limit exceeded');
    }

    const result = await Promise.race([
      this._verifyVote(vote, validatorMap),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('Verification timeout')), 5000),
      ),
    ]).catch(async (error: Error) => {
      Logger.error('Vote verification failed:', error);
      await this.auditManager.logEvent({
        type: AuditEventType.SECURITY,
        severity: AuditSeverity.ERROR,
        source: 'node_selection',
        details: {
          stack: error.stack || error.message,
          voter: vote.voter,
          timestamp: now
        }
      });
      return false;
    });

    // Cache the result along with the current timestamp
    this.voteCache.set(cacheKey, { value: result, timestamp: now });
    return result;
  }

  private async _verifyVote(
    vote: Vote,
    validatorMap: Map<string, Validator>,
  ): Promise<boolean> {
    // Early return for invalid votes
    if (!vote?.chainVoteData || !vote.signature || !vote.voter || 
        !vote.timestamp || !vote.chainVoteData.targetChainId) {
      return false;
    }

    // Check vote age
    if (Date.now() - vote.timestamp > BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.MAX_VOTE_AGE) {
      return false;
    }

    const validator = validatorMap.get(vote.voter);

    if (!validator?.isActive) {
      return false;
    }

    // Verify signature
    return await this.db.verifySignature(
      vote.voter,
      `${vote.chainVoteData.targetChainId}:${vote.timestamp}`,
      vote.signature,
    );
  }

  /**
   * Disposes of the DirectVotingUtil
   * @returns Promise<void>
   */
  public async dispose(): Promise<void> {
    try {
      // Add max listeners check and cleanup
      this.eventEmitter.setMaxListeners(0);
      this.eventEmitter.removeAllListeners();
      
      // Clear cache
      this.voteCache.clear();
      
      await this.backupManager.cleanup();
      
      // Clean up metrics collector
      if (this.metrics) {
        this.metrics.dispose();
      }
      
      // Clean up circuit breaker
      if (this.circuitBreaker) {
        this.circuitBreaker.dispose();
      }
      
      // Clean up DDoS protection
      if (this.ddosProtection) {
        await this.ddosProtection.dispose();
      }
    } catch (error: unknown) {
      Logger.error('Disposal failed:', error);
      await this.auditManager.logEvent({
        type: AuditEventType.SECURITY,
        severity: AuditSeverity.CRITICAL,
        source: 'node_selection',
        details: {
          stack: error instanceof Error ? error.stack || error.message : String(error)
        }
      });
      throw error;
    }
  }
}