import { Peer } from "./peer";
export declare class NetworkStats {
    private readonly eventEmitter;
    blockPropagationTimes: number[];
    globalHashRate: number;
    peerLatencies: Map<string, number>;
    private peers;
    currentDifficulty: number;
    private static readonly MAX_PROPAGATION_TIMES;
    private static readonly MIN_HASH_RATE;
    private static readonly MAX_LATENCY;
    private static readonly MIN_LATENCY;
    private static readonly MAX_PEERS;
    private static readonly PEER_EVENTS;
    private static readonly DEFAULT_LATENCY;
    private static readonly MAX_SAMPLE_SIZE;
    private static readonly VALID_EVENTS;
    private static readonly DEFAULT_PROPAGATION_TIME;
    private static readonly OUTLIER_THRESHOLD;
    private readonly blockchain;
    private readonly configService;
    private discoveryTimer;
    private readonly peerScores;
    private readonly lastSeen;
    private readonly bannedPeers;
    private static readonly DISCOVERY_INTERVAL;
    private static readonly PEER_TIMEOUT;
    private static readonly MAX_SCORE;
    private static readonly MIN_SCORE;
    private static readonly SCORE_DECAY;
    private readonly startTime;
    constructor();
    private startDiscoveryLoop;
    private performDiscovery;
    updatePeerScore(peerId: string, delta: number): void;
    private banPeer;
    private getAveragePeerScore;
    on(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    removeAllListeners(): void;
    private readonly h3TagMetrics;
    private static readonly MIN_DIFFICULTY;
    private static readonly MAX_DIFFICULTY;
    private static readonly MIN_PROPAGATION_TIME;
    private static readonly MAX_PROPAGATION_TIME;
    addPeer(peer: Peer): void;
    removePeer(peerId: string): void;
    getActivePeerCount(): number;
    getAverageLatency(): number;
    addBlockPropagationTime(time: number): void;
    updateGlobalHashRate(hashRate: number): void;
    updatePeerLatency(peerId: string, latency: number): void;
    getAveragePropagationTime(): number;
    private handlePeerEvent;
    getVotingStats(): {
        participation: number;
        averageVoteTime: number;
        totalVoters: number;
    };
    private calculateAverageVoteTime;
    /**
     * Update TAG price and market metrics
     */
    updateHBXMetrics(metrics: {
        price?: number;
        volume24h?: number;
        marketCap?: number;
        holders?: number;
        distribution?: {
            gini: number;
            top10Percent: number;
            top50Percent: number;
        };
    }): void;
    /**
     * Get current TAG metrics
     */
    getMetrics(): {
        currency: {
            name: string;
            symbol: string;
            decimals: number;
        };
        price: number;
        volume24h: number;
        marketCap: number;
        holders: number;
        distribution: {
            gini: number;
            top10Percent: number;
            top50Percent: number;
        };
    };
    initialize(): Promise<void>;
    cleanup(): void;
    getNetworkInfo(): {
        version: string;
        subversion: string;
        protocolVersion: number;
        localServices: string[];
        connections: {
            total: number;
            inbound: number;
            outbound: number;
            verified: number;
        };
        networks: {
            name: string;
            limited: boolean;
            reachable: boolean;
            proxy: string;
            proxy_randomize_credentials: boolean;
        }[];
        localAddresses: string[];
        warnings: string;
        metrics: {
            totalBytesRecv: number;
            totalBytesSent: number;
            timeConnected: number;
            blockHeight: number;
            difficulty: number;
            hashRate: number;
            mempool: {
                size: number;
                bytes: number;
                usage: number;
                maxmempool: number;
                mempoolminfee: number;
            };
        };
    };
    private getMempoolInfo;
    private getLocalServices;
    private getLocalAddresses;
    private getNetworkWarnings;
    private isVersionOutdated;
    private isSynced;
}
