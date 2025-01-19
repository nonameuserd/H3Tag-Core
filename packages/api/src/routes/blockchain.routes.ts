import { Router } from 'express';
import { BlockchainController } from '../controllers/blockchain.controller';
import { BlockchainService } from '../services/blockchain.service';
import {
  AuditManager,
  Blockchain,
  Mempool,
  Node,
  BlockchainSchema,
} from '@h3tag-blockchain/core';
import { ConfigService } from '@h3tag-blockchain/shared';

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
router.get('/stats', (req, res, next) => {
  blockchainController.getStats()
    .then(result => res.json(result))
    .catch(next);
});


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
router.get('/blocks/:hash', (req, res, next) => {
  blockchainController.getBlock(req.params.hash)
    .then(result => res.json(result))
    .catch(next);
});

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
router.post('/transactions', (req, res, next) => {
  blockchainController.submitTransaction(req.body)
    .then(result => res.json(result))
    .catch(next);
});

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
router.post('/transactions/validate', (req, res, next) => {
  blockchainController.validateTransaction(req.body)
    .then(result => res.json(result))
    .catch(next);
});

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
  '/transactions/:address/first',
  (req, res, next) => {
    blockchainController.getFirstTransaction(req.params.address)
      .then(result => res.json(result))
      .catch(next);
  },
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
router.get('/transactions/:address/utxos', (req, res, next) => {
  blockchainController.getUtxos(req.params.address)
    .then(result => res.json(result))
    .catch(next);
});

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
router.get('/height', (req, res, next) => {
  blockchainController.getHeight()
    .then(result => res.json(result))
    .catch(next);
});

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
router.get('/version', (req, res, next) => {
  blockchainController.getVersion()
    .then(result => res.json(result))
    .catch(next);
});

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
router.get('/node', (req, res, next) => {
  blockchainController.getNode()
    .then(result => res.json(result))
    .catch(next);
});

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
router.get('/currency', (req, res, next) => {
  blockchainController.getCurrencyDetails()
    .then(result => res.json(result))
    .catch(next);
});

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
router.get('/chain-tips', (req, res, next) => {
  blockchainController.getChainTips()
    .then(result => res.json(result))
    .catch(next);
});

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
router.get('/difficulty', (req, res, next) => {
  blockchainController.getCurrentDifficulty()
    .then(result => res.json(result))
    .catch(next);
});

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
router.get('/best-block-hash', (req, res, next) => {
  blockchainController.getBestBlockHash()
    .then(result => res.json(result))
    .catch(next);
});

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
router.get('/info', (req, res, next) => {
  blockchainController.getBlockchainInfo()
    .then(result => res.json(result))
    .catch(next);
});

export default router;
