import { Injectable } from "@nestjs/common";
import { MiningMetrics } from "@h3tag-blockchain/core";
import { Logger } from "@h3tag-blockchain/shared";
import { MetricsResponseDto } from "../dtos/metrics.dto";

/**
 * @swagger
 * tags:
 *   name: Metrics
 *   description: Blockchain metrics and monitoring service
 */
@Injectable()
export class MetricsService {
  private readonly metrics: MiningMetrics;

  constructor() {
    this.metrics = MiningMetrics.getInstance();
  }

  /**
   * Get blockchain metrics over specified time window
   * @param {number} timeWindow - Time window in milliseconds (default: 1 hour)
   * @returns {Object} Metrics data including averages and current values
   */
  getMetrics(timeWindow: number = 3600000): MetricsResponseDto {
    try {
      return {
        averageTAGFees: this.metrics.getAverageTAGFees(timeWindow),
        averageTAGVolume: this.metrics.getAverageTAGVolume(timeWindow),
        hashRate: this.metrics.getAverageHashRate(timeWindow),
        difficulty: this.metrics.difficulty,
        blockHeight: this.metrics.blockHeight,
        syncedHeaders: this.metrics.syncedHeaders,
        syncedBlocks: this.metrics.syncedBlocks,
        whitelistedPeers: this.metrics.whitelistedPeers,
        blacklistedPeers: this.metrics.blacklistedPeers,
      };
    } catch (error) {
      Logger.error("Failed to get metrics:", error);
      throw error;
    }
  }

  /**
   * Get average TAG fees over specified time window
   * @param {number} timeWindow - Time window in milliseconds (default: 1 hour)
   * @returns {number} Average TAG fees
   */
  getAverageTAGFeesMetrics(timeWindow: number = 3600000): number {
    try {
      return this.metrics.getAverageTAGFees(timeWindow);
    } catch (error) {
      Logger.error("Failed to get average TAG fees:", error);
      throw error;
    }
  }

  /**
   * Get average TAG volume over specified time window
   * @param {number} timeWindow - Time window in milliseconds (default: 1 hour)
   * @returns {number} Average TAG volume
   */
  getAverageTAGVolumeMetrics(timeWindow: number = 3600000): number {
    try {
      return this.metrics.getAverageTAGVolume(timeWindow);
    } catch (error) {
      Logger.error("Failed to get average TAG volume:", error);
      throw error;
    }
  }

  /**
   * Get average hash rate over specified time window
   * @param {number} timeWindow - Time window in milliseconds (default: 1 hour)
   * @returns {number} Average hash rate
   */
  getAverageHashRateMetrics(timeWindow: number = 3600000): number {
    try {
      return this.metrics.getAverageHashRate(timeWindow);
    } catch (error) {
      Logger.error("Failed to get average hash rate:", error);
      throw error;
    }
  }
}
