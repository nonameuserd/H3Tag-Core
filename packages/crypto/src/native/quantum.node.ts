import {
  NativeQuantum,
  QuantumKeyPair,
  KyberEncapsulation,
  SecurityLevel,
} from './types';
import { performance } from 'perf_hooks';
import bindings from 'bindings';
import { Logger } from '@h3tag-blockchain/shared';

class QuantumError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuantumError';
  }
}

export class QuantumNative {
  public static instance: QuantumNative;
  public native: NativeQuantum;
  public healthCheckInterval: NodeJS.Timeout | undefined;
  public isInitialized = false;
  public HEALTH_CHECK_INTERVAL = 60000; // 1 minute in ms
  public healthCheckFailures = 0;

  private constructor() {
    try {
      this.native = bindings('../../src/native/quantum.node');
      this.initializeHealthChecks();
      this.isInitialized = true;
      Logger.info('Quantum native module initialized');
    } catch (error) {
      Logger.error('Failed to initialize quantum native module:', error);
      throw new QuantumError('Native module initialization failed');
    }
  }

  public clearHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      Logger.debug('Health checks cleared');
    }
  }

  public static getInstance(): QuantumNative {
    if (!QuantumNative.instance) {
      QuantumNative.instance = new QuantumNative();
    }
    return QuantumNative.instance;
  }

  public initializeHealthChecks(): void {
    try {
      // Clear any existing interval
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Set new interval
      this.healthCheckInterval = setInterval(async () => {
        try {
          await this.performHealthCheck();
        } catch (error) {
          Logger.error('Health check failed:', error);
          // Clear interval on critical failures
          this.shutdown().catch((err) =>
            Logger.error('Failed to shutdown after health check error:', err),
          );
        }
      }, this.HEALTH_CHECK_INTERVAL);

      // Unref the interval so that it does not keep the Node.js event loop alive
      if (this.healthCheckInterval && typeof this.healthCheckInterval.unref === 'function') {
        this.healthCheckInterval.unref();
      }

      Logger.debug('Health checks initialized');
    } catch (error) {
      Logger.error('Failed to initialize health checks:', error);
      throw new QuantumError('Health check initialization failed');
    }
  }

  public async performHealthCheck(): Promise<void> {
    const start = performance.now();
    try {
      const keyPair = await this.generateDilithiumKeyPair();
      Logger.debug('Generated key pair for health check');
      const testMessage = Buffer.from('health_check');
      const signature = await this.dilithiumSign(
        testMessage,
        keyPair.privateKey,
      );
      const isValid = await this.dilithiumVerify(
        testMessage,
        signature,
        keyPair.publicKey,
      );

      if (!isValid) {
        throw new QuantumError(
          'Signature verification failed during health check',
        );
      }

      const duration = performance.now() - start;
      Logger.debug(`Quantum health check completed in ${duration}ms`);

      // Reset failure counter on success
      this.healthCheckFailures = 0;
    } catch (error) {
      this.healthCheckFailures++;
      Logger.error('Quantum health check failed:', error);
      // Shutdown only after 3 consecutive failures
      if (this.healthCheckFailures >= 3) {
        this.clearHealthChecks();
        await this.shutdown();
        throw error;
      }
      // Otherwise, continue and wait for the next interval (transient error)
    }
  }

  public async shutdown(): Promise<void> {
    try {
      this.clearHealthChecks();
      this.isInitialized = false;
      Logger.info('Quantum native module shut down');
    } catch (error) {
      Logger.error('Failed to shutdown quantum native module:', error);
      throw new QuantumError('Shutdown failed');
    }
  }

  public checkInitialization(): void {
    if (!this.isInitialized) {
      throw new QuantumError('Quantum native module not initialized');
    }
  }

  // Core cryptographic operations with error handling and logging
  public async generateDilithiumKeyPair(
    entropy?: Buffer,
  ): Promise<QuantumKeyPair> {
    this.checkInitialization();
    const start = performance.now();

    try {
      // Validate entropy using Buffer.isBuffer for reliability
      if (entropy && !Buffer.isBuffer(entropy)) {
        throw new QuantumError('Entropy must be a Buffer');
      }

      // Call native implementation with entropy if provided
      const result = entropy
        ? await this.native.generateDilithiumPair(entropy)
        : await this.native.generateDilithiumPair();

      // Validate response
      if (
        !Buffer.isBuffer(result?.publicKey) ||
        !Buffer.isBuffer(result?.privateKey)
      ) {
        throw new QuantumError('Invalid key pair generated');
      }

      const keyPair: QuantumKeyPair = {
        publicKey: result.publicKey,
        privateKey: result.privateKey,
      };

      Logger.debug(
        `Dilithium key pair generated in ${performance.now() - start}ms`,
      );
      return keyPair;
    } catch (error) {
      Logger.error('Failed to generate Dilithium key pair:', error);
      this.clearHealthChecks();
      throw new QuantumError(
        error instanceof Error
          ? error.message
          : 'Dilithium key generation failed',
      );
    }
  }

  public async kyberGenerateKeyPair(): Promise<QuantumKeyPair> {
    this.checkInitialization();
    const start = performance.now();

    try {
      const result = await this.native.kyberGenerateKeyPair();
      if (!result?.publicKey || !result?.privateKey) {
        throw new QuantumError('Invalid Kyber key pair generated');
      }
      Logger.debug(
        `Kyber key pair generated in ${performance.now() - start}ms`,
      );
      return result;
    } catch (error) {
      Logger.error('Failed to generate Kyber key pair:', error);
      this.clearHealthChecks();
      throw new QuantumError(
        error instanceof Error ? error.message : 'Kyber key generation failed',
      );
    }
  } 

  public async dilithiumSign(
    message: Buffer,
    privateKey: Buffer,
  ): Promise<Buffer> {
    this.checkInitialization();
    try {
      return await this.native.dilithiumSign(message, privateKey);
    } catch (error) {
      Logger.error('Signing failed:', error);
      throw new QuantumError(
        error instanceof Error ? error.message : 'Signing failed',
      );
    }
  }

  public async dilithiumVerify(
    message: Buffer,
    signature: Buffer,
    publicKey: Buffer,
  ): Promise<boolean> {
    this.checkInitialization();
    try {
      return await this.native.dilithiumVerify(message, signature, publicKey);
    } catch (error) {
      Logger.error('Verification failed:', error);
      throw new QuantumError(
        error instanceof Error ? error.message : 'Verification failed',
      );
    }
  }

  public async kyberEncapsulate(
    publicKey: Buffer,
  ): Promise<KyberEncapsulation> {
    this.checkInitialization();
    try {
      const result = await this.native.kyberEncapsulate(publicKey);
      if (!result?.ciphertext || !result?.sharedSecret) {
        throw new QuantumError('Invalid encapsulation result');
      }
      return result;
    } catch (error) {
      Logger.error('Encapsulation failed:', error);
      throw new QuantumError(
        error instanceof Error ? error.message : 'Encapsulation failed',
      );
    }
  }

  public async kyberDecapsulate(
    ciphertext: Buffer,
    privateKey: Buffer,
  ): Promise<Buffer> {
    this.checkInitialization();
    try {
      return await this.native.kyberDecapsulate(ciphertext, privateKey);
    } catch (error) {
      Logger.error('Decapsulation failed:', error);
      throw new QuantumError(
        error instanceof Error ? error.message : 'Decapsulation failed',
      );
    }
  }

  public async dilithiumHash(data: Buffer): Promise<Buffer> {
    this.checkInitialization();
    try {
      return await this.native.dilithiumHash(data);
    } catch (error) {
      Logger.error('Hashing failed:', error);
      throw new QuantumError(
        error instanceof Error ? error.message : 'Hashing failed',
      );
    }
  }

  public async kyberHash(data: Buffer): Promise<Buffer> {
    this.checkInitialization();
    try {
      return await this.native.kyberHash(data);
    } catch (error) {
      Logger.error('Kyber hashing failed:', error);
      throw new QuantumError(
        error instanceof Error ? error.message : 'Kyber hashing failed',
      );
    }
  }

  public async setSecurityLevel(level: SecurityLevel): Promise<void> {
    this.checkInitialization();
    try {
      await this.native.setSecurityLevel(level);
    } catch (error) {
      Logger.error('Failed to set security level:', error);
      throw new QuantumError('Failed to set security level');
    }
  }
}

// Export singleton instance
export const nativeQuantum = QuantumNative.getInstance();
export default nativeQuantum;
