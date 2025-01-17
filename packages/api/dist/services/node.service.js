"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@h3tag-blockchain/core");
/**
 * @swagger
 * tags:
 *   name: Nodes
 *   description: Blockchain node management endpoints
 */
let NodeService = class NodeService {
    constructor(configService, blockchainSchema, auditManager) {
        this.configService = configService;
        this.blockchainSchema = blockchainSchema;
        this.auditManager = auditManager;
        this.nodes = new Map();
    }
    /**
     * @swagger
     * /nodes:
     *   post:
     *     summary: Create a new blockchain node
     *     tags: [Nodes]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateNodeDto'
     *     responses:
     *       201:
     *         description: Node created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/NodeResponseDto'
     *       400:
     *         description: Invalid parameters or node creation failed
     */
    async createNode(params) {
        try {
            // Initialize blockchain
            const blockchain = await core_1.Blockchain.create({
                network: {
                    type: params.networkType,
                    port: params.port || 8333,
                    host: params.host || "localhost",
                    seedDomains: core_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.seedDomains[params.networkType],
                },
            });
            // Create mempool
            const mempool = new core_1.Mempool(blockchain);
            // Create node instance
            const node = new core_1.Node(blockchain, this.blockchainSchema, mempool, this.configService, this.auditManager);
            // Start the node
            await node.start();
            // Generate unique node ID
            const nodeId = `node-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 9)}`;
            // Store node instance
            this.nodes.set(nodeId, node);
            return {
                nodeId,
                status: "running",
                endpoint: `${params.host || "localhost"}:${params.port || 3000}`,
                networkType: params.networkType,
                peerCount: node.getPeerCount(),
                region: params.region,
            };
        }
        catch (error) {
            throw new Error(`Failed to create node: ${error.message}`);
        }
    }
    /**
     * @swagger
     * /nodes/{nodeId}/status:
     *   get:
     *     summary: Get node status information
     *     tags: [Nodes]
     *     parameters:
     *       - in: path
     *         name: nodeId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Node status retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/NodeStatusDto'
     *       404:
     *         description: Node not found
     */
    async getNodeStatus(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) {
            throw new Error("Node not found");
        }
        return {
            nodeId,
            status: "running",
            peerCount: node.getPeerCount(),
            bannedPeers: node.getBannedPeers(),
            address: node.getAddress(),
        };
    }
    /**
     * @swagger
     * /nodes/{nodeId}:
     *   delete:
     *     summary: Stop and remove a node
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
     *         schema:
     *           type: boolean
     *       404:
     *         description: Node not found
     */
    async stopNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node)
            return false;
        await node.stop();
        this.nodes.delete(nodeId);
        return true;
    }
    /**
     * @swagger
     * /nodes/{nodeId}/validators:
     *   get:
     *     summary: Get active validators for a node
     *     tags: [Nodes]
     *     parameters:
     *       - in: path
     *         name: nodeId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Active validators retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   address:
     *                     type: string
     *       404:
     *         description: Node not found
     */
    async getActiveValidators(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) {
            throw new Error("Node not found");
        }
        return node.getActiveValidators();
    }
    async discoverPeers(nodeId) {
        try {
            const node = this.nodes.get(nodeId);
            if (!node) {
                throw new Error("Node not found");
            }
            // Initial peer count
            const initialPeerCount = node.getPeerCount();
            // Trigger peer discovery
            await node.discoverPeers();
            // Get updated peer count
            const newPeerCount = node.getPeerCount();
            return {
                discoveredPeers: Math.max(0, newPeerCount - initialPeerCount),
                totalPeers: newPeerCount,
                peerMetrics: {
                    current: newPeerCount,
                    minimum: node.getConfig().minPeers,
                },
            };
        }
        catch (error) {
            common_1.Logger.error("Failed to discover peers:", error);
            throw error;
        }
    }
    async connectToPeer(nodeId, peerAddress) {
        try {
            const node = this.nodes.get(nodeId);
            if (!node) {
                throw new Error("Node not found");
            }
            // Connect to peer
            await node.connectToPeer(peerAddress);
            // Get peer info
            const peer = node.getPeer(peerAddress);
            if (!peer) {
                throw new Error("Failed to get peer information after connection");
            }
            return {
                status: "connected",
                address: peerAddress,
                version: peer.getVersion().toString(),
                height: peer.getHeight(),
                connectedAt: new Date().toISOString(),
            };
        }
        catch (error) {
            common_1.Logger.error("Failed to connect to peer:", error);
            throw error;
        }
    }
};
exports.NodeService = NodeService;
exports.NodeService = NodeService = __decorate([
    (0, common_1.Injectable)()
], NodeService);
//# sourceMappingURL=node.service.js.map