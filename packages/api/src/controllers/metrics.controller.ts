import { Controller, Get, Query, InternalServerErrorException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetricsService } from '../services/metrics.service';
import { MetricsQueryDto, MetricsResponseDto } from '../dtos/metrics.dto';

/**
 * @swagger
 * tags:
 *   name: Metrics
 *   description: Blockchain metrics and monitoring endpoints
 */
@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

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
  @ApiOperation({ summary: 'Get H3Tag blockchain metrics' })
  @ApiResponse({
    status: 200,
    description: 'Returns H3Tag blockchain metrics',
    type: MetricsResponseDto,
  })
  getMetrics(@Query() query: MetricsQueryDto): MetricsResponseDto {
    try {
      // rely on a global validation/transformation pipe to ensure a valid number
      return this.metricsService.getMetrics(query.timeWindow);
    } catch (error) {
      this.logger.error('Error in getMetrics', error);
      throw new InternalServerErrorException('Failed to get metrics');
    }
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
   *     responses:
   *       200:
   *         description: Returns average TAG fees over the specified time window.
   *         content:
   *           application/json:
   *             schema:
   *               type: number
   */
  @Get('average-tag-fees')
  @ApiOperation({ summary: 'Get average TAG fees over specified time window' })
  @ApiResponse({
    status: 200,
    description: 'Returns average TAG fees',
    schema: { type: 'number' },
  })
  getAverageTAGFeesMetrics(@Query() query: MetricsQueryDto): number {
    try {
      return this.metricsService.getAverageTAGFeesMetrics(query.timeWindow);
    } catch (error) {
      this.logger.error('Error in getAverageTAGFeesMetrics', error);
      throw new InternalServerErrorException('Failed to get average TAG fees');
    }
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
   *     responses:
   *       200:
   *         description: Returns average TAG volume over the specified time window.
   *         content:
   *           application/json:
   *             schema:
   *               type: number
   */
  @Get('average-tag-volume')
  @ApiOperation({ summary: 'Get average TAG volume over specified time window' })
  @ApiResponse({
    status: 200,
    description: 'Returns average TAG volume',
    schema: { type: 'number' },
  })
  getAverageTAGVolumeMetrics(@Query() query: MetricsQueryDto): number {
    try {
      return this.metricsService.getAverageTAGVolumeMetrics(query.timeWindow);
    } catch (error) {
      this.logger.error('Error in getAverageTAGVolumeMetrics', error);
      throw new InternalServerErrorException('Failed to get average TAG volume');
    }
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
   *     responses:
   *       200:
   *         description: Returns average hash rate over the specified time window.
   *         content:
   *           application/json:
   *             schema:
   *               type: number
   */
  @Get('average-hash-rate')
  @ApiOperation({ summary: 'Get average hash rate over specified time window' })
  @ApiResponse({
    status: 200,
    description: 'Returns average hash rate',
    schema: { type: 'number' },
  })
  getAverageHashRateMetrics(@Query() query: MetricsQueryDto): number {
    try {
      return this.metricsService.getAverageHashRateMetrics(query.timeWindow);
    } catch (error) {
      this.logger.error('Error in getAverageHashRateMetrics', error);
      throw new InternalServerErrorException('Failed to get average hash rate');
    }
  }
}
