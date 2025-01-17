import { Router } from "express";
import { TransactionController } from "../controllers/transaction.controller";
import { BlockchainService } from "../services/blockchain.service";
import { TransactionService } from "../services/transaction.service";
import {
  TransactionBuilder,
  Blockchain,
  BlockchainSchema,
  Mempool,
  AuditManager,
  Node,
} from "@h3tag-blockchain/core";
import { ConfigService } from "@h3tag-blockchain/shared";

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Transaction endpoints
 */
const router = Router();
const blockchain = new Blockchain();
const db = new BlockchainSchema();
const mempool = new Mempool(blockchain);
const configService = new ConfigService();
const auditManager = new AuditManager();

const node = new Node(blockchain, db, mempool, configService, auditManager);

const controller = new TransactionController(
  new TransactionService(new BlockchainService(node), new TransactionBuilder())
);

/**
 * @swagger
 * /api/v1/transactions/{txId}:
 *   get:
 *     tags: [Transactions]
 *     summary: Get transaction by ID
 *     parameters:
 *       - in: path
 *         name: txId
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: Transaction details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransactionResponseDto'
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Server error
 */
router.get("/:txId", controller.getTransaction);

/**
 * @swagger
 * /api/v1/transactions/decode:
 *   post:
 *     tags: [Transactions]
 *     summary: Decode raw transaction
 *     description: Decodes a raw transaction hex string without broadcasting it
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DecodeRawTransactionDto'
 *     responses:
 *       200:
 *         description: Decoded transaction data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DecodedTransactionDto'
 *       400:
 *         description: Invalid transaction format
 *       500:
 *         description: Server error
 */
router.post("/decode", controller.decodeRawTransaction);

/**
 * @swagger
 * /api/v1/transactions/raw:
 *   post:
 *     tags: [Transactions]
 *     summary: Send raw transaction
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rawTransaction:
 *                 type: string
 *                 description: Raw transaction hex string
 *     responses:
 *       201:
 *         description: Transaction sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 txId:
 *                   type: string
 *       400:
 *         description: Invalid transaction
 *       500:
 *         description: Server error
 */
router.post("/raw", controller.sendRawTransaction);

/**
 * @swagger
 * /api/v1/transactions/{txId}/raw:
 *   get:
 *     tags: [Transactions]
 *     summary: Get raw transaction data
 *     description: Retrieves the raw transaction data in hex format
 *     parameters:
 *       - in: path
 *         name: txId
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: Raw transaction data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hex:
 *                   type: string
 *                   description: Raw transaction hex string
 *                 txid:
 *                   type: string
 *                   description: Transaction ID
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Server error
 */
router.get("/:txId/raw", controller.getRawTransaction);

/**
 * @swagger
 * /api/v1/transactions/estimate-fee:
 *   post:
 *     tags: [Transactions]
 *     summary: Estimate transaction fee
 *     description: Estimates the fee required for a transaction to be confirmed within target blocks
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetBlocks:
 *                 type: number
 *                 description: Number of blocks within which the transaction should be included
 *                 minimum: 1
 *                 maximum: 1008
 *                 default: 6
 *     responses:
 *       200:
 *         description: Fee estimation successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EstimateFeeResponseDto'
 *       400:
 *         description: Invalid target blocks range
 *       500:
 *         description: Server error
 */
router.post("/estimate-fee", controller.estimateFee);

/**
 * @swagger
 * /api/v1/transactions/sign-message:
 *   post:
 *     tags: [Transactions]
 *     summary: Sign a message using hybrid cryptography
 *     description: Signs a message using both classical and quantum-resistant algorithms
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *               - privateKey
 *             properties:
 *               message:
 *                 type: string
 *                 description: Message to sign
 *               privateKey:
 *                 type: string
 *                 description: Private key in hex format (64 characters)
 *                 pattern: ^[a-f0-9]{64}$
 *     responses:
 *       200:
 *         description: Message signed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 signature:
 *                   type: string
 *                   description: Combined signature hash
 *       400:
 *         description: Invalid message or private key format
 *       500:
 *         description: Server error
 */
router.post("/sign-message", controller.signMessage);

/**
 * @swagger
 * /api/v1/transactions/verify-message:
 *   post:
 *     tags: [Transactions]
 *     summary: Verify a signed message
 *     description: Verifies a message signature using hybrid cryptography
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *               - signature
 *               - publicKey
 *             properties:
 *               message:
 *                 type: string
 *                 description: Original message that was signed
 *               signature:
 *                 type: string
 *                 description: Signature to verify (128 hex characters)
 *                 pattern: ^[a-f0-9]{128}$
 *               publicKey:
 *                 type: string
 *                 description: Public key in hex format (130 characters)
 *                 pattern: ^[a-f0-9]{130}$
 *     responses:
 *       200:
 *         description: Message verification result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isValid:
 *                   type: boolean
 *                   description: Whether the signature is valid
 *       400:
 *         description: Invalid message, signature, or public key format
 *       500:
 *         description: Server error
 */
router.post("/verify-message", controller.verifyMessage);

/**
 * @swagger
 * /api/v1/transactions/validate-address:
 *   post:
 *     tags: [Transactions]
 *     summary: Validate a blockchain address
 *     description: Validates the format and checksum of a blockchain address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - address
 *             properties:
 *               address:
 *                 type: string
 *                 description: Blockchain address to validate
 *                 minLength: 25
 *                 maxLength: 34
 *     responses:
 *       200:
 *         description: Address validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isValid:
 *                   type: boolean
 *                   description: Whether the address is valid
 *                 network:
 *                   type: string
 *                   enum: [mainnet, testnet, devnet]
 *                   description: Network type of the address
 *       400:
 *         description: Invalid address format
 *       500:
 *         description: Server error
 */
router.post("/validate-address", controller.validateAddress);

export default router;
