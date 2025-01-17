export declare class AuditError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
interface AuditEventOptions {
    type: AuditEventType;
    severity: AuditSeverity;
    source: string;
    details: Record<string, unknown>;
    data?: Record<string, unknown>;
    currency?: string;
    action?: string;
    timestamp?: number;
    votingPeriod?: number;
    result?: string;
    newChainId?: string;
    oldChainId?: string;
    approvalRatio?: number;
    totalVotes?: number;
}
interface AuditEvent {
    id: string;
    timestamp: number;
    type: AuditEventType;
    severity: AuditSeverity;
    source: string;
    details: Record<string, unknown>;
    hash: string;
    lastSynced?: number;
    currency: string;
}
export interface IAuditStorage {
    writeAuditLog(filename: string, data: string): Promise<void>;
    readAuditLog(filename: string): Promise<string>;
    listAuditLogs(): Promise<string[]>;
    acquireLock(lockId: string): Promise<boolean>;
    releaseLock(lockId: string): Promise<void>;
}
export declare enum AuditEventType {
    CONSENSUS = "CONSENSUS",
    POW_BLOCK = "POW_BLOCK",
    VOTE = "VOTE",
    SECURITY = "SECURITY",
    VALIDATION = "VALIDATION",
    VOTING_HEALTH_CHECK_FAILED = "VOTING_HEALTH_CHECK_FAILED",
    CONSENSUS_HEALTH_CHECK_FAILED = "CONSENSUS_HEALTH_CHECK_FAILED",
    MEMPOOL_HEALTH_CHECK_FAILED = "MEMPOOL_HEALTH_CHECK_FAILED",
    MINING_HEALTH_CHECK_FAILED = "MINING_HEALTH_CHECK_FAILED",
    CURRENCY_VALIDATION_FAILED = "CURRENCY_VALIDATION_FAILED",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    VALIDATION_FAILED = "VALIDATION_FAILED",
    BLOCK_VALIDATED = "BLOCK_VALIDATED",
    VOTE_HANDLING_ERROR = "VOTE_HANDLING_ERROR",
    VALIDATION_SUCCESS = "VALIDATION_SUCCESS",
    TYPE = "node_selection",
    CACHE_EVICTION = "CACHE_EVICTION",
    POW_CONTRIBUTION_CHECKED = "POW_CONTRIBUTION_CHECKED",
    POW_CONTRIBUTION_FAILED = "POW_CONTRIBUTION_FAILED",
    VOTE_VERIFIED = "VOTE_VERIFIED",
    VOTE_VERIFICATION_FAILED = "VOTE_VERIFICATION_FAILED",
    VOTE_TRANSACTION_ADDED = "VOTE_TRANSACTION_ADDED",
    VOTE_TRANSACTION_FAILED = "VOTE_TRANSACTION_FAILED",
    REPUTATION_DATA_LOADED = "REPUTATION_DATA_LOADED",
    REPUTATION_LOAD_FAILED = "REPUTATION_LOAD_FAILED",
    REPUTATION_UPDATED = "REPUTATION_UPDATED",
    REPUTATION_UPDATE_FAILED = "REPUTATION_UPDATE_FAILED",
    MERKLE_ERROR = "MERKLE_ERROR",
    VALIDATOR_SUSPENSION = "VALIDATOR_SUSPENSION",
    VALIDATOR_ABSENCE_HANDLING_FAILED = "VALIDATOR_ABSENCE_HANDLING_FAILED",
    BACKUP_VALIDATOR_SELECTED = "BACKUP_VALIDATOR_SELECTED",
    BACKUP_SELECTION_FAILED = "BACKUP_SELECTION_FAILED",
    VALIDATOR_BACKUP_ASSIGNED = "VALIDATOR_BACKUP_ASSIGNED",
    VALIDATOR_BACKUP_FAILED = "VALIDATOR_BACKUP_FAILED",
    TRANSACTIONS_ADDED = "TRANSACTIONS_ADDED",
    TRANSACTIONS_FAILED = "TRANSACTIONS_FAILED",
    LARGE_MERKLE_TREE = "LARGE_MERKLE_TREE",
    OLD_TRANSACTIONS_REMOVED = "OLD_TRANSACTIONS_REMOVED",
    TRANSACTION_INPUT_ADDED = "TRANSACTION_INPUT_ADDED",
    TRANSACTION_OUTPUT_ADDED = "TRANSACTION_OUTPUT_ADDED",
    FEE_CALCULATION_FAILED = "FEE_CALCULATION_FAILED",
    FEE_BUCKET_UPDATE_FAILED = "FEE_BUCKET_UPDATE_FAILED",
    SHARD_INITIALIZED = "SHARD_INITIALIZED",
    SHARD_RESHARD = "SHARD_RESHARD",
    SHARD_SYNC_FAILED = "SHARD_SYNC_FAILED",
    SHARD_TX_LOOKUP_FAILED = "SHARD_TX_LOOKUP_FAILED",
    SHARD_HEALTH_CHECK = "SHARD_HEALTH_CHECK",
    DDOS_VIOLATION = "DDOS_VIOLATION",
    TRANSACTION_VALIDATION_FAILED = "TRANSACTION_VALIDATION_FAILED",
    TRANSACTION_COMMIT = "TRANSACTION_COMMIT"
}
export declare enum AuditSeverity {
    INFO = "INFO",
    WARNING = "WARNING",
    ERROR = "ERROR",
    CRITICAL = "CRITICAL",
    HIGH = "HIGH"
}
export declare class AuditManager {
    private readonly eventEmitter;
    private events;
    private eventCache;
    private syncInterval;
    private readonly config;
    private readonly storage;
    private metrics;
    private readonly auditorsConsensus;
    private static readonly DEFAULT_CONFIG;
    private static readonly BATCH_SIZE;
    private static readonly MAX_RETRY_ATTEMPTS;
    private static readonly RETRY_DELAY;
    private static readonly MAX_EVENT_AGE;
    constructor(storage?: IAuditStorage);
    private validateConfig;
    initialize(): Promise<void>;
    logEvent(options: AuditEventOptions): Promise<string>;
    private storeEvent;
    private evictStaleEvents;
    queryEvents(options: {
        startTime?: number;
        endTime?: number;
        type?: AuditEventType[];
        severity?: AuditSeverity[];
        source?: string[];
        currency?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        events: AuditEvent[];
        total: number;
        hasMore: boolean;
    }>;
    private syncEvents;
    private compressEvents;
    private generateEventId;
    private calculateEventHash;
    private handleCriticalEvent;
    private startSyncInterval;
    getMetrics(): Record<string, number>;
    verifyEventIntegrity(event: AuditEvent): Promise<boolean>;
    shutdown(): Promise<void>;
    logConsensusEvent(options: {
        type: "block_mined" | "vote_cast" | "consensus_reached";
        blockHeight: number;
        minerAddress?: string;
        voterAddress?: string;
        votingPower?: bigint;
        powDifficulty?: number;
        timestamp: number;
    }): Promise<string>;
    log(eventType: AuditEventType, data: {
        [key: string]: any;
    }): Promise<void>;
    getAuditorsConsensus(): AuditorsConsensus;
    getAuditorSignature(auditorId: string, voteId: string): Promise<string>;
    cleanup(): Promise<void>;
    dispose(): Promise<void>;
    on(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    removeAllListeners(): void;
}
export interface AuditorsConsensus {
    validateAuditor(auditorId: string): Promise<boolean>;
    getActiveAuditors(): Promise<string[]>;
}
export declare class DefaultAuditorsConsensus implements AuditorsConsensus {
    private readonly auditManager;
    private readonly requiredMajority;
    private readonly activeAuditors;
    constructor(auditManager: AuditManager);
    validateAuditor(auditorId: string): Promise<boolean>;
    getActiveAuditors(): Promise<string[]>;
    dispose(): Promise<void>;
}
export {};
