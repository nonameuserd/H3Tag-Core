"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmitBlockDto = exports.BlockTemplateRequestDto = exports.BlockTemplateDto = exports.MiningInfoDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const transaction_dto_1 = require("./transaction.dto");
class MiningInfoDto {
}
exports.MiningInfoDto = MiningInfoDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Current blockchain height" })
], MiningInfoDto.prototype, "blocks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Current mining difficulty" })
], MiningInfoDto.prototype, "difficulty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Network hashrate in H/s" })
], MiningInfoDto.prototype, "networkHashrate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Current block reward" })
], MiningInfoDto.prototype, "reward", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Total chain work in hex" })
], MiningInfoDto.prototype, "chainWork", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Whether network is actively mining" })
], MiningInfoDto.prototype, "isNetworkMining", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Network hash power per second" })
], MiningInfoDto.prototype, "networkHashPS", void 0);
class BlockTemplateDto {
}
exports.BlockTemplateDto = BlockTemplateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Block version" })
], BlockTemplateDto.prototype, "version", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Block height" })
], BlockTemplateDto.prototype, "height", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Previous block hash" })
], BlockTemplateDto.prototype, "previousHash", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Block timestamp" })
], BlockTemplateDto.prototype, "timestamp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Mining difficulty" })
], BlockTemplateDto.prototype, "difficulty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Block transactions", type: [transaction_dto_1.TransactionDto] })
], BlockTemplateDto.prototype, "transactions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Merkle root hash" })
], BlockTemplateDto.prototype, "merkleRoot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Mining target in hex" })
], BlockTemplateDto.prototype, "target", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Minimum timestamp allowed" })
], BlockTemplateDto.prototype, "minTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Maximum timestamp allowed" })
], BlockTemplateDto.prototype, "maxTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Maximum allowed version" })
], BlockTemplateDto.prototype, "maxVersion", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Minimum allowed version" })
], BlockTemplateDto.prototype, "minVersion", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Default block version" })
], BlockTemplateDto.prototype, "defaultVersion", void 0);
class BlockTemplateRequestDto {
}
exports.BlockTemplateRequestDto = BlockTemplateRequestDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Address to receive mining rewards",
        example: "0x1234...",
    }),
    (0, class_validator_1.IsString)()
], BlockTemplateRequestDto.prototype, "minerAddress", void 0);
class SubmitBlockDto {
}
exports.SubmitBlockDto = SubmitBlockDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Block header data",
        example: {
            version: 1,
            previousHash: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
            merkleRoot: "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
            timestamp: 1231006505,
            difficulty: 486604799,
            nonce: 2083236893,
        },
    })
], SubmitBlockDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Block transactions",
        example: [
            {
                txid: "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
                version: 1,
                inputs: [],
                outputs: [],
            },
        ],
    })
], SubmitBlockDto.prototype, "transactions", void 0);
