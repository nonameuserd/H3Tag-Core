/**
 * @fileoverview Peer model definitions for the H3Tag blockchain network. Includes peer message types,
 * services, and peer information structures for network communication and management.
 *
 * @module PeerModel
 */

/**
 * @interface PeerMessage
 * @description Defines the structure of messages exchanged between peers
 *
 * @property {PeerMessageType} type - Type of peer message
 * @property {any} data - Message payload data
 * @property {number} timestamp - Message creation timestamp
 * @property {string} id - Unique message identifier
 * @property {boolean} [success] - Optional success indicator
 */
export interface PeerMessage {
  type: PeerMessageType;
  data: any;
  timestamp: number;
  id: string;
  success?: boolean;
}

/**
 * @enum PeerServices
 * @description Bitfield flags representing different services a peer can provide
 *
 * @property {number} NODE - Basic node services (1)
 * @property {number} MINER - Mining services (2)
 * @property {number} VALIDATOR - Validation services (4)
 * @property {number} RELAY - Network relay services (8)
 * @property {number} ARCHIVE - Historical data archival (16)
 */
export enum PeerServices {
  NODE = 1,
  MINER = 2,
  VALIDATOR = 4,
  RELAY = 8,
  ARCHIVE = 16,
}

/**
 * @interface PeerInfo
 * @description Detailed information about a network peer
 *
 * @property {string} id - Unique peer identifier
 * @property {string} url - Peer's network address
 * @property {string} version - Protocol version
 * @property {number} height - Current blockchain height
 * @property {number} lastSeen - Last seen timestamp
 * @property {number} latency - Network latency in milliseconds
 * @property {string[]} capabilities - Supported features
 * @property {number} connectedAt - Connection timestamp
 * @property {number} peers - Number of connected peers
 * @property {string} consensusRole - Role in consensus ("validator" | "participant" | "observer")
 * @property {Object} consensusStats - Consensus participation statistics
 * @property {number} consensusStats.powContributions - Proof of work contributions
 * @property {number} consensusStats.votingParticipation - Voting participation rate
 * @property {number} consensusStats.lastVoteHeight - Last vote block height
 * @property {number} consensusStats.reputation - Peer reputation score
 * @property {Object} currency - Currency-related information
 * @property {string} currency.name - Currency name
 * @property {string} currency.symbol - Currency symbol
 * @property {number} currency.decimals - Decimal places
 * @property {number} currency.currentSupply - Current supply
 * @property {number} currency.maxSupply - Maximum supply
 * @property {number} currency.blockReward - Block reward amount
 * @property {PeerServices[]} services - Provided services
 */
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

/**
 * @interface PeerConfig
 * @description Configuration options for peer connections
 *
 * @property {number} maxReconnectAttempts - Maximum reconnection attempts
 * @property {number} pingInterval - Ping interval in milliseconds
 * @property {number} reconnectInterval - Reconnection interval in milliseconds
 * @property {number} messageTimeout - Message timeout in milliseconds
 * @property {Object} rateLimits - Rate limiting configuration
 * @property {number} rateLimits.windowMs - Time window for rate limiting
 * @property {Object} rateLimits.maxRequests - Maximum requests per window
 * @property {number} connectionTimeout - Connection timeout in milliseconds
 */
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

/**
 * @interface ExtendedPeerInfo
 * @description Extended peer information including connection status and bandwidth metrics
 * @extends PeerInfo
 *
 * @property {string} status - Connection status ("connected" | "disconnected" | "error")
 * @property {Object} bandwidth - Bandwidth usage metrics
 * @property {number} bandwidth.sent - Bytes sent
 * @property {number} bandwidth.received - Bytes received
 * @property {number} bandwidth.rate - Current bandwidth rate
 * @property {string} [error] - Error message if status is "error"
 */
export interface ExtendedPeerInfo extends PeerInfo {
  status: "connected" | "disconnected" | "error";
  bandwidth: {
    sent: number;
    received: number;
    rate: number;
  };
  error?: string;
}

/**
 * @enum PeerMessageType
 * @description Types of messages that can be exchanged between peers
 *
 * @property {string} VERSION - Version handshake
 * @property {string} VERACK - Version acknowledgment
 * @property {string} PING - Network ping
 * @property {string} PONG - Network pong response
 * @property {string} ADDR - Peer addresses
 * @property {string} INV - Inventory
 * @property {string} GETDATA - Data request
 * @property {string} NOTFOUND - Data not found
 * @property {string} GETBLOCKS - Block request
 * @property {string} GETHEADERS - Headers request
 * @property {string} GETBLOCKTXN - Block transactions request
 * @property {string} TX - Transaction
 * @property {string} BLOCK - Block
 * @property {string} HEADERS - Block headers
 * @property {string} GETADDR - Address request
 * @property {string} MEMPOOL - Mempool request
 * @property {string} REJECT - Message rejection
 * @property {string} GET_NODE_INFO - Node information request
 * @property {string} GET_HEADERS - Headers request
 * @property {string} GET_BLOCKS - Blocks request
 * @property {string} GET_BLOCK - Single block request
 * @property {string} NEW_BLOCK - New block announcement
 * @property {string} NEW_TRANSACTION - New transaction announcement
 * @property {string} GET_VOTES - Votes request
 */
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
