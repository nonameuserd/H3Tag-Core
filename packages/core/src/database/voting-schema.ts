import { Level } from "level";
import { Logger } from "@h3tag-blockchain/shared";
import { Cache } from "../scaling/cache";
import { Mutex } from "async-mutex";
import { retry } from "../utils/retry";
import { Vote, VotingPeriod } from "../models/vote.model";
import { VotingError } from "../blockchain/utils/voting-error";

/**
 * @fileoverview VotingSchema implements the database schema and operations for blockchain voting.
 * It handles vote storage, validation, aggregation, and period management with optimized caching
 * and atomic batch operations.
 *
 * @module VotingSchema
 */

/**
 * Interface defining voting schema operations
 *
 * @interface IVotingSchema
 */

/**
 * VotingDatabase manages blockchain voting data with built-in caching and validation.
 *
 * @class VotingDatabase
 * @implements {IVotingSchema}
 *
 * @property {Level} db - LevelDB database instance
 * @property {boolean} isInitialized - Database initialization status
 * @property {Cache<Vote | VotingPeriod>} cache - Vote and period cache
 * @property {Mutex} mutex - Mutex for synchronizing operations
 * @property {number} BATCH_SIZE - Maximum batch operation size
 * @property {number} CACHE_TTL - Cache time-to-live in seconds
 *
 * @example
 * const votingDb = new VotingDatabase('./data/voting');
 * await votingDb.createVotingPeriod(period);
 * await votingDb.recordVote(vote);
 */

export interface IVotingSchema {
  createVotingPeriod(period: VotingPeriod): Promise<void>;
  recordVote(vote: Vote): Promise<void>;
  getLatestVote(voterAddress: string): Promise<Vote | null>;
  getVotesByVoter(voterAddress: string): Promise<Vote[]>;
  getTotalVotes(): Promise<number>;
  getVotesByPeriod(periodId: number): Promise<Vote[]>;
  getTotalEligibleVoters(): Promise<number>;
  close(): Promise<void>;
  getVotesByAddress(address: string): Promise<Vote[]>;
  storeVote(vote: Vote): Promise<void>;
  updateVotingPeriod(period: VotingPeriod): Promise<void>;
}

export class VotingDatabase implements IVotingSchema {
  private db: Level;
  private isInitialized: boolean = false;
  private cache: Cache<Vote | VotingPeriod>;
  private mutex: Mutex;
  private readonly BATCH_SIZE = 1000;
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(dbPath: string) {
    if (!dbPath) throw new Error("Database path is required");

    this.db = new Level(`${dbPath}/voting`, {
      valueEncoding: "json",
      createIfMissing: true,
      compression: true,
    });
    this.mutex = new Mutex();
    this.cache = new Cache<Vote | VotingPeriod>({
      ttl: this.CACHE_TTL,
      maxSize: 10000,
      compression: true,
    });

    this.initialize().catch((err) => {
      Logger.error("Failed to initialize voting database:", err);
      throw err;
    });
  }

