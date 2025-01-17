import { Mempool } from "../blockchain/mempool";
import { UTXOSet } from "../models/utxo.model";
import { ConfigService } from "@h3tag-blockchain/shared";
export declare enum DiscoveryState {
    INITIALIZING = "INITIALIZING",
    ACTIVE = "ACTIVE",
    SYNCING = "SYNCING",
    ERROR = "ERROR"
}
export declare enum PeerType {
    MINER = "miner",
    FULL_NODE = "full_node",
    LIGHT_NODE = "light_node",
    VALIDATOR = "validator"
}
export declare class PeerDiscovery {
    private readonly peers;
    private readonly miners;
    private readonly bannedPeers;
    private readonly config;
    private readonly database;
    private readonly rateLimit;
    private readonly peerCache;
    private readonly utxoSet;
    private readonly mempool;
    private state;
    private discoveryInterval;
    private cleanupInterval;
    private peerScores;
    private statePromise;
    private readonly peerAddresses;
    private readonly dnsSeeds;
    private readonly banThreshold;
    private feelerInterval;
    private static readonly DISCOVERY_INTERVAL;
    private static readonly CLEANUP_INTERVAL;
    private static readonly PEER_CACHE_TTL;
    private static readonly BAN_DURATION;
    private static readonly MAX_PEER_AGE;
    private static readonly MAX_RECONNECT_ATTEMPTS;
    private static readonly RECONNECT_DELAY;
    private readonly eventEmitter;
    constructor(config: ConfigService, mempool: Mempool, utxoSet: UTXOSet);
    private initializeDiscovery;
    private queryDnsSeeds;
    private managePeerConnections;
    private updatePeerScore;
    private selectPeerCandidate;
    private loadCachedPeers;
    private connectToSeedNodes;
    private discoverPeers;
    private requestNewPeers;
    private updatePeerTypes;
    private cleanup;
    private cleanupOldPeers;
    private cleanupBannedPeers;
    private cleanupResources;
    getPeersByType(type: PeerType): string[];
    shutdown(): Promise<void>;
    private isValidPeer;
    private connectToPeer;
    private requestPeers;
    private connectToNewPeers;
    private removePeer;
    private setState;
    private attemptFeelerConnection;
    private getTargetOutbound;
    private resolveDnsSeed;
    private isValidAddress;
    private addPeerAddress;
    private processMessage;
    private handleVersion;
    private handleAddr;
    private handleInventory;
}
