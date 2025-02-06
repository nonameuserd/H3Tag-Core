/// <reference types="node" />
/// <reference types="node" />
import { SecurityLevel } from '../native/types';
export declare class KyberError extends Error {
    cause?: Error;
    constructor(message: string, cause?: Error);
}
export interface KyberKeyPair {
    publicKey: string;
    privateKey: string;
}
export interface KyberEncapsulation {
    ciphertext: string;
    sharedSecret: string;
}
export declare class Kyber {
    static isInitialized: boolean;
    static readonly PUBLIC_KEY_SIZE = 1184;
    static readonly PRIVATE_KEY_SIZE = 2400;
    static readonly CIPHERTEXT_SIZE = 1088;
    static readonly SHARED_SECRET_SIZE = 32;
    static readonly DEFAULT_SECURITY_LEVEL = SecurityLevel.HIGH;
    private static initializationPromise;
    static initialize(): Promise<void>;
    static generateKeyPair(): Promise<KyberKeyPair>;
    static encapsulate(publicKey: string): Promise<KyberEncapsulation>;
    static decapsulate(ciphertext: string, privateKey: string): Promise<string>;
    static isValidPublicKey(publicKey: string): boolean;
    static isValidPrivateKey(privateKey: string): boolean;
    static isValidCiphertext(ciphertext: string): boolean;
    static shutdown(): Promise<void>;
    static hash(data: Buffer): Promise<string>;
    private static isValidBase64;
}
