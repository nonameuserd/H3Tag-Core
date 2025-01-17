/// <reference types="node" />
/// <reference types="node" />
export declare class DilithiumError extends Error {
    constructor(message: string);
}
export interface DilithiumKeyPair {
    publicKey: string;
    privateKey: string;
}
export declare class Dilithium {
    private static initialized;
    private static readonly KEY_SIZE;
    private static readonly SIGNATURE_SIZE;
    private static readonly DEFAULT_SECURITY_LEVEL;
    static initialize(): Promise<void>;
    static generateKeyPair(entropy?: Buffer): Promise<DilithiumKeyPair>;
    static sign(message: string, privateKey: string): Promise<string>;
    static verify(message: string, signature: string, publicKey: string): Promise<boolean>;
    static isValidPublicKey(publicKey: string): boolean;
    static isValidPrivateKey(privateKey: string): boolean;
    static hash(data: Buffer): Promise<Buffer>;
    static shutdown(): Promise<void>;
}
