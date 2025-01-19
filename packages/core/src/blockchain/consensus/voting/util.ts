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

export class DirectVotingUtil {
  private readonly voteMutex = new Mutex();
  private readonly metrics: MetricsCollector;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly backupManager: BackupManager;
  private readonly eventEmitter = new EventEmitter();
  private readonly ddosProtection: DDoSProtection;

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
          qudraticVote: 100,
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

    if (
      currentHeight - forkHeight >
      BLOCKCHAIN_CONSTANTS.MINING.MAX_FORK_DEPTH
    ) {
      const errorMessage = 'Fork depth exceeds maximum allowed';
      Logger.error(errorMessage);
      throw new Error(errorMessage);
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
      votes: new Map(),
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
    // Take snapshot of period state at start
    const periodSnapshot = { ...period };

    return this.voteMutex.runExclusive(async () => {
      if (
        Date.now() < periodSnapshot.endTime &&
        periodSnapshot.status === 'active'
      ) {
        throw new Error('Voting period still active');
      }

      // Use periodSnapshot instead of period
      const votes = Array.from(periodSnapshot.votes.values());
      const validVotes = await Promise.all(
        votes.map(async (vote) => {
          try {
            return (await this.verifyVote(vote, validators)) ? vote : null;
          } catch (error) {
            Logger.error('Vote verification failed:', error);
            return null;
          }
        }),
      );

      return this.tallyVotes(validVotes.filter((v): v is Vote => v !== null));
    });
  }

  /**
   * Tallys votes for a given voting period
   * @param votes Votes to tally
   * @returns Promise<VoteTally> Tally of votes
   */
  private async tallyVotes(votes: Vote[]): Promise<VoteTally> {
    const tally: VoteTally = {
      approved: BigInt(0),
      rejected: BigInt(0),
      totalVotes: votes.length,
      uniqueVoters: new Set(votes.map((v) => v.voter)).size,
      participationRate: 0,
      timestamp: Date.now(),
    };

    for (const vote of votes) {
      try {
        if (vote.approve) {
          tally.approved = tally.approved + BigInt(1);
        } else {
          tally.rejected = tally.rejected + BigInt(1);
        }
      } catch (error) {
        Logger.error('Vote counting error:', error);
      }
    }

    // Calculate participation rate safely
    const total = tally.approved + tally.rejected;
    tally.participationRate =
      total > 0 ? Number(tally.approved) / Number(total) : 0;

    return tally;
  }

  /**
   * Processes voting results
   * @param tally Vote tally
   * @param oldChainId Old chain ID
   * @param newChainId New chain ID
   * @returns Promise<string> New chain ID if selected, old chain ID otherwise
   */
  private async processVotingResults(
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
          type: AuditEventType.TYPE,
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
    } catch (error) {
      Logger.error('Processing voting results failed:', error);
      return oldChainId;
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
   * @param validators Validators to verify against
   * @returns Promise<boolean> True if vote is valid
   */
  public async verifyVote(
    vote: Vote,
    validators: Validator[],
  ): Promise<boolean> {
    // DDoS protection check
    if (
      !this.ddosProtection.checkRequest(`vote_verify:${vote.voter}`, vote.voter)
    ) {
      throw new Error('Rate limit exceeded');
    }

    return Promise.race([
      this._verifyVote(vote, validators),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('Verification timeout')), 5000),
      ),
    ]).catch((error) => {
      Logger.error('Vote verification failed:', error);
      return false;
    });
  }

  private async _verifyVote(
    vote: Vote,
    validators: Validator[],
  ): Promise<boolean> {
    // Basic validation
    if (!vote?.chainVoteData || !vote.signature || !vote.voter) {
      Logger.warn('Invalid vote structure');
      return false;
    }

    // Validator check
    const validator = validators.find((v) => v.address === vote.voter);
    if (!validator?.isActive) {
      Logger.warn(`Invalid or inactive validator ${vote.voter}`);
      return false;
    }

    // Single signature verification attempt
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
  async dispose(): Promise<void> {
    try {
      this.eventEmitter.removeAllListeners();
      await this.backupManager.cleanup();
    } catch (error) {
      Logger.error('Disposal failed:', error);
      throw error;
    }
  }
}
