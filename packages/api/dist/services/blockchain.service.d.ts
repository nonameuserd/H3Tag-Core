import { Blockchain } from "@h3tag-blockchain/core";
import { BlockchainStatsDto, TransactionSubmitDto, ChainTipDto, BlockchainInfoDto } from "../dtos/blockchain.dto";
import { Node } from "@h3tag-blockchain/core";
/**
 * @swagger
 * tags:
 *   name: Blockchain
 *   description: Blockchain management and query endpoints
 */
export declare class BlockchainService {
    private readonly node;
    private readonly stats;
    private blockchain;
    constructor(node: Node);
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
    getStats(): Promise<BlockchainStatsDto>;
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
    submitTransaction(txData: TransactionSubmitDto): Promise<string>;
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
    getHeight(): Promise<number>;
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
    getVersion(): number;
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
    getBlock(hash: string): Promise<{
        hash: any;
        height: any;
        previousHash: any;
        timestamp: any;
        transactions: any;
        merkleRoot: any;
    }>;
    getCurrencyDetails(): Promise<any>;
    getFirstTransactionForAddress(address: string): Promise<any>;
    validateTransactionAmount(tx: TransactionSubmitDto): Promise<boolean>;
    getConfirmedUtxos(address: string): Promise<any>;
    private buildTransaction;
    getNode(): Promise<any>;
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
    getChainTips(): Promise<ChainTipDto[]>;
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
    getCurrentDifficulty(): Promise<number>;
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
    getBestBlockHash(): Promise<string>;
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
    getBlockchainInfo(): Promise<BlockchainInfoDto>;
    sendRawTransaction(rawTx: string): Promise<string>;
    getBlockchain(): Blockchain;
}
