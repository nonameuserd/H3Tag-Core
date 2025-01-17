import { TransactionType } from '@h3tag-blockchain/core';
export declare class MempoolInfoDto {
    size: number;
    bytes: number;
    usage: number;
    maxSize: number;
    maxMemoryUsage: number;
    currentMemoryUsage: number;
    loadFactor: number;
    fees: {
        base: number;
        current: number;
        mean: number;
        median: number;
        min: number;
        max: number;
    };
    transactions: {
        total: number;
        pending: number;
        distribution: Record<TransactionType, number>;
    };
    age: {
        oldest: number;
        youngest: number;
    };
    health: {
        status: 'healthy' | 'degraded' | 'critical';
        lastUpdate: number;
        isAcceptingTransactions: boolean;
    };
}
export declare class RawMempoolEntryDto {
    txid: string;
    fee: number;
    vsize: number;
    weight: number;
    time: number;
    height: number;
    descendantcount: number;
    descendantsize: number;
    ancestorcount: number;
    ancestorsize: number;
    depends: string[];
}
export declare class MempoolEntryDto {
    txid: string;
    fee: number;
    vsize: number;
    weight: number;
    time: number;
    height: number;
    descendantcount: number;
    descendantsize: number;
    ancestorcount: number;
    ancestorsize: number;
    depends: string[];
}
