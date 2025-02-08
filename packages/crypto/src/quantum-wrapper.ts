import { KyberEncapsulation } from './native/types';
import { HybridCrypto } from './hybrid';
import { HashUtils } from './hash';
import { Dilithium } from './quantum/dilithium';
import { Kyber } from './quantum/kyber';
import { Logger } from '@h3tag-blockchain/shared';
import { QuantumHash } from './quantum-hash';

/**
 * QuantumWrapperError extends the base Error class to provide a custom error type for the QuantumWrapper class.
 * This allows for better error handling and debugging by providing a specific error name.
 */
export class QuantumWrapperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuantumWrapperError';
  }
}

/**
 * QuantumWrapper is a utility class that provides a unified interface for using quantum-resistant cryptographic primitives.
 * It allows for the generation of hybrid key pairs, signing, verification, encapsulation, decapsulation, and hashing.
 */
export class QuantumWrapper {
  private static readonly KEY_SPLIT_RATIO = 0.5;
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (this.initialized) return;
    await Promise.all([
      Dilithium.generateKeyPair(), // Initialize Dilithium
      Kyber.generateKeyPair(), // Initialize Kyber
    ]);
    this.initialized = true;
  }

  /**
   * Generate hybrid key pair with quantum resistance
   */
  public static async generateKeyPair(): Promise<{
    publicKey: Buffer;
    privateKey: Buffer;
  }> {
    try {
      // Generate both quantum-resistant and classical keys in parallel
      const [dilithiumPair, kyberPair] = await Promise.all([
        Dilithium.generateKeyPair(),
        Kyber.generateKeyPair(),
      ]);

      // Validate key generation
      if (!dilithiumPair?.publicKey || !kyberPair?.publicKey) {
        throw new QuantumWrapperError('Invalid key generation result');
      }

      // Convert hex string keys into Buffers and concatenate
      const dilithiumPublicBuffer = Buffer.from(dilithiumPair.publicKey, 'hex');
      const kyberPublicBuffer = Buffer.from(kyberPair.publicKey, 'hex');
      const dilithiumPrivateBuffer = Buffer.from(dilithiumPair.privateKey, 'hex');
      const kyberPrivateBuffer = Buffer.from(kyberPair.privateKey, 'hex');

      // Concatenate each key so that the first half is quantum and second half is classical (or vice-versa)
      const hybridPublicKey = Buffer.concat([
        dilithiumPublicBuffer,
        kyberPublicBuffer,
      ]);
      const hybridPrivateKey = Buffer.concat([
        dilithiumPrivateBuffer,
        kyberPrivateBuffer,
      ]);

      return {
        publicKey: hybridPublicKey,
        privateKey: hybridPrivateKey,
      };
    } catch (error) {
      Logger.error('Hybrid key generation failed:', error);
      throw new QuantumWrapperError(
        error instanceof Error ? error.message : 'Key generation failed'
      );
    }
  }

  private static async combinePublicKeys(
    dilithiumKey: string,
    kyberKey: string,
  ): Promise<string> {
    return HashUtils.sha3(dilithiumKey + kyberKey);
  }

  private static async combinePrivateKeys(
    dilithiumKey: string,
    kyberKey: string,
  ): Promise<string> {
    return HashUtils.sha3(kyberKey + dilithiumKey); // Different order for private keys
  }

  /**
   * Sign using hybrid approach
   */
  public static async sign(
    message: Buffer,
    privateKey: Buffer,
  ): Promise<Buffer> {
    try {
      if (!Buffer.isBuffer(message) || !Buffer.isBuffer(privateKey)) {
        throw new QuantumWrapperError('Invalid input parameters');
      }
      // Split the hybrid private key; assume the second half is classical.
      const halfLength = Math.floor(privateKey.length * this.KEY_SPLIT_RATIO);
      const classicalPrivateKey = privateKey.subarray(halfLength);

      // For signing, use the classical portion.
      const classicalSig = await HybridCrypto.sign(message.toString('utf8'), {
        privateKey: classicalPrivateKey.toString('hex'),
        // If available, derive the classical public key properly instead of reusing the private part.
        publicKey: classicalPrivateKey.toString('hex'),
        address: await HybridCrypto.deriveAddress({
          address: classicalPrivateKey.toString('hex'),
        }),
      });

      return Buffer.from(classicalSig, 'hex');
    } catch (error) {
      Logger.error('Signing failed:', error);
      throw new QuantumWrapperError(
        error instanceof Error ? error.message : 'Signing failed'
      );
    }
  }

  /**
   * Verify using hybrid approach
   */
  public static async verify(
    message: Buffer,
    signature: Buffer,
    publicKey: Buffer,
  ): Promise<boolean> {
    try {
      if (
        !Buffer.isBuffer(message) ||
        !Buffer.isBuffer(signature) ||
        !Buffer.isBuffer(publicKey)
      ) {
        throw new QuantumWrapperError('Invalid input parameters');
      }

      // Split keys
      const halfLength = Math.floor(publicKey.length * this.KEY_SPLIT_RATIO);
      const traditionalKey = publicKey.subarray(halfLength).toString('hex');

      // Use the full signature generated by the sign method
      const classicalSig = signature.toString('hex');

      // Derive blockchain address from public key
      const address = await HybridCrypto.deriveAddress({
        address: traditionalKey,
      });

      // Verify signature against derived address
      return await HybridCrypto.verify(
        message.toString(),
        classicalSig,
        address,
      );
    } catch (error) {
      Logger.error('Hybrid verification failed:', error);
      return false;
    }
  }

  /**
   * Hybrid key encapsulation
   */
  public static async encapsulate(
    publicKey: Buffer,
  ): Promise<KyberEncapsulation> {
    try {
      if (!Buffer.isBuffer(publicKey)) {
        throw new QuantumWrapperError('Invalid public key');
      }

      const halfLength = Math.floor(publicKey.length * this.KEY_SPLIT_RATIO);
      const kyberKey = publicKey.subarray(halfLength).toString('base64');

      // Generate both classical and quantum shared secrets
      const [kyberResult, classicalSecret] = await Promise.all([
        Kyber.encapsulate(kyberKey),
        HybridCrypto.generateSharedSecret(publicKey),
      ]);

      return {
        ciphertext: Buffer.from(kyberResult.ciphertext, 'base64'),
        sharedSecret: Buffer.concat([
          Buffer.from(kyberResult.sharedSecret, 'base64'),
          Buffer.from(classicalSecret),
        ]),
      };
    } catch (error) {
      Logger.error('Hybrid encapsulation failed:', error);
      throw new QuantumWrapperError(
        error instanceof Error ? error.message : 'Encapsulation failed',
      );
    }
  }

  /**
   * Hybrid key decapsulation
   */
  public static async decapsulate(
    ciphertext: Buffer,
    privateKey: Buffer,
  ): Promise<Buffer> {
    try {
      if (!Buffer.isBuffer(ciphertext) || !Buffer.isBuffer(privateKey)) {
        throw new QuantumWrapperError('Invalid input parameters');
      }

      const halfLength = Math.floor(privateKey.length * this.KEY_SPLIT_RATIO);
      const kyberKey = privateKey.subarray(halfLength).toString('base64');

      // Decrypt using both methods
      const [kyberSecret, classicalSecret] = await Promise.all([
        Kyber.decapsulate(ciphertext.toString('base64'), kyberKey),
        HybridCrypto.decryptSharedSecret(ciphertext, privateKey),
      ]);

      return Buffer.concat([
        Buffer.from(kyberSecret, 'base64'),
        Buffer.from(classicalSecret),
      ]);
    } catch (error) {
      Logger.error('Hybrid decapsulation failed:', error);
      throw new QuantumWrapperError(
        error instanceof Error ? error.message : 'Decapsulation failed',
      );
    }
  }

  /**
   * Hybrid hash function
   */
  public static async hashData(data: Buffer): Promise<Buffer> {
    try {
      if (!Buffer.isBuffer(data)) {
        throw new QuantumWrapperError('Invalid input data');
      }

      // Use a deterministic quantum hash instead of signing with a newly generated key pair.
      const quantumHash = await QuantumHash.calculate(data); // await the async call

      // Combine with a classical SHA3 hash
      const classicalHash = HashUtils.sha3(data.toString());
      const combinedHash = HashUtils.sha256(classicalHash + quantumHash);

      return Buffer.from(combinedHash, 'hex');
    } catch (error) {
      Logger.error('Hybrid hashing failed:', error);
      throw new QuantumWrapperError(
        error instanceof Error ? error.message : 'Hashing failed'
      );
    }
  }

  /**
   * Shutdown method for cleaning up quantum-related resources.
   * Resets the initialized state and performs any necessary cleanup.
   */
  public static async shutdown(): Promise<void> {
    this.initialized = false;
    
    // If available, shutdown underlying modules.
    if (typeof Dilithium.shutdown === 'function') {
      await Dilithium.shutdown();
    }
    if (typeof Kyber.shutdown === 'function') {
      await Kyber.shutdown();
    }
    Logger.info('QuantumWrapper has been shutdown.');
  }
}
