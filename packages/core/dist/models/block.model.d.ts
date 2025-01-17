import { Transaction } from "./transaction.model";
import { Vote } from "./vote.model";
import { Validator } from "./validator";
import { AuditManager } from "../security/audit";
import { HybridKeyPair } from "@h3tag-blockchain/crypto";
export declare class BlockError extends Error {
    constructor(message: string);
}
export interface BlockHeader {
    version: number;
    height: number;
    previousHash: string;
    timestamp: number;
    merkleRoot: string;
    difficulty: number;
    nonce: number;
    miner: string;
    validatorMerkleRoot: string;
    totalTAG: number;
    blockReward: number;
    fees: number;
    target: string;
    consensusData: {
        powScore: number;
        votingScore: number;
        participationRate: number;
        periodId: number;
    };
    signature?: {
        address: string;
    };
    publicKey: string;
    hash: string;
    minerAddress: string;
}
export interface Block {
    hash: string;
    header: BlockHeader;
    transactions: Transaction[];
    metadata?: {
        receivedTimestamp: number;
        consensusMetrics?: {
            powWeight: number;
            votingWeight: number;
            participationRate: number;
        };
    };
    votes: Vote[];
    validators: Validator[];
    timestamp: number;
    verifyHash(): Promise<boolean>;
    verifySignature(): Promise<boolean>;
    getHeaderBase(): string;
    isComplete(): boolean;
}
export declare class BlockBuilder {
    private static readonly CURRENT_VERSION;
    private static readonly MAX_TRANSACTIONS;
    private static readonly MIN_DIFFICULTY;
    private readonly maxTransactionAge;
    header: Block["header"];
    private transactions;
    private votes;
    private validators;
    private readonly merkleTree;
    private readonly mutex;
    private readonly auditManager;
    private hash;
    constructor(previousHash: string, difficulty: number, auditManager: AuditManager);
    private calculateMerkleRoot;
    /**
     * Sets the transactions for the block
     * @param transactions Transactions to set
     * @returns Promise<this> This block builder instance
     */
    setTransactions(transactions: Transaction[]): Promise<this>;
    calculateHash(): Promise<string>;
    build(minerKeyPair: HybridKeyPair): Promise<Block>;
    private validateBlockStructure;
    setHeight(height: number): this;
    setPreviousHash(hash: string): this;
    setTimestamp(timestamp: number): this;
    verifyHash(): Promise<boolean>;
    verifySignature(): Promise<boolean>;
    getHeaderBase(): string;
    setVersion(version: number): this;
    setMerkleRoot(merkleRoot: string): this;
    setDifficulty(difficulty: number): this;
    setNonce(nonce: number): this;
    isComplete(): boolean;
    setHash(hash: string): this;
}
