"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mining_controller_1 = require("../controllers/mining.controller");
const mining_service_1 = require("../services/mining.service");
const blockchain_service_1 = require("../services/blockchain.service");
const core_1 = require("@h3tag-blockchain/core");
const shared_1 = require("@h3tag-blockchain/shared");
/**
 * @swagger
 * tags:
 *   name: Mining
 *   description: Mining operations and status endpoints
 */
const router = (0, express_1.Router)();
const blockchain = new core_1.Blockchain();
const db = new core_1.BlockchainSchema();
const mempool = new core_1.Mempool(blockchain);
const configService = new shared_1.ConfigService();
const auditManager = new core_1.AuditManager();
const merkleTree = new core_1.MerkleTree();
const node = new core_1.Node(blockchain, db, mempool, configService, auditManager);
const pow = new core_1.ProofOfWork(blockchain);
const service = new mining_service_1.MiningService(new blockchain_service_1.BlockchainService(node), pow, mempool, merkleTree, auditManager);
const controller = new mining_controller_1.MiningController(service);
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
exports.default = router;
//# sourceMappingURL=mining.routes.js.map