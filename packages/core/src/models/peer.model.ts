export interface PeerMessage {
  type: PeerMessageType;
  data: any;
  timestamp: number;
  id: string;
  success?: boolean;
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
  peers?: number;
  consensusRole: "validator" | "participant" | "observer";
  consensusStats: {
    powContributions: number;
    votingParticipation: number;
    lastVoteHeight: number;
    reputation: number;
  };
  currency?: {
    name: string;
    symbol: string;
    decimals: number;
    currentSupply: number;
    maxSupply: number;
    blockReward: number;
  };
  services?: number;
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
  publicKey: {
    traditional: string;
    dilithium: string;
    kyber: string;
  };
  privateKey: {
    traditional: string;
    dilithium: string;
    kyber: string;
  };
}

export interface ExtendedPeerInfo extends PeerInfo {
  connectedAt: number;
  publicKey: {
    traditional: string;
    dilithium: string;
    kyber: string;
  };
  privateKey: {
    traditional: string;
    dilithium: string;
    kyber: string;
  };
  uptime: number;
  lastSeen: number;
  latency: number;
  version: string;
  capabilities: string[];
  status: "connected" | "disconnected" | "error";
  height: number;
  peers: number;
  bandwidth: {
    sent: number;
    received: number;
    rate: number;
  };
  error?: string;
  currency: {
    name: string;
    symbol: string;
    decimals: number;
    currentSupply: number;
    maxSupply: number;
    blockReward: number;
  };
}

export enum PeerMessageType {
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
  GET_VOTES = "get_votes",
}
