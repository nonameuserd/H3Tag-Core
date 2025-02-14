import { Injectable } from '@nestjs/common';
import { DirectVoting, Vote } from '@h3tag-blockchain/core';
import { VoteDto, VotingMetricsDto } from '../dtos/voting.dto';
import { Logger } from '@h3tag-blockchain/shared';
import { TransactionBuilder } from '@h3tag-blockchain/core';

@Injectable()
export class VotingService {
  private readonly transactionBuilder: TransactionBuilder;

  constructor(private readonly directVoting: DirectVoting) {
    this.transactionBuilder = new TransactionBuilder();
  }

  async submitVote(voteDto: VoteDto): Promise<string> {
    try {
      // Configure the transaction builder
      this.transactionBuilder
        .setFee(BigInt(0))
        .setSender(voteDto.voterAddress || '')
        .setSignature(voteDto.signature || '');

      const vote: Vote = {
        voteId: crypto.randomUUID(),
        periodId: this.directVoting.getCurrentPeriod().periodId,
        voterAddress: voteDto.voterAddress || '',
        voter: voteDto.voterAddress || '',
        signature: voteDto.signature || '',
        timestamp: Date.now(),
        blockHash: '',
        approve: voteDto.choice || false,
        chainVoteData: {
          amount: BigInt(voteDto.chainVoteData?.amount || 0),
          targetChainId: voteDto.chainVoteData?.targetChainId || '',
          forkHeight: voteDto.chainVoteData?.forkHeight || 0,
        },
        votingPower: BigInt(
          Math.floor(Math.sqrt(Number(voteDto.chainVoteData?.amount || 0))),
        ).toString(),
        publicKey: voteDto.voterAddress || '',
        encrypted: false,
        height: voteDto.height || 0,
        balance: BigInt(voteDto.balance || 0),
      };

      const validators = await this.directVoting.getValidators();
      await this.directVoting.validateVote(vote, validators);
      const success = await this.directVoting.submitVote(vote);
      if (!success) throw new Error('Vote submission failed');
      return vote.voteId;
    } catch (error) {
      Logger.error('Vote submission failed:', error);
      throw error;
    }
  }

  async getVotingMetrics(): Promise<VotingMetricsDto> {
    try {
      const metrics = await this.directVoting.getVotingMetrics();
      
      return {
        totalVotes: Number(metrics.totalVotes),
        participationRate: Number(metrics.participationRate),
        activeVoters: (await metrics.activeVoters).length,
        currentPeriod: metrics.currentPeriod ? {
          periodId: metrics.currentPeriod.periodId.toString(),
          startHeight: metrics.currentPeriod.startHeight,
          endHeight: metrics.currentPeriod.endHeight,
        } : undefined
      };
    } catch (error) {
      Logger.error('Failed to get voting metrics:', error);
      throw error;
    }
  }

  async getCurrentPeriod() {
    try {
      return this.directVoting.getCurrentPeriod();
    } catch (error) {
      Logger.error('Failed to get current period:', error);
      throw error;
    }
  }

  async getVotesByAddress(address: string) {
    try {
      return this.directVoting.getVotesByAddress(address);
    } catch (error) {
      Logger.error('Failed to get votes by address:', error);
      throw error;
    }
  }
}
