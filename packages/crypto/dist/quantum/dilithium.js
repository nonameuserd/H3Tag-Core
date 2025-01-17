"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dilithium = exports.DilithiumError = void 0;
const _1 = require(".");
const shared_1 = require("@h3tag-blockchain/shared");
const types_1 = require("../native/types");
class DilithiumError extends Error {
    constructor(message) {
        super(message);
        this.name = "DilithiumError";
    }
}
exports.DilithiumError = DilithiumError;
class Dilithium {
    static async initialize() {
        if (this.initialized)
            return;
        try {
            await _1.QuantumCrypto.initialize();
            await _1.QuantumCrypto.nativeQuantum.setSecurityLevel(this.DEFAULT_SECURITY_LEVEL);
            this.initialized = true;
            shared_1.Logger.info("Dilithium initialized with security level:", this.DEFAULT_SECURITY_LEVEL);
        }
        catch (error) {
            shared_1.Logger.error("Dilithium initialization failed:", error);
            throw new DilithiumError("Initialization failed");
        }
    }
    static async generateKeyPair(entropy) {
        if (!this.initialized)
            await this.initialize();
        try {
            const keyPair = await _1.QuantumCrypto.generateKeyPair(entropy);
            if (!keyPair?.publicKey || !keyPair?.privateKey) {
                throw new DilithiumError("Failed to generate key pair");
            }
            return {
                publicKey: keyPair.publicKey.toString("base64"),
                privateKey: keyPair.privateKey.toString("base64"),
            };
        }
        catch (error) {
            shared_1.Logger.error("Dilithium key generation failed:", error);
            throw new DilithiumError(error instanceof Error ? error.message : "Key generation failed");
        }
    }
    static async sign(message, privateKey) {
        if (!this.initialized)
            await this.initialize();
        try {
            if (!message || !privateKey) {
                throw new DilithiumError("Missing message or private key");
            }
            const privateKeyBuffer = Buffer.from(privateKey, "base64");
            const messageBuffer = Buffer.from(message);
            if (!this.isValidPrivateKey(privateKey)) {
                throw new DilithiumError("Invalid private key format");
            }
            const signature = await _1.QuantumCrypto.nativeQuantum.dilithiumSign(messageBuffer, privateKeyBuffer);
            if (signature.length !== this.SIGNATURE_SIZE) {
                throw new DilithiumError("Invalid signature generated");
            }
            return signature.toString("base64");
        }
        catch (error) {
            shared_1.Logger.error("Dilithium signing failed:", error);
            throw new DilithiumError(error instanceof Error ? error.message : "Signing failed");
        }
    }
    static async verify(message, signature, publicKey) {
        if (!this.initialized)
            await this.initialize();
        try {
            if (!message || !signature || !publicKey) {
                throw new DilithiumError("Missing required parameters");
            }
            if (!this.isValidPublicKey(publicKey)) {
                throw new DilithiumError("Invalid public key format");
            }
            const messageBuffer = Buffer.from(message);
            const signatureBuffer = Buffer.from(signature, "base64");
            const publicKeyBuffer = Buffer.from(publicKey, "base64");
            return await _1.QuantumCrypto.nativeQuantum.dilithiumVerify(messageBuffer, signatureBuffer, publicKeyBuffer);
        }
        catch (error) {
            shared_1.Logger.error("Dilithium verification failed:", error);
            throw new DilithiumError(error instanceof Error ? error.message : "Verification failed");
        }
    }
    static isValidPublicKey(publicKey) {
        try {
            const buffer = Buffer.from(publicKey, "base64");
            return buffer.length === this.KEY_SIZE;
        }
        catch {
            return false;
        }
    }
    static isValidPrivateKey(privateKey) {
        try {
            const buffer = Buffer.from(privateKey, "base64");
            return buffer.length === this.KEY_SIZE;
        }
        catch {
            return false;
        }
    }
    static async hash(data) {
        if (!this.initialized)
            await this.initialize();
        try {
            return await _1.QuantumCrypto.nativeQuantum.dilithiumHash(data);
        }
        catch (error) {
            shared_1.Logger.error("Dilithium hashing failed:", error);
            throw new DilithiumError(error instanceof Error ? error.message : "Hashing failed");
        }
    }
    static async shutdown() {
        if (!this.initialized)
            return;
        await _1.QuantumCrypto.shutdown();
        this.initialized = false;
        shared_1.Logger.info("Dilithium shut down");
    }
}
exports.Dilithium = Dilithium;
Dilithium.initialized = false;
Dilithium.KEY_SIZE = 2528;
Dilithium.SIGNATURE_SIZE = 3293;
Dilithium.DEFAULT_SECURITY_LEVEL = types_1.SecurityLevel.HIGH;
//# sourceMappingURL=dilithium.js.map