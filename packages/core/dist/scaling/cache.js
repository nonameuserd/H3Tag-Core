"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cache = exports.CacheError = void 0;
const events_1 = require("events");
const zlib_1 = require("zlib");
const shared_1 = require("@h3tag-blockchain/shared");
const constants_1 = require("../blockchain/utils/constants");
class CacheError extends Error {
    constructor(message) {
        super(message);
        this.name = "CacheError";
    }
}
exports.CacheError = CacheError;
class Cache {
    constructor(options = {}) {
        this.memoryUsage = 0;
        this.memoryThreshold = 0.9; // 90% memory threshold
        this.lastMemoryCheck = Date.now();
        this.memoryCheckInterval = 60000; // Check every minute
        this.priorityQueue = new Map();
        this.eventEmitter = new events_1.EventEmitter();
        this.MEMORY_LIMITS = {
            MAX_ENTRY_SIZE: 5 * 1024 * 1024,
            TOTAL_CACHE_SIZE: 500 * 1024 * 1024 // 500MB total
        };
        this.options = { ...Cache.DEFAULT_OPTIONS, ...options };
        this.items = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            keys: 0,
            size: 0,
            evictions: 0,
            memoryUsage: 0,
            compressionRatio: 1,
            currency: this.options.currency,
        };
        this.maxItems = this.options.maxSize;
        this.startCleanupInterval();
        // Add size checking
        this.set = this.set.bind(this);
        this.checkSize = this.checkSize.bind(this);
    }
    checkSize(value) {
        const size = this.getObjectSize(value);
        return size <= this.MEMORY_LIMITS.MAX_ENTRY_SIZE;
    }
    getObjectSize(obj) {
        const str = JSON.stringify(obj);
        return str.length * 2; // Rough estimate in bytes
    }
    set(key, value, options) {
        try {
            const serializedValue = this.options.serialize(value);
            let compressed = false;
            let finalValue = serializedValue;
            let size = serializedValue.length;
            if (this.options.compression &&
                size > Cache.COMPRESSION_THRESHOLD &&
                size < Cache.MAX_COMPRESSION_SIZE) {
                const compressedValue = (0, zlib_1.gzipSync)(Buffer.from(serializedValue));
                if (compressedValue.length < size) {
                    finalValue = compressedValue.toString('base64');
                    size = compressedValue.length;
                    compressed = true;
                }
            }
            if (this.memoryUsage + size > this.options.maxMemory) {
                this.evictByMemory(size);
            }
            const item = {
                value,
                expires: Date.now() + (options?.ttl || this.options.ttl) * 1000,
                lastAccessed: Date.now(),
                size,
                compressed,
                serialized: finalValue,
                priority: options?.priority || this.options.priorityLevels?.default || 1,
                currency: this.options.currency,
            };
            if (this.items.size >= this.options.maxSize) {
                this.evictLRU();
            }
            this.items.set(key, item);
            this.memoryUsage += size;
            this.updateStats();
            this.eventEmitter.emit("set", { key, value, currency: this.options.currency });
        }
        catch (error) {
            shared_1.Logger.error(`Cache error setting key "${key}":`, error);
            throw new CacheError(`Failed to set cache key: ${error.message}`);
        }
    }
    get(key) {
        const item = this.items.get(key);
        if (!item) {
            this.stats.misses++;
            this.eventEmitter.emit("miss", { key, currency: this.options.currency });
            return undefined;
        }
        if (this.isExpired(item)) {
            this.delete(key);
            this.stats.misses++;
            this.eventEmitter.emit("miss", { key, currency: this.options.currency });
            return undefined;
        }
        try {
            if (item.compressed) {
                const decompressed = (0, zlib_1.gunzipSync)(Buffer.from(item.serialized, "base64"));
                item.value = this.options.deserialize(decompressed.toString());
            }
        }
        catch (error) {
            shared_1.Logger.error(`${this.options.currency} Cache: Error decompressing value for key "${key}":`, error);
            this.delete(key);
            return undefined;
        }
        item.lastAccessed = Date.now();
        this.stats.hits++;
        this.eventEmitter.emit("hit", { key, value: item.value, currency: this.options.currency });
        return item.value;
    }
    mget(keys) {
        return keys.map((key) => this.get(key));
    }
    mset(entries) {
        entries.forEach(([key, value]) => this.set(key, value));
    }
    evictByMemory(requiredSize) {
        if (this.shouldReduceMemoryUsage()) {
            this.enforceMemoryLimit();
        }
        const entries = Array.from(this.items.entries())
            .sort((a, b) => {
            const priorityA = this.priorityQueue.get(a[0]) || 0;
            const priorityB = this.priorityQueue.get(b[0]) || 0;
            if (priorityA !== priorityB)
                return priorityA - priorityB;
            return a[1].lastAccessed - b[1].lastAccessed;
        });
        for (const [key] of entries) {
            if (this.memoryUsage + requiredSize <= this.options.maxMemory)
                break;
            this.delete(key);
        }
    }
    shouldReduceMemoryUsage() {
        if (Date.now() - this.lastMemoryCheck < this.memoryCheckInterval) {
            return false;
        }
        this.lastMemoryCheck = Date.now();
        const memoryUsage = process.memoryUsage();
        return memoryUsage.heapUsed / memoryUsage.heapTotal > this.memoryThreshold;
    }
    enforceMemoryLimit() {
        const entries = Array.from(this.items.entries())
            .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        let removed = 0;
        for (const [key] of entries) {
            if (removed >= this.items.size * 0.2)
                break; // Remove up to 20%
            this.delete(key);
            removed++;
        }
    }
    updateStats() {
        this.stats.keys = this.items.size;
        this.stats.size = this.memoryUsage;
        this.stats.compressionRatio = this.calculateCompressionRatio();
    }
    calculateCompressionRatio() {
        const compressedItems = Array.from(this.items.values()).filter((item) => item.compressed);
        return compressedItems.length
            ? compressedItems.reduce((acc, item) => acc + item.size, 0) /
                this.memoryUsage
            : 1;
    }
    async shutdown() {
        clearInterval(this.cleanupInterval);
        this.clear();
        this.eventEmitter.emit("shutdown");
    }
    delete(key) {
        const item = this.items.get(key);
        if (item) {
            this.items.delete(key);
            this.stats.keys = this.items.size;
            this.stats.size -= item.size;
            this.options.onEvict(key, item.value);
            this.eventEmitter.emit("delete", key);
            return true;
        }
        return false;
    }
    has(key) {
        const item = this.items.get(key);
        if (!item)
            return false;
        if (this.isExpired(item)) {
            this.delete(key);
            return false;
        }
        return true;
    }
    clear(onlyExpired = false) {
        if (onlyExpired) {
            for (const [key, item] of this.items.entries()) {
                if (this.isExpired(item)) {
                    this.delete(key);
                }
            }
        }
        else {
            this.items.clear();
            this.resetStats();
            this.eventEmitter.emit("clear");
        }
    }
    getStats() {
        return { ...this.stats };
    }
    keys() {
        return Array.from(this.items.keys());
    }
    values() {
        return Array.from(this.items.values())
            .filter((item) => !this.isExpired(item))
            .map((item) => item.value);
    }
    entries() {
        return Array.from(this.items.entries())
            .filter(([_, item]) => !this.isExpired(item))
            .map(([key, item]) => [key, item.value]);
    }
    size() {
        return this.items.size;
    }
    isExpired(item) {
        return Date.now() > item.expires;
    }
    evictLRU() {
        let oldest;
        for (const entry of this.items.entries()) {
            if (!oldest ||
                entry[1].priority < oldest[1].priority ||
                (entry[1].priority === oldest[1].priority &&
                    entry[1].lastAccessed < oldest[1].lastAccessed)) {
                oldest = entry;
            }
        }
        if (oldest) {
            this.delete(oldest[0]);
            this.stats.evictions++;
        }
    }
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.items.entries()) {
            if (now > item.expires) {
                this.delete(key);
            }
        }
    }
    startCleanupInterval() {
        this.cleanupInterval = setInterval(() => this.cleanup(), this.options.checkPeriod * 1000);
        // Prevent the interval from keeping the process alive
        this.cleanupInterval.unref();
    }
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            keys: 0,
            size: 0,
            evictions: 0,
            memoryUsage: 0,
            compressionRatio: 1,
            currency: this.options.currency,
        };
    }
    touch(key) {
        const item = this.items.get(key);
        if (item && !this.isExpired(item)) {
            item.lastAccessed = Date.now();
            return true;
        }
        return false;
    }
    ttl(key) {
        const item = this.items.get(key);
        if (!item || this.isExpired(item))
            return -1;
        return Math.ceil((item.expires - Date.now()) / 1000);
    }
    getAll() {
        return Array.from(this.items.values()).map((item) => item.value);
    }
    prune(percentage) {
        const entriesToRemove = Math.floor(this.size() * percentage);
        const entries = Array.from(this.items.entries())
            .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        for (let i = 0; i < entriesToRemove; i++) {
            this.items.delete(entries[i][0]);
        }
    }
    getHitRate() {
        const total = this.stats.hits + this.stats.misses;
        return total === 0 ? 0 : this.stats.hits / total;
    }
    getEvictionCount() {
        return this.stats.evictions;
    }
    get maxSize() {
        return this.maxItems;
    }
}
exports.Cache = Cache;
Cache.PRIORITIES = {
    CRITICAL: 10,
    HIGH: 5,
    NORMAL: 1,
    LOW: 0
};
Cache.COMPRESSION_THRESHOLD = 1024; // 1KB
Cache.MAX_COMPRESSION_SIZE = 50 * 1024 * 1024; // 50MB
Cache.DEFAULT_OPTIONS = {
    ttl: 3600,
    maxSize: 1000,
    checkPeriod: 600,
    onEvict: () => { },
    serialize: JSON.stringify,
    deserialize: JSON.parse,
    maxMemory: 100 * 1024 * 1024,
    compression: true,
    priorityLevels: {
        pow: 3,
        quadratic_vote: 3,
        default: 1,
    },
    currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
};
//# sourceMappingURL=cache.js.map