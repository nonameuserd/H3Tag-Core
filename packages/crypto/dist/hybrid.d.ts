/// <reference types="node" />
/// <reference types="node" />
import { HybridKeyPair } from './keys';
import { ec as EC } from 'elliptic';
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
    static readonly TRADITIONAL_CURVE: EC;
    private static metrics;
    /**
     * Signs a given message using a hybrid approach.
     * The ECC signature is generated using the private key,
     * while Dilithium and Kyber operations use the public key.
     * Returns a JSON-encoded string containing each component.
     */
    static sign(message: string, keyPair: HybridKeyPair): Promise<string>;
    /**
     * Verifies a hybrid signature.
     * It parses the structured JSON signature, then verifies:
     * - The ECC signature using the public key.
     * - The Dilithium quantum signature.
     * - The Kyber component by re-running encapsulation using the public key.
     */
    static verify(message: string, signature: string, publicKey: string): Promise<boolean>;
    static encrypt(message: string, publicKey: string, iv?: string): Promise<string>;
    static decrypt(encryptedData: string, privateKey: string, iv?: string): Promise<string>;
    static generateSharedSecret(input: Buffer): Promise<string>;
    static getMetrics(): HybridMetrics;
    static resetMetrics(): void;
    static decryptSharedSecret(ciphertext: Buffer, privateKey: Buffer): Promise<string>;
    static combineHashes(classicalHash: string, quantumHash: string): Promise<string>;
    static verifyClassicalSignature(publicKey: string, signature: string, data: string): Promise<boolean>;
    static verifyQuantumSignature(publicKey: string, signature: string, data: string, algorithm?: string): Promise<boolean>;
    static generateAddress(): Promise<string>;
    static generateKeyPair(entropy?: string): Promise<HybridKeyPair>;
    static deriveAddress(data: {
        address: string | (() => Promise<string>);
    }): Promise<string>;
    static calculateHybridHash(data: Buffer): Promise<string>;
    /**
     * Hashes a given string using a hybrid approach.
     * The function generates keypairs first, then hashes the data using:
     * - Dilithium quantum signature
     * - Kyber encapsulation
     * - SHA-256 hash of the data
     *
     * The function returns the SHA-3 hash of the combined hashes.
     *
     * @param data - The string to hash
     * @returns A Promise<string> containing the hybrid hash
     */
    static hash(data: string): Promise<string>;
    static generateRandomBytes(length: number): Promise<Buffer>;
    static generateTraditionalKeys(): Promise<{
        publicKey: Buffer;
        privateKey: Buffer;
    }>;
}
export {};
