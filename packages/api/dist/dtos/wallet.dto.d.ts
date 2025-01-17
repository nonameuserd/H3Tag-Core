export declare class CreateWalletDto {
    password: string;
    mnemonic?: string;
}
export declare class WalletResponseDto {
    address: string;
    publicKey: string;
    balance?: string;
    isLocked?: boolean;
    mnemonic?: string;
}
export interface SignTransactionDto {
    transaction: {
        fromAddress: string;
        toAddress: string;
        amount: number;
        publicKey: string;
        fee?: number;
    };
    password: string;
}
export declare class SendToAddressDto {
    toAddress: string;
    amount: string;
    password: string;
}
export declare class WalletBalanceDto {
    confirmed: string;
    unconfirmed: string;
}
export declare class NewAddressResponseDto {
    address: string;
}
export declare class ExportPrivateKeyDto {
    password: string;
}
export declare class ImportPrivateKeyDto {
    encryptedKey: string;
    originalAddress: string;
    password: string;
}
export declare class UnspentOutputDto {
    txid: string;
    vout: number;
    address: string;
    amount: string;
    confirmations: number;
    spendable: boolean;
}
export declare class TxOutDto {
    txid: string;
    n: number;
    value: string;
    confirmations: number;
    scriptType: string;
    address: string;
    spendable: boolean;
}
