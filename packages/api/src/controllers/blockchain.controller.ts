import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { BlockchainService } from "../services/blockchain.service";
import {
  BlockchainStatsDto,
  TransactionSubmitDto,
  BlockResponseDto,
  FirstTransactionResponseDto,
  TransactionValidationResponseDto,
  TransactionValidationRequestDto,
  UtxoDto,
  ChainTipDto,
  DifficultyResponseDto,
  BestBlockHashDto,
  BlockchainInfoDto,
} from "../dtos/blockchain.dto";
import { Logger } from "@h3tag-blockchain/shared";

@ApiTags("Blockchain")
@Controller("blockchain")
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Get("stats")
  @ApiOperation({ summary: "Get blockchain statistics" })
  @ApiResponse({
    status: 200,
    description: "Blockchain statistics retrieved successfully",
    type: BlockchainStatsDto,
  })
  async getStats(): Promise<BlockchainStatsDto> {
    try {
      return await this.blockchainService.getStats();
    } catch (error) {
      Logger.error("Failed to get blockchain stats:", error);
      throw new HttpException(
        `Failed to get blockchain stats: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post("transactions")
  @ApiOperation({ summary: "Submit a new transaction" })
  @ApiResponse({
    status: 201,
    description: "Transaction submitted successfully",
    schema: {
      properties: {
        txId: { type: "string" },
      },
    },
  })
  async submitTransaction(
    @Body() transaction: TransactionSubmitDto
  ): Promise<{ txId: string }> {
    try {
      const txId = await this.blockchainService.submitTransaction(transaction);
      return { txId };
    } catch (error) {
      Logger.error("Failed to submit transaction:", error);
      throw new HttpException(
        `Failed to submit transaction: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get("blocks/:hash")
  @ApiOperation({ summary: "Get block by hash" })
  @ApiResponse({
    status: 200,
    description: "Block retrieved successfully",
    type: BlockResponseDto,
  })
  async getBlock(@Param("hash") hash: string): Promise<BlockResponseDto> {
    try {
      return await this.blockchainService.getBlock(hash);
    } catch (error) {
      Logger.error("Failed to get block:", error);
      throw new HttpException(
        `Block not found: ${error.message}`,
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Get("currency")
  @ApiOperation({ summary: "Get currency details" })
  @ApiResponse({
    status: 200,
    description: "Currency details retrieved successfully",
  })
  async getCurrencyDetails() {
    try {
      return await this.blockchainService.getCurrencyDetails();
    } catch (error) {
      Logger.error("Failed to get currency details:", error);
      throw new HttpException(
        `Failed to get currency details: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("transactions/:address/first")
  @ApiOperation({ summary: "Get first transaction for address" })
  @ApiResponse({
    status: 200,
    description: "First transaction found",
    schema: {
      properties: {
        blockHeight: { type: "number" },
      },
    },
  })
  async getFirstTransaction(
    @Param("address") address: string
  ): Promise<FirstTransactionResponseDto> {
    try {
      return await this.blockchainService.getFirstTransactionForAddress(
        address
      );
    } catch (error) {
      Logger.error("Failed to get first transaction:", error);
      throw new HttpException(
        `Failed to get first transaction: ${error.message}`,
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Post("transactions/validate")
  @ApiOperation({ summary: "Validate transaction amount" })
  async validateTransaction(
    @Body() transaction: TransactionSubmitDto
  ): Promise<TransactionValidationResponseDto> {
    try {
      const isValid = await this.blockchainService.validateTransactionAmount(
        transaction
      );
      return { isValid };
    } catch (error) {
      Logger.error("Transaction validation failed:", error);
      throw new HttpException(
        `Transaction validation failed: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get("transactions/:address/utxos")
  @ApiOperation({ summary: "Get confirmed UTXOs for address" })
  async getUtxos(@Param("address") address: string): Promise<UtxoDto[]> {
    try {
      return await this.blockchainService.getConfirmedUtxos(address);
    } catch (error) {
      Logger.error("Failed to get UTXOs:", error);
      throw new HttpException(
        `Failed to get UTXOs: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("height")
  @ApiOperation({ summary: "Get current blockchain height" })
  async getHeight(): Promise<number> {
    try {
      return await this.blockchainService.getHeight();
    } catch (error) {
      Logger.error("Failed to get height:", error);
      throw new HttpException(
        `Failed to get height: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("version")
  @ApiOperation({ summary: "Get blockchain version" })
  async getVersion(): Promise<number> {
    try {
      return this.blockchainService.getVersion();
    } catch (error) {
      Logger.error("Failed to get version:", error);
      throw new HttpException(
        `Failed to get version: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("node")
  @ApiOperation({ summary: "Get node information" })
  async getNode() {
    try {
      return await this.blockchainService.getNode();
    } catch (error) {
      Logger.error("Failed to get node info:", error);
      throw new HttpException(
        `Failed to get node info: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("chain-tips")
  @ApiOperation({ summary: "Get information about chain tips" })
  @ApiResponse({
    status: 200,
    description: "Chain tips retrieved successfully",
    type: [ChainTipDto],
  })
  async getChainTips(): Promise<ChainTipDto[]> {
    try {
      return await this.blockchainService.getChainTips();
    } catch (error) {
      Logger.error("Failed to get chain tips:", error);
      throw new HttpException(
        `Failed to get chain tips: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("difficulty")
  @ApiOperation({ summary: "Get current mining difficulty" })
  @ApiResponse({
    status: 200,
    description: "Current difficulty retrieved successfully",
    type: DifficultyResponseDto,
  })
  async getCurrentDifficulty(): Promise<DifficultyResponseDto> {
    try {
      const difficulty = await this.blockchainService.getCurrentDifficulty();
      return { difficulty };
    } catch (error) {
      Logger.error("Failed to get difficulty:", error);
      throw new HttpException(
        `Failed to get difficulty: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("best-block-hash")
  @ApiOperation({ summary: "Get the hash of the best (latest) block" })
  @ApiResponse({
    status: 200,
    description: "Best block hash retrieved successfully",
    type: BestBlockHashDto,
  })
  async getBestBlockHash(): Promise<BestBlockHashDto> {
    try {
      const hash = await this.blockchainService.getBestBlockHash();
      return { hash };
    } catch (error) {
      Logger.error("Failed to get best block hash:", error);
      throw new HttpException(
        `Failed to get best block hash: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("info")
  @ApiOperation({ summary: "Get blockchain information" })
  @ApiResponse({
    status: 200,
    description: "Blockchain information retrieved successfully",
    type: BlockchainInfoDto,
  })
  async getBlockchainInfo(): Promise<BlockchainInfoDto> {
    try {
      return await this.blockchainService.getBlockchainInfo();
    } catch (error) {
      Logger.error("Failed to get blockchain info:", error);
      throw new HttpException(
        `Failed to get blockchain info: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
