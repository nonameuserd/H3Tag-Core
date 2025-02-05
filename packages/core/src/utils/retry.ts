interface RetryConfig {
  maxAttempts: number;
  delay: number;
  exponentialBackoff?: boolean;
  maxDelay?: number;
  retryableErrors?: Array<string | RegExp>;
  jitterFactor?: number;
}

/**
 * A custom error used to halt the retry loop immediately when a non-retryable error is encountered.
 */
class AbortRetryError extends Error {
  public originalError: unknown;

  constructor(originalError: unknown) {
    super(
      originalError instanceof Error
        ? originalError.message
        : String(originalError),
    );
    this.name = 'AbortRetryError';
    this.originalError = originalError;
  }
}

export function retry(config: RetryConfig) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      // Create a new RetryStrategy per invocation to avoid shared state and potential race conditions.
      const strategy = new RetryStrategy(config);

      return strategy.execute(async () => {
        try {
          // Attempt to call the original method.
          return await originalMethod.apply(this, args);
        } catch (error) {
          // When retryableErrors is set, abort the retry immediately for non‑retryable errors.
          if (
            config.retryableErrors &&
            !isRetryableError(error, config.retryableErrors)
          ) {
            throw new AbortRetryError(error);
          }
          // Otherwise, throw to allow the RetryStrategy to attempt a retry.
          throw error;
        }
      });
    };

    return descriptor;
  };
}

function isRetryableError(
  error: unknown,
  patterns: Array<string | RegExp>,
): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return patterns.some((pattern) =>
    pattern instanceof RegExp
      ? pattern.test(errorMessage)
      : errorMessage.includes(pattern),
  );
}

export class RetryStrategy {
  private stats = {
    attempts: 0,
    successes: 0,
    failures: 0,
    lastAttempt: 0,
    averageDelay: 0,
  };

  constructor(private config: RetryConfig) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let attempts = 0;

    while (attempts < this.config.maxAttempts) {
      try {
        this.stats.attempts++;
        this.stats.lastAttempt = Date.now();
        const result = await fn();
        this.stats.successes++;
        return result;
      } catch (error) {
        // Immediately abort if the error is marked as non-retryable.
        if (error instanceof AbortRetryError) {
          this.stats.failures++;
          throw error.originalError;
        }

        attempts++;

        if (attempts === this.config.maxAttempts) {
          this.stats.failures++;
          throw error;
        }
        // Wait before retrying.
        await new Promise((resolve) =>
          setTimeout(resolve, calculateDelay(attempts, this.config)),
        );
      }
    }
    throw new Error('Max attempts reached');
  }

  getStats() {
    return { ...this.stats };
  }
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  let delay = config.delay;

  if (config.exponentialBackoff) {
    delay = delay * Math.pow(2, attempt - 1);
  }

  const jitterFactor = config.jitterFactor ?? 0.25;
  const randomFactor = 1 - jitterFactor + Math.random() * jitterFactor * 2;
  delay = delay * randomFactor;

  if (config.maxDelay) {
    delay = Math.min(delay, config.maxDelay);
  }

  return Math.floor(delay);
}
