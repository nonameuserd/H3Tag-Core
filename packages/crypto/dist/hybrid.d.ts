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
    static sign(message: string, privateKey: HybridKeyPair): Promise<string>;
    static verify(message: string, signature: string, publicKey: string): Promise<boolean>;
    static encrypt(message: string, publicKey: string): Promise<string>;
    static decrypt(encryptedData: string, privateKey: string): Promise<string>;
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
    static hash(data: string): Promise<string>;
    static generateRandomBytes(length: number): Promise<Buffer>;
    static generateTraditionalKeys(): Promise<{
        publicKey: Buffer;
        privateKey: Buffer;
    }>;
}
export {};
