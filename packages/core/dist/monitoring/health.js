"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthMonitor = void 0;
const dnsSeed_1 = require("../network/dnsSeed");
const events_1 = require("events");
const blockchain_schema_1 = require("../database/blockchain-schema");
const shared_1 = require("@h3tag-blockchain/shared");
const shared_2 = require("@h3tag-blockchain/shared");
class HealthMonitor {
    constructor(config) {
        this.eventEmitter = new events_1.EventEmitter();
        this.config = config;
        const configService = new shared_1.ConfigService();
        const database = new blockchain_schema_1.BlockchainSchema();
        this.dnsSeeder = new dnsSeed_1.DNSSeeder(configService, database);
    }
    async getNetworkHealth() {
        try {
            const health = {
                powNodeCount: this.dnsSeeder?.getPowNodeCount() ?? 0,
                votingNodeCount: this.dnsSeeder?.getVotingNodeCount() ?? 0,
                networkHashrate: this.dnsSeeder?.getNetworkHashrate() ?? 0,
                tagHolderCount: (await this.dnsSeeder?.getTagHolderCount()) ?? 0,
                tagDistribution: (await this.dnsSeeder?.getTagDistribution()) ?? 0,
                isHealthy: false,
            };
            if (!this.config.thresholds.minPowNodes ||
                !this.config.thresholds.minPowHashrate ||
                !this.config.thresholds.minTagDistribution ||
                !this.config.thresholds.maxTagConcentration) {
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
    async dispose() {
        try {
            await this.dnsSeeder?.dispose();
            this.eventEmitter?.removeAllListeners();
        }
        catch (error) {
            shared_2.Logger.error("Health monitor disposal failed:", error);
            throw error;
        }
    }
}
exports.HealthMonitor = HealthMonitor;
//# sourceMappingURL=health.js.map