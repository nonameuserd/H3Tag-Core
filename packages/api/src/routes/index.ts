import { Router } from "express";
import nodeRoutes from "./node.routes";
import walletRoutes from "./wallet.routes";
import peerRoutes from "./peer.routes";
import blockchainRoutes from "./blockchain.routes";
import miningRoutes from "./mining.routes";
import transactionRoutes from "./transaction.routes";
import mempoolRoutes from "./mempool.routes";

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
const router = Router();

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
router.use("/nodes", nodeRoutes);

// Wallet management routes
router.use("/wallets", walletRoutes);

// Peer management routes
router.use("/peers", peerRoutes);

// Blockchain management routes
router.use("/blockchain", blockchainRoutes);

// Transaction management routes
router.use("/transactions", transactionRoutes);

// Mining management routes
router.use("/mining", miningRoutes);

// Mempool management routes
router.use("/mempool", mempoolRoutes);

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

export default router;
