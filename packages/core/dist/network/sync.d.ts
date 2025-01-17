import { Block } from "../models/block.model";
import { Peer } from "./peer";
import { Blockchain } from "../blockchain/blockchain";
import { Mempool } from "../blockchain/mempool";
import { BlockchainSchema } from "../database/blockchain-schema";
export declare enum SyncState {
    IDLE = "IDLE",
    SYNCING = "SYNCING",
    SYNCED = "SYNCED",
    ERROR = "ERROR"
}
export declare class SyncError extends Error {
    constructor(message: string);
}
export declare class BlockchainSync {
    private readonly consensusPublicKey;
    private readonly db;
    private readonly blockchain;
    private readonly mempool;
    private readonly peers;
    private state;
    private syncingPeer?;
    private lastSyncHeight;
    private retryAttempts;
    private syncTimeout?;
    private currentEpoch;
    private readonly eventEmitter;
    private static readonly SYNC_TIMEOUT;
    private static readonly MAX_BLOCKS_PER_REQUEST;
    private static readonly MAX_RETRY_ATTEMPTS;
    private static readonly SYNC_CHECK_INTERVAL;
    private static readonly MAX_PARALLEL_BLOCKS;
    private static readonly SYNC_TIMEOUTS;
    private static readonly MAX_RETRIES;
    private syncStats;
    private static readonly BATCH_SIZES;
    private static readonly SYNC_PARAMETERS;
    headerSync: {
        startHeight: number;
        currentHeight: number;
        targetHeight: number;
        headers: Map<number, Block>;
        pendingRequests: Set<number>;
        clear(): void;
    };
    private readonly mutex;
    constructor(blockchain: Blockchain, mempool: Mempool, peers: Map<string, Peer>, consensusPublicKey: {
        publicKey: string;
    }, db: BlockchainSchema);
    private setupEventListeners;
    private setupPeerListeners;
    private handleSyncingPeerDisconnect;
    private startPeriodicSync;
    startSync(): Promise<void>;
    private setupSyncTimeout;
    private clearSyncTimeout;
    private handleSyncTimeout;
    private handleSyncError;
    private selectBestPeer;
    synchronize(peer: Peer): Promise<void>;
    syncHeaders(peer: Peer): Promise<void>;
    private syncBlocks;
    private downloadBlockBatch;
    private validateAndProcessBlock;
    private rewindHeaders;
    private processBlocksInParallel;
    private processBlock;
    private emitSyncProgress;
    private requestBlocks;
    private handleNewBlock;
    private handleNewTransaction;
    private broadcastToPeers;
    getState(): SyncState;
    stop(): Promise<void>;
    private checkSync;
    private syncVotes;
    private processVote;
    dispose(): Promise<void>;
    private requestBlocksWithRetry;
    private processBlocksInBatches;
    private emitDetailedProgress;
    private validatePeerBeforeSync;
    private calculateBlocksPerSecond;
    private calculateEstimatedTime;
    private calculateFailureRate;
    on(event: string, listener: (...args: any[]) => void): void;
    private emitSyncComplete;
    private emitSyncError;
    off(event: string, listener: (...args: any[]) => void): void;
    private verifyChain;
    private requestHeadersWithRetry;
    private validateHeaders;
    private requestBlockWithRetry;
    getVerificationProgress(): number;
    isInitialBlockDownload(): boolean;
}
