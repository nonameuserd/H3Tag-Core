import { BlockchainSchema } from '@h3tag-blockchain/core';
import { ConfigService } from '@h3tag-blockchain/shared';
import { CreatePeerDto, PeerResponseDto, SetBanDto, BanInfoDto, NetworkInfoDto, PeerDetailedInfoDto } from '../dtos/peer.dto';
/**
 * @swagger
 * components:
 *   schemas:
 *     PeerService:
 *       type: object
 *       description: Service for managing peer connections
 */
export declare class PeerService {
    private readonly configService;
    private readonly blockchainSchema;
    private peers;
    private networkStats;
    constructor(configService: ConfigService, blockchainSchema: BlockchainSchema);
    /**
     * @swagger
     * tags:
     *   name: Peers
     *   description: Peer network management endpoints
     */
    /**
     * @swagger
     * /peers:
     *   post:
     *     summary: Add a new peer to the network
     *     tags: [Peers]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreatePeerDto'
     *     responses:
     *       201:
     *         description: Peer added successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PeerResponseDto'
     *       400:
     *         description: Invalid peer address or connection failed
     */
    addPeer(createPeerDto: CreatePeerDto): Promise<PeerResponseDto>;
    /**
     * @swagger
     * /peers:
     *   get:
     *     summary: Get all connected peers
     *     tags: [Peers]
     *     responses:
     *       200:
     *         description: List of connected peers
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/PeerResponseDto'
     */
    getPeers(): Promise<PeerResponseDto[]>;
    /**
     * @swagger
     * /peers/{peerId}:
     *   delete:
     *     summary: Remove a peer from the network
     *     tags: [Peers]
     *     parameters:
     *       - in: path
     *         name: peerId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Peer removed successfully
     *       404:
     *         description: Peer not found
     */
    removePeer(peerId: string): Promise<void>;
    /**
     * Bans a peer from the network
     * @param peerId Peer identifier
     * @returns Updated peer information
     * @throws Error if peer is not found
     */
    banPeer(peerId: string): Promise<PeerResponseDto>;
    /**
     * @swagger
     * /peers/{peerId}/info:
     *   get:
     *     summary: Get detailed information about a specific peer
     *     tags: [Peers]
     *     parameters:
     *       - in: path
     *         name: peerId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Detailed peer information
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PeerResponseDto'
     *       404:
     *         description: Peer not found
     */
    getPeerInfo(peerId: string): Promise<PeerDetailedInfoDto>;
    /**
     * @swagger
     * /peers/stats:
     *   get:
     *     summary: Get network statistics
     *     tags: [Peers]
     *     responses:
     *       200:
     *         description: Network statistics
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 totalPeers:
     *                   type: number
     *                 activePeers:
     *                   type: number
     *                 bannedPeers:
     *                   type: number
     *                 averageLatency:
     *                   type: number
     */
    getNetworkStats(): Promise<{
        totalPeers: number;
        activePeers: number;
        bannedPeers: number;
        averageLatency: number;
    }>;
    /**
     * @swagger
     * /peers/ban:
     *   post:
     *     summary: Set ban status for a peer
     *     tags: [Peers]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/SetBanDto'
     *     responses:
     *       200:
     *         description: Ban status set successfully
     *       404:
     *         description: Peer not found
     *       400:
     *         description: Invalid request parameters
     *
     */
    setBan(setBanDto: SetBanDto): Promise<void>;
    /**
    * @swagger
    * /peers/ban/{ip}:
    *   get:
    *     summary: Get ban information for a specific IP
    *     tags: [Peers]
    *     parameters:
    *       - in: path
    *         name: ip
    *         required: true
    *         schema:
    *           type: string
    *         description: IP address of the peer
    *     responses:
    *       200:
    *         description: Ban information retrieved successfully
    *         content:
    *           application/json:
    *             schema:
    *               $ref: '#/components/schemas/BanInfoDto'
    *       404:
    *         description: Peer not found or not banned
    */
    getBanInfo(ip: string): Promise<BanInfoDto>;
    /**
   * @swagger
   * /peers/ban/{ip}:
    * /peers/bans:
     *   get:
     *     summary: List all banned peers
     *     tags: [Peers]
     *     responses:
     *       200:
     *         description: List of banned peers
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/BanInfoDto'
     *   delete:
     *     summary: Clear all bans
     *     tags: [Peers]
     *     responses:
     *       200:
     *         description: All bans cleared successfully
     *
   */
    listBans(): Promise<BanInfoDto[]>;
    clearBans(): Promise<void>;
    getNetworkInfo(): Promise<NetworkInfoDto>;
}
