import { QuantumCrypto } from '.';
import { Logger } from '@h3tag-blockchain/shared';
import { SecurityLevel } from '../native/types';

export class DilithiumError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DilithiumError';
  }
}

export interface DilithiumKeyPair {
  publicKey: string;
  privateKey: string;
}

export class Dilithium {
  private static initialized = false;
  private static initPromise: Promise<void> | null = null;
  private static readonly PUBLIC_KEY_SIZE = 2528;
  private static readonly PRIVATE_KEY_SIZE = 2528;
  private static readonly SIGNATURE_SIZE = 3293;
  private static readonly DEFAULT_SECURITY_LEVEL = SecurityLevel.HIGH;

  public static async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) {
      return await this.initPromise;
    }
    this.initPromise = (async () => {
      try {
        await QuantumCrypto.initialize();
        await QuantumCrypto.nativeQuantum.setSecurityLevel(
          this.DEFAULT_SECURITY_LEVEL,
        );
        this.initialized = true;
        Logger.info(
          'Dilithium initialized with security level:',
          this.DEFAULT_SECURITY_LEVEL,
        );
      } catch (error) {
        Logger.error('Dilithium initialization failed:', error);
        throw new DilithiumError(
          `Initialization failed: ${error instanceof Error ? error.message : error}`
        );
      } finally {
        this.initPromise = null;
      }
    })();
    return await this.initPromise;
  }

  static async generateKeyPair(entropy?: Buffer): Promise<DilithiumKeyPair> {
    if (!this.initialized) await this.initialize();

    try {
      const keyPair = await QuantumCrypto.generateKeyPair(entropy);
      if (!keyPair?.publicKey || !keyPair?.privateKey) {
        throw new DilithiumError('Failed to generate key pair');
      }

      return {
        publicKey: keyPair.publicKey.toString('base64'),
        privateKey: keyPair.privateKey.toString('base64'),
      };
    } catch (error) {
      Logger.error('Dilithium key generation failed:', error);
      throw new DilithiumError(
        error instanceof Error ? error.message : 'Key generation failed',
      );
    }
  }

  static async sign(message: string, privateKey: string): Promise<string> {
    if (!this.initialized) await this.initialize();

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

      const signature = await QuantumCrypto.nativeQuantum.dilithiumSign(
        messageBuffer,
        privateKeyBuffer,
      );

      if (!(signature instanceof Buffer) || signature.length !== this.SIGNATURE_SIZE) {
        const actualLength = signature instanceof Buffer ? signature.length : 'not a Buffer';
        throw new DilithiumError(`Invalid signature generated. Expected ${this.SIGNATURE_SIZE} bytes but got ${actualLength}.`);
      }

      return signature.toString('base64');
    } catch (error) {
      Logger.error('Dilithium signing failed:', error);
      throw new DilithiumError(
        error instanceof Error ? error.message : 'Signing failed',
      );
    }
  }

  static async verify(
    message: string,
    signature: string,
    publicKey: string,
  ): Promise<boolean> {
    if (!this.initialized) await this.initialize();

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

      return await QuantumCrypto.nativeQuantum.dilithiumVerify(
        messageBuffer,
        signatureBuffer,
        publicKeyBuffer,
      );
    } catch (error) {
      Logger.error('Dilithium verification failed:', error);
      throw new DilithiumError(
        error instanceof Error ? error.message : 'Verification failed',
      );
    }
  }

  static isValidPublicKey(publicKey: string): boolean {
    try {
      const buffer = Buffer.from(publicKey, 'base64');
      return buffer.length === this.PUBLIC_KEY_SIZE;
    } catch {
      return false;
    }
  }

  static isValidPrivateKey(privateKey: string): boolean {
    try {
      const buffer = Buffer.from(privateKey, 'base64');
      return buffer.length === this.PRIVATE_KEY_SIZE;
    } catch {
      return false;
    }
  }

  static async hash(data: Buffer): Promise<Buffer> {
    if (!this.initialized) await this.initialize();

    try {
      return await QuantumCrypto.nativeQuantum.dilithiumHash(data);
    } catch (error) {
      Logger.error('Dilithium hashing failed:', error);
      throw new DilithiumError(
        error instanceof Error ? error.message : 'Hashing failed',
      );
    }
  }

  public static async shutdown(): Promise<void> {
    if (!this.initialized) return;
    await QuantumCrypto.shutdown();
    this.initialized = false;
    Logger.info('Dilithium shut down');
  }
}
