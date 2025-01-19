import { HybridKeyPair } from './keys';
export declare class HybridError extends Error {
  constructor(message: string);
}
interface HybridMetrics {
  totalHashes: number;
  averageTime: number;
  failedAttempts: number;
  lastHashTime: number;
}
export declare class HybridCrypto {
  private static readonly KEY_SIZE;
  private static readonly TRADITIONAL_CURVE;
  private static metrics;
  static sign(
    message: string,
    privateKey: HybridKeyPair,
  ): Promise<{
    address: string;
  }>;
  static verify(
    message: string,
    signature: {
      address: string;
    },
    publicKey: {
      address: string;
    },
  ): Promise<boolean>;
  static encrypt(
    message: string,
    publicKey: {
      address: string;
    },
  ): Promise<string>;
  static decrypt(
    encryptedData: string,
    privateKey: {
      address: string;
    },
  ): Promise<string>;
  static generateSharedSecret(input: Buffer): Promise<string>;
  static getMetrics(): HybridMetrics;
  static resetMetrics(): void;
  static decryptSharedSecret(
    ciphertext: Buffer,
    privateKey: Buffer,
  ): Promise<string>;
  static combineHashes(
    classicalHash: string,
    quantumHash: string,
  ): Promise<string>;
  static verifyClassicalSignature(
    publicKey: string,
    signature: string,
    data: string,
  ): Promise<boolean>;
  static verifyQuantumSignature(
    publicKey: string,
    signature: string,
    data: string,
    algorithm?: string,
  ): Promise<boolean>;
  static generateAddress(): Promise<string>;
  static generateKeyPair(entropy?: string): Promise<HybridKeyPair>;
  static deriveAddress(data: {
    address: string | (() => Promise<string>);
  }): Promise<string>;
  static calculateHybridHash(data: any): Promise<string>;
  static hash(data: string): Promise<string>;
  static generateRandomBytes(length: number): Promise<Buffer>;
  static generateTraditionalKeys(): Promise<{
    publicKey: Buffer;
    privateKey: Buffer;
  }>;
}
export {};
