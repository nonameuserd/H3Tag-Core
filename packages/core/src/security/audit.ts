import { EventEmitter } from "events";
import { Cache } from "../scaling/cache";
import { HybridCrypto } from "@h3tag-blockchain/crypto";
import zlib from "zlib";
import { Logger } from "@h3tag-blockchain/shared";
import { BLOCKCHAIN_CONSTANTS } from "../blockchain/utils/constants";
import { DefaultAuditStorage } from "./default-audit-storage";

export class AuditError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "AuditError";
  }
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

export enum AuditEventType {
  CONSENSUS = "CONSENSUS", // Combined PoW + Direct Voting events
  POW_BLOCK = "POW_BLOCK", // New block mined
  VOTE = "VOTE", // Direct token holder vote
  SECURITY = "SECURITY", // Security-related events
  VALIDATION = "VALIDATION", // Block/transaction validation
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
  TRANSACTION_COMMIT = "TRANSACTION_COMMIT",
}

export enum AuditSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  CRITICAL = "CRITICAL",
  HIGH = "HIGH",
}

interface AuditConfig {
  enabled?: boolean;
  auditPath?: string;
  retentionPeriod: number; // Days to keep audit logs
  maxEvents: number; // Maximum number of events to store
  batchSize: number; // Number of events to process in batch
  syncInterval: number; // Milliseconds between syncs
  enableCompression: boolean; // Enable log compression
  compressionLevel: number; // Compression level (1-9)
  maxRetries: number; // Maximum retry attempts for failed operations
  auditInterval: number;
}

interface AuditMetrics {
  totalEvents: number;
  failedEvents: number;
  syncLatency: number;
  compressionRatio: number;
  lastSync: number;
  evictedEvents: number;
  eventsRemoved: number;
}

export class AuditManager {
  private readonly eventEmitter = new EventEmitter();
  private events: Map<string, AuditEvent>;
  private eventCache: Cache<AuditEvent>;
  private syncInterval: NodeJS.Timeout;
  private readonly config: AuditConfig;
  private readonly storage: IAuditStorage;
  private metrics: AuditMetrics = {
    totalEvents: 0,
    failedEvents: 0,
    syncLatency: 0,
    compressionRatio: 1,
    lastSync: 0,
    evictedEvents: 0,
    eventsRemoved: 0,
  };
  private readonly auditorsConsensus: AuditorsConsensus;

  private static readonly DEFAULT_CONFIG: AuditConfig = {
    retentionPeriod: 90,
    maxEvents: 1000000,
    batchSize: 1000,
    syncInterval: 300000,
    enableCompression: true,
    compressionLevel: 6,
    maxRetries: 3,
    enabled: false,
    auditPath: "./audit",
    auditInterval: 60000,
  };

  private static readonly BATCH_SIZE = 1000;
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second
  private static readonly MAX_EVENT_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(storage?: IAuditStorage) {
    this.storage = storage || new DefaultAuditStorage();
    this.config = { ...AuditManager.DEFAULT_CONFIG };
    this.auditorsConsensus = new DefaultAuditorsConsensus(this);
    this.validateConfig(this.config);

    this.events = new Map();
    this.eventCache = new Cache<AuditEvent>({
      ttl: this.config.retentionPeriod * 24 * 60 * 60,
      maxSize: this.config.maxEvents,
      compression: true,
    });

    this.initialize();
  }

  private validateConfig(config: AuditConfig): void {
    if (config.retentionPeriod < 1) {
      throw new AuditError("Invalid retention period", "INVALID_CONFIG");
    }
    if (config.maxEvents < 1) {
      throw new AuditError("Invalid max events", "INVALID_CONFIG");
    }
    if (config.batchSize < 1 || config.batchSize > config.maxEvents) {
      throw new AuditError("Invalid batch size", "INVALID_CONFIG");
    }
  }

  public async initialize(): Promise<void> {
    this.startSyncInterval();
    this.eventEmitter.emit("initialized");
    Logger.info("Audit manager initialized");
  }

  public async logEvent(options: AuditEventOptions): Promise<string> {
    try {
      if (!options.source || !options.type || !options.severity) {
        throw new AuditError(
          "Missing required audit event fields",
          "INVALID_INPUT"
        );
      }

      const event: AuditEvent = {
        id: await this.generateEventId(),
        timestamp: Date.now(),
        ...options,
        currency: options.currency || BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        hash: "",
      };

      event.hash = await this.calculateEventHash(event);
      await this.storeEvent(event);

      this.metrics.totalEvents++;
      this.eventEmitter.emit("event_logged", {
        id: event.id,
        type: event.type,
        currency: event.currency,
      });

      if (event.severity === AuditSeverity.CRITICAL) {
        this.handleCriticalEvent(event);
      }

      return event.id;
    } catch (error) {
      this.metrics.failedEvents++;
      Logger.error(
        `Failed to log ${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} audit event:`,
        error
      );
      throw new AuditError(
        `Failed to log ${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} event: ${error.message}`,
        "LOG_FAILED"
      );
    }
  }

