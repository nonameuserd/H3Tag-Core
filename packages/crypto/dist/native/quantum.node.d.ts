/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { NativeQuantum, QuantumKeyPair, KyberEncapsulation, SecurityLevel } from './types';
declare class QuantumNative {
    static instance: QuantumNative;
    native: NativeQuantum;
    healthCheckInterval: NodeJS.Timeout | undefined;
    isInitialized: boolean;
    HEALTH_CHECK_INTERVAL: number;
    healthCheckFailures: number;
    private constructor();
    clearHealthChecks(): void;
    static getInstance(): QuantumNative;
    initializeHealthChecks(): void;
    performHealthCheck(): Promise<void>;
    shutdown(): Promise<void>;
    checkInitialization(): void;
    generateDilithiumKeyPair(entropy?: Buffer): Promise<QuantumKeyPair>;
    kyberGenerateKeyPair(): Promise<QuantumKeyPair>;
    dilithiumSign(message: Buffer, privateKey: Buffer): Promise<Buffer>;
    dilithiumVerify(message: Buffer, signature: Buffer, publicKey: Buffer): Promise<boolean>;
    kyberEncapsulate(publicKey: Buffer): Promise<KyberEncapsulation>;
    kyberDecapsulate(ciphertext: Buffer, privateKey: Buffer): Promise<Buffer>;
    dilithiumHash(data: Buffer): Promise<Buffer>;
    kyberHash(data: Buffer): Promise<Buffer>;
    setSecurityLevel(level: SecurityLevel): Promise<void>;
}
export declare const nativeQuantum: QuantumNative;
export default nativeQuantum;
