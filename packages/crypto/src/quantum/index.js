'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __exportStar =
  (this && this.__exportStar) ||
  function (m, exports) {
    for (var p in m)
      if (p !== 'default' && !Object.prototype.hasOwnProperty.call(exports, p))
        __createBinding(exports, m, p);
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.QuantumCrypto = exports.QuantumError = void 0;
const shared_1 = require('@h3tag-blockchain/shared');
const quantum_node_1 = __importDefault(require('../native/quantum.node'));
const perf_hooks_1 = require('perf_hooks');
const kyber_1 = require('./kyber');
class QuantumError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QuantumError';
  }
}
exports.QuantumError = QuantumError;
class QuantumCrypto {
  static async initialize() {
    try {
      if (this.isModuleInitialized) return;
      this.isModuleInitialized = true;
      this.initializeHealthChecks();
      shared_1.Logger.info('Quantum cryptography module initialized');
    } catch (error) {
      shared_1.Logger.error('Failed to initialize quantum module:', error);
      throw new QuantumError(
        'Quantum cryptography module initialization failed',
      );
    }
  }
  static checkInitialization() {
    if (!this.isInitialized()) {
      throw new QuantumError('Quantum cryptography module not initialized');
    }
  }
  static initializeHealthChecks() {
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      60000,
    );
  }
  static async performHealthCheck() {
    try {
      const start = perf_hooks_1.performance.now();
      // Test key generation
      const testKeyPair = await this.generateKeyPair();
      const testMessage = Buffer.from('health_check');
      const testSignature = await this.sign(
        testMessage,
        testKeyPair.privateKey,
      );
      const verifyResult = await this.verify(
        testMessage,
        testSignature,
        testKeyPair.publicKey,
      );
      const duration = perf_hooks_1.performance.now() - start;
      shared_1.Logger.debug(`Quantum health check completed in ${duration}ms`);
      if (!verifyResult) {
        shared_1.Logger.error(
          'Quantum health check failed: signature verification failed',
        );
        throw new QuantumError('Health check failed');
      }
      shared_1.Logger.info('Quantum health check passed');
    } catch (error) {
      shared_1.Logger.error('Quantum health check failed:', error);
    }
  }
  static async shutdown() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.isModuleInitialized = false;
    shared_1.Logger.info('Quantum cryptography module shut down');
  }
  static isInitialized() {
    return this.isModuleInitialized;
  }
  static async generateKeyPair(entropy) {
    try {
      this.checkInitialization();
      const keyPair =
        await this.nativeQuantum.generateDilithiumKeyPair(entropy);
      if (!keyPair?.publicKey || !keyPair?.privateKey) {
        throw new QuantumError('Invalid key pair generated');
      }
      return keyPair;
    } catch (error) {
      shared_1.Logger.error('Failed to generate key pair:', error);
      throw new QuantumError(
        error instanceof Error ? error.message : 'Key generation failed',
      );
    }
  }
  static async sign(message, privateKey) {
    try {
      this.checkInitialization();
      if (!Buffer.isBuffer(message) || !Buffer.isBuffer(privateKey)) {
        throw new QuantumError('Invalid input parameters');
      }
      const signature = await this.nativeQuantum.dilithiumSign(
        message,
        privateKey,
      );
      if (!Buffer.isBuffer(signature)) {
        throw new QuantumError('Invalid signature generated');
      }
      return signature;
    } catch (error) {
      shared_1.Logger.error('Quantum signing failed:', error);
      throw new QuantumError(
        error instanceof Error ? error.message : 'Signing failed',
      );
    }
  }
  static async verify(message, signature, publicKey) {
    try {
      this.checkInitialization();
      if (
        !Buffer.isBuffer(message) ||
        !Buffer.isBuffer(signature) ||
        !Buffer.isBuffer(publicKey)
      ) {
        throw new QuantumError('Invalid input parameters');
      }
      return await this.nativeQuantum.dilithiumVerify(
        message,
        signature,
        publicKey,
      );
    } catch (error) {
      shared_1.Logger.error('Quantum verification failed:', error);
      throw new QuantumError(
        error instanceof Error ? error.message : 'Verification failed',
      );
    }
  }
  static async setSecurityLevel(level) {
    try {
      this.checkInitialization();
      await this.nativeQuantum.setSecurityLevel(level);
      shared_1.Logger.info('Security level set to:', level);
    } catch (error) {
      shared_1.Logger.error('Failed to set security level:', error);
      throw new QuantumError('Failed to set security level');
    }
  }
  static async dilithiumHash(data) {
    try {
      return await this.nativeQuantum.dilithiumHash(data);
    } catch (error) {
      shared_1.Logger.error('Dilithium hashing failed:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Hashing failed',
      );
    }
  }
  static async kyberEncapsulate(data) {
    try {
      const keyPair = await kyber_1.Kyber.generateKeyPair();
      const result = await kyber_1.Kyber.encapsulate(keyPair.publicKey);
      return {
        ciphertext: Buffer.from(result.ciphertext, 'base64'),
        sharedSecret: Buffer.from(result.sharedSecret, 'base64'),
      };
    } catch (error) {
      shared_1.Logger.error('Kyber encapsulation failed:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Encapsulation failed',
      );
    }
  }
  static async kyberHash(data) {
    try {
      return await kyber_1.Kyber.hash(data);
    } catch (error) {
      shared_1.Logger.error('Kyber hashing failed:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Hashing failed',
      );
    }
  }
  static async nativeHash(data) {
    try {
      // Input validation
      if (!Buffer.isBuffer(data)) {
        throw new QuantumError('Invalid input: data must be a Buffer');
      }
      // Check initialization
      this.checkInitialization();
      // Generate hashes in parallel with timeout
      const [dilithiumHash, kyberHash] = await Promise.all([
        this.nativeQuantum.dilithiumHash(data).catch((error) => {
          throw new QuantumError(`Dilithium hash failed: ${error.message}`);
        }),
        this.nativeQuantum.kyberHash(data).catch((error) => {
          throw new QuantumError(`Kyber hash failed: ${error.message}`);
        }),
      ]);
      // Validate hash outputs
      if (!Buffer.isBuffer(dilithiumHash) || !Buffer.isBuffer(kyberHash)) {
        throw new QuantumError('Invalid hash output from native module');
      }
      return Buffer.concat([dilithiumHash, kyberHash]);
    } catch (error) {
      shared_1.Logger.error('Native hashing failed:', error);
      throw new QuantumError(
        error instanceof Error ? error.message : 'Hashing failed',
      );
    }
  }
}
exports.QuantumCrypto = QuantumCrypto;
QuantumCrypto.isModuleInitialized = false;
QuantumCrypto.nativeQuantum = quantum_node_1.default;
__exportStar(require('./dilithium'), exports);
__exportStar(require('./kyber'), exports);
//# sourceMappingURL=index.js.map
