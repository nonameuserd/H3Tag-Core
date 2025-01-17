"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiningDatabase = void 0;
const level_1 = require("level");
const shared_1 = require("@h3tag-blockchain/shared");
const cache_1 = require("../scaling/cache");
const async_mutex_1 = require("async-mutex");
const retry_1 = require("../utils/retry");
const config_database_1 = require("./config.database");
class MiningDatabase {
    constructor(dbPath) {
        this.BATCH_SIZE = 1000;
        this.CACHE_TTL = 3600; // 1 hour
        this.MAX_RETRY_ATTEMPTS = 3;
        this.initialized = false;
        if (!dbPath)
            throw new Error('Database path is required');
        this.db = new level_1.Level(`${dbPath}/mining`, {
            valueEncoding: 'json',
            ...config_database_1.databaseConfig.options,
        });
        this.mutex = new async_mutex_1.Mutex();
        this.cache = new cache_1.Cache({
            ttl: this.CACHE_TTL,
            maxSize: 10000,
            compression: true,
            priorityLevels: { pow: 2, default: 1 }
        });
        this.initialize().catch(error => {
            shared_1.Logger.error('Failed to initialize mining database:', error);
            throw error;
        });
    }
    async initialize() {
        if (this.initialized)
            return; // Prevent re-initialization
        try {
            await this.db.open();
            this.initialized = true;
            shared_1.Logger.info('Mining database initialized successfully');
        }
        catch (error) {
            shared_1.Logger.error('Failed to initialize mining database:', error);
            throw error;
        }
    }
    async storePowSolution(solution) {
        if (!this.initialized)
            throw new Error('Database not initialized');
        return await this.mutex.runExclusive(async () => {
            const key = `pow:${solution.blockHash}:${solution.nonce}`;
            try {
                // Validate solution
                if (!this.validatePowSolution(solution)) {
                    throw new Error('Invalid PoW solution');
                }
                // Check for existing solution
                const existing = await this.getPowSolution(solution.blockHash, BigInt(solution.nonce));
                if (existing) {
                    throw new Error('PoW solution already exists');
                }
                // Store in batch for atomicity
                const batch = this.db.batch();
                // Store main record
                batch.put(key, JSON.stringify(solution));
                // Index by miner address with timestamp for ordering
                const minerKey = `miner:${solution.minerAddress}:${solution.timestamp}`;
                batch.put(minerKey, key);
                await batch.write();
                this.cache.set(key, solution, { ttl: this.CACHE_TTL });
                shared_1.Logger.debug('PoW solution stored successfully', {
                    blockHash: solution.blockHash,
                    miner: solution.minerAddress
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                shared_1.Logger.error('Failed to store PoW solution:', { error: errorMessage });
                throw new Error(`Failed to store PoW solution: ${errorMessage}`);
            }
        });
    }
    async storeMiningMetrics(metrics) {
        const key = `metrics:${metrics.blockHeight}`;
        try {
            // Validate metrics
            if (!this.validateMiningMetrics(metrics)) {
                throw new Error('Invalid mining metrics');
            }
            await this.db.put(key, JSON.stringify(metrics));
            this.cache.set(key, metrics);
            // Store time-series data for analytics
            const timeKey = `metrics:time:${metrics.timestamp}`;
            await this.db.put(timeKey, JSON.stringify(metrics.blockHeight));
            shared_1.Logger.debug('Mining metrics stored successfully', {
                blockHeight: metrics.blockHeight,
                hashRate: metrics.hashRate.toString()
            });
        }
        catch (error) {
            shared_1.Logger.error('Failed to store mining metrics:', error);
            throw error;
        }
    }
    async storeConsensusVote(vote) {
        return await this.mutex.runExclusive(async () => {
            const key = `vote:${vote.blockHash}:${vote.voterAddress}`;
            try {
                // Validate vote
                if (!this.validateConsensusVote(vote)) {
                    throw new Error('Invalid consensus vote');
                }
                const batch = this.db.batch();
                // Store main record
                batch.put(key, JSON.stringify(vote));
                // Index by timestamp for time-based queries
                batch.put(`vote:time:${vote.timestamp}`, key);
                await batch.write();
                this.cache.set(key, vote);
                shared_1.Logger.debug('Consensus vote stored successfully', {
                    blockHash: vote.blockHash,
                    voter: vote.voterAddress
                });
            }
            catch (error) {
                shared_1.Logger.error('Failed to store consensus vote:', error);
                throw error;
            }
        });
    }
    async storeConsensusPeriod(period) {
        const key = `period:${period.startHeight}`;
        try {
            // Validate period
            if (!this.validateConsensusPeriod(period)) {
                throw new Error('Invalid consensus period');
            }
            await this.db.put(key, JSON.stringify(period));
            this.cache.set(key, period);
            shared_1.Logger.debug('Consensus period stored successfully', {
                startHeight: period.startHeight,
                endHeight: period.endHeight
            });
        }
        catch (error) {
            shared_1.Logger.error('Failed to store consensus period:', error);
            throw error;
        }
    }
    // Retrieval methods
    async getPowSolution(blockHash, nonce) {
        if (!this.initialized)
            throw new Error('Database not initialized');
        const key = `pow:${blockHash}:${nonce}`;
        try {
            // Try cache first
            const cached = this.cache.get(key);
            if (cached) {
                // Refresh TTL on cache hit
                this.cache.set(key, cached, { ttl: this.CACHE_TTL });
                return cached;
            }
            const solution = await this.db.get(key);
            const parsed = this.safeParse(solution);
            if (!parsed)
                return null;
            // Cache with TTL
            this.cache.set(key, parsed, { ttl: this.CACHE_TTL });
            return parsed;
        }
        catch (error) {
            if (error.notFound)
                return null;
            shared_1.Logger.error('Failed to retrieve PoW solution:', error);
            throw new Error('Failed to retrieve PoW solution');
        }
    }
    async getMiningMetrics(blockHeight) {
        const key = `metrics:${blockHeight}`;
        try {
            const cached = this.cache.get(key);
            if (cached)
                return cached;
            const metrics = await this.db.get(key);
            this.cache.set(key, JSON.parse(metrics));
            return JSON.parse(metrics);
        }
        catch (error) {
            if (error.notFound)
                return null;
            shared_1.Logger.error('Failed to retrieve mining metrics:', error);
            throw error;
        }
    }
    async getConsensusVote(blockHash, voterAddress) {
        const key = `consensus_vote:${blockHash}:${voterAddress}`;
        try {
            const cached = this.cache.get(key);
            if (cached)
                return cached;
            const vote = await this.db.get(key);
            this.cache.set(key, JSON.parse(vote));
            return JSON.parse(vote);
        }
        catch (error) {
            if (error.notFound)
                return null;
            shared_1.Logger.error('Failed to retrieve consensus vote:', error);
            throw error;
        }
    }
    async getConsensusPeriod(startHeight) {
        const key = `period:${startHeight}`;
        try {
            const cached = this.cache.get(key);
            if (cached)
                return cached;
            const period = await this.db.get(key);
            this.cache.set(key, JSON.parse(period));
            return JSON.parse(period);
        }
        catch (error) {
            if (error.notFound)
                return null;
            shared_1.Logger.error('Failed to retrieve consensus period:', error);
            throw error;
        }
    }
    // Query methods
    async getMinerSolutions(minerAddress, limit = 100) {
        const solutions = [];
        try {
            for await (const [key, value] of this.db.iterator({
                gte: `miner:${minerAddress}:`,
                lte: `miner:${minerAddress}:\xFF`,
                limit
            })) {
                solutions.push(JSON.parse(value));
            }
            return solutions;
        }
        catch (error) {
            shared_1.Logger.error('Failed to retrieve miner solutions:', error);
            throw error;
        }
    }
    async getMetricsInRange(startTime, endTime) {
        const metrics = [];
        try {
            for await (const [key, value] of this.db.iterator({
                gte: `metrics:time:${startTime}`,
                lte: `metrics:time:${endTime}`
            })) {
                try {
                    metrics.push(JSON.parse(value));
                }
                catch (error) {
                    if (error instanceof SyntaxError) {
                        shared_1.Logger.error('Invalid JSON in metrics:', error);
                        continue;
                    }
                    throw error;
                }
            }
            return metrics;
        }
        catch (error) {
            shared_1.Logger.error('Failed to retrieve metrics range:', error);
            throw error;
        }
    }
    // Validation methods
    validatePowSolution(solution) {
        return !!(solution.blockHash &&
            solution.nonce &&
            solution.minerAddress &&
            solution.timestamp &&
            solution.signature);
    }
    validateMiningMetrics(metrics) {
        return !!(metrics.blockHeight >= 0 &&
            metrics.hashRate >= BigInt(0) &&
            metrics.difficulty >= 0 &&
            metrics.timestamp);
    }
    validateConsensusVote(vote) {
        return !!(vote.blockHash &&
            vote.voterAddress &&
            vote.voteType &&
            vote.timestamp &&
            vote.signature);
    }
    validateConsensusPeriod(period) {
        return !!(period.startHeight >= 0 &&
            period.endHeight > period.startHeight &&
            period.startTime &&
            period.endTime > period.startTime);
    }
    // Cleanup method
    async dispose() {
        try {
            await this.db.close();
            this.cache.clear(true);
            this.initialized = false;
        }
        catch (error) {
            shared_1.Logger.error('Error during mining database disposal:', error);
            throw new Error('Failed to dispose mining database');
        }
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
}
__decorate([
    (0, retry_1.retry)({ maxAttempts: 3, delay: 1000 })
], MiningDatabase.prototype, "storePowSolution", null);
__decorate([
    (0, retry_1.retry)({ maxAttempts: 3, delay: 1000 })
], MiningDatabase.prototype, "storeMiningMetrics", null);
__decorate([
    (0, retry_1.retry)({ maxAttempts: 3, delay: 1000 })
], MiningDatabase.prototype, "storeConsensusVote", null);
__decorate([
    (0, retry_1.retry)({ maxAttempts: 3, delay: 1000 })
], MiningDatabase.prototype, "storeConsensusPeriod", null);
exports.MiningDatabase = MiningDatabase;
//# sourceMappingURL=mining-schema.js.map