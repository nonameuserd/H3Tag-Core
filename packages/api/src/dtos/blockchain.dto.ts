import { ApiProperty } from "@nestjs/swagger";

export class BlockchainStatsDto {
  @ApiProperty({ description: "Current blockchain height" })
  height: number;

  @ApiProperty({ description: "Total number of transactions" })
  totalTransactions: number;

  @ApiProperty({ description: "Current difficulty" })
  difficulty: number;

  @ApiProperty({ description: "Network hashrate" })
  hashrate: number;

  @ApiProperty({ description: "Current block time in seconds" })
  blockTime: number;
}

export class TransactionSubmitDto {
  @ApiProperty({
    description: "Transaction sender address",
    example: "0x1234...",
  })
  sender: string;

  @ApiProperty({
    description: "Transaction recipient address",
    example: "0x5678...",
  })
  recipient: string;

  @ApiProperty({
    description: "Transaction amount",
    example: "100",
  })
  amount: string;

  @ApiProperty({
    description: "Transaction signature",
    example: "base64_encoded_signature",
  })
  signature: string;
}

export class BlockResponseDto {
  @ApiProperty({ description: "Block hash" })
  hash: string;

  @ApiProperty({ description: "Block height" })
  height: number;

  @ApiProperty({ description: "Previous block hash" })
  previousHash: string;

  @ApiProperty({ description: "Block timestamp" })
  timestamp: number;

  @ApiProperty({ description: "Block transactions" })
  transactions: any[];

  @ApiProperty({ description: "Block merkle root" })
  merkleRoot: string;
}

export class UtxoDto {
  @ApiProperty({
    description: "Transaction ID",
    example: "1234abcd...",
  })
  txid: string;

  @ApiProperty({
    description: "Output index",
    example: 0,
  })
  vout: number;

  @ApiProperty({
    description: "Amount in smallest unit",
    example: "1000000",
  })
  amount: number;

  @ApiProperty({
    description: "Number of confirmations",
    example: 6,
  })
  confirmations: number;
}

export class FirstTransactionResponseDto {
  @ApiProperty({
    description: "Block height of first transaction",
    example: 12345,
  })
  blockHeight: number;
}

export class TransactionValidationResponseDto {
  @ApiProperty({
    description: "Whether the transaction is valid",
    example: true,
  })
  isValid: boolean;
}

export class TransactionValidationRequestDto {
  @ApiProperty({
    description: "Transaction to validate",
  })
  transaction: TransactionSubmitDto;
}

export class ChainTipDto {
  @ApiProperty({ description: "Hash of the block at the tip" })
  hash: string;

  @ApiProperty({ description: "Height of the block" })
  height: number;

  @ApiProperty({
    description: "Status of the chain tip",
    enum: ["active", "valid-fork", "invalid", "valid-headers"],
    example: "active",
  })
  status: "active" | "valid-fork" | "invalid" | "valid-headers";

  @ApiProperty({ description: "Branch length from the main chain" })
  branchLength: number;
}

export class DifficultyResponseDto {
  @ApiProperty({
    description: "Current mining difficulty",
    example: 4.2,
  })
  difficulty: number;
}

export class BestBlockHashDto {
  @ApiProperty({
    description: "Hash of the best (latest) block in the chain",
    example: "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
  })
  hash: string;
}

export class BlockchainInfoDto {
  @ApiProperty({ description: "Current blockchain height" })
  blocks: number;

  @ApiProperty({ description: "Best block hash" })
  bestBlockHash: string;

  @ApiProperty({ description: "Current difficulty" })
  difficulty: number;

  @ApiProperty({ description: "Median time past" })
  medianTime: number;

  @ApiProperty({ description: "Verification progress" })
  verificationProgress: number;

  @ApiProperty({ description: "Chain work in hex" })
  chainWork: string;

  @ApiProperty({ description: "Chain state size on disk" })
  chainSize: number;

  @ApiProperty({ description: "Is initial block download" })
  initialBlockDownload: boolean;

  @ApiProperty({ description: "Network hashrate" })
  networkHashrate: number;

  @ApiProperty({ description: "Chain tips information" })
  chainTips: ChainTipDto[];
}
