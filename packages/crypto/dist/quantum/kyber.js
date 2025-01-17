"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Kyber = exports.KyberError = void 0;
const _1 = require(".");
const shared_1 = require("@h3tag-blockchain/shared");
const types_1 = require("../native/types");
class KyberError extends Error {
    constructor(message) {
        super(message);
        this.name = "KyberError";
    }
}
exports.KyberError = KyberError;
class Kyber {
    static async initialize() {
        if (this.isInitialized)
            return;
        try {
            await _1.QuantumCrypto.initialize();
            await _1.QuantumCrypto.setSecurityLevel(this.DEFAULT_SECURITY_LEVEL);
            this.isInitialized = true;
            shared_1.Logger.info("Kyber initialized with security level:", this.DEFAULT_SECURITY_LEVEL);
        }
        catch (error) {
            shared_1.Logger.error("Kyber initialization failed:", error);
            throw new KyberError("Initialization failed");
        }
    }
    static async generateKeyPair() {
        if (!this.isInitialized)
            await this.initialize();
        try {
            const keyPair = await _1.QuantumCrypto.nativeQuantum.kyberGenerateKeyPair();
            if (!keyPair?.publicKey || !keyPair?.privateKey) {
                throw new KyberError("Failed to generate key pair");
            }
            if (keyPair.publicKey.length !== this.PUBLIC_KEY_SIZE) {
                throw new KyberError(`Invalid public key size: ${keyPair.publicKey.length}`);
            }
            if (keyPair.privateKey.length !== this.PRIVATE_KEY_SIZE) {
                throw new KyberError(`Invalid private key size: ${keyPair.privateKey.length}`);
            }
            return {
                publicKey: keyPair.publicKey.toString("base64"),
                privateKey: keyPair.privateKey.toString("base64"),
            };
        }
        catch (error) {
            shared_1.Logger.error("Kyber key generation failed:", error);
            throw new KyberError(error instanceof Error ? error.message : "Key generation failed");
        }
    }
    static async encapsulate(publicKey) {
        if (!this.isInitialized)
            await this.initialize();
        try {
            if (!publicKey) {
                throw new KyberError("Missing public key");
            }
            const publicKeyBuffer = Buffer.from(publicKey, "base64");
            if (publicKeyBuffer.length !== this.PUBLIC_KEY_SIZE) {
                throw new KyberError("Invalid public key size");
            }
            const result = await _1.QuantumCrypto.nativeQuantum.kyberEncapsulate(publicKeyBuffer);
            if (!result?.ciphertext ||
                result.ciphertext.length !== this.CIPHERTEXT_SIZE) {
                throw new KyberError("Invalid ciphertext generated");
            }
            if (!result?.sharedSecret ||
                result.sharedSecret.length !== this.SHARED_SECRET_SIZE) {
                throw new KyberError("Invalid shared secret generated");
            }
            return {
                ciphertext: result.ciphertext.toString("base64"),
                sharedSecret: result.sharedSecret.toString("base64"),
            };
        }
        catch (error) {
            shared_1.Logger.error("Kyber encapsulation failed:", error);
            throw new KyberError(error instanceof Error ? error.message : "Encapsulation failed");
        }
    }
    static async decapsulate(ciphertext, privateKey) {
        if (!this.isInitialized)
            await this.initialize();
        try {
            if (!ciphertext || !privateKey) {
                throw new KyberError("Missing required parameters");
            }
            const ciphertextBuffer = Buffer.from(ciphertext, "base64");
            const privateKeyBuffer = Buffer.from(privateKey, "base64");
            if (ciphertextBuffer.length !== this.CIPHERTEXT_SIZE) {
                throw new KyberError("Invalid ciphertext size");
            }
            if (privateKeyBuffer.length !== this.PRIVATE_KEY_SIZE) {
                throw new KyberError("Invalid private key size");
            }
            const sharedSecret = await _1.QuantumCrypto.nativeQuantum.kyberDecapsulate(ciphertextBuffer, privateKeyBuffer);
            if (sharedSecret.length !== this.SHARED_SECRET_SIZE) {
                throw new KyberError("Invalid shared secret size");
            }
            return sharedSecret.toString("base64");
        }
        catch (error) {
            shared_1.Logger.error("Kyber decapsulation failed:", error);
            throw new KyberError(error instanceof Error ? error.message : "Decapsulation failed");
        }
    }
    static isValidPublicKey(publicKey) {
        try {
            const buffer = Buffer.from(publicKey, "base64");
            return buffer.length === this.PUBLIC_KEY_SIZE;
        }
        catch {
            return false;
        }
    }
    static isValidPrivateKey(privateKey) {
        try {
            const buffer = Buffer.from(privateKey, "base64");
            return buffer.length === this.PRIVATE_KEY_SIZE;
        }
        catch {
            return false;
        }
    }
    static isValidCiphertext(ciphertext) {
        try {
            const buffer = Buffer.from(ciphertext, "base64");
            return buffer.length === this.CIPHERTEXT_SIZE;
        }
        catch {
            return false;
        }
    }
    static async shutdown() {
        if (!this.isInitialized)
            return;
        this.isInitialized = false;
        shared_1.Logger.info("Kyber shut down");
    }
    static async hash(data) {
        if (!this.isInitialized)
            await this.initialize();
        try {
            return await _1.QuantumCrypto.nativeQuantum.kyberHash(data);
        }
        catch (error) {
            shared_1.Logger.error("Kyber hashing failed:", error);
            throw new KyberError(error instanceof Error ? error.message : "Hashing failed");
        }
    }
}
exports.Kyber = Kyber;
Kyber.isInitialized = false;
Kyber.PUBLIC_KEY_SIZE = 1184; // Kyber768 parameters
Kyber.PRIVATE_KEY_SIZE = 2400;
Kyber.CIPHERTEXT_SIZE = 1088;
Kyber.SHARED_SECRET_SIZE = 32;
Kyber.DEFAULT_SECURITY_LEVEL = types_1.SecurityLevel.HIGH;
//# sourceMappingURL=kyber.js.map