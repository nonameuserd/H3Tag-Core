"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@h3tag-blockchain/core");
const core_2 = require("@h3tag-blockchain/core");
const core_3 = require("@h3tag-blockchain/core");
/**
 * @swagger
 * tags:
 *   name: Wallets
 *   description: Wallet management endpoints
 */
let WalletService = class WalletService {
    constructor() {
        this.wallets = new Map();
        this.utxoSet = new core_2.UTXOSet();
    }
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
    async createWallet(createWalletDto) {
        if (createWalletDto.mnemonic) {
            const wallet = await core_1.Wallet.fromMnemonic(createWalletDto.mnemonic, createWalletDto.password);
            this.wallets.set(wallet.getAddress(), wallet);
            return {
                address: wallet.getAddress(),
                publicKey: wallet.getPublicKey(),
            };
        }
        const { wallet, mnemonic } = await core_1.Wallet.createWithMnemonic(createWalletDto.password);
        this.wallets.set(wallet.getAddress(), wallet);
        return {
            address: wallet.getAddress(),
            publicKey: wallet.getPublicKey(),
            mnemonic,
        };
    }
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
    async getWallet(address) {
        const wallet = this.wallets.get(address);
        if (!wallet) {
            throw new Error("Wallet not found");
        }
        return {
            address: wallet.getAddress(),
            publicKey: wallet.getPublicKey(),
        };
    }
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
    async signTransaction(address, transaction, password) {
        const wallet = this.wallets.get(address);
        if (!wallet) {
            throw new Error("Wallet not found");
        }
        return wallet.signTransaction(transaction, password);
    }
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
    async sendToAddress(fromAddress, toAddress, amount, password) {
        const wallet = this.wallets.get(fromAddress);
        if (!wallet) {
            throw new Error("Wallet not found");
        }
        try {
            const txId = await wallet.sendToAddress(toAddress, amount, password);
            return txId;
        }
        catch (error) {
            throw new Error(`Failed to send transaction: ${error.message}`);
        }
    }
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
    async getBalance(address) {
        const wallet = this.wallets.get(address);
        if (!wallet) {
            throw new Error("Wallet not found");
        }
        return wallet.getBalance();
    }
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
    async getNewAddress(address) {
        const wallet = this.wallets.get(address);
        if (!wallet) {
            throw new Error("Wallet not found");
        }
        return wallet.getNewAddress();
    }
    async exportPrivateKey(address, password) {
        try {
            const wallet = await core_1.Wallet.load(address, password);
            return wallet.exportPrivateKey(password);
        }
        catch (error) {
            common_1.Logger.error("Failed to export private key:", error);
            throw new Error(`Failed to export private key: ${error.message}`);
        }
    }
    async importPrivateKey(importDto) {
        try {
            const wallet = await core_1.Wallet.importPrivateKey(importDto.encryptedKey, importDto.originalAddress, importDto.password);
            return {
                address: wallet.getAddress(),
                publicKey: wallet.getPublicKey(),
                balance: "0", // Initial balance
                isLocked: wallet.isUnlocked(),
            };
        }
        catch (error) {
            common_1.Logger.error("Failed to import private key:", error);
            throw new Error(`Failed to import private key: ${error.message}`);
        }
    }
    async listUnspent(address) {
        const wallet = this.wallets.get(address);
        if (!wallet) {
            throw new Error("Wallet not found");
        }
        try {
            const utxos = await wallet.listUnspent();
            return utxos.map((utxo) => ({
                txid: utxo.txId,
                vout: utxo.outputIndex,
                address: utxo.address,
                amount: utxo.amount.toString(),
                confirmations: utxo.confirmations,
                spendable: !utxo.spent,
            }));
        }
        catch (error) {
            common_1.Logger.error("Failed to list unspent outputs:", error);
            throw error;
        }
    }
    async getTxOut(txid, n) {
        const txOut = await this.utxoSet.getTxOut(txid, n, true);
        if (!txOut) {
            throw new Error("Transaction output not found");
        }
        return {
            txid,
            n,
            value: txOut.amount.toString(),
            confirmations: txOut.confirmations,
            scriptType: txOut.scriptPubKey.type,
            address: txOut.scriptPubKey.address,
            spendable: !txOut.coinbase ||
                txOut.confirmations >= core_3.BLOCKCHAIN_CONSTANTS.COINBASE_MATURITY,
        };
    }
};
exports.WalletService = WalletService;
exports.WalletService = WalletService = __decorate([
    (0, common_1.Injectable)()
], WalletService);
//# sourceMappingURL=wallet.service.js.map