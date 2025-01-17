import { Router } from "express";
import { BlockchainController } from "../controllers/blockchain.controller";
import { BlockchainService } from "../services/blockchain.service";
import {
  AuditManager,
  Blockchain,
  Mempool,
  Node,
  BlockchainSchema,
} from "@h3tag-blockchain/core";
import { ConfigService } from "@h3tag-blockchain/shared";

/**
 * @swagger
 * tags:
 *   name: Blockchain
 *   description: Blockchain management endpoints
 */

const router = Router();
const blockchain = new Blockchain();
const db = new BlockchainSchema();
const mempool = new Mempool(blockchain);
const configService = new ConfigService();
const auditManager = new AuditManager();

const node = new Node(blockchain, db, mempool, configService, auditManager);
const blockchainService = new BlockchainService(node);
const blockchainController = new BlockchainController(blockchainService);

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
router.get("/stats", blockchainController.getStats);

/**
 * @swagger
 * /blockchain/blocks/{hash}:
 *   get:
 *     summary: Get block by hash
 *     tags: [Blockchain]
 *     parameters:
 *       - in: path
 *         name: hash
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Block retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BlockResponseDto'
 */
router.get("/blocks/:hash", blockchainController.getBlock);

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
 */
router.post("/transactions", blockchainController.submitTransaction);

/**
 * @swagger
 * /blockchain/transactions/validate:
 *   post:
 *     summary: Validate a transaction
 *     tags: [Blockchain]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransactionValidationRequestDto'
 *     responses:
 *       200:
 *         description: Transaction validation result
 */
router.post("/transactions/validate", blockchainController.validateTransaction);

/**
 * @swagger
 * /blockchain/transactions/{address}/first:
 *   get:
 *     summary: Get first transaction for address
 *     tags: [Blockchain]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: First transaction found
 */
router.get(
  "/transactions/:address/first",
  blockchainController.getFirstTransaction
);

/**
 * @swagger
 * /blockchain/transactions/{address}/utxos:
 *   get:
 *     summary: Get UTXOs for address
 *     tags: [Blockchain]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: UTXOs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UtxoDto'
 */
router.get("/transactions/:address/utxos", blockchainController.getUtxos);

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
router.get("/height", blockchainController.getHeight);

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
router.get("/version", blockchainController.getVersion);

/**
 * @swagger
 * /blockchain/node:
 *   get:
 *     summary: Get node information
 *     tags: [Blockchain]
 *     responses:
 *       200:
 *         description: Node information retrieved successfully
 */
router.get("/node", blockchainController.getNode);

/**
 * @swagger
 * /blockchain/currency:
 *   get:
 *     summary: Get currency details
 *     tags: [Blockchain]
 *     responses:
 *       200:
 *         description: Currency details retrieved successfully
 */
router.get("/currency", blockchainController.getCurrencyDetails);

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
router.get("/chain-tips", blockchainController.getChainTips);

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
 *               $ref: '#/components/schemas/DifficultyResponseDto'
 */
router.get("/difficulty", blockchainController.getCurrentDifficulty);

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
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.get("/best-block-hash", blockchainController.getBestBlockHash);

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
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.get("/info", blockchainController.getBlockchainInfo);

export default router;
