import { Injectable, Logger } from "@nestjs/common";
import {
  Node,
  Blockchain,
  Mempool,
  AuditManager,
  BlockchainSchema,
  BLOCKCHAIN_CONSTANTS,
} from "@h3tag-blockchain/core";
import {
  CreateNodeDto,
  NodeResponseDto,
  NodeStatusDto,
  PeerDiscoveryResponseDto,
  PeerConnectionResponseDto,
} from "../dtos/node.dto";
import { ConfigService } from "@h3tag-blockchain/shared";

/**
 * @swagger
 * tags:
 *   name: Nodes
 *   description: Blockchain node management endpoints
 */
@Injectable()
export class NodeService {
  private nodes: Map<string, Node> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly blockchainSchema: BlockchainSchema,
    private readonly auditManager: AuditManager
  ) {}

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
  async createNode(params: CreateNodeDto): Promise<NodeResponseDto> {
    try {
      // Initialize blockchain
      const blockchain = await Blockchain.create({
        network: {
          type: params.networkType,
          port: params.port || 8333,
          host: params.host || "localhost",
          seedDomains:
            BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.seedDomains[
              params.networkType
            ],
        },
      });

      // Create mempool
      const mempool = new Mempool(blockchain);

      // Create node instance
      const node = new Node(
        blockchain,
        this.blockchainSchema,
        mempool,
        this.configService,
        this.auditManager
      );

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
    } catch (error) {
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
  async getNodeStatus(nodeId: string): Promise<NodeStatusDto> {
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
  async stopNode(nodeId: string): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

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
  async getActiveValidators(nodeId: string): Promise<{ address: string }[]> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error("Node not found");
    }
    return node.getActiveValidators();
  }

  async discoverPeers(nodeId: string): Promise<PeerDiscoveryResponseDto> {
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
    } catch (error) {
      Logger.error("Failed to discover peers:", error);
      throw error;
    }
  }

  async connectToPeer(
    nodeId: string,
    peerAddress: string
  ): Promise<PeerConnectionResponseDto> {
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
    } catch (error) {
      Logger.error("Failed to connect to peer:", error);
      throw error;
    }
  }
}
