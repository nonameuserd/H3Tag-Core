/**
 * @fileoverview Health monitoring system for the H3Tag blockchain. Includes health checks,
 * threshold monitoring, and network status tracking for maintaining blockchain stability.
 *
 * @module HealthMonitor
 */

import { DNSSeeder } from '../network/dnsSeed';
import { EventEmitter } from 'events';
import { BlockchainSchema } from '../database/blockchain-schema';
import { ConfigService } from '@h3tag-blockchain/shared';
import { Logger } from '@h3tag-blockchain/shared';

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
export class HealthMonitor {
  private readonly eventEmitter = new EventEmitter();
  private dnsSeeder: DNSSeeder;
  readonly config: HealthMonitorConfig;

  /**
   * Creates a new HealthMonitor instance
   * @param {HealthMonitorConfig} config - Monitor configuration
   * @throws {Error} If configuration is invalid
   */
  constructor(config: HealthMonitorConfig) {
    if (!this.isValidConfig(config)) {
      throw new Error('Invalid health monitor configuration');
    }
    this.config = config;

    try {
      const configService = new ConfigService();
      const database = new BlockchainSchema();
      this.dnsSeeder = new DNSSeeder(configService, database);
    } catch (error) {
      Logger.error('Failed to initialize HealthMonitor:', error);
      throw error;
    }
  }

  /**
   * Validates monitor configuration
   * @param {HealthMonitorConfig} config - Configuration to validate
   * @returns {boolean} True if configuration is valid
   * @private
   */
  private isValidConfig(config: HealthMonitorConfig): boolean {
    return !!(
      config &&
      typeof config.interval === 'number' &&
      config.interval > 0 &&
      config.thresholds &&
      typeof config.thresholds.minPowNodes === 'number' &&
      typeof config.thresholds.minPowHashrate === 'number' &&
      typeof config.thresholds.minTagDistribution === 'number' &&
      typeof config.thresholds.maxTagConcentration === 'number'
    );
  }

  /**
   * Gets current network health status
   * @returns {Promise<Object>} Network health metrics and status
   * @throws {Error} If health check fails or DNS seeder not initialized
   */
  public async getNetworkHealth(): Promise<{
    powNodeCount: number;
    votingNodeCount: number;
    networkHashrate: number;
    tagHolderCount: number;
    tagDistribution: number;
    isHealthy: boolean;
  }> {
    try {
      if (!this.dnsSeeder) {
        throw new Error('DNS Seeder not initialized');
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
        throw new Error('Invalid health check thresholds');
      }

      health.isHealthy =
        health.powNodeCount >= this.config.thresholds.minPowNodes &&
        health.networkHashrate >= this.config.thresholds.minPowHashrate &&
        health.tagHolderCount >= this.config.thresholds.minTagDistribution &&
        health.tagDistribution <= this.config.thresholds.maxTagConcentration;

      return health;
    } catch (error) {
      Logger.error('Health check failed:', error);
      throw error;
    }
  }

  /**
   * Validates health check thresholds
   * @returns {boolean} True if thresholds are valid
   * @private
   */
  private validateThresholds(): boolean {
    return !!(
      this.config.thresholds.minPowNodes &&
      this.config.thresholds.minPowHashrate &&
      this.config.thresholds.minTagDistribution &&
      this.config.thresholds.maxTagConcentration
    );
  }

  /**
   * Cleans up monitor resources
   * @throws {Error} If cleanup fails
   */
  public async dispose(): Promise<void> {
    try {
      if (this.dnsSeeder) {
        await this.dnsSeeder.dispose();
      }
      this.eventEmitter.removeAllListeners();
    } catch (error) {
      Logger.error('Health monitor disposal failed:', error);
      throw error;
    }
  }
}
