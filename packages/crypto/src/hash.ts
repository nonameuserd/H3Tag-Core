import CryptoJS from 'crypto-js';
import { createHash } from 'crypto';
import { Dilithium } from './quantum/dilithium';
import { Kyber } from './quantum/kyber';
import bs58 from 'bs58';

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
          error instanceof Error ? error.message : 'Unknown error'
        }`,
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
          error instanceof Error ? error.message : 'Unknown error'
        }`,
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
          error instanceof Error ? error.message : 'Unknown error'
        }`,
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
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Generate SHA3-512 hash and return as Buffer
   */
  public static sha3Buffer(data: Buffer | string): Buffer {
    try {
      const hash = this.sha3(data.toString());
      return Buffer.from(hash, 'hex');
    } catch (error) {
      throw new Error(
        `SHA3 buffer hashing failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Calculate hybrid quantum-safe hash
   */
  public static async calculateHash(data: Buffer): Promise<string> {
    try {
      // Use the raw buffer data for classical hash calculation
      const classicHash = createHash('sha256').update(data).digest('hex');

      // Generate quantum-resistant hashes using the raw binary data
      const [dilithiumHash, kyberHash] = await Promise.all([
        Dilithium.hash(data),
        Kyber.hash(data),
      ]);

      // Combine all hashes using a structured approach
      const combined = JSON.stringify({
        classic: classicHash,
        dilithium: dilithiumHash,
        kyber: kyberHash,
      });

      // Return SHA3 hash of the structured combined value
      return this.sha3(combined);
    } catch (error) {
      throw new Error(
        `Hybrid quantum hash calculation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
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
          error instanceof Error ? error.message : 'Unknown error'
        }`,
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
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Generate hybrid hash
   */
  public static async hybridHash(data: string): Promise<string> {
    try {
      // Convert the string consistently to a buffer for quantum-resistant hashing
      const dataBuffer = Buffer.from(data, 'utf8');
      const [dilithiumHash, kyberHash] = await Promise.all([
        Dilithium.hash(dataBuffer),
        Kyber.hash(dataBuffer),
      ]);

      // Use the raw data (the original string) for classical double SHA256 hashing
      const classicalHash = this.doubleSha256(data);

      // Combine hash components using a structured object to avoid ambiguity
      const combined = JSON.stringify({
        classical: classicalHash,
        dilithium: dilithiumHash,
        kyber: kyberHash,
      });

      // Return RIPEMD160 hash of the structured combined value
      return this.ripemd160(combined);
    } catch (error) {
      throw new Error(
        `Hybrid hash calculation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Encodes the given Buffer into a Base58 string.
   */
  public static toBase58(data: Buffer): string {
    try {
      return bs58.encode(data);
    } catch (error) {
      throw new Error(
        `Base58 encoding failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Decodes a Base58 string back into a Buffer.
   */
  public static fromBase58(data: string): Buffer {
    try {
      return Buffer.from(bs58.decode(data));
    } catch (error) {
      throw new Error(
        `Base58 decoding failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
}
