import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { TransactionDto } from './transaction.dto';
import { HybridKeyPair } from '@h3tag-blockchain/crypto';
import { Transaction } from 'packages/core/dist/models/transaction.model';

export class MiningInfoDto {
  @ApiProperty({ description: 'Current blockchain height' })
  blocks: number | undefined;

  @ApiProperty({ description: 'Current mining difficulty' })
  difficulty: number | undefined;

  @ApiProperty({ description: 'Network hashrate in H/s' })
  networkHashrate: number | undefined;

  @ApiProperty({ description: 'Current block reward' })
  reward: number | undefined;

  @ApiProperty({ description: 'Total chain work in hex' })
  chainWork: string | undefined;

  @ApiProperty({ description: 'Whether network is actively mining' })
  isNetworkMining: boolean | undefined;

  @ApiProperty({ description: 'Network hash power per second' })
  networkHashPS: number | undefined;
}

export class BlockTemplateDto {
  @ApiProperty({ description: 'Block version' })
  version: number | undefined;

  @ApiProperty({ description: 'Block height' })
  height: number | undefined;

  @ApiProperty({ description: 'Previous block hash' })
  previousHash: string | undefined;

  @ApiProperty({ description: 'Block timestamp' })
  timestamp: number | undefined;

  @ApiProperty({ description: 'Mining difficulty' })
  difficulty: number | undefined;

  @ApiProperty({ description: 'Block transactions', type: [TransactionDto] })
  transactions: TransactionDto[] | undefined;

  @ApiProperty({ description: 'Merkle root hash' })
  merkleRoot: string | undefined;

  @ApiProperty({ description: 'Mining target in hex' })
  target: string | undefined;

  @ApiProperty({ description: 'Minimum timestamp allowed' })
  minTime: number | undefined;

  @ApiProperty({ description: 'Maximum timestamp allowed' })
  maxTime: number | undefined;

  @ApiProperty({ description: 'Maximum allowed version' })
  maxVersion: number | undefined;

  @ApiProperty({ description: 'Minimum allowed version' })
  minVersion: number | undefined;

  @ApiProperty({ description: 'Default block version' })
  defaultVersion: number | undefined;
}

export class BlockTemplateRequestDto {
  @ApiProperty({
    description: 'Address to receive mining rewards',
    example: '0x1234...',
  })
  @IsString()
  minerAddress: string | undefined;
}

export class SubmitBlockDto {
  @ApiProperty({
    description: 'Block header data',
    example: {
      version: 1,
      previousHash:
        '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f',
      merkleRoot:
        '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
      timestamp: 1231006505,
      difficulty: 486604799,
      nonce: 2083236893,
    },
  })
  header:
    | {
        version: number | undefined;
        previousHash: string | undefined;
        merkleRoot: string | undefined;
        timestamp: number | undefined;
        difficulty: number | undefined;
        nonce: number | undefined;
      }
    | undefined;

  @ApiProperty({
    description: 'Block transactions',
    example: [
      {
        txid: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
        version: 1,
        inputs: [],
        outputs: [],
      },
    ],
  })
  transactions: Transaction[] | undefined;

  minerKeyPair!: HybridKeyPair;
}
