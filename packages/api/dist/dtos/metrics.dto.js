"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsResponseDto = exports.MetricsQueryDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
/**
 * @swagger
 * components:
 *   schemas:
 *     MetricsQueryDto:
 *       type: object
 *       properties:
 *         timeWindow:
 *           type: number
 *           description: Time window in milliseconds for metrics calculation
 */
class MetricsQueryDto {
}
exports.MetricsQueryDto = MetricsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Time window in milliseconds",
        required: false,
        example: 3600000,
    }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)()
], MetricsQueryDto.prototype, "timeWindow", void 0);
/**
 * @swagger
 * components:
 *   schemas:
 *     MetricsResponseDto:
 *       type: object
 *       properties:
 *         averageTAGFees:
 *           type: number
 *           description: Average TAG fees over the specified time window
 *         averageTAGVolume:
 *           type: number
 *           description: Average TAG transaction volume over the specified time window
 *         hashRate:
 *           type: number
 *           description: Current network hash rate
 *         difficulty:
 *           type: number
 *           description: Current mining difficulty
 *         blockHeight:
 *           type: number
 *           description: Current blockchain height
 *         syncedHeaders:
 *           type: number
 *           description: Number of synced headers
 *         syncedBlocks:
 *           type: number
 *           description: Number of synced blocks
 *         whitelistedPeers:
 *           type: number
 *           description: Number of whitelisted peers
 *         blacklistedPeers:
 *           type: number
 *           description: Number of blacklisted peers
 */
class MetricsResponseDto {
}
exports.MetricsResponseDto = MetricsResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Average TAG fees" })
], MetricsResponseDto.prototype, "averageTAGFees", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Average TAG volume" })
], MetricsResponseDto.prototype, "averageTAGVolume", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Current hash rate" })
], MetricsResponseDto.prototype, "hashRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Current mining difficulty" })
], MetricsResponseDto.prototype, "difficulty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Current block height" })
], MetricsResponseDto.prototype, "blockHeight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Number of synced headers" })
], MetricsResponseDto.prototype, "syncedHeaders", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Number of synced blocks" })
], MetricsResponseDto.prototype, "syncedBlocks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Number of whitelisted peers" })
], MetricsResponseDto.prototype, "whitelistedPeers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Number of blacklisted peers" })
], MetricsResponseDto.prototype, "blacklistedPeers", void 0);
//# sourceMappingURL=metrics.dto.js.map