  private async storeEvent(event: AuditEvent): Promise<void> {
    this.events.set(event.id, event);
    this.eventCache.set(event.id, event);

    if (this.events.size >= this.config.maxEvents) {
      await this.evictStaleEvents();
    }

    Logger.debug(
      `${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} audit event stored:`,
      {
        id: event.id,
        type: event.type,
        severity: event.severity,
      }
    );
  }

  private async evictStaleEvents(): Promise<void> {
    const cutoffTime =
      Date.now() - this.config.retentionPeriod * 24 * 60 * 60 * 1000;
    const evictedEvents = Array.from(this.events.values()).filter(
      (event) => event.timestamp < cutoffTime
    );

    for (const event of evictedEvents) {
      this.events.delete(event.id);
      this.eventCache.delete(event.id);
    }

    this.metrics.evictedEvents += evictedEvents.length;
    this.eventEmitter.emit("events_evicted", { count: evictedEvents.length });
  }

  public async queryEvents(options: {
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
  }> {
    const {
      startTime = Date.now() - 24 * 60 * 60 * 1000,
      endTime = Date.now(),
      type,
      severity,
      source,
      currency = BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
      limit = 100,
      offset = 0,
    } = options;

    const filteredEvents = Array.from(this.events.values())
      .filter(
        (event) =>
          event.timestamp >= startTime &&
          event.timestamp <= endTime &&
          (!type?.length || type.includes(event.type)) &&
          (!severity?.length || severity.includes(event.severity)) &&
          (!source?.length || source.includes(event.source)) &&
          (!currency || event.currency === currency)
      )
      .sort((a, b) => b.timestamp - a.timestamp);

    const total = filteredEvents.length;
    const events = filteredEvents.slice(offset, offset + limit);

    return {
      events,
      total,
      hasMore: offset + limit < total,
    };
  }

  private async syncEvents(): Promise<void> {
    if (this.events.size === 0) return;

    const batch = Array.from(this.events.values()).slice(
      0,
      AuditManager.BATCH_SIZE
    );
    let retryCount = 0;

    while (retryCount < AuditManager.MAX_RETRY_ATTEMPTS) {
      try {
        const compressed = await this.compressEvents(batch);
        await this.storage.writeAuditLog(`audit_${Date.now()}.log`, compressed);

        batch.forEach((event) => this.events.delete(event.id));
        this.metrics.lastSync = Date.now();
        this.eventEmitter.emit("sync_complete", batch.length);
        return;
      } catch (error) {
        retryCount++;
        if (retryCount === AuditManager.MAX_RETRY_ATTEMPTS) {
          Logger.error("Max retry attempts reached for sync:", error);
          this.eventEmitter.emit("sync_failed", error);
          throw error;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, AuditManager.RETRY_DELAY)
        );
      }
    }
  }

  private async compressEvents(events: AuditEvent[]): Promise<string> {
    try {
      const data = JSON.stringify(events);
      const originalSize = data.length;

      return new Promise((resolve, reject) => {
        zlib.gzip(
          data,
          {
            level: this.config.compressionLevel,
            memLevel: 9,
            strategy: 0,
          },
          (error, compressed) => {
            if (error) {
              reject(new AuditError(error.message, "COMPRESSION_FAILED"));
            } else {
              this.metrics.compressionRatio = compressed.length / originalSize;
              resolve(compressed.toString("base64"));
            }
          }
        );
      });
    } catch (error) {
      Logger.error("Compression failed:", error);
      throw new AuditError("Failed to compress events", "COMPRESSION_ERROR");
    }
  }

  private async generateEventId(): Promise<string> {
    const entropy = Buffer.from(
      Date.now().toString() + Math.random().toString()
    );
    return HybridCrypto.generateSharedSecret(entropy);
  }

  private async calculateEventHash(event: AuditEvent): Promise<string> {
    const { hash, ...eventWithoutHash } = event;
    const data = Buffer.from(JSON.stringify(eventWithoutHash));
    return HybridCrypto.generateSharedSecret(data);
  }

