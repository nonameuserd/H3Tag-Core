export declare class CacheError extends Error {
    constructor(message: string);
}
interface CacheOptions<T> {
    ttl?: number;
    maxSize?: number;
    checkPeriod?: number;
    onEvict?: (key: string, value: T) => void;
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
    maxMemory?: number;
    compression?: boolean;
    priorityLevels?: {
        pow?: number;
        quadratic_vote?: number;
        consensus?: number;
        unspent?: number;
        recent?: number;
        default?: number;
        active?: number;
    };
    currency?: string;
}
interface CacheStats {
    hits: number;
    misses: number;
    keys: number;
    size: number;
    evictions: number;
    memoryUsage: number;
    compressionRatio: number;
    currency: string;
}
export declare class Cache<T> {
    private items;
    private stats;
    private cleanupInterval;
    readonly options: Required<CacheOptions<T>>;
    private memoryUsage;
    private memoryThreshold;
    private lastMemoryCheck;
    private readonly memoryCheckInterval;
    private priorityQueue;
    private readonly eventEmitter;
    private static readonly PRIORITIES;
    private static readonly COMPRESSION_THRESHOLD;
    private static readonly MAX_COMPRESSION_SIZE;
    private readonly maxItems;
    private static readonly DEFAULT_OPTIONS;
    private readonly MEMORY_LIMITS;
    constructor(options?: CacheOptions<T>);
    private checkSize;
    private getObjectSize;
    set(key: string, value: T, options?: {
        ttl?: number;
        priority?: number;
    }): void;
    get(key: string): T | undefined;
    mget(keys: string[]): (T | undefined)[];
    mset(entries: [string, T][]): void;
    private evictByMemory;
    private shouldReduceMemoryUsage;
    private enforceMemoryLimit;
    private updateStats;
    private calculateCompressionRatio;
    shutdown(): Promise<void>;
    delete(key: string): boolean;
    has(key: string): boolean;
    clear(onlyExpired?: boolean): void;
    getStats(): CacheStats;
    keys(): string[];
    values(): T[];
    entries(): [string, T][];
    size(): number;
    private isExpired;
    private evictLRU;
    private cleanup;
    private startCleanupInterval;
    private resetStats;
    touch(key: string): boolean;
    ttl(key: string): number;
    getAll(): T[];
    prune(percentage: number): void;
    getHitRate(): number;
    getEvictionCount(): number;
    get maxSize(): number;
}
export {};
