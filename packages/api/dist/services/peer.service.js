"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeerService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@h3tag-blockchain/core");
const shared_1 = require("@h3tag-blockchain/shared");
const core_2 = require("@h3tag-blockchain/core");
/**
 * @swagger
 * components:
 *   schemas:
 *     PeerService:
 *       type: object
 *       description: Service for managing peer connections
 */
let PeerService = class PeerService {
    constructor(configService, blockchainSchema) {
        this.configService = configService;
        this.blockchainSchema = blockchainSchema;
        this.peers = new Map();
        this.networkStats = new core_2.NetworkStats();
    }
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
    async addPeer(createPeerDto) {
        try {
            const [host, portStr] = createPeerDto.address.split(':');
            const port = parseInt(portStr, 10);
            if (!host || isNaN(port)) {
                throw new Error('Invalid peer address format');
            }
            // Create new peer instance
            const peer = new core_1.Peer(host, port, {
                version: this.configService.get('PEER_VERSION') || 1,
                services: 1, // NODE_NETWORK
                minPingInterval: 120000,
                connectionTimeout: 10000,
                handshakeTimeout: 30000
            }, this.configService, this.blockchainSchema);
            // Attempt to connect to the peer
            await peer.connect();
            // Get peer info after successful connection
            const peerInfo = peer.getInfo();
            // Store peer instance
            this.peers.set(peer.getId(), peer);
            return {
                peerId: peer.getId(),
                address: createPeerDto.address,
                status: peer.getState(),
                version: peerInfo.version,
                lastSeen: new Date(peerInfo.lastSeen).toISOString(),
                latency: peerInfo.latency,
                height: peerInfo.height,
                services: peerInfo.services
            };
        }
        catch (error) {
            shared_1.Logger.error('Failed to add peer:', error);
            throw new Error(`Failed to add peer: ${error.message}`);
        }
    }
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
    async getPeers() {
        try {
            const peerResponses = [];
            for (const peer of this.peers.values()) {
                const peerInfo = peer.getInfo();
                peerResponses.push({
                    peerId: peer.getId(),
                    address: `${peer.getAddress()}`,
                    status: peer.getState(),
                    version: peerInfo.version,
                    lastSeen: new Date(peerInfo.lastSeen).toISOString(),
                    latency: peerInfo.latency,
                    height: peerInfo.height,
                    services: peerInfo.services
                });
            }
            return peerResponses;
        }
        catch (error) {
            shared_1.Logger.error('Failed to get peers:', error);
            throw new Error(`Failed to get peers: ${error.message}`);
        }
    }
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
    async removePeer(peerId) {
        const peer = this.peers.get(peerId);
        if (!peer) {
            throw new Error('Peer not found');
        }
        try {
            // Disconnect the peer
            peer.disconnect(1000, 'Peer removed by admin');
            // Remove from peers map
            this.peers.delete(peerId);
            // Clean up peer data from database
            await this.blockchainSchema.db.del(`peer:${peerId}:height`);
            await this.blockchainSchema.db.del(`peer:${peerId}:minedBlocks`);
        }
        catch (error) {
            shared_1.Logger.error('Failed to remove peer:', error);
            throw new Error(`Failed to remove peer: ${error.message}`);
        }
    }
    /**
     * Bans a peer from the network
     * @param peerId Peer identifier
     * @returns Updated peer information
     * @throws Error if peer is not found
     */
    async banPeer(peerId) {
        const peer = this.peers.get(peerId);
        if (!peer) {
            throw new Error('Peer not found');
        }
        try {
            // Set maximum ban score to trigger ban
            peer.adjustPeerScore(Number.MAX_SAFE_INTEGER);
            const peerInfo = peer.getInfo();
            return {
                peerId: peer.getId(),
                address: peer.getAddress(),
                status: core_1.PeerState.BANNED,
                version: peerInfo.version,
                lastSeen: new Date(peerInfo.lastSeen).toISOString(),
                latency: peerInfo.latency,
                height: peerInfo.height,
                services: peerInfo.services
            };
        }
        catch (error) {
            shared_1.Logger.error('Failed to ban peer:', error);
            throw new Error(`Failed to ban peer: ${error.message}`);
        }
    }
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
    async getPeerInfo(peerId) {
        const peer = this.peers.get(peerId);
        if (!peer) {
            throw new Error(`Peer ${peerId} not found`);
        }
        const peerInfo = peer.getPeerInfo();
        return {
            id: peerInfo.id,
            address: peerInfo.address,
            port: peerInfo.port,
            version: peerInfo.version,
            state: peerInfo.state,
            services: peerInfo.services,
            lastSeen: peerInfo.lastSeen,
            lastSend: peerInfo.lastSend,
            syncedBlocks: peerInfo.syncedBlocks,
            inflight: peerInfo.inflight,
            whitelisted: peerInfo.whitelisted,
            blacklisted: peerInfo.blacklisted,
            capabilities: peerInfo.capabilities,
            userAgent: peerInfo.userAgent
        };
    }
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
    async getNetworkStats() {
        try {
            let totalLatency = 0;
            let activePeers = 0;
            let bannedPeers = 0;
            for (const peer of this.peers.values()) {
                if (peer.getState() === core_1.PeerState.BANNED) {
                    bannedPeers++;
                }
                else if (peer.isConnected()) {
                    activePeers++;
                    totalLatency += peer.getInfo().latency;
                }
            }
            return {
                totalPeers: this.peers.size,
                activePeers,
                bannedPeers,
                averageLatency: activePeers > 0 ? totalLatency / activePeers : 0
            };
        }
        catch (error) {
            shared_1.Logger.error('Failed to get network stats:', error);
            throw new Error(`Failed to get network stats: ${error.message}`);
        }
    }
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
    async setBan(setBanDto) {
        const { ip, command, banTime, reason } = setBanDto;
        const peer = this.peers.get(ip);
        if (!peer) {
            throw new Error('Peer not found');
        }
        await peer.setBan(command, banTime, reason);
    }
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
    async getBanInfo(ip) {
        const peer = this.peers.get(ip);
        if (!peer) {
            throw new Error('Peer not found');
        }
        const banInfo = await peer.getBanInfo();
        if (!banInfo) {
            throw new Error('Ban information not found');
        }
        return {
            ip: banInfo.address,
            timeRemaining: Math.max(0, banInfo.expiration - Date.now()) / 1000, // Convert to seconds
            reason: banInfo.reason,
            createdAt: new Date(banInfo.timestamp).toISOString()
        };
    }
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
    async listBans() {
        const allBans = [];
        for (const peer of this.peers.values()) {
            const banInfo = await peer.getBanInfo();
            if (banInfo) {
                allBans.push({
                    ip: banInfo.address,
                    timeRemaining: Math.max(0, banInfo.expiration - Date.now()) / 1000,
                    reason: banInfo.reason,
                    createdAt: new Date(banInfo.timestamp).toISOString()
                });
            }
        }
        return allBans;
    }
    async clearBans() {
        for (const peer of this.peers.values()) {
            await peer.clearBans();
        }
    }
    async getNetworkInfo() {
        try {
            const networkInfo = this.networkStats.getNetworkInfo();
            return {
                version: networkInfo.version,
                protocolVersion: networkInfo.protocolVersion,
                connections: networkInfo.connections.total,
                inbound: networkInfo.connections.inbound,
                outbound: networkInfo.connections.outbound,
                networkActive: networkInfo.connections.total > 0,
                localAddresses: networkInfo.localAddresses
            };
        }
        catch (error) {
            shared_1.Logger.error('Failed to get network info:', error);
            throw new Error(`Failed to get network info: ${error.message}`);
        }
    }
};
exports.PeerService = PeerService;
exports.PeerService = PeerService = __decorate([
    (0, common_1.Injectable)()
], PeerService);
//# sourceMappingURL=peer.service.js.map