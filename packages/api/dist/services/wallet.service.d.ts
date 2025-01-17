import { CreateWalletDto, WalletResponseDto, ImportPrivateKeyDto, TxOutDto } from "../dtos/wallet.dto";
import { Transaction } from "@h3tag-blockchain/core";
import { UnspentOutputDto } from "../dtos/wallet.dto";
/**
 * @swagger
 * tags:
 *   name: Wallets
 *   description: Wallet management endpoints
 */
export declare class WalletService {
    private wallets;
    private utxoSet;
    constructor();
    /**
     * @swagger
     * /wallets:
     *   post:
     *     summary: Create a new wallet
     *     tags: [Wallets]
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
    createWallet(createWalletDto: CreateWalletDto): Promise<WalletResponseDto>;
    /**
     * @swagger
     * /wallets/{address}:
     *   get:
     *     summary: Get wallet information
     *     tags: [Wallets]
     *     parameters:
     *       - in: path
     *         name: address
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Wallet information retrieved
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/WalletResponseDto'
     */
    getWallet(address: string): Promise<WalletResponseDto>;
    /**
     * @swagger
     * /wallets/{address}/sign:
     *   post:
     *     summary: Sign a transaction
     *     tags: [Wallets]
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
     *             type: object
     *             properties:
     *               transaction:
     *                 $ref: '#/components/schemas/Transaction'
     *               password:
     *                 type: string
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
    signTransaction(address: string, transaction: Transaction, password: string): Promise<string>;
    /**
     * @swagger
     * /wallets/{address}/send:
     *   post:
     *     summary: Send tokens to another address
     *     tags: [Wallets]
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
     *             type: object
     *             properties:
     *               toAddress:
     *                 type: string
     *               amount:
     *                 type: string
     *               password:
     *                 type: string
     *     responses:
     *       200:
     *         description: Transaction sent successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 txId:
     *                   type: string
     *       400:
     *         description: Invalid parameters or transaction failed
     */
    sendToAddress(fromAddress: string, toAddress: string, amount: string, password: string): Promise<string>;
    /**
     * @swagger
     * /wallets/{address}/balance:
     *   get:
     *     summary: Get wallet balance
     *     tags: [Wallets]
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
     *               type: object
     *               properties:
     *                 confirmed:
     *                   type: string
     *                 unconfirmed:
     *                   type: string
     *       404:
     *         description: Wallet not found
     */
    getBalance(address: string): Promise<{
        confirmed: bigint;
        unconfirmed: bigint;
    }>;
    /**
     * @swagger
     * /wallets/{address}/new-address:
     *   post:
     *     summary: Generate new address for wallet
     *     tags: [Wallets]
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
     *               type: object
     *               properties:
     *                 address:
     *                   type: string
     *       404:
     *         description: Wallet not found
     */
    getNewAddress(address: string): Promise<string>;
    exportPrivateKey(address: string, password: string): Promise<string>;
    importPrivateKey(importDto: ImportPrivateKeyDto): Promise<WalletResponseDto>;
    listUnspent(address: string): Promise<UnspentOutputDto[]>;
    getTxOut(txid: string, n: number): Promise<TxOutDto>;
}
