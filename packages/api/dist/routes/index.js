"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const node_routes_1 = __importDefault(require("./node.routes"));
const wallet_routes_1 = __importDefault(require("./wallet.routes"));
const peer_routes_1 = __importDefault(require("./peer.routes"));
const blockchain_routes_1 = __importDefault(require("./blockchain.routes"));
const mining_routes_1 = __importDefault(require("./mining.routes"));
const transaction_routes_1 = __importDefault(require("./transaction.routes"));
const mempool_routes_1 = __importDefault(require("./mempool.routes"));
/**
 * @swagger
 * tags:
 *   - name: API
 *     description: Main API router
 *   - name: Blockchain
 *     description: Blockchain management endpoints
 *   - name: Wallets
 *     description: Wallet management endpoints
 *   - name: Peers
 *     description: Peer network management endpoints
 *   - name: Nodes
 *     description: Node management endpoints
 *   - name: Mining
 *     description: Mining management endpoints
 *   - name: Transactions
 *     description: Transaction management endpoints
 *   - name: Mempool
 *     description: Mempool management endpoints
 */
const router = (0, express_1.Router)();
/**
 * @swagger
 * components:
 *   schemas:
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 */
// Node management routes
router.use("/nodes", node_routes_1.default);
// Wallet management routes
router.use("/wallets", wallet_routes_1.default);
// Peer management routes
router.use("/peers", peer_routes_1.default);
// Blockchain management routes
router.use("/blockchain", blockchain_routes_1.default);
// Transaction management routes
router.use("/transactions", transaction_routes_1.default);
// Mining management routes
router.use("/mining", mining_routes_1.default);
// Mempool management routes
router.use("/mempool", mempool_routes_1.default);
// Health check endpoint
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [API]
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get("/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
    });
});
exports.default = router;
