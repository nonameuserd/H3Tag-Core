import { Dilithium } from "./quantum/dilithium";
import { Kyber } from "./quantum/kyber";
import CryptoJS from "crypto-js";
import { Logger } from "@h3tag-blockchain/shared";
import { HashUtils } from "./hash";
import { HybridCrypto } from "./hybrid";
import { QuantumWrapper } from "./quantum-wrapper";

export class KeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyError";
  }
}

export interface HybridKeyPair {
  address: string;
  privateKey: string | (() => Promise<string>);
  publicKey: string | (() => Promise<string>);
}

export class KeyManager {
  private static readonly MIN_ENTROPY_LENGTH = 32;
  private static readonly DEFAULT_ENTROPY_LENGTH = 64;
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (this.initialized) return;
    await QuantumWrapper.initialize();
    this.initialized = true;
  }

  /**
   * Generate a hybrid key pair with optional entropy
   */
  static async generateHybridKeyPair(entropy?: string): Promise<HybridKeyPair> {
    try {
      if (entropy && entropy.length < this.MIN_ENTROPY_LENGTH) {
        throw new KeyError("Insufficient entropy length");
      }

      // Generate quantum-resistant keys in parallel
      const [dilithiumKeys, kyberKeys] = await Promise.all([
        Dilithium.generateKeyPair(),
        Kyber.generateKeyPair(),
      ]);

      if (!dilithiumKeys || !kyberKeys) {
        throw new KeyError("Failed to generate quantum keys");
      }

      // Generate or use provided entropy
      const traditionalEntropy =
        entropy ||
        CryptoJS.lib.WordArray.random(this.DEFAULT_ENTROPY_LENGTH).toString();

      const keyPair: HybridKeyPair = {
        address: "",
        publicKey: traditionalEntropy,
        privateKey: traditionalEntropy,
      };

      if (!this.validateKeyPair(keyPair)) {
        throw new KeyError("Generated invalid key pair");
      }

      return keyPair;
    } catch (error) {
      Logger.error("Failed to generate hybrid key pair:", error);
      throw new KeyError(
        error instanceof Error ? error.message : "Key generation failed"
      );
    }
  }

  /**
   * Validate a hybrid key pair
   */
  static async validateKeyPair(keyPair: HybridKeyPair): Promise<boolean> {
    try {
      return (
        (await this.validateKey(keyPair.publicKey)) &&
        (await this.validateKey(keyPair.privateKey))
      );
    } catch (error) {
      Logger.error("Key pair validation failed:", error);
      return false;
    }
  }

  /**
   * Validate an individual key
   */
  private static async validateKey(
    key: string | (() => Promise<string>)
  ): Promise<boolean> {
    const keyString = typeof key === "function" ? await key() : key;
    return (
      typeof keyString === "string" &&
      keyString.length >= this.MIN_ENTROPY_LENGTH
    );
  }

  /**
   * Serialize a key pair to string
   */
  static serializeKeyPair(keyPair: HybridKeyPair): string {
    try {
      if (!this.validateKeyPair(keyPair)) {
        throw new KeyError("Invalid key pair");
      }
      return JSON.stringify(keyPair);
    } catch (error) {
      Logger.error("Key pair serialization failed:", error);
      throw new KeyError(
        error instanceof Error ? error.message : "Serialization failed"
      );
    }
  }

  /**
   * Deserialize a key pair from string
   */
  static deserializeKeyPair(serialized: string): HybridKeyPair {
    try {
      const keyPair = JSON.parse(serialized) as HybridKeyPair;
      if (!this.validateKeyPair(keyPair)) {
        throw new KeyError("Invalid key pair format");
      }
      return keyPair;
    } catch (error) {
      Logger.error("Key pair deserialization failed:", error);
      throw new KeyError(
        error instanceof Error ? error.message : "Deserialization failed"
      );
    }
  }

  static async generateKeyPair(entropy?: string): Promise<HybridKeyPair> {
    const keyPair = await this.generateHybridKeyPair(entropy);
    const address = await this.deriveAddress(keyPair.publicKey);
    return {
      ...keyPair,
      address,
    };
  }

  static async rotateKeyPair(
    oldKeyPair: HybridKeyPair
  ): Promise<HybridKeyPair> {
    const newKeyPair = await this.generateKeyPair();
    newKeyPair.address = oldKeyPair.address;
    return newKeyPair;
  }

  static async deriveAddress(
    publicKey: string | (() => Promise<string>)
  ): Promise<string> {
    try {
      const pubKey =
        typeof publicKey === "function" ? await publicKey() : publicKey;
      const quantumKeys = await QuantumWrapper.generateKeyPair();

      const combined = await HybridCrypto.deriveAddress({
        address: pubKey + quantumKeys.publicKey.address,
      });

      const hash = await QuantumWrapper.hashData(Buffer.from(combined));

      // Bitcoin-style address generation with quantum protection
      const ripemd160Hash = HashUtils.ripemd160(
        HashUtils.sha256(hash.toString("hex"))
      );
      const versionedHash = Buffer.concat([
        Buffer.from([0x00]),
        Buffer.from(ripemd160Hash, "hex"),
      ]);

      // Double SHA256 for checksum
      const checksum = HashUtils.sha256(
        HashUtils.sha256(versionedHash.toString("hex"))
      ).slice(0, 8);

      // Combine and convert to base58
      const finalBinary = Buffer.concat([
        versionedHash,
        Buffer.from(checksum, "hex"),
      ]);
      return HashUtils.toBase58(finalBinary);
    } catch (error) {
      Logger.error("Failed to derive quantum-safe address", { error });
      throw new KeyError("Address derivation failed");
    }
  }

  static async shutdown(): Promise<void> {
    this.initialized = false;
    await QuantumWrapper.initialize(); // Reset quantum wrapper
  }

  /**
   * Convert address to public key hash
   */
  static async addressToHash(address: string): Promise<string> {
    try {
      // Remove prefix and decode from base58
      const decoded = HashUtils.fromBase58(address);

      // Extract the public key hash (remove version byte and checksum)
      const pubKeyHash = decoded.slice(1, -4);

      return pubKeyHash.toString("hex");
    } catch (error) {
      Logger.error("Failed to convert address to hash:", error);
      throw new KeyError("Invalid address format");
    }
  }

  /**
   * Get public key hash from public key
   */
  static async getPublicKeyHash(publicKey: string): Promise<string> {
    try {
      const hash = HashUtils.hybridHash(publicKey);
      return hash;
    } catch (error) {
      Logger.error("Failed to get public key hash:", error);
      throw new KeyError("Invalid public key");
    }
  }
}