  private async initialize(): Promise<void> {
    try {
      await this.db.open();
      this.isInitialized = true;
      Logger.info("Voting database initialized successfully");
    } catch (error) {
      Logger.error("Failed to initialize voting database:", error);
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
  @retry({ maxAttempts: 3, delay: 1000 })
  async createVotingPeriod(period: VotingPeriod): Promise<void> {
    return await this.mutex.runExclusive(async () => {
      const key = `period:${period.periodId}`;
      try {
        await this.db.put(key, JSON.stringify(period));
        this.cache.set(key, period);
      } catch (error) {
        Logger.error("Failed to create voting period:", error);
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
  @retry({ maxAttempts: 3, delay: 1000 })
  async recordVote(vote: Vote): Promise<void> {
    if (!this.isInitialized) throw new Error("Database not initialized");
    if (!this.validateVote(vote)) throw new Error("Invalid vote data");

    return await this.mutex.runExclusive(async () => {
      const key = `vote:${vote.periodId}:${vote.voterAddress}`;
      try {
        // Check for existing vote
        const existing = await this.getVote(vote.periodId, vote.voterAddress);
        if (existing) {
          throw new VotingError(
            "DUPLICATE_VOTE",
            "Voter has already voted in this period"
          );
        }

        const batch = this.db.batch();

        // Store main record
        batch.put(key, JSON.stringify(vote));

        // Index by period
        batch.put(`period_vote:${vote.periodId}:${vote.voterAddress}`, key);

        await batch.write();
        this.cache.set(key, vote, { ttl: this.CACHE_TTL });

        Logger.debug("Vote recorded successfully", {
          periodId: vote.periodId,
          voter: vote.voterAddress,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        Logger.error("Failed to record vote:", { error: errorMessage });
        throw new VotingError(
          "RECORD_FAILED",
          `Failed to record vote: ${errorMessage}`
        );
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
  async aggregateVotes(periodId: number): Promise<{
    approved: bigint;
    rejected: bigint;
    totalVotes: number;
    uniqueVoters: number;
  }> {
    let approved = BigInt(0);
    let rejected = BigInt(0);
    let totalVotes = 0;
    const voters = new Set<string>();

    try {
      for await (const [key, value] of this.db.iterator({
        gte: `vote:${periodId}:`,
        lte: `vote:${periodId}:\xFF`,
      })) {
        const vote = JSON.parse(value);
        totalVotes++;
        voters.add(vote.voterAddress);

        if (vote.approve) {
          approved += BigInt(vote.votingPower);
        } else {
          rejected += BigInt(vote.votingPower);
        }
      }

      return {
        approved,
        rejected,
        totalVotes,
        uniqueVoters: voters.size,
      };
    } catch (error) {
      Logger.error("Failed to aggregate votes:", error);
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
  async getLatestVote(voterAddress: string): Promise<Vote | null> {
    try {
      for await (const [key, value] of this.db.iterator({
        gte: `vote:${voterAddress}:`,
        lte: `vote:${voterAddress}:\xFF`,
        reverse: true,
        limit: 1,
      })) {
        try {
          return JSON.parse(value);
        } catch (error) {
          if (error instanceof SyntaxError) {
            Logger.error("Invalid JSON in vote:", error);
            continue;
          }
          throw error;
        }
      }
      return null;
    } catch (error) {
      Logger.error("Failed to get latest vote:", error);
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
  async getVotesByVoter(voterAddress: string): Promise<Vote[]> {
    const votes: Vote[] = [];
    try {
      for await (const [key, value] of this.db.iterator({
        gte: `vote:${voterAddress}:`,
        lte: `vote:${voterAddress}:\xFF`,
      })) {
        votes.push(JSON.parse(value));
      }
      return votes;
    } catch (error) {
      Logger.error("Failed to get votes by voter:", error);
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
  async getTotalVotes(): Promise<number> {
    let count = 0;
    try {
      for await (const [key] of this.db.iterator({
        gte: "vote:",
        lte: "vote:\xFF",
      })) {
        count++;
      }
      return count;
    } catch (error) {
      Logger.error("Failed to get total votes:", error);
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
  async close(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await this.mutex.runExclusive(async () => {
        await this.db.close();
        this.cache.clear();
        this.isInitialized = false;
        Logger.info("Voting database closed successfully");
      });
    } catch (error) {
      Logger.error("Error closing voting database:", error);
      throw new VotingError("CLOSE_FAILED", "Failed to close database");
    }
  }

  async getVote(periodId: number, voterAddress: string): Promise<Vote | null> {
    const key = `vote:${periodId}:${voterAddress}`;
    try {
      const cached = this.cache.get(key) as Vote;
      if (cached) return cached;

      const value = await this.db.get(key);
      const vote = JSON.parse(value);
      this.cache.set(key, vote);
      return vote;
    } catch (error) {
      if (error.notFound) return null;
      if (error instanceof SyntaxError) {
        Logger.error("Invalid JSON in vote:", error);
        return null;
      }
      Logger.error("Failed to get vote:", error);
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
  async getVotesByPeriod(periodId: number): Promise<Vote[]> {
    const votes: Vote[] = [];
    try {
      for await (const [key, value] of this.db.iterator({
        gte: `vote:${periodId}:`,
        lte: `vote:${periodId}:\xFF`,
      })) {
        votes.push(JSON.parse(value));
      }
      return votes;
    } catch (error) {
      Logger.error("Failed to get votes by period:", error);
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
  async getTotalEligibleVoters(): Promise<number> {
    try {
      const voters = new Set<string>();
      for await (const [key, value] of this.db.iterator({
        gte: "voter:",
        lte: "voter:\xFF",
      })) {
        const voter = JSON.parse(value);
        if (voter.eligible) voters.add(voter.address);
      }
      return voters.size;
    } catch (error) {
      Logger.error("Failed to get total eligible voters:", error);
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
  async getVotesByAddress(address: string): Promise<Vote[]> {
    if (!this.isInitialized) throw new Error("Database not initialized");
    if (!address || typeof address !== "string") {
      throw new VotingError("INVALID_ADDRESS", "Invalid address format");
    }

    return await this.mutex.runExclusive(async () => {
      const votes: Vote[] = [];
      const processedKeys = new Set<string>();

      try {
        let batch: Vote[] = [];

        for await (const [key, value] of this.db.iterator({
          gte: `vote:${address}:`,
          lte: `vote:${address}:\xFF`,
          limit: this.BATCH_SIZE,
        })) {
          if (processedKeys.has(key)) continue;

          try {
            const vote = this.safeParse<Vote>(value);
            if (vote && this.validateVote(vote)) {
              batch.push(vote);
              processedKeys.add(key);
            }

            if (batch.length >= this.BATCH_SIZE) {
              votes.push(...batch);
              batch = [];
            }
          } catch (parseError) {
            Logger.error("Failed to parse vote:", parseError);
            continue;
          }
        }

        if (batch.length > 0) {
          votes.push(...batch);
        }

        return votes;
      } catch (error) {
        Logger.error("Failed to get votes by address:", error);
        throw new VotingError("RETRIEVAL_FAILED", "Failed to retrieve votes");
      }
    });
  }

  private validateVote(vote: Vote): boolean {
    return !!(
      vote &&
      vote.periodId &&
      vote.voterAddress &&
      typeof vote.approve === "boolean" &&
      typeof vote.votingPower === "bigint"
    );
  }

  private safeParse<T>(value: string): T | null {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      Logger.error("Failed to parse stored value:", error);
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
  @retry({ maxAttempts: 3, delay: 1000 })
  async storeVote(vote: Vote): Promise<void> {
    return await this.mutex.runExclusive(async () => {
      const key = `vote:${vote.periodId}:${vote.voteId}`;
      try {
        // Validate vote
        if (!vote?.voteId || !vote.periodId) {
          throw new VotingError("INVALID_VOTE", "Invalid vote format");
        }

        await this.db.put(key, JSON.stringify(vote));
        this.cache.set(key, vote);
      } catch (error) {
        Logger.error("Failed to store vote:", error);
        throw new VotingError("STORE_FAILED", "Failed to store vote", {
          voteId: vote.voteId,
        });
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
  @retry({ maxAttempts: 3, delay: 1000 })
  async updateVotingPeriod(period: VotingPeriod): Promise<void> {
    return await this.mutex.runExclusive(async () => {
      const key = `period:${period.periodId}`;
      try {
        // Check if period exists
        const exists = await this.db.get(key).catch(() => null);
        if (!exists) {
          throw new VotingError("NO_ACTIVE_PERIOD", "Voting period not found");
        }

        await this.db.put(key, JSON.stringify(period));
        this.cache.set(key, period);
      } catch (error) {
        Logger.error("Failed to update voting period:", error);
        throw error;
      }
    });
  }
}
