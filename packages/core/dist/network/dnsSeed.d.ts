import { ConfigService } from "@h3tag-blockchain/shared";
import { BlockchainSchema } from "../database/blockchain-schema";
import { EventEmitter } from "events";
export declare enum NetworkType {
    MAINNET = "mainnet",
    TESTNET = "testnet",
    DEVNET = "devnet"
}
export declare class DNSSeederError extends Error {
    readonly code?: string;
    constructor(message: string, code?: string);
}
export interface DNSSeederConfig {
    networkType: NetworkType;
    region?: string;
    minPeers: number;
    maxPeers: number;
    port: number;
    timeout: number;
    retryDelay: number;
    maxRetries: number;
    cacheExpiry: number;
    requiredServices: number;
    banThreshold: number;
    seedRanking: boolean;
}
export declare class DNSSeeder extends EventEmitter {
    private readonly configService;
    private readonly db;
    private readonly resolve4Async;
    private readonly resolve6Async;
    private readonly lookupAsync;
    private readonly seedDomains;
    private readonly config;
    private readonly activeSeeds;
    private readonly seedCache;
    private readonly metrics;
    private readonly mutex;
    private readonly circuitBreaker;
    private isRunning;
    private discoveryTimer?;
    constructor(configService: ConfigService, db: BlockchainSchema, config?: Partial<DNSSeederConfig>);
    start(): Promise<void>;
    stop(): Promise<void>;
    private loadCachedSeeds;
    private saveSeedsToCache;
    discoverPeers(): Promise<string[]>;
    private resolvePeers;
    private resolveWithRetry;
    private rankPeers;
    private calculatePeerScore;
    private updateSeedMetrics;
    private handleSeedFailure;
    private handleCacheEviction;
    private isValidSeed;
    private formatPeerUrls;
    private isValidIpAddress;
    getActiveSeedCount(): number;
    getSeedCount(): number;
    getCachedPeerCount(): number;
    private loadSeeds;
    private validateSeeds;
    private startDiscovery;
    getPowNodeCount(): number;
    getVotingNodeCount(): number;
    getNetworkHashrate(): number;
    getTagHolderCount(): Promise<number>;
    getTagDistribution(): Promise<number>;
    dispose(): Promise<void>;
}
