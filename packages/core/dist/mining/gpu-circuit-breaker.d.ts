/**
 * @fileoverview GPUCircuitBreaker implements a circuit breaker pattern for GPU mining operations.
 * It provides fault tolerance and prevents cascading failures by monitoring GPU operations
 * and temporarily disabling mining when error thresholds are exceeded.
 *
 * @module GPUCircuitBreaker
 */
/**
 * GPUCircuitBreaker manages GPU mining fault tolerance with configurable thresholds.
 *
 * @class GPUCircuitBreaker
 *
 * @property {number} failures - Count of consecutive failures
 * @property {number} defaultThreshold - Default failure threshold (3)
 * @property {number} defaultResetTime - Default reset time in ms (300000 = 5 minutes)
 * @property {number} lastFailure - Timestamp of last failure
 * @property {number} threshold - Current failure threshold
 * @property {number} resetTime - Current reset time in ms
 *
 * @example
 * const breaker = new GPUCircuitBreaker({
 *   threshold: 5,
 *   resetTime: 600000 // 10 minutes
 * });
 *
 * if (!breaker.isOpen()) {
 *   try {
 *     await mineBlock();
 *   } catch (error) {
 *     breaker.recordFailure();
 *   }
 * }
 */
/**
 * Checks if circuit breaker is open (tripped)
 *
 * @method isOpen
 * @returns {boolean} True if circuit breaker is open
 *
 * @example
 * if (!breaker.isOpen()) {
 *   // Safe to proceed with GPU operations
 * }
 */
/**
 * Records a failure event
 *
 * @method recordFailure
 * @returns {void}
 *
 * @example
 * try {
 *   await gpuOperation();
 * } catch (error) {
 *   breaker.recordFailure();
 * }
 */
/**
 * Resets the circuit breaker state
 *
 * @method reset
 * @returns {void}
 *
 * @example
 * breaker.reset();
 */
/**
 * Gets current failure count
 *
 * @method getFailureCount
 * @returns {number} Current number of consecutive failures
 *
 * @example
 * const failures = breaker.getFailureCount();
 */
/**
 * Gets timestamp of last failure
 *
 * @method getLastFailureTime
 * @returns {number} Timestamp of last failure
 *
 * @example
 * const lastFailure = breaker.getLastFailureTime();
 */
/**
 * Updates failure threshold
 *
 * @method setThreshold
 * @param {number} threshold - New failure threshold
 * @throws {Error} If threshold is not a positive integer
 *
 * @example
 * breaker.setThreshold(5);
 */
/**
 * Updates reset time
 *
 * @method setResetTime
 * @param {number} resetTime - New reset time in milliseconds
 * @throws {Error} If reset time is not positive
 *
 * @example
 * breaker.setResetTime(600000); // 10 minutes
 */
/**
 * Gets current circuit breaker settings
 *
 * @method getSettings
 * @returns {{ threshold: number; resetTime: number }} Current settings
 *
 * @example
 * const { threshold, resetTime } = breaker.getSettings();
 */
export declare class GPUCircuitBreaker {
    private failures;
    private readonly defaultThreshold;
    private readonly defaultResetTime;
    private lastFailure;
    private threshold;
    private resetTime;
    constructor(options?: {
        threshold?: number;
        resetTime?: number;
    });
    private validateSettings;
    isOpen(): boolean;
    recordFailure(): void;
    reset(): void;
    getFailureCount(): number;
    getLastFailureTime(): number;
    setThreshold(threshold: number): void;
    setResetTime(resetTime: number): void;
    getSettings(): {
        threshold: number;
        resetTime: number;
    };
}
