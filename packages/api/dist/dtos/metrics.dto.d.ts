/**
 * @swagger
 * components:
 *   schemas:
 *     MetricsQueryDto:
 *       type: object
 *       properties:
 *         timeWindow:
 *           type: number
 *           description: Time window in milliseconds for metrics calculation
 */
export declare class MetricsQueryDto {
    timeWindow?: number;
}
/**
 * @swagger
 * components:
 *   schemas:
 *     MetricsResponseDto:
 *       type: object
 *       properties:
 *         averageTAGFees:
 *           type: number
 *           description: Average TAG fees over the specified time window
 *         averageTAGVolume:
 *           type: number
 *           description: Average TAG transaction volume over the specified time window
 *         hashRate:
 *           type: number
 *           description: Current network hash rate
 *         difficulty:
 *           type: number
 *           description: Current mining difficulty
 *         blockHeight:
 *           type: number
 *           description: Current blockchain height
 *         syncedHeaders:
 *           type: number
 *           description: Number of synced headers
 *         syncedBlocks:
 *           type: number
 *           description: Number of synced blocks
 *         whitelistedPeers:
 *           type: number
 *           description: Number of whitelisted peers
 *         blacklistedPeers:
 *           type: number
 *           description: Number of blacklisted peers
 */
export declare class MetricsResponseDto {
    averageTAGFees: number;
    averageTAGVolume: number;
    hashRate: number;
    difficulty: number;
    blockHeight: number;
    syncedHeaders: number;
    syncedBlocks: number;
    whitelistedPeers: number;
    blacklistedPeers: number;
}
