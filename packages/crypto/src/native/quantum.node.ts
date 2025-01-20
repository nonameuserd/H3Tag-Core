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

class QuantumNative {
  public static instance: QuantumNative;
  public native: NativeQuantum;
  public healthCheckInterval: NodeJS.Timeout | undefined;
  public isInitialized = false;

  private constructor() {
    try {
      this.native = bindings('quantum');
      this.initializeHealthChecks();
      this.isInitialized = true;
      Logger.info('Quantum native module initialized');
    } catch (error) {
      Logger.error('Failed to initialize quantum native module:', error);
      throw new QuantumError('Native module initialization failed');
    }
  }

  public static getInstance(): QuantumNative {
    if (!QuantumNative.instance) {
      QuantumNative.instance = new QuantumNative();
    }
    return QuantumNative.instance;
  }

  public initializeHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch((error) => {
        Logger.error('Health check failed:', error);
      });
    }, 60000); // Check every minute
  }

  public async performHealthCheck(): Promise<void> {
    const start = performance.now();
    try {
      // Test key generation and signing
      const keyPair = await this.generateDilithiumKeyPair();
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
    } catch (error) {
      Logger.error('Quantum health check failed:', error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.isInitialized = false;
    Logger.info('Quantum native module shut down');
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
      const result = await this.native.generateDilithiumKeyPair(entropy);
      if (!result?.publicKey || !result?.privateKey) {
        throw new QuantumError('Invalid key pair generated');
      }

      Logger.debug(`Key pair generated in ${performance.now() - start}ms`);
      return result;
    } catch (error) {
      Logger.error('Failed to generate Dilithium key pair:', error);
      throw new QuantumError(
        error instanceof Error ? error.message : 'Key generation failed',
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
