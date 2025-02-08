"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dilithium = exports.DilithiumError = void 0;
const _1 = require(".");
const shared_1 = require("@h3tag-blockchain/shared");
const types_1 = require("../native/types");
class DilithiumError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DilithiumError';
    }
}
exports.DilithiumError = DilithiumError;
class Dilithium {
    static async initialize() {
        if (this.initialized)
            return;
        if (this.initPromise) {
            return await this.initPromise;
        }
        this.initPromise = (async () => {
            try {
                await _1.QuantumCrypto.initialize();
                await _1.QuantumCrypto.nativeQuantum.setSecurityLevel(this.DEFAULT_SECURITY_LEVEL);
                this.initialized = true;
                shared_1.Logger.info('Dilithium initialized with security level:', this.DEFAULT_SECURITY_LEVEL);
            }
            catch (error) {
                shared_1.Logger.error('Dilithium initialization failed:', error);
                throw new DilithiumError(`Initialization failed: ${error instanceof Error ? error.message : error}`);
            }
            finally {
                this.initPromise = null;
            }
        })();
        return await this.initPromise;
    }
    static async generateKeyPair(entropy) {
        if (!this.initialized)
            await this.initialize();
        try {
            const keyPair = await _1.QuantumCrypto.generateKeyPair(entropy);
            if (!keyPair?.publicKey || !keyPair?.privateKey) {
                throw new DilithiumError('Failed to generate key pair');
            }
            return {
                publicKey: keyPair.publicKey.toString('base64'),
                privateKey: keyPair.privateKey.toString('base64'),
            };
        }
        catch (error) {
            shared_1.Logger.error('Dilithium key generation failed:', error);
            throw new DilithiumError(error instanceof Error ? error.message : 'Key generation failed');
        }
    }
    static async sign(message, privateKey) {
        if (!this.initialized)
            await this.initialize();
        try {
            if (!message || !privateKey) {
                throw new DilithiumError('Missing message or private key');
            }
            const trimmedPrivateKey = privateKey.trim();
            if (!this.isValidPrivateKey(trimmedPrivateKey)) {
                throw new DilithiumError('Invalid private key format');
            }
            const privateKeyBuffer = Buffer.from(trimmedPrivateKey, 'base64');
            const messageBuffer = Buffer.from(message, 'utf8');
            const signature = await _1.QuantumCrypto.nativeQuantum.dilithiumSign(messageBuffer, privateKeyBuffer);
            if (!(signature instanceof Buffer) || signature.length !== this.SIGNATURE_SIZE) {
                const actualLength = signature instanceof Buffer ? signature.length : 'not a Buffer';
                throw new DilithiumError(`Invalid signature generated. Expected ${this.SIGNATURE_SIZE} bytes but got ${actualLength}.`);
            }
            return signature.toString('base64');
        }
        catch (error) {
            shared_1.Logger.error('Dilithium signing failed:', error);
            throw new DilithiumError(error instanceof Error ? error.message : 'Signing failed');
        }
    }
    static async verify(message, signature, publicKey) {
        if (!this.initialized)
            await this.initialize();
        try {
            if (!message || !signature || !publicKey) {
                throw new DilithiumError('Missing required parameters');
            }
            const trimmedPublicKey = publicKey.trim();
            if (!this.isValidPublicKey(trimmedPublicKey)) {
                throw new DilithiumError('Invalid public key format');
            }
            const messageBuffer = Buffer.from(message, 'utf8');
            const signatureBuffer = Buffer.from(signature, 'base64');
            const publicKeyBuffer = Buffer.from(trimmedPublicKey, 'base64');
            return await _1.QuantumCrypto.nativeQuantum.dilithiumVerify(messageBuffer, signatureBuffer, publicKeyBuffer);
        }
        catch (error) {
            shared_1.Logger.error('Dilithium verification failed:', error);
            throw new DilithiumError(error instanceof Error ? error.message : 'Verification failed');
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
    static async hash(data) {
        if (!this.initialized)
            await this.initialize();
        try {
            return await _1.QuantumCrypto.nativeQuantum.dilithiumHash(data);
        }
        catch (error) {
            shared_1.Logger.error('Dilithium hashing failed:', error);
            throw new DilithiumError(error instanceof Error ? error.message : 'Hashing failed');
        }
    }
    static async shutdown() {
        if (!this.initialized)
            return;
        await _1.QuantumCrypto.shutdown();
        this.initialized = false;
        shared_1.Logger.info('Dilithium shut down');
    }
}
exports.Dilithium = Dilithium;
Dilithium.initialized = false;
Dilithium.initPromise = null;
Dilithium.PUBLIC_KEY_SIZE = 2528;
Dilithium.PRIVATE_KEY_SIZE = 2528;
Dilithium.SIGNATURE_SIZE = 3293;
Dilithium.DEFAULT_SECURITY_LEVEL = types_1.SecurityLevel.HIGH;
