import { MiningInfoDto } from '../dtos/mining.dto';
import { BlockchainService } from './blockchain.service';
import { AuditManager } from '@h3tag-blockchain/core';
import { BlockTemplateDto } from '../dtos/mining.dto';
import { ProofOfWork } from '@h3tag-blockchain/core';
import { SubmitBlockDto } from '../dtos/mining.dto';
import { Mempool } from '@h3tag-blockchain/core';
import { MerkleTree } from '@h3tag-blockchain/core';
/**
 * @swagger
 * tags:
 *   name: Mining
 *   description: Mining operations and status service
 */
export declare class MiningService {
    private readonly blockchainService;
    private readonly pow;
    private readonly mempool;
    private readonly merkleTree;
    private readonly auditManager;
    constructor(blockchainService: BlockchainService, pow: ProofOfWork, mempool: Mempool, merkleTree: MerkleTree, auditManager: AuditManager);
    /**
     * @swagger
     * /mining/info:
     *   get:
     *     summary: Get mining information
     *     tags: [Mining]
     *     responses:
     *       200:
     *         description: Mining information retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/MiningInfoDto'
     *       500:
     *         description: Failed to retrieve mining information
     */
    getMiningInfo(): Promise<MiningInfoDto>;
    /**
     * @swagger
     * /mining/hashps:
     *   get:
     *     summary: Get network hash per second
     *     tags: [Mining]
     *     responses:
     *       200:
     *         description: Network hash rate retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 hashPS: { type: 'number' }
     */
    getNetworkHashPS(): Promise<number>;
    /**
     * @swagger
     * /mining/template:
     *   post:
     *     summary: Get block template for mining
     *     tags: [Mining]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/BlockTemplateRequestDto'
     *     responses:
     *       200:
     *         description: Block template retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/BlockTemplateDto'
     *       400:
     *         description: Invalid miner address
     *       500:
     *         description: Failed to generate block template
     */
    getBlockTemplate(minerAddress: string): Promise<BlockTemplateDto>;
    /**
     * @private
     * @param {Transaction} tx - The transaction to map to a DTO.
     * @returns {TransactionResponseDto} The mapped transaction DTO.
     */
    private mapTransactionToDto;
    submitBlock(submitBlockDto: SubmitBlockDto): Promise<string>;
}
