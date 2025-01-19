"use strict";
/**
 * @fileoverview Peer model definitions for the H3Tag blockchain network. Includes peer message types,
 * services, and peer information structures for network communication and management.
 *
 * @module PeerModel
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeerMessageType = exports.PeerServices = void 0;
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
var PeerServices;
(function (PeerServices) {
    PeerServices[PeerServices["NODE"] = 1] = "NODE";
    PeerServices[PeerServices["MINER"] = 2] = "MINER";
    PeerServices[PeerServices["VALIDATOR"] = 4] = "VALIDATOR";
    PeerServices[PeerServices["RELAY"] = 8] = "RELAY";
    PeerServices[PeerServices["ARCHIVE"] = 16] = "ARCHIVE";
})(PeerServices || (exports.PeerServices = PeerServices = {}));
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
var PeerMessageType;
(function (PeerMessageType) {
    PeerMessageType["VERSION"] = "version";
    PeerMessageType["VERACK"] = "verack";
    PeerMessageType["PING"] = "ping";
    PeerMessageType["PONG"] = "pong";
    PeerMessageType["ADDR"] = "addr";
    PeerMessageType["INV"] = "inv";
    PeerMessageType["GETDATA"] = "getdata";
    PeerMessageType["NOTFOUND"] = "notfound";
    PeerMessageType["GETBLOCKS"] = "getblocks";
    PeerMessageType["GETHEADERS"] = "getheaders";
    PeerMessageType["GETBLOCKTXN"] = "getblocktxn";
    PeerMessageType["TX"] = "tx";
    PeerMessageType["BLOCK"] = "block";
    PeerMessageType["HEADERS"] = "headers";
    PeerMessageType["GETADDR"] = "getaddr";
    PeerMessageType["MEMPOOL"] = "mempool";
    PeerMessageType["REJECT"] = "reject";
    PeerMessageType["GET_NODE_INFO"] = "get_node_info";
    PeerMessageType["GET_HEADERS"] = "get_headers";
    PeerMessageType["GET_BLOCKS"] = "get_blocks";
    PeerMessageType["GET_BLOCK"] = "get_block";
    PeerMessageType["NEW_BLOCK"] = "new_block";
    PeerMessageType["NEW_TRANSACTION"] = "new_transaction";
    PeerMessageType["GET_VOTES"] = "get_votes";
})(PeerMessageType || (exports.PeerMessageType = PeerMessageType = {}));
