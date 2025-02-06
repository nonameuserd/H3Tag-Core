"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Kyber = exports.KyberError = void 0;
const _1 = require(".");
const shared_1 = require("@h3tag-blockchain/shared");
const types_1 = require("../native/types");
class KyberError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = 'KyberError';
        this.cause = cause;
    }
}
exports.KyberError = KyberError;
class Kyber {
    static async initialize() {
        if (this.isInitialized)
            return;
        if (this.initializationPromise !== null) {
            return this.initializationPromise;
        }
        this.initializationPromise = (async () => {
            try {
                await _1.QuantumCrypto.initialize();
                await _1.QuantumCrypto.setSecurityLevel(this.DEFAULT_SECURITY_LEVEL);
                this.isInitialized = true;
                shared_1.Logger.info('Kyber initialized with security level:', this.DEFAULT_SECURITY_LEVEL);
            }
            catch (error) {
                shared_1.Logger.error('Kyber initialization failed:', error);
                throw new KyberError('Initialization failed', error instanceof Error ? error : undefined);
            }
            finally {
                this.initializationPromise = null;
            }
        })();
        return this.initializationPromise;
    }
    static async generateKeyPair() {
        if (!this.isInitialized)
            await this.initialize();
        try {
            const keyPair = await _1.QuantumCrypto.nativeQuantum.kyberGenerateKeyPair();
            if (!keyPair?.publicKey || !keyPair?.privateKey) {
                throw new KyberError('Failed to generate key pair');
            }
            if (keyPair.publicKey.length !== this.PUBLIC_KEY_SIZE) {
                throw new KyberError(`Invalid public key size: ${keyPair.publicKey.length}`);
            }
            if (keyPair.privateKey.length !== this.PRIVATE_KEY_SIZE) {
                throw new KyberError(`Invalid private key size: ${keyPair.privateKey.length}`);
            }
            return {
                publicKey: keyPair.publicKey.toString('base64'),
                privateKey: keyPair.privateKey.toString('base64'),
            };
        }
        catch (error) {
            shared_1.Logger.error('Kyber key generation failed:', error);
            throw new KyberError(error instanceof Error ? error.message : 'Key generation failed', error instanceof Error ? error : undefined);
        }
    }
    static async encapsulate(publicKey) {
        if (!this.isInitialized)
            await this.initialize();
        try {
            if (!publicKey) {
                throw new KyberError('Missing public key');
            }
            if (!this.isValidBase64(publicKey)) {
                throw new KyberError('Invalid public key: not a valid Base64 string');
            }
            const publicKeyBuffer = Buffer.from(publicKey, 'base64');
            if (publicKeyBuffer.length !== this.PUBLIC_KEY_SIZE) {
                throw new KyberError('Invalid public key size');
            }
            const result = await _1.QuantumCrypto.nativeQuantum.kyberEncapsulate(publicKeyBuffer);
            if (!result?.ciphertext ||
                result.ciphertext.length !== this.CIPHERTEXT_SIZE) {
                throw new KyberError('Invalid ciphertext generated');
            }
            if (!result?.sharedSecret ||
                result.sharedSecret.length !== this.SHARED_SECRET_SIZE) {
                throw new KyberError('Invalid shared secret generated');
            }
            return {
                ciphertext: result.ciphertext.toString('base64'),
                sharedSecret: result.sharedSecret.toString('base64'),
            };
        }
        catch (error) {
            shared_1.Logger.error('Kyber encapsulation failed:', error);
            throw new KyberError(error instanceof Error ? error.message : 'Encapsulation failed', error instanceof Error ? error : undefined);
        }
    }
    static async decapsulate(ciphertext, privateKey) {
        if (!this.isInitialized)
            await this.initialize();
        try {
            if (!ciphertext || !privateKey) {
                throw new KyberError('Missing required parameters');
            }
            if (!this.isValidBase64(ciphertext)) {
                throw new KyberError('Invalid ciphertext: not a valid Base64 string');
            }
            if (!this.isValidBase64(privateKey)) {
                throw new KyberError('Invalid private key: not a valid Base64 string');
            }
            const ciphertextBuffer = Buffer.from(ciphertext, 'base64');
            const privateKeyBuffer = Buffer.from(privateKey, 'base64');
            if (ciphertextBuffer.length !== this.CIPHERTEXT_SIZE) {
                throw new KyberError('Invalid ciphertext size');
            }
            if (privateKeyBuffer.length !== this.PRIVATE_KEY_SIZE) {
                throw new KyberError('Invalid private key size');
            }
            const sharedSecret = await _1.QuantumCrypto.nativeQuantum.kyberDecapsulate(ciphertextBuffer, privateKeyBuffer);
            if (sharedSecret.length !== this.SHARED_SECRET_SIZE) {
                throw new KyberError('Invalid shared secret size');
            }
            return sharedSecret.toString('base64');
        }
        catch (error) {
            shared_1.Logger.error('Kyber decapsulation failed:', error);
            throw new KyberError(error instanceof Error ? error.message : 'Decapsulation failed', error instanceof Error ? error : undefined);
        }
    }
    static isValidPublicKey(publicKey) {
        try {
            const buffer = Buffer.from(publicKey, 'base64');
            return buffer.length === this.PUBLIC_KEY_SIZE;
        }
        catch {
            return false;
        }
    }
    static isValidPrivateKey(privateKey) {
        try {
            const buffer = Buffer.from(privateKey, 'base64');
            return buffer.length === this.PRIVATE_KEY_SIZE;
        }
        catch {
            return false;
        }
    }
    static isValidCiphertext(ciphertext) {
        try {
            const buffer = Buffer.from(ciphertext, 'base64');
            return buffer.length === this.CIPHERTEXT_SIZE;
        }
        catch {
            return false;
        }
    }
    static async shutdown() {
        if (!this.isInitialized)
            return;
        try {
            if (_1.QuantumCrypto.nativeQuantum.shutdown) {
                await _1.QuantumCrypto.nativeQuantum.shutdown();
            }
        }
        catch (error) {
            shared_1.Logger.error('Kyber native shutdown failed:', error);
        }
        this.isInitialized = false;
        shared_1.Logger.info('Kyber shut down');
    }
    static async hash(data) {
        if (!this.isInitialized)
            await this.initialize();
        try {
            const hashBuffer = await _1.QuantumCrypto.nativeQuantum.kyberHash(data);
            return hashBuffer.toString('base64');
        }
        catch (error) {
            shared_1.Logger.error('Kyber hashing failed:', error);
            throw new KyberError(error instanceof Error ? error.message : 'Hashing failed', error instanceof Error ? error : undefined);
        }
    }
    static isValidBase64(str) {
        const base64regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
        return base64regex.test(str);
    }
}
exports.Kyber = Kyber;
Kyber.isInitialized = false;
Kyber.PUBLIC_KEY_SIZE = 1184; // Kyber768 parameters
Kyber.PRIVATE_KEY_SIZE = 2400;
Kyber.CIPHERTEXT_SIZE = 1088;
Kyber.SHARED_SECRET_SIZE = 32;
Kyber.DEFAULT_SECURITY_LEVEL = types_1.SecurityLevel.HIGH;
Kyber.initializationPromise = null;
