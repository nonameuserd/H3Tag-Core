import express from 'express';
import { NodeController } from '../controllers/node.controller';
import { NodeService } from '../services/node.service';
import { ConfigService } from '@h3tag-blockchain/shared';
import { BlockchainSchema } from '@h3tag-blockchain/core';
import { AuditManager } from '@h3tag-blockchain/core';

/**
 * @swagger
 * tags:
 *   name: Nodes
 *   description: Node management endpoints
 */
const router = express.Router();
const nodeService = new NodeService(
  new ConfigService(),
  new BlockchainSchema(),
  new AuditManager(),
);
const nodeController = new NodeController(nodeService);

/**
 * @swagger
 * /api/v1/nodes/testnet:
 *   post:
 *     summary: Create a TESTNET node
 *     tags: [Nodes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateNodeDto'
 *     responses:
 *       200:
 *         description: Node created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NodeResponseDto'
 *       500:
 *         description: Server error
 */
router.post('/testnet', async (req, res) => {
  try {
    const result = await nodeController.createTestnetNode(req.body);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/nodes/mainnet:
 *   post:
 *     summary: Create a MAINNET node
 *     tags: [Nodes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateNodeDto'
 *     responses:
 *       200:
 *         description: Node created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NodeResponseDto'
 *       500:
 *         description: Server error
 */
router.post('/mainnet', async (req, res) => {
  try {
    const result = await nodeController.createMainnetNode(req.body);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/nodes/{nodeId}/status:
 *   get:
 *     summary: Get node status
 *     tags: [Nodes]
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Node status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NodeStatusDto'
 *       404:
 *         description: Node not found
 */
router.get('/:nodeId/status', async (req, res) => {
  try {
    const result = await nodeController.getNodeStatus(req.params.nodeId);
    res.json(result);
  } catch (error: unknown) {
    res.status(404).json({ error: (error as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/nodes/{nodeId}/stop:
 *   post:
 *     summary: Stop a node
 *     tags: [Nodes]
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Node stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 nodeId:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.post('/:nodeId/stop', async (req, res) => {
  try {
    const result = await nodeController.stopNode(req.params.nodeId);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/nodes/{nodeId}/validators:
 *   get:
 *     summary: Get active validators
 *     tags: [Nodes]
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Validators retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   address:
 *                     type: string
 *       500:
 *         description: Server error
 */
router.get('/:nodeId/validators', async (req, res) => {
  try {
    const result = await nodeController.getActiveValidators(req.params.nodeId);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/nodes/{nodeId}/discover-peers:
 *   post:
 *     summary: Trigger peer discovery for a node
 *     tags: [Nodes]
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Node identifier
 *     responses:
 *       200:
 *         description: Peer discovery completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PeerDiscoveryResponseDto'
 *       404:
 *         description: Node not found
 *       500:
 *         description: Server error
 */
router.post('/:nodeId/discover-peers', async (req, res) => {
  try {
    const result = await nodeController.discoverPeers(req.params.nodeId);
    res.json(result);
  } catch (error) {
    if ((error as Error).message.includes('not found')) {
      res.status(404).json({ error: (error as Error).message });
    } else {
      res.status(500).json({ error: (error as Error).message });
    }
  }
});

/**
 * @swagger
 * /api/v1/nodes/{nodeId}/connect-peer:
 *   post:
 *     summary: Connect to a specific peer
 *     tags: [Nodes]
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Node identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ConnectPeerDto'
 *     responses:
 *       200:
 *         description: Successfully connected to peer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PeerConnectionResponseDto'
 *       404:
 *         description: Node not found
 *       400:
 *         description: Invalid peer address or connection failed
 */
router.post('/:nodeId/connect-peer', async (req, res) => {
  try {
    const result = await nodeController.connectToPeer(
      req.params.nodeId,
      req.body,
    );
    res.json(result);
  } catch (error: unknown) {
    if ((error as Error).message.includes('not found')) {
      res.status(404).json({ error: (error as Error).message });
    } else {
      res.status(400).json({ error: (error as Error).message });
    }
  }
});

export default router;
