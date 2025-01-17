import { Router } from "express";
import { MempoolController } from "../controllers/mempool.controller";
import { MempoolService } from "../services/mempool.service";
import {
  Node,
  Blockchain,
  BlockchainSchema,
  Mempool,
  AuditManager,
} from "@h3tag-blockchain/core";
import { ConfigService } from "@h3tag-blockchain/shared";

/**
 * @swagger
 * tags:
 *   name: Mempool
 *   description: Mempool information and transaction management
 */
const router = Router();
const blockchain = new Blockchain();
const db = new BlockchainSchema();
const mempool = new Mempool(blockchain);
const configService = new ConfigService();
const auditManager = new AuditManager();

const node = new Node(blockchain, db, mempool, configService, auditManager);
const service = new MempoolService(node);
const controller = new MempoolController(service);

/**
 * @swagger
 * /api/v1/mempool/info:
 *   get:
 *     summary: Get mempool information
 *     tags: [Mempool]
 *     responses:
 *       200:
 *         description: Mempool information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 size:
 *                   type: number
 *                   description: Current number of transactions in mempool
 *                 bytes:
 *                   type: number
 *                   description: Total size in bytes
 *                 usage:
 *                   type: number
 *                   description: Total memory usage
 *                 maxSize:
 *                   type: number
 *                   description: Maximum allowed size
 *                 fees:
 *                   type: object
 *                   properties:
 *                     base:
 *                       type: number
 *                     current:
 *                       type: number
 *                     mean:
 *                       type: number
 *                     median:
 *                       type: number
 *                     min:
 *                       type: number
 *                     max:
 *                       type: number
 *       500:
 *         description: Server error
 */
router.get("/info", controller.getMempoolInfo.bind(controller));

/**
 * @swagger
 * /api/v1/mempool/raw:
 *   get:
 *     summary: Get raw mempool transactions
 *     tags: [Mempool]
 *     parameters:
 *       - in: query
 *         name: verbose
 *         schema:
 *           type: boolean
 *         required: false
 *         description: If true, returns detailed information for each transaction
 *     responses:
 *       200:
 *         description: Raw mempool transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: array
 *                   items:
 *                     type: string
 *                 - type: object
 *                   additionalProperties:
 *                     $ref: '#/components/schemas/RawMempoolEntry'
 *       500:
 *         description: Server error
 */
router.get("/raw", controller.getRawMempool.bind(controller));

/**
 * @swagger
 * /api/v1/mempool/entry/{txid}:
 *   get:
 *     summary: Get specific mempool entry
 *     tags: [Mempool]
 *     parameters:
 *       - in: path
 *         name: txid
 *         schema:
 *           type: string
 *         required: true
 *         description: Transaction ID to lookup
 *     responses:
 *       200:
 *         description: Mempool entry retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MempoolEntryDto'
 *       404:
 *         description: Transaction not found in mempool
 *       500:
 *         description: Server error
 */
router.get("/entry/:txid", controller.getMempoolEntry.bind(controller));

export default router;
