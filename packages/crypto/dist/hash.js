"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HashUtils = void 0;
const crypto_js_1 = __importDefault(require("crypto-js"));
const crypto_1 = require("crypto");
const dilithium_1 = require("./quantum/dilithium");
const kyber_1 = require("./quantum/kyber");
const bs58_1 = __importDefault(require("bs58"));
class HashUtils {
    /**
     * Generate SHA3-512 hash
     */
    static sha3(data) {
        try {
            return crypto_js_1.default.SHA3(data, { outputLength: 512 }).toString();
        }
        catch (error) {
            throw new Error(`SHA3 hashing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Generate SHA-256 hash
     */
    static sha256(data) {
        try {
            return crypto_js_1.default.SHA256(data).toString();
        }
        catch (error) {
            throw new Error(`SHA256 hashing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Generate HMAC using SHA-512
     */
    static hmac(data, key) {
        try {
            return crypto_js_1.default.HmacSHA512(data, key).toString();
        }
        catch (error) {
            throw new Error(`HMAC generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Generate RIPEMD-160 hash
     */
    static ripemd160(data) {
        try {
            return crypto_js_1.default.RIPEMD160(data).toString();
        }
        catch (error) {
            throw new Error(`RIPEMD160 hashing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Generate SHA3-512 hash and return as Buffer
     */
    static sha3Buffer(data) {
        try {
            const hash = this.sha3(data.toString());
            return Buffer.from(hash, 'hex');
        }
        catch (error) {
            throw new Error(`SHA3 buffer hashing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Calculate hybrid quantum-safe hash
     */
    static async calculateHash(data) {
        try {
            // Serialize input data
            const content = JSON.stringify(data);
            const contentBuffer = Buffer.from(new TextEncoder().encode(content));
            // Generate classical hash
            const classicHash = (0, crypto_1.createHash)('sha256').update(content).digest('hex');
            // Generate quantum-resistant hashes
            const [dilithiumHash, kyberHash] = await Promise.all([
                dilithium_1.Dilithium.hash(contentBuffer),
                kyber_1.Kyber.hash(contentBuffer),
            ]);
            // Combine all hashes using SHA3
            return this.sha3(classicHash + dilithiumHash + kyberHash);
        }
        catch (error) {
            throw new Error(`Hybrid hash calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Generate double SHA-256 hash
     */
    static doubleSha256(data) {
        try {
            return this.sha256(this.sha256(data));
        }
        catch (error) {
            throw new Error(`Double SHA256 hashing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Generate hash for address generation (SHA256 + RIPEMD160)
     */
    static hash160(data) {
        try {
            const sha256Hash = this.sha256(data);
            return this.ripemd160(sha256Hash);
        }
        catch (error) {
            throw new Error(`Hash160 calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Generate hybrid hash
     */
    static hybridHash(data) {
        try {
            const dataBuffer = Buffer.from(data);
            const hash = this.doubleSha256(dataBuffer.toString('hex')) +
                dilithium_1.Dilithium.hash(dataBuffer) +
                kyber_1.Kyber.hash(dataBuffer);
            return this.ripemd160(hash);
        }
        catch (error) {
            throw new Error(`Hybrid hash calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Encode Buffer to Base58
     */
    static toBase58(data) {
        try {
            return bs58_1.default.encode(data);
        }
        catch (error) {
            throw new Error(`Base58 encoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Decode from Base58
     */
    static fromBase58(str) {
        try {
            return Buffer.from(bs58_1.default.decode(str));
        }
        catch (error) {
            throw new Error(`Base58 decoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.HashUtils = HashUtils;
