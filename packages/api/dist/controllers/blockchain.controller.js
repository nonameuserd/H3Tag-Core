"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const blockchain_dto_1 = require("../dtos/blockchain.dto");
const shared_1 = require("@h3tag-blockchain/shared");
let BlockchainController = class BlockchainController {
    constructor(blockchainService) {
        this.blockchainService = blockchainService;
    }
    async getStats() {
        try {
            return await this.blockchainService.getStats();
        }
        catch (error) {
            shared_1.Logger.error("Failed to get blockchain stats:", error);
            throw new common_1.HttpException(`Failed to get blockchain stats: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async submitTransaction(transaction) {
        try {
            const txId = await this.blockchainService.submitTransaction(transaction);
            return { txId };
        }
        catch (error) {
            shared_1.Logger.error("Failed to submit transaction:", error);
            throw new common_1.HttpException(`Failed to submit transaction: ${error.message}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async getBlock(hash) {
        try {
            return await this.blockchainService.getBlock(hash);
        }
        catch (error) {
            shared_1.Logger.error("Failed to get block:", error);
            throw new common_1.HttpException(`Block not found: ${error.message}`, common_1.HttpStatus.NOT_FOUND);
        }
    }
    async getCurrencyDetails() {
        try {
            return await this.blockchainService.getCurrencyDetails();
        }
        catch (error) {
            shared_1.Logger.error("Failed to get currency details:", error);
            throw new common_1.HttpException(`Failed to get currency details: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getFirstTransaction(address) {
        try {
            return await this.blockchainService.getFirstTransactionForAddress(address);
        }
        catch (error) {
            shared_1.Logger.error("Failed to get first transaction:", error);
            throw new common_1.HttpException(`Failed to get first transaction: ${error.message}`, common_1.HttpStatus.NOT_FOUND);
        }
    }
    async validateTransaction(transaction) {
        try {
            const isValid = await this.blockchainService.validateTransactionAmount(transaction);
            return { isValid };
        }
        catch (error) {
            shared_1.Logger.error("Transaction validation failed:", error);
            throw new common_1.HttpException(`Transaction validation failed: ${error.message}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async getUtxos(address) {
        try {
            return await this.blockchainService.getConfirmedUtxos(address);
        }
        catch (error) {
            shared_1.Logger.error("Failed to get UTXOs:", error);
            throw new common_1.HttpException(`Failed to get UTXOs: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getHeight() {
        try {
            return await this.blockchainService.getHeight();
        }
        catch (error) {
            shared_1.Logger.error("Failed to get height:", error);
            throw new common_1.HttpException(`Failed to get height: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getVersion() {
        try {
            return this.blockchainService.getVersion();
        }
        catch (error) {
            shared_1.Logger.error("Failed to get version:", error);
            throw new common_1.HttpException(`Failed to get version: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getNode() {
        try {
            return await this.blockchainService.getNode();
        }
        catch (error) {
            shared_1.Logger.error("Failed to get node info:", error);
            throw new common_1.HttpException(`Failed to get node info: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getChainTips() {
        try {
            return await this.blockchainService.getChainTips();
        }
        catch (error) {
            shared_1.Logger.error("Failed to get chain tips:", error);
            throw new common_1.HttpException(`Failed to get chain tips: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getCurrentDifficulty() {
        try {
            const difficulty = await this.blockchainService.getCurrentDifficulty();
            return { difficulty };
        }
        catch (error) {
            shared_1.Logger.error("Failed to get difficulty:", error);
            throw new common_1.HttpException(`Failed to get difficulty: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getBestBlockHash() {
        try {
            const hash = await this.blockchainService.getBestBlockHash();
            return { hash };
        }
        catch (error) {
            shared_1.Logger.error("Failed to get best block hash:", error);
            throw new common_1.HttpException(`Failed to get best block hash: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getBlockchainInfo() {
        try {
            return await this.blockchainService.getBlockchainInfo();
        }
        catch (error) {
            shared_1.Logger.error("Failed to get blockchain info:", error);
            throw new common_1.HttpException(`Failed to get blockchain info: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.BlockchainController = BlockchainController;
__decorate([
    (0, common_1.Get)("stats"),
    (0, swagger_1.ApiOperation)({ summary: "Get blockchain statistics" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Blockchain statistics retrieved successfully",
        type: blockchain_dto_1.BlockchainStatsDto,
    })
], BlockchainController.prototype, "getStats", null);
__decorate([
    (0, common_1.Post)("transactions"),
    (0, swagger_1.ApiOperation)({ summary: "Submit a new transaction" }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: "Transaction submitted successfully",
        schema: {
            properties: {
                txId: { type: "string" },
            },
        },
    }),
    __param(0, (0, common_1.Body)())
], BlockchainController.prototype, "submitTransaction", null);
__decorate([
    (0, common_1.Get)("blocks/:hash"),
    (0, swagger_1.ApiOperation)({ summary: "Get block by hash" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Block retrieved successfully",
        type: blockchain_dto_1.BlockResponseDto,
    }),
    __param(0, (0, common_1.Param)("hash"))
], BlockchainController.prototype, "getBlock", null);
__decorate([
    (0, common_1.Get)("currency"),
    (0, swagger_1.ApiOperation)({ summary: "Get currency details" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Currency details retrieved successfully",
    })
], BlockchainController.prototype, "getCurrencyDetails", null);
__decorate([
    (0, common_1.Get)("transactions/:address/first"),
    (0, swagger_1.ApiOperation)({ summary: "Get first transaction for address" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "First transaction found",
        schema: {
            properties: {
                blockHeight: { type: "number" },
            },
        },
    }),
    __param(0, (0, common_1.Param)("address"))
], BlockchainController.prototype, "getFirstTransaction", null);
__decorate([
    (0, common_1.Post)("transactions/validate"),
    (0, swagger_1.ApiOperation)({ summary: "Validate transaction amount" }),
    __param(0, (0, common_1.Body)())
], BlockchainController.prototype, "validateTransaction", null);
__decorate([
    (0, common_1.Get)("transactions/:address/utxos"),
    (0, swagger_1.ApiOperation)({ summary: "Get confirmed UTXOs for address" }),
    __param(0, (0, common_1.Param)("address"))
], BlockchainController.prototype, "getUtxos", null);
__decorate([
    (0, common_1.Get)("height"),
    (0, swagger_1.ApiOperation)({ summary: "Get current blockchain height" })
], BlockchainController.prototype, "getHeight", null);
__decorate([
    (0, common_1.Get)("version"),
    (0, swagger_1.ApiOperation)({ summary: "Get blockchain version" })
], BlockchainController.prototype, "getVersion", null);
__decorate([
    (0, common_1.Get)("node"),
    (0, swagger_1.ApiOperation)({ summary: "Get node information" })
], BlockchainController.prototype, "getNode", null);
__decorate([
    (0, common_1.Get)("chain-tips"),
    (0, swagger_1.ApiOperation)({ summary: "Get information about chain tips" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Chain tips retrieved successfully",
        type: [blockchain_dto_1.ChainTipDto],
    })
], BlockchainController.prototype, "getChainTips", null);
__decorate([
    (0, common_1.Get)("difficulty"),
    (0, swagger_1.ApiOperation)({ summary: "Get current mining difficulty" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Current difficulty retrieved successfully",
        type: blockchain_dto_1.DifficultyResponseDto,
    })
], BlockchainController.prototype, "getCurrentDifficulty", null);
__decorate([
    (0, common_1.Get)("best-block-hash"),
    (0, swagger_1.ApiOperation)({ summary: "Get the hash of the best (latest) block" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Best block hash retrieved successfully",
        type: blockchain_dto_1.BestBlockHashDto,
    })
], BlockchainController.prototype, "getBestBlockHash", null);
__decorate([
    (0, common_1.Get)("info"),
    (0, swagger_1.ApiOperation)({ summary: "Get blockchain information" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Blockchain information retrieved successfully",
        type: blockchain_dto_1.BlockchainInfoDto,
    })
], BlockchainController.prototype, "getBlockchainInfo", null);
exports.BlockchainController = BlockchainController = __decorate([
    (0, swagger_1.ApiTags)("Blockchain"),
    (0, common_1.Controller)("blockchain")
], BlockchainController);
//# sourceMappingURL=blockchain.controller.js.map