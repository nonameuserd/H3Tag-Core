"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorMonitor = void 0;
const shared_1 = require("@h3tag-blockchain/shared");
class ErrorMonitor {
    constructor(windowSize = 3600000) {
        this.windowSize = windowSize;
        this.errorCounts = new Map();
        this.errorThresholds = new Map();
        this.alertCallbacks = [];
        setInterval(() => this.cleanup(), this.windowSize);
    }
    record(type, error) {
        const count = (this.errorCounts.get(type) || 0) + 1;
        this.errorCounts.set(type, count);
        const threshold = this.errorThresholds.get(type);
        if (threshold && count >= threshold) {
            this.alertCallbacks.forEach((cb) => cb(type, count));
        }
        shared_1.Logger.error(`[${type}] ${error.message}`, {
            stack: error.stack,
            count,
            timestamp: new Date().toISOString(),
        });
    }
    setThreshold(type, threshold) {
        this.errorThresholds.set(type, threshold);
    }
    onThresholdExceeded(callback) {
        this.alertCallbacks.push(callback);
    }
    cleanup() {
        this.errorCounts.clear();
    }
}
exports.ErrorMonitor = ErrorMonitor;
