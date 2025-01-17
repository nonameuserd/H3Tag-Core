"use strict";
/**
 * @fileoverview Health monitoring system for the H3Tag blockchain. Includes health checks,
 * threshold monitoring, and network status tracking for maintaining blockchain stability.
 *
 * @module HealthMonitor
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthMonitor = void 0;
const dnsSeed_1 = require("../network/dnsSeed");
const events_1 = require("events");
const blockchain_schema_1 = require("../database/blockchain-schema");
const shared_1 = require("@h3tag-blockchain/shared");
const shared_2 = require("@h3tag-blockchain/shared");
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
class HealthMonitor {
    /**
     * Creates a new HealthMonitor instance
     * @param {HealthMonitorConfig} config - Monitor configuration
     * @throws {Error} If configuration is invalid
     */
    constructor(config) {
        this.eventEmitter = new events_1.EventEmitter();
        if (!this.isValidConfig(config)) {
            throw new Error("Invalid health monitor configuration");
        }
        this.config = config;
        try {
            const configService = new shared_1.ConfigService();
            const database = new blockchain_schema_1.BlockchainSchema();
            this.dnsSeeder = new dnsSeed_1.DNSSeeder(configService, database);
        }
        catch (error) {
            shared_2.Logger.error("Failed to initialize HealthMonitor:", error);
            throw error;
        }
    }
    /**
     * Validates monitor configuration
     * @param {HealthMonitorConfig} config - Configuration to validate
     * @returns {boolean} True if configuration is valid
     * @private
     */
    isValidConfig(config) {
        return !!(config &&
            typeof config.interval === "number" &&
            config.interval > 0 &&
            config.thresholds &&
            typeof config.thresholds.minPowNodes === "number" &&
            typeof config.thresholds.minPowHashrate === "number" &&
            typeof config.thresholds.minTagDistribution === "number" &&
            typeof config.thresholds.maxTagConcentration === "number");
    }
    /**
     * Gets current network health status
     * @returns {Promise<Object>} Network health metrics and status
     * @throws {Error} If health check fails or DNS seeder not initialized
     */
    async getNetworkHealth() {
        try {
            if (!this.dnsSeeder) {
                throw new Error("DNS Seeder not initialized");
            }
            const health = {
                powNodeCount: this.dnsSeeder.getPowNodeCount(),
                votingNodeCount: this.dnsSeeder.getVotingNodeCount(),
                networkHashrate: this.dnsSeeder.getNetworkHashrate(),
                tagHolderCount: await this.dnsSeeder.getTagHolderCount(),
                tagDistribution: await this.dnsSeeder.getTagDistribution(),
                isHealthy: false,
            };
            if (!this.validateThresholds()) {
                throw new Error("Invalid health check thresholds");
            }
            health.isHealthy =
                health.powNodeCount >= this.config.thresholds.minPowNodes &&
                    health.networkHashrate >= this.config.thresholds.minPowHashrate &&
                    health.tagHolderCount >= this.config.thresholds.minTagDistribution &&
                    health.tagDistribution <= this.config.thresholds.maxTagConcentration;
            return health;
        }
        catch (error) {
            shared_2.Logger.error("Health check failed:", error);
            throw error;
        }
    }
    /**
     * Validates health check thresholds
     * @returns {boolean} True if thresholds are valid
     * @private
     */
    validateThresholds() {
        return !!(this.config.thresholds.minPowNodes &&
            this.config.thresholds.minPowHashrate &&
            this.config.thresholds.minTagDistribution &&
            this.config.thresholds.maxTagConcentration);
    }
    /**
     * Cleans up monitor resources
     * @throws {Error} If cleanup fails
     */
    async dispose() {
        try {
            if (this.dnsSeeder) {
                await this.dnsSeeder.dispose();
            }
            this.eventEmitter.removeAllListeners();
        }
        catch (error) {
            shared_2.Logger.error("Health monitor disposal failed:", error);
            throw error;
        }
    }
}
exports.HealthMonitor = HealthMonitor;
//# sourceMappingURL=health.js.map