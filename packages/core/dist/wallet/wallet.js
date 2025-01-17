"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wallet = exports.WalletErrorCode = exports.WalletError = void 0;
const crypto_1 = require("@h3tag-blockchain/crypto");
const logger_1 = require("@h3tag-blockchain/shared/dist/utils/logger");
const keystore_1 = require("./keystore");
const events_1 = require("events");
const transaction_model_1 = require("../models/transaction.model");
const constants_1 = require("../blockchain/utils/constants");
const bip39 = __importStar(require("bip39"));
const bip32_1 = require("@scure/bip32");
const crypto_2 = require("@h3tag-blockchain/crypto");
const async_mutex_1 = require("async-mutex");
const wallet_schema_1 = require("../database/wallet-schema");
const config_database_1 = require("../database/config.database");
const utxo_model_1 = require("../models/utxo.model");
class WalletError extends Error {
    constructor(message, code) {
        super(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} Wallet Error: ${message}`);
        this.code = code;
        this.name = "WalletError";
    }
}
exports.WalletError = WalletError;
var WalletErrorCode;
(function (WalletErrorCode) {
    WalletErrorCode["INITIALIZATION_ERROR"] = "INITIALIZATION_ERROR";
    WalletErrorCode["TRANSACTION_ERROR"] = "TRANSACTION_ERROR";
    WalletErrorCode["KEYSTORE_ERROR"] = "KEYSTORE_ERROR";
    WalletErrorCode["INVALID_STATE"] = "INVALID_STATE";
    WalletErrorCode["INVALID_PASSWORD"] = "INVALID_PASSWORD";
    WalletErrorCode["CLEANUP_ERROR"] = "CLEANUP_ERROR";
    WalletErrorCode["LOCK_ERROR"] = "LOCK_ERROR";
})(WalletErrorCode = exports.WalletErrorCode || (exports.WalletErrorCode = {}));
class Wallet {
    updateState(update) {
        Object.assign(this.state, update);
    }
    constructor(keyPair, keystore) {
        this.isLocked = false;
        this.lockMutex = new async_mutex_1.Mutex();
        this.eventEmitter = new events_1.EventEmitter();
        this.state = {
            isInitialized: false,
            lastActivity: Date.now(),
            failedAttempts: 0,
        };
        this.keyPair = keyPair;
        this.address = keystore.address;
        this.keystore = keystore;
        this.utxoSet = new utxo_model_1.UTXOSet();
        // Add cleanup on process exit
        process.on("exit", () => {
            this.secureCleanup();
        });
    }
    secureCleanup() {
        if (this.keyPair) {
            // Clear sensitive data
            this.keyPair.privateKey = null;
            this.keyPair.publicKey = null;
        }
    }
    static async create(password) {
        if (!password || password.length < 8) {
            throw new WalletError("Invalid password", WalletErrorCode.INVALID_PASSWORD);
        }
        try {
            const keyPair = await crypto_1.HybridCrypto.generateKeyPair();
            const address = await crypto_1.KeyManager.deriveAddress(keyPair.publicKey);
            const keystore = await keystore_1.Keystore.encrypt(keyPair, password, address);
            // Save to database
            const walletDb = new wallet_schema_1.WalletDatabase(config_database_1.databaseConfig.databases.wallet.path);
            await walletDb.saveKeystore(address, keystore);
            const wallet = new Wallet(keyPair, keystore);
            wallet.eventEmitter.emit("created", { address });
            return wallet;
        }
        catch (error) {
            logger_1.Logger.error("Wallet creation failed:", error);
            throw new WalletError("Failed to create wallet", WalletErrorCode.INITIALIZATION_ERROR);
        }
    }
    static async load(address, password) {
        try {
            const walletDb = new wallet_schema_1.WalletDatabase(config_database_1.databaseConfig.databases.wallet.path);
            const keystore = await walletDb.getKeystore(address);
            if (!keystore) {
                throw new WalletError("Wallet not found", WalletErrorCode.INITIALIZATION_ERROR);
            }
            const keyPair = await keystore_1.Keystore.decrypt(keystore, password);
            const wallet = new Wallet(keyPair, keystore);
            wallet.eventEmitter.emit("loaded", { address });
            return wallet;
        }
        catch (error) {
            logger_1.Logger.error("Wallet loading failed:", error);
            throw new WalletError("Failed to load wallet", WalletErrorCode.INITIALIZATION_ERROR);
        }
    }
    async lock() {
        await this.lockMutex.acquire();
        try {
            if (this.isLocked)
                return;
            this.isLocked = true;
            this.eventEmitter.emit("locked", { address: this.address });
        }
        finally {
            this.lockMutex.release();
        }
    }
    async unlock(password) {
        if (!this.isLocked)
            return;
        try {
            await keystore_1.Keystore.decrypt(this.keystore, password);
            this.isLocked = false;
            this.updateState({
                lastActivity: Date.now(),
                failedAttempts: 0,
            });
            this.eventEmitter.emit("unlocked", { address: this.address });
        }
        catch (error) {
            this.updateState({
                failedAttempts: this.state.failedAttempts + 1,
            });
            throw new WalletError("Failed to unlock wallet", WalletErrorCode.KEYSTORE_ERROR);
        }
    }
    async signTransaction(transaction, password) {
        if (this.isLocked) {
            throw new WalletError("Wallet is locked", WalletErrorCode.INVALID_STATE);
        }
        try {
            // Verify password before signing
            await keystore_1.Keystore.decrypt(this.keystore, password);
            const txString = JSON.stringify(transaction);
            const signature = await crypto_1.HybridCrypto.sign(txString, this.keyPair);
            // Clear sensitive data
            txString.replace(/./g, "0");
            return signature;
        }
        catch (error) {
            logger_1.Logger.error("Transaction signing failed:", error);
            throw new WalletError("Failed to sign transaction", WalletErrorCode.TRANSACTION_ERROR);
        }
    }
    getAddress() {
        return this.address;
    }
    isUnlocked() {
        return !this.isLocked;
    }
    async backup(password) {
        try {
            return await keystore_1.Keystore.backup(this.address);
        }
        catch (error) {
            throw new WalletError("Failed to backup wallet", WalletErrorCode.KEYSTORE_ERROR);
        }
    }
    async rotateKeys(password) {
        try {
            await keystore_1.Keystore.rotateKey(this.address, password);
            this.eventEmitter.emit("keysRotated", { address: this.address });
        }
        catch (error) {
            throw new WalletError("Failed to rotate keys", WalletErrorCode.KEYSTORE_ERROR);
        }
    }
    static async createWithMnemonic(password) {
        try {
            // Generate mnemonic
            const mnemonic = bip39.generateMnemonic(256); // 24 words
            const wallet = await this.fromMnemonic(mnemonic, password);
            return { wallet, mnemonic };
        }
        catch (error) {
            logger_1.Logger.error("Wallet creation with mnemonic failed:", error);
            throw new WalletError("Failed to create wallet with mnemonic", WalletErrorCode.INITIALIZATION_ERROR);
        }
    }
    static async fromMnemonic(mnemonic, password) {
        if (!mnemonic || !password) {
            throw new WalletError("Invalid parameters", WalletErrorCode.INITIALIZATION_ERROR);
        }
        try {
            // Validate mnemonic
            if (!bip39.validateMnemonic(mnemonic)) {
                throw new WalletError("Invalid mnemonic phrase", WalletErrorCode.INITIALIZATION_ERROR);
            }
            // Convert mnemonic to seed
            const seed = await bip39.mnemonicToSeed(mnemonic);
            // Generate HD wallet
            const hdKey = bip32_1.HDKey.fromMasterSeed(seed);
            const derived = hdKey.derive(this.DERIVATION_PATH);
            if (!derived.privateKey) {
                throw new WalletError("Failed to derive private key", WalletErrorCode.INITIALIZATION_ERROR);
            }
            // Convert to HybridKeyPair
            const keyPair = await crypto_1.HybridCrypto.generateKeyPair(crypto_2.HashUtils.sha256(derived.privateKey.toString()));
            const address = await crypto_1.KeyManager.deriveAddress(keyPair.publicKey);
            const keystore = await keystore_1.Keystore.encrypt(keyPair, password, address);
            const wallet = new Wallet(keyPair, keystore);
            wallet.eventEmitter.emit("created", { address });
            return wallet;
        }
        catch (error) {
            logger_1.Logger.error("Wallet creation failed:", error);
            throw new WalletError("Failed to create wallet from mnemonic", WalletErrorCode.INITIALIZATION_ERROR);
        }
    }
    async verifyMnemonic(mnemonic) {
        try {
            const seed = await bip39.mnemonicToSeed(mnemonic);
            const hdKey = bip32_1.HDKey.fromMasterSeed(seed);
            const derived = hdKey.derive(Wallet.DERIVATION_PATH);
            if (!derived.privateKey)
                return false;
            const keyPair = await crypto_1.HybridCrypto.generateKeyPair(crypto_2.HashUtils.sha256(derived.privateKey.toString()));
            const address = await crypto_1.KeyManager.deriveAddress(keyPair.publicKey);
            return address === this.address;
        }
        catch (error) {
            return false;
        }
    }
    cleanup() {
        this.eventEmitter.removeAllListeners();
        this.secureCleanup();
    }
    async close() {
        await this.lock();
        this.cleanup();
    }
    generateId() {
        return crypto_2.HashUtils.sha256(Date.now().toString());
    }
    async sendToAddress(recipientAddress, amount, password, memo) {
        if (this.isLocked) {
            throw new WalletError("Wallet is locked", WalletErrorCode.INVALID_STATE);
        }
        if (!recipientAddress || BigInt(amount) <= 0) {
            throw new WalletError("Invalid recipient address or amount", WalletErrorCode.TRANSACTION_ERROR);
        }
        try {
            // Create transaction object
            const transaction = {
                id: this.generateId(),
                version: constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.CURRENT_VERSION,
                sender: this.address,
                recipient: recipientAddress,
                fee: BigInt(amount),
                timestamp: Date.now(),
                memo: memo || "",
                type: transaction_model_1.TransactionType.TRANSFER,
                hash: "",
                status: transaction_model_1.TransactionStatus.PENDING,
                signature: "",
                nonce: 0,
                currency: {
                    symbol: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
                    decimals: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
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
        }
        catch (error) {
            logger_1.Logger.error("Send to address failed:", error);
            throw new WalletError("Failed to send transaction", WalletErrorCode.TRANSACTION_ERROR);
        }
    }
    async verify() {
        try {
            const address = await crypto_1.KeyManager.deriveAddress(this.keyPair.publicKey);
            return address === this.address;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get the current balance of the wallet
     * @returns Promise<{ confirmed: bigint, unconfirmed: bigint }>
     */
    async getBalance() {
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
            const walletDb = new wallet_schema_1.WalletDatabase(config_database_1.databaseConfig.databases.wallet.path);
            // Get UTXOs for the address
            const utxos = await walletDb.getUtxos(this.address);
            // Calculate balances
            for (const utxo of utxos) {
                if (utxo.confirmations >= constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.REQUIRED) {
                    balance.confirmed += BigInt(utxo.amount);
                }
                else {
                    balance.unconfirmed += BigInt(utxo.amount);
                }
            }
            return balance;
        }
        catch (error) {
            logger_1.Logger.error("Failed to get wallet balance:", error);
            throw new WalletError("Failed to get wallet balance", WalletErrorCode.TRANSACTION_ERROR);
        }
    }
    /**
     * Generate a new address from the wallet's HD key path
     * @returns Promise<string> The newly generated address
     */
    async getNewAddress() {
        if (this.isLocked) {
            throw new WalletError("Wallet is locked", WalletErrorCode.INVALID_STATE);
        }
        try {
            // Get the next available index from the database
            const walletDb = new wallet_schema_1.WalletDatabase(config_database_1.databaseConfig.databases.wallet.path);
            const currentIndex = await walletDb.getAddressIndex(this.address);
            const nextIndex = currentIndex + 1;
            // Derive new key pair using HD wallet path with next index
            const hdPath = `m/44'/60'/0'/0/${nextIndex}`;
            const seed = await bip39.mnemonicToSeed(this.keystore.mnemonic);
            const hdKey = bip32_1.HDKey.fromMasterSeed(seed);
            const derived = hdKey.derive(hdPath);
            if (!derived.privateKey) {
                throw new WalletError("Failed to derive private key", WalletErrorCode.INITIALIZATION_ERROR);
            }
            // Generate new key pair and address
            const keyPair = await crypto_1.HybridCrypto.generateKeyPair(crypto_2.HashUtils.sha256(derived.privateKey.toString()));
            const newAddress = await crypto_1.KeyManager.deriveAddress(keyPair.publicKey);
            // Save the new address and index to database
            await walletDb.saveAddress(this.address, newAddress, nextIndex);
            // Emit event for new address generation
            this.eventEmitter.emit("addressGenerated", {
                masterAddress: this.address,
                newAddress: newAddress,
                index: nextIndex,
            });
            return newAddress;
        }
        catch (error) {
            logger_1.Logger.error("Failed to generate new address:", error);
            throw new WalletError("Failed to generate new address", WalletErrorCode.INITIALIZATION_ERROR);
        }
    }
    /**
     * Export the wallet's private key
     * @param password Current wallet password for verification
     * @returns Promise<string> Encrypted private key
     */
    async exportPrivateKey(password) {
        if (this.isLocked) {
            throw new WalletError("Wallet is locked", WalletErrorCode.INVALID_STATE);
        }
        try {
            // Verify password before exporting
            await keystore_1.Keystore.decrypt(this.keystore, password);
            // Encrypt private key before returning
            const encryptedKey = await crypto_1.HybridCrypto.encrypt(this.keyPair.privateKey, this.address);
            return encryptedKey;
        }
        catch (error) {
            logger_1.Logger.error("Failed to export private key:", error);
            throw new WalletError("Failed to export private key", WalletErrorCode.KEYSTORE_ERROR);
        }
    }
    /**
     * Import a private key and create a new wallet
     * @param encryptedKey Encrypted private key
     * @param originalAddress Original wallet address
     * @param password Password to decrypt key and create wallet
     * @returns Promise<Wallet> New wallet instance
     */
    static async importPrivateKey(encryptedKey, originalAddress, password) {
        try {
            // Decrypt using the original address
            const privateKey = await crypto_1.HybridCrypto.decrypt(encryptedKey, originalAddress);
            // Generate key pair from private key
            const keyPair = await crypto_1.HybridCrypto.generateKeyPair(privateKey);
            // Then derive address from public key
            const address = await crypto_1.KeyManager.deriveAddress(keyPair.publicKey);
            // Create new keystore
            const keystore = await keystore_1.Keystore.encrypt(keyPair, password, address);
            // Create new wallet instance
            const wallet = new Wallet(keyPair, keystore);
            // Save to database
            const walletDb = new wallet_schema_1.WalletDatabase(config_database_1.databaseConfig.databases.wallet.path);
            await walletDb.saveKeystore(address, keystore);
            wallet.eventEmitter.emit("imported", { address });
            return wallet;
        }
        catch (error) {
            logger_1.Logger.error("Failed to import private key:", error);
            throw new WalletError("Failed to import private key", WalletErrorCode.INITIALIZATION_ERROR);
        }
    }
    getPublicKey() {
        return this.keyPair.publicKey;
    }
    async listUnspent() {
        if (this.isLocked) {
            throw new WalletError("Wallet is locked", WalletErrorCode.INVALID_STATE);
        }
        try {
            return await this.utxoSet.listUnspent({
                addresses: [this.address],
                minConfirmations: 1,
            });
        }
        catch (error) {
            logger_1.Logger.error("Failed to list unspent outputs:", error);
            throw new WalletError("Failed to list unspent outputs", WalletErrorCode.TRANSACTION_ERROR);
        }
    }
}
exports.Wallet = Wallet;
Wallet.DERIVATION_PATH = "m/44'/60'/0'/0/0";
//# sourceMappingURL=wallet.js.map