import { Injectable } from "@nestjs/common";
import {
  DirectVoting,
  TransactionStatus,
  TransactionType,
  Vote,
} from "@h3tag-blockchain/core";
import { VoteDto, VotingMetricsDto } from "../dtos/voting.dto";
import { Logger } from "@h3tag-blockchain/shared";
import { TransactionBuilder } from "@h3tag-blockchain/core";
import { BLOCKCHAIN_CONSTANTS } from "@h3tag-blockchain/core";

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
        .setSender(voteDto.voterAddress)
        .setSignature({ address: voteDto.signature });

      const vote: Vote = {
        voteId: crypto.randomUUID(),
        periodId: this.directVoting.getCurrentPeriod().periodId,
        voterAddress: voteDto.voterAddress,
        voter: voteDto.voterAddress,
        signature: { address: voteDto.signature },
        timestamp: Date.now(),
        blockHash: "",
        approve: voteDto.choice,
        chainVoteData: {
          amount: voteDto.chainVoteData?.amount || BigInt(0),
          targetChainId: voteDto.chainVoteData?.targetChainId || "",
          forkHeight: voteDto.chainVoteData?.forkHeight || 0,
        },
        votingPower: BigInt(
          Math.floor(Math.sqrt(Number(voteDto.chainVoteData?.amount || 0)))
        ),
        publicKey: { address: voteDto.voterAddress },
        encrypted: false,
        height: voteDto.height,
        balance: voteDto.balance,
      };

      const validators = await this.directVoting.getValidators();
      await this.directVoting.validateVote(vote, validators);
      const success = await this.directVoting.submitVote(vote);
      if (!success) throw new Error("Vote submission failed");
      return vote.voteId;
    } catch (error) {
      Logger.error("Vote submission failed:", error);
      throw error;
    }
  }

  async getVotingMetrics(): Promise<VotingMetricsDto> {
    try {
      const metrics = this.directVoting.getVotingMetrics();
      return {
        totalVotes: await metrics.totalVotes,
        participationRate: await metrics.participationRate,
        activeVoters: Number(await metrics.activeVoters),
        currentPeriod: {
          periodId: (await metrics.currentPeriod.periodId).toString(),
          startHeight: Number(await metrics.currentPeriod.startHeight),
          endHeight: Number(await metrics.currentPeriod.endHeight),
        },
      };
    } catch (error) {
      Logger.error("Failed to get voting metrics:", error);
      throw error;
    }
  }

  async getCurrentPeriod() {
    try {
      return this.directVoting.getCurrentPeriod();
    } catch (error) {
      Logger.error("Failed to get current period:", error);
      throw error;
    }
  }

  async getVotesByAddress(address: string) {
    try {
      return this.directVoting.getVotesByAddress(address);
    } catch (error) {
      Logger.error("Failed to get votes by address:", error);
      throw error;
    }
  }
}
