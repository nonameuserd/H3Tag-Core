"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wallet_controller_1 = require("../controllers/wallet.controller");
const wallet_service_1 = require("../services/wallet.service");
const router = (0, express_1.Router)();
const walletService = new wallet_service_1.WalletService();
const walletController = new wallet_controller_1.WalletController(walletService);
/**
 * @swagger
 * /api/v1/wallets:
 *   post:
 *     tags: [Wallets]
 *     summary: Create a new wallet
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateWalletDto'
 *     responses:
 *       201:
 *         description: Wallet created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletResponseDto'
 */
router.post('/', walletController.createWallet.bind(walletController));
/**
 * @swagger
 * /api/v1/wallets/{address}:
 *   get:
 *     tags: [Wallets]
 *     summary: Get wallet information
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Wallet information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletResponseDto'
 */
router.get('/:address', walletController.getWallet.bind(walletController));
/**
 * @swagger
 * /api/v1/wallets/{address}/sign:
 *   post:
 *     tags: [Wallets]
 *     summary: Sign a transaction
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignTransactionDto'
 *     responses:
 *       200:
 *         description: Transaction signed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 signature:
 *                   type: string
 */
router.post('/:address/sign', walletController.signTransaction.bind(walletController));
/**
 * @swagger
 * /api/v1/wallets/{address}/balance:
 *   get:
 *     tags: [Wallets]
 *     summary: Get wallet balance
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletBalanceDto'
 */
router.get('/:address/balance', walletController.getBalance.bind(walletController));
/**
 * @swagger
 * /api/v1/wallets/{address}/addresses:
 *   post:
 *     tags: [Wallets]
 *     summary: Generate new address
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: New address generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NewAddressResponseDto'
 */
router.post('/:address/addresses', walletController.getNewAddress.bind(walletController));
/**
 * @swagger
 * /api/v1/wallets/{address}/export:
 *   post:
 *     tags: [Wallets]
 *     summary: Export wallet private key
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExportPrivateKeyDto'
 *     responses:
 *       200:
 *         description: Private key exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 privateKey:
 *                   type: string
 *       400:
 *         description: Invalid password or wallet not found
 */
router.post('/:address/export', walletController.exportPrivateKey.bind(walletController));
/**
 * @swagger
 * /api/v1/wallets/import:
 *   post:
 *     tags: [Wallets]
 *     summary: Import wallet from private key
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ImportPrivateKeyDto'
 *     responses:
 *       201:
 *         description: Wallet imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletResponseDto'
 *       400:
 *         description: Invalid private key or password
 */
router.post('/import', walletController.importPrivateKey.bind(walletController));
/**
 * @swagger
 * /api/v1/wallets/{address}/unspent:
 *   get:
 *     tags: [Wallets]
 *     summary: List unspent transaction outputs (UTXOs)
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet address
 *     responses:
 *       200:
 *         description: UTXOs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UnspentOutputDto'
 *       404:
 *         description: Wallet not found
 */
router.get('/:address/unspent', walletController.listUnspent.bind(walletController));
/**
 * @swagger
 * /api/v1/wallets/txout/{txid}/{n}:
 *   get:
 *     tags: [Wallets]
 *     summary: Get specific transaction output
 *     parameters:
 *       - in: path
 *         name: txid
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *       - in: path
 *         name: n
 *         required: true
 *         schema:
 *           type: number
 *         description: Output index
 *     responses:
 *       200:
 *         description: Transaction output retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TxOutDto'
 *       404:
 *         description: Transaction output not found
 */
router.get('/txout/:txid/:n', walletController.getTxOut.bind(walletController));
exports.default = router;
//# sourceMappingURL=wallet.routes.js.map