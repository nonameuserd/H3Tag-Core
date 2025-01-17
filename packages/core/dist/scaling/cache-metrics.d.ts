export declare class CacheMetrics {
    private hits;
    private misses;
    recordHit(): void;
    recordMiss(): void;
    getHitRate(): number;
}
