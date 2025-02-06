import { Injectable } from '@nestjs/common';
import { Peer, PeerState, BlockchainSchema } from '@h3tag-blockchain/core';
import { ConfigService } from '@h3tag-blockchain/shared';
import {
  CreatePeerDto,
  PeerResponseDto,
  SetBanDto,
  BanInfoDto,
  NetworkInfoDto,
  PeerDetailedInfoDto,
} from '../dtos/peer.dto';
import { Logger } from '@h3tag-blockchain/shared';
import { NetworkStats } from '@h3tag-blockchain/core';
import { PeerServices } from '@h3tag-blockchain/core';

/**
 * @swagger
 * components:
 *   schemas:
 *     PeerService:
 *       type: object
 *       description: Service for managing peer connections
 */
@Injectable()
export class PeerService {
  private peers: Map<string, Peer> = new Map();
  private networkStats: NetworkStats;

  constructor(
    private readonly configService: ConfigService,
    private readonly blockchainSchema: BlockchainSchema,
  ) {
    this.networkStats = new NetworkStats();
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
  async addPeer(createPeerDto: CreatePeerDto): Promise<PeerResponseDto> {
    try {
      const [host, portStr] = createPeerDto.address?.split(':') || [];
      const port = parseInt(portStr, 10);

      if (!host || isNaN(port)) {
        throw new Error('Invalid peer address format');
      }

      // Create new peer instance
      const peer = new Peer(
        host,
        port,
        {
          version: this.configService.get('PEER_VERSION') || 1,
          services: [PeerServices.NODE],
          minPingInterval: 120000,
          connectionTimeout: 10000,
          handshakeTimeout: 30000,
        },
        this.configService,
        this.blockchainSchema,
      );

      // Attempt to connect to the peer
      await peer.connect();

      // Get peer info after successful connection
      const peerInfo = await peer.getInfo();

      // Store peer instance keyed by its unique peer id
      this.peers.set(peer.getId(), peer);

      return {
        peerId: peer.getId(),
        address: createPeerDto.address,
        status: peer.getState(),
        version: peerInfo.version,
        lastSeen: new Date(peerInfo.lastSeen).toISOString(),
        latency: peerInfo.latency,
        height: peerInfo.height,
        // Ensure that peerInfo.services is an array before reducing it
        services: Array.isArray(peerInfo.services)
          ? peerInfo.services.reduce((acc, service) => acc | service, 0)
          : peerInfo.services || 1,
      };
    } catch (error: unknown) {
      Logger.error('Failed to add peer:', error);
      throw new Error(
        `Failed to add peer: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
  async getPeers(): Promise<PeerResponseDto[]> {
    try {
      const peerResponses: PeerResponseDto[] = [];

      for (const peer of this.peers.values()) {
        const peerInfo = await peer.getInfo();

        peerResponses.push({
          peerId: peer.getId(),
          address: `${peer.getAddress()}`,
          status: peer.getState(),
          version: peerInfo.version,
          lastSeen: new Date(peerInfo.lastSeen).toISOString(),
          latency: peerInfo.latency,
          height: peerInfo.height,
          services: peerInfo.services.reduce(
            (acc, service) => acc | service,
            0,
          ),
        });
      }

      return peerResponses;
    } catch (error: unknown) {
      Logger.error('Failed to get peers:', error);
      throw new Error(
        `Failed to get peers: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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
  async removePeer(peerId: string): Promise<void> {
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
    } catch (error: unknown) {
      Logger.error('Failed to remove peer:', error);
      throw new Error(
        `Failed to remove peer: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Bans a peer from the network
   * @param peerId Peer identifier
   * @returns Updated peer information
   * @throws Error if peer is not found
   */
  async banPeer(peerId: string): Promise<PeerResponseDto> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    try {
      // Set maximum ban score to trigger ban
      peer.adjustPeerScore(Number.MAX_SAFE_INTEGER);

      const peerInfo = await peer.getInfo();

      return {
        peerId: peer.getId(),
        address: peer.getAddress(),
        status: PeerState.BANNED,
        version: peerInfo.version,
        lastSeen: new Date(peerInfo.lastSeen).toISOString(),
        latency: peerInfo.latency,
        height: peerInfo.height,
        services: peerInfo.services.reduce((acc, service) => acc | service, 0),
      };
    } catch (error: unknown) {
      Logger.error('Failed to ban peer:', error);
      throw new Error(
        `Failed to ban peer: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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
  async getPeerInfo(peerId: string): Promise<PeerDetailedInfoDto> {
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
      services: Array.isArray(peerInfo.services)
        ? peerInfo.services.reduce((acc, service) => acc | service, 0)
        : peerInfo.services || 1, // 1 represents NODE service
      lastSeen: peerInfo.lastSeen,
      lastSend: peerInfo.lastSend,
      syncedBlocks: peerInfo.syncedBlocks,
      inflight: peerInfo.inflight,
      whitelisted: peerInfo.whitelisted,
      blacklisted: peerInfo.blacklisted,
      capabilities: peerInfo.capabilities,
      userAgent: peerInfo.userAgent,
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
  async getNetworkStats(): Promise<{
    totalPeers: number;
    activePeers: number;
    bannedPeers: number;
    averageLatency: number;
  }> {
    try {
      let totalLatency = 0;
      let activePeers = 0;
      let bannedPeers = 0;

      for (const peer of this.peers.values()) {
        if (peer.getState() === PeerState.BANNED) {
          bannedPeers++;
        } else if (peer.isConnected()) {
          activePeers++;
          totalLatency += (await peer.getInfo()).latency;
        }
      }

      return {
        totalPeers: this.peers.size,
        activePeers,
        bannedPeers,
        averageLatency: activePeers > 0 ? totalLatency / activePeers : 0,
      };
    } catch (error: unknown) {
      Logger.error('Failed to get network stats:', error);
      throw new Error(
        `Failed to get network stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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
  async setBan(setBanDto: SetBanDto): Promise<void> {
    const { ip, command, banTime, reason } = setBanDto;
    // Find the peer by comparing the provided IP with the beginning of the peer's stored address (which is in the form "ip:port")
    const peer = Array.from(this.peers.values()).find(p => p.getAddress().startsWith(ip || ''));
    if (!peer) {
      throw new Error('Peer not found');
    }

    await peer.setBan(command || 'add', banTime, reason);
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
  async getBanInfo(ip: string): Promise<BanInfoDto> {
    // Locate the peer whose address starts with the given IP
    const peer = Array.from(this.peers.values()).find(p => p.getAddress().startsWith(ip));
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
      createdAt: new Date(banInfo.timestamp).toISOString(),
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

  async listBans(): Promise<BanInfoDto[]> {
    const allBans: BanInfoDto[] = [];

    for (const peer of this.peers.values()) {
      const banInfo = await peer.getBanInfo();
      if (banInfo) {
        allBans.push({
          ip: banInfo.address,
          timeRemaining: Math.max(0, banInfo.expiration - Date.now()) / 1000,
          reason: banInfo.reason,
          createdAt: new Date(banInfo.timestamp).toISOString(),
        });
      }
    }

    return allBans;
  }

  async clearBans(): Promise<void> {
    for (const peer of this.peers.values()) {
      await peer.clearBans();
    }
  }

  async getNetworkInfo(): Promise<NetworkInfoDto> {
    try {
      const networkInfo = this.networkStats.getNetworkInfo();

      return {
        version: networkInfo.version,
        protocolVersion: networkInfo.protocolVersion,
        connections: networkInfo.connections.total,
        inbound: networkInfo.connections.inbound,
        outbound: networkInfo.connections.outbound,
        networkActive: networkInfo.connections.total > 0,
        localAddresses: networkInfo.localAddresses,
      };
    } catch (error: unknown) {
      Logger.error('Failed to get network info:', error);
      throw new Error(
        `Failed to get network info: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
