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
        this.name = 'KeyError';
    }
}
exports.KeyError = KeyError;
class KeyManager {
    static async initialize() {
        if (this.initialized)
            return;
        if (!this.initializationPromise) {
            this.initializationPromise = quantum_wrapper_1.QuantumWrapper.initialize().then(() => {
                this.initialized = true;
            }).catch((error) => {
                this.initializationPromise = null;
                throw error;
            });
        }
        return this.initializationPromise;
    }
    /**
     * Generate a hybrid key pair with optional entropy
     */
    static async generateHybridKeyPair(entropy) {
        try {
            if (entropy) {
                if (entropy.length < this.MIN_ENTROPY_LENGTH) {
                    throw new KeyError('Insufficient entropy length');
                }
                if (!/^[0-9A-Fa-f]+$/.test(entropy)) {
                    throw new KeyError('Provided entropy must be a valid hex string');
                }
            }
            // Generate quantum-resistant keys in parallel.
            const [dilithiumKeys, kyberKeys] = await Promise.all([
                dilithium_1.Dilithium.generateKeyPair(),
                kyber_1.Kyber.generateKeyPair(),
            ]);
            if (!dilithiumKeys || !kyberKeys) {
                throw new KeyError('Failed to generate quantum keys');
            }
            // Generate or use provided entropy.
            const traditionalEntropy = entropy ||
                crypto_js_1.default.lib.WordArray.random(this.DEFAULT_ENTROPY_LENGTH).toString();
            const keyPair = {
                address: '',
                publicKey: traditionalEntropy,
                privateKey: traditionalEntropy,
                quantumKeys: { dilithium: dilithiumKeys, kyber: kyberKeys },
            };
            // Await the asynchronous validation.
            if (!(await this.validateKeyPair(keyPair))) {
                throw new KeyError('Generated invalid key pair');
            }
            return keyPair;
        }
        catch (error) {
            shared_1.Logger.error('Failed to generate hybrid key pair:', error);
            throw new KeyError(error instanceof Error ? error.message : 'Key generation failed');
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
            shared_1.Logger.error('Key pair validation failed:', error);
            return false;
        }
    }
    /**
     * Validate an individual key
     */
    static async validateKey(key) {
        const keyString = typeof key === 'function' ? await key() : key;
        return (typeof keyString === 'string' &&
            keyString.length >= this.MIN_ENTROPY_LENGTH);
    }
    /**
     * Serialize a key pair to string
     */
    static async serializeKeyPair(keyPair) {
        try {
            if (!(await this.validateKeyPair(keyPair))) {
                throw new KeyError('Invalid key pair');
            }
            return JSON.stringify(keyPair);
        }
        catch (error) {
            shared_1.Logger.error('Key pair serialization failed:', error);
            throw new KeyError(error instanceof Error ? error.message : 'Serialization failed');
        }
    }
    /**
     * Deserialize a key pair from string
     */
    static async deserializeKeyPair(serialized) {
        try {
            const keyPair = JSON.parse(serialized);
            if (!(await this.validateKeyPair(keyPair))) {
                throw new KeyError('Invalid key pair format');
            }
            return keyPair;
        }
        catch (error) {
            shared_1.Logger.error('Key pair deserialization failed:', error);
            throw new KeyError(error instanceof Error ? error.message : 'Deserialization failed');
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
        // If key rotation is intended to preserve the same address (e.g. for continuity), then this is acceptable.
        // Otherwise, derive a new address from the new key components.
        newKeyPair.address = oldKeyPair.address;
        return newKeyPair;
    }
    static async deriveAddress(publicKey) {
        try {
            const pubKey = typeof publicKey === 'function' ? await publicKey() : publicKey;
            const quantumKeys = await quantum_wrapper_1.QuantumWrapper.generateKeyPair();
            const combined = await hybrid_1.HybridCrypto.deriveAddress({
                address: pubKey + quantumKeys.publicKey.toString('hex'),
            });
            const hash = await quantum_wrapper_1.QuantumWrapper.hashData(Buffer.from(combined));
            const ripemd160Hash = hash_1.HashUtils.ripemd160(hash_1.HashUtils.sha256(hash.toString('hex')));
            // Determine address type (TAG1, TAG3, or TAG)
            const addressType = this.determineAddressType(pubKey);
            const versionByte = this.getVersionByte(addressType);
            const versionedHash = Buffer.concat([
                Buffer.from([versionByte]),
                Buffer.from(ripemd160Hash, 'hex'),
            ]);
            const checksum = hash_1.HashUtils.sha256(hash_1.HashUtils.sha256(versionedHash.toString('hex'))).slice(0, 8);
            const finalBinary = Buffer.concat([
                versionedHash,
                Buffer.from(checksum, 'hex'),
            ]);
            return addressType + hash_1.HashUtils.toBase58(finalBinary);
        }
        catch (error) {
            shared_1.Logger.error('Failed to derive quantum-safe address', { error });
            throw new KeyError('Address derivation failed');
        }
    }
    static determineAddressType(publicKey) {
        try {
            // Extract key characteristics
            const keyLength = publicKey.length;
            const keyType = publicKey.substring(0, 2); // First two characters often indicate key type
            // Determine address type based on key characteristics
            if (keyType === '02' || keyType === '03') {
                // Compressed public key format - use native SegWit equivalent
                return 'TAG1';
            }
            else if (keyType === '04') {
                // Uncompressed public key format - use legacy format
                return 'TAG';
            }
            else if (keyLength > 66) {
                // Complex/multisig script - use P2SH equivalent
                return 'TAG3';
            }
            // Default to most modern format if we can't determine
            shared_1.Logger.debug('Using default address type TAG1 for public key', {
                keyType,
                keyLength,
            });
            return 'TAG1';
        }
        catch (error) {
            shared_1.Logger.warn('Error determining address type, using default TAG1', {
                error,
                publicKey: publicKey.substring(0, 10) + '...',
            });
            return 'TAG1';
        }
    }
    static getVersionByte(addressType) {
        switch (addressType) {
            case 'TAG1':
                return 0x00; // Native SegWit equivalent
            case 'TAG3':
                return 0x05; // P2SH equivalent
            case 'TAG':
                return 0x00; // Legacy equivalent
            default:
                throw new KeyError('Invalid address type');
        }
    }
    /**
     * Shuts down the key manager.
     * NOTE: Instead of reinitializing the QuantumWrapper, if a shutdown operation exists, we use that.
     */
    static async shutdown() {
        this.initialized = false;
        // Ensure that QuantumWrapper.shutdown exists and is a function.
        if (quantum_wrapper_1.QuantumWrapper.shutdown && typeof quantum_wrapper_1.QuantumWrapper.shutdown === 'function') {
            await quantum_wrapper_1.QuantumWrapper.shutdown();
        }
    }
    /**
     * Convert address to public key hash
     */
    static async addressToHash(address) {
        try {
            // Remove prefix and decode from base58
            const decoded = hash_1.HashUtils.fromBase58(address);
            // Extract the public key hash (remove version byte and checksum)
            const pubKeyHash = Buffer.from(decoded.subarray(1, decoded.length - 4));
            return pubKeyHash.toString('hex');
        }
        catch (error) {
            shared_1.Logger.error('Failed to convert address to hash:', error);
            throw new KeyError('Invalid address format');
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
            shared_1.Logger.error('Failed to get public key hash:', error);
            throw new KeyError('Invalid public key');
        }
    }
}
exports.KeyManager = KeyManager;
KeyManager.MIN_ENTROPY_LENGTH = 32;
KeyManager.DEFAULT_ENTROPY_LENGTH = 64;
KeyManager.initialized = false;
KeyManager.initializationPromise = null;
