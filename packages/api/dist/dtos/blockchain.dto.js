"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainInfoDto = exports.BestBlockHashDto = exports.DifficultyResponseDto = exports.ChainTipDto = exports.TransactionValidationRequestDto = exports.TransactionValidationResponseDto = exports.FirstTransactionResponseDto = exports.UtxoDto = exports.BlockResponseDto = exports.TransactionSubmitDto = exports.BlockchainStatsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class BlockchainStatsDto {
}
exports.BlockchainStatsDto = BlockchainStatsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Current blockchain height' })
], BlockchainStatsDto.prototype, "height", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Total number of transactions' })
], BlockchainStatsDto.prototype, "totalTransactions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Current difficulty' })
], BlockchainStatsDto.prototype, "difficulty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Network hashrate' })
], BlockchainStatsDto.prototype, "hashrate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Current block time in seconds' })
], BlockchainStatsDto.prototype, "blockTime", void 0);
class TransactionSubmitDto {
}
exports.TransactionSubmitDto = TransactionSubmitDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Transaction sender address',
        example: '0x1234...'
    })
], TransactionSubmitDto.prototype, "sender", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Transaction recipient address',
        example: '0x5678...'
    })
], TransactionSubmitDto.prototype, "recipient", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Transaction amount',
        example: '100'
    })
], TransactionSubmitDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Transaction signature',
        example: 'base64_encoded_signature'
    })
], TransactionSubmitDto.prototype, "signature", void 0);
class BlockResponseDto {
}
exports.BlockResponseDto = BlockResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Block hash' })
], BlockResponseDto.prototype, "hash", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Block height' })
], BlockResponseDto.prototype, "height", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Previous block hash' })
], BlockResponseDto.prototype, "previousHash", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Block timestamp' })
], BlockResponseDto.prototype, "timestamp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Block transactions' })
], BlockResponseDto.prototype, "transactions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Block merkle root' })
], BlockResponseDto.prototype, "merkleRoot", void 0);
class UtxoDto {
}
exports.UtxoDto = UtxoDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Transaction ID',
        example: '1234abcd...'
    })
], UtxoDto.prototype, "txid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Output index',
        example: 0
    })
], UtxoDto.prototype, "vout", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Amount in smallest unit',
        example: '1000000'
    })
], UtxoDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Number of confirmations',
        example: 6
    })
], UtxoDto.prototype, "confirmations", void 0);
class FirstTransactionResponseDto {
}
exports.FirstTransactionResponseDto = FirstTransactionResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Block height of first transaction',
        example: 12345
    })
], FirstTransactionResponseDto.prototype, "blockHeight", void 0);
class TransactionValidationResponseDto {
}
exports.TransactionValidationResponseDto = TransactionValidationResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Whether the transaction is valid',
        example: true
    })
], TransactionValidationResponseDto.prototype, "isValid", void 0);
class TransactionValidationRequestDto {
}
exports.TransactionValidationRequestDto = TransactionValidationRequestDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Transaction to validate'
    })
], TransactionValidationRequestDto.prototype, "transaction", void 0);
class ChainTipDto {
}
exports.ChainTipDto = ChainTipDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Hash of the block at the tip' })
], ChainTipDto.prototype, "hash", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Height of the block' })
], ChainTipDto.prototype, "height", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Status of the chain tip',
        enum: ['active', 'valid-fork', 'invalid', 'valid-headers'],
        example: 'active'
    })
], ChainTipDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Branch length from the main chain' })
], ChainTipDto.prototype, "branchLength", void 0);
class DifficultyResponseDto {
}
exports.DifficultyResponseDto = DifficultyResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Current mining difficulty',
        example: 4.2
    })
], DifficultyResponseDto.prototype, "difficulty", void 0);
class BestBlockHashDto {
}
exports.BestBlockHashDto = BestBlockHashDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Hash of the best (latest) block in the chain',
        example: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f'
    })
], BestBlockHashDto.prototype, "hash", void 0);
class BlockchainInfoDto {
}
exports.BlockchainInfoDto = BlockchainInfoDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Current blockchain height' })
], BlockchainInfoDto.prototype, "blocks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Best block hash' })
], BlockchainInfoDto.prototype, "bestBlockHash", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Current difficulty' })
], BlockchainInfoDto.prototype, "difficulty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Median time past' })
], BlockchainInfoDto.prototype, "medianTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Verification progress' })
], BlockchainInfoDto.prototype, "verificationProgress", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Chain work in hex' })
], BlockchainInfoDto.prototype, "chainWork", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Chain state size on disk' })
], BlockchainInfoDto.prototype, "chainSize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Is initial block download' })
], BlockchainInfoDto.prototype, "initialBlockDownload", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Network hashrate' })
], BlockchainInfoDto.prototype, "networkHashrate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Chain tips information' })
], BlockchainInfoDto.prototype, "chainTips", void 0);
//# sourceMappingURL=blockchain.dto.js.map