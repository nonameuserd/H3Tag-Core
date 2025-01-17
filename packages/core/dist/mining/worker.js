"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiningWorker = void 0;
const worker_threads_1 = require("worker_threads");
const crypto_1 = require("@h3tag-blockchain/crypto");
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
class MiningWorker {
    constructor() {
        this.isInitialized = false;
        this.lastReportTime = 0;
        this.startTime = Date.now();
        this.hashesProcessed = 0n; // Change to BigInt for large numbers
        this.initialize();
    }
    async initialize() {
        try {
            await crypto_1.WasmSHA3.initialize();
            await crypto_1.SIMD.initialize();
            this.isInitialized = true;
        }
        catch (error) {
            worker_threads_1.parentPort?.postMessage({
                error: `Worker initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            });
        }
    }
    calculateHashRate() {
        const elapsedSeconds = (Date.now() - this.startTime) / 1000;
        if (elapsedSeconds <= 0)
            return 0;
        return Number(this.hashesProcessed / BigInt(Math.ceil(elapsedSeconds)));
    }
    shouldReportProgress() {
        const now = Date.now();
        if (now - this.lastReportTime >= MiningWorker.REPORT_INTERVAL) {
            this.lastReportTime = now;
            return true;
        }
        return false;
    }
    async mineRange({ start, end, target, headerBase, batchSize = MiningWorker.DEFAULT_BATCH_SIZE, }) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        if (start >= end || start < 0 || end > Number.MAX_SAFE_INTEGER) {
            worker_threads_1.parentPort?.postMessage({
                error: "Invalid range parameters",
                hashRate: this.calculateHashRate(),
            });
            return;
        }
        try {
            const targetBigInt = BigInt(target);
            for (let nonce = start; nonce < end; nonce += batchSize) {
                // Prevent overflow
                const batchEnd = Math.min(nonce + batchSize, end);
                const headerWithNonce = `${headerBase}${nonce}`;
                // Use SIMD for parallel hash computation
                const hashes = await crypto_1.SIMD.batchHashSHA3(headerWithNonce);
                this.hashesProcessed += BigInt(hashes.length);
                // Check each hash in the batch
                for (let i = 0; i < hashes.length; i++) {
                    const currentNonce = nonce + i;
                    if (currentNonce >= end)
                        break; // Prevent overflow
                    const hash = hashes[i];
                    if (!hash)
                        continue; // Skip invalid hashes
                    const hashBigInt = BigInt(`0x${hash}`);
                    if (hashBigInt <= targetBigInt) {
                        worker_threads_1.parentPort?.postMessage({
                            found: true,
                            nonce: currentNonce,
                            hash,
                            hashRate: this.calculateHashRate(),
                        });
                        return;
                    }
                }
                // Report progress periodically
                if (this.shouldReportProgress()) {
                    worker_threads_1.parentPort?.postMessage({
                        found: false,
                        progress: {
                            currentNonce: nonce,
                            timestamp: Date.now(),
                        },
                        hashRate: this.calculateHashRate(),
                    });
                }
                // Optional GC with reduced frequency
                if (global.gc && Math.random() < 0.001) {
                    // 0.1% chance to GC
                    global.gc();
                }
            }
            worker_threads_1.parentPort?.postMessage({
                found: false,
                hashRate: this.calculateHashRate(),
            });
        }
        catch (error) {
            worker_threads_1.parentPort?.postMessage({
                error: `Mining error: ${error instanceof Error ? error.message : "Unknown error"}`,
                hashRate: this.calculateHashRate(),
            });
        }
    }
}
exports.MiningWorker = MiningWorker;
MiningWorker.DEFAULT_BATCH_SIZE = 1000;
MiningWorker.REPORT_INTERVAL = 5000; // 5 seconds
// Initialize worker and handle messages with error handling
const worker = new MiningWorker();
worker_threads_1.parentPort?.on("message", async (task) => {
    try {
        await worker.mineRange(task);
    }
    catch (error) {
        worker_threads_1.parentPort?.postMessage({
            error: `Worker error: ${error instanceof Error ? error.message : "Unknown error"}`,
            hashRate: worker.calculateHashRate(),
        });
    }
});
// Handle termination gracefully
process.on("SIGTERM", () => {
    try {
        worker_threads_1.parentPort?.postMessage({
            error: "Worker terminated",
            hashRate: worker.calculateHashRate(),
        });
    }
    finally {
        process.exit(0);
    }
});
//# sourceMappingURL=worker.js.map