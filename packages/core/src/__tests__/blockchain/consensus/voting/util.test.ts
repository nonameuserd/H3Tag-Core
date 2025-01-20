import { DirectVotingUtil } from '../../../../blockchain/consensus/voting/util';
import { BlockchainSchema } from '../../../../database/blockchain-schema';
import { AuditManager } from '../../../../security/audit';
import { Validator } from '../../../../models/validator';
import { Vote, VotingPeriod } from '../../../../models/vote.model';
import { BLOCKCHAIN_CONSTANTS } from '../../../../blockchain/utils/constants';

describe('DirectVotingUtil', () => {
  let votingUtil: DirectVotingUtil;
  let mockDb: jest.Mocked<BlockchainSchema>;
  let mockAuditManager: jest.Mocked<AuditManager>;

  beforeEach(() => { 
    mockDb = {
      getCurrentHeight: jest.fn(),
      getVotingStartHeight: jest.fn(),
      getVotingEndHeight: jest.fn(),
      verifySignature: jest.fn(),
      getPath: jest.fn().mockReturnValue('/test/path') as jest.MockedFunction<() => string>,
    } as unknown as jest.Mocked<BlockchainSchema>;

    mockAuditManager = {
      logEvent: jest.fn(),
    } as unknown as jest.Mocked<AuditManager>;

    votingUtil = new DirectVotingUtil(mockDb, mockAuditManager);
  });

  describe('initializeChainVotingPeriod', () => {
    it('should initialize voting period correctly', async () => {
      const oldChainId = 'old-chain';
      const newChainId = 'new-chain';
      const forkHeight = 100;
      const currentHeight = 105;

      mockDb.getCurrentHeight.mockResolvedValue(currentHeight);
      mockDb.getVotingStartHeight.mockResolvedValue(100);
      mockDb.getVotingEndHeight.mockResolvedValue(200);

      const result = await votingUtil.initializeChainVotingPeriod(
        oldChainId,
        newChainId,
        forkHeight,
      );

      expect(result).toMatchObject({
        chainId: newChainId,
        forkHeight,
        status: 'active',
        type: 'node_selection',
        competingChains: {
          oldChainId,
          newChainId,
          commonAncestorHeight: forkHeight,
        },
      });
    });

    it('should throw error if fork depth exceeds maximum', async () => {
      const oldChainId = 'old-chain';
      const newChainId = 'new-chain';
      const forkHeight = 100;
      const currentHeight =
        forkHeight + BLOCKCHAIN_CONSTANTS.MINING.MAX_FORK_DEPTH + 1;

      mockDb.getCurrentHeight.mockResolvedValue(currentHeight);

      await expect(
        votingUtil.initializeChainVotingPeriod(
          oldChainId,
          newChainId,
          forkHeight,
        ),
      ).rejects.toThrow('Fork depth exceeds maximum allowed');
    });
  });

  describe('collectVotes', () => {
    it('should collect and tally valid votes', async () => {
      const mockPeriod: VotingPeriod = {
        periodId: Date.now(),
        status: 'completed',
        endTime: Date.now() - 1000,
        votes: new Map([
          ['1', { voter: 'voter1', approve: true } as Vote],
          ['2', { voter: 'voter2', approve: false } as Vote],
        ]),
      } as VotingPeriod;

      const mockValidators: Validator[] = [
        { address: 'voter1', isActive: true } as Validator,
        { address: 'voter2', isActive: true } as Validator,
      ];

      mockDb.verifySignature.mockResolvedValue(true);

      const result = await votingUtil.collectVotes(mockPeriod, mockValidators);

      expect(result).toMatchObject({
        approved: BigInt(1),
        rejected: BigInt(1),
        totalVotes: 2,
        uniqueVoters: 2,
      });
    });

    it('should throw error if voting period is still active', async () => {
      const mockPeriod: VotingPeriod = {
        status: 'active',
        endTime: Date.now() + 1000,
        votes: new Map(),
      } as VotingPeriod;

      await expect(votingUtil.collectVotes(mockPeriod, [])).rejects.toThrow(
        'Voting period still active',
      );
    });
  });

  describe('verifyVote', () => {
    it('should verify valid vote', async () => {
      const mockVote: Vote = {
        voter: 'voter1',
        chainVoteData: { targetChainId: 'chain1' },
        signature: 'sig',
        timestamp: Date.now(),
      } as Vote;

      const mockValidators = [
        { address: 'voter1', isActive: true } as Validator,
      ];

      mockDb.verifySignature.mockResolvedValue(true);

      const result = await votingUtil.verifyVote(mockVote, mockValidators);
      expect(result).toBe(true);
    });

    it('should reject invalid vote structure', async () => {
      const mockVote = {} as Vote;
      const result = await votingUtil.verifyVote(mockVote, []);
      expect(result).toBe(false);
    });
  });
});
