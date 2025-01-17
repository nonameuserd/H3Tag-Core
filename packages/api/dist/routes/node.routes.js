"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const node_controller_1 = require("../controllers/node.controller");
const node_service_1 = require("../services/node.service");
const shared_1 = require("@h3tag-blockchain/shared");
const core_1 = require("@h3tag-blockchain/core");
const core_2 = require("@h3tag-blockchain/core");
/**
 * @swagger
 * tags:
 *   name: Nodes
 *   description: Node management endpoints
 */
const router = express_1.default.Router();
const nodeService = new node_service_1.NodeService(new shared_1.ConfigService(), new core_1.BlockchainSchema(), new core_2.AuditManager());
const nodeController = new node_controller_1.NodeController(nodeService);
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
router.post("/testnet", async (req, res) => {
    try {
        const result = await nodeController.createTestnetNode(req.body);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
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
router.post("/mainnet", async (req, res) => {
    try {
        const result = await nodeController.createMainnetNode(req.body);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
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
router.get("/:nodeId/status", async (req, res) => {
    try {
        const result = await nodeController.getNodeStatus(req.params.nodeId);
        res.json(result);
    }
    catch (error) {
        res.status(404).json({ error: error.message });
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
router.post("/:nodeId/stop", async (req, res) => {
    try {
        const result = await nodeController.stopNode(req.params.nodeId);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
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
router.get("/:nodeId/validators", async (req, res) => {
    try {
        const result = await nodeController.getActiveValidators(req.params.nodeId);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
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
router.post("/:nodeId/discover-peers", async (req, res) => {
    try {
        const result = await nodeController.discoverPeers(req.params.nodeId);
        res.json(result);
    }
    catch (error) {
        if (error.message.includes("not found")) {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: error.message });
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
router.post("/:nodeId/connect-peer", async (req, res) => {
    try {
        const result = await nodeController.connectToPeer(req.params.nodeId, req.body);
        res.json(result);
    }
    catch (error) {
        if (error.message.includes("not found")) {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(400).json({ error: error.message });
        }
    }
});
exports.default = router;
//# sourceMappingURL=node.routes.js.map