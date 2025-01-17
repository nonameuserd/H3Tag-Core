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
exports.WalletController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const wallet_dto_1 = require("../dtos/wallet.dto");
const shared_1 = require("@h3tag-blockchain/shared");
const core_1 = require("@h3tag-blockchain/core");
let WalletController = class WalletController {
    constructor(walletService) {
        this.walletService = walletService;
    }
    async createWallet(createWalletDto) {
        try {
            return await this.walletService.createWallet(createWalletDto);
        }
        catch (error) {
            shared_1.Logger.error('Failed to create wallet:', error);
            throw new common_1.HttpException(`Failed to create wallet: ${error.message}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async getWallet(address) {
        try {
            return await this.walletService.getWallet(address);
        }
        catch (error) {
            shared_1.Logger.error('Failed to get wallet:', error);
            throw new common_1.HttpException(`Wallet not found: ${error.message}`, common_1.HttpStatus.NOT_FOUND);
        }
    }
    async signTransaction(address, signTransactionDto) {
        try {
            const builder = new core_1.TransactionBuilder();
            const withInput = await builder.addInput(signTransactionDto.transaction.fromAddress, 0, signTransactionDto.transaction.publicKey, BigInt(signTransactionDto.transaction.amount));
            const withOutput = await withInput.addOutput(signTransactionDto.transaction.toAddress, BigInt(signTransactionDto.transaction.amount));
            const transaction = await withOutput.build();
            const signature = await this.walletService.signTransaction(address, transaction, signTransactionDto.password);
            return { signature };
        }
        catch (error) {
            shared_1.Logger.error('Failed to sign transaction:', error);
            throw new common_1.HttpException(`Failed to sign transaction: ${error.message}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async sendToAddress(fromAddress, sendToAddressDto) {
        try {
            const txId = await this.walletService.sendToAddress(fromAddress, sendToAddressDto.toAddress, sendToAddressDto.amount, sendToAddressDto.password);
            return { txId };
        }
        catch (error) {
            shared_1.Logger.error('Failed to send transaction:', error);
            throw new common_1.HttpException(`Failed to send transaction: ${error.message}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async getBalance(address) {
        const balance = await this.walletService.getBalance(address);
        return {
            confirmed: balance.confirmed.toString(),
            unconfirmed: balance.unconfirmed.toString()
        };
    }
    async getNewAddress(address) {
        const newAddress = await this.walletService.getNewAddress(address);
        return { address: newAddress };
    }
    async exportPrivateKey(address, exportDto) {
        try {
            const privateKey = await this.walletService.exportPrivateKey(address, exportDto.password);
            return { privateKey };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to export private key: ${error.message}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async importPrivateKey(importDto) {
        try {
            return await this.walletService.importPrivateKey(importDto);
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to import private key: ${error.message}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async listUnspent(address) {
        try {
            return await this.walletService.listUnspent(address);
        }
        catch (error) {
            shared_1.Logger.error('Failed to list unspent outputs:', error);
            throw new common_1.HttpException(`Failed to list unspent outputs: ${error.message}`, common_1.HttpStatus.NOT_FOUND);
        }
    }
    async getTxOut(txid, n) {
        try {
            return await this.walletService.getTxOut(txid, parseInt(n.toString()));
        }
        catch (error) {
            shared_1.Logger.error('Failed to get transaction output:', error);
            throw new common_1.HttpException(`Transaction output not found: ${error.message}`, common_1.HttpStatus.NOT_FOUND);
        }
    }
};
exports.WalletController = WalletController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new wallet' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Wallet created successfully',
        type: wallet_dto_1.WalletResponseDto
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid parameters' }),
    __param(0, (0, common_1.Body)())
], WalletController.prototype, "createWallet", null);
__decorate([
    (0, common_1.Get)(':address'),
    (0, swagger_1.ApiOperation)({ summary: 'Get wallet information' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Wallet information retrieved successfully',
        type: wallet_dto_1.WalletResponseDto
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Wallet not found' }),
    __param(0, (0, common_1.Param)('address'))
], WalletController.prototype, "getWallet", null);
__decorate([
    (0, common_1.Post)(':address/sign'),
    (0, swagger_1.ApiOperation)({ summary: 'Sign a transaction' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Transaction signed successfully',
        schema: {
            properties: {
                signature: { type: 'string' }
            }
        }
    }),
    __param(0, (0, common_1.Param)('address')),
    __param(1, (0, common_1.Body)())
], WalletController.prototype, "signTransaction", null);
__decorate([
    (0, common_1.Post)(':address/send'),
    (0, swagger_1.ApiOperation)({ summary: 'Send funds to another address' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Transaction sent successfully',
        schema: {
            properties: {
                txId: { type: 'string' }
            }
        }
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Invalid parameters or insufficient funds'
    }),
    __param(0, (0, common_1.Param)('address')),
    __param(1, (0, common_1.Body)())
], WalletController.prototype, "sendToAddress", null);
__decorate([
    (0, common_1.Get)(':address/balance'),
    (0, swagger_1.ApiOperation)({ summary: 'Get wallet balance' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Balance retrieved successfully',
        type: wallet_dto_1.WalletBalanceDto
    }),
    __param(0, (0, common_1.Param)('address'))
], WalletController.prototype, "getBalance", null);
__decorate([
    (0, common_1.Post)(':address/addresses'),
    (0, swagger_1.ApiOperation)({ summary: 'Generate new address' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'New address generated successfully',
        type: wallet_dto_1.NewAddressResponseDto
    }),
    __param(0, (0, common_1.Param)('address'))
], WalletController.prototype, "getNewAddress", null);
__decorate([
    (0, common_1.Post)(':address/export'),
    (0, swagger_1.ApiOperation)({ summary: 'Export wallet private key' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Private key exported successfully',
        schema: {
            properties: {
                privateKey: { type: 'string' }
            }
        }
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid password or wallet not found' }),
    __param(0, (0, common_1.Param)('address')),
    __param(1, (0, common_1.Body)())
], WalletController.prototype, "exportPrivateKey", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, swagger_1.ApiOperation)({ summary: 'Import wallet from private key' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Wallet imported successfully',
        type: wallet_dto_1.WalletResponseDto
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid private key or password' }),
    __param(0, (0, common_1.Body)())
], WalletController.prototype, "importPrivateKey", null);
__decorate([
    (0, common_1.Get)(':address/unspent'),
    (0, swagger_1.ApiOperation)({ summary: 'List unspent transaction outputs (UTXOs)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'UTXOs retrieved successfully',
        type: [wallet_dto_1.UnspentOutputDto]
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Wallet not found' }),
    __param(0, (0, common_1.Param)('address'))
], WalletController.prototype, "listUnspent", null);
__decorate([
    (0, common_1.Get)('txout/:txid/:n'),
    (0, swagger_1.ApiOperation)({ summary: 'Get specific transaction output' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Transaction output retrieved successfully',
        type: wallet_dto_1.TxOutDto
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'Transaction output not found'
    }),
    __param(0, (0, common_1.Param)('txid')),
    __param(1, (0, common_1.Param)('n'))
], WalletController.prototype, "getTxOut", null);
exports.WalletController = WalletController = __decorate([
    (0, swagger_1.ApiTags)('Wallets'),
    (0, common_1.Controller)('wallets')
], WalletController);
//# sourceMappingURL=wallet.controller.js.map