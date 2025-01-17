import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { TransactionDto } from "./transaction.dto";
import { HybridKeyPair } from "@h3tag-blockchain/crypto";

export class MiningInfoDto {
  @ApiProperty({ description: "Current blockchain height" })
  blocks: number;

  @ApiProperty({ description: "Current mining difficulty" })
  difficulty: number;

  @ApiProperty({ description: "Network hashrate in H/s" })
  networkHashrate: number;

  @ApiProperty({ description: "Current block reward" })
  reward: number;

  @ApiProperty({ description: "Total chain work in hex" })
  chainWork: string;

  @ApiProperty({ description: "Whether network is actively mining" })
  isNetworkMining: boolean;

  @ApiProperty({ description: "Network hash power per second" })
  networkHashPS: number;
}

export class BlockTemplateDto {
  @ApiProperty({ description: "Block version" })
  version: number;

  @ApiProperty({ description: "Block height" })
  height: number;

  @ApiProperty({ description: "Previous block hash" })
  previousHash: string;

  @ApiProperty({ description: "Block timestamp" })
  timestamp: number;

  @ApiProperty({ description: "Mining difficulty" })
  difficulty: number;

  @ApiProperty({ description: "Block transactions", type: [TransactionDto] })
  transactions: TransactionDto[];

  @ApiProperty({ description: "Merkle root hash" })
  merkleRoot: string;

  @ApiProperty({ description: "Mining target in hex" })
  target: string;

  @ApiProperty({ description: "Minimum timestamp allowed" })
  minTime: number;

  @ApiProperty({ description: "Maximum timestamp allowed" })
  maxTime: number;

  @ApiProperty({ description: "Maximum allowed version" })
  maxVersion: number;

  @ApiProperty({ description: "Minimum allowed version" })
  minVersion: number;

  @ApiProperty({ description: "Default block version" })
  defaultVersion: number;
}

export class BlockTemplateRequestDto {
  @ApiProperty({
    description: "Address to receive mining rewards",
    example: "0x1234...",
  })
  @IsString()
  minerAddress: string;
}

export class SubmitBlockDto {
  @ApiProperty({
    description: "Block header data",
    example: {
      version: 1,
      previousHash:
        "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
      merkleRoot:
        "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
      timestamp: 1231006505,
      difficulty: 486604799,
      nonce: 2083236893,
    },
  })
  header: {
    version: number;
    previousHash: string;
    merkleRoot: string;
    timestamp: number;
    difficulty: number;
    nonce: number;
  };

  @ApiProperty({
    description: "Block transactions",
    example: [
      {
        txid: "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
        version: 1,
        inputs: [],
        outputs: [],
      },
    ],
  })
  transactions: any[]; // Replace with proper Transaction type

  minerKeyPair: HybridKeyPair;
}
