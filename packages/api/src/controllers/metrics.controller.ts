import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { MetricsService } from "../services/metrics.service";
import { MetricsQueryDto, MetricsResponseDto } from "../dtos/metrics.dto";

/**
 * @swagger
 * tags:
 *   name: Metrics
 *   description: Blockchain metrics and monitoring endpoints
 */
@ApiTags("Metrics")
@Controller("metrics")
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * @swagger
   * /metrics:
   *   get:
   *     summary: Get H3Tag blockchain metrics
   *     tags: [Metrics]
   *     parameters:
   *       - in: query
   *         name: timeWindow
   *         schema:
   *           type: number
   *         description: Time window in milliseconds for calculating averages
   *     responses:
   *       200:
   *         description: Returns H3Tag blockchain metrics
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MetricsResponseDto'
   */
  @Get()
  @ApiOperation({ summary: "Get H3Tag blockchain metrics" })
  @ApiResponse({
    status: 200,
    description: "Returns H3Tag blockchain metrics",
    type: MetricsResponseDto,
  })
  getMetrics(@Query() query: MetricsQueryDto): MetricsResponseDto {
    return this.metricsService.getMetrics(query.timeWindow);
  }

  /**
   * @swagger
   * /metrics/average-tag-fees:
   *   get:
   *     summary: Get average TAG fees over specified time window
   *     tags: [Metrics]
   *     parameters:
   *       - in: query
   *         name: timeWindow
   *         schema:
   *           type: number
   *         description: Time window in milliseconds
   */
  @Get("average-tag-fees")
  getAverageTAGFeesMetrics(@Query() query: MetricsQueryDto): number {
    return this.metricsService.getAverageTAGFeesMetrics(query.timeWindow);
  }

  /**
   * @swagger
   * /metrics/average-tag-volume:
   *   get:
   *     summary: Get average TAG volume over specified time window
   *     tags: [Metrics]
   *     parameters:
   *       - in: query
   *         name: timeWindow
   *         schema:
   *           type: number
   *         description: Time window in milliseconds
   */
  @Get("average-tag-volume")
  getAverageTAGVolumeMetrics(@Query() query: MetricsQueryDto): number {
    return this.metricsService.getAverageTAGVolumeMetrics(query.timeWindow);
  }

  /**
   * @swagger
   * /metrics/average-hash-rate:
   *   get:
   *     summary: Get average hash rate over specified time window
   *     tags: [Metrics]
   *     parameters:
   *       - in: query
   *         name: timeWindow
   *         schema:
   *           type: number
   *         description: Time window in milliseconds
   */
  @Get("average-hash-rate")
  getAverageHashRateMetrics(@Query() query: MetricsQueryDto): number {
    return this.metricsService.getAverageHashRateMetrics(query.timeWindow);
  }
}
