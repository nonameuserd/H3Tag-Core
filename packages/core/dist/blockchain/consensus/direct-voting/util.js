"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectVotingUtil = void 0;
const async_mutex_1 = require("async-mutex");
const shared_1 = require("@h3tag-blockchain/shared");
const events_1 = require("events");
const backup_manager_1 = require("../../../database/backup-manager");
const constants_1 = require("../../utils/constants");
const audit_1 = require("../../../security/audit");
const audit_2 = require("../../../security/audit");
const metrics_collector_1 = require("../../../monitoring/metrics-collector");
const circuit_breaker_1 = require("../../../network/circuit-breaker");
const ddos_1 = require("../../../security/ddos");
class DirectVotingUtil {
    /**
     * Constructor for DirectVotingUtil
     * @param db Database instance
     * @param auditManager Audit manager instance
     */
    constructor(db, auditManager) {
        this.db = db;
        this.auditManager = auditManager;
        this.chainVoteMutex = new async_mutex_1.Mutex();
        this.voteMutex = new async_mutex_1.Mutex();
        this.eventEmitter = new events_1.EventEmitter();
        this.metrics = new metrics_collector_1.MetricsCollector('chain_selection');
        this.circuitBreaker = new circuit_breaker_1.CircuitBreaker({
            failureThreshold: 5,
            resetTimeout: 30000
        });
        this.backupManager = new backup_manager_1.BackupManager(db.getPath());
        this.ddosProtection = new ddos_1.DDoSProtection({
            maxRequests: {
                pow: 200,
                qudraticVote: 100,
                default: 50
            }
        }, this.auditManager);
    }
    /**
     * Initializes a chain voting period
     * @param oldChainId Old chain ID
     * @param newChainId New chain ID
     * @param forkHeight Fork height
     * @returns Promise<VotingPeriod> Initialized voting period
     */
    async initializeChainVotingPeriod(oldChainId, newChainId, forkHeight) {
        const currentHeight = await this.db.getCurrentHeight();
        const startVotingHeight = await this.db.getVotingStartHeight();
        const endVotingHeight = await this.db.getVotingEndHeight();
        if (currentHeight - forkHeight > constants_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_FORK_DEPTH) {
            const errorMessage = 'Fork depth exceeds maximum allowed';
            shared_1.Logger.error(errorMessage);
            throw new Error(errorMessage);
        }
        return {
            periodId: Date.now(),
            startBlock: currentHeight,
            endBlock: currentHeight + constants_1.BLOCKCHAIN_CONSTANTS.VOTING_CONSTANTS.VOTING_PERIOD_BLOCKS,
            startTime: Date.now(),
            endTime: Date.now() + constants_1.BLOCKCHAIN_CONSTANTS.CONSENSUS.CONSENSUS_TIMEOUT,
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
                commonAncestorHeight: forkHeight
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
    async collectVotes(period, validators) {
        // Take snapshot of period state at start
        const periodSnapshot = { ...period };
        return this.voteMutex.runExclusive(async () => {
            if (Date.now() < periodSnapshot.endTime && periodSnapshot.status === 'active') {
                throw new Error('Voting period still active');
            }
            // Use periodSnapshot instead of period
            const votes = Array.from(periodSnapshot.votes.values());
            const validVotes = await Promise.all(votes.map(async (vote) => {
                try {
                    return await this.verifyVote(vote, validators) ? vote : null;
                }
                catch (error) {
                    shared_1.Logger.error('Vote verification failed:', error);
                    return null;
                }
            }));
            return this.tallyVotes(validVotes.filter((v) => v !== null));
        });
    }
    /**
     * Tallys votes for a given voting period
     * @param votes Votes to tally
     * @returns Promise<VoteTally> Tally of votes
     */
    async tallyVotes(votes) {
        const tally = {
            approved: BigInt(0),
            rejected: BigInt(0),
            totalVotes: votes.length,
            uniqueVoters: new Set(votes.map(v => v.voter)).size,
            participationRate: 0,
            timestamp: Date.now()
        };
        for (const vote of votes) {
            try {
                if (vote.approve) {
                    tally.approved = tally.approved + BigInt(1);
                }
                else {
                    tally.rejected = tally.rejected + BigInt(1);
                }
            }
            catch (error) {
                shared_1.Logger.error('Vote counting error:', error);
                // Continue counting other votes
            }
        }
        // Calculate participation rate safely
        const total = tally.approved + tally.rejected;
        tally.participationRate = total > 0 ? Number(tally.approved) / Number(total) : 0;
        return tally;
    }
    /**
     * Processes voting results
     * @param tally Vote tally
     * @param oldChainId Old chain ID
     * @param newChainId New chain ID
     * @returns Promise<string> New chain ID if selected, old chain ID otherwise
     */
    async processVotingResults(tally, oldChainId, newChainId) {
        let timer;
        try {
            timer = this.metrics?.startTimer('voting.process_duration');
            const totalVotes = tally.approved + tally.rejected;
            if (totalVotes === BigInt(0)) {
                shared_1.Logger.warn('No valid votes received');
                return oldChainId;
            }
            const approvalRatio = Number(tally.approved) / Number(totalVotes);
            // Record metrics if available
            if (this.metrics) {
                this.metrics.gauge('voting.approval_ratio', approvalRatio);
                this.metrics.gauge('voting.total_votes', tally.totalVotes);
                this.metrics.gauge('voting.unique_voters', tally.uniqueVoters);
            }
            if (approvalRatio >= constants_1.BLOCKCHAIN_CONSTANTS.MINING.CHAIN_DECISION_THRESHOLD) {
                await this.auditManager.logEvent({
                    type: audit_1.AuditEventType.TYPE,
                    severity: audit_2.AuditSeverity.INFO,
                    source: 'node_selection',
                    details: {
                        result: 'new_chain_selected',
                        newChainId,
                        approvalRatio,
                        totalVotes: tally.totalVotes
                    }
                });
                return newChainId;
            }
            return oldChainId;
        }
        catch (error) {
            shared_1.Logger.error('Processing voting results failed:', error);
            return oldChainId;
        }
        finally {
            if (timer) {
                try {
                    timer();
                }
                catch (error) {
                    shared_1.Logger.error('Failed to end metrics timer:', error);
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
    async verifyVote(vote, validators) {
        // DDoS protection check
        if (!this.ddosProtection.checkRequest(`vote_verify:${vote.voter}`, vote.voter)) {
            throw new Error("Rate limit exceeded");
        }
        return Promise.race([
            this._verifyVote(vote, validators),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Verification timeout")), 5000))
        ]).catch(error => {
            shared_1.Logger.error('Vote verification failed:', error);
            return false;
        });
    }
    async _verifyVote(vote, validators) {
        // Basic validation
        if (!vote?.chainVoteData || !vote.signature || !vote.voter) {
            shared_1.Logger.warn('Invalid vote structure');
            return false;
        }
        // Validator check
        const validator = validators.find(v => v.address === vote.voter);
        if (!validator?.isActive) {
            shared_1.Logger.warn(`Invalid or inactive validator ${vote.voter}`);
            return false;
        }
        // Single signature verification attempt
        return await this.db.verifySignature(vote.voter, `${vote.chainVoteData.targetChainId}:${vote.timestamp}`, vote.signature.address);
    }
    /**
     * Disposes of the DirectVotingUtil
     * @returns Promise<void>
     */
    async dispose() {
        try {
            this.eventEmitter.removeAllListeners();
            await this.backupManager.cleanup();
        }
        catch (error) {
            shared_1.Logger.error('Disposal failed:', error);
            throw error;
        }
    }
}
exports.DirectVotingUtil = DirectVotingUtil;
//# sourceMappingURL=util.js.map