import { EventEmitter } from 'events';
import { gzipSync, gunzipSync } from 'zlib';
import { Logger } from '@h3tag-blockchain/shared';
import { BLOCKCHAIN_CONSTANTS } from '../blockchain/utils/constants';

export class CacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CacheError';
  }
}

export interface CacheOptions<T> {
  ttl?: number;
  maxSize?: number;
  checkPeriod?: number;
  onEvict?: (key: string, value: T | undefined) => void;
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

interface CacheItem<T> {
  value?: T;
  expires: number;
  lastAccessed: number;
  size: number;
  compressed: boolean;
  serialized: string;
  priority: number;
  currency: string;
}

export class Cache<T> {
  private items: Map<string, CacheItem<T>>;
  private stats: CacheStats;
  private cleanupInterval: NodeJS.Timeout | undefined;
  readonly options: Required<CacheOptions<T>>;
  private memoryUsage = 0;
  private memoryThreshold = 0.9; // 90% memory threshold
  private lastMemoryCheck = Date.now();
  private readonly memoryCheckInterval = 60000; // Check every minute
  private readonly eventEmitter = new EventEmitter();
  private static readonly PRIORITIES = {
    CRITICAL: 10,
    HIGH: 5,
    NORMAL: 1,
    LOW: 0,
  };
  private static readonly COMPRESSION_THRESHOLD = 1024; // 1KB
  private static readonly MAX_COMPRESSION_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly maxItems: number;

  private static readonly DEFAULT_OPTIONS: Required<CacheOptions<unknown>> = {
    ttl: 3600,
    maxSize: 1000,
    checkPeriod: 600,
    onEvict: () => { /* no-op */ },
    serialize: JSON.stringify,
    deserialize: JSON.parse,
    maxMemory: 100 * 1024 * 1024,
    compression: true,
    priorityLevels: {
      pow: 3,
      quadratic_vote: 3,
      default: 1,
    },
    currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
  };

  private readonly MEMORY_LIMITS = {
    MAX_ENTRY_SIZE: 5 * 1024 * 1024, // 5MB per entry
    TOTAL_CACHE_SIZE: 500 * 1024 * 1024, // 500MB total
  };

  constructor(options: CacheOptions<T> = {}) {
    this.options = { ...Cache.DEFAULT_OPTIONS, ...options } as Required<
      CacheOptions<T>
    >;
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

    // Bind methods for size checking
    this.set = this.set.bind(this);
    this.checkSize = this.checkSize.bind(this);
  }

  private checkSize(value: T): boolean {
    const size = this.getObjectSize(value);
    return size <= this.MEMORY_LIMITS.MAX_ENTRY_SIZE;
  }

  private getObjectSize(obj: T): number {
    const str = JSON.stringify(obj);
    return str.length * 2; // Rough estimate in bytes
  }

