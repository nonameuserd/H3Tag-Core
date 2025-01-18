export declare class TransactionInputDto {
    txId: string;
    outputIndex: number;
    amount: string;
    address: string;
}
export declare class TransactionOutputDto {
    address: string;
    amount: string;
    index: number;
}
export declare class TransactionResponseDto {
    id: string;
    fromAddress: string;
    toAddress: string;
    amount: string;
    timestamp: string;
    blockHeight?: number;
    confirmations: number;
    fee: string;
    type: string;
    status: string;
    hash: string;
    inputs: TransactionInputDto[];
    outputs: TransactionOutputDto[];
}
export declare class SendRawTransactionDto {
    rawTransaction: string;
}
export declare class RawTransactionResponseDto {
    hex: string;
    txid: string;
}
export declare class DecodeRawTransactionDto {
    rawTransaction: string;
}
export declare class DecodedTransactionDto {
    txid: string;
    hash: string;
    version: number;
    vin: TransactionInputDto[];
    vout: TransactionOutputDto[];
}
export declare class EstimateFeeRequestDto {
    targetBlocks?: number;
}
export declare class EstimateFeeResponseDto {
    estimatedFee: string;
    targetBlocks: number;
}
export declare class SignMessageRequestDto {
    message: string;
    privateKey: string;
}
export declare class SignMessageResponseDto {
    signature: string;
}
export declare class VerifyMessageRequestDto {
    message: string;
    signature: string;
    publicKey: string;
}
export declare class VerifyMessageResponseDto {
    isValid: boolean;
}
export declare class ValidateAddressRequestDto {
    address: string;
}
export declare class ValidateAddressResponseDto {
    isValid: boolean;
    network?: string;
}
export { TransactionResponseDto as TransactionDto };
