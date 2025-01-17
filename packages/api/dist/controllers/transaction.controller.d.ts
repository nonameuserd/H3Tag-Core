import { TransactionService } from "../services/transaction.service";
import { TransactionResponseDto } from "../dtos/transaction.dto";
import { SendRawTransactionDto } from "../dtos/transaction.dto";
import { RawTransactionResponseDto } from "../dtos/transaction.dto";
import { DecodeRawTransactionDto, DecodedTransactionDto } from "../dtos/transaction.dto";
import { EstimateFeeRequestDto, EstimateFeeResponseDto } from "../dtos/transaction.dto";
import { SignMessageRequestDto, SignMessageResponseDto } from "../dtos/transaction.dto";
import { VerifyMessageRequestDto, VerifyMessageResponseDto } from "../dtos/transaction.dto";
import { ValidateAddressRequestDto, ValidateAddressResponseDto } from "../dtos/transaction.dto";
export declare class TransactionController {
    private readonly transactionService;
    constructor(transactionService: TransactionService);
    getTransaction(txId: string): Promise<TransactionResponseDto>;
    sendRawTransaction(sendRawTxDto: SendRawTransactionDto): Promise<{
        txId: string;
    }>;
    getRawTransaction(txId: string): Promise<RawTransactionResponseDto>;
    decodeRawTransaction(decodeDto: DecodeRawTransactionDto): Promise<DecodedTransactionDto>;
    estimateFee(estimateFeeDto: EstimateFeeRequestDto): Promise<EstimateFeeResponseDto>;
    signMessage(signMessageDto: SignMessageRequestDto): Promise<SignMessageResponseDto>;
    verifyMessage(verifyMessageDto: VerifyMessageRequestDto): Promise<VerifyMessageResponseDto>;
    validateAddress(validateAddressDto: ValidateAddressRequestDto): Promise<ValidateAddressResponseDto>;
}
