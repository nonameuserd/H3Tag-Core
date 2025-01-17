import { ApiProperty } from "@nestjs/swagger";
import { TransactionType, TransactionStatus } from "@h3tag-blockchain/core";

export class ChainVoteDataDto {
  @ApiProperty({
    description: "Amount to commit for voting",
    example: "1000",
  })
  amount: bigint;

  @ApiProperty({
    description: "Target chain ID",
    example: "chain_1",
  })
  targetChainId: string;

  @ApiProperty({
    description: "Fork height",
    example: 1000,
  })
  forkHeight: number;
}

export class VoteDto {
  @ApiProperty({
    description: "Vote identifier",
    example: "vote_123",
  })
  voteId: string;

  @ApiProperty({
    description: "Period identifier",
    example: "period_123",
  })
  periodId: string;

  @ApiProperty({
    description: "The voter address",
    example: "0x1234...",
  })
  voterAddress: string;

  @ApiProperty({
    description: "Vote signature",
    example: "base64_encoded_signature",
  })
  signature: string;

  @ApiProperty({
    description: "Vote timestamp",
    example: 1234567890,
  })
  timestamp: number;

  @ApiProperty({
    description: "The vote choice (true for yes, false for no)",
    example: true,
  })
  choice: boolean;

  @ApiProperty({
    description: "Chain vote data",
  })
  chainVoteData: ChainVoteDataDto;

  @ApiProperty({
    description: "Transaction type",
    enum: TransactionType,
    example: TransactionType.QUADRATIC_VOTE,
  })
  type: TransactionType;

  @ApiProperty({
    description: "Transaction status",
    enum: TransactionStatus,
    example: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @ApiProperty({
    description: "Voting power",
    example: "10",
  })
  votingPower: bigint;

  @ApiProperty({
    description: "The block height at which the vote is cast",
    example: 1000,
  })
  height: number;

  @ApiProperty({
    description: "The balance of the voter",
    example: "1000",
  })
  balance: bigint;
}

export class VotingPeriodDto {
  @ApiProperty({
    description: "Period identifier",
    example: "period_123",
  })
  periodId: string;

  @ApiProperty({
    description: "Start block height",
    example: 1000,
  })
  startHeight: number;

  @ApiProperty({
    description: "End block height",
    example: 2000,
  })
  endHeight: number;
}

export class VotingMetricsDto {
  @ApiProperty({
    description: "Current voting period information",
  })
  currentPeriod: VotingPeriodDto;

  @ApiProperty({
    description: "Total number of votes cast",
    example: 150,
  })
  totalVotes: number;

  @ApiProperty({
    description: "Number of active voters",
    example: 75,
  })
  activeVoters: number;

  @ApiProperty({
    description: "Voter participation rate",
    example: 0.65,
  })
  participationRate: number;
}
