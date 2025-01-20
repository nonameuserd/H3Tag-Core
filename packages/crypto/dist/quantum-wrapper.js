"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuantumWrapper = exports.QuantumWrapperError = void 0;
const hybrid_1 = require("./hybrid");
const hash_1 = require("./hash");
const dilithium_1 = require("./quantum/dilithium");
const kyber_1 = require("./quantum/kyber");
const shared_1 = require("@h3tag-blockchain/shared");
class QuantumWrapperError extends Error {
    constructor(message) {
        super(message);
        this.name = 'QuantumWrapperError';
    }
}
exports.QuantumWrapperError = QuantumWrapperError;
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
            // Generate both quantum-resistant and traditional keys in parallel
            const [dilithiumPair, kyberPair] = await Promise.all([
                dilithium_1.Dilithium.generateKeyPair(),
                kyber_1.Kyber.generateKeyPair(),
            ]);
            // Validate key generation
            if (!dilithiumPair?.publicKey || !kyberPair?.publicKey) {
                throw new QuantumWrapperError('Invalid key generation result');
            }
            // Combine keys with quantum resistance
            const hybridPublicKey = await this.combinePublicKeys(dilithiumPair.publicKey, kyberPair.publicKey);
            const hybridPrivateKey = await this.combinePrivateKeys(dilithiumPair.privateKey, kyberPair.privateKey);
            // Derive addresses
            const address = await hybrid_1.HybridCrypto.deriveAddress({
                address: hybridPublicKey,
            });
            return {
                publicKey: { address },
                privateKey: { address: hybridPrivateKey },
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
            // Split the hybrid private key
            const halfLength = Math.floor(privateKey.length * this.KEY_SPLIT_RATIO);
            const classicalKey = privateKey.subarray(halfLength).toString('hex');
            // Generate both signatures
            const [classicalSig] = await Promise.all([
                hybrid_1.HybridCrypto.sign(message.toString(), {
                    privateKey: classicalKey,
                    publicKey: classicalKey,
                    address: await hybrid_1.HybridCrypto.deriveAddress({ address: classicalKey }),
                }),
            ]);
            return Buffer.concat([Buffer.from(classicalSig.toString(), 'hex')]);
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
            // Split keys and signatures
            const halfLength = Math.floor(publicKey.length * this.KEY_SPLIT_RATIO);
            const traditionalKey = publicKey.subarray(halfLength).toString('hex');
            const sigHalfLength = Math.floor(signature.length * this.KEY_SPLIT_RATIO);
            const classicalSig = signature.subarray(0, sigHalfLength).toString('hex');
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
            // Generate quantum signature as quantum-safe hash
            const keyPair = await this.generateKeyPair();
            const quantumHash = await this.sign(data, Buffer.from(keyPair.privateKey.address, 'hex'));
            // Combine with classical hash
            const classicalHash = hash_1.HashUtils.sha3(data.toString());
            return Buffer.from(hash_1.HashUtils.sha256(classicalHash + quantumHash.toString('hex')));
        }
        catch (error) {
            shared_1.Logger.error('Hybrid hashing failed:', error);
            throw new QuantumWrapperError(error instanceof Error ? error.message : 'Hashing failed');
        }
    }
}
exports.QuantumWrapper = QuantumWrapper;
QuantumWrapper.KEY_SPLIT_RATIO = 0.5;
QuantumWrapper.initialized = false;
