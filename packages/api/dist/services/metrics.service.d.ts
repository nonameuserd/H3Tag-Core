import { MetricsResponseDto } from "../dtos/metrics.dto";
/**
 * @swagger
 * tags:
 *   name: Metrics
 *   description: Blockchain metrics and monitoring service
 */
export declare class MetricsService {
    private readonly metrics;
    constructor();
    /**
     * Get blockchain metrics over specified time window
     * @param {number} timeWindow - Time window in milliseconds (default: 1 hour)
     * @returns {Object} Metrics data including averages and current values
     */
    getMetrics(timeWindow?: number): MetricsResponseDto;
    /**
     * Get average TAG fees over specified time window
     * @param {number} timeWindow - Time window in milliseconds (default: 1 hour)
     * @returns {number} Average TAG fees
     */
    getAverageTAGFeesMetrics(timeWindow?: number): number;
    /**
     * Get average TAG volume over specified time window
     * @param {number} timeWindow - Time window in milliseconds (default: 1 hour)
     * @returns {number} Average TAG volume
     */
    getAverageTAGVolumeMetrics(timeWindow?: number): number;
    /**
     * Get average hash rate over specified time window
     * @param {number} timeWindow - Time window in milliseconds (default: 1 hour)
     * @returns {number} Average hash rate
     */
    getAverageHashRateMetrics(timeWindow?: number): number;
}
