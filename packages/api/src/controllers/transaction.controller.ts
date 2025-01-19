import {
  Controller,
  Get,
  Param,
  HttpException,
  HttpStatus,
  Post,
  Body,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TransactionService } from '../services/transaction.service';
import { TransactionResponseDto } from '../dtos/transaction.dto';
import { Logger } from '@h3tag-blockchain/shared';
import { SendRawTransactionDto } from '../dtos/transaction.dto';
import { RawTransactionResponseDto } from '../dtos/transaction.dto';
import {
  DecodeRawTransactionDto,
  DecodedTransactionDto,
} from '../dtos/transaction.dto';
import {
  EstimateFeeRequestDto,
  EstimateFeeResponseDto,
} from '../dtos/transaction.dto';
import {
  SignMessageRequestDto,
  SignMessageResponseDto,
} from '../dtos/transaction.dto';
import {
  VerifyMessageRequestDto,
  VerifyMessageResponseDto,
} from '../dtos/transaction.dto';
import {
  ValidateAddressRequestDto,
  ValidateAddressResponseDto,
} from '../dtos/transaction.dto';

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get(':txId')
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiResponse({
    status: 200,
    description: 'Transaction retrieved successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  async getTransaction(
    @Param('txId') txId: string,
  ): Promise<TransactionResponseDto | undefined> {
    try {
      return await this.transactionService.getTransaction(txId);
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get transaction:', error);
        throw new HttpException(
          `Transaction not found: ${error.message}`,
          HttpStatus.NOT_FOUND,
        );
      }
    }
  }

  @Post('raw')
  @ApiOperation({ summary: 'Send raw transaction' })
  @ApiResponse({
    status: 201,
    description: 'Transaction sent successfully',
    schema: {
      properties: {
        txId: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid transaction',
  })
  async sendRawTransaction(
    @Body() sendRawTxDto: SendRawTransactionDto,
  ): Promise<{ txId: string } | undefined> {
    try {
      const txId = await this.transactionService.sendRawTransaction(
        sendRawTxDto.rawTransaction || '',
      );
      return { txId };
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to send raw transaction:', error);
        throw new HttpException(
          `Failed to send raw transaction: ${error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  @Get(':txId/raw')
  @ApiOperation({ summary: 'Get raw transaction hex' })
  @ApiResponse({
    status: 200,
    description: 'Raw transaction retrieved successfully',
    type: RawTransactionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  async getRawTransaction(
    @Param('txId') txId: string,
  ): Promise<RawTransactionResponseDto | undefined> {
    try {
      return await this.transactionService.getRawTransaction(txId);
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get raw transaction:', error);
        throw new HttpException(
          `Transaction not found: ${error.message}`,
          HttpStatus.NOT_FOUND,
        );
      }
    }
  }

  @Post('decode')
  @ApiOperation({ summary: 'Decode raw transaction' })
  @ApiResponse({
    status: 200,
    description: 'Transaction decoded successfully',
    type: DecodedTransactionDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid raw transaction',
  })
  async decodeRawTransaction(
    @Body() decodeDto: DecodeRawTransactionDto,
  ): Promise<DecodedTransactionDto | undefined> {
    try {
      return await this.transactionService.decodeRawTransaction(
        decodeDto.rawTransaction || '',
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to decode transaction:', error);
        throw new HttpException(
          `Failed to decode transaction: ${error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  @Post('estimate-fee')
  @ApiOperation({ summary: 'Estimate transaction fee' })
  @ApiResponse({
    status: 200,
    description: 'Fee estimated successfully',
    type: EstimateFeeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid target blocks range',
  })
  async estimateFee(
    @Body() estimateFeeDto: EstimateFeeRequestDto,
  ): Promise<EstimateFeeResponseDto | undefined> {
    try {
      const estimatedFee = await this.transactionService.estimateFee(
        estimateFeeDto.targetBlocks,
      );
      return {
        estimatedFee: estimatedFee.toString(),
        targetBlocks: estimateFeeDto.targetBlocks || 6,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to estimate fee:', error);
        throw new HttpException(
          `Failed to estimate fee: ${error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  @Post('sign-message')
  @ApiOperation({ summary: 'Sign a message using hybrid cryptography' })
  @ApiResponse({
    status: 200,
    description: 'Message signed successfully',
    type: SignMessageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid message or private key format',
  })
  async signMessage(
    @Body() signMessageDto: SignMessageRequestDto,
  ): Promise<SignMessageResponseDto | undefined> {
    try {
      const signature = await this.transactionService.signMessage(
        signMessageDto.message || '',
        signMessageDto.privateKey || '',
      );
      return { signature };
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to sign message:', error);
        throw new HttpException(
          `Failed to sign message: ${error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  @Post('verify-message')
  @ApiOperation({ summary: 'Verify a signed message' })
  @ApiResponse({
    status: 200,
    description: 'Message verification result',
    type: VerifyMessageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid message, signature, or public key format',
  })
  async verifyMessage(
    @Body() verifyMessageDto: VerifyMessageRequestDto,
  ): Promise<VerifyMessageResponseDto | undefined> {
    try {
      const isValid = await this.transactionService.verifyMessage(
        verifyMessageDto.message || '',
        verifyMessageDto.signature || '',
        verifyMessageDto.publicKey || '',
      );
      return { isValid };
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to verify message:', error);
        throw new HttpException(
          `Failed to verify message: ${error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  @Post('validate-address')
  @ApiOperation({ summary: 'Validate a blockchain address' })
  @ApiResponse({
    status: 200,
    description: 'Address validation result',
    type: ValidateAddressResponseDto,
  })
  async validateAddress(
    @Body() validateAddressDto: ValidateAddressRequestDto,
  ): Promise<ValidateAddressResponseDto | undefined> {
    try {
      const isValid = await this.transactionService.validateAddress(
        validateAddressDto.address || '',
      );
      const network = isValid
        ? this.transactionService.getNetworkType()
        : undefined;
      return { isValid, network };
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to validate address:', error);
        throw new HttpException(
          `Failed to validate address: ${error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }
}
