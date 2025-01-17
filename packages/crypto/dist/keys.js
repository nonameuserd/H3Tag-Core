"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyManager = exports.KeyError = void 0;
const dilithium_1 = require("./quantum/dilithium");
const kyber_1 = require("./quantum/kyber");
const crypto_js_1 = __importDefault(require("crypto-js"));
const shared_1 = require("@h3tag-blockchain/shared");
const hash_1 = require("./hash");
const hybrid_1 = require("./hybrid");
const quantum_wrapper_1 = require("./quantum-wrapper");
class KeyError extends Error {
    constructor(message) {
        super(message);
        this.name = "KeyError";
    }
}
exports.KeyError = KeyError;
class KeyManager {
    static async initialize() {
        if (this.initialized)
            return;
        await quantum_wrapper_1.QuantumWrapper.initialize();
        this.initialized = true;
    }
    /**
     * Generate a hybrid key pair with optional entropy
     */
    static async generateHybridKeyPair(entropy) {
        try {
            if (entropy && entropy.length < this.MIN_ENTROPY_LENGTH) {
                throw new KeyError("Insufficient entropy length");
            }
            // Generate quantum-resistant keys in parallel
            const [dilithiumKeys, kyberKeys] = await Promise.all([
                dilithium_1.Dilithium.generateKeyPair(),
                kyber_1.Kyber.generateKeyPair(),
            ]);
            if (!dilithiumKeys || !kyberKeys) {
                throw new KeyError("Failed to generate quantum keys");
            }
            // Generate or use provided entropy
            const traditionalEntropy = entropy ||
                crypto_js_1.default.lib.WordArray.random(this.DEFAULT_ENTROPY_LENGTH).toString();
            const keyPair = {
                address: "",
                publicKey: traditionalEntropy,
                privateKey: traditionalEntropy,
            };
            if (!this.validateKeyPair(keyPair)) {
                throw new KeyError("Generated invalid key pair");
            }
            return keyPair;
        }
        catch (error) {
            shared_1.Logger.error("Failed to generate hybrid key pair:", error);
            throw new KeyError(error instanceof Error ? error.message : "Key generation failed");
        }
    }
    /**
     * Validate a hybrid key pair
     */
    static async validateKeyPair(keyPair) {
        try {
            return ((await this.validateKey(keyPair.publicKey)) &&
                (await this.validateKey(keyPair.privateKey)));
        }
        catch (error) {
            shared_1.Logger.error("Key pair validation failed:", error);
            return false;
        }
    }
    /**
     * Validate an individual key
     */
    static async validateKey(key) {
        const keyString = typeof key === "function" ? await key() : key;
        return (typeof keyString === "string" &&
            keyString.length >= this.MIN_ENTROPY_LENGTH);
    }
    /**
     * Serialize a key pair to string
     */
    static serializeKeyPair(keyPair) {
        try {
            if (!this.validateKeyPair(keyPair)) {
                throw new KeyError("Invalid key pair");
            }
            return JSON.stringify(keyPair);
        }
        catch (error) {
            shared_1.Logger.error("Key pair serialization failed:", error);
            throw new KeyError(error instanceof Error ? error.message : "Serialization failed");
        }
    }
    /**
     * Deserialize a key pair from string
     */
    static deserializeKeyPair(serialized) {
        try {
            const keyPair = JSON.parse(serialized);
            if (!this.validateKeyPair(keyPair)) {
                throw new KeyError("Invalid key pair format");
            }
            return keyPair;
        }
        catch (error) {
            shared_1.Logger.error("Key pair deserialization failed:", error);
            throw new KeyError(error instanceof Error ? error.message : "Deserialization failed");
        }
    }
    static async generateKeyPair(entropy) {
        const keyPair = await this.generateHybridKeyPair(entropy);
        const address = await this.deriveAddress(keyPair.publicKey);
        return {
            ...keyPair,
            address,
        };
    }
    static async rotateKeyPair(oldKeyPair) {
        const newKeyPair = await this.generateKeyPair();
        newKeyPair.address = oldKeyPair.address;
        return newKeyPair;
    }
    static async deriveAddress(publicKey) {
        try {
            const pubKey = typeof publicKey === "function" ? await publicKey() : publicKey;
            const quantumKeys = await quantum_wrapper_1.QuantumWrapper.generateKeyPair();
            const combined = await hybrid_1.HybridCrypto.deriveAddress({
                address: pubKey + quantumKeys.publicKey.address,
            });
            const hash = await quantum_wrapper_1.QuantumWrapper.hashData(Buffer.from(combined));
            // Bitcoin-style address generation with quantum protection
            const ripemd160Hash = hash_1.HashUtils.ripemd160(hash_1.HashUtils.sha256(hash.toString("hex")));
            const versionedHash = Buffer.concat([
                Buffer.from([0x00]),
                Buffer.from(ripemd160Hash, "hex"),
            ]);
            // Double SHA256 for checksum
            const checksum = hash_1.HashUtils.sha256(hash_1.HashUtils.sha256(versionedHash.toString("hex"))).slice(0, 8);
            // Combine and convert to base58
            const finalBinary = Buffer.concat([
                versionedHash,
                Buffer.from(checksum, "hex"),
            ]);
            return hash_1.HashUtils.toBase58(finalBinary);
        }
        catch (error) {
            shared_1.Logger.error("Failed to derive quantum-safe address", { error });
            throw new KeyError("Address derivation failed");
        }
    }
    static async shutdown() {
        this.initialized = false;
        await quantum_wrapper_1.QuantumWrapper.initialize(); // Reset quantum wrapper
    }
    /**
     * Convert address to public key hash
     */
    static async addressToHash(address) {
        try {
            // Remove prefix and decode from base58
            const decoded = hash_1.HashUtils.fromBase58(address);
            // Extract the public key hash (remove version byte and checksum)
            const pubKeyHash = decoded.slice(1, -4);
            return pubKeyHash.toString("hex");
        }
        catch (error) {
            shared_1.Logger.error("Failed to convert address to hash:", error);
            throw new KeyError("Invalid address format");
        }
    }
    /**
     * Get public key hash from public key
     */
    static async getPublicKeyHash(publicKey) {
        try {
            const hash = hash_1.HashUtils.hybridHash(publicKey);
            return hash;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get public key hash:", error);
            throw new KeyError("Invalid public key");
        }
    }
}
exports.KeyManager = KeyManager;
KeyManager.MIN_ENTROPY_LENGTH = 32;
KeyManager.DEFAULT_ENTROPY_LENGTH = 64;
KeyManager.initialized = false;
//# sourceMappingURL=keys.js.map