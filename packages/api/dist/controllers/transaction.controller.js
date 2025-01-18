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
exports.TransactionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const transaction_dto_1 = require("../dtos/transaction.dto");
const shared_1 = require("@h3tag-blockchain/shared");
const transaction_dto_2 = require("../dtos/transaction.dto");
const transaction_dto_3 = require("../dtos/transaction.dto");
const transaction_dto_4 = require("../dtos/transaction.dto");
const transaction_dto_5 = require("../dtos/transaction.dto");
const transaction_dto_6 = require("../dtos/transaction.dto");
const transaction_dto_7 = require("../dtos/transaction.dto");
let TransactionController = class TransactionController {
    constructor(transactionService) {
        this.transactionService = transactionService;
    }
    async getTransaction(txId) {
        try {
            return await this.transactionService.getTransaction(txId);
        }
        catch (error) {
            shared_1.Logger.error("Failed to get transaction:", error);
            throw new common_1.HttpException(`Transaction not found: ${error.message}`, common_1.HttpStatus.NOT_FOUND);
        }
    }
    async sendRawTransaction(sendRawTxDto) {
        try {
            const txId = await this.transactionService.sendRawTransaction(sendRawTxDto.rawTransaction);
            return { txId };
        }
        catch (error) {
            shared_1.Logger.error("Failed to send raw transaction:", error);
            throw new common_1.HttpException(`Failed to send raw transaction: ${error.message}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async getRawTransaction(txId) {
        try {
            return await this.transactionService.getRawTransaction(txId);
        }
        catch (error) {
            shared_1.Logger.error("Failed to get raw transaction:", error);
            throw new common_1.HttpException(`Transaction not found: ${error.message}`, common_1.HttpStatus.NOT_FOUND);
        }
    }
    async decodeRawTransaction(decodeDto) {
        try {
            return await this.transactionService.decodeRawTransaction(decodeDto.rawTransaction);
        }
        catch (error) {
            shared_1.Logger.error("Failed to decode transaction:", error);
            throw new common_1.HttpException(`Failed to decode transaction: ${error.message}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async estimateFee(estimateFeeDto) {
        try {
            const estimatedFee = await this.transactionService.estimateFee(estimateFeeDto.targetBlocks);
            return {
                estimatedFee: estimatedFee.toString(),
                targetBlocks: estimateFeeDto.targetBlocks || 6,
            };
        }
        catch (error) {
            shared_1.Logger.error("Failed to estimate fee:", error);
            throw new common_1.HttpException(`Failed to estimate fee: ${error.message}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async signMessage(signMessageDto) {
        try {
            const signature = await this.transactionService.signMessage(signMessageDto.message, signMessageDto.privateKey);
            return { signature };
        }
        catch (error) {
            shared_1.Logger.error("Failed to sign message:", error);
            throw new common_1.HttpException(`Failed to sign message: ${error.message}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async verifyMessage(verifyMessageDto) {
        try {
            const isValid = await this.transactionService.verifyMessage(verifyMessageDto.message, verifyMessageDto.signature, verifyMessageDto.publicKey);
            return { isValid };
        }
        catch (error) {
            shared_1.Logger.error("Failed to verify message:", error);
            throw new common_1.HttpException(`Failed to verify message: ${error.message}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async validateAddress(validateAddressDto) {
        try {
            const isValid = await this.transactionService.validateAddress(validateAddressDto.address);
            const network = isValid
                ? this.transactionService.getNetworkType()
                : undefined;
            return { isValid, network };
        }
        catch (error) {
            shared_1.Logger.error("Failed to validate address:", error);
            throw new common_1.HttpException(`Failed to validate address: ${error.message}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
};
exports.TransactionController = TransactionController;
__decorate([
    (0, common_1.Get)(":txId"),
    (0, swagger_1.ApiOperation)({ summary: "Get transaction by ID" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Transaction retrieved successfully",
        type: transaction_dto_1.TransactionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: "Transaction not found",
    }),
    __param(0, (0, common_1.Param)("txId"))
], TransactionController.prototype, "getTransaction", null);
__decorate([
    (0, common_1.Post)("raw"),
    (0, swagger_1.ApiOperation)({ summary: "Send raw transaction" }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: "Transaction sent successfully",
        schema: {
            properties: {
                txId: { type: "string" },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: "Invalid transaction",
    }),
    __param(0, (0, common_1.Body)())
], TransactionController.prototype, "sendRawTransaction", null);
__decorate([
    (0, common_1.Get)(":txId/raw"),
    (0, swagger_1.ApiOperation)({ summary: "Get raw transaction hex" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Raw transaction retrieved successfully",
        type: transaction_dto_2.RawTransactionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: "Transaction not found",
    }),
    __param(0, (0, common_1.Param)("txId"))
], TransactionController.prototype, "getRawTransaction", null);
__decorate([
    (0, common_1.Post)("decode"),
    (0, swagger_1.ApiOperation)({ summary: "Decode raw transaction" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Transaction decoded successfully",
        type: transaction_dto_3.DecodedTransactionDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: "Invalid raw transaction",
    }),
    __param(0, (0, common_1.Body)())
], TransactionController.prototype, "decodeRawTransaction", null);
__decorate([
    (0, common_1.Post)("estimate-fee"),
    (0, swagger_1.ApiOperation)({ summary: "Estimate transaction fee" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Fee estimated successfully",
        type: transaction_dto_4.EstimateFeeResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: "Invalid target blocks range",
    }),
    __param(0, (0, common_1.Body)())
], TransactionController.prototype, "estimateFee", null);
__decorate([
    (0, common_1.Post)("sign-message"),
    (0, swagger_1.ApiOperation)({ summary: "Sign a message using hybrid cryptography" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Message signed successfully",
        type: transaction_dto_5.SignMessageResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: "Invalid message or private key format",
    }),
    __param(0, (0, common_1.Body)())
], TransactionController.prototype, "signMessage", null);
__decorate([
    (0, common_1.Post)("verify-message"),
    (0, swagger_1.ApiOperation)({ summary: "Verify a signed message" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Message verification result",
        type: transaction_dto_6.VerifyMessageResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: "Invalid message, signature, or public key format",
    }),
    __param(0, (0, common_1.Body)())
], TransactionController.prototype, "verifyMessage", null);
__decorate([
    (0, common_1.Post)("validate-address"),
    (0, swagger_1.ApiOperation)({ summary: "Validate a blockchain address" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Address validation result",
        type: transaction_dto_7.ValidateAddressResponseDto,
    }),
    __param(0, (0, common_1.Body)())
], TransactionController.prototype, "validateAddress", null);
exports.TransactionController = TransactionController = __decorate([
    (0, swagger_1.ApiTags)("Transactions"),
    (0, common_1.Controller)("transactions")
], TransactionController);
