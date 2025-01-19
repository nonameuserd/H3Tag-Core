"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = void 0;
const shared_1 = require("@h3tag-blockchain/shared");
class CircuitBreaker {
    constructor(config) {
        this.failures = 0;
        this.lastFailureTime = 0;
        this.state = "closed";
        this.config = {
            failureThreshold: config.failureThreshold,
            resetTimeout: config.resetTimeout,
            halfOpenTimeout: config.halfOpenTimeout || config.resetTimeout / 2,
            monitorInterval: config.monitorInterval || 1000,
        };
        this.monitorInterval = setInterval(() => this.monitor(), this.config.monitorInterval);
    }
    isOpen() {
        return this.state === "open";
    }
    recordSuccess() {
        if (this.state === "half-open") {
            this.state = "closed";
            this.failures = 0;
            this.lastFailureTime = 0;
            shared_1.Logger.info("Circuit breaker reset after successful operation");
        }
    }
    recordFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.failures >= this.config.failureThreshold) {
            this.state = "open";
            shared_1.Logger.warn("Circuit breaker opened due to failures:", {
                failures: this.failures,
                threshold: this.config.failureThreshold,
            });
        }
    }
    monitor() {
        if (this.state === "open") {
            const timeSinceLastFailure = Date.now() - this.lastFailureTime;
            if (timeSinceLastFailure >= this.config.resetTimeout) {
                this.state = "half-open";
                shared_1.Logger.info("Circuit breaker entering half-open state");
            }
        }
    }
    dispose() {
        clearInterval(this.monitorInterval);
    }
    isAvailable() {
        return !this.isOpen();
    }
    onSuccess() {
        this.failures = 0;
        this.lastFailureTime = 0;
        this.state = "closed";
    }
    onFailure() {
        this.recordFailure();
    }
    async reset() {
        this.failures = 0;
        this.lastFailureTime = 0;
        this.state = "closed";
    }
}
exports.CircuitBreaker = CircuitBreaker;
