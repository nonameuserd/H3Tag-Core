import { ApiProperty } from "@nestjs/swagger";
import { TransactionType } from "@h3tag-blockchain/core";

export class MempoolInfoDto {
  @ApiProperty()
  size: number;

  @ApiProperty()
  bytes: number;

  @ApiProperty()
  usage: number;

  @ApiProperty()
  maxSize: number;

  @ApiProperty()
  maxMemoryUsage: number;

  @ApiProperty()
  currentMemoryUsage: number;

  @ApiProperty()
  loadFactor: number;

  @ApiProperty()
  fees: {
    base: number;
    current: number;
    mean: number;
    median: number;
    min: number;
    max: number;
  };

  @ApiProperty()
  transactions: {
    total: number;
    pending: number;
    distribution: Record<TransactionType, number>;
  };

  @ApiProperty()
  age: {
    oldest: number;
    youngest: number;
  };

  @ApiProperty()
  health: {
    status: "healthy" | "degraded" | "critical";
    lastUpdate: number;
    isAcceptingTransactions: boolean;
  };
}

export class RawMempoolEntryDto {
  @ApiProperty()
  txid: string;

  @ApiProperty()
  fee: number;

  @ApiProperty()
  vsize: number;

  @ApiProperty()
  weight: number;

  @ApiProperty()
  time: number;

  @ApiProperty()
  height: number;

  @ApiProperty()
  descendantcount: number;

  @ApiProperty()
  descendantsize: number;

  @ApiProperty()
  ancestorcount: number;

  @ApiProperty()
  ancestorsize: number;

  @ApiProperty({ type: [String] })
  depends: string[];
}

export class MempoolEntryDto {
  @ApiProperty({
    description: "Transaction ID",
    example: "1234abcd...",
  })
  txid: string;

  @ApiProperty({
    description: "Transaction fee",
    example: 0.0001,
  })
  fee: number;

  @ApiProperty({
    description: "Virtual transaction size",
    example: 140,
  })
  vsize: number;

  @ApiProperty({
    description: "Transaction weight",
    example: 560,
  })
  weight: number;

  @ApiProperty({
    description: "Time transaction entered mempool",
    example: 1625097600,
  })
  time: number;

  @ApiProperty({
    description: "Block height when transaction entered mempool",
    example: 680000,
  })
  height: number;

  @ApiProperty({
    description: "Number of descendant transactions",
    example: 2,
  })
  descendantcount: number;

  @ApiProperty({
    description: "Total size of descendant transactions",
    example: 280,
  })
  descendantsize: number;

  @ApiProperty({
    description: "Number of ancestor transactions",
    example: 1,
  })
  ancestorcount: number;

  @ApiProperty({
    description: "Total size of ancestor transactions",
    example: 140,
  })
  ancestorsize: number;

  @ApiProperty({
    description: "Transaction IDs this transaction depends on",
    type: [String],
  })
  depends: string[];
}
