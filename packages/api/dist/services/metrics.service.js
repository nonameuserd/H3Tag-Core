"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@h3tag-blockchain/core");
const shared_1 = require("@h3tag-blockchain/shared");
/**
 * @swagger
 * tags:
 *   name: Metrics
 *   description: Blockchain metrics and monitoring service
 */
let MetricsService = class MetricsService {
    constructor() {
        this.metrics = core_1.MiningMetrics.getInstance();
    }
    /**
     * Get blockchain metrics over specified time window
     * @param {number} timeWindow - Time window in milliseconds (default: 1 hour)
     * @returns {Object} Metrics data including averages and current values
     */
    getMetrics(timeWindow = 3600000) {
        try {
            return {
                averageTAGFees: this.metrics.getAverageTAGFees(timeWindow),
                averageTAGVolume: this.metrics.getAverageTAGVolume(timeWindow),
                hashRate: this.metrics.getAverageHashRate(timeWindow),
                difficulty: this.metrics.difficulty,
                blockHeight: this.metrics.blockHeight,
                syncedHeaders: this.metrics.syncedHeaders,
                syncedBlocks: this.metrics.syncedBlocks,
                whitelistedPeers: this.metrics.whitelistedPeers,
                blacklistedPeers: this.metrics.blacklistedPeers,
            };
        }
        catch (error) {
            shared_1.Logger.error("Failed to get metrics:", error);
            throw error;
        }
    }
    /**
     * Get average TAG fees over specified time window
     * @param {number} timeWindow - Time window in milliseconds (default: 1 hour)
     * @returns {number} Average TAG fees
     */
    getAverageTAGFeesMetrics(timeWindow = 3600000) {
        try {
            return this.metrics.getAverageTAGFees(timeWindow);
        }
        catch (error) {
            shared_1.Logger.error("Failed to get average TAG fees:", error);
            throw error;
        }
    }
    /**
     * Get average TAG volume over specified time window
     * @param {number} timeWindow - Time window in milliseconds (default: 1 hour)
     * @returns {number} Average TAG volume
     */
    getAverageTAGVolumeMetrics(timeWindow = 3600000) {
        try {
            return this.metrics.getAverageTAGVolume(timeWindow);
        }
        catch (error) {
            shared_1.Logger.error("Failed to get average TAG volume:", error);
            throw error;
        }
    }
    /**
     * Get average hash rate over specified time window
     * @param {number} timeWindow - Time window in milliseconds (default: 1 hour)
     * @returns {number} Average hash rate
     */
    getAverageHashRateMetrics(timeWindow = 3600000) {
        try {
            return this.metrics.getAverageHashRate(timeWindow);
        }
        catch (error) {
            shared_1.Logger.error("Failed to get average hash rate:", error);
            throw error;
        }
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = __decorate([
    (0, common_1.Injectable)()
], MetricsService);
