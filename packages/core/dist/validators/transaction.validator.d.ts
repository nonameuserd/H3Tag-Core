import { Transaction } from "../models/transaction.model";
import { UTXOSet } from "../models/utxo.model";
export declare class TransactionValidator {
    private static readonly VOTE_HEIGHT_KEY_PREFIX;
    private static readonly db;
    private static readonly voteLock;
    private static readonly voteHeightCache;
    static validateTransaction(tx: Transaction, utxoSet: UTXOSet, currentHeight: number): Promise<boolean>;
    private static validateBasicRequirements;
    private static validatePoWTransaction;
    private static validateVoteTransaction;
    private static calculateVotingPower;
    private static validateSignatures;
    private static calculateTransactionPoW;
    private static isValidHash;
    private static validateInputsAndOutputs;
    private static calculateInputSum;
    private static getTransactionUTXOs;
    private static getLastVoteHeight;
    private static setLastVoteHeight;
    private static calculateHashDifficulty;
    private static verifyInputSignature;
    /**
     * Validates transaction size against network limits
     */
    static validateTransactionSize(tx: Transaction): boolean;
    /**
     * Calculates required transaction fee based on size
     */
    static calculateTransactionFee(tx: Transaction): bigint;
    /**
     * Calculates transaction size in bytes
     */
    static calculateTransactionSize(tx: Transaction): number;
    /**
     * Validates transaction version
     */
    static validateTransactionVersion(tx: Transaction): boolean;
}
