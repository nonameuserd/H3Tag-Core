/// <reference types="node" />
/// <reference types="node" />
import { KyberEncapsulation } from './native/types';
/**
 * QuantumWrapperError extends the base Error class to provide a custom error type for the QuantumWrapper class.
 * This allows for better error handling and debugging by providing a specific error name.
 */
export declare class QuantumWrapperError extends Error {
    constructor(message: string);
}
/**
 * QuantumWrapper is a utility class that provides a unified interface for using quantum-resistant cryptographic primitives.
 * It allows for the generation of hybrid key pairs, signing, verification, encapsulation, decapsulation, and hashing.
 */
export declare class QuantumWrapper {
    private static readonly KEY_SPLIT_RATIO;
    private static initialized;
    static initialize(): Promise<void>;
    /**
     * Generate hybrid key pair with quantum resistance
     */
    static generateKeyPair(): Promise<{
        publicKey: Buffer;
        privateKey: Buffer;
    }>;
    private static combinePublicKeys;
    private static combinePrivateKeys;
    /**
     * Sign using hybrid approach
     */
    static sign(message: Buffer, privateKey: Buffer): Promise<Buffer>;
    /**
     * Verify using hybrid approach
     */
    static verify(message: Buffer, signature: Buffer, publicKey: Buffer): Promise<boolean>;
    /**
     * Hybrid key encapsulation
     */
    static encapsulate(publicKey: Buffer): Promise<KyberEncapsulation>;
    /**
     * Hybrid key decapsulation
     */
    static decapsulate(ciphertext: Buffer, privateKey: Buffer): Promise<Buffer>;
    /**
     * Hybrid hash function
     */
    static hashData(data: Buffer): Promise<Buffer>;
    /**
     * Shutdown method for cleaning up quantum-related resources.
     * Resets the initialized state and performs any necessary cleanup.
     */
    static shutdown(): Promise<void>;
}
