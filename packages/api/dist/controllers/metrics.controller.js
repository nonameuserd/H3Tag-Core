"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const metrics_dto_1 = require("../dtos/metrics.dto");
/**
 * @swagger
 * tags:
 *   name: Metrics
 *   description: Blockchain metrics and monitoring endpoints
 */
let MetricsController = class MetricsController {
    constructor(metricsService) {
        this.metricsService = metricsService;
    }
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
    getMetrics(query) {
        return this.metricsService.getMetrics(query.timeWindow);
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
     */
    getAverageTAGFeesMetrics(query) {
        return this.metricsService.getAverageTAGFeesMetrics(query.timeWindow);
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
     */
    getAverageTAGVolumeMetrics(query) {
        return this.metricsService.getAverageTAGVolumeMetrics(query.timeWindow);
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
     */
    getAverageHashRateMetrics(query) {
        return this.metricsService.getAverageHashRateMetrics(query.timeWindow);
    }
};
exports.MetricsController = MetricsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: "Get H3Tag blockchain metrics" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Returns H3Tag blockchain metrics",
        type: metrics_dto_1.MetricsResponseDto,
    }),
    __param(0, (0, common_1.Query)())
], MetricsController.prototype, "getMetrics", null);
__decorate([
    (0, common_1.Get)("average-tag-fees"),
    __param(0, (0, common_1.Query)())
], MetricsController.prototype, "getAverageTAGFeesMetrics", null);
__decorate([
    (0, common_1.Get)("average-tag-volume"),
    __param(0, (0, common_1.Query)())
], MetricsController.prototype, "getAverageTAGVolumeMetrics", null);
__decorate([
    (0, common_1.Get)("average-hash-rate"),
    __param(0, (0, common_1.Query)())
], MetricsController.prototype, "getAverageHashRateMetrics", null);
exports.MetricsController = MetricsController = __decorate([
    (0, swagger_1.ApiTags)("Metrics"),
    (0, common_1.Controller)("metrics")
], MetricsController);
//# sourceMappingURL=metrics.controller.js.map