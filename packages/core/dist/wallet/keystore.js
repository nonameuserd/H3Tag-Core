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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Keystore = exports.KeystoreError = exports.KeystoreErrorCode = void 0;
const crypto_1 = require("@h3tag-blockchain/crypto");
const logger_1 = require("@h3tag-blockchain/shared/dist/utils/logger");
const constants_1 = require("../blockchain/utils/constants");
const crypto_2 = __importDefault(require("crypto"));
const keystore_schema_1 = require("../database/keystore-schema");
const util_1 = require("util");
const crypto_3 = require("crypto");
const config_database_1 = require("../database/config.database");
const bip39 = __importStar(require("bip39"));
const scrypt = (0, util_1.promisify)(crypto_3.scrypt);
var KeystoreErrorCode;
(function (KeystoreErrorCode) {
    KeystoreErrorCode["ENCRYPTION_ERROR"] = "ENCRYPTION_ERROR";
    KeystoreErrorCode["DECRYPTION_ERROR"] = "DECRYPTION_ERROR";
    KeystoreErrorCode["INVALID_PASSWORD"] = "INVALID_PASSWORD";
    KeystoreErrorCode["KDF_ERROR"] = "KDF_ERROR";
    KeystoreErrorCode["INVALID_KEYSTORE_STRUCTURE"] = "INVALID_KEYSTORE_STRUCTURE";
    KeystoreErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    KeystoreErrorCode["NOT_FOUND"] = "NOT_FOUND";
    KeystoreErrorCode["BACKUP_ERROR"] = "BACKUP_ERROR";
    KeystoreErrorCode["RESTORE_ERROR"] = "RESTORE_ERROR";
})(KeystoreErrorCode = exports.KeystoreErrorCode || (exports.KeystoreErrorCode = {}));
class KeystoreError extends Error {
    constructor(message, code) {
        super(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} Keystore Error: ${message}`);
        this.code = code;
        this.name = "KeystoreError";
    }
}
exports.KeystoreError = KeystoreError;
class Keystore {
    static async initialize() {
        this.database = new keystore_schema_1.KeystoreDatabase(config_database_1.databaseConfig.databases.keystore.path);
    }
    static async encrypt(keyPair, password, address) {
        try {
            const keystore = await this.encryptKeyPair(keyPair, password, address);
            await this.database.store(address, keystore);
            return keystore;
        }
        catch (error) {
            logger_1.Logger.error(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NAME} keystore encryption failed:`, error);
            throw new KeystoreError("Encryption failed", error instanceof KeystoreError ? error.code : "ENCRYPTION_ERROR");
        }
    }
    static async decryptFromAddress(address, password) {
        try {
            if (!this.database) {
                throw new KeystoreError("Database not initialized", "DATABASE_ERROR");
            }
            const keystore = await this.database.get(address);
            if (!keystore) {
                throw new KeystoreError("Keystore not found", "NOT_FOUND");
            }
            return await this.decrypt(keystore, password);
        }
        catch (error) {
            logger_1.Logger.error(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NAME} keystore decryption failed:`, error);
            throw new KeystoreError("Decryption failed", error instanceof KeystoreError ? error.code : "DECRYPTION_ERROR");
        }
    }
    static async decrypt(keystore, password) {
        try {
            const address = keystore.address;
            this.checkRateLimit(address);
            if (!keystore || !password) {
                throw new KeystoreError("Invalid input parameters", "INVALID_INPUT");
            }
            // Check if key rotation is needed
            if (await this.checkRotationNeeded(address)) {
                logger_1.Logger.warn(`Key rotation recommended for address: ${address}`);
            }
            const result = await this.decryptKeystore(keystore, password);
            // Reset attempts on success
            this.attempts.delete(address);
            return result;
        }
        catch (error) {
            this.incrementAttempts(keystore.address);
            throw error;
        }
    }
    static async encryptKeyPair(keyPair, password, address) {
        try {
            this.validateInputs(keyPair, password, address);
            const salt = await this.generateSecureSalt();
            const iv = await this.generateSecureIV();
            const derivedKeys = await this.deriveMultipleKeys(password, salt, this.KDF_PARAMS);
            const serializedKeyPair = await this.secureSerialize(keyPair);
            // Use IV in encryption
            const encrypted = await crypto_1.HybridCrypto.encrypt(serializedKeyPair + iv.toString("base64"), // Include IV in the message
            { address: derivedKeys.address });
            const mac = await this.calculateEnhancedMAC(derivedKeys, encrypted, salt);
            return {
                version: this.VERSION,
                address,
                mnemonic: bip39.generateMnemonic(256),
                crypto: {
                    cipher: this.CIPHER,
                    ciphertext: encrypted,
                    cipherparams: { iv: iv.toString("base64") },
                    kdf: this.KDF,
                    kdfparams: {
                        ...this.KDF_PARAMS,
                        salt: salt.toString("base64"),
                    },
                    mac,
                },
            };
        }
        catch (error) {
            logger_1.Logger.error(`Encryption failed:`, error);
            throw new KeystoreError("Encryption failed", error instanceof KeystoreError ? error.code : "ENCRYPTION_ERROR");
        }
    }
    static async decryptKeystore(keystore, password) {
        try {
            this.validateKeystore(keystore);
            this.validatePassword(password);
            const derivedKeys = await this.deriveMultipleKeys(password, Buffer.from(keystore.crypto.kdfparams.salt, "base64"), this.KDF_PARAMS);
            await this.verifyMAC(derivedKeys, keystore.crypto.ciphertext, keystore.crypto.mac, keystore.crypto.kdfparams.salt);
            const decrypted = await crypto_1.HybridCrypto.decrypt(keystore.crypto.ciphertext, {
                address: derivedKeys.address,
            });
            // Extract IV and actual data from decrypted message
            const iv = Buffer.from(keystore.crypto.cipherparams.iv, "base64");
            const actualData = decrypted.slice(0, -iv.length);
            return await this.secureDeserialize(actualData);
        }
        catch (error) {
            logger_1.Logger.error(`Decryption failed:`, error);
            throw new KeystoreError("Decryption failed", error instanceof KeystoreError ? error.code : "DECRYPTION_ERROR");
        }
    }
    static async generateSecureSalt() {
        try {
            const quantumBytes = await crypto_1.HybridCrypto.generateRandomBytes(16);
            const classicalBytes = crypto_2.default.randomBytes(16);
            const combinedSalt = Buffer.concat([
                Buffer.from(quantumBytes),
                classicalBytes,
            ]);
            return crypto_1.HashUtils.sha3Buffer(combinedSalt);
        }
        catch (error) {
            logger_1.Logger.error("Quantum salt generation failed, falling back to classical:", error);
            return crypto_2.default.randomBytes(32);
        }
    }
    static async generateSecureIV() {
        return crypto_2.default.randomBytes(16);
    }
    static async deriveMultipleKeys(password, salt, params) {
        try {
            const baseKey = await this.deriveKey(password, salt, params);
            if (!baseKey || baseKey.length < 32) {
                throw new KeystoreError("Invalid derived key", "KDF_ERROR");
            }
            return {
                address: baseKey,
                encryption: crypto_1.HashUtils.sha3(baseKey),
            };
        }
        finally {
            this.secureCleanup(password);
            this.secureCleanup(salt);
        }
    }
    static async deriveKey(password, salt, params) {
        try {
            const derivedKey = await scrypt(password, salt, params.dklen);
            return derivedKey.toString();
        }
        catch (error) {
            throw new KeystoreError("Key derivation failed", KeystoreErrorCode.KDF_ERROR);
        }
    }
    static async calculateEnhancedMAC(keys, ciphertext, salt) {
        const combinedData = keys.address + ciphertext + salt.toString("base64");
        return crypto_1.HashUtils.sha3(combinedData);
    }
    static async verifyMAC(keys, ciphertext, storedMac, salt) {
        const calculatedMac = await this.calculateEnhancedMAC(keys, ciphertext, Buffer.from(salt, "base64"));
        if (!crypto_2.default.timingSafeEqual(Buffer.from(calculatedMac), Buffer.from(storedMac))) {
            throw new KeystoreError("Invalid password or corrupted keystore", "INVALID_MAC");
        }
    }
    static validateInputs(keyPair, password, address) {
        this.validatePassword(password);
        if (!address || typeof address !== "string" || address.length < 1) {
            throw new KeystoreError(`Invalid ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} address`, "INVALID_ADDRESS");
        }
        if (!keyPair || !keyPair.publicKey || !keyPair.privateKey) {
            throw new KeystoreError(`Invalid ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} key pair`, "INVALID_KEYPAIR");
        }
    }
    static validatePassword(password) {
        if (!password || typeof password !== "string") {
            throw new KeystoreError("Invalid password format", "INVALID_PASSWORD");
        }
        // Use constant-time comparison for length check
        const passwordLength = Buffer.from(password).length;
        if (!crypto_2.default.timingSafeEqual(Buffer.from([passwordLength]), Buffer.from([this.MIN_PASSWORD_LENGTH]))) {
            // Use generic error message to avoid length information leakage
            throw new KeystoreError("Invalid password", "INVALID_PASSWORD");
        }
    }
    static validatePasswordStrength(password) {
        if (!password || typeof password !== "string") {
            throw new KeystoreError("Invalid password format", KeystoreErrorCode.INVALID_PASSWORD);
        }
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        if (!(hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar)) {
            throw new KeystoreError("Password must contain uppercase, lowercase, numbers, and special characters", KeystoreErrorCode.INVALID_PASSWORD);
        }
        // Use constant-time comparison for length check
        const passwordLength = Buffer.from(password).length;
        if (!crypto_2.default.timingSafeEqual(Buffer.from([passwordLength]), Buffer.from([this.MIN_PASSWORD_LENGTH]))) {
            throw new KeystoreError("Invalid password", KeystoreErrorCode.INVALID_PASSWORD);
        }
    }
    static async encryptWithTimeout(data, keys) {
        return Promise.race([
            crypto_1.HybridCrypto.encrypt(data, keys),
            new Promise((_, reject) => setTimeout(() => reject(new KeystoreError("Encryption timeout", "ENCRYPTION_TIMEOUT")), this.MAX_ENCRYPTION_TIME)),
        ]);
    }
    static async decryptWithTimeout(data, keys, iv) {
        return Promise.race([
            crypto_1.HybridCrypto.decrypt(data, keys),
            new Promise((_, reject) => setTimeout(() => reject(new KeystoreError("Decryption timeout", "DECRYPTION_TIMEOUT")), this.MAX_ENCRYPTION_TIME)),
        ]);
    }
    static async secureSerialize(keyPair) {
        try {
            return crypto_1.KeyManager.serializeKeyPair(keyPair);
        }
        catch (error) {
            throw new KeystoreError("Serialization failed", "SERIALIZATION_ERROR");
        }
    }
    static async secureDeserialize(data) {
        try {
            return crypto_1.KeyManager.deserializeKeyPair(data);
        }
        catch (error) {
            throw new KeystoreError("Deserialization failed", "DESERIALIZATION_ERROR");
        }
    }
    static validateKeystore(keystore) {
        // Basic structure validation
        if (!keystore || typeof keystore !== "object") {
            throw new KeystoreError("Invalid keystore structure", "INVALID_KEYSTORE_STRUCTURE");
        }
        // Version check
        if (typeof keystore.version !== "number" ||
            keystore.version !== this.VERSION) {
            throw new KeystoreError(`Unsupported keystore version. Expected ${this.VERSION}`, "INVALID_VERSION");
        }
        // Address validation
        if (!keystore.address ||
            typeof keystore.address !== "string" ||
            keystore.address.length < 1) {
            throw new KeystoreError("Invalid address in keystore", "INVALID_ADDRESS");
        }
        // Crypto section validation
        if (!keystore.crypto || typeof keystore.crypto !== "object") {
            throw new KeystoreError("Invalid crypto section", "INVALID_CRYPTO_SECTION");
        }
        // Cipher validation
        if (keystore.crypto.cipher !== this.CIPHER) {
            throw new KeystoreError(`Unsupported cipher. Expected ${this.CIPHER}`, "UNSUPPORTED_CIPHER");
        }
        // Ciphertext validation
        if (!keystore.crypto.ciphertext ||
            typeof keystore.crypto.ciphertext !== "string") {
            throw new KeystoreError("Invalid ciphertext", "INVALID_CIPHERTEXT");
        }
        // IV validation
        if (!keystore.crypto.cipherparams?.iv ||
            typeof keystore.crypto.cipherparams.iv !== "string" ||
            !this.isValidBase64(keystore.crypto.cipherparams.iv)) {
            throw new KeystoreError("Invalid IV parameter", "INVALID_IV");
        }
        // KDF validation
        if (keystore.crypto.kdf !== this.KDF) {
            throw new KeystoreError(`Unsupported KDF. Expected ${this.KDF}`, "UNSUPPORTED_KDF");
        }
        // KDF params validation
        this.validateKDFParams(keystore.crypto.kdfparams, keystore);
        // MAC validation
        if (!keystore.crypto.mac ||
            typeof keystore.crypto.mac !== "string" ||
            !this.isValidBase64(keystore.crypto.mac)) {
            throw new KeystoreError("Invalid MAC", "INVALID_MAC_FORMAT");
        }
    }
    static validateKDFParams(params, keystore) {
        if (!params || typeof params !== "object") {
            throw new KeystoreError("Invalid KDF parameters", "INVALID_KDF_PARAMS");
        }
        const requiredParams = {
            dklen: this.KDF_PARAMS.dklen,
            n: this.KDF_PARAMS.n,
            r: this.KDF_PARAMS.r,
            p: this.KDF_PARAMS.p,
        };
        for (const [key, expectedValue] of Object.entries(requiredParams)) {
            if (typeof params[key] !== "number" || params[key] !== expectedValue) {
                throw new KeystoreError(`Invalid KDF parameter: ${key} for address ${keystore.address}`, "INVALID_KDF_PARAM_VALUE");
            }
        }
        if (!params.salt ||
            typeof params.salt !== "string" ||
            !this.isValidBase64(params.salt)) {
            throw new KeystoreError(`Invalid salt parameter for address ${keystore.address}`, "INVALID_SALT");
        }
    }
    static isValidBase64(str) {
        try {
            return Buffer.from(str, "base64").toString("base64") === str;
        }
        catch {
            return false;
        }
    }
    static secureCleanup(sensitiveData) {
        if (Buffer.isBuffer(sensitiveData)) {
            sensitiveData.fill(0);
        }
        else if (typeof sensitiveData === "string") {
            const buf = Buffer.from(sensitiveData);
            buf.fill(0);
        }
        else if (sensitiveData instanceof Object) {
            Object.keys(sensitiveData).forEach((key) => {
                sensitiveData[key] = null;
            });
        }
    }
    static checkRateLimit(address) {
        const now = Date.now();
        const attempts = this.attempts;
        const attempt = this.attempts.get(address);
        if (!attempt)
            return;
        if (attempt.count >= this.MAX_ATTEMPTS) {
            const timeLeft = attempt.timestamp + this.LOCKOUT_TIME - now;
            if (timeLeft > 0) {
                throw new KeystoreError(`Too many failed attempts. Try again in ${Math.ceil(timeLeft / 1000)} seconds`, "RATE_LIMIT_EXCEEDED");
            }
            attempts.delete(address);
        }
    }
    static incrementAttempts(address) {
        const attempt = this.attempts.get(address) || {
            count: 0,
            timestamp: Date.now(),
        };
        attempt.count++;
        attempt.timestamp = Date.now();
        this.attempts.set(address, attempt);
    }
    static async rotateKey(address, password) {
        try {
            // Get existing keystore
            if (!this.database) {
                throw new KeystoreError("Database not initialized", "DATABASE_ERROR");
            }
            const existingKeystore = await this.database.get(address);
            if (!existingKeystore) {
                throw new KeystoreError("Keystore not found", "NOT_FOUND");
            }
            // Decrypt existing keystore
            const keyPair = await this.decrypt(existingKeystore, password);
            // Generate new key pair while maintaining the address
            let newKeystore;
            try {
                const newKeyPair = await crypto_1.KeyManager.rotateKeyPair(keyPair);
                newKeystore = await this.encrypt(newKeyPair, password, address);
            }
            catch (error) {
                await this.secureCleanup(keyPair);
                throw error;
            }
            // Store rotation metadata
            const metadata = this.rotationMetadata.get(address) || {
                lastRotation: Date.now(),
                rotationCount: 0,
                previousKeyHashes: [],
            };
            metadata.previousKeyHashes.push(await crypto_1.HashUtils.sha3(JSON.stringify(existingKeystore)));
            metadata.lastRotation = Date.now();
            metadata.rotationCount++;
            this.rotationMetadata.set(address, metadata);
            logger_1.Logger.info(`Key rotation completed for address: ${address}`);
            await this.database.store(address, newKeystore);
            return newKeystore;
        }
        catch (error) {
            logger_1.Logger.error(`Key rotation failed for address: ${address}`, error);
            throw new KeystoreError("Key rotation failed", error instanceof KeystoreError ? error.code : "ROTATION_ERROR");
        }
    }
    static async checkRotationNeeded(address) {
        try {
            const keystore = await this.database.get(address);
            if (!keystore) {
                throw new KeystoreError("Keystore not found", "NOT_FOUND");
            }
            const keyAge = Date.now() - keystore.version;
            return keyAge >= this.MAX_KEY_AGE;
        }
        catch (error) {
            logger_1.Logger.error("Key rotation check failed:", error);
            return false;
        }
    }
    static getKeyRotationStatus(address) {
        return this.rotationMetadata.get(address) || null;
    }
    static async backup(address) {
        try {
            if (!this.database) {
                throw new KeystoreError("Database not initialized", KeystoreErrorCode.DATABASE_ERROR);
            }
            const keystore = await this.database.get(address);
            if (!keystore) {
                throw new KeystoreError("Keystore not found", KeystoreErrorCode.NOT_FOUND);
            }
            const backupData = {
                timestamp: Date.now(),
                keystore,
                metadata: this.rotationMetadata.get(address),
            };
            return JSON.stringify(backupData, null, 2);
        }
        catch (error) {
            logger_1.Logger.error(`Backup failed for address: ${address}`, error);
            throw new KeystoreError("Backup failed", error instanceof KeystoreError
                ? error.code
                : KeystoreErrorCode.BACKUP_ERROR);
        }
    }
    static async restore(backupData, password) {
        try {
            const parsed = JSON.parse(backupData);
            const { keystore, metadata } = parsed;
            // Verify the keystore can be decrypted with the password
            await this.decrypt(keystore, password);
            // Store the keystore and metadata
            if (this.database) {
                await this.database.store(keystore.address, keystore);
            }
            if (metadata) {
                this.rotationMetadata.set(keystore.address, metadata);
            }
            return keystore.address;
        }
        catch (error) {
            logger_1.Logger.error("Restore failed:", error);
            throw new KeystoreError("Restore failed", error instanceof KeystoreError
                ? error.code
                : KeystoreErrorCode.RESTORE_ERROR);
        }
    }
    static async healthCheck() {
        try {
            if (!this.database) {
                throw new KeystoreError("Database not initialized", KeystoreErrorCode.DATABASE_ERROR);
            }
            await this.database.ping();
            const testKey = await this.generateSecureSalt();
            const testData = testKey.toString("hex");
            const encrypted = await crypto_1.HybridCrypto.encrypt(testData, {
                address: testKey.toString("base64"),
            });
            // Verify encryption worked by attempting decryption
            const decrypted = await crypto_1.HybridCrypto.decrypt(encrypted, {
                address: testKey.toString("base64"),
            });
            return decrypted === testData;
        }
        catch (error) {
            logger_1.Logger.error("Keystore health check failed:", error);
            return false;
        }
    }
}
exports.Keystore = Keystore;
Keystore.VERSION = 1;
Keystore.CIPHER = "hybrid-aes";
Keystore.KDF = "scrypt";
Keystore.KDF_PARAMS = {
    dklen: 64,
    n: 1048576,
    r: 32,
    p: 4,
};
Keystore.MIN_PASSWORD_LENGTH = 12;
Keystore.MAX_ENCRYPTION_TIME = 5000; // 5 seconds
Keystore.MAX_ATTEMPTS = 5;
Keystore.LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
Keystore.attempts = new Map();
Keystore.ROTATION_PERIOD = 90 * 24 * 60 * 60 * 1000; // 90 days
Keystore.MAX_KEY_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year
Keystore.rotationMetadata = new Map();
//# sourceMappingURL=keystore.js.map