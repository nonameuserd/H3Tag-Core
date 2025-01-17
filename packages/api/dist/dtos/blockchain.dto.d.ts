export declare class BlockchainStatsDto {
    height: number;
    totalTransactions: number;
    difficulty: number;
    hashrate: number;
    blockTime: number;
}
export declare class TransactionSubmitDto {
    sender: string;
    recipient: string;
    amount: string;
    signature: string;
}
export declare class BlockResponseDto {
    hash: string;
    height: number;
    previousHash: string;
    timestamp: number;
    transactions: any[];
    merkleRoot: string;
}
export declare class UtxoDto {
    txid: string;
    vout: number;
    amount: number;
    confirmations: number;
}
export declare class FirstTransactionResponseDto {
    blockHeight: number;
}
export declare class TransactionValidationResponseDto {
    isValid: boolean;
}
export declare class TransactionValidationRequestDto {
    transaction: TransactionSubmitDto;
}
export declare class ChainTipDto {
    hash: string;
    height: number;
    status: 'active' | 'valid-fork' | 'invalid' | 'valid-headers';
    branchLength: number;
}
export declare class DifficultyResponseDto {
    difficulty: number;
}
export declare class BestBlockHashDto {
    hash: string;
}
export declare class BlockchainInfoDto {
    blocks: number;
    bestBlockHash: string;
    difficulty: number;
    medianTime: number;
    verificationProgress: number;
    chainWork: string;
    chainSize: number;
    initialBlockDownload: boolean;
    networkHashrate: number;
    chainTips: ChainTipDto[];
}
