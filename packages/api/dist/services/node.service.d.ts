import { AuditManager, BlockchainSchema } from "@h3tag-blockchain/core";
import { CreateNodeDto, NodeResponseDto, NodeStatusDto, PeerDiscoveryResponseDto, PeerConnectionResponseDto } from "../dtos/node.dto";
import { ConfigService } from "@h3tag-blockchain/shared";
/**
 * @swagger
 * tags:
 *   name: Nodes
 *   description: Blockchain node management endpoints
 */
export declare class NodeService {
    private readonly configService;
    private readonly blockchainSchema;
    private readonly auditManager;
    private nodes;
    constructor(configService: ConfigService, blockchainSchema: BlockchainSchema, auditManager: AuditManager);
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
    createNode(params: CreateNodeDto): Promise<NodeResponseDto>;
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
    getNodeStatus(nodeId: string): Promise<NodeStatusDto>;
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
    stopNode(nodeId: string): Promise<boolean>;
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
    getActiveValidators(nodeId: string): Promise<{
        address: string;
    }[]>;
    discoverPeers(nodeId: string): Promise<PeerDiscoveryResponseDto>;
    connectToPeer(nodeId: string, peerAddress: string): Promise<PeerConnectionResponseDto>;
}
