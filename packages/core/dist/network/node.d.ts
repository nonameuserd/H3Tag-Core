import { Blockchain } from "../blockchain/blockchain";
import { Peer } from "./peer";
import { BlockchainSchema } from "../database/blockchain-schema";
import { Mempool } from "../blockchain/mempool";
import { Block } from "../models/block.model";
import { Transaction } from "../models/transaction.model";
import { AuditManager } from "../security/audit";
import { ConfigService } from "@h3tag-blockchain/shared";
import { NetworkType } from "./dnsSeed";
interface NodeConfig {
    networkType: NetworkType;
    port: number;
    maxPeers: number;
    minPeers: number;
    connectionTimeout: number;
    syncInterval: number;
    banTime: number;
    maxBanScore: number;
    pruneInterval: number;
    maxOrphans: number;
    maxReorg: number;
    services: number;
}
export declare class Node {
    private readonly blockchain;
    private readonly db;
    private readonly mempool;
    private readonly configService;
    private readonly auditManager;
    private readonly config;
    private readonly peers;
    private readonly peerStates;
    private readonly bannedPeers;
    private readonly orphanBlocks;
    private readonly orphanTxs;
    private readonly seeder;
    private readonly metrics;
    private readonly health;
    private readonly ddosProtection;
    private readonly audit;
    private readonly peerCircuitBreakers;
    private readonly mutex;
    private readonly peerCache;
    private isRunning;
    private maintenanceTimer?;
    private readonly discovery;
    private readonly eventEmitter;
    private static readonly DEFAULT_CONFIG;
    constructor(blockchain: Blockchain, db: BlockchainSchema, mempool: Mempool, configService: ConfigService, auditManager: AuditManager);
    private setupEventHandlers;
    start(): Promise<void>;
    stop(): Promise<void>;
    discoverPeers(): Promise<void>;
    connectToPeer(address: string): Promise<void>;
    private handlePeerMessage;
    private handleBlockMessage;
    private handleTransactionMessage;
    private updatePeerState;
    private increasePeerBanScore;
    private banPeer;
    private getCircuitBreaker;
    private isCompatibleVersion;
    private isBanned;
    getAddress(): string;
    getPeerCount(): number;
    getBannedPeers(): string[];
    broadcastBlock(block: Block): Promise<void>;
    broadcastTransaction(tx: Transaction): Promise<void>;
    private handlePeerConnect;
    private handlePeerDisconnect;
    private handlePeerError;
    private handleBlockReceived;
    private handleTransactionReceived;
    private loadPeerCache;
    private savePeerCache;
    private performMaintenance;
    private evictStalePeers;
    private pruneOrphans;
    private handleInventoryMessage;
    private handleGetDataMessage;
    private updatePeerLastSeen;
    private handleOrphanBlock;
    private processOrphanBlocks;
    getActiveValidators(): Promise<{
        address: string;
    }[]>;
    close(): Promise<void>;
    getInfo(): {
        networkType: NetworkType;
        port: number;
        peersCount: number;
        version: number;
        isRunning: boolean;
        syncStatus: {
            synced: boolean;
            height: number;
        };
    };
    /**
     * Broadcast raw transaction to connected peers
     * @param rawTx Serialized transaction data
     * @returns Promise<string> Transaction ID
     */
    broadcastRawTransaction(rawTx: string): Promise<string>;
    getMempool(): Mempool;
    getConfig(): NodeConfig;
    getPeer(address: string): Peer;
}
export {};
