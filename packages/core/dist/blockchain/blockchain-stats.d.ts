/**
 * @fileoverview BlockchainStats provides statistical analysis and metrics collection
 * for blockchain performance, health, and network participation. It implements caching
 * and circuit breaker patterns for efficient data retrieval.
 *
 * @module BlockchainStats
 */
/**
 * BlockchainStats collects and manages blockchain statistics with built-in caching
 * and circuit breaker protection.
 *
 * @class BlockchainStats
 *
 * @property {IBlockchainData} blockchain - Interface to blockchain data
 * @property {Map<string, { value: any; timestamp: number }>} statsCache - Statistics cache
 * @property {number} maxCacheSize - Maximum cache entries
 * @property {MetricsCollector} metricsCollector - Metrics collection instance
 * @property {Map} circuitBreaker - Circuit breaker state for stats operations
 *
 * @example
 * const stats = new BlockchainStats(blockchain);
 * const votingStats = await stats.getVotingStats();
 * const consensusHealth = await stats.getConsensusHealth();
 */
/**
 * Creates a new instance of BlockchainStats
 *
 * @constructor
 * @param {IBlockchainData} blockchain - Interface to blockchain data
 */
/**
 * Gets voting statistics including participation rates and period information
 *
 * @async
 * @method getVotingStats
 * @returns {Promise<{
 *   currentPeriod: number;
 *   blocksUntilNextVoting: number;
 *   participationRate: number;
 *   powWeight: number;
 *   votingWeight: number;
 * }>} Current voting statistics
 *
 * @example
 * const stats = await blockchainStats.getVotingStats();
 * console.log(`Current participation rate: ${stats.participationRate}%`);
 */
/**
 * Gets orphan rate over configured window
 *
 * @async
 * @method getOrphanRate
 * @returns {Promise<number>} Orphan rate as percentage
 *
 * @example
 * const orphanRate = await blockchainStats.getOrphanRate();
 * console.log(`Current orphan rate: ${orphanRate}%`);
 */
/**
 * Gets consensus health metrics
 *
 * @async
 * @method getConsensusHealth
 * @returns {Promise<{
 *   powHashrate: number;
 *   activeVoters: number;
 *   consensusParticipation: number;
 *   isHealthy: boolean;
 * }>} Consensus health status
 *
 * @example
 * const health = await blockchainStats.getConsensusHealth();
 * if (!health.isHealthy) {
 *   console.warn('Consensus health check failed');
 * }
 */
/**
 * Gets average block time over recent blocks
 *
 * @async
 * @method getAverageBlockTime
 * @returns {Promise<number>} Average block time in seconds
 *
 * @example
 * const avgBlockTime = await blockchainStats.getAverageBlockTime();
 * console.log(`Average block time: ${avgBlockTime}s`);
 */
/**
 * Gets block propagation statistics
 *
 * @async
 * @method getBlockPropagationStats
 * @returns {Promise<{
 *   average: number;
 *   median: number;
 * }>} Block propagation timing statistics
 *
 * @example
 * const propagation = await blockchainStats.getBlockPropagationStats();
 * console.log(`Median propagation time: ${propagation.median}ms`);
 */
/**
 * Gets cached value with automatic refresh
 *
 * @private
 * @async
 * @method getCachedValue
 * @template T
 * @param {string} key - Cache key
 * @param {() => Promise<T>} calculator - Value calculator function
 * @returns {Promise<T>} Cached or freshly calculated value
 */
/**
 * Executes operation with retry logic
 *
 * @private
 * @async
 * @method executeWithRetry
 * @template T
 * @param {() => Promise<T>} operation - Operation to execute
 * @returns {Promise<T>} Operation result
 */
/**
 * Executes operation with timeout
 *
 * @private
 * @async
 * @method executeWithTimeout
 * @template T
 * @param {Promise<T>} promise - Promise to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<T>} Operation result or timeout error
 */
/**
 * @interface IBlockchainData
 * @property {() => number} getHeight - Gets current blockchain height
 * @property {() => number} getCurrentHeight - Gets current synced height
 * @property {() => Block | null} getLatestBlock - Gets latest block
 * @property {(height: number) => Block | undefined} getBlockByHeight - Gets block at height
 * @property {() => number} getCurrentDifficulty - Gets current mining difficulty
 * @property {() => { chain: Block[] }} getState - Gets blockchain state
 * @property {() => Promise<Object>} getConsensusMetrics - Gets consensus metrics
 * @property {(hash: string) => Promise<Transaction | undefined>} getTransaction - Gets transaction by hash
 * @property {() => Object} getCurrencyDetails - Gets currency details
 * @property {(height: number) => bigint} calculateBlockReward - Calculates block reward
 * @property {(address: string) => Promise<Array>} getConfirmedUtxos - Gets confirmed UTXOs
 */
