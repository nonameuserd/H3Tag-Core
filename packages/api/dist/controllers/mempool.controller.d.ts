import { MempoolInfoDto, RawMempoolEntryDto, MempoolEntryDto } from "../dtos/mempool.dto";
import { MempoolService } from "../services/mempool.service";
export declare class MempoolController {
    private readonly mempoolService;
    constructor(mempoolService: MempoolService);
    getMempoolInfo(): Promise<MempoolInfoDto>;
    getRawMempool(verbose?: boolean): Promise<Record<string, RawMempoolEntryDto> | string[]>;
    getMempoolEntry(txid: string): Promise<MempoolEntryDto>;
}
