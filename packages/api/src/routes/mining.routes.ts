import { Router } from "express";
import { MiningController } from "../controllers/mining.controller";
import { MiningService } from "../services/mining.service";
import { BlockchainService } from "../services/blockchain.service";
import {
  Blockchain,
  BlockchainSchema,
  Node,
  Mempool,
  AuditManager,
  ProofOfWork,
  MerkleTree,
} from "@h3tag-blockchain/core";
import { ConfigService } from "@h3tag-blockchain/shared";

/**
 * @swagger
 * tags:
 *   name: Mining
 *   description: Mining operations and status endpoints
 */
const router = Router();
const blockchain = new Blockchain();
const db = new BlockchainSchema();
const mempool = new Mempool(blockchain);
const configService = new ConfigService();
const auditManager = new AuditManager();
const merkleTree = new MerkleTree();

const node = new Node(blockchain, db, mempool, configService, auditManager);
const pow = new ProofOfWork(blockchain);
const service = new MiningService(
  new BlockchainService(node),
  pow,
  mempool,
  merkleTree,
  auditManager
);
const controller = new MiningController(service);

/**
 * @swagger
 * /api/v1/mining/info:
 *   get:
 *     summary: Get mining information
 *     tags: [Mining]
 *     responses:
 *       200:
 *         description: Mining information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 blocks:
 *                   type: number
 *                   description: Current block height
 *                 difficulty:
 *                   type: number
 *                   description: Current network difficulty
 *                 networkHashrate:
 *                   type: number
 *                   description: Network hashrate in H/s
 *                 reward:
 *                   type: number
 *                   description: Current block reward
 *                 chainWork:
 *                   type: string
 *                   description: Total chain work in hex
 *                 isNetworkMining:
 *                   type: boolean
 *                   description: Whether the network is currently mining
 *       500:
 *         description: Server error
 */
router.get("/info", controller.getMiningInfo.bind(controller));

/**
 * @swagger
 * /api/v1/mining/hashps:
 *   get:
 *     tags: [Mining]
 *     summary: Get network hash per second
 *     description: Retrieves the current network hash rate per second
 *     responses:
 *       200:
 *         description: Network hash rate retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hashPS:
 *                   type: number
 *                   description: Network hash rate per second
 *       500:
 *         description: Server error
 */
router.get("/hashps", controller.getNetworkHashPS.bind(controller));

/**
 * @swagger
 * /mining/template:
 *   post:
 *     summary: Get a block template for mining
 *     tags: [Mining]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - minerAddress
 *             properties:
 *               minerAddress:
 *                 type: string
 *                 description: The address that will receive mining rewards
 *     responses:
 *       200:
 *         description: Block template successfully generated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BlockTemplateResponse'
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too many requests
 *       500:
 *         description: Server error
 */
router.post("/template", controller.getBlockTemplate.bind(controller));

export default router;
