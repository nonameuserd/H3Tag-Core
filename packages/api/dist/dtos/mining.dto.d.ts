import { TransactionDto } from './transaction.dto';
import { HybridKeyPair } from '@h3tag-blockchain/crypto';
export declare class MiningInfoDto {
    blocks: number;
    difficulty: number;
    networkHashrate: number;
    reward: number;
    chainWork: string;
    isNetworkMining: boolean;
    networkHashPS: number;
}
export declare class BlockTemplateDto {
    version: number;
    height: number;
    previousHash: string;
    timestamp: number;
    difficulty: number;
    transactions: TransactionDto[];
    merkleRoot: string;
    target: string;
    minTime: number;
    maxTime: number;
    maxVersion: number;
    minVersion: number;
    defaultVersion: number;
}
export declare class BlockTemplateRequestDto {
    minerAddress: string;
}
export declare class SubmitBlockDto {
    header: {
        version: number;
        previousHash: string;
        merkleRoot: string;
        timestamp: number;
        difficulty: number;
        nonce: number;
    };
    transactions: any[];
    minerKeyPair: HybridKeyPair;
}
