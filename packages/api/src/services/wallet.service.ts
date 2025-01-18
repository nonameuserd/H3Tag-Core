import { Injectable, Logger } from "@nestjs/common";
import { Wallet } from "@h3tag-blockchain/core";
import {
  CreateWalletDto,
  WalletResponseDto,
  ImportPrivateKeyDto,
  TxOutDto,
} from "../dtos/wallet.dto";
import { Transaction } from "@h3tag-blockchain/core";
import { UnspentOutputDto } from "../dtos/wallet.dto";
import { UTXOSet } from "@h3tag-blockchain/core";
import { BLOCKCHAIN_CONSTANTS } from "@h3tag-blockchain/core";

/**
 * @swagger
 * tags:
 *   name: Wallets
 *   description: Wallet management endpoints
 */
@Injectable()
export class WalletService {
  private wallets: Map<string, Wallet> = new Map();
  private utxoSet: UTXOSet;

  constructor() {
    this.utxoSet = new UTXOSet();
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
  async createWallet(
    createWalletDto: CreateWalletDto
  ): Promise<WalletResponseDto> {
    if (createWalletDto.mnemonic) {
      const wallet = await Wallet.fromMnemonic(
        createWalletDto.mnemonic,
        createWalletDto.password
      );
      this.wallets.set(wallet.getAddress(), wallet);
      return {
        address: wallet.getAddress(),
        publicKey: wallet.getPublicKey(),
      };
    }

    const { wallet, mnemonic } = await Wallet.createWithMnemonic(
      createWalletDto.password
    );
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
  async getWallet(address: string): Promise<WalletResponseDto> {
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
  async signTransaction(
    address: string,
    transaction: Transaction,
    password: string
  ): Promise<string> {
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
  async sendToAddress(
    fromAddress: string,
    toAddress: string,
    amount: string,
    password: string
  ): Promise<string> {
    const wallet = this.wallets.get(fromAddress);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    try {
      const txId = await wallet.sendToAddress(toAddress, amount, password);
      return txId;
    } catch (error) {
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
  async getBalance(
    address: string
  ): Promise<{ confirmed: bigint; unconfirmed: bigint }> {
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
  async getNewAddress(address: string): Promise<string> {
    const wallet = this.wallets.get(address);
    if (!wallet) {
      throw new Error("Wallet not found");
    }
    return wallet.getNewAddress();
  }

  async exportPrivateKey(address: string, password: string): Promise<string> {
    try {
      const wallet = await Wallet.load(address, password);
      return wallet.exportPrivateKey(password);
    } catch (error) {
      Logger.error("Failed to export private key:", error);
      throw new Error(`Failed to export private key: ${error.message}`);
    }
  }

  async importPrivateKey(
    importDto: ImportPrivateKeyDto
  ): Promise<WalletResponseDto> {
    try {
      const wallet = await Wallet.importPrivateKey(
        importDto.encryptedKey,
        importDto.originalAddress,
        importDto.password
      );

      return {
        address: wallet.getAddress(),
        publicKey: wallet.getPublicKey(),
        balance: "0", // Initial balance
        isLocked: wallet.isUnlocked(),
      };
    } catch (error) {
      Logger.error("Failed to import private key:", error);
      throw new Error(`Failed to import private key: ${error.message}`);
    }
  }

  async listUnspent(address: string): Promise<UnspentOutputDto[]> {
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
    } catch (error) {
      Logger.error("Failed to list unspent outputs:", error);
      throw error;
    }
  }

  async getTxOut(txid: string, n: number): Promise<TxOutDto> {
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
      spendable:
        !txOut.coinbase ||
        txOut.confirmations >= BLOCKCHAIN_CONSTANTS.COINBASE_MATURITY,
    };
  }
}
