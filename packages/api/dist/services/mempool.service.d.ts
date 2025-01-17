import { MempoolInfoDto } from '../dtos/mempool.dto';
import { Node } from '@h3tag-blockchain/core';
import { RawMempoolEntryDto } from '../dtos/mempool.dto';
import { MempoolEntryDto } from '../dtos/mempool.dto';
export declare class MempoolService {
    private readonly node;
    constructor(node: Node);
    getMempoolInfo(): Promise<MempoolInfoDto>;
    getRawMempool(verbose?: boolean): Promise<Record<string, RawMempoolEntryDto> | string[]>;
    getMempoolEntry(txid: string): Promise<MempoolEntryDto>;
}
