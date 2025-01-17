import { Injectable } from "@nestjs/common";
import {
  Blockchain,
  Transaction,
  TransactionBuilder,
  BlockchainStats,
} from "@h3tag-blockchain/core";
import {
  BlockchainStatsDto,
  TransactionSubmitDto,
  ChainTipDto,
  BlockchainInfoDto,
} from "../dtos/blockchain.dto";
import { Logger } from "@h3tag-blockchain/shared";
import { Node } from "@h3tag-blockchain/core";

/**
 * @swagger
 * tags:
 *   name: Blockchain
 *   description: Blockchain management and query endpoints
 */
@Injectable()
export class BlockchainService {
  private readonly stats: BlockchainStats;
  private blockchain: Blockchain;

  constructor(private readonly node: Node) {
    this.blockchain = Blockchain.getInstance();
    this.stats = new BlockchainStats(this.blockchain);
  }

  /**
   * @swagger
   * /blockchain/stats:
   *   get:
   *     summary: Get blockchain statistics
   *     tags: [Blockchain]
   *     responses:
   *       200:
   *         description: Blockchain statistics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/BlockchainStatsDto'
   */
  async getStats(): Promise<BlockchainStatsDto> {
    const stats = this.blockchain.getBlockchainStats();
    const chainStats = await stats.getChainStats();
    return {
      height: chainStats.totalBlocks,
      totalTransactions: chainStats.totalTransactions,
      difficulty: chainStats.difficulty,
      hashrate: await stats.getNetworkHashRate(),
      blockTime: await stats.getAverageBlockTime(),
    };
  }

  /**
   * @swagger
   * /blockchain/transactions:
   *   post:
   *     summary: Submit a new transaction
   *     tags: [Blockchain]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/TransactionSubmitDto'
   *     responses:
   *       201:
   *         description: Transaction submitted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 txId:
   *                   type: string
   *       400:
   *         description: Invalid transaction or submission failed
   */
  async submitTransaction(txData: TransactionSubmitDto): Promise<string> {
    try {
      const builder = new TransactionBuilder();
      const withInput = await builder.addInput(
        txData.sender,
        0,
        txData.signature,
        BigInt(txData.amount)
      );
      const withOutput = await withInput.addOutput(
        txData.recipient,
        BigInt(txData.amount)
      );
      const transaction = await withOutput.build();

      const success = await this.blockchain.addTransaction(transaction);
      if (!success) {
        throw new Error("Transaction rejected by blockchain");
      }

      return transaction.id;
    } catch (error) {
      Logger.error("Transaction submission failed:", error);
      throw error;
    }
  }

  /**
   * @swagger
   * /blockchain/height:
   *   get:
   *     summary: Get current blockchain height
   *     tags: [Blockchain]
   *     responses:
   *       200:
   *         description: Current height retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: number
   */
  async getHeight(): Promise<number> {
    return this.blockchain.getCurrentHeight();
  }

  /**
   * @swagger
   * /blockchain/version:
   *   get:
   *     summary: Get blockchain version
   *     tags: [Blockchain]
   *     responses:
   *       200:
   *         description: Version retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: number
   */
  getVersion(): number {
    return this.blockchain.getVersion();
  }

  /**
   * @swagger
   * /blockchain/block/{hash}:
   *   get:
   *     summary: Get block information by hash
   *     tags: [Blockchain]
   *     parameters:
   *       - in: path
   *         name: hash
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Block information retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 hash:
   *                   type: string
   *                 height:
   *                   type: number
   *                 previousHash:
   *                   type: string
   *                 timestamp:
   *                   type: number
   *                 transactions:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Transaction'
   *                 merkleRoot:
   *                   type: string
   *       404:
   *         description: Block not found
   */
  async getBlock(hash: string) {
    const block = await this.blockchain.getBlock(hash);
    if (!block) {
      throw new Error("Block not found");
    }
    return {
      hash: block.hash,
      height: block.header.height,
      previousHash: block.header.previousHash,
      timestamp: block.header.timestamp,
      transactions: block.transactions,
      merkleRoot: block.header.merkleRoot,
    };
  }

