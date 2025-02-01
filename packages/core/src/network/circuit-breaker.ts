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
  public resetTimeout: number;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private readonly config: Required<CircuitBreakerConfig>;
  private monitorInterval: NodeJS.Timeout;

  constructor(config: CircuitBreakerConfig) {
    this.resetTimeout = config.resetTimeout;
    this.config = {
      failureThreshold: config.failureThreshold,
      resetTimeout: config.resetTimeout,
      halfOpenTimeout: config.halfOpenTimeout || config.resetTimeout / 2,
      monitorInterval: config.monitorInterval || 1000,
    };

    this.monitorInterval = setInterval(
      () => this.monitor(),
      this.config.monitorInterval,
    );
  }

  public get failureThreshold(): number {
    return this.config.failureThreshold;
  }

  isOpen(): boolean {
    return this.state === 'open';
  }

  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.failures = 0;
      this.lastFailure = 0;
      Logger.info('Circuit breaker reset after successful operation');
    }
  }

  recordFailure(): void {
    if (this.state === 'half-open') {
      this.state = 'open';
      this.failures = this.config.failureThreshold;
      this.lastFailure = Date.now();
      Logger.warn('Circuit breaker transitioned back to open state due to a failure in half-open state');
      return;
    }
    
    this.failures++;
    this.lastFailure = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
      Logger.warn('Circuit breaker opened due to failures:', {
        failures: this.failures,
        threshold: this.config.failureThreshold,
      });
    }
  }

  private monitor(): void {
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailure;

      if (timeSinceLastFailure >= this.config.resetTimeout) {
        this.state = 'half-open';
        Logger.info('Circuit breaker entering half-open state');
      }
    }
  }

  dispose(): void {
    clearInterval(this.monitorInterval);
  }

  public isAvailable(): boolean {
    return !this.isOpen();
  }

  public onSuccess(): void {
    this.failures = 0;
    this.lastFailure = 0;
    this.state = 'closed';
  }

  public onFailure(): void {
    this.recordFailure();
  }

  public async reset(): Promise<void> {
    this.failures = 0;
    this.lastFailure = 0;
    this.state = 'closed';
  }
}
