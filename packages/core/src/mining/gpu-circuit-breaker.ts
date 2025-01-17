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

export class GPUCircuitBreaker {
  private failures = 0;
  private readonly defaultThreshold = 3;
  private readonly defaultResetTime = 300000; // 5 minutes
  private lastFailure = Date.now();
  private threshold: number;
  private resetTime: number;

  constructor(options?: { threshold?: number; resetTime?: number }) {
    this.threshold = options?.threshold ?? this.defaultThreshold;
    this.resetTime = options?.resetTime ?? this.defaultResetTime;
    this.validateSettings();
  }

  private validateSettings(): void {
    if (this.threshold <= 0 || !Number.isInteger(this.threshold)) {
      throw new Error("Threshold must be a positive integer");
    }
    if (this.resetTime <= 0) {
      throw new Error("Reset time must be positive");
    }
  }

  isOpen(): boolean {
    const now = Date.now();
    const timeSinceLastFailure = now - this.lastFailure;

    // Handle invalid timestamps
    if (timeSinceLastFailure < 0) {
      this.lastFailure = now;
      return false;
    }

    if (timeSinceLastFailure > this.resetTime) {
      this.reset();
      return false;
    }

    return this.failures >= this.threshold;
  }

  recordFailure(): void {
    // Prevent counter overflow
    if (this.failures < Number.MAX_SAFE_INTEGER) {
      this.failures++;
      this.lastFailure = Date.now();
    }
  }

  reset(): void {
    this.failures = 0;
    this.lastFailure = Date.now();
  }

  getFailureCount(): number {
    return this.failures;
  }

  getLastFailureTime(): number {
    return this.lastFailure;
  }

  setThreshold(threshold: number): void {
    this.threshold = threshold;
    this.validateSettings();
  }

  setResetTime(resetTime: number): void {
    this.resetTime = resetTime;
    this.validateSettings();
  }

  getSettings(): { threshold: number; resetTime: number } {
    return {
      threshold: this.threshold,
      resetTime: this.resetTime,
    };
  }
}
