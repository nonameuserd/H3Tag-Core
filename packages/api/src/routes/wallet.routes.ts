import { Router } from 'express';
import { WalletController } from '../controllers/wallet.controller';
import { WalletService } from '../services/wallet.service';

const router = Router();
const walletService = new WalletService();
const walletController = new WalletController(walletService);

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
router.post(
  '/',
  (req, res, next) => {
    walletController.createWallet(req.body)
      .then((result) => res.json(result))
      .catch(next);
  },
);

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
router.get(
  '/:address',
  (req, res, next) => {
    walletController.getWallet(req.params.address)
      .then((result) => res.json(result))
      .catch(next);
  },
);

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
router.post('/:address/sign', (req, res, next) => {
  walletController.signTransaction(req.params.address, req.body)
    .then((result) => res.json(result))
    .catch(next);
});

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
router.get(
  '/:address/balance',
  (req, res, next) => {
    walletController.getBalance(req.params.address)
      .then((result) => res.json(result))
      .catch(next);
  },
);

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
router.post(
  '/:address/addresses',
  (req, res, next) => {
    walletController.getNewAddress(req.params.address)
      .then((result) => res.json(result))
      .catch(next);
  },
);

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
router.post(
  '/:address/export',
  (req, res, next) => {
    walletController.exportPrivateKey(req.params.address, req.body)
      .then((result) => res.json(result))
      .catch(next);
  },
);

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
router.post(
  '/import',
  (req, res, next) => {
    walletController.importPrivateKey(req.body)
      .then((result) => res.json(result))
      .catch(next);
  },
);

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
router.get(
  '/:address/unspent',
  (req, res, next) => {
    walletController.listUnspent(req.params.address)
      .then((result) => res.json(result))
      .catch(next);
  },
);

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
router.get(
  '/txout/:txid/:n',
  (req, res, next) => {
    walletController.getTxOut(req.params.txid, parseInt(req.params.n))
      .then((result) => res.json(result))
      .catch(next);
  },
);

export default router;
