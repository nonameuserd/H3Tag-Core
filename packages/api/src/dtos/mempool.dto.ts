import { ApiProperty } from '@nestjs/swagger';
import { TransactionType } from '@h3tag-blockchain/core';

export class MempoolInfoDto {
  @ApiProperty()
  size: number | undefined;

  @ApiProperty()
  bytes: number | undefined;

  @ApiProperty()
  usage: number | undefined;

  @ApiProperty()
  maxSize: number | undefined;

  @ApiProperty()
  maxMemoryUsage: number | undefined;

  @ApiProperty()
  currentMemoryUsage: number | undefined;

  @ApiProperty()
  loadFactor: number | undefined;

  @ApiProperty()
  fees:
    | {
        base: number | undefined;
        current: number | undefined;
        mean: number | undefined;
        median: number | undefined;
        min: number | undefined;
        max: number | undefined;
      }
    | undefined;

  @ApiProperty()
  transactions:
    | {
        total: number | undefined;
        pending: number | undefined;
        distribution: Record<TransactionType, number> | undefined;
      }
    | undefined;

  @ApiProperty()
  age:
    | {
        oldest: number | undefined;
        youngest: number | undefined;
      }
    | undefined;

  @ApiProperty()
  health:
    | {
        status: 'healthy' | 'degraded' | 'critical' | undefined;
        lastUpdate: number | undefined;
        isAcceptingTransactions: boolean | undefined;
      }
    | undefined;
}

export class RawMempoolEntryDto {
  @ApiProperty()
  txid: string | undefined;

  @ApiProperty()
  fee: number | undefined;

  @ApiProperty()
  vsize: number | undefined;

  @ApiProperty()
  weight: number | undefined;

  @ApiProperty()
  time: number | undefined;

  @ApiProperty()
  height: number | undefined;

  @ApiProperty()
  descendantcount: number | undefined;

  @ApiProperty()
  descendantsize: number | undefined;

  @ApiProperty()
  ancestorcount: number | undefined;

  @ApiProperty()
  ancestorsize: number | undefined;

  @ApiProperty({ type: [String] })
  depends: string[] | undefined;
}

export class MempoolEntryDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: '1234abcd...',
  })
  txid: string | undefined;

  @ApiProperty({
    description: 'Transaction fee',
    example: 0.0001,
  })
  fee: number | undefined;

  @ApiProperty({
    description: 'Virtual transaction size',
    example: 140,
  })
  vsize: number | undefined;

  @ApiProperty({
    description: 'Transaction weight',
    example: 560,
  })
  weight: number | undefined;

  @ApiProperty({
    description: 'Time transaction entered mempool',
    example: 1625097600,
  })
  time: number | undefined;

  @ApiProperty({
    description: 'Block height when transaction entered mempool',
    example: 680000,
  })
  height: number | undefined;

  @ApiProperty({
    description: 'Number of descendant transactions',
    example: 2,
  })
  descendantcount: number | undefined;

  @ApiProperty({
    description: 'Total size of descendant transactions',
    example: 280,
  })
  descendantsize: number | undefined;

  @ApiProperty({
    description: 'Number of ancestor transactions',
    example: 1,
  })
  ancestorcount: number | undefined;

  @ApiProperty({
    description: 'Total size of ancestor transactions',
    example: 140,
  })
  ancestorsize: number | undefined;

  @ApiProperty({
    description: 'Transaction IDs this transaction depends on',
    type: [String],
  })
  depends: string[] | undefined;
}
