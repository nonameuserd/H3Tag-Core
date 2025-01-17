"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeerMessageType = exports.PeerServices = void 0;
var PeerServices;
(function (PeerServices) {
    PeerServices[PeerServices["NODE"] = 1] = "NODE";
    PeerServices[PeerServices["MINER"] = 2] = "MINER";
    PeerServices[PeerServices["VALIDATOR"] = 4] = "VALIDATOR";
    PeerServices[PeerServices["RELAY"] = 8] = "RELAY";
    PeerServices[PeerServices["ARCHIVE"] = 16] = "ARCHIVE";
})(PeerServices = exports.PeerServices || (exports.PeerServices = {}));
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
})(PeerMessageType = exports.PeerMessageType || (exports.PeerMessageType = {}));
//# sourceMappingURL=peer.model.js.map