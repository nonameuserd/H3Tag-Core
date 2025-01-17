import { AuditManager } from "./audit";
import { Request, Response, NextFunction } from "express";
export declare class RateLimitError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
interface RateLimitRequest extends Request {
    consensusType?: "pow" | "quadraticVote" | "default";
    headers: {
        "x-forwarded-for"?: string;
    };
}
interface RateLimitResponse extends Response {
    setHeader(name: string, value: string | number): this;
}
interface RateLimitConfig {
    windowMs: number;
    maxRequests: {
        pow: number;
        qudraticVote: number;
        default: number;
    };
    keyGenerator?: (req: any) => string;
    handler?: (req: any, res: any, next: Function) => void;
    skip?: (req: any) => boolean;
    keyPrefix?: string;
    skipFailedRequests?: boolean;
    headers?: boolean;
    trustProxy?: boolean;
    maxKeys?: number;
    blockDuration?: number;
    priorityLevels?: {
        pow: number;
        quadratic_vote: number;
        default: number;
    };
}
interface RateLimitMetrics {
    totalRequests: number;
    blockedRequests: number;
    activeKeys: number;
    memoryUsage: number;
    currency: string;
}
export declare class RateLimit {
    private readonly eventEmitter;
    private limiter;
    private readonly config;
    private readonly auditManager;
    private metrics;
    private limits;
    private readonly MAX_REQUESTS;
    private readonly WINDOW_MS;
    private static readonly DEFAULT_CONFIG;
    constructor(config: Partial<RateLimitConfig>, auditManager: AuditManager);
    private validateConfig;
    private initializeMetrics;
    middleware(): (req: RateLimitRequest, res: RateLimitResponse, next: NextFunction) => Promise<void>;
    private checkRateLimit;
    private incrementCounter;
    private defaultKeyGenerator;
    private defaultHandler;
    private setHeaders;
    getMetrics(): RateLimitMetrics;
    resetLimit(key: string): void;
    shutdown(): Promise<void>;
    checkLimit(key: string, type?: "pow" | "quadraticVote" | "default"): Promise<boolean>;
    on(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    removeAllListeners(): void;
    getActiveKeys(): string[];
    getLastAccess(key: string): number;
}
export {};
