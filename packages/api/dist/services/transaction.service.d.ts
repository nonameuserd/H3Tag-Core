import { TransactionBuilder } from "@h3tag-blockchain/core";
import { TransactionResponseDto, RawTransactionResponseDto, DecodedTransactionDto } from "../dtos/transaction.dto";
import { BlockchainService } from "./blockchain.service";
/**
 * Service handling transaction-related operations
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Transaction management and queries
 */
export declare class TransactionService {
    private readonly blockchainService;
    private readonly transactionBuilder;
    constructor(blockchainService: BlockchainService, transactionBuilder: TransactionBuilder);
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
    getTransaction(txId: string): Promise<TransactionResponseDto>;
    sendRawTransaction(rawTransaction: string): Promise<string>;
    getRawTransaction(txId: string): Promise<RawTransactionResponseDto>;
    decodeRawTransaction(rawTransaction: string): Promise<DecodedTransactionDto>;
    estimateFee(targetBlocks?: number): Promise<bigint>;
    signMessage(message: string, privateKey: string): Promise<string>;
    verifyMessage(message: string, signature: string, publicKey: string): Promise<boolean>;
    validateAddress(address: string): Promise<boolean>;
    getNetworkType(): string;
}
