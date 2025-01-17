import { Transaction } from "../models/transaction.model";
import { UTXO } from '../models/utxo.model';
export declare class WalletError extends Error {
    readonly code: WalletErrorCode;
    constructor(message: string, code: WalletErrorCode);
}
export declare enum WalletErrorCode {
    INITIALIZATION_ERROR = "INITIALIZATION_ERROR",
    TRANSACTION_ERROR = "TRANSACTION_ERROR",
    KEYSTORE_ERROR = "KEYSTORE_ERROR",
    INVALID_STATE = "INVALID_STATE",
    INVALID_PASSWORD = "INVALID_PASSWORD",
    CLEANUP_ERROR = "CLEANUP_ERROR",
    LOCK_ERROR = "LOCK_ERROR"
}
export declare class Wallet {
    private static readonly DERIVATION_PATH;
    private readonly keyPair;
    private readonly address;
    private isLocked;
    private readonly keystore;
    private lockMutex;
    private readonly eventEmitter;
    private readonly state;
    private readonly utxoSet;
    private updateState;
    private constructor();
    private secureCleanup;
    static create(password: string): Promise<Wallet>;
    static load(address: string, password: string): Promise<Wallet>;
    lock(): Promise<void>;
    unlock(password: string): Promise<void>;
    signTransaction(transaction: Transaction, password: string): Promise<string>;
    getAddress(): string;
    isUnlocked(): boolean;
    backup(password: string): Promise<string>;
    rotateKeys(password: string): Promise<void>;
    static createWithMnemonic(password: string): Promise<{
        wallet: Wallet;
        mnemonic: string;
    }>;
    static fromMnemonic(mnemonic: string, password: string): Promise<Wallet>;
    verifyMnemonic(mnemonic: string): Promise<boolean>;
    private cleanup;
    close(): Promise<void>;
    generateId(): string;
    sendToAddress(recipientAddress: string, amount: string, password: string, memo?: string): Promise<string>;
    verify(): Promise<boolean>;
    /**
     * Get the current balance of the wallet
     * @returns Promise<{ confirmed: bigint, unconfirmed: bigint }>
     */
    getBalance(): Promise<{
        confirmed: bigint;
        unconfirmed: bigint;
    }>;
    /**
     * Generate a new address from the wallet's HD key path
     * @returns Promise<string> The newly generated address
     */
    getNewAddress(): Promise<string>;
    /**
     * Export the wallet's private key
     * @param password Current wallet password for verification
     * @returns Promise<string> Encrypted private key
     */
    exportPrivateKey(password: string): Promise<string>;
    /**
     * Import a private key and create a new wallet
     * @param encryptedKey Encrypted private key
     * @param originalAddress Original wallet address
     * @param password Password to decrypt key and create wallet
     * @returns Promise<Wallet> New wallet instance
     */
    static importPrivateKey(encryptedKey: string, originalAddress: string, password: string): Promise<Wallet>;
    getPublicKey(): string;
    listUnspent(): Promise<UTXO[]>;
}
