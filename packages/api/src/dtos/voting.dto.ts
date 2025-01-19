import { ApiProperty } from '@nestjs/swagger';
import { TransactionType, TransactionStatus } from '@h3tag-blockchain/core';

export class ChainVoteDataDto {
  @ApiProperty({
    description: 'Amount to commit for voting',
    example: '1000',
  })
  amount: bigint | undefined;

  @ApiProperty({
    description: 'Target chain ID',
    example: 'chain_1',
  })
  targetChainId: string | undefined;

  @ApiProperty({
    description: 'Fork height',
    example: 1000,
  })
  forkHeight: number | undefined;
}

export class VoteDto {
  @ApiProperty({
    description: 'Vote identifier',
    example: 'vote_123',
  })
  voteId: string | undefined;

  @ApiProperty({
    description: 'Period identifier',
    example: 'period_123',
  })
  periodId: string | undefined;

  @ApiProperty({
    description: 'The voter address',
    example: '0x1234...',
  })
  voterAddress: string | undefined;

  @ApiProperty({
    description: 'Vote signature',
    example: 'base64_encoded_signature',
  })
  signature: string | undefined;

  @ApiProperty({
    description: 'Vote timestamp',
    example: 1234567890,
  })
  timestamp: number | undefined;

  @ApiProperty({
    description: 'The vote choice (true for yes, false for no)',
    example: true,
  })
  choice: boolean | undefined;

  @ApiProperty({
    description: 'Chain vote data',
  })
  chainVoteData: ChainVoteDataDto | undefined;

  @ApiProperty({
    description: 'Transaction type',
    enum: TransactionType,
    example: TransactionType.QUADRATIC_VOTE,
  })
  type: TransactionType | undefined;

  @ApiProperty({
    description: 'Transaction status',
    enum: TransactionStatus,
    example: TransactionStatus.PENDING,
  })
  status: TransactionStatus | undefined;

  @ApiProperty({
    description: 'Voting power',
    example: '10',
  })
  votingPower: bigint | undefined;

  @ApiProperty({
    description: 'The block height at which the vote is cast',
    example: 1000,
  })
  height: number | undefined;

  @ApiProperty({
    description: 'The balance of the voter',
    example: '1000',
  })
  balance: bigint | undefined;
}

export class VotingPeriodDto {
  @ApiProperty({
    description: 'Period identifier',
    example: 'period_123',
  })
  periodId: string | undefined;

  @ApiProperty({
    description: 'Start block height',
    example: 1000,
  })
  startHeight: number | undefined;

  @ApiProperty({
    description: 'End block height',
    example: 2000,
  })
  endHeight: number | undefined;
}

export class VotingMetricsDto {
  @ApiProperty({
    description: 'Current voting period information',
  })
  currentPeriod: VotingPeriodDto | undefined;

  @ApiProperty({
    description: 'Total number of votes cast',
    example: 150,
  })
  totalVotes: number | undefined;

  @ApiProperty({
    description: 'Number of active voters',
    example: 75,
  })
  activeVoters: number | undefined;

  @ApiProperty({
    description: 'Voter participation rate',
    example: 0.65,
  })
  participationRate: number | undefined;
}
