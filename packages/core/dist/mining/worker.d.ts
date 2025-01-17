interface MiningTask {
    start: number;
    end: number;
    target: string;
    headerBase: string;
    batchSize?: number;
}
export interface MiningResult {
    found: boolean;
    nonce?: number;
    hash?: string;
    error?: string;
    hashRate?: number;
    progress?: {
        currentNonce: number;
        timestamp: number;
    };
}
/**
 * @fileoverview MiningWorker implements multi-threaded mining operations using Web Workers.
 * It provides efficient parallel mining capabilities with progress tracking, error handling,
 * and performance monitoring.
 *
 * @module MiningWorker
 */
/**
 * Interface defining mining task parameters
 *
 * @interface MiningTask
 * @property {number} start - Starting nonce value
 * @property {number} end - Ending nonce value
 * @property {string} target - Mining target difficulty
 * @property {string} headerBase - Base block header data
 * @property {number} [batchSize] - Optional batch size for processing
 */
/**
 * Interface defining mining operation results
 *
 * @interface MiningResult
 * @property {boolean} found - Whether a valid nonce was found
 * @property {number} [nonce] - Found nonce value
 * @property {string} [hash] - Resulting block hash
 * @property {string} [error] - Error message if operation failed
 * @property {number} [hashRate] - Current hash rate in hashes per second
 * @property {Object} [progress] - Mining progress information
 * @property {number} progress.currentNonce - Current nonce being processed
 * @property {number} progress.timestamp - Progress timestamp
 */
/**
 * MiningWorker manages parallel mining operations with performance monitoring.
 *
 * @class MiningWorker
 *
 * @property {boolean} isInitialized - Worker initialization status
 * @property {number} lastReportTime - Timestamp of last progress report
 * @property {number} startTime - Mining start timestamp
 * @property {bigint} hashesProcessed - Total hashes processed
 * @property {number} DEFAULT_BATCH_SIZE - Default processing batch size (1000)
 * @property {number} REPORT_INTERVAL - Progress report interval (5000ms)
 *
 * @example
 * const worker = new MiningWorker();
 * await worker.mineRange({
 *   start: 0,
 *   end: 1000000,
 *   target: "0x1234...",
 *   headerBase: "block_header_data"
 * });
 */
/**
 * Initializes the mining worker
 *
 * @private
 * @async
 * @method initialize
 * @returns {Promise<void>}
 * @throws {Error} If initialization fails
 */
/**
 * Calculates current hash rate
 *
 * @method calculateHashRate
 * @returns {number} Hash rate in hashes per second
 *
 * @example
 * const hashRate = worker.calculateHashRate();
 */
/**
 * Checks if progress should be reported
 *
 * @private
 * @method shouldReportProgress
 * @returns {boolean} True if progress should be reported
 */
/**
 * Mines a range of nonces
 *
 * @async
 * @method mineRange
 * @param {MiningTask} task - Mining task parameters
 * @returns {Promise<void>}
 * @throws {Error} If mining operation fails
 *
 * @example
 * await worker.mineRange({
 *   start: 0,
 *   end: 1000000,
 *   target: "0x1234...",
 *   headerBase: "block_header_data",
 *   batchSize: 2000
 * });
 */
export declare class MiningWorker {
    private static readonly DEFAULT_BATCH_SIZE;
    private static readonly REPORT_INTERVAL;
    private isInitialized;
    private lastReportTime;
    private startTime;
    private hashesProcessed;
    constructor();
    private initialize;
    calculateHashRate(): number;
    private shouldReportProgress;
    mineRange({ start, end, target, headerBase, batchSize }: MiningTask): Promise<void>;
}
export {};
