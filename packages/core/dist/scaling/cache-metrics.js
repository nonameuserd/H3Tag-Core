"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheMetrics = void 0;
class CacheMetrics {
    constructor() {
        this.hits = 0;
        this.misses = 0;
    }
    recordHit() {
        this.hits++;
    }
    recordMiss() {
        this.misses++;
    }
    getHitRate() {
        const total = this.hits + this.misses;
        return total === 0 ? 0 : this.hits / total;
    }
}
exports.CacheMetrics = CacheMetrics;
//# sourceMappingURL=cache-metrics.js.map