import { Block } from "../models/block.model";
import { Transaction } from "../models/transaction.model";
interface IBlockchainData {
    getHeight(): number;
    getCurrentHeight(): number;
    getLatestBlock(): Block | null;
    getBlockByHeight(height: number): Block | undefined;
    getCurrentDifficulty(): number;
    getState(): {
        chain: Block[];
    };
    getConsensusMetrics(): Promise<{
        powHashrate: number;
        activeVoters: number;
        participation: number;
        currentParticipation: number;
    }>;
    getTransaction(hash: string): Promise<Transaction | undefined>;
    getCurrencyDetails(): {
        name: string;
        symbol: string;
        decimals: number;
        totalSupply: number;
        maxSupply: number;
        circulatingSupply: number;
    };
    calculateBlockReward(height: number): bigint;
    getConfirmedUtxos(address: string): Promise<Array<{
        txid: string;
        vout: number;
        amount: number;
        confirmations: number;
    }>>;
}
export declare class BlockchainStats {
    private readonly blockchain;
    private readonly statsCache;
    private readonly maxCacheSize;
    private readonly metricsCollector;
    private circuitBreaker;
    private readonly cleanupInterval;
    /**
     * Constructor for BlockchainStats
     * @param blockchain Blockchain data
     */
    constructor(blockchain: IBlockchainData);
    /**
     * Initializes metrics
     */
    private initializeMetrics;
    /**
     * Gets cached value
     * @param key Key to get value for
     * @param calculator Calculator function
     * @returns Promise<T> Cached value
     */
    private getCachedValue;
    /**
     * Executes operation with retry
     * @param operation Operation to execute
     * @returns Promise<T> Result of operation
     */
    private executeWithRetry;
    /**
     * Executes operation with timeout
     * @param promise Promise to execute
     * @param timeoutMs Timeout in milliseconds
     * @returns Promise<T> Result of operation
     */
    private executeWithTimeout;
    /**
     * Gets voting stats
     * @returns Promise<{ currentPeriod: number; blocksUntilNextVoting: number; participationRate: number; powWeight: number; votingWeight: number; }> Voting stats
     */
    getVotingStats(): Promise<{
        currentPeriod: number;
        blocksUntilNextVoting: number;
        participationRate: number;
        powWeight: number;
        votingWeight: number;
    }>;
    /**
     * Validates blockchain height
     * @returns Promise<number> Blockchain height
     */
    private validateHeight;
    /**
     * Validates consensus metrics
     * @returns Promise<{ powHashrate: number; activeVoters: number; participation: number; currentParticipation: number; }> Consensus metrics
     */
    private validateConsensusMetrics;
    /**
     * Gets orphan rate
     * @returns Promise<number> Orphan rate
     */
    getOrphanRate(): Promise<number>;
    /**
     * Gets consensus health
     * @returns Promise<{ powHashrate: number; activeVoters: number; consensusParticipation: number; isHealthy: boolean; }> Consensus health
     */
    getConsensusHealth(): Promise<{
        powHashrate: number;
        activeVoters: number;
        consensusParticipation: number;
        isHealthy: boolean;
    }>;
    /**
     * Gets average block time
     * @returns Promise<number> Average block time
     */
    getAverageBlockTime(): Promise<number>;
    /**
     * Gets block propagation stats
     * @returns Promise<{ average: number; median: number; }> Block propagation stats
     */
    getBlockPropagationStats(): Promise<{
        average: number;
        median: number;
    }>;
    /**
     * Gets chain stats
     * @returns Promise<{ totalBlocks: number; totalTransactions: number; averageBlockSize: number; difficulty: number; }> Chain stats
     */
    getChainStats(): Promise<{
        totalBlocks: number;
        totalTransactions: number;
        averageBlockSize: number;
        difficulty: number;
    }>;
    /**
     * Calculates block size
     * @param block Block to calculate size for
     * @returns number Block size
     */
    private calculateBlockSize;
    /**
     * Gets network hash rate
     * @returns Promise<number> Network hash rate
     */
    getNetworkHashRate(): Promise<number>;
    /**
     * Validates input
     * @param value Value to validate
     * @param validator Validator function
     * @param errorMessage Error message
     */
    private validateInput;
    /**
     * Executes operation with circuit breaker
     * @param key Key to execute operation for
     * @param operation Operation to execute
     * @returns Promise<T> Result of operation
     */
    private executeWithCircuitBreaker;
    private startCacheCleanup;
    /**
     * Cleans up resources
     */
    cleanup(): void;
    /**
     * Handles error
     * @param error Error to handle
     * @param context Context to handle error for
     * @returns never
     */
    private handleError;
    getMedianTime(): Promise<number>;
}
export {};
