import { Router } from "express";
import { MetricsController } from "../controllers/metrics.controller";
import { MetricsService } from "../services/metrics.service";

/**
 * @swagger
 * tags:
 *   name: Metrics
 *   description: Blockchain metrics and monitoring endpoints
 */

/**
 * Setup metrics routes
 * @param {Router} router - Express router instance
 */
export function setupMetricsRoutes(router: Router): void {
  const metricsController = new MetricsController(new MetricsService());

  /**
   * @swagger
   * /metrics:
   *   get:
   *     summary: Get blockchain metrics
   *     tags: [Metrics]
   *     parameters:
   *       - in: query
   *         name: timeWindow
   *         schema:
   *           type: number
   *         description: Time window in milliseconds
   *     responses:
   *       200:
   *         description: Metrics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MetricsResponseDto'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   */
  router.get("/metrics", (req, res) => {
    try {
      const timeWindow = req.query.timeWindow
        ? Number(req.query.timeWindow)
        : undefined;
      const metrics = metricsController.getMetrics({ timeWindow });
      res.json(metrics);
    } catch (error: unknown) {
        if (error instanceof Error) {
            res.status(500).json({ message: error.message });
        } else {
            res.status(500).json({ message: "Failed to get metrics" });
        }
    }
  });

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
  router.get("/metrics/average-tag-fees", (req, res) => {
    try {
      const timeWindow = req.query.timeWindow
        ? Number(req.query.timeWindow)
        : undefined;
      const averageTAGFees = metricsController.getAverageTAGFeesMetrics({
        timeWindow,
      });
      res.json({ averageTAGFees });
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to get average TAG fees" });
      }
    }
  });

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
  router.get("/metrics/average-tag-volume", (req, res) => {
    try {
      const timeWindow = req.query.timeWindow
        ? Number(req.query.timeWindow)
        : undefined;
      const averageTAGVolume = metricsController.getAverageTAGVolumeMetrics({
        timeWindow,
      });
      res.json({ averageTAGVolume });
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to get average TAG volume" });
      }
    }
  });

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
  router.get("/metrics/average-hash-rate", (req, res) => {
    try {
      const timeWindow = req.query.timeWindow
        ? Number(req.query.timeWindow)
        : undefined;
      const averageHashRate = metricsController.getAverageHashRateMetrics({
        timeWindow,
      });
      res.json({ averageHashRate });
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to get average hash rate" });
      }
    }
  });
}
