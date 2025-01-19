import { AuditManager } from "./audit";
import { Request, Response } from 'express';
export declare class DDoSError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
interface DDoSConfig {
    windowMs: number;
    maxRequests: {
        pow: number;
        qudraticVote: number;
        default: number;
    };
    blockDuration: number;
    whitelist: string[];
    blacklist: string[];
    trustProxy: boolean;
    banThreshold: number;
    maxTrackedIPs: number;
    cleanupInterval: number;
    currency: string;
}
interface DDoSMetrics {
    totalRequests: number;
    blockedRequests: number;
    activeBlocks: number;
    totalBans: number;
    whitelistedIPs: number;
    blacklistedIPs: number;
    memoryUsage: number;
    currency: string;
}
export declare class DDoSProtection {
    private requests;
    private blockedIPs;
    private readonly config;
    private readonly auditManager;
    private metrics;
    private cleanupInterval;
    private readonly rateLimitBuckets;
    private static readonly BUCKET_TYPES;
    private readonly eventEmitter;
    private readonly circuitBreaker;
    private static readonly PRIORITIES;
    private readonly requestTracker;
    private static readonly DEFAULT_CONFIG;
    constructor(config: Partial<DDoSConfig>, auditManager: AuditManager);
    private validateConfig;
    private initializeMetrics;
    initialize(): Promise<void>;
    middleware(): (req: Request, res: Response, next: (err?: Error) => void) => Promise<Response<any, Record<string, any>>>;
    private handleFailure;
    private getRequestType;
    private recordRequest;
    shouldBlock(ip: string, type: string): Promise<boolean>;
    private isRateLimitExceeded;
    private handleViolation;
    private blockIP;
    private getClientIP;
    private startCleanupInterval;
    private cleanupOldRecords;
    private getRetryAfter;
    getMetrics(): DDoSMetrics;
    unblockIP(ip: string): void;
    shutdown(): void;
    private getRequestRecord;
    /**
     * Checks if a request should be allowed based on rate limits
     * @param type Request type identifier
     * @param address Source address making the request
     * @returns boolean True if request is allowed, false if it should be blocked
     */
    checkRequest(type: string, address: string): boolean;
    /**
     * Logs a rate limit violation
     */
    private logViolation;
    dispose(): Promise<void>;
}
export {};
