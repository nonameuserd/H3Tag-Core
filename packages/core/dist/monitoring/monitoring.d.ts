import winston from "winston";
/**
 * @fileoverview Monitoring system for the H3Tag blockchain. Includes performance tracking,
 * metrics collection, logging, and alerting for blockchain operations.
 *
 * @module Monitoring
 */
/**
 * @class MonitoringError
 * @extends Error
 * @description Custom error class for monitoring-related errors
 *
 * @example
 * throw new MonitoringError("Failed to initialize monitoring system");
 */
export declare class MonitoringError extends Error {
    constructor(message: string);
}
/**
 * @class Monitoring
 * @description Core monitoring system for blockchain operations
 *
 * @property {Object} metrics - Prometheus metrics collection
 * @property {prometheus.Gauge} metrics.activeNodes - Active nodes counter
 * @property {prometheus.Gauge} metrics.powHashrate - PoW hashrate gauge
 * @property {prometheus.Histogram} metrics.blockTime - Block time histogram
 * @property {prometheus.Gauge} metrics.networkDifficulty - Network difficulty gauge
 * @property {prometheus.Gauge} metrics.powNodeCount - PoW node count gauge
 * @property {winston.Logger} logger - Winston logger instance
 * @property {Map<string, number>} timers - Active monitoring timers
 *
 * @example
 * const monitoring = new Monitoring();
 * await monitoring.updateMetrics({
 *   powNodes: 10,
 *   hashrate: 1000000,
 *   blockTime: 60,
 *   difficulty: 12345
 * });
 */
export declare class Monitoring {
    private metrics;
    logger: winston.Logger;
    private timers;
    private responseTimeHistogram;
    private readonly mutex;
    constructor();
    /**
     * Updates monitoring metrics
     * @param {Object} data - Metric data to update
     * @param {number} [data.powNodes] - Number of PoW nodes
     * @param {number} [data.hashrate] - Current hashrate
     * @param {number} [data.blockTime] - Block time in seconds
     * @param {number} [data.difficulty] - Network difficulty
     * @throws {MonitoringError} If metrics update fails
     */
    updateMetrics(data: {
        powNodes?: number;
        hashrate?: number;
        blockTime?: number;
        difficulty?: number;
        voterParticipation?: number;
    }): Promise<void>;
    /**
     * Shuts down monitoring system
     * @throws {MonitoringError} If shutdown fails
     */
    shutdown(): Promise<void>;
    startTimer(label: string): {
        end: () => number;
    };
    /**
     * Records HTTP response time
     * @param {string} method - HTTP method
     * @param {string} path - Request path
     * @param {number} duration - Response time in milliseconds
     */
    recordResponseTime(method: string, path: string, duration: number): void;
    /**
     * Updates active nodes count
     * @param {number} count - Number of active nodes
     */
    updateActiveNodes(count: number): void;
    /**
     * Updates network metrics
     * @param {number} totalHashPower - Total network hashpower
     * @param {number} totalNodes - Total number of nodes
     */
    updateNetworkMetrics(totalHashPower: number, totalNodes: number): void;
}
