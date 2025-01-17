import { WalletService } from "../services/wallet.service";
import { CreateWalletDto, WalletResponseDto, SignTransactionDto, SendToAddressDto, WalletBalanceDto, NewAddressResponseDto, ExportPrivateKeyDto, ImportPrivateKeyDto, UnspentOutputDto, TxOutDto } from "../dtos/wallet.dto";
export declare class WalletController {
    private readonly walletService;
    constructor(walletService: WalletService);
    createWallet(createWalletDto: CreateWalletDto): Promise<WalletResponseDto>;
    getWallet(address: string): Promise<WalletResponseDto>;
    signTransaction(address: string, signTransactionDto: SignTransactionDto): Promise<{
        signature: string;
    }>;
    sendToAddress(fromAddress: string, sendToAddressDto: SendToAddressDto): Promise<{
        txId: string;
    }>;
    getBalance(address: string): Promise<WalletBalanceDto>;
    getNewAddress(address: string): Promise<NewAddressResponseDto>;
    exportPrivateKey(address: string, exportDto: ExportPrivateKeyDto): Promise<{
        privateKey: string;
    }>;
    importPrivateKey(importDto: ImportPrivateKeyDto): Promise<WalletResponseDto>;
    listUnspent(address: string): Promise<UnspentOutputDto[]>;
    getTxOut(txid: string, n: number): Promise<TxOutDto>;
}
