import {
  HybridCrypto,
  HybridKeyPair,
  KeyManager,
} from "@h3tag-blockchain/crypto";
import { Logger } from "@h3tag-blockchain/shared/dist/utils/logger";
import { Keystore, EncryptedKeystore } from "./keystore";
import { EventEmitter } from "events";
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from "../models/transaction.model";
import { BLOCKCHAIN_CONSTANTS } from "../blockchain/utils/constants";
import * as bip39 from "bip39";
import { HDKey } from "@scure/bip32";
import { HashUtils } from "@h3tag-blockchain/crypto";
import { Mutex } from "async-mutex";
import { WalletDatabase } from "../database/wallet-schema";
import { databaseConfig } from "../database/config.database";
import { UTXO, UTXOSet } from "../models/utxo.model";

export class WalletError extends Error {
  constructor(message: string, public readonly code: WalletErrorCode) {
    super(`${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} Wallet Error: ${message}`);
    this.name = "WalletError";
  }
}

export enum WalletErrorCode {
  INITIALIZATION_ERROR = "INITIALIZATION_ERROR",
  TRANSACTION_ERROR = "TRANSACTION_ERROR",
  KEYSTORE_ERROR = "KEYSTORE_ERROR",
  INVALID_STATE = "INVALID_STATE",
  INVALID_PASSWORD = "INVALID_PASSWORD",
  CLEANUP_ERROR = "CLEANUP_ERROR",
  LOCK_ERROR = "LOCK_ERROR",
}

export class Wallet {
  private static readonly DERIVATION_PATH = "m/44'/60'/0'/0/0";

  private readonly keyPair: HybridKeyPair;
  private readonly address: string;
  private isLocked = false;
  private readonly keystore: EncryptedKeystore;
  private lockMutex = new Mutex();
  private readonly eventEmitter = new EventEmitter();

  private readonly state = {
    isInitialized: false,
    lastActivity: Date.now(),
    failedAttempts: 0,
  };

  private readonly utxoSet: UTXOSet;

  private updateState(update: Partial<typeof this.state>): void {
    Object.assign(this.state, update);
  }

  private constructor(keyPair: HybridKeyPair, keystore: EncryptedKeystore) {
    this.keyPair = keyPair;
    this.address = keystore.address;
    this.keystore = keystore;
    this.utxoSet = new UTXOSet();
    // Add cleanup on process exit
    process.on("exit", () => {
      this.secureCleanup();
    });
  }

  private secureCleanup(): void {
    if (this.keyPair) {
      // Clear sensitive data
      this.keyPair.privateKey = null;
      this.keyPair.publicKey = null;
    }
  }

  static async create(password: string): Promise<Wallet> {
    if (!password || password.length < 8) {
      throw new WalletError(
        "Invalid password",
        WalletErrorCode.INVALID_PASSWORD
      );
    }
    try {
      const keyPair = await HybridCrypto.generateKeyPair();
      const address = await KeyManager.deriveAddress(keyPair.publicKey);
      const keystore = await Keystore.encrypt(keyPair, password, address);

      // Save to database
      const walletDb = new WalletDatabase(databaseConfig.databases.wallet.path);
      await walletDb.saveKeystore(address, keystore);

      const wallet = new Wallet(keyPair, keystore);
      wallet.eventEmitter.emit("created", { address });
      return wallet;
    } catch (error) {
      Logger.error("Wallet creation failed:", error);
      throw new WalletError(
        "Failed to create wallet",
        WalletErrorCode.INITIALIZATION_ERROR
      );
    }
  }

  static async load(address: string, password: string): Promise<Wallet> {
    try {
      const walletDb = new WalletDatabase(databaseConfig.databases.wallet.path);
      const keystore = await walletDb.getKeystore(address);

      if (!keystore) {
        throw new WalletError(
          "Wallet not found",
          WalletErrorCode.INITIALIZATION_ERROR
        );
      }

      const keyPair = await Keystore.decrypt(keystore, password);
      const wallet = new Wallet(keyPair, keystore);
      wallet.eventEmitter.emit("loaded", { address });
      return wallet;
    } catch (error) {
      Logger.error("Wallet loading failed:", error);
      throw new WalletError(
        "Failed to load wallet",
        WalletErrorCode.INITIALIZATION_ERROR
      );
    }
  }

