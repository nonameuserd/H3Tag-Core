import { Injectable } from '@nestjs/common';
import { MiningInfoDto, BlockTemplateDto, SubmitBlockDto } from '../dtos/mining.dto';
import { BlockchainService } from './blockchain.service';
import { Logger } from '@h3tag-blockchain/shared';
import { TransactionResponseDto } from '../dtos/transaction.dto';
import { AuditManager, Transaction, BlockBuilder } from '@h3tag-blockchain/core';
import { ProofOfWork } from '@h3tag-blockchain/core';
import { Mempool } from '@h3tag-blockchain/core';
import { MerkleTree } from '@h3tag-blockchain/core';

/**
 * @swagger
 * tags:
 *   name: Mining
 *   description: Mining operations and status service
 */
@Injectable()
export class MiningService {
  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly pow: ProofOfWork,
    private readonly mempool: Mempool,
    private readonly merkleTree: MerkleTree,
    private readonly auditManager: AuditManager,
  ) {}

  /**
   * @swagger
   * /mining/info:
   *   get:
   *     summary: Get mining information
   *     tags: [Mining]
   *     responses:
   *       200:
   *         description: Mining information retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MiningInfoDto'
   *       500:
   *         description: Failed to retrieve mining information
   */
  async getMiningInfo(): Promise<MiningInfoDto> {
    try {
      const blockchain = this.blockchainService.getBlockchain();
      const pow = blockchain.getConsensus().pow;

      // Get mining info from PoW consensus
      const miningInfo = await pow.getMiningInfo();

      // Get current block height
      const currentHeight = blockchain.getCurrentHeight();

      // Calculate current block reward using blockchain's method
      const reward = blockchain.calculateBlockReward(currentHeight);

      return {
        blocks: currentHeight,
        difficulty: miningInfo.difficulty,
        networkHashrate: miningInfo.networkHashRate,
        reward: Number(reward), // Convert bigint to number for API response
        chainWork: blockchain.getChainWork(),
        isNetworkMining: miningInfo.mining,
        networkHashPS: await pow.getNetworkHashPS(),
      };
    } catch (error) {
      Logger.error('Failed to get mining info:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /mining/hashps:
   *   get:
   *     summary: Get network hash per second
   *     tags: [Mining]
   *     responses:
   *       200:
   *         description: Network hash rate retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 hashPS: { type: 'number' }
   */
  async getNetworkHashPS(): Promise<number> {
    try {
      const blockchain = this.blockchainService.getBlockchain();
      const pow = blockchain.getConsensus().pow;
      return await pow.getNetworkHashPS();
    } catch (error) {
      Logger.error('Failed to get network hash rate:', error);
      throw error;
    }
  }

  /**
   * @swagger
   * /mining/template:
   *   post:
   *     summary: Get block template for mining
   *     tags: [Mining]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/BlockTemplateRequestDto'
   *     responses:
   *       200:
   *         description: Block template retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/BlockTemplateDto'
   *       400:
   *         description: Invalid miner address
   *       500:
   *         description: Failed to generate block template
   */
  async getBlockTemplate(minerAddress: string): Promise<BlockTemplateDto> {
    try {
      const blockchain = this.blockchainService.getBlockchain();
      const pow = blockchain.getConsensus().pow;
      const template = await pow.getBlockTemplate(minerAddress);

      return {
        version: template.version,
        height: template.height,
        previousHash: template.previousHash,
        timestamp: template.timestamp,
        difficulty: template.difficulty,
        transactions: template.transactions.map((tx) =>
          this.mapTransactionToDto(tx),
        ),
        merkleRoot: template.merkleRoot,
        target: template.target,
        minTime: template.minTime,
        maxTime: template.maxTime,
        maxVersion: template.maxVersion,
        minVersion: template.minVersion,
        defaultVersion: template.defaultVersion,
      };
    } catch (error) {
      Logger.error('Failed to get block template:', error);
      throw error;
    }
  }

  /**
   * @private
   * @param {Transaction} tx - The transaction to map to a DTO.
   * @returns {TransactionResponseDto} The mapped transaction DTO.
   */
  private mapTransactionToDto(tx: Transaction): TransactionResponseDto {
    return {
      id: tx.id,
      fromAddress: tx.sender,
      toAddress: tx.recipient,
      amount: tx.outputs[0]?.amount || 0n,
      timestamp: new Date(tx.timestamp).toISOString(),
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
      confirmations: 0, // Template transactions are unconfirmed
      blockHeight: undefined, // Not yet in a block
    };
  }

  async submitBlock(submitBlockDto: SubmitBlockDto): Promise<string> {
    try {
      const { header, transactions, minerKeyPair } = submitBlockDto;
      // Initialize the block builder using header values
      const blockBuilder = new BlockBuilder(
        header?.previousHash || '',
        header?.difficulty || 0,
        this.auditManager,
      )
        .setVersion(header?.version || 0)
        .setPreviousHash(header?.previousHash || '')
        .setMerkleRoot(header?.merkleRoot || '')
        .setTimestamp(header?.timestamp || 0)
        .setDifficulty(header?.difficulty || 0)
        .setNonce(header?.nonce || 0);

      // Await the asynchronous setTransactions call.
      await blockBuilder.setTransactions(transactions || []);

      const block = await blockBuilder.build(minerKeyPair);

      // Submit block to PoW consensus
      const success = await this.pow.submitBlock(block);
      if (!success) {
        throw new Error('Block submission failed');
      }

      return block.hash;
    } catch (error) {
      Logger.error('Failed to submit block:', error);
      throw error;
    }
  }
}
