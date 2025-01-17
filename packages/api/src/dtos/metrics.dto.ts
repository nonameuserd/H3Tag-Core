import { IsNumber, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * @swagger
 * components:
 *   schemas:
 *     MetricsQueryDto:
 *       type: object
 *       properties:
 *         timeWindow:
 *           type: number
 *           description: Time window in milliseconds for metrics calculation
 */
export class MetricsQueryDto {
  @ApiProperty({
    description: "Time window in milliseconds",
    required: false,
    example: 3600000,
  })
  @IsNumber()
  @IsOptional()
  timeWindow?: number;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     MetricsResponseDto:
 *       type: object
 *       properties:
 *         averageTAGFees:
 *           type: number
 *           description: Average TAG fees over the specified time window
 *         averageTAGVolume:
 *           type: number
 *           description: Average TAG transaction volume over the specified time window
 *         hashRate:
 *           type: number
 *           description: Current network hash rate
 *         difficulty:
 *           type: number
 *           description: Current mining difficulty
 *         blockHeight:
 *           type: number
 *           description: Current blockchain height
 *         syncedHeaders:
 *           type: number
 *           description: Number of synced headers
 *         syncedBlocks:
 *           type: number
 *           description: Number of synced blocks
 *         whitelistedPeers:
 *           type: number
 *           description: Number of whitelisted peers
 *         blacklistedPeers:
 *           type: number
 *           description: Number of blacklisted peers
 */
export class MetricsResponseDto {
  @ApiProperty({ description: "Average TAG fees" })
  averageTAGFees: number;

  @ApiProperty({ description: "Average TAG volume" })
  averageTAGVolume: number;

  @ApiProperty({ description: "Current hash rate" })
  hashRate: number;

  @ApiProperty({ description: "Current mining difficulty" })
  difficulty: number;

  @ApiProperty({ description: "Current block height" })
  blockHeight: number;

  @ApiProperty({ description: "Number of synced headers" })
  syncedHeaders: number;

  @ApiProperty({ description: "Number of synced blocks" })
  syncedBlocks: number;

  @ApiProperty({ description: "Number of whitelisted peers" })
  whitelistedPeers: number;

  @ApiProperty({ description: "Number of blacklisted peers" })
  blacklistedPeers: number;
}
