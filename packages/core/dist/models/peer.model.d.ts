export interface PeerMessage {
    type: PeerMessageType;
    data: any;
    timestamp: number;
    id: string;
    success?: boolean;
}
export declare enum PeerServices {
    NODE = 1,
    MINER = 2,
    VALIDATOR = 4,
    RELAY = 8,
    ARCHIVE = 16
}
export interface PeerInfo {
    id: string;
    url: string;
    version: string;
    height: number;
    lastSeen: number;
    latency: number;
    capabilities: string[];
    connectedAt: number;
    peers: number;
    consensusRole: "validator" | "participant" | "observer";
    consensusStats: {
        powContributions: number;
        votingParticipation: number;
        lastVoteHeight: number;
        reputation: number;
    };
    currency: {
        name: string;
        symbol: string;
        decimals: number;
        currentSupply: number;
        maxSupply: number;
        blockReward: number;
    };
    services: PeerServices[];
}
export interface PeerConfig {
    maxReconnectAttempts: number;
    pingInterval: number;
    reconnectInterval: number;
    messageTimeout: number;
    rateLimits: {
        windowMs: number;
        maxRequests: {
            mining: number;
            voting: number;
            default: number;
        };
    };
    connectionTimeout: number;
}
export interface ExtendedPeerInfo extends PeerInfo {
    status: "connected" | "disconnected" | "error";
    bandwidth: {
        sent: number;
        received: number;
        rate: number;
    };
    error?: string;
}
export declare enum PeerMessageType {
    VERSION = "version",
    VERACK = "verack",
    PING = "ping",
    PONG = "pong",
    ADDR = "addr",
    INV = "inv",
    GETDATA = "getdata",
    NOTFOUND = "notfound",
    GETBLOCKS = "getblocks",
    GETHEADERS = "getheaders",
    GETBLOCKTXN = "getblocktxn",
    TX = "tx",
    BLOCK = "block",
    HEADERS = "headers",
    GETADDR = "getaddr",
    MEMPOOL = "mempool",
    REJECT = "reject",
    GET_NODE_INFO = "get_node_info",
    GET_HEADERS = "get_headers",
    GET_BLOCKS = "get_blocks",
    GET_BLOCK = "get_block",
    NEW_BLOCK = "new_block",
    NEW_TRANSACTION = "new_transaction",
    GET_VOTES = "get_votes"
}
