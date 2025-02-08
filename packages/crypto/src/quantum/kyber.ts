import { QuantumCrypto } from '.';
import { Logger } from '@h3tag-blockchain/shared';
import { SecurityLevel } from '../native/types';

export class KyberError extends Error {
  public cause?: Error;
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'KyberError';
    this.cause = cause;
  }
}

export interface KyberKeyPair {
  publicKey: string;
  privateKey: string;
}

export interface KyberEncapsulation {
  ciphertext: string;
  sharedSecret: string;
}

export class Kyber {
  public static isInitialized = false;
  public static readonly PUBLIC_KEY_SIZE = 1184; // Kyber768 parameters
  public static readonly PRIVATE_KEY_SIZE = 2400;
  public static readonly CIPHERTEXT_SIZE = 1088;
  public static readonly SHARED_SECRET_SIZE = 32;
  public static readonly DEFAULT_SECURITY_LEVEL = SecurityLevel.HIGH;

  private static initializationPromise: Promise<void> | null = null;

  public static async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializationPromise !== null) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        await QuantumCrypto.initialize();
        await QuantumCrypto.setSecurityLevel(this.DEFAULT_SECURITY_LEVEL);
        this.isInitialized = true;
        Logger.info(
          'Kyber initialized with security level:',
          this.DEFAULT_SECURITY_LEVEL,
        );
      } catch (error) {
        Logger.error('Kyber initialization failed:', error);
        throw new KyberError(
          'Initialization failed',
          error instanceof Error ? error : undefined,
        );
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  public static async generateKeyPair(): Promise<KyberKeyPair> {
    if (!this.isInitialized) await this.initialize();

    try {
      const keyPair = await QuantumCrypto.nativeQuantum.kyberGenerateKeyPair();

      if (!keyPair?.publicKey || !keyPair?.privateKey) {
        throw new KyberError('Failed to generate key pair');
      }

      if (!Buffer.isBuffer(keyPair.publicKey) || !Buffer.isBuffer(keyPair.privateKey)) {
        throw new KyberError('Invalid key pair: expected keys to be Buffers');
      }

      if (keyPair.publicKey.length !== this.PUBLIC_KEY_SIZE) {
        throw new KyberError(
          `Invalid public key size: ${keyPair.publicKey.length}`,
        );
      }

      if (keyPair.privateKey.length !== this.PRIVATE_KEY_SIZE) {
        throw new KyberError(
          `Invalid private key size: ${keyPair.privateKey.length}`,
        );
      }

      return {
        publicKey: keyPair.publicKey.toString('base64'),
        privateKey: keyPair.privateKey.toString('base64'),
      };
    } catch (error) {
      Logger.error('Kyber key generation failed:', error);
      throw new KyberError(
        error instanceof Error ? error.message : 'Key generation failed',
        error instanceof Error ? error : undefined,
      );
    }
  }

  public static async encapsulate(
    publicKey: string,
  ): Promise<KyberEncapsulation> {
    if (!this.isInitialized) await this.initialize();

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

      const result =
        await QuantumCrypto.nativeQuantum.kyberEncapsulate(publicKeyBuffer);

      if (
        !Buffer.isBuffer(result.ciphertext) ||
        !Buffer.isBuffer(result.sharedSecret)
      ) {
        throw new KyberError(
          'Invalid result from kyberEncapsulate: expected ciphertext and sharedSecret as Buffers',
        );
      }

      if (result.ciphertext.length !== this.CIPHERTEXT_SIZE) {
        throw new KyberError('Invalid ciphertext generated');
      }

      if (result.sharedSecret.length !== this.SHARED_SECRET_SIZE) {
        throw new KyberError('Invalid shared secret generated');
      }

      return {
        ciphertext: result.ciphertext.toString('base64'),
        sharedSecret: result.sharedSecret.toString('base64'),
      };
    } catch (error) {
      Logger.error('Kyber encapsulation failed:', error);
      throw new KyberError(
        error instanceof Error ? error.message : 'Encapsulation failed',
        error instanceof Error ? error : undefined,
      );
    }
  }

  public static async decapsulate(
    ciphertext: string,
    privateKey: string,
  ): Promise<string> {
    if (!this.isInitialized) await this.initialize();

    try {
      if (!ciphertext || !privateKey) {
        throw new KyberError('Missing required parameters');
      }

      if (!this.isValidBase64(ciphertext)) {
        throw new KyberError('Invalid ciphertext: not a valid Base64 string');
      }

      if (!this.isValidBase64(privateKey)) {
        throw new KyberError(
          'Invalid private key: not a valid Base64 string',
        );
      }

      const ciphertextBuffer = Buffer.from(ciphertext, 'base64');
      const privateKeyBuffer = Buffer.from(privateKey, 'base64');

      if (ciphertextBuffer.length !== this.CIPHERTEXT_SIZE) {
        throw new KyberError('Invalid ciphertext size');
      }

      if (privateKeyBuffer.length !== this.PRIVATE_KEY_SIZE) {
        throw new KyberError('Invalid private key size');
      }

      const sharedSecret = await QuantumCrypto.nativeQuantum.kyberDecapsulate(
        ciphertextBuffer,
        privateKeyBuffer,
      );

      if (!Buffer.isBuffer(sharedSecret)) {
        throw new KyberError('Invalid shared secret type returned');
      }

      if (sharedSecret.length !== this.SHARED_SECRET_SIZE) {
        throw new KyberError('Invalid shared secret size');
      }

      return sharedSecret.toString('base64');
    } catch (error) {
      Logger.error('Kyber decapsulation failed:', error);
      throw new KyberError(
        error instanceof Error ? error.message : 'Decapsulation failed',
        error instanceof Error ? error : undefined,
      );
    }
  }

  public static isValidPublicKey(publicKey: string): boolean {
    try {
      const buffer = Buffer.from(publicKey, 'base64');
      return buffer.length === this.PUBLIC_KEY_SIZE;
    } catch {
      return false;
    }
  }

  public static isValidPrivateKey(privateKey: string): boolean {
    try {
      const buffer = Buffer.from(privateKey, 'base64');
      return buffer.length === this.PRIVATE_KEY_SIZE;
    } catch {
      return false;
    }
  }

  public static isValidCiphertext(ciphertext: string): boolean {
    try {
      const buffer = Buffer.from(ciphertext, 'base64');
      return buffer.length === this.CIPHERTEXT_SIZE;
    } catch {
      return false;
    }
  }

  public static async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      if (QuantumCrypto.nativeQuantum.shutdown) {
        await QuantumCrypto.nativeQuantum.shutdown();
      }
    } catch (error) {
      Logger.error('Kyber native shutdown failed:', error);
    }

    this.isInitialized = false;
    Logger.info('Kyber shut down');
  }

  public static async hash(data: Buffer): Promise<string> {
    if (!this.isInitialized) await this.initialize();

    try {
      const hashBuffer = await QuantumCrypto.nativeQuantum.kyberHash(data);
      
      if (!Buffer.isBuffer(hashBuffer)) {
        throw new KyberError('Invalid hash type returned from kyberHash');
      }
      
      return hashBuffer.toString('base64');
    } catch (error) {
      Logger.error('Kyber hashing failed:', error);
      throw new KyberError(
        error instanceof Error ? error.message : 'Hashing failed',
        error instanceof Error ? error : undefined,
      );
    }
  }

  private static isValidBase64(str: string): boolean {
    const base64regex =
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
    return base64regex.test(str);
  } 
}
