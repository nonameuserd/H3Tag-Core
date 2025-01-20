import CryptoJS from "crypto-js";
import { createHash } from "crypto";
import { Dilithium } from "./quantum/dilithium";
import { Kyber } from "./quantum/kyber";

export class HashUtils {
  /**
   * Generate SHA3-512 hash
   */
  public static sha3(data: string): string {
    try {
      return CryptoJS.SHA3(data, { outputLength: 512 }).toString();
    } catch (error) {
      throw new Error(
        `SHA3 hashing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Generate SHA-256 hash
   */
  public static sha256(data: string): string {
    try {
      return CryptoJS.SHA256(data).toString();
    } catch (error) {
      throw new Error(
        `SHA256 hashing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Generate HMAC using SHA-512
   */
  public static hmac(data: string, key: string): string {
    try {
      return CryptoJS.HmacSHA512(data, key).toString();
    } catch (error) {
      throw new Error(
        `HMAC generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Generate RIPEMD-160 hash
   */
  public static ripemd160(data: string): string {
    try {
      return CryptoJS.RIPEMD160(data).toString();
    } catch (error) {
      throw new Error(
        `RIPEMD160 hashing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Generate SHA3-512 hash and return as Buffer
   */
  public static sha3Buffer(data: Buffer | string): Buffer {
    try {
      const hash = this.sha3(data.toString());
      return Buffer.from(hash, "hex");
    } catch (error) {
      throw new Error(
        `SHA3 buffer hashing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Calculate hybrid quantum-safe hash
   */
  public static async calculateHash(data: any): Promise<string> {
    try {
      // Serialize input data
      const content = JSON.stringify(data);
      const contentBuffer = Buffer.from(new TextEncoder().encode(content));

      // Generate classical hash
      const classicHash = createHash("sha256").update(content).digest("hex");

      // Generate quantum-resistant hashes
      const [dilithiumHash, kyberHash] = await Promise.all([
        Dilithium.hash(contentBuffer),
        Kyber.hash(contentBuffer),
      ]);

      // Combine all hashes using SHA3
      return this.sha3(classicHash + dilithiumHash + kyberHash);
    } catch (error) {
      throw new Error(
        `Hybrid hash calculation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Generate double SHA-256 hash
   */
  public static doubleSha256(data: string): string {
    try {
      return this.sha256(this.sha256(data));
    } catch (error) {
      throw new Error(
        `Double SHA256 hashing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Generate hash for address generation (SHA256 + RIPEMD160)
   */
  public static hash160(data: string): string {
    try {
      const sha256Hash = this.sha256(data);
      return this.ripemd160(sha256Hash);
    } catch (error) {
      throw new Error(
        `Hash160 calculation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Generate hybrid hash
   */
  public static hybridHash(data: string): string {
    try {
      const dataBuffer = Buffer.from(data);
      const hash =
        this.doubleSha256(dataBuffer.toString("hex")) +
        Dilithium.hash(dataBuffer) +
        Kyber.hash(dataBuffer);
      return this.ripemd160(hash);
    } catch (error) {
      throw new Error(
        `Hybrid hash calculation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Encode Buffer to Base58
   */
  public static toBase58(data: Buffer): string {
    try {
      const bs58 = require("bs58");
      return bs58.encode(data);
    } catch (error) {
      throw new Error(
        `Base58 encoding failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Decode from Base58
   */
  public static fromBase58(str: string): Buffer {
    try {
      const bs58 = require("bs58");
      return Buffer.from(bs58.decode(str));
    } catch (error) {
      throw new Error(
        `Base58 decoding failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