  async lock(): Promise<void> {
    await this.lockMutex.acquire();
    try {
      if (this.isLocked) return;
      this.isLocked = true;
      this.eventEmitter.emit("locked", { address: this.address });
    } finally {
      this.lockMutex.release();
    }
  }

  async unlock(password: string): Promise<void> {
    if (!this.isLocked) return;
    try {
      await Keystore.decrypt(this.keystore, password);
      this.isLocked = false;
      this.updateState({
        lastActivity: Date.now(),
        failedAttempts: 0,
      });
      this.eventEmitter.emit("unlocked", { address: this.address });
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.updateState({
          failedAttempts: this.state.failedAttempts + 1,
        });
        throw new WalletError(
          "Failed to unlock wallet",
          WalletErrorCode.KEYSTORE_ERROR
        );
      }
    }
  }

  async signTransaction(
    transaction: Transaction,
    password: string
  ): Promise<string> {
    if (this.isLocked) {
      throw new WalletError("Wallet is locked", WalletErrorCode.INVALID_STATE);
    }

    try {
      // Verify password before signing
      await Keystore.decrypt(this.keystore, password);

      const txString = JSON.stringify(transaction);
      const signature = await HybridCrypto.sign(txString, this.keyPair);
      // Clear sensitive data
      txString.replace(/./g, "0");
      return signature;
    } catch (error) {
      Logger.error("Transaction signing failed:", error);
      throw new WalletError(
        "Failed to sign transaction",
        WalletErrorCode.TRANSACTION_ERROR
      );
    }
  }

  getAddress(): string {
    return this.address;
  }

  isUnlocked(): boolean {
    return !this.isLocked;
  }

  async backup(password: string): Promise<string> {
    if (!password) {
      throw new WalletError(
        "Password is required for backup",
        WalletErrorCode.INVALID_PASSWORD
      );
    }

    try {
      // Verify password before backup
      await Keystore.decrypt(this.keystore, password);
      return await Keystore.backup(this.address);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new WalletError(
          "Failed to backup wallet",
          WalletErrorCode.KEYSTORE_ERROR
        );
      }
    }
  }

  async rotateKeys(password: string): Promise<void> {
    try {
      await Keystore.rotateKey(this.address, password);
      this.eventEmitter.emit("keysRotated", { address: this.address });
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new WalletError(
          "Failed to rotate keys",
          WalletErrorCode.KEYSTORE_ERROR
        );
      }
    }
  }

  static async createWithMnemonic(
    password: string
  ): Promise<{ wallet: Wallet; mnemonic: string }> {
    try {
      // Generate mnemonic
      const mnemonic = bip39.generateMnemonic(256); // 24 words
      const wallet = await this.fromMnemonic(mnemonic, password);

      return { wallet, mnemonic };
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error("Wallet creation with mnemonic failed:", error);
        throw new WalletError(
          "Failed to create wallet with mnemonic",
          WalletErrorCode.INITIALIZATION_ERROR
        );
      }
    }
  }

  static async fromMnemonic(
    mnemonic: string,
    password: string
  ): Promise<Wallet> {
    if (!mnemonic || !password) {
      throw new WalletError(
        "Invalid parameters",
        WalletErrorCode.INITIALIZATION_ERROR
      );
    }
    try {
      // Validate mnemonic
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new WalletError(
          "Invalid mnemonic phrase",
          WalletErrorCode.INITIALIZATION_ERROR
        );
      }

      // Convert mnemonic to seed
      const seed = await bip39.mnemonicToSeed(mnemonic);

      // Generate HD wallet
      const hdKey = HDKey.fromMasterSeed(seed);
      const derived = hdKey.derive(this.DERIVATION_PATH);

      if (!derived.privateKey) {
        throw new WalletError(
          "Failed to derive private key",
          WalletErrorCode.INITIALIZATION_ERROR
        );
      }

      // Convert to HybridKeyPair
      const keyPair = await HybridCrypto.generateKeyPair(
        HashUtils.sha256(derived.privateKey.toString())
      );

      const address = await KeyManager.deriveAddress(keyPair.publicKey);
      const keystore = await Keystore.encrypt(keyPair, password, address);

      const wallet = new Wallet(keyPair, keystore);
      wallet.eventEmitter.emit("created", { address });
      return wallet;
    } catch (error) {
      Logger.error("Wallet creation failed:", error);
      throw new WalletError(
        "Failed to create wallet from mnemonic",
        WalletErrorCode.INITIALIZATION_ERROR
      );
    }
  }

  async verifyMnemonic(mnemonic: string): Promise<boolean> {
    try {
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const hdKey = HDKey.fromMasterSeed(seed);
      const derived = hdKey.derive(Wallet.DERIVATION_PATH);

      if (!derived.privateKey) return false;

      const keyPair = await HybridCrypto.generateKeyPair(
        HashUtils.sha256(derived.privateKey.toString())
      );
      const address = await KeyManager.deriveAddress(keyPair.publicKey);

      return address === this.address;
    } catch (error: unknown) {
      if (error instanceof Error) {
        return false;
      }
    }
  }

  private cleanup(): void {
    this.eventEmitter.removeAllListeners();
    this.secureCleanup();
  }

  async close(): Promise<void> {
    await this.lock();
    this.cleanup();
  }

  generateId(): string {
    return HashUtils.sha256(Date.now().toString());
  }

  async sendToAddress(
    recipientAddress: string,
    amount: string,
    password: string,
    memo?: string
  ): Promise<string> {
    if (this.isLocked) {
      throw new WalletError("Wallet is locked", WalletErrorCode.INVALID_STATE);
    }

    if (!recipientAddress || BigInt(amount) <= 0) {
      throw new WalletError(
        "Invalid recipient address or amount",
        WalletErrorCode.TRANSACTION_ERROR
      );
    }

    try {
      // Create transaction object
      const transaction: Transaction = {
        id: this.generateId(),
        version: BLOCKCHAIN_CONSTANTS.TRANSACTION.CURRENT_VERSION,
        sender: this.address,
        recipient: recipientAddress,
        fee: BigInt(amount),
        timestamp: Date.now(),
        memo: memo || "",
        type: TransactionType.TRANSFER,
        hash: "", // Will be set after signing
        status: TransactionStatus.PENDING,
        signature: "",
        nonce: 0,
        transaction: {
          hash: "",
          timestamp: Date.now(),
          fee: BigInt(amount),
          lockTime: 0,
          signature: "",
        },
        currency: {
          name: BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
          symbol: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
          decimals: BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
        },
        inputs: [],
        outputs: [],
        verify: async () => await this.verify(),
        toHex: () => JSON.stringify(transaction),
        getSize: () => transaction.getSize(),
      };

      // Sign the transaction
      const signature = await this.signTransaction(transaction, password);

      // Emit event for tracking
      this.eventEmitter.emit("transactionSent", {
        txHash: signature,
        from: this.address,
        to: recipientAddress,
        amount: amount,
      });

      return signature;
    } catch (error) {
      Logger.error("Send to address failed:", error);
      throw new WalletError(
        "Failed to send transaction",
        WalletErrorCode.TRANSACTION_ERROR
      );
    }
  }

  async verify(): Promise<boolean> {
    try {
      const address = await KeyManager.deriveAddress(this.keyPair.publicKey);
      return address === this.address;
    } catch (error: unknown ) {
      if (error instanceof Error) {
        return false;
      }
    }
  }

  /**
   * Get the current balance of the wallet
   * @returns Promise<{ confirmed: bigint, unconfirmed: bigint }>
   */
  async getBalance(): Promise<{ confirmed: bigint; unconfirmed: bigint }> {
    if (this.isLocked) {
      throw new WalletError("Wallet is locked", WalletErrorCode.INVALID_STATE);
    }

    try {
      // Initialize balance object
      const balance = {
        confirmed: BigInt(0),
        unconfirmed: BigInt(0),
      };

      // Get wallet database instance
      const walletDb = new WalletDatabase(databaseConfig.databases.wallet.path);

      // Get UTXOs for the address
      const utxos = await walletDb.getUtxos(this.address);

      // Calculate balances
      for (const utxo of utxos) {
        if (utxo.confirmations >= BLOCKCHAIN_CONSTANTS.TRANSACTION.REQUIRED) {
          balance.confirmed += BigInt(utxo.amount);
        } else {
          balance.unconfirmed += BigInt(utxo.amount);
        }
      }

      return balance;
    } catch (error) {
      Logger.error("Failed to get wallet balance:", error);
      throw new WalletError(
        "Failed to get wallet balance",
        WalletErrorCode.TRANSACTION_ERROR
      );
    }
  }

  /**
   * Generate a new address from the wallet's HD key path
   * @returns Promise<string> The newly generated address
   */
  async getNewAddress(): Promise<string> {
    if (this.isLocked) {
      throw new WalletError("Wallet is locked", WalletErrorCode.INVALID_STATE);
    }

    try {
      // Get the next available index from the database
      const walletDb = new WalletDatabase(databaseConfig.databases.wallet.path);
      const currentIndex = await walletDb.getAddressIndex(this.address);
      const nextIndex = currentIndex + 1;

      // Derive new key pair using HD wallet path with next index
      const hdPath = `m/44'/60'/0'/0/${nextIndex}`;
      const seed = await bip39.mnemonicToSeed(this.keystore.mnemonic);
      const hdKey = HDKey.fromMasterSeed(seed);
      const derived = hdKey.derive(hdPath);

      if (!derived.privateKey) {
        throw new WalletError(
          "Failed to derive private key",
          WalletErrorCode.INITIALIZATION_ERROR
        );
      }

      // Generate new key pair and address
      const keyPair = await HybridCrypto.generateKeyPair(
        HashUtils.sha256(derived.privateKey.toString())
      );
      const newAddress = await KeyManager.deriveAddress(keyPair.publicKey);

      // Save the new address and index to database
      await walletDb.saveAddress(this.address, newAddress, nextIndex);

      // Emit event for new address generation
      this.eventEmitter.emit("addressGenerated", {
        masterAddress: this.address,
        newAddress: newAddress,
        index: nextIndex,
      });

      return newAddress;
    } catch (error) {
      Logger.error("Failed to generate new address:", error);
      throw new WalletError(
        "Failed to generate new address",
        WalletErrorCode.INITIALIZATION_ERROR
      );
    }
  }

  /**
   * Export the wallet's private key
   * @param password Current wallet password for verification
   * @returns Promise<string> Encrypted private key
   */
  async exportPrivateKey(password: string): Promise<string> {
    if (this.isLocked) {
      throw new WalletError("Wallet is locked", WalletErrorCode.INVALID_STATE);
    }

    try {
      // Verify password before exporting
      await Keystore.decrypt(this.keystore, password);

      // Encrypt private key before returning
      const encryptedKey = await HybridCrypto.encrypt(
        this.keyPair.privateKey as string,
        this.address
      );

      return encryptedKey;
    } catch (error) {
      Logger.error("Failed to export private key:", error);
      throw new WalletError(
        "Failed to export private key",
        WalletErrorCode.KEYSTORE_ERROR
      );
    }
  }

  /**
   * Import a private key and create a new wallet
   * @param encryptedKey Encrypted private key
   * @param originalAddress Original wallet address
   * @param password Password to decrypt key and create wallet
   * @returns Promise<Wallet> New wallet instance
   */
  static async importPrivateKey(
    encryptedKey: string,
    originalAddress: string,
    password: string
  ): Promise<Wallet> {
    try {
      // Decrypt using the original address
      const privateKey = await HybridCrypto.decrypt(encryptedKey, originalAddress);

      // Generate key pair from private key
      const keyPair = await HybridCrypto.generateKeyPair(privateKey);

      // Then derive address from public key
      const address = await KeyManager.deriveAddress(keyPair.publicKey);

      // Create new keystore
      const keystore = await Keystore.encrypt(keyPair, password, address);

      // Create new wallet instance
      const wallet = new Wallet(keyPair, keystore);

      // Save to database
      const walletDb = new WalletDatabase(databaseConfig.databases.wallet.path);
      await walletDb.saveKeystore(address, keystore);

      wallet.eventEmitter.emit("imported", { address });

      return wallet;
    } catch (error) {
      Logger.error("Failed to import private key:", error);
      throw new WalletError(
        "Failed to import private key",
        WalletErrorCode.INITIALIZATION_ERROR
      );
    }
  }

  getPublicKey(): string {
    return this.keyPair.publicKey as string;
  }

  async listUnspent(): Promise<UTXO[]> {
    if (this.isLocked) {
      throw new WalletError("Wallet is locked", WalletErrorCode.INVALID_STATE);
    }

    try {
      return await this.utxoSet.listUnspent({
        addresses: [this.address],
        minConfirmations: 1,
      });
    } catch (error) {
      Logger.error("Failed to list unspent outputs:", error);
      throw new WalletError(
        "Failed to list unspent outputs",
        WalletErrorCode.TRANSACTION_ERROR
      );
    }
  }
}
