"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@h3tag-blockchain/core");
/**
 * Service handling transaction-related operations
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Transaction management and queries
 */
let TransactionService = class TransactionService {
    constructor(blockchainService, transactionBuilder) {
        this.blockchainService = blockchainService;
        this.transactionBuilder = transactionBuilder;
    }
    /**
     * Retrieve transaction details by ID
     * @swagger
     * path:
     *   /transactions/{txId}:
     *     get:
     *       summary: Get transaction by ID
     *       parameters:
     *         - name: txId
     *           in: path
     *           required: true
     *           schema:
     *             type: string
     *           description: Transaction ID to fetch
     *       responses:
     *         200:
     *           description: Transaction details
     *           content:
     *             application/json:
     *               schema:
     *                 $ref: '#/components/schemas/TransactionResponseDto'
     *         404:
     *           description: Transaction not found
     * @param txId Transaction ID to fetch
     * @returns Promise<TransactionResponseDto> Transaction details
     */
    async getTransaction(txId) {
        const tx = await this.transactionBuilder.getTransaction(txId);
        if (!tx) {
            throw new Error("Transaction not found");
        }
        return {
            id: tx.id,
            fromAddress: tx.sender,
            toAddress: tx.recipient,
            amount: tx.outputs
                .reduce((sum, output) => sum + output.amount, BigInt(0))
                .toString(),
            timestamp: new Date(tx.timestamp).toISOString(),
            blockHeight: tx.blockHeight,
            confirmations: tx.inputs[0]?.confirmations || 0,
            fee: tx.fee.toString(),
            type: tx.type,
            status: tx.status,
            hash: tx.hash,
            inputs: tx.inputs.map((input) => ({
                txId: input.txId,
                outputIndex: input.outputIndex,
                amount: input.amount.toString(),
                address: input.address,
            })),
            outputs: tx.outputs.map((output) => ({
                address: output.address,
                amount: output.amount.toString(),
                index: output.index,
            })),
        };
    }
    async sendRawTransaction(rawTransaction) {
        try {
            // Validate hex string format
            if (!/^[0-9a-fA-F]+$/.test(rawTransaction)) {
                throw new Error("Invalid raw transaction format - must be hex string");
            }
            // Call core blockchain service to broadcast transaction
            const txId = await this.blockchainService.sendRawTransaction(rawTransaction);
            common_1.Logger.log("Raw transaction broadcast successfully:", { txId });
            return txId;
        }
        catch (error) {
            common_1.Logger.error("Failed to send raw transaction:", error);
            throw error;
        }
    }
    async getRawTransaction(txId) {
        const transaction = await this.transactionBuilder.getTransaction(txId);
        if (!transaction) {
            throw new Error("Transaction not found");
        }
        return {
            hex: transaction.toHex(),
            txid: transaction.id,
        };
    }
    async decodeRawTransaction(rawTransaction) {
        try {
            const decodedTx = await core_1.TransactionBuilder.decodeRawTransaction(rawTransaction);
            return {
                txid: decodedTx.id,
                hash: decodedTx.hash,
                version: decodedTx.version,
                vin: decodedTx.inputs,
                vout: decodedTx.outputs,
            };
        }
        catch (error) {
            throw new Error(`Failed to decode transaction: ${error.message}`);
        }
    }
    async estimateFee(targetBlocks = 6) {
        try {
            return await (0, core_1.estimateFee)(targetBlocks);
        }
        catch (error) {
            common_1.Logger.error("Failed to estimate fee:", error);
            throw error;
        }
    }
    async signMessage(message, privateKey) {
        try {
            return await core_1.TransactionBuilder.signMessage(message, privateKey);
        }
        catch (error) {
            common_1.Logger.error("Failed to sign message:", error);
            throw error;
        }
    }
    async verifyMessage(message, signature, publicKey) {
        try {
            return await core_1.TransactionBuilder.verifyMessage(message, signature, publicKey);
        }
        catch (error) {
            common_1.Logger.error("Failed to verify message:", error);
            throw error;
        }
    }
    async validateAddress(address) {
        try {
            return core_1.TransactionBuilder.validateAddress(address);
        }
        catch (error) {
            common_1.Logger.error("Failed to validate address:", error);
            throw error;
        }
    }
    getNetworkType() {
        return core_1.TransactionBuilder["getNetworkType"]();
    }
};
exports.TransactionService = TransactionService;
exports.TransactionService = TransactionService = __decorate([
    (0, common_1.Injectable)()
], TransactionService);
//# sourceMappingURL=transaction.service.js.map