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
import { BlockchainService } from '../services/blockchain.service';
import {
  BlockchainStatsDto,
  TransactionSubmitDto,
  BlockResponseDto,
  FirstTransactionResponseDto,
  TransactionValidationResponseDto,
  UtxoDto,
  ChainTipDto,
  DifficultyResponseDto,
  BestBlockHashDto,
  BlockchainInfoDto,
} from '../dtos/blockchain.dto';
import { Logger } from '@h3tag-blockchain/shared';
import { Transaction, UTXO } from '@h3tag-blockchain/core';

@ApiTags('Blockchain')
@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get blockchain statistics' })
  @ApiResponse({
    status: 200,
    description: 'Blockchain statistics retrieved successfully',
    type: BlockchainStatsDto,
  })
  async getStats(): Promise<BlockchainStatsDto> {
    try {
      return await this.blockchainService.getStats();
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get blockchain stats:', error);
        throw new HttpException(
          `Failed to get blockchain stats: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        `Failed to get blockchain stats: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('transactions')
  @ApiOperation({ summary: 'Submit a new transaction' })
  @ApiResponse({
    status: 201,
    description: 'Transaction submitted successfully',
    schema: {
      properties: {
        txId: { type: 'string' },
      },
    },
  })
  async submitTransaction(
    @Body() transaction: TransactionSubmitDto,
  ): Promise<{ txId: string }> {
    try {
      const txId = await this.blockchainService.submitTransaction(transaction);
      return { txId };
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to submit transaction:', error);
        throw new HttpException(
          `Failed to submit transaction: ${error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        `Failed to submit transaction: ${error}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('blocks/:hash')
  @ApiOperation({ summary: 'Get block by hash' })
  @ApiResponse({
    status: 200,
    description: 'Block retrieved successfully',
    type: BlockResponseDto,
  })
  async getBlock(
    @Param('hash') hash: string,
  ): Promise<BlockResponseDto | undefined> {
    try {
      const block = await this.blockchainService.getBlock(hash);
      const currentHeight = await this.blockchainService.getHeight();

      return {
        ...block,
        timestamp: Date.now(),
        height: block.height,
        hash: block.hash,
        previousHash: block.previousHash,
        merkleRoot: block.merkleRoot,
        transactions: block.transactions.map((tx: Transaction) => ({
          hash: tx.hash,
          amount: tx.outputs[0]?.amount ? Number(tx.outputs[0]?.amount) : 0,
          confirmations: currentHeight - (tx.blockHeight ?? 0) + 1,
          timestamp: tx.timestamp ? Number(tx.timestamp) : 0,
          type: tx.type,
          status: tx.status,
          fromAddress: tx.inputs?.[0]?.address || '',
          toAddress: tx.outputs?.[0]?.address || '',
        })),
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get block:', error);
        throw new HttpException(
          `Block not found: ${error.message}`,
          HttpStatus.NOT_FOUND,
        );
      }
    }
  }

  @Get('currency')
  @ApiOperation({ summary: 'Get currency details' })
  @ApiResponse({
    status: 200,
    description: 'Currency details retrieved successfully',
  })
  async getCurrencyDetails() {
    try {
      return await this.blockchainService.getCurrencyDetails();
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get currency details:', error);
        throw new HttpException(
          `Failed to get currency details: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Get('transactions/:address/first')
  @ApiOperation({ summary: 'Get first transaction for address' })
  @ApiResponse({
    status: 200,
    description: 'First transaction found',
    schema: {
      properties: {
        blockHeight: { type: 'number' },
      },
    },
  })
  async getFirstTransaction(
    @Param('address') address: string,
  ): Promise<FirstTransactionResponseDto | undefined> {
    try {
      const result = await this.blockchainService.getFirstTransactionForAddress(
        address,
      );
      if (!result) {
        throw new HttpException(
          'First transaction not found',
          HttpStatus.NOT_FOUND,
        );
      }
      return result;
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get first transaction:', error);
        throw new HttpException(
          `Failed to get first transaction: ${error.message}`,
          HttpStatus.NOT_FOUND,
        );
      }
    }
  }

  @Post('transactions/validate')
  @ApiOperation({ summary: 'Validate transaction amount' })
  async validateTransaction(
    @Body() transaction: TransactionSubmitDto,
  ): Promise<TransactionValidationResponseDto | undefined> {
    try {
      const isValid = await this.blockchainService.validateTransactionAmount(
        transaction,
      );
      return { isValid };
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Transaction validation failed:', error);
        throw new HttpException(
          `Transaction validation failed: ${error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  @Get('transactions/:address/utxos')
  @ApiOperation({ summary: 'Get confirmed UTXOs for address' })
  async getUtxos(
    @Param('address') address: string,
  ): Promise<UtxoDto[] | undefined> {
    try {
      const utxos = await this.blockchainService.getConfirmedUtxos(address);
      return utxos.map((utxo: UTXO) => ({
        txid: utxo.txId,
        vout: utxo.outputIndex,
        amount: Number(utxo.amount),
        confirmations: utxo.confirmations,
      }));
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get UTXOs:', error);
        throw new HttpException(
          `Failed to get UTXOs: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Get('height')
  @ApiOperation({ summary: 'Get current blockchain height' })
  async getHeight(): Promise<number | undefined> {
    try {
      return await this.blockchainService.getHeight();
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get height:', error);
        throw new HttpException(
          `Failed to get height: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Get('version')
  @ApiOperation({ summary: 'Get blockchain version' })
  async getVersion(): Promise<number | undefined> {
    try {
      return this.blockchainService.getVersion();
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get version:', error);
        throw new HttpException(
          `Failed to get version: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Get('node')
  @ApiOperation({ summary: 'Get node information' })
  async getNode() {
    try {
      return await this.blockchainService.getNode();
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get node info:', error);
        throw new HttpException(
          `Failed to get node info: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Get('chain-tips')
  @ApiOperation({ summary: 'Get information about chain tips' })
  @ApiResponse({
    status: 200,
    description: 'Chain tips retrieved successfully',
    type: [ChainTipDto],
  })
  async getChainTips(): Promise<ChainTipDto[] | undefined> {
    try {
      return await this.blockchainService.getChainTips();
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get chain tips:', error);
        throw new HttpException(
          `Failed to get chain tips: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Get('difficulty')
  @ApiOperation({ summary: 'Get current mining difficulty' })
  @ApiResponse({
    status: 200,
    description: 'Current difficulty retrieved successfully',
    type: DifficultyResponseDto,
  })
  async getCurrentDifficulty(): Promise<DifficultyResponseDto | undefined> {
    try {
      const difficulty = await this.blockchainService.getCurrentDifficulty();
      return { difficulty };
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get difficulty:', error);
        throw new HttpException(
          `Failed to get difficulty: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Get('best-block-hash')
  @ApiOperation({ summary: 'Get the hash of the best (latest) block' })
  @ApiResponse({
    status: 200,
    description: 'Best block hash retrieved successfully',
    type: BestBlockHashDto,
  })
  async getBestBlockHash(): Promise<BestBlockHashDto | undefined> {
    try {
      const hash = await this.blockchainService.getBestBlockHash();
      return { hash };
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get best block hash:', error);
        throw new HttpException(
          `Failed to get best block hash: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Get('info')
  @ApiOperation({ summary: 'Get blockchain information' })
  @ApiResponse({
    status: 200,
    description: 'Blockchain information retrieved successfully',
    type: BlockchainInfoDto,
  })
  async getBlockchainInfo(): Promise<BlockchainInfoDto | undefined> {
    try {
      return await this.blockchainService.getBlockchainInfo();
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get blockchain info:', error);
        throw new HttpException(
          `Failed to get blockchain info: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }
}
