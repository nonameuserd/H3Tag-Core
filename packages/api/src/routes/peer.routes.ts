import { Router } from 'express';
import { PeerController } from '../controllers/peer.controller';
import { PeerService } from '../services/peer.service';
import { ConfigService } from '@h3tag-blockchain/shared';
import { BlockchainSchema } from '@h3tag-blockchain/core';

const router = Router();
const peerService = new PeerService(
  new ConfigService(),
  new BlockchainSchema(),
);
const controller = new PeerController(peerService);

/**
 * Routes for adding, retrieving, removing, banning peers, listing bans, and returning network info.
 */
router.post('/', (req, res, next) => {
  controller.addPeer(req.body)
    .then((result) => res.json(result))
    .catch(next);
});

router.get('/', (req, res, next) => {
  controller.getPeers()
    .then((result) => res.json(result))
    .catch(next);
});

// Remove a peer (now returns a success message)
router.delete('/:peerId', (req, res, next) => {
  controller.removePeer(req.params.peerId)
    .then((result) => res.json(result))
    .catch(next);
});

// Ban a peer by peerId (which uses the correct key)
router.post('/:peerId/ban', (req, res, next) => {
  controller.banPeer(req.params.peerId)
    .then((result) => res.json(result))
    .catch(next);
});

router.get('/:peerId/info', (req, res, next) => {
  controller.getPeerInfo(req.params.peerId)
    .then((result) => res.json(result))
    .catch(next);
});

// Set ban status using ban DTO – returns a success message instead of void
router.post('/ban', (req, res, next) => {
  controller.setBan(req.body)
    .then((result) => res.json(result))
    .catch(next);
});

router.get('/bans', (req, res, next) => {
  controller.listBans()
    .then((result) => res.json(result))
    .catch(next);
});

// Clear all bans (returns a success message)
router.delete('/bans', (req, res, next) => {
  controller.clearBans()
    .then((result) => res.json(result))
    .catch(next);
});

// Get ban information for a specific IP (lookup adjusted in the service)
router.get('/ban/:ip', (req, res, next) => {
  controller.getBanInfo(req.params.ip)
    .then((result) => res.json(result))
    .catch(next);
});

router.get('/network', (req, res, next) => {
  controller.getNetworkInfo()
    .then((result) => res.json(result))
    .catch(next);
});

export default router;
