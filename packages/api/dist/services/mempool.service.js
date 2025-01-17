"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MempoolService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@h3tag-blockchain/shared");
let MempoolService = class MempoolService {
    constructor(node) {
        this.node = node;
    }
    async getMempoolInfo() {
        try {
            // Use the existing getMempoolInfo method from Mempool class
            const mempoolInfo = await this.node.getMempool().getMempoolInfo();
            return {
                size: mempoolInfo.size,
                bytes: mempoolInfo.bytes,
                usage: mempoolInfo.usage,
                maxSize: mempoolInfo.maxSize,
                maxMemoryUsage: mempoolInfo.maxMemoryUsage,
                currentMemoryUsage: mempoolInfo.currentMemoryUsage,
                loadFactor: mempoolInfo.loadFactor,
                fees: mempoolInfo.fees,
                transactions: mempoolInfo.transactions,
                age: mempoolInfo.age,
                health: mempoolInfo.health,
            };
        }
        catch (error) {
            shared_1.Logger.error("Failed to get mempool info:", error);
            throw error;
        }
    }
    async getRawMempool(verbose = false) {
        try {
            return await this.node.getMempool().getRawMempool(verbose);
        }
        catch (error) {
            shared_1.Logger.error("Failed to get raw mempool:", error);
            throw error;
        }
    }
    async getMempoolEntry(txid) {
        try {
            const entry = await this.node.getMempool().getMempoolEntry(txid);
            if (!entry) {
                throw new Error(`Transaction ${txid} not found in mempool`);
            }
            return entry;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get mempool entry:", error);
            throw error;
        }
    }
};
exports.MempoolService = MempoolService;
exports.MempoolService = MempoolService = __decorate([
    (0, common_1.Injectable)()
], MempoolService);
//# sourceMappingURL=mempool.service.js.map