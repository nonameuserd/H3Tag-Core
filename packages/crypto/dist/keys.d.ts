import { DilithiumKeyPair } from './quantum/dilithium';
import { KyberKeyPair } from './quantum/kyber';
export declare class KeyError extends Error {
    constructor(message: string);
}
export interface HybridKeyPair {
    address: string;
    privateKey: string | (() => Promise<string>);
    publicKey: string | (() => Promise<string>);
    quantumKeys?: {
        dilithium: DilithiumKeyPair;
        kyber: KyberKeyPair;
    };
}
export declare class KeyManager {
    private static readonly MIN_ENTROPY_LENGTH;
    private static readonly DEFAULT_ENTROPY_LENGTH;
    private static initialized;
    private static initializationPromise;
    static initialize(): Promise<void>;
    /**
     * Generate a hybrid key pair with optional entropy
     */
    static generateHybridKeyPair(entropy?: string): Promise<HybridKeyPair>;
    /**
     * Validate a hybrid key pair
     */
    static validateKeyPair(keyPair: HybridKeyPair): Promise<boolean>;
    /**
     * Validate an individual key
     */
    private static validateKey;
    /**
     * Serialize a key pair to string
     */
    static serializeKeyPair(keyPair: HybridKeyPair): Promise<string>;
    /**
     * Deserialize a key pair from string
     */
    static deserializeKeyPair(serialized: string): Promise<HybridKeyPair>;
    static generateKeyPair(entropy?: string): Promise<HybridKeyPair>;
    static rotateKeyPair(oldKeyPair: HybridKeyPair): Promise<HybridKeyPair>;
    static deriveAddress(publicKey: string | (() => Promise<string>)): Promise<string>;
    private static determineAddressType;
    private static getVersionByte;
    /**
     * Shuts down the key manager.
     * NOTE: Instead of reinitializing the QuantumWrapper, if a shutdown operation exists, we use that.
     */
    static shutdown(): Promise<void>;
    /**
     * Convert address to public key hash
     */
    static addressToHash(address: string): Promise<string>;
    /**
     * Get public key hash from public key
     */
    static getPublicKeyHash(publicKey: string): Promise<string>;
}
