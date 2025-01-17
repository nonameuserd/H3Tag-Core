"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionDto = exports.ValidateAddressResponseDto = exports.ValidateAddressRequestDto = exports.VerifyMessageResponseDto = exports.VerifyMessageRequestDto = exports.SignMessageResponseDto = exports.SignMessageRequestDto = exports.EstimateFeeResponseDto = exports.EstimateFeeRequestDto = exports.DecodedTransactionDto = exports.DecodeRawTransactionDto = exports.RawTransactionResponseDto = exports.SendRawTransactionDto = exports.TransactionResponseDto = exports.TransactionOutputDto = exports.TransactionInputDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class TransactionInputDto {
}
exports.TransactionInputDto = TransactionInputDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Input transaction ID" })
], TransactionInputDto.prototype, "txId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Output index in the input transaction" })
], TransactionInputDto.prototype, "outputIndex", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Input amount" })
], TransactionInputDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Input address" })
], TransactionInputDto.prototype, "address", void 0);
class TransactionOutputDto {
}
exports.TransactionOutputDto = TransactionOutputDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Output address" })
], TransactionOutputDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Output amount" })
], TransactionOutputDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Output index" })
], TransactionOutputDto.prototype, "index", void 0);
class TransactionResponseDto {
}
exports.TransactionResponseDto = TransactionResponseDto;
exports.TransactionDto = TransactionResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction ID",
        example: "123abc...",
    })
], TransactionResponseDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction sender address",
        example: "0x1234...",
    })
], TransactionResponseDto.prototype, "fromAddress", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction recipient address",
        example: "0x5678...",
    })
], TransactionResponseDto.prototype, "toAddress", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction amount",
        example: "100",
    })
], TransactionResponseDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction timestamp",
        example: "2024-03-20T10:30:00Z",
    })
], TransactionResponseDto.prototype, "timestamp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Block height where transaction was included",
        example: 12345,
    })
], TransactionResponseDto.prototype, "blockHeight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Number of confirmations",
        example: 6,
    })
], TransactionResponseDto.prototype, "confirmations", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction fee",
        example: "0.001",
    })
], TransactionResponseDto.prototype, "fee", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction type",
        enum: ["standard", "transfer", "coinbase", "pow_reward", "quadratic_vote"],
    })
], TransactionResponseDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction status",
        enum: ["pending", "confirmed", "failed"],
    })
], TransactionResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction hash",
        example: "0x1234...",
    })
], TransactionResponseDto.prototype, "hash", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [TransactionInputDto] })
], TransactionResponseDto.prototype, "inputs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [TransactionOutputDto] })
], TransactionResponseDto.prototype, "outputs", void 0);
class SendRawTransactionDto {
}
exports.SendRawTransactionDto = SendRawTransactionDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Raw transaction hex string",
        example: "0200000001ab3...",
    })
], SendRawTransactionDto.prototype, "rawTransaction", void 0);
class RawTransactionResponseDto {
}
exports.RawTransactionResponseDto = RawTransactionResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Raw transaction hex string",
        example: "0100000001...",
    })
], RawTransactionResponseDto.prototype, "hex", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction ID",
        example: "1234abcd...",
    })
], RawTransactionResponseDto.prototype, "txid", void 0);
class DecodeRawTransactionDto {
}
exports.DecodeRawTransactionDto = DecodeRawTransactionDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Raw transaction hex string to decode",
        example: "0200000001...",
    })
], DecodeRawTransactionDto.prototype, "rawTransaction", void 0);
class DecodedTransactionDto {
}
exports.DecodedTransactionDto = DecodedTransactionDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction ID",
        example: "1234abcd...",
    })
], DecodedTransactionDto.prototype, "txid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction hash",
        example: "abcd1234...",
    })
], DecodedTransactionDto.prototype, "hash", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction version",
        example: 2,
    })
], DecodedTransactionDto.prototype, "version", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction inputs",
        type: [Object],
    })
], DecodedTransactionDto.prototype, "vin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Transaction outputs",
        type: [Object],
    })
], DecodedTransactionDto.prototype, "vout", void 0);
class EstimateFeeRequestDto {
}
exports.EstimateFeeRequestDto = EstimateFeeRequestDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Number of blocks within which the transaction should be included",
        example: 6,
        minimum: 1,
        maximum: 1008,
        default: 6,
    })
], EstimateFeeRequestDto.prototype, "targetBlocks", void 0);
class EstimateFeeResponseDto {
}
exports.EstimateFeeResponseDto = EstimateFeeResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Estimated fee in smallest currency unit",
        example: "1000",
    })
], EstimateFeeResponseDto.prototype, "estimatedFee", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Target number of blocks for confirmation",
        example: 6,
    })
], EstimateFeeResponseDto.prototype, "targetBlocks", void 0);
class SignMessageRequestDto {
}
exports.SignMessageRequestDto = SignMessageRequestDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Message to sign",
        example: "Hello, World!",
    })
], SignMessageRequestDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Private key in hex format (64 characters)",
        example: "abcd1234...",
        minLength: 64,
        maxLength: 64,
        pattern: "^[a-f0-9]{64}$",
    })
], SignMessageRequestDto.prototype, "privateKey", void 0);
class SignMessageResponseDto {
}
exports.SignMessageResponseDto = SignMessageResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Combined signature hash",
        example: "ef123...",
    })
], SignMessageResponseDto.prototype, "signature", void 0);
class VerifyMessageRequestDto {
}
exports.VerifyMessageRequestDto = VerifyMessageRequestDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Message that was signed",
        example: "Hello, World!",
    })
], VerifyMessageRequestDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Signature to verify",
        example: "abc123...",
        pattern: "^[a-f0-9]{128}$",
    })
], VerifyMessageRequestDto.prototype, "signature", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Public key in hex format",
        example: "def456...",
        pattern: "^[a-f0-9]{130}$",
    })
], VerifyMessageRequestDto.prototype, "publicKey", void 0);
class VerifyMessageResponseDto {
}
exports.VerifyMessageResponseDto = VerifyMessageResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Whether the signature is valid",
        example: true,
    })
], VerifyMessageResponseDto.prototype, "isValid", void 0);
class ValidateAddressRequestDto {
}
exports.ValidateAddressRequestDto = ValidateAddressRequestDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Blockchain address to validate",
        example: "TAG1234...",
        minLength: 25,
        maxLength: 34,
    })
], ValidateAddressRequestDto.prototype, "address", void 0);
class ValidateAddressResponseDto {
}
exports.ValidateAddressResponseDto = ValidateAddressResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Whether the address is valid",
        example: true,
    })
], ValidateAddressResponseDto.prototype, "isValid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Network type of the address",
        example: "mainnet",
        enum: ["mainnet", "testnet", "devnet"],
    })
], ValidateAddressResponseDto.prototype, "network", void 0);
//# sourceMappingURL=transaction.dto.js.map