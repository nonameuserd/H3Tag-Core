"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryStrategy = exports.retry = void 0;
function retry(config) {
    return function (_target, _propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        const strategy = new RetryStrategy(config);
        descriptor.value = async function (...args) {
            return strategy.execute(async () => {
                try {
                    return await originalMethod.apply(this, args);
                }
                catch (error) {
                    // Only retry on specified errors if configured
                    if (config.retryableErrors && !isRetryableError(error, config.retryableErrors)) {
                        throw error;
                    }
                    throw error;
                }
            });
        };
        return descriptor;
    };
}
exports.retry = retry;
function isRetryableError(error, patterns) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return patterns.some(pattern => pattern instanceof RegExp
        ? pattern.test(errorMessage)
        : errorMessage.includes(pattern));
}
class RetryStrategy {
    constructor(config) {
        this.config = config;
        this.stats = {
            attempts: 0,
            successes: 0,
            failures: 0,
            lastAttempt: 0,
            averageDelay: 0
        };
    }
    async execute(fn) {
        let attempts = 0;
        while (attempts < this.config.maxAttempts) {
            try {
                this.stats.attempts++;
                this.stats.lastAttempt = Date.now();
                const result = await fn();
                this.stats.successes++;
                return result;
            }
            catch (error) {
                attempts++;
                if (attempts === this.config.maxAttempts) {
                    this.stats.failures++;
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, calculateDelay(attempts, this.config)));
            }
        }
        throw new Error('Max attempts reached');
    }
    getStats() {
        return { ...this.stats };
    }
}
exports.RetryStrategy = RetryStrategy;
function calculateDelay(attempt, config) {
    let delay = config.delay;
    if (config.exponentialBackoff) {
        delay = delay * Math.pow(2, attempt - 1);
    }
    const jitterFactor = config.jitterFactor ?? 0.25;
    const randomFactor = 1 - jitterFactor + (Math.random() * jitterFactor * 2);
    delay = delay * randomFactor;
    if (config.maxDelay) {
        delay = Math.min(delay, config.maxDelay);
    }
    return Math.floor(delay);
}
//# sourceMappingURL=retry.js.map