  async getCurrencyDetails() {
    return this.blockchain.getCurrencyDetails();
  }

  async getFirstTransactionForAddress(address: string) {
    return this.blockchain.getFirstTransactionForAddress(address);
  }

  async validateTransactionAmount(tx: TransactionSubmitDto): Promise<boolean> {
    const transaction = await this.buildTransaction(tx);
    return this.blockchain.validateTransactionAmount(transaction);
  }

  async getConfirmedUtxos(address: string) {
    return this.blockchain.getConfirmedUtxos(address);
  }

  private async buildTransaction(
    tx: TransactionSubmitDto
  ): Promise<Transaction> {
    const builder = new TransactionBuilder();
    const withInput = await builder.addInput(
      tx.sender,
      0,
      tx.signature,
      BigInt(tx.amount)
    );
    const withOutput = await withInput.addOutput(
      tx.recipient,
      BigInt(tx.amount)
    );
    return withOutput.build();
  }

  async getNode() {
    return this.blockchain.getNode().getInfo();
  }

  /**
   * @swagger
   * /blockchain/chain-tips:
   *   get:
   *     summary: Get information about chain tips
   *     tags: [Blockchain]
   *     responses:
   *       200:
   *         description: Chain tips retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/ChainTipDto'
   */
  async getChainTips(): Promise<ChainTipDto[]> {
    const tips = await this.blockchain.getChainTips();
    return tips.map((tip) => ({
      hash: tip.hash,
      height: tip.height,
      status: tip.status,
      branchLength: tip.branchLen,
    }));
  }

  /**
   * @swagger
   * /blockchain/difficulty:
   *   get:
   *     summary: Get current mining difficulty
   *     tags: [Blockchain]
   *     responses:
   *       200:
   *         description: Current difficulty retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: number
   */
  async getCurrentDifficulty(): Promise<number> {
    return this.blockchain.getCurrentDifficulty();
  }

  /**
   * @swagger
   * /blockchain/best-block-hash:
   *   get:
   *     summary: Get the hash of the best (latest) block
   *     tags: [Blockchain]
   *     responses:
   *       200:
   *         description: Best block hash retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/BestBlockHashDto'
   */
  async getBestBlockHash(): Promise<string> {
    const latestBlock = this.blockchain.getLatestBlock();
    if (!latestBlock) {
      throw new Error("No blocks in chain");
    }
    return latestBlock.hash;
  }

  /**
   * @swagger
   * /blockchain/info:
   *   get:
   *     summary: Get blockchain information
   *     tags: [Blockchain]
   *     responses:
   *       200:
   *         description: Blockchain information retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/BlockchainInfoDto'
   */
  async getBlockchainInfo(): Promise<BlockchainInfoDto> {
    try {
      const stats = await this.stats.getChainStats();
      const chainTips = await this.blockchain.getChainTips();
      const currentBlock = this.blockchain.getLatestBlock();
      const networkHashrate = await this.stats.getNetworkHashRate();

      return {
        blocks: this.blockchain.getCurrentHeight(),
        bestBlockHash: currentBlock.hash,
        difficulty: stats.difficulty,
        medianTime: await this.stats.getMedianTime(),
        verificationProgress: 1,
        chainWork: "0x0",
        chainSize: 0,
        initialBlockDownload: false,
        networkHashrate,
        chainTips: chainTips.map((tip) => ({
          hash: tip.hash,
          height: tip.height,
          status: tip.status,
          branchLength: tip.branchLen,
        })),
      };
    } catch (error) {
      Logger.error("Error getting blockchain info:", error);
      throw error;
    }
  }

  async sendRawTransaction(
    rawTx: string,
    allowHighFees = false
  ): Promise<string> {
    return this.node.broadcastRawTransaction(rawTx);
  }

  getBlockchain(): Blockchain {
    return this.blockchain;
  }
}
