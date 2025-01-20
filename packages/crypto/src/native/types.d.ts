export declare enum SecurityLevel {
    NORMAL = 1,
    HIGH = 2,
    PARANOID = 3
}
export interface QuantumKeyPair {
    publicKey: Buffer;
    privateKey: Buffer;
}
export interface KyberEncapsulation {
    ciphertext: Buffer;
    sharedSecret: Buffer;
}
export interface HybridKeys {
    traditional: string;
    dilithium: string;
    kyber: string;
}
export interface NativeQuantum {
    generateDilithiumKeyPair(entropy?: Buffer): Promise<QuantumKeyPair>;
    kyberGenerateKeyPair(): Promise<QuantumKeyPair>;
    dilithiumSign(message: Buffer, privateKey: Buffer): Promise<Buffer>;
    dilithiumVerify(message: Buffer, signature: Buffer, publicKey: Buffer): Promise<boolean>;
    kyberEncapsulate(publicKey: Buffer): Promise<KyberEncapsulation>;
    kyberDecapsulate(ciphertext: Buffer, privateKey: Buffer): Promise<Buffer>;
    dilithiumHash(data: Buffer): Promise<Buffer>;
    kyberHash(data: Buffer): Promise<Buffer>;
    setSecurityLevel(level: SecurityLevel): Promise<void>;
    hash(data: Buffer): Promise<Buffer>;
}
