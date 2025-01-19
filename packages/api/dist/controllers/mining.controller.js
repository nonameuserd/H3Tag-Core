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
exports.MiningController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const mining_dto_1 = require("../dtos/mining.dto");
const shared_1 = require("@h3tag-blockchain/shared");
const class_validator_1 = require("class-validator");
const mining_dto_2 = require("../dtos/mining.dto");
const mining_dto_3 = require("../dtos/mining.dto");
let MiningController = class MiningController {
    constructor(miningService) {
        this.miningService = miningService;
    }
    async getMiningInfo() {
        try {
            return await this.miningService.getMiningInfo();
        }
        catch (error) {
            shared_1.Logger.error("Failed to get mining info:", error);
            throw new common_1.HttpException(`Failed to get mining info: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getNetworkHashPS() {
        try {
            const hashPS = await this.miningService.getNetworkHashPS();
            return { hashPS };
        }
        catch (error) {
            shared_1.Logger.error("Failed to get network hash rate:", error);
            throw new common_1.HttpException(`Failed to get network hash rate: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getBlockTemplate(body) {
        const request = new mining_dto_2.BlockTemplateRequestDto();
        request.minerAddress = body.minerAddress;
        // Validate request
        const errors = await (0, class_validator_1.validate)(request);
        if (errors.length > 0) {
            throw new common_1.BadRequestException({
                status: "error",
                message: "Invalid request",
                errors: errors.map((error) => Object.values(error.constraints)),
            });
        }
        const template = await this.miningService.getBlockTemplate(request.minerAddress);
        return {
            status: "success",
            data: template,
        };
    }
    async submitBlock(submitBlockDto) {
        try {
            const blockHash = await this.miningService.submitBlock(submitBlockDto);
            return {
                status: "success",
                blockHash,
            };
        }
        catch (error) {
            shared_1.Logger.error("Failed to submit block:", error);
            throw new common_1.HttpException(`Failed to submit block: ${error.message}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
};
exports.MiningController = MiningController;
__decorate([
    (0, common_1.Get)("info"),
    (0, swagger_1.ApiOperation)({ summary: "Get mining information" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Mining information retrieved successfully",
        type: mining_dto_1.MiningInfoDto,
    })
], MiningController.prototype, "getMiningInfo", null);
__decorate([
    (0, common_1.Get)("hashps"),
    (0, swagger_1.ApiOperation)({ summary: "Get network hash per second" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Network hash rate retrieved successfully",
        schema: {
            properties: {
                hashPS: { type: "number" },
            },
        },
    })
], MiningController.prototype, "getNetworkHashPS", null);
__decorate([
    (0, common_1.Post)("template"),
    (0, swagger_1.ApiOperation)({ summary: "Get block template for mining" }),
    (0, swagger_1.ApiResponse)({ status: 200, type: mining_dto_3.BlockTemplateDto }),
    __param(0, (0, common_1.Body)())
], MiningController.prototype, "getBlockTemplate", null);
__decorate([
    (0, common_1.Post)("submit-block"),
    (0, swagger_1.ApiOperation)({ summary: "Submit a mined block" }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: "Block submitted successfully",
        schema: {
            properties: {
                status: { type: "string" },
                blockHash: { type: "string" },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: "Invalid block data" }),
    __param(0, (0, common_1.Body)())
], MiningController.prototype, "submitBlock", null);
exports.MiningController = MiningController = __decorate([
    (0, swagger_1.ApiTags)("Mining"),
    (0, common_1.Controller)("mining")
], MiningController);
