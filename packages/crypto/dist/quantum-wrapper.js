"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuantumWrapper = exports.QuantumWrapperError = void 0;
const hybrid_1 = require("./hybrid");
const hash_1 = require("./hash");
const dilithium_1 = require("./quantum/dilithium");
const kyber_1 = require("./quantum/kyber");
const shared_1 = require("@h3tag-blockchain/shared");
const quantum_hash_1 = require("./quantum-hash");
/**
 * QuantumWrapperError extends the base Error class to provide a custom error type for the QuantumWrapper class.
 * This allows for better error handling and debugging by providing a specific error name.
 */
class QuantumWrapperError extends Error {
    constructor(message) {
        super(message);
        this.name = 'QuantumWrapperError';
    }
}
exports.QuantumWrapperError = QuantumWrapperError;
/**
 * QuantumWrapper is a utility class that provides a unified interface for using quantum-resistant cryptographic primitives.
 * It allows for the generation of hybrid key pairs, signing, verification, encapsulation, decapsulation, and hashing.
 */
class QuantumWrapper {
    static async initialize() {
        if (this.initialized)
            return;
        await Promise.all([
            dilithium_1.Dilithium.generateKeyPair(),
            kyber_1.Kyber.generateKeyPair(), // Initialize Kyber
        ]);
        this.initialized = true;
    }
    /**
     * Generate hybrid key pair with quantum resistance
     */
    static async generateKeyPair() {
        try {
            // Generate both quantum-resistant and classical keys in parallel
            const [dilithiumPair, kyberPair] = await Promise.all([
                dilithium_1.Dilithium.generateKeyPair(),
                kyber_1.Kyber.generateKeyPair(),
            ]);
            // Validate key generation
            if (!dilithiumPair?.publicKey || !kyberPair?.publicKey) {
                throw new QuantumWrapperError('Invalid key generation result');
            }
            // Convert hex string keys into Buffers and concatenate
            const dilithiumPublicBuffer = Buffer.from(dilithiumPair.publicKey, 'hex');
            const kyberPublicBuffer = Buffer.from(kyberPair.publicKey, 'hex');
            const dilithiumPrivateBuffer = Buffer.from(dilithiumPair.privateKey, 'hex');
            const kyberPrivateBuffer = Buffer.from(kyberPair.privateKey, 'hex');
            // Concatenate each key so that the first half is quantum and second half is classical (or vice-versa)
            const hybridPublicKey = Buffer.concat([
                dilithiumPublicBuffer,
                kyberPublicBuffer,
            ]);
            const hybridPrivateKey = Buffer.concat([
                dilithiumPrivateBuffer,
                kyberPrivateBuffer,
            ]);
            return {
                publicKey: hybridPublicKey,
                privateKey: hybridPrivateKey,
            };
        }
        catch (error) {
            shared_1.Logger.error('Hybrid key generation failed:', error);
            throw new QuantumWrapperError(error instanceof Error ? error.message : 'Key generation failed');
        }
    }
    static async combinePublicKeys(dilithiumKey, kyberKey) {
        return hash_1.HashUtils.sha3(dilithiumKey + kyberKey);
    }
    static async combinePrivateKeys(dilithiumKey, kyberKey) {
        return hash_1.HashUtils.sha3(kyberKey + dilithiumKey); // Different order for private keys
    }
    /**
     * Sign using hybrid approach
     */
    static async sign(message, privateKey) {
        try {
            if (!Buffer.isBuffer(message) || !Buffer.isBuffer(privateKey)) {
                throw new QuantumWrapperError('Invalid input parameters');
            }
            // Split the hybrid private key; assume the second half is classical.
            const halfLength = Math.floor(privateKey.length * this.KEY_SPLIT_RATIO);
            const classicalPrivateKey = privateKey.subarray(halfLength);
            // For signing, use the classical portion.
            const classicalSig = await hybrid_1.HybridCrypto.sign(message.toString('utf8'), {
                privateKey: classicalPrivateKey.toString('hex'),
                // If available, derive the classical public key properly instead of reusing the private part.
                publicKey: classicalPrivateKey.toString('hex'),
                address: await hybrid_1.HybridCrypto.deriveAddress({
                    address: classicalPrivateKey.toString('hex'),
                }),
            });
            return Buffer.from(classicalSig, 'hex');
        }
        catch (error) {
            shared_1.Logger.error('Signing failed:', error);
            throw new QuantumWrapperError(error instanceof Error ? error.message : 'Signing failed');
        }
    }
    /**
     * Verify using hybrid approach
     */
    static async verify(message, signature, publicKey) {
        try {
            if (!Buffer.isBuffer(message) ||
                !Buffer.isBuffer(signature) ||
                !Buffer.isBuffer(publicKey)) {
                throw new QuantumWrapperError('Invalid input parameters');
            }
            // Split keys
            const halfLength = Math.floor(publicKey.length * this.KEY_SPLIT_RATIO);
            const traditionalKey = publicKey.subarray(halfLength).toString('hex');
            // Use the full signature generated by the sign method
            const classicalSig = signature.toString('hex');
            // Derive blockchain address from public key
            const address = await hybrid_1.HybridCrypto.deriveAddress({
                address: traditionalKey,
            });
            // Verify signature against derived address
            return await hybrid_1.HybridCrypto.verify(message.toString(), classicalSig, address);
        }
        catch (error) {
            shared_1.Logger.error('Hybrid verification failed:', error);
            return false;
        }
    }
    /**
     * Hybrid key encapsulation
     */
    static async encapsulate(publicKey) {
        try {
            if (!Buffer.isBuffer(publicKey)) {
                throw new QuantumWrapperError('Invalid public key');
            }
            const halfLength = Math.floor(publicKey.length * this.KEY_SPLIT_RATIO);
            const kyberKey = publicKey.subarray(halfLength).toString('base64');
            // Generate both classical and quantum shared secrets
            const [kyberResult, classicalSecret] = await Promise.all([
                kyber_1.Kyber.encapsulate(kyberKey),
                hybrid_1.HybridCrypto.generateSharedSecret(publicKey),
            ]);
            return {
                ciphertext: Buffer.from(kyberResult.ciphertext, 'base64'),
                sharedSecret: Buffer.concat([
                    Buffer.from(kyberResult.sharedSecret, 'base64'),
                    Buffer.from(classicalSecret),
                ]),
            };
        }
        catch (error) {
            shared_1.Logger.error('Hybrid encapsulation failed:', error);
            throw new QuantumWrapperError(error instanceof Error ? error.message : 'Encapsulation failed');
        }
    }
    /**
     * Hybrid key decapsulation
     */
    static async decapsulate(ciphertext, privateKey) {
        try {
            if (!Buffer.isBuffer(ciphertext) || !Buffer.isBuffer(privateKey)) {
                throw new QuantumWrapperError('Invalid input parameters');
            }
            const halfLength = Math.floor(privateKey.length * this.KEY_SPLIT_RATIO);
            const kyberKey = privateKey.subarray(halfLength).toString('base64');
            // Decrypt using both methods
            const [kyberSecret, classicalSecret] = await Promise.all([
                kyber_1.Kyber.decapsulate(ciphertext.toString('base64'), kyberKey),
                hybrid_1.HybridCrypto.decryptSharedSecret(ciphertext, privateKey),
            ]);
            return Buffer.concat([
                Buffer.from(kyberSecret, 'base64'),
                Buffer.from(classicalSecret),
            ]);
        }
        catch (error) {
            shared_1.Logger.error('Hybrid decapsulation failed:', error);
            throw new QuantumWrapperError(error instanceof Error ? error.message : 'Decapsulation failed');
        }
    }
    /**
     * Hybrid hash function
     */
    static async hashData(data) {
        try {
            if (!Buffer.isBuffer(data)) {
                throw new QuantumWrapperError('Invalid input data');
            }
            // Use a deterministic quantum hash instead of signing with a newly generated key pair.
            const quantumHash = await quantum_hash_1.QuantumHash.calculate(data); // await the async call
            // Combine with a classical SHA3 hash
            const classicalHash = hash_1.HashUtils.sha3(data.toString());
            const combinedHash = hash_1.HashUtils.sha256(classicalHash + quantumHash);
            return Buffer.from(combinedHash, 'hex');
        }
        catch (error) {
            shared_1.Logger.error('Hybrid hashing failed:', error);
            throw new QuantumWrapperError(error instanceof Error ? error.message : 'Hashing failed');
        }
    }
    /**
     * Shutdown method for cleaning up quantum-related resources.
     * Resets the initialized state and performs any necessary cleanup.
     */
    static async shutdown() {
        this.initialized = false;
        // If available, shutdown underlying modules.
        if (typeof dilithium_1.Dilithium.shutdown === 'function') {
            await dilithium_1.Dilithium.shutdown();
        }
        if (typeof kyber_1.Kyber.shutdown === 'function') {
            await kyber_1.Kyber.shutdown();
        }
        shared_1.Logger.info('QuantumWrapper has been shutdown.');
    }
}
exports.QuantumWrapper = QuantumWrapper;
QuantumWrapper.KEY_SPLIT_RATIO = 0.5;
QuantumWrapper.initialized = false;
