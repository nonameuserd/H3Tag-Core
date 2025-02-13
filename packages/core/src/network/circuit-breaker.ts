import { Logger } from '@h3tag-blockchain/shared';

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenTimeout?: number;
  monitorInterval?: number;
}

export class CircuitBreaker {
  public failures: number = 0;
  public lastFailure: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private readonly config: Required<CircuitBreakerConfig>;
  private monitorInterval: NodeJS.Timeout;
  // Track when the circuit entered the half-open state.
  private halfOpenStart: number = 0;
  // NEW: Flag to ensure only one trial call in half-open state.
  private trialCallInProgress: boolean = false;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: config.failureThreshold,
      resetTimeout: config.resetTimeout,
      halfOpenTimeout: config.halfOpenTimeout || config.resetTimeout / 2,
      monitorInterval: config.monitorInterval || 1000,
    };

    this.monitorInterval = setInterval(
      () => this.monitor(),
      this.config.monitorInterval,
    ).unref();
  }

  public get failureThreshold(): number {
    return this.config.failureThreshold;
  }

  public get resetTimeout(): number {
    return this.config.resetTimeout;
  }

  public isOpen(): boolean {
    return this.state === 'open';
  }

  /**
   * Called when a successful trial occurs.
   * In half-open, it resets the circuit to closed.
   * If success is reported while open, it logs a warning and ignores it.
   */
  public onSuccess(): void {
    if (this.state === 'half-open') {
      Logger.info(
        'Circuit breaker reset to closed state after successful trial call in half-open state',
      );
    } else if (this.state === 'open') {
      Logger.warn(
        'Success reported while circuit is open. Ignoring to maintain open state.',
      );
      return;
    }
    this.state = 'closed';
    this.failures = 0;
    this.lastFailure = 0;
    this.halfOpenStart = 0;
  }

  /**
   * Called when a failure occurs.
   * - In the closed state, failures are accumulated until the threshold is met.
   * - In half-open, any failure immediately transitions the circuit back to open.
   * - In open, additional failures are ignored so that the reset timer isn't refreshed.
   */
  public onFailure(): void {
    if (this.state === 'open') {
      // Already open; do not change lastFailure or extend the open period.
      return;
    }

    if (this.state === 'half-open') {
      this.state = 'open';
      this.failures = this.config.failureThreshold;
      this.lastFailure = Date.now();
      this.halfOpenStart = 0;
      Logger.warn(
        'Circuit breaker transitioned back to open state due to failure in half-open state',
      );
      return;
    }

    // Closed state:
    this.failures++;
    this.lastFailure = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
      Logger.warn('Circuit breaker opened due to failures', {
        failures: this.failures,
        threshold: this.config.failureThreshold,
      });
    }
  }

  /**
   * The monitor periodically checks the circuit's state.
   * - If open and the resetTimeout has elapsed, it enters half-open.
   * - If half-open and no trial call succeeds within halfOpenTimeout,
   *   it reverts back to open.
   */
  private monitor(): void {
    const now = Date.now();
    if (this.state === 'open') {
      const timeSinceLastFailure = now - this.lastFailure;
      if (timeSinceLastFailure >= this.config.resetTimeout) {
        this.state = 'half-open';
        this.halfOpenStart = now;
        Logger.info('Circuit breaker entering half-open state');
      }
    } else if (this.state === 'half-open') {
      const timeInHalfOpen = now - this.halfOpenStart;
      if (timeInHalfOpen >= this.config.halfOpenTimeout) {
        // No trial call succeeded within the allowed period; revert to open.
        this.state = 'open';
        this.lastFailure = now;
        this.failures = this.config.failureThreshold;
        this.halfOpenStart = 0;
        Logger.warn(
          'Circuit breaker reverting from half-open to open due to timeout',
        );
      }
    }
  }

  /**
   * Disposes of the monitor interval.
   * Be sure to call this when the circuit breaker is no longer needed.
   */
  public dispose(): void {
    clearInterval(this.monitorInterval);
  }

  /**
   * Indicates whether the circuit is available.
   * (half-open is considered available for trial calls)
   */
  public isAvailable(): boolean {
    return !this.isOpen();
  }

  /**
   * Resets the circuit breaker to a closed state.
   */
  public async reset(): Promise<void> {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailure = 0;
    this.halfOpenStart = 0;
  }

  /**
   * Wraps an async action in the circuit breaker.
   * If the circuit is open, immediately throws an error.
   * In half-open, only one trial call is allowed concurrently.
   * On success, resets failures; on failure, records the failure.
   */
  public async run<T>(action: () => Promise<T>): Promise<T> {
    // Simplify check: if the breaker is open, throw immediately.
    if (this.state === 'open') {
      throw new Error('Circuit breaker is open');
    }

    // NEW: In half-open state, allow only one trial call.
    let trialCallStarted = false;
    if (this.state === 'half-open') {
      if (this.trialCallInProgress) {
        throw new Error('Circuit breaker trial call already in progress');
      }
      this.trialCallInProgress = true;
      trialCallStarted = true;
    }
    
    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    } finally {
      // NEW: Clear the trial call flag if it was set.
      if (trialCallStarted) {
        this.trialCallInProgress = false;
      }
    }
  }
}
