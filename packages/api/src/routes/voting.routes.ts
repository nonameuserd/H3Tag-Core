import { Router } from 'express';
import { VotingController } from '../controllers/voting.controller';
import { VotingService } from '../services/voting.service';
import {
  DirectVoting,
  BlockchainSchema,
  AuditManager,
  Node,
  Mempool,
  Blockchain,
  DirectVotingUtil,
  VotingDatabase,
  BlockchainSync,
} from '@h3tag-blockchain/core';
import { ConfigService } from '@h3tag-blockchain/shared';

/**
 * @swagger
 * tags:
 *   name: Voting
 *   description: Blockchain voting system endpoints
 */

const router = Router();
const db = new BlockchainSchema();
const blockchain = new Blockchain();
const configService = new ConfigService();
const votingDb = new VotingDatabase('votingDbPath');
const auditManager = new AuditManager();
const votingUtil = new DirectVotingUtil(db, auditManager);
const mempool = new Mempool(blockchain);
const node = new Node(blockchain, db, mempool, configService, auditManager);
const sync = new BlockchainSync(blockchain, mempool, new Map(), {
  publicKey: '',
}, db);

// Initialize DirectVoting with required dependencies
const directVoting = new DirectVoting(
  db,
  votingDb,
  auditManager,
  votingUtil,
  node,
  sync,
);

const votingService = new VotingService(directVoting);
const votingController = new VotingController(votingService);

/**
 * @swagger
 * /voting/vote:
 *   post:
 *     summary: Submit a new vote
 *     tags: [Voting]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VoteDto'
 *     responses:
 *       201:
 *         description: Vote submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 voteId:
 *                   type: string
 *       400:
 *         description: Invalid vote submission
 */
router.post('/vote', (req, res, next) => {
  votingController.submitVote(req.body)
    .then((result) => res.json(result))
    .catch(next);
});

/**
 * @swagger
 * /voting/metrics:
 *   get:
 *     summary: Get voting metrics
 *     tags: [Voting]
 *     responses:
 *       200:
 *         description: Voting metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VotingMetricsDto'
 *       500:
 *         description: Internal server error
 */
router.get('/metrics', (req, res, next) => {
  votingController.getMetrics()
    .then((result) => res.json(result))
    .catch(next);
});


/**
 * @swagger
 * /voting/period/current:
 *   get:
 *     summary: Get current voting period
 *     tags: [Voting]
 *     responses:
 *       200:
 *         description: Current voting period retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VotingPeriodDto'
 *       500:
 *         description: Internal server error
 */
router.get('/period/current', (req, res, next) => {
  votingController.getCurrentPeriod()
    .then((result) => res.json(result))
    .catch(next);
});

/**
 * @swagger
 * /voting/votes/{address}:
 *   get:
 *     summary: Get votes by address
 *     tags: [Voting]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Blockchain address to get votes for
 *     responses:
 *       200:
 *         description: Votes retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VoteDto'
 *       404:
 *         description: No votes found for address
 */
router.get('/votes/:address', (req, res, next) => {
  votingController.getVotesByAddress(req.params.address)
    .then((result) => res.json(result))
    .catch(next);
});

/**
 * @swagger
 * /voting/participation/{address}:
 *   get:
 *     summary: Check if address has participated in current voting period
 *     tags: [Voting]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Blockchain address to check participation for
 *     responses:
 *       200:
 *         description: Participation status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasParticipated:
 *                   type: boolean
 *       400:
 *         description: Invalid address format
 */
router.get('/participation/:address', async (req, res) => {
  try {
    const hasParticipated = await directVoting.hasParticipated(
      req.params.address,
    );
    res.json({ hasParticipated });
  } catch (error: unknown) {
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * @swagger
 * /voting/schedule:
 *   get:
 *     summary: Get voting schedule information
 *     tags: [Voting]
 *     responses:
 *       200:
 *         description: Voting schedule retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 currentPeriod:
 *                   $ref: '#/components/schemas/VotingPeriodDto'
 *                 nextVotingHeight:
 *                   type: number
 *                 blocksUntilNextVoting:
 *                   type: number
 *       500:
 *         description: Internal server error
 */
router.get('/schedule', async (req, res) => {
  try {
    const schedule = await directVoting.getVotingSchedule();
    res.json(schedule);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
