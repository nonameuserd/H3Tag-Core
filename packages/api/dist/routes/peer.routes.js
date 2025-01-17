"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const peer_controller_1 = require("../controllers/peer.controller");
const peer_service_1 = require("../services/peer.service");
const shared_1 = require("@h3tag-blockchain/shared");
const core_1 = require("@h3tag-blockchain/core");
const router = (0, express_1.Router)();
const peerService = new peer_service_1.PeerService(new shared_1.ConfigService(), new core_1.BlockchainSchema());
const controller = new peer_controller_1.PeerController(peerService);
/**
 * @swagger
 * /peers:
 *   post:
 *     summary: Add a new peer
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
 *         description: Invalid peer data
 *   get:
 *     summary: Get all peers
 *     tags: [Peers]
 *     responses:
 *       200:
 *         description: List of all peers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PeerResponseDto'
 *
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
 *
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
 *     responses:
 *       200:
 *         description: Ban information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BanInfoDto'
 *       404:
 *         description: Peer not found or not banned
 *
 * /peers/network:
 *   get:
 *     summary: Get network information
 *     tags: [Peers]
 *     responses:
 *       200:
 *         description: Network information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NetworkInfoDto'
 *       500:
 *         description: Internal server error while retrieving network information
 *
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
 *         description: ID of the peer
 *     responses:
 *       200:
 *         description: Detailed peer information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PeerDetailedInfoDto'
 *       404:
 *         description: Peer not found
 */
router.post("/", controller.addPeer);
router.get("/", controller.getPeers);
router.delete("/:peerId", controller.removePeer);
router.post("/:peerId/ban", controller.banPeer);
router.get("/:peerId/info", controller.getPeerInfo);
router.post("/ban", controller.setBan);
router.get("/bans", controller.listBans);
router.delete("/bans", controller.clearBans);
router.get("/ban/:ip", controller.getBanInfo);
router.get("/network", controller.getNetworkInfo);
exports.default = router;
//# sourceMappingURL=peer.routes.js.map