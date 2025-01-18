"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiningService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@h3tag-blockchain/shared");
const core_1 = require("@h3tag-blockchain/core");
/**
 * @swagger
 * tags:
 *   name: Mining
 *   description: Mining operations and status service
 */
let MiningService = class MiningService {
    constructor(blockchainService, pow, mempool, merkleTree, auditManager) {
        this.blockchainService = blockchainService;
        this.pow = pow;
        this.mempool = mempool;
        this.merkleTree = merkleTree;
        this.auditManager = auditManager;
    }
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
    async getMiningInfo() {
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
        }
        catch (error) {
            shared_1.Logger.error("Failed to get mining info:", error);
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
    async getNetworkHashPS() {
        try {
            const blockchain = this.blockchainService.getBlockchain();
            const pow = blockchain.getConsensus().pow;
            return pow.getNetworkHashPS();
        }
        catch (error) {
            shared_1.Logger.error("Failed to get network hash rate:", error);
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
    async getBlockTemplate(minerAddress) {
        const blockchain = this.blockchainService.getBlockchain();
        const pow = blockchain.getConsensus().pow;
        const template = await pow.getBlockTemplate(minerAddress);
        return {
            version: template.version,
            height: template.height,
            previousHash: template.previousHash,
            timestamp: template.timestamp,
            difficulty: template.difficulty,
            transactions: template.transactions.map((tx) => this.mapTransactionToDto(tx)),
            merkleRoot: template.merkleRoot,
            target: template.target,
            minTime: template.minTime,
            maxTime: template.maxTime,
            maxVersion: template.maxVersion,
            minVersion: template.minVersion,
            defaultVersion: template.defaultVersion,
        };
    }
    /**
     * @private
     * @param {Transaction} tx - The transaction to map to a DTO.
     * @returns {TransactionResponseDto} The mapped transaction DTO.
     */
    mapTransactionToDto(tx) {
        return {
            id: tx.id,
            fromAddress: tx.sender,
            toAddress: tx.recipient,
            amount: tx.outputs[0]?.amount.toString() || "0",
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
    async submitBlock(submitBlockDto) {
        const blockBuilder = await new core_1.BlockBuilder(submitBlockDto.header.previousHash, submitBlockDto.header.difficulty, this.auditManager);
        const block = await (await blockBuilder
            .setVersion(submitBlockDto.header.version)
            .setPreviousHash(submitBlockDto.header.previousHash)
            .setMerkleRoot(submitBlockDto.header.merkleRoot)
            .setTimestamp(submitBlockDto.header.timestamp)
            .setDifficulty(submitBlockDto.header.difficulty)
            .setNonce(submitBlockDto.header.nonce)
            .setTransactions(submitBlockDto.transactions)).build(submitBlockDto.minerKeyPair);
        // Submit block to PoW consensus
        const success = await this.pow.submitBlock(block);
        if (!success) {
            throw new Error("Block submission failed");
        }
        return block.hash;
    }
};
exports.MiningService = MiningService;
exports.MiningService = MiningService = __decorate([
    (0, common_1.Injectable)()
], MiningService);
