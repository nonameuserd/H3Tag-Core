/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { QuantumKeyPair, SecurityLevel } from '../native/types';
export declare class QuantumError extends Error {
    constructor(message: string);
}
export declare class QuantumCrypto {
    static isModuleInitialized: boolean;
    static readonly nativeQuantum: import("../native/quantum.node").QuantumNative;
    static healthCheckInterval: NodeJS.Timeout;
    private static isHealthCheckRunning;
    static initialize(): Promise<void>;
    static checkInitialization(): void;
    static initializeHealthChecks(): void;
    static performHealthCheck(): Promise<void>;
    static shutdown(): Promise<void>;
    static isInitialized(): boolean;
    static generateKeyPair(entropy?: Buffer): Promise<QuantumKeyPair>;
    static sign(message: Buffer, privateKey: Buffer): Promise<Buffer>;
    static verify(message: Buffer, signature: Buffer, publicKey: Buffer): Promise<boolean>;
    static setSecurityLevel(level: SecurityLevel): Promise<void>;
    static dilithiumHash(data: Buffer): Promise<Buffer>;
    static kyberEncapsulate(data: Buffer): Promise<{
        ciphertext: Buffer;
        sharedSecret: Buffer;
    }>;
    static kyberHash(data: Buffer): Promise<Buffer>;
    static nativeHash(data: Buffer): Promise<Buffer>;
}
export * from './dilithium';
export * from './kyber';
