import { ApiProperty } from "@nestjs/swagger";

export class TransactionInputDto {
  @ApiProperty({ description: "Input transaction ID" })
  txId: string;

  @ApiProperty({ description: "Output index in the input transaction" })
  outputIndex: number;

  @ApiProperty({ description: "Input amount" })
  amount: string;

  @ApiProperty({ description: "Input address" })
  address: string;
}

export class TransactionOutputDto {
  @ApiProperty({ description: "Output address" })
  address: string;

  @ApiProperty({ description: "Output amount" })
  amount: string;

  @ApiProperty({ description: "Output index" })
  index: number;
}

export class TransactionResponseDto {
  @ApiProperty({
    description: "Transaction ID",
    example: "123abc...",
  })
  id: string;

  @ApiProperty({
    description: "Transaction sender address",
    example: "0x1234...",
  })
  fromAddress: string;

  @ApiProperty({
    description: "Transaction recipient address",
    example: "0x5678...",
  })
  toAddress: string;

  @ApiProperty({
    description: "Transaction amount",
    example: "100",
  })
  amount: string;

  @ApiProperty({
    description: "Transaction timestamp",
    example: "2024-03-20T10:30:00Z",
  })
  timestamp: string;

  @ApiProperty({
    description: "Block height where transaction was included",
    example: 12345,
  })
  blockHeight?: number;

  @ApiProperty({
    description: "Number of confirmations",
    example: 6,
  })
  confirmations: number;

  @ApiProperty({
    description: "Transaction fee",
    example: "0.001",
  })
  fee: string;

  @ApiProperty({
    description: "Transaction type",
    enum: ["standard", "transfer", "coinbase", "pow_reward", "quadratic_vote"],
  })
  type: string;

  @ApiProperty({
    description: "Transaction status",
    enum: ["pending", "confirmed", "failed"],
  })
  status: string;

  @ApiProperty({
    description: "Transaction hash",
    example: "0x1234...",
  })
  hash: string;

  @ApiProperty({ type: [TransactionInputDto] })
  inputs: TransactionInputDto[];

  @ApiProperty({ type: [TransactionOutputDto] })
  outputs: TransactionOutputDto[];
}

export class SendRawTransactionDto {
  @ApiProperty({
    description: "Raw transaction hex string",
    example: "0200000001ab3...",
  })
  rawTransaction: string;
}

export class RawTransactionResponseDto {
  @ApiProperty({
    description: "Raw transaction hex string",
    example: "0100000001...",
  })
  hex: string;

  @ApiProperty({
    description: "Transaction ID",
    example: "1234abcd...",
  })
  txid: string;
}

export class DecodeRawTransactionDto {
  @ApiProperty({
    description: "Raw transaction hex string to decode",
    example: "0200000001...",
  })
  rawTransaction: string;
}

export class DecodedTransactionDto {
  @ApiProperty({
    description: "Transaction ID",
    example: "1234abcd...",
  })
  txid: string;

  @ApiProperty({
    description: "Transaction hash",
    example: "abcd1234...",
  })
  hash: string;

  @ApiProperty({
    description: "Transaction version",
    example: 2,
  })
  version: number;

  @ApiProperty({
    description: "Transaction inputs",
    type: [Object],
  })
  vin: any[];

  @ApiProperty({
    description: "Transaction outputs",
    type: [Object],
  })
  vout: any[];
}

export class EstimateFeeRequestDto {
  @ApiProperty({
    description:
      "Number of blocks within which the transaction should be included",
    example: 6,
    minimum: 1,
    maximum: 1008,
    default: 6,
  })
  targetBlocks?: number;
}

export class EstimateFeeResponseDto {
  @ApiProperty({
    description: "Estimated fee in smallest currency unit",
    example: "1000",
  })
  estimatedFee: string;

  @ApiProperty({
    description: "Target number of blocks for confirmation",
    example: 6,
  })
  targetBlocks: number;
}

export class SignMessageRequestDto {
  @ApiProperty({
    description: "Message to sign",
    example: "Hello, World!",
  })
  message: string;

  @ApiProperty({
    description: "Private key in hex format (64 characters)",
    example: "abcd1234...",
    minLength: 64,
    maxLength: 64,
    pattern: "^[a-f0-9]{64}$",
  })
  privateKey: string;
}

export class SignMessageResponseDto {
  @ApiProperty({
    description: "Combined signature hash",
    example: "ef123...",
  })
  signature: string;
}

export class VerifyMessageRequestDto {
  @ApiProperty({
    description: "Message that was signed",
    example: "Hello, World!",
  })
  message: string;

  @ApiProperty({
    description: "Signature to verify",
    example: "abc123...",
    pattern: "^[a-f0-9]{128}$",
  })
  signature: string;

  @ApiProperty({
    description: "Public key in hex format",
    example: "def456...",
    pattern: "^[a-f0-9]{130}$",
  })
  publicKey: string;
}

export class VerifyMessageResponseDto {
  @ApiProperty({
    description: "Whether the signature is valid",
    example: true,
  })
  isValid: boolean;
}

export class ValidateAddressRequestDto {
  @ApiProperty({
    description: "Blockchain address to validate",
    example: "TAG1234...",
    minLength: 25,
    maxLength: 34,
  })
  address: string;
}

export class ValidateAddressResponseDto {
  @ApiProperty({
    description: "Whether the address is valid",
    example: true,
  })
  isValid: boolean;

  @ApiProperty({
    description: "Network type of the address",
    example: "mainnet",
    enum: ["mainnet", "testnet", "devnet"],
  })
  network?: string;
}

export { TransactionResponseDto as TransactionDto };
