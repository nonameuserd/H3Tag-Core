import { PowSolution } from '../blockchain/blockchain';
import { MiningMetrics } from '../monitoring/metrics';
/**
 * @fileoverview MiningDatabase manages storage and retrieval of mining-related data including
 * PoW solutions, mining metrics, consensus votes, and mining periods. It implements caching
 * and atomic batch operations for efficient data access.
 *
 * @module MiningDatabase
 */
/**
 * MiningDatabase handles persistence of mining operations and consensus data.
 *
 * @class MiningDatabase
 *
 * @property {Level} db - LevelDB database instance
 * @property {Cache} cache - Multi-purpose data cache
 * @property {Mutex} mutex - Mutex for synchronizing operations
 * @property {number} BATCH_SIZE - Maximum batch operation size
 * @property {number} CACHE_TTL - Cache time-to-live in seconds
 * @property {number} MAX_RETRY_ATTEMPTS - Maximum operation retry attempts
 * @property {boolean} initialized - Database initialization status
 *
 * @example
 * const miningDb = new MiningDatabase('./data/mining');
 * await miningDb.storePowSolution(solution);
 * const metrics = await miningDb.getMiningMetrics(height);
 */
/**
 * @typedef {Object} ConsensusVote
 * @property {string} blockHash - Hash of block being voted on
 * @property {string} voterAddress - Address of voter
 * @property {string} voteType - Type of vote
 * @property {bigint} timestamp - Vote timestamp
 * @property {string} signature - Vote signature
 * @property {string} quantumProof - Quantum resistance proof
 * @property {bigint} [weight] - Vote weight
 */
/**
 * @typedef {Object} ConsensusPeriod
 * @property {number} startHeight - Period start height
 * @property {number} endHeight - Period end height
 * @property {bigint} startTime - Period start timestamp
 * @property {bigint} endTime - Period end timestamp
 * @property {number} [participationRate] - Participation rate
 * @property {boolean} [finalDecision] - Final consensus decision
 * @property {number} [totalVotes] - Total votes cast
 * @property {boolean} [quorumReached] - Whether quorum was reached
 */
/**
 * Stores a PoW solution
 *
 * @async
 * @method storePowSolution
 * @param {PowSolution} solution - PoW solution to store
 * @returns {Promise<void>}
 * @throws {Error} If solution is invalid or already exists
 *
 * @example
 * await miningDb.storePowSolution({
 *   blockHash: '0x...',
 *   nonce: 12345n,
 *   minerAddress: '0x...',
 *   timestamp: Date.now(),
 *   signature: '0x...'
 * });
 */
/**
 * Stores mining metrics
 *
 * @async
 * @method storeMiningMetrics
 * @param {MiningMetrics} metrics - Mining metrics to store
 * @returns {Promise<void>}
 * @throws {Error} If metrics are invalid
 *
 * @example
 * await miningDb.storeMiningMetrics({
 *   blockHeight: 1000,
 *   hashRate: 15000n,
 *   difficulty: 100,
 *   timestamp: Date.now()
 * });
 */
/**
 * Stores a consensus vote
 *
 * @async
 * @method storeConsensusVote
 * @param {ConsensusVote} vote - Vote to store
 * @returns {Promise<void>}
 * @throws {Error} If vote is invalid
 *
 * @example
 * await miningDb.storeConsensusVote(vote);
 */
/**
 * Stores a consensus period
 *
 * @async
 * @method storeConsensusPeriod
 * @param {ConsensusPeriod} period - Period to store
 * @returns {Promise<void>}
 * @throws {Error} If period is invalid
 *
 * @example
 * await miningDb.storeConsensusPeriod(period);
 */
/**
 * Retrieves a PoW solution
 *
 * @async
 * @method getPowSolution
 * @param {string} blockHash - Block hash
 * @param {bigint} nonce - Solution nonce
 * @returns {Promise<PowSolution | null>} Solution if found
 *
 * @example
 * const solution = await miningDb.getPowSolution(blockHash, nonce);
 */
/**
 * Retrieves mining metrics
 *
 * @async
 * @method getMiningMetrics
 * @param {number} blockHeight - Block height
 * @returns {Promise<MiningMetrics | null>} Metrics if found
 *
 * @example
 * const metrics = await miningDb.getMiningMetrics(blockHeight);
 */
/**
 * Retrieves miner solutions
 *
 * @async
 * @method getMinerSolutions
 * @param {string} minerAddress - Miner's address
 * @param {number} [limit=100] - Maximum solutions to return
 * @returns {Promise<PowSolution[]>} Array of solutions
 *
 * @example
 * const solutions = await miningDb.getMinerSolutions(minerAddress);
 */
/**
 * Retrieves metrics in time range
 *
 * @async
 * @method getMetricsInRange
 * @param {bigint} startTime - Range start timestamp
 * @param {bigint} endTime - Range end timestamp
 * @returns {Promise<MiningMetrics[]>} Array of metrics
 *
 * @example
 * const metrics = await miningDb.getMetricsInRange(start, end);
 */
/**
 * Disposes database resources
 *
 * @async
 * @method dispose
 * @returns {Promise<void>}
 *
 * @example
 * await miningDb.dispose();
 */
interface ConsensusVote {
    blockHash: string;
    voterAddress: string;
    voteType: string;
    timestamp: bigint;
    signature: string;
    quantumProof: string;
    weight?: bigint;
}
interface ConsensusPeriod {
    startHeight: number;
    endHeight: number;
    startTime: bigint;
    endTime: bigint;
    participationRate?: number;
    finalDecision?: boolean;
    totalVotes?: number;
    quorumReached?: boolean;
}
export declare class MiningDatabase {
    private db;
    private cache;
    private mutex;
    private readonly BATCH_SIZE;
    private readonly CACHE_TTL;
    private readonly MAX_RETRY_ATTEMPTS;
    private initialized;
    constructor(dbPath: string);
    private initialize;
    storePowSolution(solution: PowSolution): Promise<void>;
    storeMiningMetrics(metrics: MiningMetrics): Promise<void>;
    storeConsensusVote(vote: ConsensusVote): Promise<void>;
    storeConsensusPeriod(period: ConsensusPeriod): Promise<void>;
    getPowSolution(blockHash: string, nonce: bigint): Promise<PowSolution | null>;
    getMiningMetrics(blockHeight: number): Promise<MiningMetrics | null>;
    getConsensusVote(blockHash: string, voterAddress: string): Promise<ConsensusVote | null>;
    getConsensusPeriod(startHeight: number): Promise<ConsensusPeriod | null>;
    getMinerSolutions(minerAddress: string, limit?: number): Promise<PowSolution[]>;
    getMetricsInRange(startTime: bigint, endTime: bigint): Promise<MiningMetrics[]>;
    private validatePowSolution;
    private validateMiningMetrics;
    private validateConsensusVote;
    private validateConsensusPeriod;
    dispose(): Promise<void>;
    private safeParse;
}
export {};
