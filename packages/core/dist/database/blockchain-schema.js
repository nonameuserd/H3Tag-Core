"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainSchema = void 0;
const level_1 = require("level");
const shared_1 = require("@h3tag-blockchain/shared");
const retry_1 = require("../utils/retry");
const async_mutex_1 = require("async-mutex");
const cache_1 = require("../scaling/cache");
const config_database_1 = require("./config.database");
const constants_1 = require("../blockchain/utils/constants");
const crypto_1 = require("crypto");
const performance_monitor_1 = require("../monitoring/performance-monitor");
const audit_1 = require("../security/audit");
const zlib_1 = require("zlib");
const util_1 = require("util");
class BlockchainSchema {
    /**
     * Constructor for Database
     * @param dbPath Path to the database
     */
    constructor(dbPath = "./data/blockchain") {
        this.transactionCache = new cache_1.Cache();
        this.blockCache = new cache_1.Cache();
        this.validatorMetricsCache = new cache_1.Cache({
            ttl: 300000,
            maxSize: 1000,
        });
        this.votingPowerCache = new cache_1.Cache({
            ttl: 300000,
            maxSize: 1000,
        });
        this.slashingHistoryCache = new cache_1.Cache({
            ttl: 300000, // 5 minutes
            maxSize: 1000,
        });
        this.shardMutex = new async_mutex_1.Mutex();
        this.performanceMonitor = new performance_monitor_1.PerformanceMonitor("database");
        this.SHARD_VERSION = 1;
        this.abstractTransaction = null;
        this.transaction = null;
        this.transactionOperations = [];
        this.heightCache = new cache_1.Cache();
        this.transactionLock = new async_mutex_1.Mutex();
        this.transactionLocks = new Map();
        this.dbPath = dbPath;
        this.db = new level_1.Level(dbPath, {
            valueEncoding: "json",
            ...config_database_1.databaseConfig.options,
        });
        this.mutex = new async_mutex_1.Mutex();
        this.cache = new cache_1.Cache({
            ttl: 3600,
            maxSize: 10000,
            compression: true,
            priorityLevels: { pow: 2, default: 1 },
            onEvict: (key, value) => {
                // Cleanup evicted items
                if (value && typeof value === "object" && "hash" in value) {
                    this.db
                        .put(`block:${key}`, JSON.stringify(value))
                        .catch((e) => shared_1.Logger.error("Failed to persist evicted block:", e));
                }
            },
        });
    }
    /**
     * Get the database path
     * @returns string Database path
     */
    getPath() {
        return this.dbPath;
    }
    /**
     * Create a new voting period
     * @param startBlock Start block number
     * @param endBlock End block number
     * @returns Promise<number> New voting period ID
     */
    async createVotingPeriod(startBlock, endBlock) {
        try {
            const periodId = Date.now();
            await this.db.put(`voting_period:${periodId}`, JSON.stringify({
                startBlock,
                endBlock,
                totalEligibleVoters: await this.getUniqueAddressesWithBalance(),
                minimumParticipation: 0.1,
                status: "active",
                createdAt: Date.now(),
            }));
            return periodId;
        }
        catch (error) {
            shared_1.Logger.error("Failed to create voting period:", error);
            throw error;
        }
    }
    /**
     * Record a vote
     * @param vote Vote to record
     * @param periodId Voting period ID
     * @returns Promise<boolean> True if vote was recorded successfully
     */
    async recordVote(vote, periodId) {
        return await this.mutex.runExclusive(async () => {
            const batch = this.db.batch();
            try {
                // Check for existing vote
                const existingVote = await this.db
                    .get(`vote:${periodId}:${vote.voter}`)
                    .catch((e) => null);
                if (existingVote) {
                    throw new Error("Voter has already voted in this period");
                }
                // Validate vote credentials
                if (!vote.signature) {
                    throw new Error("Invalid vote: missing signature");
                }
                const voteId = `${periodId}:${vote.voter}`;
                // Record vote
                batch.put(`vote:${voteId}`, JSON.stringify({
                    ...vote,
                    timestamp: Date.now(),
                    version: "1.0",
                }));
                // Record vote incentive
                const period = JSON.parse(await this.db.get(`voting_period:${periodId}`));
                const reward = period.status === "active" ? 100 : 50;
                batch.put(`vote_incentive:${voteId}`, JSON.stringify({
                    reward,
                    timestamp: Date.now(),
                    processed: false,
                }));
                await batch.write();
                return true;
            }
            catch (error) {
                shared_1.Logger.error("Failed to record vote:", error);
                return false;
            }
        });
    }
    /**
     * Get UTXOs by address
     * @param address Address to get UTXOs for
     * @returns Promise<Array<{ txid: string; vout: number; amount: number; confirmations: number; }>> UTXOs for the address
     */
    async getUtxosByAddress(address) {
        const utxos = [];
        const currentHeight = await this.getCurrentHeight();
        try {
            for await (const [key, rawValue] of this.db.iterator({
                gte: `utxo:${address}:`,
                lte: `utxo:${address}:\xFF`,
            })) {
                try {
                    const value = JSON.parse(rawValue);
                    if (this.isValidUtxo(value) && !value.spent) {
                        utxos.push({
                            ...value,
                            confirmations: Math.max(0, currentHeight - value.blockHeight + 1),
                        });
                    }
                }
                catch (parseError) {
                    shared_1.Logger.error(`Invalid UTXO data for ${key}:`, parseError);
                    continue;
                }
            }
            return utxos;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get UTXOs:", error);
            throw error;
        }
    }
    isValidUtxo(utxo) {
        return (utxo &&
            typeof utxo.txid === "string" &&
            typeof utxo.vout === "number" &&
            typeof utxo.amount === "number" &&
            typeof utxo.blockHeight === "number" &&
            typeof utxo.address === "string");
    }
    /**
     * Get the current block height
     * @returns Promise<number> Current block height
     */
    async getCurrentHeight() {
        try {
            const height = await this.db.get("current_height");
            const parsedHeight = parseInt(height);
            if (isNaN(parsedHeight))
                throw new Error("Invalid height value");
            return parsedHeight;
        }
        catch (error) {
            if (error.notFound)
                return 0;
            throw error;
        }
    }
    /**
     * Get the number of unique addresses with balance
     * @returns Promise<number> Number of unique addresses with balance
     */
    async getUniqueAddressesWithBalance() {
        const addresses = new Set();
        try {
            for await (const [key, rawValue] of this.db.iterator({
                gte: "utxo:",
                lte: "utxo:\xFF",
            })) {
                const value = JSON.parse(rawValue);
                if (!value.spent) {
                    addresses.add(value.address);
                }
            }
            return addresses.size;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get unique addresses:", error);
            throw error;
        }
    }
    /**
     * Get the total supply of the blockchain
     * @returns Promise<bigint> Total supply
     */
    async getTotalSupply() {
        try {
            let totalSupply = BigInt(0);
            // Sum all unspent UTXOs
            for await (const [key, rawValue] of this.db.iterator({
                gte: "utxo:",
                lte: "utxo:\xFF",
            })) {
                const utxo = JSON.parse(rawValue);
                if (!utxo.spent) {
                    totalSupply += BigInt(utxo.amount);
                }
            }
            return totalSupply;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get total supply:", error);
            throw new Error(`Database error: Failed to get total supply - ${error.message}`);
        }
    }
    /**
     * Compact the database
     * @returns Promise<void>
     */
    async compact() {
        const batch = this.db.batch();
        const now = Date.now();
        const TWO_MONTHS = 60 * 60 * 1000 * 24 * 60;
        const currentHeight = await this.getCurrentHeight();
        try {
            shared_1.Logger.info("Starting database compaction...");
            let processedCount = 0;
            for await (const [key, value] of this.db.iterator()) {
                const shouldDelete = await this.shouldDelete(key, JSON.parse(value), {
                    now,
                    TWO_MONTHS,
                    currentHeight,
                });
                if (shouldDelete) {
                    batch.del(key);
                    processedCount++;
                }
                // Log progress every 10000 entries
                if (processedCount % 10000 === 0) {
                    shared_1.Logger.info(`Compaction progress: ${processedCount} entries processed`);
                }
            }
            await batch.write();
            shared_1.Logger.info(`Database compaction completed. Removed ${processedCount} entries.`);
        }
        catch (error) {
            shared_1.Logger.error("Database compaction failed:", error);
            throw error;
        }
    }
    /**
     * Determine if a key should be deleted
     * @param key Key to check
     * @param value Value of the key
     * @param context Context object
     * @returns Promise<boolean> True if the key should be deleted
     */
    async shouldDelete(key, value, context) {
        // Delete old processed votes
        if (key.startsWith("vote:") && value.processed) {
            return context.now - value.timestamp > context.TWO_MONTHS;
        }
        // Delete old transactions from inactive shards
        if (key.startsWith("shard:") && value.deleted) {
            return context.now - value.deletedAt > context.TWO_MONTHS;
        }
        // Delete old voting periods
        if (key.startsWith("voting_period:")) {
            return value.endBlock < context.currentHeight - 10000;
        }
        // Keep all UTXO records for audit purposes
        if (key.startsWith("utxo:")) {
            return false;
        }
        return false;
    }
    /**
     * Close the database connection
     * @returns Promise<void>
     */
    async close() {
        try {
            shared_1.Logger.info("Closing database connection...");
            await this.db.close();
            shared_1.Logger.info("Database connection closed successfully");
        }
        catch (error) {
            shared_1.Logger.error("Failed to close database:", error);
            throw error;
        }
    }
    /**
     * Backup the database
     * @param path Path to backup to
     * @returns Promise<void>
     */
    async backup(path) {
        const fs = require("fs").promises;
        const crypto = require("crypto");
        try {
            shared_1.Logger.info(`Starting database backup to ${path}`);
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const backupPath = `${path}/backup-${timestamp}`;
            // Create backup directory
            await fs.mkdir(backupPath, { recursive: true });
            // Stream all data to backup files
            const batchSize = 10000;
            let batch = [];
            let fileCounter = 0;
            for await (const [key, value] of this.db.iterator()) {
                batch.push({ key, value });
                if (batch.length >= batchSize) {
                    const fileName = `${backupPath}/batch-${fileCounter}.json`;
                    const hash = crypto.createHash("sha256");
                    const data = JSON.stringify(batch);
                    hash.update(data);
                    await fs.writeFile(fileName, data);
                    await fs.writeFile(`${fileName}.sha256`, hash.digest("hex"));
                    batch = [];
                    fileCounter++;
                    shared_1.Logger.info(`Backup progress: ${fileCounter * batchSize} entries written`);
                }
            }
            // Write remaining entries
            if (batch.length > 0) {
                const fileName = `${backupPath}/batch-${fileCounter}.json`;
                const hash = crypto.createHash("sha256");
                const data = JSON.stringify(batch);
                hash.update(data);
                await fs.writeFile(fileName, data);
                await fs.writeFile(`${fileName}.sha256`, hash.digest("hex"));
            }
            // Write backup metadata
            await fs.writeFile(`${backupPath}/metadata.json`, JSON.stringify({
                timestamp: Date.now(),
                totalFiles: fileCounter + 1,
                totalEntries: fileCounter * batchSize + batch.length,
                version: "1.0",
            }));
            shared_1.Logger.info(`Database backup completed successfully at ${backupPath}`);
        }
        catch (error) {
            shared_1.Logger.error("Database backup failed:", error);
            throw error;
        }
    }
    /**
     * Find data in the database
     * @param query Query object
     * @returns Promise<any[]> Found data
     */
    async find(query) {
        const results = [];
        try {
            for await (const [key, value] of this.db.iterator()) {
                try {
                    const data = JSON.parse(value);
                    if (this.matchesQuery(data, query)) {
                        results.push(data);
                    }
                }
                catch (parseError) {
                    shared_1.Logger.error(`Failed to parse value for key ${key}:`, parseError);
                    continue;
                }
            }
            return results;
        }
        catch (error) {
            shared_1.Logger.error("Database find failed:", error);
            throw error;
        }
    }
    matchesQuery(data, query) {
        return Object.entries(query).every(([k, v]) => {
            const path = k.split(".");
            let current = data;
            for (const key of path) {
                if (current === undefined || current === null)
                    return false;
                current = current[key];
            }
            return current === v;
        });
    }
    /**
     * Get a value from the database
     * @param key Key to get
     * @returns Promise<string> Value
     */
    async get(key) {
        try {
            return await this.db.get(key);
        }
        catch (error) {
            shared_1.Logger.error("Database get failed:", error);
            throw error;
        }
    }
    /**
     * Query the database
     * @param sql SQL query
     * @param params Parameters for the query
     * @returns Promise<any> Query results
     */
    async query(sql, params = []) {
        try {
            // For LevelDB, we'll simulate basic SQL-like queries
            const results = [];
            for await (const [key, value] of this.db.iterator()) {
                const data = JSON.parse(value);
                // Simple filtering based on the first parameter
                if (params[0] && key.includes(params[0].toString())) {
                    results.push(data);
                }
            }
            return { rows: results };
        }
        catch (error) {
            shared_1.Logger.error("Database query failed:", error);
            throw error;
        }
    }
    /**
     * Get a range of blocks from the database
     * @param startHeight Start block height
     * @param endHeight End block height
     * @returns Promise<Block[]> Blocks in the range
     */
    async getBlockRange(startHeight, endHeight) {
        const BATCH_SIZE = 100;
        const blocks = [];
        try {
            for (let height = startHeight; height <= endHeight; height += BATCH_SIZE) {
                const batchEnd = Math.min(height + BATCH_SIZE - 1, endHeight);
                // Use iterator for efficient range queries
                for await (const [key, value] of this.db.iterator({
                    gte: `block:${height}`,
                    lte: `block:${batchEnd}`,
                    valueEncoding: "json",
                })) {
                    const block = JSON.parse(value);
                    blocks.push(block);
                    // Cache blocks for future queries using batch
                    const batch = this.db.batch();
                    batch.put(`block:${block.header.height}`, JSON.stringify(block));
                    await batch.write();
                }
            }
            return blocks;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get block range:", error);
            throw error;
        }
    }
    /**
     * Get the token holders
     * @returns Promise<Array<{ address: string; balance: bigint }>> Token holders
     */
    async getTokenHolders() {
        const holders = new Map();
        try {
            for await (const [key, rawValue] of this.db.iterator({
                gte: "utxo:",
                lte: "utxo:\xFF",
            })) {
                const utxo = JSON.parse(rawValue);
                if (!utxo.spent) {
                    const current = holders.get(utxo.address) || BigInt(0);
                    holders.set(utxo.address, current + BigInt(utxo.amount));
                }
            }
            return Array.from(holders.entries()).map(([address, balance]) => ({
                address,
                balance,
            }));
        }
        catch (error) {
            shared_1.Logger.error("Failed to get token holders:", error);
            throw error;
        }
    }
    /**
     * Get the token balance for an address
     * @param address Address to get balance for
     * @returns Promise<{ balance: bigint; holdingPeriod: number }> Token balance and holding period
     */
    async getTokenBalance(address) {
        const cacheKey = `token_balance:${address}`;
        try {
            const cached = this.cache.get(cacheKey);
            if (cached &&
                typeof cached.balance === "bigint" &&
                typeof cached.holdingPeriod === "number") {
                return cached;
            }
            let balance = BigInt(0);
            let earliestUtxo = Date.now();
            for await (const [key, rawValue] of this.db.iterator({
                gte: `utxo:${address}:`,
                lte: `utxo:${address}:\xFF`,
            })) {
                try {
                    const utxo = JSON.parse(rawValue);
                    if (!utxo.spent) {
                        balance += BigInt(utxo.amount);
                        earliestUtxo = Math.min(earliestUtxo, utxo.blockHeight);
                    }
                }
                catch (parseError) {
                    shared_1.Logger.error(`Invalid UTXO data for ${key}:`, parseError);
                    continue;
                }
            }
            const result = {
                balance,
                holdingPeriod: Date.now() - earliestUtxo,
            };
            this.cache.set(cacheKey, result, { ttl: 300 });
            return result;
        }
        catch (error) {
            shared_1.Logger.error(`Failed to get token balance for ${address}:`, error);
            throw error;
        }
    }
    /**
     * Remove a delegation
     * @param delegator Delegator to remove
     * @returns Promise<void>
     */
    async removeDelegation(delegator) {
        const key = `delegation:${delegator}`;
        try {
            const batch = this.db.batch();
            batch.del(key);
            batch.del(`delegator_index:${delegator}`);
            await batch.write();
            this.cache.delete(key);
        }
        catch (error) {
            shared_1.Logger.error(`Failed to remove delegation for ${delegator}:`, error);
            throw new Error(`Database error: Failed to remove delegation - ${error.message}`);
        }
    }
    /**
     * Get an auditor's signature for a vote
     * @param auditorId Auditor ID
     * @param voteId Vote ID
     * @returns Promise<string> Auditor's signature
     */
    async getAuditorSignature(auditorId, voteId) {
        const key = `auditor_signature:${auditorId}:${voteId}`;
        try {
            // Check cache first
            const cached = this.cache.get(key);
            if (cached)
                return cached.signature;
            const data = await this.db.get(key);
            const result = JSON.parse(data);
            // Cache the result
            this.cache.set(key, result);
            return result.signature;
        }
        catch (error) {
            if (error.notFound)
                return "";
            shared_1.Logger.error(`Failed to get auditor signature for ${auditorId}:${voteId}:`, error);
            throw new Error(`Database error: Failed to get auditor signature - ${error.message}`);
        }
    }
    /**
     * Calculate the Gini coefficient for token distribution
     * @returns Promise<number> Gini coefficient
     */
    async calculateTokenDistributionGini() {
        try {
            const holders = await this.getTokenHolders();
            if (holders.length === 0)
                return 0;
            const balances = holders.map((h) => Number(h.balance));
            const mean = balances.reduce((a, b) => a + b, 0) / balances.length;
            let sumOfAbsoluteDifferences = 0;
            for (let i = 0; i < balances.length; i++) {
                for (let j = 0; j < balances.length; j++) {
                    sumOfAbsoluteDifferences += Math.abs(balances[i] - balances[j]);
                }
            }
            return (sumOfAbsoluteDifferences /
                (2 * balances.length * balances.length * mean));
        }
        catch (error) {
            shared_1.Logger.error("Failed to calculate Gini coefficient:", error);
            throw error;
        }
    }
    /**
     * Get the latest vote for a voter
     * @param voterAddress Voter address
     * @returns Promise<Vote | null> Latest vote or null if not found
     */
    async getLatestVote(voterAddress) {
        try {
            const votes = this.db.iterator({
                gte: `vote:${voterAddress}:`,
                lte: `vote:${voterAddress}:\xFF`,
                reverse: true,
                limit: 1,
            });
            for await (const [key, value] of votes) {
                return JSON.parse(value);
            }
            return null;
        }
        catch (error) {
            shared_1.Logger.error(`Failed to get latest vote for ${voterAddress}:`, error);
            return null;
        }
    }
    /**
     * Get blocks by miner
     * @param minerAddress Miner address
     * @returns Promise<Block[]> Blocks by miner
     */
    async getBlocksByMiner(minerAddress) {
        try {
            const blocks = [];
            const iterator = this.db.iterator({
                gte: `block:miner:${minerAddress}:`,
                lte: `block:miner:${minerAddress}:\xFF`,
            });
            for await (const [key, value] of iterator) {
                blocks.push(JSON.parse(value));
            }
            return blocks;
        }
        catch (error) {
            shared_1.Logger.error(`Failed to get blocks for miner ${minerAddress}:`, error);
            return [];
        }
    }
    /**
     * Get votes by voter
     * @param voterAddress Voter address
     * @returns Promise<Vote[]> Votes by voter
     */
    async getVotesByVoter(voterAddress) {
        try {
            const votes = [];
            const iterator = this.db.iterator({
                gte: `vote:${voterAddress}:`,
                lte: `vote:${voterAddress}:\xFF`,
                limit: 10000,
            });
            for await (const [key, value] of iterator) {
                votes.push(JSON.parse(value));
            }
            return votes;
        }
        catch (error) {
            shared_1.Logger.error(`Failed to get votes for voter ${voterAddress}:`, error);
            return [];
        }
    }
    /**
     * Get the total number of votes
     * @returns Promise<number> Total number of votes
     */
    async getTotalVotes() {
        try {
            let count = 0;
            const iterator = this.db.iterator({ gte: "vote:", lte: "vote:\xFF" });
            for await (const [key] of iterator) {
                count++;
            }
            return count;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get total votes count:", error);
            return 0;
        }
    }
    /**
     * Put a value in the database
     * @param key Key to put
     * @param value Value to put
     * @returns Promise<void>
     */
    async put(key, value) {
        try {
            await this.db.put(key, value);
        }
        catch (error) {
            shared_1.Logger.error("Failed to put value in database:", error);
            throw error;
        }
    }
    /**
     * Get a transaction by its hash
     * @param hash Transaction hash
     * @returns Promise<Transaction | undefined> Transaction or undefined if not found
     */
    async getTransaction(hash) {
        try {
            const key = `transactions:${hash}`;
            const cached = this.transactionCache.get(key);
            if (cached)
                return cached;
            const data = await this.db.get(key);
            const transaction = JSON.parse(data);
            // Cache the result
            this.transactionCache.set(key, transaction);
            return transaction;
        }
        catch (error) {
            if (error.notFound)
                return undefined;
            shared_1.Logger.error(`Failed to get transaction ${hash}:`, error);
            throw new Error(`Database error: Failed to get transaction - ${error.message}`);
        }
    }
    /**
     * Save a transaction to the database
     * @param transaction Transaction to save
     * @returns Promise<void>
     */
    async saveTransaction(transaction) {
        const key = `transactions:${transaction.hash}`;
        const batch = this.db.batch();
        try {
            // Validate transaction before saving
            if (!this.isValidTransaction(transaction)) {
                throw new Error("Invalid transaction data");
            }
            batch.put(key, JSON.stringify(transaction));
            batch.put(`tx_type:${transaction.type}:${transaction.hash}`, transaction.hash);
            await batch.write();
            this.transactionCache.set(key, transaction);
        }
        catch (error) {
            shared_1.Logger.error(`Failed to save transaction ${transaction.hash}:`, error);
            throw new Error(`Database error: Failed to save transaction - ${error.message}`);
        }
    }
    isValidTransaction(tx) {
        return (tx &&
            typeof tx.hash === "string" &&
            tx.hash.length > 0 &&
            typeof tx.type === "string" &&
            Array.isArray(tx.inputs) &&
            Array.isArray(tx.outputs));
    }
    /**
     * Delete a transaction by its hash
     * @param hash Transaction hash
     * @returns Promise<void>
     */
    async deleteTransaction(hash) {
        try {
            const key = `transactions:${hash}`;
            const tx = await this.getTransaction(hash);
            if (tx) {
                const batch = this.db.batch();
                batch.del(key);
                batch.del(`tx_type:${tx.type}:${hash}`);
                await batch.write();
                this.cache.delete(key);
            }
        }
        catch (error) {
            shared_1.Logger.error(`Failed to delete transaction ${hash}:`, error);
            throw new Error(`Database error: Failed to delete transaction - ${error.message}`);
        }
    }
    /**
     * Get transactions by type
     * @param type Transaction type (optional)
     * @returns Promise<Transaction[]> Transactions
     */
    async getTransactions(type) {
        try {
            const transactions = [];
            const prefix = type ? `tx_type:${type}:` : "transactions:";
            for await (const [key, value] of this.db.iterator({
                gte: prefix,
                lte: prefix + "\xFF",
            })) {
                const hash = type ? value : key.split(":")[1];
                const tx = await this.getTransaction(hash);
                if (tx)
                    transactions.push(tx);
            }
            return transactions;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get transactions:", error);
            throw new Error(`Database error: Failed to get transactions - ${error.message}`);
        }
    }
    /**
     * Get the balance for an address
     * @param address Address to get balance for
     * @returns Promise<bigint> Balance
     */
    async getBalance(address) {
        try {
            let balance = BigInt(0);
            // Sum all unspent UTXOs for the address
            for await (const [key, rawValue] of this.db.iterator({
                gte: `utxo:${address}:`,
                lte: `utxo:${address}:\xFF`,
            })) {
                const utxo = JSON.parse(rawValue);
                if (!utxo.spent) {
                    balance += BigInt(utxo.amount);
                }
            }
            return balance;
        }
        catch (error) {
            shared_1.Logger.error(`Failed to get balance for ${address}:`, error);
            throw new Error(`Database error: Failed to get balance - ${error.message}`);
        }
    }
    /**
     * Get the voting schema
     * @returns IVotingSchema Voting schema
     */
    getVotingSchema() {
        return this.votingDb;
    }
    /**
     * Get votes by period
     * @param periodId Voting period ID
     * @returns Promise<Vote[]> Votes by period
     */
    async getVotesByPeriod(periodId) {
        const votes = [];
        try {
            for await (const [key, value] of this.db.iterator({
                gte: `vote:${periodId}:`,
                lte: `vote:${periodId}:\xFF`,
            })) {
                votes.push(JSON.parse(value));
            }
            return votes;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get votes by period:", error);
            return [];
        }
    }
    /**
     * Get a block by its height
     * @param height Block height
     * @returns Promise<Block | null> Block or null if not found
     */
    async getBlockByHeight(height) {
        try {
            const key = `block:height:${height}`;
            const cached = this.blockCache.get(key);
            if (cached)
                return cached;
            const value = await this.db.get(key);
            const block = JSON.parse(value);
            this.blockCache.set(key, block);
            return block;
        }
        catch (error) {
            if (error.notFound)
                return null;
            shared_1.Logger.error("Failed to get block by height:", error);
            return null;
        }
    }
    /**
     * Get the total number of eligible voters
     * @returns Promise<number> Total number of eligible voters
     */
    async getTotalEligibleVoters() {
        try {
            const voters = new Set();
            for await (const [key, value] of this.db.iterator({
                gte: "voter:",
                lte: "voter:\xFF",
            })) {
                const voter = JSON.parse(value);
                if (voter.eligible)
                    voters.add(voter.address);
            }
            return voters.size;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get total eligible voters:", error);
            return 0;
        }
    }
    /**
     * Ping the database
     * @returns Promise<boolean> True if the database is accessible
     */
    async ping() {
        const startTime = Date.now();
        try {
            // Try multiple health check queries in parallel
            const results = await Promise.all([
                this.db.get("current_height").catch((e) => ({ error: e })),
                this.db.get("last_block").catch((e) => ({ error: e })),
                this.db.get("network_status").catch((e) => ({ error: e })),
            ]);
            // Check responses with proper type guard
            const isAccessible = results.some((result) => typeof result === "string" ||
                ("error" in result && result.error.notFound));
            const latency = Date.now() - startTime;
            shared_1.Logger.debug("Database ping latency:", { latency, isAccessible });
            this.emitMetric("db_ping_latency", latency);
            return isAccessible;
        }
        catch (error) {
            shared_1.Logger.error("Database ping failed:", error);
            this.emitMetric("db_ping_failure", 1);
            return false;
        }
    }
    /**
     * Emit a metric
     * @param name Metric name
     * @param value Metric value
     */
    emitMetric(name, value) {
        this.eventEmitter.emit("metric", {
            name,
            value,
            timestamp: Date.now(),
            component: "database",
        });
    }
    /**
     * Verify a signature
     * @param address Address to verify
     * @param message Message to verify
     * @param signature Signature to verify
     * @returns Promise<boolean> True if the signature is valid
     */
    async verifySignature(address, message, signature) {
        try {
            const key = `signature:${address}:${message}`;
            const storedSignature = await this.db.get(key);
            return storedSignature === signature;
        }
        catch (error) {
            if (error.notFound)
                return false;
            shared_1.Logger.error("Signature verification failed:", error);
            return false;
        }
    }
    /**
     * Get the chain state
     * @returns Promise<ChainState | null> Chain state or null if not found
     */
    async getChainState() {
        try {
            const state = await this.db.get("chain_state");
            return JSON.parse(state);
        }
        catch (error) {
            if (error.notFound)
                return null;
            throw error;
        }
    }
    /**
     * Update the chain state
     * @param state Chain state
     * @returns Promise<void>
     */
    async updateChainState(state) {
        await this.db.put("chain_state", JSON.stringify(state));
    }
    /**
     * Get blocks from a specific height
     * @param startHeight Start block height
     * @param endHeight End block height
     * @returns Promise<Block[]> Blocks in the range
     */
    async getBlocksFromHeight(startHeight, endHeight) {
        try {
            const blocks = [];
            for (let height = startHeight; height <= endHeight; height++) {
                const block = await this.getBlockByHeight(height);
                if (block)
                    blocks.push(block);
            }
            return blocks;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get blocks from height:", error);
            return [];
        }
    }
    /**
     * Save a block to the database
     * @param block Block to save
     * @returns Promise<void>
     */
    async saveBlock(block) {
        try {
            const batch = this.db.batch();
            batch.put(`block:height:${block.header.height}`, JSON.stringify(block));
            batch.put(`block:hash:${block.hash}`, JSON.stringify(block));
            await batch.write();
            this.blockCache.set(block.hash, block);
        }
        catch (error) {
            shared_1.Logger.error("Failed to save block:", error);
            throw error;
        }
    }
    /**
     * Get a block by its hash
     * @param hash Block hash
     * @returns Promise<Block | null> Block or null if not found
     */
    async getBlock(hash) {
        try {
            const key = `block:hash:${hash}`;
            const value = await this.db.get(key);
            return value ? JSON.parse(value) : null;
        }
        catch (error) {
            if (error.notFound)
                return null;
            shared_1.Logger.error("Failed to get block by hash:", error);
            return null;
        }
    }
    /**
     * Get validators
     * @returns Promise<Validator[]> Validators
     */
    async getValidators() {
        try {
            const validators = [];
            for await (const [key, value] of this.db.iterator({
                gte: "validator:",
                lte: "validator:\xFF",
            })) {
                const validator = JSON.parse(value);
                const address = validator.address;
                // Get validator metrics
                const [uptime, voteParticipation, blockProduction, slashingHistory] = await Promise.all([
                    this.getValidatorUptime(address),
                    this.getVoteParticipation(address),
                    this.getBlockProduction(address),
                    this.getSlashingHistory(address),
                ]);
                // Validator selection criteria
                if (validator.isActive &&
                    uptime >= constants_1.BLOCKCHAIN_CONSTANTS.VALIDATOR.MIN_VALIDATOR_UPTIME &&
                    voteParticipation >=
                        constants_1.BLOCKCHAIN_CONSTANTS.VALIDATOR.MIN_VOTE_PARTICIPATION &&
                    blockProduction >=
                        constants_1.BLOCKCHAIN_CONSTANTS.VALIDATOR.MIN_BLOCK_PRODUCTION &&
                    slashingHistory.length === 0 // No slashing history
                ) {
                    validators.push({
                        ...validator,
                        metrics: {
                            uptime,
                            voteParticipation,
                            blockProduction,
                        },
                    });
                }
            }
            // Sort by voting participation and block production
            return validators.sort((a, b) => b.metrics.voteParticipation - a.metrics.voteParticipation ||
                b.metrics.blockProduction - a.metrics.blockProduction);
        }
        catch (error) {
            shared_1.Logger.error("Failed to get validators:", error);
            return [];
        }
    }
    /**
     * Update a validator's reputation
     * @param address Validator address
     * @param update Reputation update
     * @returns Promise<void>
     */
    async updateValidatorReputation(address, update) {
        try {
            const key = `validator:${address}`;
            const validator = JSON.parse(await this.db.get(key));
            validator.reputation = update.reputation;
            validator.reputationHistory = validator.reputationHistory || [];
            validator.reputationHistory.push({
                timestamp: update.lastUpdate,
                change: update.change,
                reason: update.reason,
                newValue: update.reputation,
            });
            await this.db.put(key, JSON.stringify(validator));
        }
        catch (error) {
            shared_1.Logger.error("Failed to update validator reputation:", error);
            throw error;
        }
    }
    /**
     * Get a validator's uptime
     * @param address Validator address
     * @returns Promise<number> Uptime
     */
    async getValidatorUptime(address) {
        try {
            const cacheKey = `validator_uptime:${address}`;
            const cached = this.validatorMetricsCache.get(cacheKey);
            if (cached !== undefined)
                return cached;
            const now = Date.now();
            const ONE_DAY = 24 * 60 * 60 * 1000;
            let totalChecks = 0;
            let successfulChecks = 0;
            // Get heartbeat records for last 30 days
            for await (const [key, value] of this.db.iterator({
                gte: `validator_heartbeat:${address}:${now - 30 * ONE_DAY}`,
                lte: `validator_heartbeat:${address}:${now}`,
            })) {
                totalChecks++;
                const heartbeat = JSON.parse(value);
                if (heartbeat.status === "active")
                    successfulChecks++;
            }
            const uptime = totalChecks > 0 ? successfulChecks / totalChecks : 0;
            this.validatorMetricsCache.set(cacheKey, uptime, { ttl: 300000 }); // 5 min cache
            return uptime;
        }
        catch (error) {
            shared_1.Logger.error(`Failed to get validator uptime for ${address}:`, error);
            return 0;
        }
    }
    /**
     * Get a validator's vote participation
     * @param address Validator address
     * @returns Promise<number> Vote participation
     */
    async getVoteParticipation(address) {
        try {
            const cacheKey = `vote_participation:${address}`;
            const cached = this.validatorMetricsCache.get(cacheKey);
            if (cached !== undefined)
                return cached;
            let totalVotes = 0;
            let participatedVotes = 0;
            // Get all voting periods in last 30 days
            const periods = await this.getVotingPeriods(Date.now() - 30 * 24 * 60 * 60 * 1000);
            for (const period of periods) {
                totalVotes++;
                const vote = await this.getVoteInPeriod(address, period.periodId);
                if (vote)
                    participatedVotes++;
            }
            const participation = totalVotes > 0 ? participatedVotes / totalVotes : 0;
            this.validatorMetricsCache.set(cacheKey, participation, { ttl: 300000 });
            return participation;
        }
        catch (error) {
            shared_1.Logger.error(`Failed to get vote participation for ${address}:`, error);
            return 0;
        }
    }
    /**
     * Get a validator's block production
     * @param address Validator address
     * @returns Promise<number> Block production
     */
    async getBlockProduction(address) {
        try {
            const cacheKey = `block_production:${address}`;
            const cached = this.validatorMetricsCache.get(cacheKey);
            if (cached !== undefined)
                return cached;
            const currentHeight = await this.getCurrentHeight();
            const expectedBlocks = await this.getExpectedBlockCount(address);
            let producedBlocks = 0;
            // Count blocks produced in last 1000 blocks
            const startHeight = Math.max(0, currentHeight - 1000);
            for await (const [key, value] of this.db.iterator({
                gte: `block:miner:${address}:${startHeight}`,
                lte: `block:miner:${address}:${currentHeight}`,
            })) {
                producedBlocks++;
            }
            const production = expectedBlocks > 0 ? producedBlocks / expectedBlocks : 0;
            this.validatorMetricsCache.set(cacheKey, production, { ttl: 300000 });
            return production;
        }
        catch (error) {
            shared_1.Logger.error(`Failed to get block production for ${address}:`, error);
            return 0;
        }
    }
    /**
     * Get a validator's slashing history
     * @param address Validator address
     * @returns Promise<Array<{ timestamp: number; reason: string }>> Slashing history
     */
    async getSlashingHistory(address) {
        try {
            const cacheKey = `slashing_history:${address}`;
            const cached = this.slashingHistoryCache.get(cacheKey);
            if (cached !== undefined)
                return cached;
            const history = [];
            // Get all slashing events for this validator
            for await (const [key, value] of this.db.iterator({
                gte: `slash:${address}:`,
                lte: `slash:${address}:\xFF`,
            })) {
                const slashEvent = JSON.parse(value);
                history.push({
                    timestamp: slashEvent.timestamp,
                    reason: slashEvent.reason,
                });
            }
            // Sort by timestamp descending
            history.sort((a, b) => b.timestamp - a.timestamp);
            this.slashingHistoryCache.set(cacheKey, history, { ttl: 300000 });
            return history;
        }
        catch (error) {
            shared_1.Logger.error(`Failed to get slashing history for ${address}:`, error);
            return [];
        }
    }
    /**
     * Get a validator's expected block count
     * @param address Validator address
     * @returns Promise<number> Expected block count
     */
    async getExpectedBlockCount(address) {
        try {
            const validator = await this.getValidator(address);
            if (!validator)
                return 0;
            // Consider multiple factors for block production rights:
            const metrics = {
                // 1. PoW contribution (40%) - measured by hash power contribution
                powScore: await this.getPowContribution(address),
                // 2. Token holder votes (40%) - direct voting weight from token holders
                voteWeight: await this.getTokenHolderVotes(address),
                // 3. Historical reliability (20%) - uptime, previous blocks, etc
                reliabilityScore: await this.getValidatorReliability(address),
            };
            // Calculate composite score (0-1)
            const compositeScore = metrics.powScore * 0.4 +
                metrics.voteWeight * 0.4 +
                metrics.reliabilityScore * 0.2;
            // Expected blocks out of 1000 based on composite score
            return Math.floor(1000 * compositeScore);
        }
        catch (error) {
            shared_1.Logger.error(`Failed to calculate expected block count for ${address}:`, error);
            return 0;
        }
    }
    /**
     * Get a validator's hash power contribution
     * @param address Validator address
     * @returns Promise<number> Hash power contribution
     */
    async getPowContribution(address) {
        // Calculate normalized hash power contribution (0-1)
        const hashPower = await this.getValidatorHashPower(address);
        const totalHashPower = await this.getTotalNetworkHashPower();
        return hashPower / totalHashPower;
    }
    /**
     * Get a validator's token holder votes
     * @param address Validator address
     * @returns Promise<number> Token holder votes
     */
    async getTokenHolderVotes(address) {
        // Get direct votes from token holders
        const validatorVotes = await this.getVotesForValidator(address);
        const totalVotes = await this.getTotalVotes();
        return validatorVotes / totalVotes;
    }
    /**
     * Get a validator's reliability
     * @param address Validator address
     * @returns Promise<number> Reliability
     */
    async getValidatorReliability(address) {
        // Combine uptime, block production history, and other metrics
        const uptime = await this.getValidatorUptime(address);
        const blockSuccess = await this.getBlockProductionSuccess(address);
        const responseTime = await this.getAverageResponseTime(address);
        return uptime * 0.4 + blockSuccess * 0.4 + responseTime * 0.2;
    }
    /**
     * Get a validator's hash power
     * @param address Validator address
     * @returns Promise<number> Hash power
     */
    async getValidatorHashPower(address) {
        try {
            const cacheKey = `validator_hashpower:${address}`;
            const cached = this.validatorMetricsCache.get(cacheKey);
            if (cached !== undefined)
                return cached;
            // Get last 100 blocks mined by validator
            let totalDifficulty = BigInt(0);
            let blockCount = 0;
            const now = Date.now();
            const ONE_HOUR = 3600000;
            for await (const [key, value] of this.db.iterator({
                gte: `block:miner:${address}:${now - ONE_HOUR}`,
                lte: `block:miner:${address}:${now}`,
            })) {
                const block = JSON.parse(value);
                totalDifficulty += BigInt(block.header.difficulty);
                blockCount++;
            }
            // Calculate hash power as average difficulty per block
            const hashPower = blockCount > 0 ? Number(totalDifficulty) / blockCount : 0;
            this.validatorMetricsCache.set(cacheKey, hashPower, { ttl: 60000 }); // 1 min cache
            return hashPower;
        }
        catch (error) {
            shared_1.Logger.error(`Failed to get validator hash power for ${address}:`, error);
            return 0;
        }
    }
    /**
     * Get the total network hash power
     * @returns Promise<number> Total network hash power
     */
    async getTotalNetworkHashPower() {
        try {
            const cacheKey = "network_hashpower";
            const cached = this.validatorMetricsCache.get(cacheKey);
            if (cached !== undefined)
                return cached;
            // Get last 100 blocks network-wide
            let totalDifficulty = BigInt(0);
            let blockCount = 0;
            const now = Date.now();
            const ONE_HOUR = 3600000;
            for await (const [key, value] of this.db.iterator({
                gte: `block:timestamp:${now - ONE_HOUR}`,
                lte: `block:timestamp:${now}`,
            })) {
                const block = JSON.parse(value);
                totalDifficulty += BigInt(block.header.difficulty);
                blockCount++;
            }
            const networkHashPower = blockCount > 0 ? Number(totalDifficulty) / blockCount : 0;
            this.validatorMetricsCache.set(cacheKey, networkHashPower, {
                ttl: 60000,
            });
            return networkHashPower;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get network hash power:", error);
            return 0;
        }
    }
    /**
     * Get a validator's block production success
     * @param address Validator address
     * @returns Promise<number> Block production success
     */
    async getBlockProductionSuccess(address) {
        try {
            const cacheKey = `block_success:${address}`;
            const cached = this.validatorMetricsCache.get(cacheKey);
            if (cached !== undefined)
                return cached;
            let successfulBlocks = 0;
            let totalAttempts = 0;
            const now = Date.now();
            const ONE_DAY = 24 * 60 * 60 * 1000;
            // Count successful blocks and failed attempts
            for await (const [key, value] of this.db.iterator({
                gte: `block_attempt:${address}:${now - ONE_DAY}`,
                lte: `block_attempt:${address}:${now}`,
            })) {
                const attempt = JSON.parse(value);
                totalAttempts++;
                if (attempt.success)
                    successfulBlocks++;
            }
            const successRate = totalAttempts > 0 ? successfulBlocks / totalAttempts : 0;
            this.validatorMetricsCache.set(cacheKey, successRate, { ttl: 300000 });
            return successRate;
        }
        catch (error) {
            shared_1.Logger.error(`Failed to get block production success for ${address}:`, error);
            return 0;
        }
    }
    /**
     * Get a validator's average response time
     * @param address Validator address
     * @returns Promise<number> Average response time
     */
    async getAverageResponseTime(address) {
        try {
            const cacheKey = `response_time:${address}`;
            const cached = this.validatorMetricsCache.get(cacheKey);
            if (cached !== undefined)
                return cached;
            let totalResponseTime = 0;
            let responseCount = 0;
            const now = Date.now();
            const ONE_HOUR = 3600000;
            // Calculate average response time from heartbeats
            for await (const [key, value] of this.db.iterator({
                gte: `validator_heartbeat:${address}:${now - ONE_HOUR}`,
                lte: `validator_heartbeat:${address}:${now}`,
            })) {
                const heartbeat = JSON.parse(value);
                if (heartbeat.responseTime) {
                    totalResponseTime += heartbeat.responseTime;
                    responseCount++;
                }
            }
            // Normalize to 0-1 range where 1 is best (lowest response time)
            const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;
            const normalizedScore = Math.max(0, Math.min(1, 1 - avgResponseTime / 1000)); // Assuming 1000ms is worst acceptable
            this.validatorMetricsCache.set(cacheKey, normalizedScore, { ttl: 60000 });
            return normalizedScore;
        }
        catch (error) {
            shared_1.Logger.error(`Failed to get average response time for ${address}:`, error);
            return 0;
        }
    }
    /**
     * Get a validator's votes
     * @param address Validator address
     * @returns Promise<number> Votes
     */
    async getVotesForValidator(address) {
        try {
            const cacheKey = `validator_votes:${address}`;
            const cached = this.validatorMetricsCache.get(cacheKey);
            if (cached !== undefined)
                return cached;
            let totalVotingPower = BigInt(0);
            const now = Date.now();
            const ONE_DAY = 24 * 60 * 60 * 1000;
            // Sum up voting power from token holders
            for await (const [key, value] of this.db.iterator({
                gte: `vote:validator:${address}:${now - ONE_DAY}`,
                lte: `vote:validator:${address}:${now}`,
            })) {
                const vote = JSON.parse(value);
                totalVotingPower += BigInt(vote.votingPower);
            }
            const votingScore = Number(totalVotingPower) / Number(await this.getTotalVotingPower());
            this.validatorMetricsCache.set(cacheKey, votingScore, { ttl: 300000 });
            return votingScore;
        }
        catch (error) {
            shared_1.Logger.error(`Failed to get votes for validator ${address}:`, error);
            return 0;
        }
    }
    /**
     * Get the total voting power
     * @returns Promise<bigint> Total voting power
     */
    async getTotalVotingPower() {
        try {
            const cacheKey = "total_voting_power";
            const cached = this.votingPowerCache.get(cacheKey);
            if (cached !== undefined)
                return BigInt(cached);
            let total = BigInt(0);
            for await (const [key, value] of this.db.iterator({
                gte: "token_holder:",
                lte: "token_holder:\xFF",
            })) {
                const holder = JSON.parse(value);
                total += BigInt(holder.balance);
            }
            this.votingPowerCache.set(cacheKey, total);
            return total;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get total voting power:", error);
            return BigInt(0);
        }
    }
    /**
     * Get voting periods
     * @param since Start time
     * @returns Promise<VotingPeriod[]> Voting periods
     */
    async getVotingPeriods(since) {
        const periods = [];
        for await (const [key, value] of this.db.iterator({
            gte: `voting_period:${since}`,
            lte: `voting_period:${Date.now()}`,
        })) {
            periods.push(JSON.parse(value));
        }
        return periods;
    }
    /**
     * Get a vote in a specific period
     * @param address Validator address
     * @param periodId Voting period ID
     * @returns Promise<Vote | null> Vote or null if not found
     */
    async getVoteInPeriod(address, periodId) {
        try {
            const vote = await this.db.get(`vote:${periodId}:${address}`);
            return JSON.parse(vote);
        }
        catch (error) {
            if (error.notFound)
                return null;
            throw error;
        }
    }
    /**
     * Get a validator by its address
     * @param address Validator address
     * @returns Promise<Validator | null> Validator or null if not found
     */
    async getValidator(address) {
        try {
            const key = `validator:${address}`;
            const data = await this.db.get(key);
            return data ? JSON.parse(data) : null;
        }
        catch (error) {
            if (error.notFound)
                return null;
            shared_1.Logger.error(`Failed to get validator ${address}:`, error);
            return null;
        }
    }
    /**
     * Get the total number of validators
     * @returns Promise<number> Total number of validators
     */
    async getValidatorCount() {
        try {
            let count = 0;
            for await (const [key] of this.db.iterator({
                gte: "validator:",
                lte: "validator:\xFF",
            })) {
                count++;
            }
            return count;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get validator count:", error);
            return 0;
        }
    }
    /**
     * Get the last N blocks
     * @param n Number of blocks to get
     * @returns Promise<Block[]> Last N blocks
     */
    async getLastNBlocks(n) {
        try {
            const blocks = [];
            const currentHeight = await this.getCurrentHeight();
            const startHeight = Math.max(0, currentHeight - n);
            // Use existing getBlockRange method
            const lastBlocks = await this.getBlocksFromHeight(startHeight, currentHeight);
            // Sort by height descending to ensure correct order
            return lastBlocks.sort((a, b) => b.header.height - a.header.height);
        }
        catch (error) {
            shared_1.Logger.error("Failed to get last N blocks:", error);
            return [];
        }
    }
    /**
     * Get the nonce for an account
     * @param address Account address
     * @returns Promise<number> Nonce
     */
    async getAccountNonce(address) {
        if (!address) {
            throw new Error("Address is required");
        }
        try {
            const nonce = await this.db.get(`nonce:${address}`);
            return parseInt(nonce) || 0;
        }
        catch (error) {
            if (error.notFound)
                return 0;
            shared_1.Logger.error("Failed to get account nonce:", error);
            throw error;
        }
    }
    /**
     * Get the block hash by its height
     * @param height Block height
     * @returns Promise<string | null> Block hash or null if not found
     */
    async getBlockHashByHeight(height) {
        try {
            const block = await this.db.get(`block:height:${height}`);
            return JSON.parse(block).hash;
        }
        catch (error) {
            if (error.notFound)
                return null;
            shared_1.Logger.error("Failed to get block hash by height:", error);
            throw error;
        }
    }
    /**
     * Set the chain head
     * @param height Block height
     * @returns Promise<void>
     */
    async setChainHead(height) {
        try {
            const blockHash = await this.getBlockHashByHeight(height);
            await this.db.put("chain:head", JSON.stringify({
                height,
                hash: blockHash,
                timestamp: Date.now(),
            }));
        }
        catch (error) {
            shared_1.Logger.error("Failed to set chain head:", error);
            throw error;
        }
    }
    /**
     * Execute a database transaction
     * @param callback Callback function to execute
     * @returns Promise<T> Result of the callback
     */
    async executeTransaction(callback) {
        return await this.mutex.runExclusive(async () => {
            try {
                await this.startTransaction();
                const result = await callback();
                await this.commitTransaction();
                return result;
            }
            catch (error) {
                await this.rollbackTransaction();
                throw error;
            }
        });
    }
    /**
     * Create a snapshot
     * @returns Promise<string> Snapshot ID
     */
    async createSnapshot() {
        const snapshotId = Date.now().toString();
        await this.put(`snapshot:${snapshotId}`, JSON.stringify({
            chainHead: await this.getChainHead(),
            timestamp: Date.now(),
        }));
        return snapshotId;
    }
    /**
     * Commit a snapshot
     * @param snapshotId Snapshot ID
     * @returns Promise<void>
     */
    async commitSnapshot(snapshotId) {
        await this.del(`snapshot:${snapshotId}`);
    }
    /**
     * Rollback a snapshot
     * @param snapshotId Snapshot ID
     * @returns Promise<void>
     */
    async rollbackSnapshot(snapshotId) {
        const snapshot = JSON.parse(await this.get(`snapshot:${snapshotId}`));
        await this.setChainHead(snapshot.chainHead);
        await this.del(`snapshot:${snapshotId}`);
    }
    /**
     * Get the chain head
     * @returns Promise<number> Chain head height
     */
    async getChainHead() {
        try {
            const head = await this.get("chain:head");
            return head ? JSON.parse(head).height : 0;
        }
        catch (error) {
            if (error.notFound)
                return 0;
            throw error;
        }
    }
    /**
     * Delete a key from the database
     * @param key Key to delete
     * @returns Promise<void>
     */
    async del(key) {
        try {
            await this.db.del(key);
        }
        catch (error) {
            shared_1.Logger.error(`Failed to delete key ${key}:`, error);
            throw error;
        }
    }
    /**
     * Get a validator's performance
     * @param address Validator address
     * @param blockCount Number of blocks to consider
     * @returns Promise<ValidatorPerformance> Validator performance
     */
    async getValidatorPerformance(address, blockCount) {
        try {
            let successfulValidations = 0;
            let totalOpportunities = 0;
            const currentHeight = await this.getCurrentHeight();
            const startHeight = currentHeight - blockCount;
            for await (const [key, value] of this.db.iterator({
                gte: `validator_performance:${address}:${startHeight}`,
                lte: `validator_performance:${address}:${currentHeight}`,
            })) {
                const record = JSON.parse(value);
                successfulValidations += record.successful ? 1 : 0;
                totalOpportunities++;
            }
            return { successfulValidations, totalOpportunities };
        }
        catch (error) {
            shared_1.Logger.error("Failed to get validator performance:", error);
            return { successfulValidations: 0, totalOpportunities: 0 };
        }
    }
    /**
     * Get a validator's stats
     * @param address Validator address
     * @returns Promise<ValidatorStats> Validator stats
     */
    async getValidatorStats(address) {
        try {
            const value = await this.db.get(`validator_stats:${address}`);
            return JSON.parse(value);
        }
        catch (error) {
            return {
                currentLoad: 0,
                maxCapacity: 100,
            };
        }
    }
    /**
     * Get a UTXO by its transaction ID and output index
     * @param txId Transaction ID
     * @param outputIndex Output index
     * @returns Promise<UTXO | null> UTXO or null if not found
     */
    async getUTXO(txId, outputIndex) {
        try {
            const utxo = await this.get(`utxo:${txId}:${outputIndex}`);
            return utxo ? JSON.parse(utxo) : null;
        }
        catch (error) {
            if (error.notFound)
                return null;
            shared_1.Logger.error("Failed to get UTXO:", error);
            throw error;
        }
    }
    /**
     * Start a database transaction
     * @returns Promise<void>
     */
    async beginTransaction() {
        if (this.transaction) {
            throw new Error("Transaction already in progress");
        }
        this.abstractTransaction = [];
    }
    /**
     * Commit a database transaction
     * @returns Promise<void>
     */
    async commit() {
        if (!this.transaction) {
            throw new Error("No transaction in progress");
        }
        try {
            await this.db.batch(this.abstractTransaction);
            this.transaction = null;
        }
        catch (error) {
            shared_1.Logger.error("Failed to commit transaction:", error);
            await this.rollback();
            throw error;
        }
    }
    /**
     * Rollback a database transaction
     * @returns Promise<void>
     */
    async rollback() {
        if (!this.transaction) {
            throw new Error("No transaction in progress");
        }
        this.transaction = null;
    }
    /**
     * Add a transaction operation
     * @param operation Transaction operation
     */
    addToTransaction(operation) {
        if (!this.transaction) {
            throw new Error("No transaction in progress");
        }
        this.abstractTransaction.push(operation);
    }
    /**
     * Sync a shard
     * @param shardId Shard ID
     * @param data Data to sync
     * @returns Promise<void>
     */
    async syncShard(shardId, data) {
        const perfMarker = this.performanceMonitor.start("sync_shard");
        const release = await this.shardMutex.acquire();
        try {
            // Validate inputs
            if (typeof shardId !== "number" || shardId < 0) {
                throw new Error("Invalid shard ID");
            }
            if (!Array.isArray(data)) {
                throw new Error("Invalid shard data");
            }
            // Calculate checksum
            const checksum = this.calculateChecksum(data);
            // Check if update is needed by comparing checksums
            const existingShard = await this.getShardData(shardId);
            if (existingShard && existingShard.checksum === checksum) {
                shared_1.Logger.debug(`Shard ${shardId} already up to date`);
                return;
            }
            // Prepare shard data
            const shardData = {
                data,
                lastSync: Date.now(),
                version: this.SHARD_VERSION,
                checksum,
                metadata: {
                    size: data.length,
                    compressed: false,
                    createdAt: existingShard?.metadata.createdAt || Date.now(),
                    updatedAt: Date.now(),
                },
            };
            // Compress if data is large
            if (JSON.stringify(data).length > 1024 * 100) {
                // 100KB
                shardData.data = await this.compressData(data);
                shardData.metadata.compressed = true;
            }
            // Store shard data
            await this.db.put(`shard:${shardId}`, JSON.stringify(shardData));
            // Update metrics
            this.metricsCollector.gauge(`shard_size`, data.length);
            this.metricsCollector.increment("shard_sync_success");
            shared_1.Logger.info(`Shard ${shardId} synced successfully`, {
                size: data.length,
                checksum,
            });
        }
        catch (error) {
            this.metricsCollector.increment("shard_sync_failure");
            shared_1.Logger.error(`Failed to sync shard ${shardId}:`, error);
            await this.auditManager.log(audit_1.AuditEventType.SHARD_SYNC_FAILED, {
                shardId,
                error: error.message,
                timestamp: Date.now(),
            });
            throw error;
        }
        finally {
            this.performanceMonitor.end(perfMarker);
            release();
        }
    }
    async getShardData(shardId) {
        try {
            const data = await this.db.get(`shard:${shardId}`);
            return data ? JSON.parse(data) : null;
        }
        catch (error) {
            if (error.notFound)
                return null;
            throw error;
        }
    }
    calculateChecksum(data) {
        const hash = (0, crypto_1.createHash)("sha256");
        hash.update(JSON.stringify(data));
        return hash.digest("hex");
    }
    async compressData(data) {
        const gzipAsync = (0, util_1.promisify)(zlib_1.gzip);
        const compressedData = await Promise.all(data.map(async (item) => {
            const compressed = await gzipAsync(Buffer.from(item));
            return compressed.toString("base64");
        }));
        return compressedData;
    }
    async getRecentTransactions(limit = 100) {
        const perfMarker = this.performanceMonitor.start("get_recent_transactions");
        try {
            // Input validation
            if (limit <= 0 || limit > 1000) {
                throw new Error("Invalid limit: must be between 1 and 1000");
            }
            // Get latest block height
            const currentHeight = await this.getCurrentHeight();
            const startHeight = Math.max(0, currentHeight - 100); // Look back 100 blocks
            // Query transactions from recent blocks
            const transactions = [];
            for (let height = currentHeight; height > startHeight && transactions.length < limit; height--) {
                const block = await this.getBlockByHeight(height);
                if (block?.transactions) {
                    transactions.push(...block.transactions);
                }
            }
            // Sort by timestamp descending and limit
            const recentTxs = transactions
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, limit);
            this.metricsCollector?.gauge("recent_transactions_count", recentTxs.length);
            return recentTxs;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get recent transactions:", error);
            this.metricsCollector?.increment("recent_transactions_error");
            throw error;
        }
        finally {
            this.performanceMonitor.end(perfMarker);
        }
    }
    async getLastAccess(id) {
        try {
            const data = await this.db.get(`access:${id}`);
            return data ? parseInt(data) : 0;
        }
        catch (error) {
            if (error.notFound)
                return 0;
            throw error;
        }
    }
    async updateLastAccess(id) {
        await this.db.put(`access:${id}`, Date.now().toString());
    }
    async startTransaction() {
        await this.transactionLock.acquire();
        try {
            if (this.transaction) {
                throw new Error("Transaction already in progress");
            }
            this.transaction = this.db.batch();
            this.transactionOperations = [];
            this.transactionStartTime = Date.now();
            // Start transaction timeout monitor
            this.startTransactionMonitor();
        }
        catch (error) {
            this.transactionLock.release();
            throw error;
        }
    }
    startTransactionMonitor() {
        const TRANSACTION_TIMEOUT = 30000; // 30 seconds
        setTimeout(async () => {
            if (this.transaction &&
                Date.now() - this.transactionStartTime > TRANSACTION_TIMEOUT) {
                shared_1.Logger.warn("Transaction timeout detected, initiating rollback");
                await this.rollbackTransaction();
            }
        }, TRANSACTION_TIMEOUT);
    }
    async commitTransaction() {
        if (!this.transaction) {
            throw new Error("No active transaction");
        }
        try {
            await this.mutex.runExclusive(async () => {
                await this.transaction.write((error) => {
                    if (error) {
                        shared_1.Logger.error("Transaction write failed:", error);
                        throw new Error(`Transaction write failed: ${error.message}`);
                    }
                });
                await this.persistOperations(this.transactionOperations);
                // Only clear after successful persistence
                this.transaction = null;
                this.transactionOperations = [];
            });
        }
        catch (error) {
            await this.rollbackTransaction();
            throw new Error(`Transaction commit failed: ${error.message}`);
        }
    }
    async rollbackTransaction() {
        try {
            if (this.transaction) {
                await this.mutex.runExclusive(async () => {
                    // Clear any pending operations
                    this.transaction = null;
                    this.transactionOperations = [];
                    // Invalidate affected caches
                    await this.invalidateAffectedCaches();
                });
            }
        }
        catch (error) {
            shared_1.Logger.error("Transaction rollback failed:", error);
            throw new Error(`Rollback failed: ${error.message}`);
        }
    }
    async invalidateAffectedCaches() {
        const affectedKeys = this.transactionOperations.map((op) => op.key);
        for (const key of affectedKeys) {
            if (key.startsWith("transactions:")) {
                this.transactionCache.delete(key);
            }
            else if (key.startsWith("block:")) {
                this.blockCache.delete(key);
            }
        }
    }
    async persistOperations(operations) {
        if (!operations.length)
            return;
        try {
            // Validate operations before persisting
            this.validateOperations(operations);
            // Split into smaller batches if needed
            const BATCH_SIZE = 1000;
            for (let i = 0; i < operations.length; i += BATCH_SIZE) {
                const batch = operations.slice(i, i + BATCH_SIZE);
                await this.db.batch(batch);
                // Update metrics
                this.metricsCollector?.gauge("batch_operations_count", batch.length);
            }
            // Audit log
            this.auditManager?.log(audit_1.AuditEventType.TRANSACTION_COMMIT, {
                operationCount: operations.length,
                timestamp: Date.now(),
            });
        }
        catch (error) {
            shared_1.Logger.error("Failed to persist operations:", error);
            throw new Error(`Operation persistence failed: ${error.message}`);
        }
    }
    validateOperations(operations) {
        for (const op of operations) {
            if (!op.key || typeof op.key !== "string") {
                throw new Error(`Invalid operation key: ${op.key}`);
            }
            if (op.type === "put" && !op.value) {
                throw new Error(`Missing value for put operation on key: ${op.key}`);
            }
        }
    }
    async getSeeds() {
        try {
            const seeds = [];
            for await (const [key, value] of this.db.iterator({
                gte: "seed:",
                lte: "seed:\xFF",
            })) {
                seeds.push(JSON.parse(value));
            }
            return seeds;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get seeds:", error);
            return [];
        }
    }
    async saveSeeds(seeds) {
        try {
            const batch = this.db.batch();
            for (const [address, seed] of seeds) {
                batch.put(`seed:${address}`, JSON.stringify(seed));
            }
            await batch.write();
        }
        catch (error) {
            shared_1.Logger.error("Failed to save seeds:", error);
            throw error;
        }
    }
    async getActiveValidators() {
        try {
            const validators = [];
            for await (const [key, value] of this.db.iterator({
                gte: "validator:",
                lte: "validator:\xFF",
            })) {
                const validator = JSON.parse(value);
                if (validator.active && validator.lastSeen > Date.now() - 3600000) {
                    // Active in last hour
                    validators.push({ address: validator.address });
                }
            }
            return validators;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get active validators:", error);
            return [];
        }
    }
    async getTagHolderCount() {
        try {
            const holders = new Set();
            for await (const [key, rawValue] of this.db.iterator({
                gte: "utxo:",
                lte: "utxo:\xFF",
            })) {
                const utxo = JSON.parse(rawValue);
                if (!utxo.spent && utxo.tags?.length > 0) {
                    holders.add(utxo.address);
                }
            }
            return holders.size;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get tag holder count:", error);
            return 0;
        }
    }
    async getTagDistribution() {
        try {
            const tagCounts = new Map();
            for await (const [key, rawValue] of this.db.iterator({
                gte: "utxo:",
                lte: "utxo:\xFF",
            })) {
                const utxo = JSON.parse(rawValue);
                if (!utxo.spent && utxo.tags?.length > 0) {
                    utxo.tags.forEach((tag) => {
                        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
                    });
                }
            }
            // Calculate Gini coefficient for tag distribution
            const values = Array.from(tagCounts.values());
            return this.calculateGiniCoefficient(values);
        }
        catch (error) {
            shared_1.Logger.error("Failed to get tag distribution:", error);
            return 0;
        }
    }
    calculateGiniCoefficient(values) {
        if (values.length === 0)
            return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const totalDiff = values.reduce((sum, val) => sum + values.reduce((diff, other) => diff + Math.abs(val - other), 0), 0);
        return totalDiff / (2 * values.length * values.length * mean);
    }
    async getBlockByHash(hash) {
        try {
            const block = await this.db.get(`block:${hash}`);
            return block ? JSON.parse(block) : null;
        }
        catch (error) {
            if (error.notFound)
                return null;
            shared_1.Logger.error("Failed to get block by hash:", error);
            throw error;
        }
    }
    /**
     * Get all blocks at a specific height
     * @param height Block height
     * @returns Promise<Block[]> Blocks at the specified height
     */
    async getBlocksByHeight(height) {
        try {
            const blocks = [];
            for await (const [key, value] of this.db.iterator({
                gte: `block:height:${height}`,
                lte: `block:height:${height}\xFF`,
            })) {
                blocks.push(JSON.parse(value));
            }
            return blocks;
        }
        catch (error) {
            shared_1.Logger.error(`Failed to get blocks at height ${height}:`, error);
            return [];
        }
    }
    iterator(options) {
        return this.db.iterator(options);
    }
    async getVotingEndHeight() {
        try {
            const cacheKey = "voting_end_height";
            const cached = this.heightCache.get(cacheKey);
            if (cached !== undefined && typeof cached === "string") {
                return parseInt(cached);
            }
            // Get from database
            const height = await this.db.get("end_height");
            const endHeight = parseInt(height) || 0;
            // Cache the result
            await this.heightCache.set(cacheKey, endHeight.toString(), {
                ttl: constants_1.BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL,
            });
            return endHeight;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get voting end height:", error);
            if (error.notFound)
                return 0;
            throw error;
        }
    }
    async getVotingStartHeight() {
        try {
            const cacheKey = "voting_start_height";
            const cached = this.heightCache.get(cacheKey);
            if (cached !== undefined && typeof cached === "string") {
                return parseInt(cached);
            }
            // Get from database
            const height = await this.db.get("start_height");
            const startHeight = parseInt(height) || 0;
            // Cache the result
            await this.heightCache.set(cacheKey, startHeight.toString(), {
                ttl: constants_1.BLOCKCHAIN_CONSTANTS.UTIL.CACHE_TTL,
            });
            return startHeight;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get voting start height:", error);
            if (error.notFound)
                return 0;
            throw error;
        }
    }
    getTransactionExecutor() {
        return (operation) => this.mutex.runExclusive(operation);
    }
    /**
     * Updates block difficulty in database
     */
    async updateDifficulty(blockHash, difficulty) {
        try {
            await this.db.put(`difficulty:${blockHash}`, difficulty.toString());
        }
        catch (error) {
            shared_1.Logger.error("Failed to update difficulty:", error);
            throw error;
        }
    }
    async lockTransaction(txId) {
        if (!this.transactionLocks.has(txId)) {
            this.transactionLocks.set(txId, new async_mutex_1.Mutex());
        }
        const mutex = this.transactionLocks.get(txId);
        const release = await mutex.acquire();
        return async () => { release(); };
    }
    async unlockTransaction(txId) {
        const mutex = this.transactionLocks.get(txId);
        if (mutex) {
            this.transactionLocks.delete(txId);
        }
    }
    async markUTXOPending(txId, outputIndex) {
        try {
            const key = `utxo:${txId}:${outputIndex}`;
            const utxo = await this.db.get(key);
            if (utxo) {
                const updatedUtxo = { ...JSON.parse(utxo), pending: true };
                await this.db.put(key, JSON.stringify(updatedUtxo));
            }
        }
        catch (error) {
            shared_1.Logger.error("Failed to mark UTXO as pending:", error);
            throw error;
        }
    }
    /**
     * Get block height by hash
     * @param hash Block hash
     * @returns Promise<number | null> Block height or null if not found
     */
    async getBlockHeight(hash) {
        try {
            const block = await this.getBlock(hash);
            return block ? block.header.height : null;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get block height:", error);
            return null;
        }
    }
    async hasBlock(hash) {
        try {
            const key = `block:${hash}`;
            const cached = this.cache.get(key);
            if (cached)
                return true;
            await this.db.get(key);
            return true;
        }
        catch (error) {
            if (error.notFound)
                return false;
            throw error;
        }
    }
    async hasTransaction(hash) {
        try {
            const key = `tx:${hash}`;
            const cached = this.transactionCache.get(key);
            if (cached)
                return true;
            await this.db.get(key);
            return true;
        }
        catch (error) {
            if (error.notFound)
                return false;
            throw error;
        }
    }
    async getHeaders(locator, hashStop) {
        try {
            const headers = [];
            for await (const [value] of this.db.iterator({
                gte: `header:${locator[0]}`,
                lte: `header:${hashStop}`,
                limit: 1000,
            })) {
                headers.push(JSON.parse(value));
            }
            return headers;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get headers:", error);
            return [];
        }
    }
    async getBlocks(locator, hashStop) {
        try {
            const blocks = [];
            for await (const [value] of this.db.iterator({
                gte: `block:${locator[0]}`,
                lte: `block:${hashStop}`,
                limit: 1000,
            })) {
                blocks.push(JSON.parse(value));
            }
            return blocks;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get blocks:", error);
            return [];
        }
    }
}
exports.BlockchainSchema = BlockchainSchema;
__decorate([
    (0, retry_1.retry)({ maxAttempts: 3, delay: 1000 })
], BlockchainSchema.prototype, "createVotingPeriod", null);
__decorate([
    (0, retry_1.retry)({ maxAttempts: 3, delay: 1000 })
], BlockchainSchema.prototype, "getUtxosByAddress", null);
__decorate([
    (0, retry_1.retry)({
        maxAttempts: 3,
        delay: 1000,
        exponentialBackoff: true,
    })
], BlockchainSchema.prototype, "syncShard", null);
__decorate([
    (0, retry_1.retry)({
        maxAttempts: 3,
        delay: 1000,
        exponentialBackoff: true,
    })
], BlockchainSchema.prototype, "getRecentTransactions", null);
