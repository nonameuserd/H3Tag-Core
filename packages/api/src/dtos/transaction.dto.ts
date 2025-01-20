import { ApiProperty } from '@nestjs/swagger';

export class TransactionInputDto {
  @ApiProperty({ description: 'Input transaction ID' })
  txId: string | undefined;

  @ApiProperty({ description: 'Output index in the input transaction' })
  outputIndex: number | undefined;

  @ApiProperty({ description: 'Input amount' })
  amount: string | undefined;

  @ApiProperty({ description: 'Input address' })
  address: string | undefined;
}

export class TransactionOutputDto {
  @ApiProperty({ description: 'Output address' })
  address: string | undefined;

  @ApiProperty({ description: 'Output amount' })
  amount: string | undefined;

  @ApiProperty({ description: 'Output index' })
  index: number | undefined;
}

export class TransactionResponseDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: '123abc...',
  })
  id: string | undefined;

  @ApiProperty({
    description: 'Transaction sender address',
    example: '0x1234...',
  })
  fromAddress: string | undefined;

  @ApiProperty({
    description: 'Transaction recipient address',
    example: '0x5678...',
  })
  toAddress: string | undefined;

  @ApiProperty({
    description: 'Transaction amount',
    example: '100',
  })
  amount: bigint | undefined;

  @ApiProperty({
    description: 'Transaction timestamp',
    example: '2024-03-20T10:30:00Z',
  })
  timestamp: string | undefined;

  @ApiProperty({
    description: 'Block height where transaction was included',
    example: 12345,
  })
  blockHeight?: number | undefined;

  @ApiProperty({
    description: 'Number of confirmations',
    example: 6,
  })
  confirmations: number | undefined;

  @ApiProperty({
    description: 'Transaction fee',
    example: '0.001',
  })
  fee: string | undefined;

  @ApiProperty({
    description: 'Transaction type',
    enum: ['standard', 'transfer', 'coinbase', 'pow_reward', 'quadratic_vote'],
  })
  type: string | undefined;

  @ApiProperty({
    description: 'Transaction status',
    enum: ['pending', 'confirmed', 'failed'],
  })
  status: string | undefined;

  @ApiProperty({
    description: 'Transaction hash',
    example: '0x1234...',
  })
  hash: string | undefined;

  @ApiProperty({ type: [TransactionInputDto] })
  inputs: TransactionInputDto[] | undefined;

  @ApiProperty({ type: [TransactionOutputDto] })
  outputs: TransactionOutputDto[] | undefined;
}

export class SendRawTransactionDto {
  @ApiProperty({
    description: 'Raw transaction hex string',
    example: '0200000001ab3...',
  })
  rawTransaction: string | undefined;
}

export class RawTransactionResponseDto {
  @ApiProperty({
    description: 'Raw transaction hex string',
    example: '0100000001...',
  })
  hex: string | undefined;

  @ApiProperty({
    description: 'Transaction ID',
    example: '1234abcd...',
  })
  txid: string | undefined;
}

export class DecodeRawTransactionDto {
  @ApiProperty({
    description: 'Raw transaction hex string to decode',
    example: '0200000001...',
  })
  rawTransaction: string | undefined;
}

export class DecodedTransactionDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: '1234abcd...',
  })
  txid: string | undefined;

  @ApiProperty({
    description: 'Transaction hash',
    example: 'abcd1234...',
  })
  hash: string | undefined;

  @ApiProperty({
    description: 'Transaction version',
    example: 2,
  })
  version: number | undefined;

  @ApiProperty({
    description: 'Transaction inputs',
    type: [Object],
  })
  vin: TransactionInputDto[] | undefined;

  @ApiProperty({
    description: 'Transaction outputs',
    type: [Object],
  })
  vout: TransactionOutputDto[] | undefined;
}

export class EstimateFeeRequestDto {
  @ApiProperty({
    description:
      'Number of blocks within which the transaction should be included',
    example: 6,
    minimum: 1,
    maximum: 1008,
    default: 6,
  })
  targetBlocks?: number | undefined;
}

export class EstimateFeeResponseDto {
  @ApiProperty({
    description: 'Estimated fee in smallest currency unit',
    example: '1000',
  })
  estimatedFee: string | undefined;

  @ApiProperty({
    description: 'Target number of blocks for confirmation',
    example: 6,
  })
  targetBlocks?: number | undefined;
}

export class SignMessageRequestDto {
  @ApiProperty({
    description: 'Message to sign',
    example: 'Hello, World!',
  })
  message: string | undefined;

  @ApiProperty({
    description: 'Private key in hex format (64 characters)',
    example: 'abcd1234...',
    minLength: 64,
    maxLength: 64,
    pattern: '^[a-f0-9]{64}$',
  })
  privateKey: string | undefined;
}

export class SignMessageResponseDto {
  @ApiProperty({
    description: 'Combined signature hash',
    example: 'ef123...',
  })
  signature: string | undefined;
}

export class VerifyMessageRequestDto {
  @ApiProperty({
    description: 'Message that was signed',
    example: 'Hello, World!',
  })
  message: string | undefined;

  @ApiProperty({
    description: 'Signature to verify',
    example: 'abc123...',
    pattern: '^[a-f0-9]{128}$',
  })
  signature: string | undefined;

  @ApiProperty({
    description: 'Public key in hex format',
    example: 'def456...',
    pattern: '^[a-f0-9]{130}$',
  })
  publicKey: string | undefined;
}

export class VerifyMessageResponseDto {
  @ApiProperty({
    description: 'Whether the signature is valid',
    example: true,
  })
  isValid: boolean | undefined;
}

export class ValidateAddressRequestDto {
  @ApiProperty({
    description: 'Blockchain address to validate',
    example: 'TAG1234...',
    minLength: 25,
    maxLength: 34,
  })
  address: string | undefined;
}

export class ValidateAddressResponseDto {
  @ApiProperty({
    description: 'Whether the address is valid',
    example: true,
  })
  isValid: boolean | undefined;

  @ApiProperty({
    description: 'Network type of the address',
    example: 'mainnet',
    enum: ['mainnet', 'testnet', 'devnet'],
  })
  network?: string | undefined;
}

export { TransactionResponseDto as TransactionDto };
