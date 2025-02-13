import { QuantumKeyPair, SecurityLevel } from '../native/types';
import { Logger } from '@h3tag-blockchain/shared';
import nativeQuantum from '../native/quantum.node';
import { performance } from 'perf_hooks';
import { Kyber } from './kyber';

export class QuantumError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuantumError';
  }
}

export class QuantumCrypto {
  public static isModuleInitialized = false;
  public static readonly nativeQuantum = nativeQuantum;
  public static healthCheckInterval: NodeJS.Timeout;

  // New guard variable to avoid overlapping health checks
  private static isHealthCheckRunning = false;

  static async initialize(): Promise<void> {
    try {
      if (this.isModuleInitialized) return;

      // Schedule health checks and only then mark as initialized.
      this.initializeHealthChecks();
      this.isModuleInitialized = true;

      Logger.info('Quantum cryptography module initialized');
    } catch (error) {
      Logger.error('Failed to initialize quantum module:', error);
      throw new QuantumError('Quantum cryptography module initialization failed');
    }
  }

  public static checkInitialization(): void {
    if (!this.isInitialized()) {
      throw new QuantumError('Quantum cryptography module not initialized');
    }
  }

  public static initializeHealthChecks(): void {
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      60000,
    ).unref();
  }

  static async performHealthCheck(): Promise<void> {
    if (this.isHealthCheckRunning) {
      Logger.warn('Skipping health check: previous health check still in progress.');
      return;
    }
    this.isHealthCheckRunning = true;
    try {
      const start = performance.now();

      // Test key generation
      const testKeyPair = await this.generateKeyPair();
      const testMessage = Buffer.from('health_check');
      const testSignature = await this.sign(testMessage, testKeyPair.privateKey);
      const verifyResult = await this.verify(testMessage, testSignature, testKeyPair.publicKey);

      const duration = performance.now() - start;
      Logger.debug(`Quantum health check completed in ${duration}ms`);

      if (!verifyResult) {
        Logger.error('Quantum health check failed: signature verification failed');
        throw new QuantumError('Health check failed');
      }

      Logger.info('Quantum health check passed');
    } catch (error) {
      Logger.error('Quantum health check failed:', error);
    } finally {
      this.isHealthCheckRunning = false;
    }
  }

  static async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.isModuleInitialized = false;
    Logger.info('Quantum cryptography module shut down');

    // Optionally, if nativeQuantum exposes a shutdown or cleanup method, call it here.
    // await this.nativeQuantum.shutdown();
  }

  static isInitialized(): boolean {
    return this.isModuleInitialized;
  }

  static async generateKeyPair(entropy?: Buffer): Promise<QuantumKeyPair> {
    try {
      this.checkInitialization();
      const keyPair = await this.nativeQuantum.generateDilithiumKeyPair(entropy);
      if (!keyPair?.publicKey || !keyPair?.privateKey) {
        throw new QuantumError('Invalid key pair generated');
      }
      return keyPair;
    } catch (error) {
      Logger.error('Failed to generate key pair:', error);
      throw new QuantumError(
        error instanceof Error ? error.message : 'Key generation failed',
      );
    }
  }

  static async sign(message: Buffer, privateKey: Buffer): Promise<Buffer> {
    try {
      this.checkInitialization();

      if (!Buffer.isBuffer(message) || !Buffer.isBuffer(privateKey)) {
        throw new QuantumError('Invalid input parameters');
      }

      const signature = await this.nativeQuantum.dilithiumSign(message, privateKey);

      if (!Buffer.isBuffer(signature)) {
        throw new QuantumError('Invalid signature generated');
      }

      return signature;
    } catch (error) {
      Logger.error('Quantum signing failed:', error);
      throw new QuantumError(
        error instanceof Error ? error.message : 'Signing failed',
      );
    }
  }

  static async verify(
    message: Buffer,
    signature: Buffer,
    publicKey: Buffer,
  ): Promise<boolean> {
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
      Logger.error('Quantum verification failed:', error);
      throw new QuantumError(
        error instanceof Error ? error.message : 'Verification failed',
      );
    }
  }

  static async setSecurityLevel(level: SecurityLevel): Promise<void> {
    try {
      this.checkInitialization();
      await this.nativeQuantum.setSecurityLevel(level);
      Logger.info(`Security level set to: ${level}`);
    } catch (error) {
      Logger.error('Failed to set security level:', error);
      throw new QuantumError('Failed to set security level');
    }
  }

  public static async dilithiumHash(data: Buffer): Promise<Buffer> {
    try {
      this.checkInitialization();
      return await this.nativeQuantum.dilithiumHash(data);
    } catch (error) {
      Logger.error('Dilithium hashing failed:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Hashing failed',
      );
    }
  }

  public static async kyberEncapsulate(
    data: Buffer,
  ): Promise<{ ciphertext: Buffer; sharedSecret: Buffer }> {
    try {
      this.checkInitialization();

      if (!Buffer.isBuffer(data)) {
        throw new QuantumError('Invalid input: data must be a Buffer');
      }

      const keyPair = await Kyber.generateKeyPair();
      const result = await Kyber.encapsulate(keyPair.publicKey);
      return {
        ciphertext: Buffer.from(result.ciphertext, 'base64'),
        sharedSecret: Buffer.from(result.sharedSecret, 'base64'),
      };
    } catch (error) {
      Logger.error('Kyber encapsulation failed:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Encapsulation failed',
      );
    }
  }

  public static async kyberHash(data: Buffer): Promise<Buffer> {
    try {
      this.checkInitialization();
      return Buffer.from(await Kyber.hash(data), 'base64');
    } catch (error) {
      Logger.error('Kyber hashing failed:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Hashing failed',
      );
    }
  }

  public static async nativeHash(data: Buffer): Promise<Buffer> {
    try {
      // Input validation
      if (!Buffer.isBuffer(data)) {
        throw new QuantumError('Invalid input: data must be a Buffer');
      }

      // Check initialization
      this.checkInitialization();

      // Define a timeout (e.g., 5000ms) for the hashing process
      const timeoutMs = 5000;
      const timeoutPromise = new Promise<Buffer[]>((_resolve, reject) =>
        setTimeout(() => reject(new QuantumError('Native hashing timed out')), timeoutMs)
      );

      const hashPromises = Promise.all([
        this.nativeQuantum.dilithiumHash(data).catch((error) => {
          throw new QuantumError(`Dilithium hash failed: ${error.message}`);
        }),
        this.nativeQuantum.kyberHash(data).catch((error) => {
          throw new QuantumError(`Kyber hash failed: ${error.message}`);
        }),
      ]);

      const [dilithiumHash, kyberHash] = await Promise.race([hashPromises, timeoutPromise]);

      // Validate hash outputs
      if (!Buffer.isBuffer(dilithiumHash) || !Buffer.isBuffer(kyberHash)) {
        throw new QuantumError('Invalid hash output from native module');
      }

      return Buffer.concat([dilithiumHash, kyberHash]);
    } catch (error) {
      Logger.error('Native hashing failed:', error);
      throw new QuantumError(
        error instanceof Error ? error.message : 'Hashing failed',
      );
    }
  }
}

export * from './dilithium';
export * from './kyber';
