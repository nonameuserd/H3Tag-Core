import { Block } from "../models/block.model";
import { UTXOSet } from "../models/utxo.model";
import { Mempool } from "../blockchain/mempool";
import { BlockchainStats } from "../blockchain/blockchain-stats";
export declare class BlockValidationError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare class BlockValidator {
    private readonly eventEmitter;
    private static readonly BLOCK_CONSTANTS;
    private static readonly REWARD_CONSTANTS;
    private static readonly CACHE_DURATION;
    private static blockSizeCache;
    private static validatorSet;
    private static readonly VALIDATOR_CONSTANTS;
    static validateBlock(block: Block, previousBlock: Block | null, utxoSet: UTXOSet): Promise<boolean>;
    private static createTimeout;
    private static performValidation;
    private static validateBlockStructure;
    private static validateBlockSize;
    private static validateTimestamp;
    private static validatePreviousBlock;
    private static validateMerkleRoot;
    private static validateTransactions;
    private static calculateMerkleRoot;
    private static hashTransaction;
    private static hashPair;
    private static hashData;
    private static validateProofOfWork;
    private static validateVotes;
    private static validateVoteSignatures;
    private static validateTransactionBatch;
    private static isCoinbaseTransaction;
    private static validateCoinbase;
    private static validateTransaction;
    private static calculateBlockReward;
    private static getCurrentHeight;
    private static blockchain;
    static setBlockchain(chain: {
        getCurrentHeight(): number;
        getLatestBlock(): Block | null;
        getMempool(): Mempool;
        getBlockchainStats(): BlockchainStats;
    }): void;
    private static meetsHashTarget;
    private static calculateBlockHash;
    private static calculateDifficultyTarget;
    static calculateDynamicBlockSize(block: Block): Promise<number>;
    private static getPreviousBlockSize;
    private static calculateBlockSize;
    private static validateBlockValidators;
    private static verifyValidatorSignatures;
    private static cleanupValidatorSet;
    on(event: string, listener: (...args: unknown[]) => void): void;
    off(event: string, listener: (...args: unknown[]) => void): void;
    removeAllListeners(): void;
}
