import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Param,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import {
  MempoolInfoDto,
  RawMempoolEntryDto,
  MempoolEntryDto,
} from '../dtos/mempool.dto';
import { Logger } from '@h3tag-blockchain/shared';
import { MempoolService } from '../services/mempool.service';

@ApiTags('Mempool')
@Controller('mempool')
export class MempoolController {
  constructor(private readonly mempoolService: MempoolService) {}

  @Get('info')
  @ApiOperation({ summary: 'Get mempool information' })
  @ApiResponse({
    status: 200,
    description: 'Mempool information retrieved successfully',
    type: MempoolInfoDto,
  })
  async getMempoolInfo(): Promise<MempoolInfoDto | undefined> {
    try {
      return await this.mempoolService.getMempoolInfo();
    } catch (error: unknown) {
      const err =
        error instanceof Error
          ? error
          : new Error('Unknown error occurred during getMempoolInfo');
      Logger.error('Failed to get mempool info:', err);
      throw new HttpException(
        `Failed to get mempool info: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('raw')
  @ApiOperation({ summary: 'Get raw mempool transactions' })
  @ApiQuery({ name: 'verbose', type: Boolean, required: false })
  @ApiResponse({
    status: 200,
    description: 'Raw mempool transactions retrieved successfully',
    type: RawMempoolEntryDto,
  })
  async getRawMempool(
    @Query('verbose') verbose: string | boolean = false,
  ): Promise<Record<string, RawMempoolEntryDto> | string[] | undefined> {
    try {
      // Convert verbose to a boolean if necessary (handling string values)
      const isVerbose =
        typeof verbose === 'string'
          ? verbose.toLowerCase() === 'true'
          : Boolean(verbose);
      return await this.mempoolService.getRawMempool(isVerbose);
    } catch (error: unknown) {
      const err =
        error instanceof Error
          ? error
          : new Error('Unknown error occurred during getRawMempool');
      Logger.error('Failed to get raw mempool:', err);
      throw new HttpException(
        `Failed to get raw mempool: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('entry/:txid')
  @ApiOperation({ summary: 'Get specific mempool entry' })
  @ApiParam({ name: 'txid', description: 'Transaction ID to lookup' })
  @ApiResponse({
    status: 200,
    description: 'Mempool entry retrieved successfully',
    type: MempoolEntryDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found in mempool',
  })
  async getMempoolEntry(
    @Param('txid') txid: string,
  ): Promise<MempoolEntryDto | undefined> {
    try {
      return await this.mempoolService.getMempoolEntry(txid);
    } catch (error: unknown) {
      const err =
        error instanceof Error
          ? error
          : new Error('Unknown error occurred during getMempoolEntry');
      Logger.error('Failed to get mempool entry:', err);
      throw new HttpException(
        err.message,
        err.message.includes('not found')
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
