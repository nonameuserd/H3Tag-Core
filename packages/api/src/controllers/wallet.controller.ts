import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Request,
  Response,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WalletService } from '../services/wallet.service';
import {
  CreateWalletDto,
  WalletResponseDto,
  SignTransactionDto,
  SendToAddressDto,
  WalletBalanceDto,
  NewAddressResponseDto,
  ExportPrivateKeyDto,
  ImportPrivateKeyDto,
  UnspentOutputDto,
  TxOutDto,
} from '../dtos/wallet.dto';
import { Logger } from '@h3tag-blockchain/shared';
import { TransactionBuilder } from '@h3tag-blockchain/core';

@ApiTags('Wallets')
@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new wallet' })
  @ApiResponse({
    status: 201,
    description: 'Wallet created successfully',
    type: WalletResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  async createWallet(
    @Body() createWalletDto: CreateWalletDto,
  ): Promise<WalletResponseDto | undefined> {
    try {
      return await this.walletService.createWallet(createWalletDto);
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to create wallet:', error);
        throw new HttpException(
          `Failed to create wallet: ${error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  @Get(':address')
  @ApiOperation({ summary: 'Get wallet information' })
  @ApiResponse({
    status: 200,
    description: 'Wallet information retrieved successfully',
    type: WalletResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async getWallet(
    @Param('address') address: string,
  ): Promise<WalletResponseDto | undefined> {
    try {
      return await this.walletService.getWallet(address);
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get wallet:', error);
        throw new HttpException(
          `Wallet not found: ${error.message}`,
          HttpStatus.NOT_FOUND,
        );
      }
    }
  }

  @Post(':address/sign')
  @ApiOperation({ summary: 'Sign a transaction' })
  @ApiResponse({
    status: 200,
    description: 'Transaction signed successfully',
    schema: {
      properties: { signature: { type: 'string' } },
    },
  })
  async signTransaction(
    @Param('address') address: string,
    @Body() signTransactionDto: SignTransactionDto,
  ) {
    const builder = new TransactionBuilder();
    const withInput = await builder.addInput(
      signTransactionDto.transaction.fromAddress || '',
      0,
      signTransactionDto.transaction.publicKey || '',
      BigInt(signTransactionDto.transaction.amount || 0),
    );
    const withOutput = await withInput.addOutput(
      signTransactionDto.transaction.toAddress || '',
      BigInt(signTransactionDto.transaction.amount || 0),
      signTransactionDto.transaction.confirmations || 0,
    );
    const transaction = await withOutput.build();

    const signature = await this.walletService.signTransaction(
      address,
      transaction,
      signTransactionDto.password || '',
    );
    return { signature };
  }

  @Post(':address/send')
  @ApiOperation({ summary: 'Send funds to another address' })
  @ApiResponse({
    status: 200,
    description: 'Transaction sent successfully',
    schema: {
      properties: {
        txId: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters or insufficient funds',
  })
  async sendToAddress(
    @Param('address') fromAddress: string,
    @Body() sendToAddressDto: SendToAddressDto,
  ): Promise<{ txId: string } | undefined> {
    try {
      const txId = await this.walletService.sendToAddress(
        fromAddress,
        sendToAddressDto.toAddress || '',
        sendToAddressDto.amount || '',
        sendToAddressDto.password || '',
      );
      return { txId };
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to send transaction:', error);
        throw new HttpException(
          `Failed to send transaction: ${error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  @Get(':address/balance')
  @ApiOperation({ summary: 'Get wallet balance' })
  @ApiResponse({
    status: 200,
    description: 'Balance retrieved successfully',
    type: WalletBalanceDto,
  })
  async getBalance(
    @Param('address') address: string,
  ): Promise<WalletBalanceDto | undefined> {
    try {
      const balance = await this.walletService.getBalance(address);
      return {
        confirmed: balance.confirmed.toString(),
        unconfirmed: balance.unconfirmed.toString(),
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get balance:', error);
        throw new HttpException(
          `Failed to get balance: ${error.message}`,
          HttpStatus.NOT_FOUND,
        );
      }
    }
  }

  @Post(':address/addresses')
  @ApiOperation({ summary: 'Generate new address' })
  @ApiResponse({
    status: 201,
    description: 'New address generated successfully',
    type: NewAddressResponseDto,
  })
  async getNewAddress(
    @Param('address') address: string,
  ): Promise<NewAddressResponseDto> {
    const newAddress = await this.walletService.getNewAddress(address);
    return { address: newAddress };
  }

  @Post(':address/export')
  @ApiOperation({ summary: 'Export wallet private key' })
  @ApiResponse({
    status: 200,
    description: 'Private key exported successfully',
    schema: {
      properties: {
        privateKey: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid password or wallet not found',
  })
  async exportPrivateKey(
    @Param('address') address: string,
    @Body() exportDto: ExportPrivateKeyDto,
  ): Promise<{ privateKey: string } | undefined> {
    try {
      const privateKey = await this.walletService.exportPrivateKey(
        address,
        exportDto.password || '',
      );
      return { privateKey };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new HttpException(
          `Failed to export private key: ${error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  @Post('import')
  @ApiOperation({ summary: 'Import wallet from private key' })
  @ApiResponse({
    status: 201,
    description: 'Wallet imported successfully',
    type: WalletResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid private key or password' })
  async importPrivateKey(
    @Body() importDto: ImportPrivateKeyDto,
  ): Promise<WalletResponseDto | undefined> {
    try {
      return await this.walletService.importPrivateKey(importDto);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new HttpException(
          `Failed to import private key: ${error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  @Get(':address/unspent')
  @ApiOperation({ summary: 'List unspent transaction outputs (UTXOs)' })
  @ApiResponse({
    status: 200,
    description: 'UTXOs retrieved successfully',
    type: [UnspentOutputDto],
  })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async listUnspent(
    @Param('address') address: string,
  ): Promise<UnspentOutputDto[] | undefined> {
    try {
      return await this.walletService.listUnspent(address);
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to list unspent outputs:', error);
        throw new HttpException(
          `Failed to list unspent outputs: ${error.message}`,
          HttpStatus.NOT_FOUND,
        );
      }
    }
  }

  @Get('txout/:txid/:n')
  @ApiOperation({ summary: 'Get specific transaction output' })
  @ApiResponse({
    status: 200,
    description: 'Transaction output retrieved successfully',
    type: TxOutDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction output not found',
  })
  async getTxOut(
    @Param('txid') txid: string,
    @Param('n') n: number,
  ): Promise<TxOutDto | undefined> {
    try {
      return await this.walletService.getTxOut(txid, parseInt(n.toString()));
    } catch (error: unknown) {
      if (error instanceof Error) {
        Logger.error('Failed to get transaction output:', error);
        throw new HttpException(
          `Transaction output not found: ${error.message}`,
          HttpStatus.NOT_FOUND,
        );
      }
    }
  }
}
