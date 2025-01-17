"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DISCOVERY_CONFIG = void 0;
exports.DISCOVERY_CONFIG = {
    seedNodes: JSON.parse(process.env.SEED_NODES),
    maxPeers: parseInt(process.env.MAX_PEERS),
    minPeers: parseInt(process.env.MIN_PEERS),
    version: process.env.VERSION,
};
//# sourceMappingURL=constants.js.map