  private handleCriticalEvent(event: AuditEvent): void {
    Logger.error("Critical audit event:", event);
    this.eventEmitter.emit("critical_event", event);
  }

  private startSyncInterval(): void {
    this.syncInterval = setInterval(() => {
      this.syncEvents().catch((error) => {
        Logger.error("Failed to sync audit events:", error);
      });
    }, this.config.syncInterval);

    this.syncInterval.unref();
  }

  public getMetrics(): Record<string, number> {
    return { ...this.metrics };
  }

  public async verifyEventIntegrity(event: AuditEvent): Promise<boolean> {
    const calculatedHash = await this.calculateEventHash({
      ...event,
      hash: "",
    });
    return calculatedHash === event.hash;
  }

  public async shutdown(): Promise<void> {
    clearInterval(this.syncInterval);
    await this.syncEvents(); // Final sync
    this.eventCache.shutdown();
    this.events.clear();
    this.eventEmitter.emit("shutdown");
    Logger.info("Audit manager shutdown");
  }

  public async logConsensusEvent(options: {
    type: "block_mined" | "vote_cast" | "consensus_reached";
    blockHeight: number;
    minerAddress?: string;
    voterAddress?: string;
    votingPower?: bigint;
    powDifficulty?: number;
    timestamp: number;
  }): Promise<string> {
    return this.logEvent({
      type: AuditEventType.CONSENSUS,
      severity: AuditSeverity.INFO,
      source: options.minerAddress || options.voterAddress || "system",
      details: options,
    });
  }

  async log(
    eventType: AuditEventType,
    data: { [key: string]: any }
  ): Promise<void> {
    const auditLog = {
      eventType,
      timestamp: Date.now(),
      ...data,
    };

    await this.storage.writeAuditLog(
      `${eventType}_${Date.now()}.log`,
      JSON.stringify(auditLog)
    );
  }

  public getAuditorsConsensus(): AuditorsConsensus {
    return this.auditorsConsensus;
  }

  async getAuditorSignature(
    auditorId: string,
    voteId: string
  ): Promise<string> {
    try {
      const key = `auditor_signature:${auditorId}:${voteId}`;
      const data = await this.storage.readAuditLog(key);
      return JSON.parse(data).signature;
    } catch (error) {
      Logger.error(`Failed to get auditor signature: ${error.message}`);
      return "";
    }
  }

  public async cleanup(): Promise<void> {
    const now = Date.now();
    const oldEvents = Array.from(this.events.values()).filter(
      (event) => now - event.timestamp > AuditManager.MAX_EVENT_AGE
    );

    for (const event of oldEvents) {
      this.events.delete(event.id);
    }

    this.metrics.eventsRemoved += oldEvents.length;
    this.eventEmitter.emit("cleanup_complete", oldEvents.length);
  }

  public async dispose(): Promise<void> {
    await this.shutdown(); // Use existing shutdown method
    this.events.clear();
    this.eventCache.clear();
    this.eventEmitter.removeAllListeners();
    Logger.info("Audit manager disposed");
  }

  public on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  public off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  public removeAllListeners(): void {
    this.eventEmitter.removeAllListeners();
  }
}

export interface AuditorsConsensus {
  validateAuditor(auditorId: string): Promise<boolean>;
  getActiveAuditors(): Promise<string[]>;
}

export class DefaultAuditorsConsensus implements AuditorsConsensus {
  private readonly auditManager: AuditManager;
  private readonly requiredMajority = 0.67; // 67% majority required
  private readonly activeAuditors = new Map<
    string,
    {
      lastActive: number;
      publicKey: string;
    }
  >();

  constructor(auditManager: AuditManager) {
    this.auditManager = auditManager;
  }

  async validateAuditor(auditorId: string): Promise<boolean> {
    const auditor = this.activeAuditors.get(auditorId);
    if (!auditor) return false;

    // Check if auditor is still active (within last 24 hours)
    const isActive = Date.now() - auditor.lastActive < 24 * 60 * 60 * 1000;
    if (!isActive) {
      this.activeAuditors.delete(auditorId);
      return false;
    }

    return true;
  }

  async getActiveAuditors(): Promise<string[]> {
    // Clean up inactive auditors
    for (const [auditorId, data] of this.activeAuditors.entries()) {
      if (Date.now() - data.lastActive > 24 * 60 * 60 * 1000) {
        this.activeAuditors.delete(auditorId);
      }
    }

    return Array.from(this.activeAuditors.keys());
  }

  public async dispose(): Promise<void> {
    await this.auditManager.shutdown();
    this.activeAuditors.clear();
  }
}
