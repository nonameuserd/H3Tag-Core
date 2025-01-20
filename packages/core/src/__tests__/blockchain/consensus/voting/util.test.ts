import { DirectVotingUtil } from '../../../../blockchain/consensus/voting/util';
import { BlockchainSchema } from '../../../../database/blockchain-schema';
import { AuditManager } from '../../../../security/audit';
import { Validator } from '../../../../models/validator';
import { Vote, VotingPeriod } from '../../../../models/vote.model';
import { BLOCKCHAIN_CONSTANTS } from '../../../../blockchain/utils/constants';

jest.mock('@h3tag-blockchain/crypto', () => ({
  nativeQuantum: {
    generateDilithiumPair: jest.fn(),
    dilithiumSign: jest.fn(),
    dilithiumVerify: jest.fn(),
  },
}));

describe('DirectVotingUtil', () => {
  let votingUtil: DirectVotingUtil;
  let mockDb: jest.Mocked<BlockchainSchema>;
  let mockAuditManager: jest.Mocked<AuditManager>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Disable real timers
    jest.useFakeTimers();

    mockDb = {
      getCurrentHeight: jest.fn(),
      getVotingStartHeight: jest.fn(),
      getVotingEndHeight: jest.fn(),
      verifySignature: jest.fn(),
      getPath: jest.fn().mockReturnValue('/test/path'),
    } as unknown as jest.Mocked<BlockchainSchema>;

    mockAuditManager = {
      logEvent: jest.fn(),
    } as unknown as jest.Mocked<AuditManager>;

    votingUtil = new DirectVotingUtil(mockDb, mockAuditManager);
  });

  afterEach(async () => {
    // Clean up timers
    jest.clearAllTimers();
    
    // Dispose of the voting util
    await votingUtil.dispose();
    
    // Reset timers
    jest.useRealTimers();
  });

  describe('initializeChainVotingPeriod', () => {
    const MAX_FORK_DEPTH = BLOCKCHAIN_CONSTANTS.MINING.MAX_FORK_DEPTH;
    const CURRENT_HEIGHT = 1000;

    beforeEach(() => {
      mockDb.getCurrentHeight.mockResolvedValue(CURRENT_HEIGHT);
    });

    it('should handle valid fork depth', async () => {
      const validForkHeight = CURRENT_HEIGHT - (MAX_FORK_DEPTH - 1);

      mockDb.getVotingStartHeight.mockResolvedValue(validForkHeight);
      mockDb.getVotingEndHeight.mockResolvedValue(CURRENT_HEIGHT + 100);

      const result = await votingUtil.initializeChainVotingPeriod(
        'old-chain',
        'new-chain',
        validForkHeight,
      );

      expect(result.forkHeight).toBe(validForkHeight);
      expect(result.status).toBe('active');
    });

    it('should reject fork depth exceeding maximum', async () => {
      const invalidForkHeight = CURRENT_HEIGHT - (MAX_FORK_DEPTH + 1);

      await expect(async () => {
        await votingUtil.initializeChainVotingPeriod(
          'old-chain',
          'new-chain',
          invalidForkHeight,
        );
      }).rejects.toThrow(/Fork depth exceeds maximum allowed/);

      try {
        await votingUtil.initializeChainVotingPeriod(
          'old-chain',
          'new-chain',
          invalidForkHeight,
        );
      } catch (error: unknown) {
        expect((error as Error).message).toContain(
          'Fork depth exceeds maximum allowed',
        );
        expect(error).toMatchObject({
          cause: {
            currentHeight: CURRENT_HEIGHT,
            forkHeight: invalidForkHeight,
            forkDepth: CURRENT_HEIGHT - invalidForkHeight,
            maxAllowed: MAX_FORK_DEPTH,
          },
        });
      }
    });
  });

  describe('collectVotes', () => {
    it('should collect and tally valid votes', async () => {
      const mockPeriod: VotingPeriod = {
        periodId: Date.now(),
        status: 'completed',
        endTime: Date.now() - 1000,
        votes: new Map([
          ['1', {
            voter: 'voter1',
            approve: true,
            chainVoteData: { targetChainId: 'chain1' },
            signature: 'sig1',
            timestamp: Date.now()
          } as Vote],
          ['2', {
            voter: 'voter2',
            approve: false,
            chainVoteData: { targetChainId: 'chain1' },
            signature: 'sig2',
            timestamp: Date.now()
          } as Vote],
        ]),
      } as VotingPeriod;

      const mockValidators = [
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
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

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
