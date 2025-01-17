import { DNSSeeder } from "../network/dnsSeed";
import { EventEmitter } from "events";
import { BlockchainSchema } from "../database/blockchain-schema";
import { ConfigService } from "@h3tag-blockchain/shared";
import { Logger } from "@h3tag-blockchain/shared";

interface HealthMonitorConfig {
  interval: number;
  thresholds: {
    minPowHashrate?: number;
    minPowNodes?: number;
    minTagDistribution?: number;
    maxTagConcentration?: number;
  };
}

export class HealthMonitor {
  private readonly eventEmitter = new EventEmitter();
  private dnsSeeder: DNSSeeder;
  readonly config: HealthMonitorConfig;

  constructor(config: HealthMonitorConfig) {
    this.config = config;
    const configService = new ConfigService();
    const database = new BlockchainSchema();
    this.dnsSeeder = new DNSSeeder(configService, database);
  }

  public async getNetworkHealth(): Promise<{
    powNodeCount: number;
    votingNodeCount: number;
    networkHashrate: number;
    tagHolderCount: number;
    tagDistribution: number;
    isHealthy: boolean;
  }> {
    try {
      const health = {
        powNodeCount: this.dnsSeeder?.getPowNodeCount() ?? 0,
        votingNodeCount: this.dnsSeeder?.getVotingNodeCount() ?? 0,
        networkHashrate: this.dnsSeeder?.getNetworkHashrate() ?? 0,
        tagHolderCount: (await this.dnsSeeder?.getTagHolderCount()) ?? 0,
        tagDistribution: (await this.dnsSeeder?.getTagDistribution()) ?? 0,
        isHealthy: false,
      };

      if (
        !this.config.thresholds.minPowNodes ||
        !this.config.thresholds.minPowHashrate ||
        !this.config.thresholds.minTagDistribution ||
        !this.config.thresholds.maxTagConcentration
      ) {
        throw new Error("Invalid health check thresholds");
      }

      health.isHealthy =
        health.powNodeCount >= this.config.thresholds.minPowNodes &&
        health.networkHashrate >= this.config.thresholds.minPowHashrate &&
        health.tagHolderCount >= this.config.thresholds.minTagDistribution &&
        health.tagDistribution <= this.config.thresholds.maxTagConcentration;

      return health;
    } catch (error) {
      Logger.error("Health check failed:", error);
      throw error;
    }
  }

  public async dispose(): Promise<void> {
    try {
      await this.dnsSeeder?.dispose();
      this.eventEmitter?.removeAllListeners();
    } catch (error) {
      Logger.error("Health monitor disposal failed:", error);
      throw error;
    }
  }
}
