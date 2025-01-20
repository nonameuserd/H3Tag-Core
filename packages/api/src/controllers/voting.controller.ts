import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { VotingService } from '../services/voting.service';
import { VoteDto, VotingMetricsDto } from '../dtos/voting.dto';
import { Logger } from '@h3tag-blockchain/shared';

@ApiTags('Voting')
@Controller('voting')
export class VotingController {
  constructor(private readonly votingService: VotingService) {}

  @Post('vote')
  @ApiOperation({ summary: 'Submit a vote' })
  @ApiResponse({
    status: 201,
    description: 'Vote submitted successfully',
    schema: {
      properties: {
        success: { type: 'boolean' },
        voteId: { type: 'string' },
      },
    },
  })
  async submitVote(@Body() voteDto: VoteDto) {
    try {
      const result = await this.votingService.submitVote(voteDto);
      return { success: true, voteId: result };
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to submit vote:', error);
        throw new HttpException(
          `Failed to submit vote: ${error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get voting metrics' })
  @ApiResponse({
    status: 200,
    description: 'Voting metrics retrieved successfully',
    type: VotingMetricsDto,
  })
  async getMetrics() {
    try {
      return await this.votingService.getVotingMetrics();
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get voting metrics:', error);
        throw new HttpException(
          `Failed to get voting metrics: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Get('period/current')
  @ApiOperation({ summary: 'Get current voting period' })
  @ApiResponse({
    status: 200,
    description: 'Current voting period retrieved successfully',
  })
  async getCurrentPeriod() {
    try {
      return await this.votingService.getCurrentPeriod();
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get current period:', error);
        throw new HttpException(
          `Failed to get current period: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Get('votes/:address')
  @ApiOperation({ summary: 'Get votes by address' })
  @ApiResponse({
    status: 200,
    description: 'Votes retrieved successfully',
    type: [VoteDto],
  })
  async getVotesByAddress(@Param('address') address: string) {
    try {
      return await this.votingService.getVotesByAddress(address);
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get votes:', error);
        throw new HttpException(
          `Failed to get votes: ${error.message}`,
          HttpStatus.NOT_FOUND,
        );
      }
    }
  }
}
