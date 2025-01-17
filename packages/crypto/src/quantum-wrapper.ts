import { KyberEncapsulation } from "./native/types";
import { HybridCrypto } from "./hybrid";
import { HashUtils } from "./hash";
import { Dilithium } from "./quantum/dilithium";
import { Kyber } from "./quantum/kyber";
import { Logger } from "@h3tag-blockchain/shared";

export class QuantumWrapperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuantumWrapperError";
  }
}

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
    publicKey: { address: string };
    privateKey: { address: string };
  }> {
    try {
      // Generate both quantum-resistant and traditional keys in parallel
      const [dilithiumPair, kyberPair] = await Promise.all([
        Dilithium.generateKeyPair(),
        Kyber.generateKeyPair(),
      ]);

      // Validate key generation
      if (!dilithiumPair?.publicKey || !kyberPair?.publicKey) {
        throw new QuantumWrapperError("Invalid key generation result");
      }

      // Combine keys with quantum resistance
      const hybridPublicKey = await this.combinePublicKeys(
        dilithiumPair.publicKey,
        kyberPair.publicKey
      );

      const hybridPrivateKey = await this.combinePrivateKeys(
        dilithiumPair.privateKey,
        kyberPair.privateKey
      );

      // Derive addresses
      const address = await HybridCrypto.deriveAddress({
        address: hybridPublicKey,
      });

      return {
        publicKey: { address },
        privateKey: { address: hybridPrivateKey },
      };
    } catch (error) {
      Logger.error("Hybrid key generation failed:", error);
      throw new QuantumWrapperError(
        error instanceof Error ? error.message : "Key generation failed"
      );
    }
  }

  private static async combinePublicKeys(
    dilithiumKey: string,
    kyberKey: string
  ): Promise<string> {
    return HashUtils.sha3(dilithiumKey + kyberKey);
  }

  private static async combinePrivateKeys(
    dilithiumKey: string,
    kyberKey: string
  ): Promise<string> {
    return HashUtils.sha3(kyberKey + dilithiumKey); // Different order for private keys
  }

  /**
   * Sign using hybrid approach
   */
  public static async sign(
    message: Buffer,
    privateKey: Buffer
  ): Promise<Buffer> {
    try {
      if (!Buffer.isBuffer(message) || !Buffer.isBuffer(privateKey)) {
        throw new QuantumWrapperError("Invalid input parameters");
      }

      // Split the hybrid private key
      const halfLength = Math.floor(privateKey.length * this.KEY_SPLIT_RATIO);
      const classicalKey = privateKey.subarray(halfLength).toString("hex");

      // Generate both signatures
      const [classicalSig] = await Promise.all([
        HybridCrypto.sign(message.toString(), {
          privateKey: classicalKey,
          publicKey: classicalKey,
          address: await HybridCrypto.deriveAddress({ address: classicalKey }),
        }),
      ]);

      return Buffer.concat([Buffer.from(classicalSig.toString(), "hex")]);
    } catch (error) {
      Logger.error("Signing failed:", error);
      throw new QuantumWrapperError(
        error instanceof Error ? error.message : "Signing failed"
      );
    }
  }

  /**
   * Verify using hybrid approach
   */
  public static async verify(
    message: Buffer,
    signature: Buffer,
    publicKey: Buffer
  ): Promise<boolean> {
    try {
      if (
        !Buffer.isBuffer(message) ||
        !Buffer.isBuffer(signature) ||
        !Buffer.isBuffer(publicKey)
      ) {
        throw new QuantumWrapperError("Invalid input parameters");
      }

      // Split keys and signatures
      const halfLength = Math.floor(publicKey.length * this.KEY_SPLIT_RATIO);
      const traditionalKey = publicKey.subarray(halfLength).toString("hex");

      const sigHalfLength = Math.floor(signature.length * this.KEY_SPLIT_RATIO);
      const classicalSig = signature.subarray(0, sigHalfLength).toString("hex");

      // Derive blockchain address from public key
      const address = await HybridCrypto.deriveAddress({
        address: traditionalKey,
      });

      // Verify signature against derived address
      return await HybridCrypto.verify(
        message.toString(),
        { address: classicalSig },
        { address }
      );
    } catch (error) {
      Logger.error("Hybrid verification failed:", error);
      return false;
    }
  }

  /**
   * Hybrid key encapsulation
   */
  public static async encapsulate(
    publicKey: Buffer
  ): Promise<KyberEncapsulation> {
    try {
      if (!Buffer.isBuffer(publicKey)) {
        throw new QuantumWrapperError("Invalid public key");
      }

      const halfLength = Math.floor(publicKey.length * this.KEY_SPLIT_RATIO);
      const kyberKey = publicKey.subarray(halfLength).toString("base64");

      // Generate both classical and quantum shared secrets
      const [kyberResult, classicalSecret] = await Promise.all([
        Kyber.encapsulate(kyberKey),
        HybridCrypto.generateSharedSecret(publicKey),
      ]);

      return {
        ciphertext: Buffer.from(kyberResult.ciphertext, "base64"),
        sharedSecret: Buffer.concat([
          Buffer.from(kyberResult.sharedSecret, "base64"),
          Buffer.from(classicalSecret),
        ]),
      };
    } catch (error) {
      Logger.error("Hybrid encapsulation failed:", error);
      throw new QuantumWrapperError(
        error instanceof Error ? error.message : "Encapsulation failed"
      );
    }
  }

  /**
   * Hybrid key decapsulation
   */
  public static async decapsulate(
    ciphertext: Buffer,
    privateKey: Buffer
  ): Promise<Buffer> {
    try {
      if (!Buffer.isBuffer(ciphertext) || !Buffer.isBuffer(privateKey)) {
        throw new QuantumWrapperError("Invalid input parameters");
      }

      const halfLength = Math.floor(privateKey.length * this.KEY_SPLIT_RATIO);
      const kyberKey = privateKey.subarray(halfLength).toString("base64");

      // Decrypt using both methods
      const [kyberSecret, classicalSecret] = await Promise.all([
        Kyber.decapsulate(ciphertext.toString("base64"), kyberKey),
        HybridCrypto.decryptSharedSecret(ciphertext, privateKey),
      ]);

      return Buffer.concat([
        Buffer.from(kyberSecret, "base64"),
        Buffer.from(classicalSecret),
      ]);
    } catch (error) {
      Logger.error("Hybrid decapsulation failed:", error);
      throw new QuantumWrapperError(
        error instanceof Error ? error.message : "Decapsulation failed"
      );
    }
  }

  /**
   * Hybrid hash function
   */
  public static async hashData(data: Buffer): Promise<Buffer> {
    try {
      if (!Buffer.isBuffer(data)) {
        throw new QuantumWrapperError("Invalid input data");
      }

      // Generate quantum signature as quantum-safe hash
      const keyPair = await this.generateKeyPair();
      const quantumHash = await this.sign(
        data,
        Buffer.from(keyPair.privateKey.address, "hex")
      );

      // Combine with classical hash
      const classicalHash = HashUtils.sha3(data.toString());

      return Buffer.from(
        HashUtils.sha256(classicalHash + quantumHash.toString("hex"))
      );
    } catch (error) {
      Logger.error("Hybrid hashing failed:", error);
      throw new QuantumWrapperError(
        error instanceof Error ? error.message : "Hashing failed"
      );
    }
  }
}
