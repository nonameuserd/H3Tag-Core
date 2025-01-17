/// <reference types="node" />
import { EventEmitter } from "events";
import { ConfigService } from "@h3tag-blockchain/shared";
import { BlockchainSchema } from "../database/blockchain-schema";
import { PeerInfo, PeerMessageType } from "../models/peer.model";
import { Transaction } from "../models/transaction.model";
import { BlockInFlight } from "../blockchain/consensus/pow";
export declare enum PeerState {
    DISCONNECTED = "disconnected",
    CONNECTING = "connecting",
    CONNECTED = "connected",
    READY = "ready",
    SYNCING = "syncing",
    BANNED = "banned"
}
interface PeerConfig {
    version: number;
    services: number;
    minPingInterval: number;
    connectionTimeout: number;
    handshakeTimeout: number;
    messageTimeout: number;
    maxReconnectAttempts: number;
    reconnectDelay: number;
    keepAlive: boolean;
    maxBufferSize: number;
    rateLimits: {
        messages: number;
        bytes: number;
        interval: number;
    };
    timeout?: number;
    maxBanScore: number;
}
export interface PeerMessage {
    type: PeerMessageType;
    payload: any;
    checksum?: string;
}
export interface PeerDetailedInfo {
    id: string;
    address: string;
    port: number;
    version: string;
    state: PeerState;
    services: number;
    lastSeen: number;
    lastSend: number;
    lastReceive: number;
    connectionTime: number;
    bytesReceived: number;
    bytesSent: number;
    messagesReceived: number;
    messagesSent: number;
    latency: number;
    inbound: boolean;
    startingHeight: number;
    banScore: number;
    syncedHeaders: number;
    syncedBlocks: number;
    inflight: number[];
    whitelisted: boolean;
    blacklisted: boolean;
    capabilities: string[];
    userAgent: string;
}
export declare class Peer {
    private readonly address;
    private readonly port;
    private readonly configService;
    private ws;
    private state;
    private readonly config;
    private readonly metrics;
    private readonly mutex;
    private readonly messageQueue;
    private readonly pendingRequests;
    private lastPing;
    private pingInterval?;
    private reconnectAttempts;
    private reconnectTimer?;
    private handshakeTimer?;
    private bytesReceived;
    private bytesSent;
    private messagesSent;
    private messagesReceived;
    private lastMessageTime;
    private version?;
    private services?;
    private startHeight?;
    private userAgent?;
    private blockchainSync;
    readonly eventEmitter: EventEmitter<[never]>;
    private readonly circuitBreaker;
    private readonly peerId;
    private readonly latencyWindow;
    private static readonly MAX_LATENCY_SAMPLES;
    private static readonly LATENCY_WINDOW_MS;
    private lastVoteTime;
    private id;
    private peerState;
    private database;
    private inbound;
    private syncedHeaders;
    private syncedBlocks;
    private inflightBlocks;
    private isWhitelisted;
    private isBlacklisted;
    private readonly blocksInFlight;
    private readonly peers;
    private height;
    constructor(address: string, port: number, config: Partial<PeerConfig>, configService: ConfigService, database: BlockchainSchema, isInbound?: boolean);
    private setupEventHandlers;
    connect(): Promise<void>;
    private setupWebSocket;
    private performHandshake;
    private handleIncomingMessage;
    private processMessage;
    send(type: PeerMessageType, payload: any): Promise<void>;
    request(type: PeerMessageType, payload: any, timeout?: number): Promise<any>;
    disconnect(code?: number, reason?: string): void;
    private cleanup;
    isConnected(): boolean;
    private calculateChecksum;
    private checkRateLimits;
    private updateMessageMetrics;
    private updateSendMetrics;
    getState(): PeerState;
    getAddress(): string;
    getVersion(): number | undefined;
    getLastSeen(): number;
    getMetrics(): any;
    getNodeInfo(): Promise<{
        isMiner: boolean;
        publicKey: string;
        signature: string;
        tagInfo: {
            minedBlocks: number;
            votingPower: bigint;
            voteParticipation: number;
            lastVoteHeight: number;
        };
    }>;
    getInfo(): Promise<PeerInfo>;
    private getLatency;
    updateLatency(rtt: number): void;
    getPeers(): Promise<{
        url: string;
    }[]>;
    hasVoted(): boolean;
    getVoteTime(): number | null;
    getId(): string;
    private handleMessage;
    private handleError;
    private handleClose;
    handshake(): Promise<{
        version: number;
        services: number;
        height: number;
        peers: number;
        isMiner: boolean;
        publicKey: string;
        signature: string;
        minedBlocks: number;
        voteParticipation: number;
        lastVoteHeight: number;
        votingPower?: number;
    }>;
    private startPingInterval;
    private handleConnectionError;
    private handlePong;
    private sendVersion;
    private waitForVerack;
    private parseMessage;
    private handleVersion;
    private handleVerack;
    private handlePing;
    private handleInventory;
    adjustPeerScore(adjustment: number): void;
    private updatePeerState;
    getBlockHeight(): Promise<number>;
    getMinedBlocks(): Promise<number>;
    getVoteParticipation(): Promise<number>;
    recordVote(): Promise<void>;
    validatePeerCurrency(peerInfo: PeerInfo): Promise<boolean>;
    getAverageBandwidth(): number;
    isBanned(): boolean;
    /**
     * Send transaction to peer
     * @param tx Transaction to send
     * @returns Promise<void>
     */
    sendTransaction(tx: Transaction): Promise<void>;
    /**
     * Handle incoming transaction message
     * @param payload Transaction message payload
     */
    private handleTransactionMessage;
    /**
     * Ban or unban a peer
     * @param command 'add' to ban, 'remove' to unban
     * @param banTime Duration of ban in seconds (0 for permanent)
     * @param reason Reason for the ban
     */
    setBan(command: "add" | "remove", banTime?: number, reason?: string): Promise<void>;
    /**
     * Check if peer is currently banned
     * @returns Promise<boolean>
     */
    checkBanStatus(): Promise<boolean>;
    /**
     * Get ban information for the peer
     * @returns Promise<BanInfo | null>
     */
    getBanInfo(): Promise<{
        address: string;
        timestamp: number;
        expiration: number;
        reason: string;
        banScore: number;
    } | null>;
    /**
     * List all banned peers
     * @returns Promise<Array<BanInfo>>
     */
    listBans(): Promise<Array<{
        address: string;
        timestamp: number;
        expiration: number;
        reason: string;
        banScore: number;
        timeRemaining: number;
    }>>;
    /**
     * Remove ban for a specific peer address
     * @param address Peer address to unban
     * @returns Promise<boolean> True if ban was removed, false if peer wasn't banned
     */
    removeBan(address: string): Promise<boolean>;
    /**
     * Clear all bans
     * @returns Promise<number> Number of bans cleared
     */
    clearBans(): Promise<number>;
    isInbound(): boolean;
    isVerified(): boolean;
    getBytesReceived(): number;
    getBytesSent(): number;
    getPeerInfo(): PeerDetailedInfo;
    updateSyncedBlocks(height: number): void;
    setWhitelisted(status: boolean): void;
    setBlacklisted(status: boolean): void;
    isBlocked(): boolean;
    getInflightBlocks(): BlockInFlight[];
    getHeight(): number;
    setHeight(height: number): void;
}
export {};
