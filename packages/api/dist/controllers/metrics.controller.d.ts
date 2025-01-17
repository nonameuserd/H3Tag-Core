import { MetricsService } from "../services/metrics.service";
import { MetricsQueryDto, MetricsResponseDto } from "../dtos/metrics.dto";
/**
 * @swagger
 * tags:
 *   name: Metrics
 *   description: Blockchain metrics and monitoring endpoints
 */
export declare class MetricsController {
    private readonly metricsService;
    constructor(metricsService: MetricsService);
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
    getMetrics(query: MetricsQueryDto): MetricsResponseDto;
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
    getAverageTAGFeesMetrics(query: MetricsQueryDto): number;
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
    getAverageTAGVolumeMetrics(query: MetricsQueryDto): number;
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
    getAverageHashRateMetrics(query: MetricsQueryDto): number;
}