  public set(
    key: string,
    value: T,
    options?: { ttl?: number; priority?: number },
  ): void {
    try {
      // Check if the object exceeds the per‑entry size limit
      if (!this.checkSize(value)) {
        throw new CacheError(
          `Value for key "${key}" exceeds the maximum entry size of ${this.MEMORY_LIMITS.MAX_ENTRY_SIZE} bytes`,
        );
      }

      // If the key already exists, deduct its previous size
      const existing = this.items.get(key);
      if (existing) {
        this.memoryUsage -= existing.size;
      }

      const serializedValue = this.options.serialize(value);
      let compressed = false;
      let finalValue = serializedValue;
      let size = serializedValue.length;

      if (
        this.options.compression &&
        size > Cache.COMPRESSION_THRESHOLD &&
        size < Cache.MAX_COMPRESSION_SIZE
      ) {
        const compressedValue = gzipSync(Buffer.from(serializedValue));
        if (compressedValue.length < size) {
          finalValue = compressedValue.toString('base64');
          size = compressedValue.length;
          compressed = true;
          value = undefined as unknown as T;
        }
      }

      if (this.memoryUsage + size > this.options.maxMemory) {
        this.evictByMemory(size);
      }

      const item: CacheItem<T> = {
        value,
        expires: Date.now() + (options?.ttl || this.options.ttl) * 1000,
        lastAccessed: Date.now(),
        size,
        compressed,
        serialized: finalValue,
        priority:
          options?.priority || this.options.priorityLevels?.default || 1,
        currency: this.options.currency,
      };

      // If the cache is full in terms of max items, evict one using LRU logic.
      if (!existing && this.items.size >= this.options.maxSize) {
        this.evictLRU();
      }

      // Store the new or updated item and update memory usage.
      this.items.set(key, item);
      this.memoryUsage += size;
      this.updateStats();
      this.eventEmitter.emit('set', {
        key,
        value,
        currency: this.options.currency,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      Logger.error(`Cache error setting key "${key}":`, errorMessage);
      throw new CacheError(`Failed to set cache key: ${errorMessage}`);
    }
  }

  public get(key: string): T | undefined {
    const item = this.items.get(key);

    if (!item) {
      this.stats.misses++;
      this.eventEmitter.emit('miss', { key, currency: this.options.currency });
      return undefined;
    }

    if (this.isExpired(item)) {
      this.delete(key);
      this.stats.misses++;
      this.eventEmitter.emit('miss', { key, currency: this.options.currency });
      return undefined;
    }

    try {
      if (item.compressed && item.value === undefined) {
        // Lazy decompress on first access
        const decompressed = gunzipSync(Buffer.from(item.serialized, 'base64'));
        item.value = this.options.deserialize(decompressed.toString());
        // Mark as decompressed so that subsequent gets use the stored value
        item.compressed = false;
      }
    } catch (error) {
      Logger.error(
        `${this.options.currency} Cache: Error decompressing value for key "${key}":`,
        error,
      );
      this.delete(key);
      return undefined;
    }

    item.lastAccessed = Date.now();
    this.stats.hits++;
    this.eventEmitter.emit('hit', {
      key,
      value: item.value,
      currency: this.options.currency,
    });
    return item.value;
  }

  public mget(keys: string[]): (T | undefined)[] {
    return keys.map((key) => this.get(key));
  }

  public mset(entries: [string, T][]): void {
    entries.forEach(([key, value]) => this.set(key, value));
  }

  private evictByMemory(requiredSize: number): void {
    if (this.shouldReduceMemoryUsage()) {
      this.enforceMemoryLimit();
    }

    // Use each item's own 'priority' property
    const entries = Array.from(this.items.entries()).sort((a, b) => {
      if (a[1].priority !== b[1].priority) return a[1].priority - b[1].priority;
      return a[1].lastAccessed - b[1].lastAccessed;
    });

    for (const [key] of entries) {
      if (this.memoryUsage + requiredSize <= this.options.maxMemory) break;
      this.delete(key);
    }
  }

  private shouldReduceMemoryUsage(): boolean {
    if (Date.now() - this.lastMemoryCheck < this.memoryCheckInterval) {
      return false;
    }

    this.lastMemoryCheck = Date.now();
    const memoryUsage = process.memoryUsage();
    return memoryUsage.heapUsed / memoryUsage.heapTotal > this.memoryThreshold;
  }

  private enforceMemoryLimit(): void {
    const entries = Array.from(this.items.entries()).sort(
      (a, b) => a[1].lastAccessed - b[1].lastAccessed,
    );

    let removed = 0;
    for (const [key] of entries) {
      if (removed >= this.items.size * 0.2) break; // Remove up to 20%
      this.delete(key);
      removed++;
    }
  }

  private updateStats(): void {
    this.stats.keys = this.items.size;
    this.stats.size = this.memoryUsage;
    this.stats.compressionRatio = this.calculateCompressionRatio();
    this.stats.memoryUsage = this.memoryUsage;
  }

  private calculateCompressionRatio(): number {
    if (this.memoryUsage === 0) return 1;
    const compressedItems = Array.from(this.items.values()).filter(
      (item) => item.compressed,
    );
    return compressedItems.length
      ? compressedItems.reduce((acc, item) => acc + item.size, 0) /
          this.memoryUsage
      : 1;
  }

  public async shutdown(): Promise<void> {
    clearInterval(this.cleanupInterval);
    this.clear();
    this.eventEmitter.emit('shutdown');
  }

  public delete(key: string): boolean {
    const item = this.items.get(key);
    if (item) {
      this.items.delete(key);
      // Update memoryUsage when an item is removed.
      this.memoryUsage -= item.size;
      this.stats.keys = this.items.size;
      this.stats.size -= item.size;
      this.options.onEvict(key, item.value);
      this.eventEmitter.emit('delete', key);
      return true;
    }
    return false;
  }

  public has(key: string): boolean {
    const item = this.items.get(key);
    if (!item) return false;
    if (this.isExpired(item)) {
      this.delete(key);
      return false;
    }
    return true;
  }

  public clear(onlyExpired = false): void {
    if (onlyExpired) {
      // Use a copy of the entries to avoid mutation issues during iteration.
      for (const [key, item] of Array.from(this.items.entries())) {
        if (this.isExpired(item)) {
          this.delete(key);
        }
      }
    } else {
      this.items.clear();
      // Reset memory usage when clearing all items.
      this.memoryUsage = 0;
      this.resetStats();
      this.eventEmitter.emit('clear');
    }
  }

  public getStats(): CacheStats {
    return { ...this.stats };
  }

  public keys(): string[] {
    return Array.from(this.items.keys());
  }

  public values(): T[] {
    return this.keys()
      .map((key) => this.get(key))
      .filter((v): v is T => v !== undefined);
  }

  public entries(): [string, T][] {
    return this.keys()
      .map((key) => [key, this.get(key)] as [string, T])
      .filter(([, value]) => value !== undefined);
  }

  public size(): number {
    return this.items.size;
  }

  private isExpired(item: CacheItem<T>): boolean {
    return Date.now() > item.expires;
  }

  private evictLRU(): void {
    let oldest: [string, CacheItem<T>] | undefined;

    for (const entry of this.items.entries()) {
      if (
        !oldest ||
        entry[1].priority < oldest[1].priority ||
        (entry[1].priority === oldest[1].priority &&
          entry[1].lastAccessed < oldest[1].lastAccessed)
      ) {
        oldest = entry;
      }
    }

    if (oldest) {
      this.delete(oldest[0]);
      this.stats.evictions++;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of Array.from(this.items.entries())) {
      if (now > item.expires) {
        this.delete(key);
      }
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      this.options.checkPeriod * 1000,
    );

    // Prevent the interval from keeping the process alive
    this.cleanupInterval.unref();
  }

  private resetStats(): void {
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

  public touch(key: string): boolean {
    const item = this.items.get(key);
    if (item && !this.isExpired(item)) {
      item.lastAccessed = Date.now();
      return true;
    }
    return false;
  }

  public ttl(key: string): number {
    const item = this.items.get(key);
    if (!item || this.isExpired(item)) return -1;
    return Math.ceil((item.expires - Date.now()) / 1000);
  }

  public getAll(): T[] {
    return this.keys()
      .map((key) => this.get(key))
      .filter((v): v is T => v !== undefined);
  }

  public prune(percentage: number): void {
    const entriesToRemove = Math.floor(this.size() * percentage);
    const entries = Array.from(this.items.entries()).sort(
      (a, b) => a[1].lastAccessed - b[1].lastAccessed,
    );

    for (let i = 0; i < entriesToRemove; i++) {
      // Use the delete method to ensure proper updates.
      this.delete(entries[i][0]);
    }
  }

  public getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : this.stats.hits / total;
  }

  public getEvictionCount(): number {
    return this.stats.evictions;
  }

  public get maxSize(): number {
    return this.maxItems;
  }

  public async prefetch(key: string): Promise<void> {
    if (!this.items.has(key)) {
      // Add a placeholder item to mark as prefetched
      this.items.set(key, {
        value: null as unknown as T,
        expires: Date.now() + this.options.ttl * 1000,
        lastAccessed: Date.now(),
        size: 0,
        compressed: false,
        serialized: '',
        priority: this.options.priorityLevels.default || 1,
        currency: this.options.currency,
      });
    }
  }
}
