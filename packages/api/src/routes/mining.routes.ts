import { Router } from 'express';
import { MiningController } from '../controllers/mining.controller';
import { MiningService } from '../services/mining.service';
import { BlockchainService } from '../services/blockchain.service';
import {
  Blockchain,
  BlockchainSchema,
  Node,
  Mempool,
  AuditManager,
  ProofOfWork,
  MerkleTree,
} from '@h3tag-blockchain/core';
import { ConfigService } from '@h3tag-blockchain/shared';

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
  auditManager,
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
 *               $ref: '#/components/schemas/MiningInfoDto'
 *       500:
 *         description: Server error
 */
router.get('/info', (req, res, next) => {
  controller.getMiningInfo()
    .then((result) => res.json(result))
    .catch(next);
});

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
router.get('/hashps', (req, res, next) => {
  controller.getNetworkHashPS()
    .then((result) => res.json(result))
    .catch(next);
});

/**
 * @swagger
 * /api/v1/mining/template:
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
router.post('/template', (req, res, next) => {
  controller.getBlockTemplate(req.body)
    .then((result) => res.json(result))
    .catch(next);
});

/**
 * @swagger
 * /api/v1/mining/submit-block:
 *   post:
 *     summary: Submit a mined block
 *     tags: [Mining]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitBlockDto'
 *     responses:
 *       201:
 *         description: Block submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 blockHash:
 *                   type: string
 *       400:
 *         description: Invalid block data
 *       500:
 *         description: Server error
 */
router.post('/submit-block', (req, res, next) => {
  controller.submitBlock(req.body)
    .then((result) => res.json(result))
    .catch(next);
});

export default router;
