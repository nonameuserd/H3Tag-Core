import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MiningService } from '../services/mining.service';
import { MiningInfoDto, BlockTemplateRequestDto, BlockTemplateDto, SubmitBlockDto } from '../dtos/mining.dto';
import { Logger } from '@h3tag-blockchain/shared';
import { validate } from 'class-validator';

@ApiTags('Mining')
@Controller('mining')
export class MiningController {
  constructor(private readonly miningService: MiningService) {}

  @Get('info')
  @ApiOperation({ summary: 'Get mining information' })
  @ApiResponse({
    status: 200,
    description: 'Mining information retrieved successfully',
    type: MiningInfoDto,
  })
  async getMiningInfo(): Promise<MiningInfoDto> {
    try {
      return await this.miningService.getMiningInfo();
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get mining info:', error);
        throw new HttpException(
          `Failed to get mining info: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        'Failed to get mining info due to an unexpected error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('hashps')
  @ApiOperation({ summary: 'Get network hash per second' })
  @ApiResponse({
    status: 200,
    description: 'Network hash rate retrieved successfully',
    schema: {
      properties: {
        hashPS: { type: 'number' },
      },
    },
  })
  async getNetworkHashPS(): Promise<{ hashPS: number }> {
    try {
      const hashPS = await this.miningService.getNetworkHashPS();
      return { hashPS };
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get network hash rate:', error);
        throw new HttpException(
          `Failed to get network hash rate: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        'Failed to get network hash rate due to an unexpected error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('template')
  @ApiOperation({ summary: 'Get block template for mining' })
  @ApiResponse({ status: 200, type: BlockTemplateDto })
  async getBlockTemplate(
    @Body() body: { minerAddress: string },
  ): Promise<{ status: string; data: BlockTemplateDto }> {
    const request = new BlockTemplateRequestDto();
    request.minerAddress = body.minerAddress;

    // Validate request
    const errors = await validate(request);
    if (errors.length > 0) {
      throw new BadRequestException({
        status: 'error',
        message: 'Invalid request',
        errors: errors.map((error) =>
          Object.values(error.constraints || {}),
        ),
      });
    }

    try {
      const template = await this.miningService.getBlockTemplate(
        request.minerAddress,
      );

      return {
        status: 'success',
        data: template,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get block template:', error);
        throw new HttpException(
          `Failed to get block template: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        'Failed to get block template due to an unexpected error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('submit-block')
  @ApiOperation({ summary: 'Submit a mined block' })
  @ApiResponse({
    status: 201,
    description: 'Block submitted successfully',
    schema: {
      properties: {
        status: { type: 'string' },
        blockHash: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid block data' })
  async submitBlock(
    @Body() submitBlockDto: SubmitBlockDto,
  ): Promise<{ status: string; blockHash: string }> {
    try {
      const blockHash = await this.miningService.submitBlock(submitBlockDto);
      return {
        status: 'success',
        blockHash,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to submit block:', error);
        // Depending on the nature of the failure, BAD_REQUEST or INTERNAL_SERVER_ERROR could be used.
        throw new HttpException(
          `Failed to submit block: ${error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        'Failed to submit block due to an unexpected error',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
