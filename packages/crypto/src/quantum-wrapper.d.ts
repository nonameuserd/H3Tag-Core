import { KyberEncapsulation } from "../native/types";
export declare class QuantumWrapperError extends Error {
    constructor(message: string);
}
export declare class QuantumWrapper {
    private static readonly KEY_SPLIT_RATIO;
    private static initialized;
    static initialize(): Promise<void>;
    /**
     * Generate hybrid key pair with quantum resistance
     */
    static generateKeyPair(): Promise<{
        publicKey: {
            address: string;
        };
        privateKey: {
            address: string;
        };
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
}
