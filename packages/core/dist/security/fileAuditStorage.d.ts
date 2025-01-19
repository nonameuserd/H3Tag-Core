import { IAuditStorage } from "./audit";
export declare class FileAuditStorageError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
interface StorageConfig {
    baseDir: string;
    compression: boolean;
    maxRetries: number;
    retryDelay: number;
    maxConcurrentWrites: number;
    currency?: string;
}
export declare class FileAuditStorage implements IAuditStorage {
    private readonly config;
    private locks;
    private writeQueue;
    private activeWrites;
    private readonly lockTimeout;
    private lockCleanupInterval;
    private static readonly DEFAULT_CONFIG;
    constructor(config?: Partial<StorageConfig>);
    private initialize;
    private startLockCleanup;
    private cleanupStaleLocks;
    writeAuditLog(filename: string, data: string): Promise<void>;
    readAuditLog(filename: string): Promise<string>;
    listAuditLogs(): Promise<string[]>;
    acquireLock(lockId: string): Promise<boolean>;
    releaseLock(lockId: string): Promise<void>;
    private queueWrite;
    private getFilePath;
    private compressData;
    private delay;
    dispose(): Promise<void>;
}
export {};
