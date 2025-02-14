import { Injectable, Logger } from '@nestjs/common';
import { TransactionBuilder, estimateFee } from '@h3tag-blockchain/core';
import {
  TransactionResponseDto,
  RawTransactionResponseDto,
  DecodedTransactionDto,
} from '../dtos/transaction.dto';
import { BlockchainService } from './blockchain.service';

/**
 * Service handling transaction-related operations
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Transaction management and queries
 */
@Injectable()
export class TransactionService {
  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly transactionBuilder: TransactionBuilder,
  ) {}

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
  async getTransaction(txId: string): Promise<TransactionResponseDto> {
    const tx = await this.transactionBuilder.getTransaction(txId);
    if (!tx) {
      throw new Error('Transaction not found');
    }

    return {
      id: tx.id,
      fromAddress: tx.sender,
      toAddress: tx.recipient,
      amount: tx.outputs[0]?.amount || 0n,
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

  async sendRawTransaction(rawTransaction: string): Promise<string> {
    try {
      // Validate hex string format
      if (!/^[0-9a-fA-F]+$/.test(rawTransaction)) {
        throw new Error('Invalid raw transaction format - must be hex string');
      }

      // Call core blockchain service to broadcast transaction
      const txId = await this.blockchainService.sendRawTransaction(
        rawTransaction,
      );

      Logger.log('Raw transaction broadcast successfully:', { txId });

      return txId;
    } catch (error) {
      Logger.error('Failed to send raw transaction:', error);
      throw error;
    }
  }

  async getRawTransaction(txId: string): Promise<RawTransactionResponseDto> {
    const transaction = await this.transactionBuilder.getTransaction(txId);

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return {
      hex: transaction.toHex(),
      txid: transaction.id,
    };
  }

  async decodeRawTransaction(
    rawTransaction: string,
  ): Promise<DecodedTransactionDto> {
    try {
      const decodedTx = await TransactionBuilder.decodeRawTransaction(
        rawTransaction,
      );
      return {
        txid: decodedTx.id,
        hash: decodedTx.hash,
        version: decodedTx.version,
        vin: decodedTx.inputs.map((input) => ({
          txId: input.txId,
          outputIndex: input.outputIndex,
          amount: input.amount.toString(),
          address: input.address,
        })),
        vout: decodedTx.outputs.map((output) => ({
          address: output.address,
          amount: output.amount.toString(),
          index: output.index,
        })),
      };
    } catch (error: unknown) {
      throw new Error(
        `Failed to decode transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async estimateFee(targetBlocks = 6): Promise<bigint> {
    try {
      return await estimateFee(targetBlocks);
    } catch (error: unknown) {
      Logger.error('Failed to estimate fee:', error);
      throw error;
    }
  }

  async signMessage(message: string, privateKey: string): Promise<string> {
    try {
      return await TransactionBuilder.signMessage(message, privateKey);
    } catch (error: unknown) {
      Logger.error('Failed to sign message:', error);
      throw error;
    }
  }

  async verifyMessage(
    message: string,
    signature: string,
    publicKey: string,
  ): Promise<boolean> {
    try {
      return await TransactionBuilder.verifyMessage(
        message,
        signature,
        publicKey,
      );
    } catch (error: unknown) {
      Logger.error('Failed to verify message:', error);
      throw error;
    }
  }

  async validateAddress(address: string): Promise<boolean> {
    try {
      return TransactionBuilder.validateAddress(address);
    } catch (error: unknown) {
      Logger.error('Failed to validate address:', error);
      throw error;
    }
  }

  getNetworkType(): string {
    return TransactionBuilder['getNetworkType']();
  }
}
