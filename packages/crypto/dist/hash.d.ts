/// <reference types="node" />
/// <reference types="node" />
export declare class HashUtils {
    /**
     * Generate SHA3-512 hash
     */
    static sha3(data: string): string;
    /**
     * Generate SHA-256 hash
     */
    static sha256(data: string): string;
    /**
     * Generate HMAC using SHA-512
     */
    static hmac(data: string, key: string): string;
    /**
     * Generate RIPEMD-160 hash
     */
    static ripemd160(data: string): string;
    /**
     * Generate SHA3-512 hash and return as Buffer
     */
    static sha3Buffer(data: Buffer | string): Buffer;
    /**
     * Calculate hybrid quantum-safe hash
     */
    static calculateHash(data: Buffer): Promise<string>;
    /**
     * Generate double SHA-256 hash
     */
    static doubleSha256(data: string): string;
    /**
     * Generate hash for address generation (SHA256 + RIPEMD160)
     */
    static hash160(data: string): string;
    /**
     * Generate hybrid hash
     */
    static hybridHash(data: string): Promise<string>;
    /**
     * Encodes the given Buffer into a Base58 string.
     */
    static toBase58(data: Buffer): string;
    /**
     * Decodes a Base58 string back into a Buffer.
     */
    static fromBase58(data: string): Buffer;
}
