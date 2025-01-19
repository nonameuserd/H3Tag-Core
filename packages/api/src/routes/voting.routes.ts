import { Router } from "express";
import { VotingController } from "../controllers/voting.controller";
import { VotingService } from "../services/voting.service";
import {
  DirectVoting,
  BlockchainSchema,
  AuditManager,
} from "@h3tag-blockchain/core";

/**
 * @swagger
 * tags:
 *   name: Voting
 *   description: Blockchain voting system endpoints
 */

const router = Router();
const db = new BlockchainSchema();
const auditManager = new AuditManager();

// Initialize DirectVoting with required dependencies
const directVoting = new DirectVoting(
  db,
  null, // votingDb - needs to be injected
  auditManager,
  null, // votingUtil - needs to be injected
  null, // node - needs to be injected
  null // sync - needs to be injected
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
router.post("/vote", votingController.submitVote);

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
router.get("/metrics", votingController.getMetrics);

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
router.get("/period/current", votingController.getCurrentPeriod);

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
router.get("/votes/:address", votingController.getVotesByAddress);

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
router.get("/participation/:address", async (req, res) => {
  try {
    const hasParticipated = await directVoting.hasParticipated(
      req.params.address
    );
    res.json({ hasParticipated });
  } catch (error) {
    res.status(400).json({ error: error.message });
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
router.get("/schedule", async (req, res) => {
  try {
    const schedule = await directVoting.getVotingSchedule();
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
