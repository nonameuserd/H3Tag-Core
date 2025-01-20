"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nativeQuantum = void 0;
const perf_hooks_1 = require("perf_hooks");
const bindings_1 = __importDefault(require("bindings"));
const shared_1 = require("@h3tag-blockchain/shared");
class QuantumError extends Error {
    constructor(message) {
        super(message);
        this.name = 'QuantumError';
    }
}
class QuantumNative {
    constructor() {
        this.isInitialized = false;
        try {
            this.native = (0, bindings_1.default)('quantum');
            this.initializeHealthChecks();
            this.isInitialized = true;
            shared_1.Logger.info('Quantum native module initialized');
        }
        catch (error) {
            shared_1.Logger.error('Failed to initialize quantum native module:', error);
            throw new QuantumError('Native module initialization failed');
        }
    }
    static getInstance() {
        if (!QuantumNative.instance) {
            QuantumNative.instance = new QuantumNative();
        }
        return QuantumNative.instance;
    }
    initializeHealthChecks() {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck().catch((error) => {
                shared_1.Logger.error('Health check failed:', error);
            });
        }, 60000); // Check every minute
    }
    async performHealthCheck() {
        const start = perf_hooks_1.performance.now();
        try {
            // Test key generation and signing
            const keyPair = await this.generateDilithiumKeyPair();
            const testMessage = Buffer.from('health_check');
            const signature = await this.dilithiumSign(testMessage, keyPair.privateKey);
            const isValid = await this.dilithiumVerify(testMessage, signature, keyPair.publicKey);
            if (!isValid) {
                throw new QuantumError('Signature verification failed during health check');
            }
            const duration = perf_hooks_1.performance.now() - start;
            shared_1.Logger.debug(`Quantum health check completed in ${duration}ms`);
        }
        catch (error) {
            shared_1.Logger.error('Quantum health check failed:', error);
            throw error;
        }
    }
    async shutdown() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        this.isInitialized = false;
        shared_1.Logger.info('Quantum native module shut down');
    }
    checkInitialization() {
        if (!this.isInitialized) {
            throw new QuantumError('Quantum native module not initialized');
        }
    }
    // Core cryptographic operations with error handling and logging
    async generateDilithiumKeyPair(entropy) {
        this.checkInitialization();
        const start = perf_hooks_1.performance.now();
        try {
            const result = await this.native.generateDilithiumKeyPair(entropy);
            if (!result?.publicKey || !result?.privateKey) {
                throw new QuantumError('Invalid key pair generated');
            }
            shared_1.Logger.debug(`Key pair generated in ${perf_hooks_1.performance.now() - start}ms`);
            return result;
        }
        catch (error) {
            shared_1.Logger.error('Failed to generate Dilithium key pair:', error);
            throw new QuantumError(error instanceof Error ? error.message : 'Key generation failed');
        }
    }
    async kyberGenerateKeyPair() {
        this.checkInitialization();
        const start = perf_hooks_1.performance.now();
        try {
            const result = await this.native.kyberGenerateKeyPair();
            if (!result?.publicKey || !result?.privateKey) {
                throw new QuantumError('Invalid Kyber key pair generated');
            }
            shared_1.Logger.debug(`Kyber key pair generated in ${perf_hooks_1.performance.now() - start}ms`);
            return result;
        }
        catch (error) {
            shared_1.Logger.error('Failed to generate Kyber key pair:', error);
            throw new QuantumError(error instanceof Error ? error.message : 'Kyber key generation failed');
        }
    }
    async dilithiumSign(message, privateKey) {
        this.checkInitialization();
        try {
            return await this.native.dilithiumSign(message, privateKey);
        }
        catch (error) {
            shared_1.Logger.error('Signing failed:', error);
            throw new QuantumError(error instanceof Error ? error.message : 'Signing failed');
        }
    }
    async dilithiumVerify(message, signature, publicKey) {
        this.checkInitialization();
        try {
            return await this.native.dilithiumVerify(message, signature, publicKey);
        }
        catch (error) {
            shared_1.Logger.error('Verification failed:', error);
            throw new QuantumError(error instanceof Error ? error.message : 'Verification failed');
        }
    }
    async kyberEncapsulate(publicKey) {
        this.checkInitialization();
        try {
            const result = await this.native.kyberEncapsulate(publicKey);
            if (!result?.ciphertext || !result?.sharedSecret) {
                throw new QuantumError('Invalid encapsulation result');
            }
            return result;
        }
        catch (error) {
            shared_1.Logger.error('Encapsulation failed:', error);
            throw new QuantumError(error instanceof Error ? error.message : 'Encapsulation failed');
        }
    }
    async kyberDecapsulate(ciphertext, privateKey) {
        this.checkInitialization();
        try {
            return await this.native.kyberDecapsulate(ciphertext, privateKey);
        }
        catch (error) {
            shared_1.Logger.error('Decapsulation failed:', error);
            throw new QuantumError(error instanceof Error ? error.message : 'Decapsulation failed');
        }
    }
    async dilithiumHash(data) {
        this.checkInitialization();
        try {
            return await this.native.dilithiumHash(data);
        }
        catch (error) {
            shared_1.Logger.error('Hashing failed:', error);
            throw new QuantumError(error instanceof Error ? error.message : 'Hashing failed');
        }
    }
    async kyberHash(data) {
        this.checkInitialization();
        try {
            return await this.native.kyberHash(data);
        }
        catch (error) {
            shared_1.Logger.error('Kyber hashing failed:', error);
            throw new QuantumError(error instanceof Error ? error.message : 'Kyber hashing failed');
        }
    }
    async setSecurityLevel(level) {
        this.checkInitialization();
        try {
            await this.native.setSecurityLevel(level);
        }
        catch (error) {
            shared_1.Logger.error('Failed to set security level:', error);
            throw new QuantumError('Failed to set security level');
        }
    }
}
// Export singleton instance
exports.nativeQuantum = QuantumNative.getInstance();
exports.default = exports.nativeQuantum;
