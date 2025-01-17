import { MiningService } from '../services/mining.service';
import { MiningInfoDto } from '../dtos/mining.dto';
import { BlockTemplateDto } from '../dtos/mining.dto';
import { SubmitBlockDto } from '../dtos/mining.dto';
export declare class MiningController {
    private readonly miningService;
    constructor(miningService: MiningService);
    getMiningInfo(): Promise<MiningInfoDto>;
    getNetworkHashPS(): Promise<{
        hashPS: number;
    }>;
    getBlockTemplate(body: {
        minerAddress: string;
    }): Promise<{
        status: string;
        data: BlockTemplateDto;
    }>;
    submitBlock(submitBlockDto: SubmitBlockDto): Promise<{
        status: string;
        blockHash: string;
    }>;
}
