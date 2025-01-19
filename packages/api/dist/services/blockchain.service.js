"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@h3tag-blockchain/core");
const shared_1 = require("@h3tag-blockchain/shared");
/**
 * @swagger
 * tags:
 *   name: Blockchain
 *   description: Blockchain management and query endpoints
 */
let BlockchainService = class BlockchainService {
    constructor(node) {
        this.node = node;
        this.blockchain = core_1.Blockchain.getInstance();
        this.stats = new core_1.BlockchainStats(this.blockchain);
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
    async getStats() {
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
    async submitTransaction(txData) {
        try {
            const builder = new core_1.TransactionBuilder();
            const withInput = await builder.addInput(txData.sender, 0, txData.signature, BigInt(txData.amount));
            const withOutput = await withInput.addOutput(txData.recipient, BigInt(txData.amount), txData.confirmations);
            const transaction = await withOutput.build();
            const success = await this.blockchain.addTransaction(transaction);
            if (!success) {
                throw new Error("Transaction rejected by blockchain");
            }
            return transaction.id;
        }
        catch (error) {
            shared_1.Logger.error("Transaction submission failed:", error);
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
    async getHeight() {
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
    getVersion() {
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
    async getBlock(hash) {
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
    async getFirstTransactionForAddress(address) {
        return this.blockchain.getFirstTransactionForAddress(address);
    }
    async validateTransactionAmount(tx) {
        const transaction = await this.buildTransaction(tx);
        return this.blockchain.validateTransactionAmount(transaction);
    }
    async getConfirmedUtxos(address) {
        return this.blockchain.getConfirmedUtxos(address);
    }
    async buildTransaction(tx) {
        const builder = new core_1.TransactionBuilder();
        const withInput = await builder.addInput(tx.sender, 0, tx.signature, BigInt(tx.amount));
        const withOutput = await withInput.addOutput(tx.recipient, BigInt(tx.amount), tx.confirmations);
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
    async getChainTips() {
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
    async getCurrentDifficulty() {
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
    async getBestBlockHash() {
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
    async getBlockchainInfo() {
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
        }
        catch (error) {
            shared_1.Logger.error("Error getting blockchain info:", error);
            throw error;
        }
    }
    async sendRawTransaction(rawTx) {
        return this.node.broadcastRawTransaction(rawTx);
    }
    getBlockchain() {
        return this.blockchain;
    }
};
exports.BlockchainService = BlockchainService;
exports.BlockchainService = BlockchainService = __decorate([
    (0, common_1.Injectable)()
], BlockchainService);
