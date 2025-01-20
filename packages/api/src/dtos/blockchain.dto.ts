import { ApiProperty } from '@nestjs/swagger';

export class BlockchainStatsDto {
  @ApiProperty({ description: 'Current blockchain height' })
  height: number | undefined;

  @ApiProperty({ description: 'Total number of transactions' })
  totalTransactions: number | undefined;

  @ApiProperty({ description: 'Current difficulty' })
  difficulty: number | undefined;

  @ApiProperty({ description: 'Network hashrate' })
  hashrate: number | undefined;

  @ApiProperty({ description: 'Current block time in seconds' })
  blockTime: number | undefined;
}

export class TransactionSubmitDto {
  @ApiProperty({
    description: 'Transaction sender address',
    example: '0x1234...',
  })
  sender: string | undefined;

  @ApiProperty({
    description: 'Transaction recipient address',
    example: '0x5678...',
  })
  recipient: string | undefined;

  @ApiProperty({
    description: 'Transaction amount',
    example: '100',
  })
  amount: string | undefined;

  @ApiProperty({
    description: 'Transaction signature',
    example: 'base64_encoded_signature',
  })
  signature: string | undefined;

  @ApiProperty({
    description: 'Transaction confirmations',
    example: 6,
  })
  confirmations: number | undefined;
}

export class BlockResponseDto {
  @ApiProperty({ description: 'Block hash' })
  hash: string | undefined;

  @ApiProperty({ description: 'Block height' })
  height: number | undefined;

  @ApiProperty({ description: 'Previous block hash' })
  previousHash: string | undefined;

  @ApiProperty({ description: 'Block timestamp' })
  timestamp: number | undefined;

  @ApiProperty({ description: 'Block transactions' })
  transactions: BlockTransactionDto[] | undefined;

  @ApiProperty({ description: 'Block merkle root' })
  merkleRoot: string | undefined;
}

export class UtxoDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: '1234abcd...',
  })
  txid: string | undefined;

  @ApiProperty({
    description: 'Output index',
    example: 0,
  })
  vout: number | undefined;

  @ApiProperty({
    description: 'Amount in smallest unit',
    example: '1000000',
  })
  amount: number | undefined;

  @ApiProperty({
    description: 'Number of confirmations',
    example: 6,
  })
  confirmations: number | undefined;
}

export class FirstTransactionResponseDto {
  @ApiProperty({
    description: 'Block height of first transaction',
    example: 12345,
  })
  blockHeight: number | undefined;
}

export class TransactionValidationResponseDto {
  @ApiProperty({
    description: 'Whether the transaction is valid',
    example: true,
  })
  isValid: boolean | undefined;
}

export class TransactionValidationRequestDto {
  @ApiProperty({
    description: 'Transaction to validate',
  })
  transaction: TransactionSubmitDto | undefined;
}

export class ChainTipDto {
  @ApiProperty({ description: 'Hash of the block at the tip' })
  hash: string | undefined;

  @ApiProperty({ description: 'Height of the block' })
  height: number | undefined;

  @ApiProperty({
    description: 'Status of the chain tip',
    enum: ['active', 'valid-fork', 'invalid', 'valid-headers'],
    example: 'active',
  })
  status: 'active' | 'valid-fork' | 'invalid' | 'valid-headers' | undefined;

  @ApiProperty({ description: 'Branch length from the main chain' })
  branchLength: number | undefined;
}

export class DifficultyResponseDto {
  @ApiProperty({
    description: 'Current mining difficulty',
    example: 4.2,
  })
  difficulty: number | undefined;
}

export class BestBlockHashDto {
  @ApiProperty({
    description: 'Hash of the best (latest) block in the chain',
    example: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f',
  })
  hash: string | undefined;
}

export class BlockchainInfoDto {
  @ApiProperty({ description: 'Current blockchain height' })
  blocks: number | undefined;

  @ApiProperty({ description: 'Best block hash' })
  bestBlockHash: string | undefined;

  @ApiProperty({ description: 'Current difficulty' })
  difficulty: number | undefined;

  @ApiProperty({ description: 'Median time past' })
  medianTime: number | undefined;

  @ApiProperty({ description: 'Verification progress' })
  verificationProgress: number | undefined;

  @ApiProperty({ description: 'Chain work in hex' })
  chainWork: string | undefined;

  @ApiProperty({ description: 'Chain state size on disk' })
  chainSize: number | undefined;

  @ApiProperty({ description: 'Is initial block download' })
  initialBlockDownload: boolean | undefined;

  @ApiProperty({ description: 'Network hashrate' })
  networkHashrate: number | undefined;

  @ApiProperty({ description: 'Chain tips information' })
  chainTips: ChainTipDto[] | undefined;
}

export class BlockTransactionDto {
  @ApiProperty({ description: 'Transaction hash' })
  hash: string | undefined;

  @ApiProperty({ description: 'Transaction amount' })
  amount: number | undefined;

  @ApiProperty({ description: 'Number of confirmations' })
  confirmations: number | undefined;

  @ApiProperty({ description: 'Transaction timestamp' })
  timestamp: number | undefined;

  @ApiProperty({ description: 'Transaction type' })
  type: string | undefined;

  @ApiProperty({ description: 'Transaction status' })
  status: string | undefined;

  @ApiProperty({ description: 'Sender address' })
  fromAddress: string | undefined;

  @ApiProperty({ description: 'Recipient address' })
  toAddress: string | undefined;
}
