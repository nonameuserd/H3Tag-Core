import { BlockchainService } from "../services/blockchain.service";
import { BlockchainStatsDto, TransactionSubmitDto, BlockResponseDto, FirstTransactionResponseDto, TransactionValidationResponseDto, UtxoDto, ChainTipDto, DifficultyResponseDto, BestBlockHashDto, BlockchainInfoDto } from "../dtos/blockchain.dto";
export declare class BlockchainController {
    private readonly blockchainService;
    constructor(blockchainService: BlockchainService);
    getStats(): Promise<BlockchainStatsDto>;
    submitTransaction(transaction: TransactionSubmitDto): Promise<{
        txId: string;
    }>;
    getBlock(hash: string): Promise<BlockResponseDto>;
    getCurrencyDetails(): Promise<any>;
    getFirstTransaction(address: string): Promise<FirstTransactionResponseDto>;
    validateTransaction(transaction: TransactionSubmitDto): Promise<TransactionValidationResponseDto>;
    getUtxos(address: string): Promise<UtxoDto[]>;
    getHeight(): Promise<number>;
    getVersion(): Promise<number>;
    getNode(): Promise<any>;
    getChainTips(): Promise<ChainTipDto[]>;
    getCurrentDifficulty(): Promise<DifficultyResponseDto>;
    getBestBlockHash(): Promise<BestBlockHashDto>;
    getBlockchainInfo(): Promise<BlockchainInfoDto>;
}
