import { HybridKeyPair } from "@h3tag-blockchain/crypto";
import { KeyRotationMetadata } from "./keystore-types";
export declare enum KeystoreErrorCode {
    ENCRYPTION_ERROR = "ENCRYPTION_ERROR",
    DECRYPTION_ERROR = "DECRYPTION_ERROR",
    INVALID_PASSWORD = "INVALID_PASSWORD",
    KDF_ERROR = "KDF_ERROR",
    INVALID_KEYSTORE_STRUCTURE = "INVALID_KEYSTORE_STRUCTURE",
    DATABASE_ERROR = "DATABASE_ERROR",
    NOT_FOUND = "NOT_FOUND",
    BACKUP_ERROR = "BACKUP_ERROR",
    RESTORE_ERROR = "RESTORE_ERROR"
}
export declare class KeystoreError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export interface EncryptedKeystore {
    version: number;
    address: string;
    mnemonic: string;
    crypto: {
        cipher: string;
        ciphertext: string;
        cipherparams: {
            iv: string;
        };
        kdf: string;
        kdfparams: {
            dklen: number;
            n: number;
            r: number;
            p: number;
            salt: string;
        };
        mac: string;
    };
}
export declare class Keystore {
    private static readonly VERSION;
    private static readonly CIPHER;
    private static readonly KDF;
    private static readonly KDF_PARAMS;
    private static readonly MIN_PASSWORD_LENGTH;
    private static readonly MAX_ENCRYPTION_TIME;
    private static database;
    private static readonly MAX_ATTEMPTS;
    private static readonly LOCKOUT_TIME;
    private static attempts;
    private static readonly ROTATION_PERIOD;
    private static readonly MAX_KEY_AGE;
    private static rotationMetadata;
    static initialize(): Promise<void>;
    static encrypt(keyPair: HybridKeyPair, password: string, address: string): Promise<EncryptedKeystore>;
    static decryptFromAddress(address: string, password: string): Promise<HybridKeyPair>;
    static decrypt(keystore: EncryptedKeystore, password: string): Promise<HybridKeyPair>;
    private static encryptKeyPair;
    private static decryptKeystore;
    private static generateSecureSalt;
    private static generateSecureIV;
    private static deriveMultipleKeys;
    private static deriveKey;
    private static calculateEnhancedMAC;
    private static verifyMAC;
    private static validateInputs;
    private static validatePassword;
    private static validatePasswordStrength;
    private static encryptWithTimeout;
    private static decryptWithTimeout;
    private static secureSerialize;
    private static secureDeserialize;
    private static validateKeystore;
    private static validateKDFParams;
    private static isValidBase64;
    private static secureCleanup;
    private static checkRateLimit;
    private static incrementAttempts;
    static rotateKey(address: string, password: string): Promise<EncryptedKeystore>;
    static checkRotationNeeded(address: string): Promise<boolean>;
    static getKeyRotationStatus(address: string): KeyRotationMetadata | null;
    static backup(address: string): Promise<string>;
    static restore(backupData: string, password: string): Promise<string>;
    static healthCheck(): Promise<boolean>;
}
