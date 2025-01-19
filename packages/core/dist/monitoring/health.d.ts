/**
 * @fileoverview Health monitoring system for the H3Tag blockchain. Includes health checks,
 * threshold monitoring, and network status tracking for maintaining blockchain stability.
 *
 * @module HealthMonitor
 */
/**
 * @interface HealthMonitorConfig
 * @description Configuration for the health monitoring system
 *
 * @property {number} interval - Health check interval in milliseconds
 * @property {Object} thresholds - Health check thresholds
 * @property {number} thresholds.minPowHashrate - Minimum required PoW hashrate
 * @property {number} thresholds.minPowNodes - Minimum required PoW nodes
 * @property {number} thresholds.minTagDistribution - Minimum TAG token distribution
 * @property {number} thresholds.maxTagConcentration - Maximum TAG token concentration
 */
export interface HealthMonitorConfig {
    interval: number;
    thresholds: {
        minPowHashrate?: number;
        minPowNodes?: number;
        minTagDistribution?: number;
        maxTagConcentration?: number;
    };
}
/**
 * @class HealthMonitor
 * @description Monitors and reports on blockchain network health
 *
 * @property {EventEmitter} eventEmitter - Event emitter for health status changes
 * @property {DNSSeeder} dnsSeeder - DNS seeder for network metrics
 * @property {HealthMonitorConfig} config - Health monitor configuration
 *
 * @example
 * const config = {
 *   interval: 60000,
 *   thresholds: {
 *     minPowHashrate: 1000000,
 *     minPowNodes: 10,
 *     minTagDistribution: 1000,
 *     maxTagConcentration: 0.1
 *   }
 * };
 * const monitor = new HealthMonitor(config);
 * const health = await monitor.getNetworkHealth();
 */
export declare class HealthMonitor {
    private readonly eventEmitter;
    private dnsSeeder;
    readonly config: HealthMonitorConfig;
    /**
     * Creates a new HealthMonitor instance
     * @param {HealthMonitorConfig} config - Monitor configuration
     * @throws {Error} If configuration is invalid
     */
    constructor(config: HealthMonitorConfig);
    /**
     * Validates monitor configuration
     * @param {HealthMonitorConfig} config - Configuration to validate
     * @returns {boolean} True if configuration is valid
     * @private
     */
    private isValidConfig;
    /**
     * Gets current network health status
     * @returns {Promise<Object>} Network health metrics and status
     * @throws {Error} If health check fails or DNS seeder not initialized
     */
    getNetworkHealth(): Promise<{
        powNodeCount: number;
        votingNodeCount: number;
        networkHashrate: number;
        tagHolderCount: number;
        tagDistribution: number;
        isHealthy: boolean;
    }>;
    /**
     * Validates health check thresholds
     * @returns {boolean} True if thresholds are valid
     * @private
     */
    private validateThresholds;
    /**
     * Cleans up monitor resources
     * @throws {Error} If cleanup fails
     */
    dispose(): Promise<void>;
}
