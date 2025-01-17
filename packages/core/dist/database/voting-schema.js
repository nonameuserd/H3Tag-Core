"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VotingDatabase = void 0;
const level_1 = require("level");
const shared_1 = require("@h3tag-blockchain/shared");
const cache_1 = require("../scaling/cache");
const async_mutex_1 = require("async-mutex");
const retry_1 = require("../utils/retry");
const voting_error_1 = require("../blockchain/utils/voting-error");
class VotingDatabase {
    constructor(dbPath) {
        this.isInitialized = false;
        this.BATCH_SIZE = 1000;
        this.CACHE_TTL = 3600; // 1 hour
        if (!dbPath)
            throw new Error('Database path is required');
        this.db = new level_1.Level(`${dbPath}/voting`, {
            valueEncoding: 'json',
            createIfMissing: true,
            compression: true
        });
        this.mutex = new async_mutex_1.Mutex();
        this.cache = new cache_1.Cache({
            ttl: this.CACHE_TTL,
            maxSize: 10000,
            compression: true
        });
        this.initialize().catch(err => {
            shared_1.Logger.error('Failed to initialize voting database:', err);
            throw err;
        });
    }
    async initialize() {
        try {
            await this.db.open();
            this.isInitialized = true;
            shared_1.Logger.info('Voting database initialized successfully');
        }
        catch (error) {
            shared_1.Logger.error('Failed to initialize voting database:', error);
            throw error;
        }
    }
    /**
     * Creates a new voting period
     *
     * @async
     * @method createVotingPeriod
     * @param {VotingPeriod} period - Voting period to create
     * @returns {Promise<void>}
     * @throws {Error} If period creation fails
     *
     * @example
     * await votingDb.createVotingPeriod({
     *   periodId: 1,
     *   startBlock: 1000,
     *   endBlock: 2000
     * });
     */
    async createVotingPeriod(period) {
        return await this.mutex.runExclusive(async () => {
            const key = `period:${period.periodId}`;
            try {
                await this.db.put(key, JSON.stringify(period));
                this.cache.set(key, period);
            }
            catch (error) {
                shared_1.Logger.error('Failed to create voting period:', error);
                throw error;
            }
        });
    }
    /**
     * Records a vote in the current period
     *
     * @async
     * @method recordVote
     * @param {Vote} vote - Vote to record
     * @returns {Promise<void>}
     * @throws {VotingError} If vote is invalid or duplicate
     *
     * @example
     * await votingDb.recordVote({
     *   periodId: 1,
     *   voterAddress: '0x...',
     *   approve: true,
     *   votingPower: 100n
     * });
     */
    async recordVote(vote) {
        if (!this.isInitialized)
            throw new Error('Database not initialized');
        if (!this.validateVote(vote))
            throw new Error('Invalid vote data');
        return await this.mutex.runExclusive(async () => {
            const key = `vote:${vote.periodId}:${vote.voterAddress}`;
            try {
                // Check for existing vote
                const existing = await this.getVote(vote.periodId, vote.voterAddress);
                if (existing) {
                    throw new voting_error_1.VotingError('DUPLICATE_VOTE', 'Voter has already voted in this period');
                }
                const batch = this.db.batch();
                // Store main record
                batch.put(key, JSON.stringify(vote));
                // Index by period
                batch.put(`period_vote:${vote.periodId}:${vote.voterAddress}`, key);
                await batch.write();
                this.cache.set(key, vote, { ttl: this.CACHE_TTL });
                shared_1.Logger.debug('Vote recorded successfully', {
                    periodId: vote.periodId,
                    voter: vote.voterAddress
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                shared_1.Logger.error('Failed to record vote:', { error: errorMessage });
                throw new voting_error_1.VotingError('RECORD_FAILED', `Failed to record vote: ${errorMessage}`);
            }
        });
    }
    /**
     * Aggregates votes for a period
     *
     * @async
     * @method aggregateVotes
     * @param {number} periodId - Period ID to aggregate
     * @returns {Promise<{
     *   approved: bigint;
     *   rejected: bigint;
     *   totalVotes: number;
     *   uniqueVoters: number;
     * }>} Vote aggregation results
     *
     * @example
     * const results = await votingDb.aggregateVotes(1);
     * console.log(`Approved: ${results.approved}, Rejected: ${results.rejected}`);
     */
    async aggregateVotes(periodId) {
        let approved = BigInt(0);
        let rejected = BigInt(0);
        let totalVotes = 0;
        const voters = new Set();
        try {
            for await (const [key, value] of this.db.iterator({
                gte: `vote:${periodId}:`,
                lte: `vote:${periodId}:\xFF`
            })) {
                const vote = JSON.parse(value);
                totalVotes++;
                voters.add(vote.voterAddress);
                if (vote.approve) {
                    approved += BigInt(vote.votingPower);
                }
                else {
                    rejected += BigInt(vote.votingPower);
                }
            }
            return {
                approved,
                rejected,
                totalVotes,
                uniqueVoters: voters.size
            };
        }
        catch (error) {
            shared_1.Logger.error('Failed to aggregate votes:', error);
            throw error;
        }
    }
    /**
     * Gets latest vote for an address
     *
     * @async
     * @method getLatestVote
     * @param {string} voterAddress - Voter's address
     * @returns {Promise<Vote | null>} Latest vote if found
     *
     * @example
     * const vote = await votingDb.getLatestVote(address);
     */
    async getLatestVote(voterAddress) {
        try {
            for await (const [key, value] of this.db.iterator({
                gte: `vote:${voterAddress}:`,
                lte: `vote:${voterAddress}:\xFF`,
                reverse: true,
                limit: 1
            })) {
                try {
                    return JSON.parse(value);
                }
                catch (error) {
                    if (error instanceof SyntaxError) {
                        shared_1.Logger.error('Invalid JSON in vote:', error);
                        continue;
                    }
                    throw error;
                }
            }
            return null;
        }
        catch (error) {
            shared_1.Logger.error('Failed to get latest vote:', error);
            return null;
        }
    }
    /**
     * Gets all votes by a voter
     *
     * @async
     * @method getVotesByVoter
     * @param {string} voterAddress - Voter's address
     * @returns {Promise<Vote[]>} Array of votes
     *
     * @example
     * const votes = await votingDb.getVotesByVoter(address);
     */
    async getVotesByVoter(voterAddress) {
        const votes = [];
        try {
            for await (const [key, value] of this.db.iterator({
                gte: `vote:${voterAddress}:`,
                lte: `vote:${voterAddress}:\xFF`
            })) {
                votes.push(JSON.parse(value));
            }
            return votes;
        }
        catch (error) {
            shared_1.Logger.error('Failed to get votes by voter:', error);
            return [];
        }
    }
    /**
     * Gets total number of votes
     *
     * @async
     * @method getTotalVotes
     * @returns {Promise<number>} Total vote count
     */
    async getTotalVotes() {
        let count = 0;
        try {
            for await (const [key] of this.db.iterator({
                gte: 'vote:',
                lte: 'vote:\xFF'
            })) {
                count++;
            }
            return count;
        }
        catch (error) {
            shared_1.Logger.error('Failed to get total votes:', error);
            return 0;
        }
    }
    /**
     * Closes database connection
     *
     * @async
     * @method close
     * @returns {Promise<void>}
     */
    async close() {
        if (!this.isInitialized)
            return;
        try {
            await this.mutex.runExclusive(async () => {
                await this.db.close();
                this.cache.clear();
                this.isInitialized = false;
                shared_1.Logger.info('Voting database closed successfully');
            });
        }
        catch (error) {
            shared_1.Logger.error('Error closing voting database:', error);
            throw new voting_error_1.VotingError('CLOSE_FAILED', 'Failed to close database');
        }
    }
    async getVote(periodId, voterAddress) {
        const key = `vote:${periodId}:${voterAddress}`;
        try {
            const cached = this.cache.get(key);
            if (cached)
                return cached;
            const value = await this.db.get(key);
            const vote = JSON.parse(value);
            this.cache.set(key, vote);
            return vote;
        }
        catch (error) {
            if (error.notFound)
                return null;
            if (error instanceof SyntaxError) {
                shared_1.Logger.error('Invalid JSON in vote:', error);
                return null;
            }
            shared_1.Logger.error('Failed to get vote:', error);
            return null;
        }
    }
    /**
     * Gets votes for a specific period
     *
     * @async
     * @method getVotesByPeriod
     * @param {number} periodId - Period ID
     * @returns {Promise<Vote[]>} Array of votes
     */
    async getVotesByPeriod(periodId) {
        const votes = [];
        try {
            for await (const [key, value] of this.db.iterator({
                gte: `vote:${periodId}:`,
                lte: `vote:${periodId}:\xFF`
            })) {
                votes.push(JSON.parse(value));
            }
            return votes;
        }
        catch (error) {
            shared_1.Logger.error('Failed to get votes by period:', error);
            return [];
        }
    }
    /**
     * Gets total eligible voters
     *
     * @async
     * @method getTotalEligibleVoters
     * @returns {Promise<number>} Number of eligible voters
     */
    async getTotalEligibleVoters() {
        try {
            const voters = new Set();
            for await (const [key, value] of this.db.iterator({
                gte: 'voter:',
                lte: 'voter:\xFF'
            })) {
                const voter = JSON.parse(value);
                if (voter.eligible)
                    voters.add(voter.address);
            }
            return voters.size;
        }
        catch (error) {
            shared_1.Logger.error('Failed to get total eligible voters:', error);
            return 0;
        }
    }
    /**
     * Gets votes by address
     *
     * @async
     * @method getVotesByAddress
     * @param {string} address - Voter's address
     * @returns {Promise<Vote[]>} Array of votes
     * @throws {VotingError} If address is invalid or database not initialized
     */
    async getVotesByAddress(address) {
        if (!this.isInitialized)
            throw new Error('Database not initialized');
        if (!address || typeof address !== 'string') {
            throw new voting_error_1.VotingError('INVALID_ADDRESS', 'Invalid address format');
        }
        return await this.mutex.runExclusive(async () => {
            const votes = [];
            const processedKeys = new Set();
            try {
                let batch = [];
                for await (const [key, value] of this.db.iterator({
                    gte: `vote:${address}:`,
                    lte: `vote:${address}:\xFF`,
                    limit: this.BATCH_SIZE
                })) {
                    if (processedKeys.has(key))
                        continue;
                    try {
                        const vote = this.safeParse(value);
                        if (vote && this.validateVote(vote)) {
                            batch.push(vote);
                            processedKeys.add(key);
                        }
                        if (batch.length >= this.BATCH_SIZE) {
                            votes.push(...batch);
                            batch = [];
                        }
                    }
                    catch (parseError) {
                        shared_1.Logger.error('Failed to parse vote:', parseError);
                        continue;
                    }
                }
                if (batch.length > 0) {
                    votes.push(...batch);
                }
                return votes;
            }
            catch (error) {
                shared_1.Logger.error('Failed to get votes by address:', error);
                throw new voting_error_1.VotingError('RETRIEVAL_FAILED', 'Failed to retrieve votes');
            }
        });
    }
    validateVote(vote) {
        return !!(vote &&
            vote.periodId &&
            vote.voterAddress &&
            typeof vote.approve === 'boolean' &&
            typeof vote.votingPower === 'bigint');
    }
    safeParse(value) {
        try {
            return JSON.parse(value);
        }
        catch (error) {
            shared_1.Logger.error('Failed to parse stored value:', error);
            return null;
        }
    }
    /**
     * Stores a vote
     *
     * @async
     * @method storeVote
     * @param {Vote} vote - Vote to store
     * @returns {Promise<void>}
     * @throws {VotingError} If vote is invalid or storage fails
     */
    async storeVote(vote) {
        return await this.mutex.runExclusive(async () => {
            const key = `vote:${vote.periodId}:${vote.voteId}`;
            try {
                // Validate vote
                if (!vote?.voteId || !vote.periodId) {
                    throw new voting_error_1.VotingError('INVALID_VOTE', 'Invalid vote format');
                }
                await this.db.put(key, JSON.stringify(vote));
                this.cache.set(key, vote);
            }
            catch (error) {
                shared_1.Logger.error('Failed to store vote:', error);
                throw new voting_error_1.VotingError('STORE_FAILED', 'Failed to store vote', { voteId: vote.voteId });
            }
        });
    }
    /**
     * Updates voting period data
     *
     * @async
     * @method updateVotingPeriod
     * @param {VotingPeriod} period - Updated period data
     * @returns {Promise<void>}
     * @throws {VotingError} If period not found or update fails
     */
    async updateVotingPeriod(period) {
        return await this.mutex.runExclusive(async () => {
            const key = `period:${period.periodId}`;
            try {
                // Check if period exists
                const exists = await this.db.get(key).catch(() => null);
                if (!exists) {
                    throw new voting_error_1.VotingError('NO_ACTIVE_PERIOD', 'Voting period not found');
                }
                await this.db.put(key, JSON.stringify(period));
                this.cache.set(key, period);
            }
            catch (error) {
                shared_1.Logger.error('Failed to update voting period:', error);
                throw error;
            }
        });
    }
}
__decorate([
    (0, retry_1.retry)({ maxAttempts: 3, delay: 1000 })
], VotingDatabase.prototype, "createVotingPeriod", null);
__decorate([
    (0, retry_1.retry)({ maxAttempts: 3, delay: 1000 })
], VotingDatabase.prototype, "recordVote", null);
__decorate([
    (0, retry_1.retry)({ maxAttempts: 3, delay: 1000 })
], VotingDatabase.prototype, "storeVote", null);
__decorate([
    (0, retry_1.retry)({ maxAttempts: 3, delay: 1000 })
], VotingDatabase.prototype, "updateVotingPeriod", null);
exports.VotingDatabase = VotingDatabase;
//# sourceMappingURL=voting-schema.js.map