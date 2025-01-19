"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainStatsError = void 0;
class BlockchainStatsError extends Error {
    constructor(message, code, context) {
        super(message);
        this.code = code;
        this.context = context;
        this.name = "BlockchainStatsError";
    }
}
exports.BlockchainStatsError = BlockchainStatsError;
