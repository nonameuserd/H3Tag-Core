import { DirectVotingUtil, VoteTally, ForkDepthError } from '../../../../blockchain/consensus/voting/util';
import { BlockchainSchema } from '../../../../database/blockchain-schema';
import { AuditManager } from '../../../../security/audit';
import { Validator } from '../../../../models/validator';
import { Vote, VotingPeriod } from '../../../../models/vote.model';
import { AuditEventType, AuditSeverity } from '../../../../security/audit';

// Mock dependencies
jest.mock('../../../../database/blockchain-schema');
jest.mock('../../../../security/audit');
jest.mock('../../../../monitoring/metrics-collector');
jest.mock('../../../../network/circuit-breaker');
jest.mock('../../../../database/backup-manager');

// Mock QuantumNative
jest.mock('@h3tag-blockchain/crypto', () => ({
  QuantumNative: {
    getInstance: jest.fn().mockReturnValue({
      clearHealthChecks: jest.fn(),
      shutdown: jest.fn(),
      initializeHealthChecks: jest.fn(),
    }),
  },
}));

// Mock DDoS protection with configurable behavior
const mockCheckRequest = jest.fn().mockReturnValue(true);
const mockDispose = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../../security/ddos', () => {
  return {
    DDoSProtection: jest.fn().mockImplementation(() => {
      return {
        checkRequest: mockCheckRequest,
        dispose: mockDispose,
      };
    }),
  };
});

describe('DirectVotingUtil', () => {
  let votingUtil: DirectVotingUtil;
  let mockDb: Partial<BlockchainSchema>;
  let mockAuditManager: Partial<AuditManager>;

  beforeEach(() => {
    mockDb = {
      getCurrentHeight: jest.fn().mockResolvedValue(1000),
      getVotingStartHeight: jest.fn().mockResolvedValue(990),
      getVotingEndHeight: jest.fn().mockResolvedValue(1100),
      verifySignature: jest.fn().mockResolvedValue(true),
      getPath: jest.fn().mockReturnValue('/mock/path'),
    };

    mockAuditManager = {
      logEvent: jest.fn().mockImplementation(() => Promise.resolve('event-id')),
    };

    votingUtil = new DirectVotingUtil(mockDb as BlockchainSchema, mockAuditManager as AuditManager);
    
    // Reset mocks
    mockCheckRequest.mockReturnValue(true);
    mockDispose.mockResolvedValue(undefined);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Clean up any remaining intervals
    jest.resetModules();
  });

  describe('initializeChainVotingPeriod', () => {
    it('should initialize a chain voting period successfully', async () => {
      const currentHeight = 1000;
      const startVotingHeight = 990;
      const endVotingHeight = 1100;
      const forkHeight = 995; // Within acceptable fork depth

      (mockDb.getCurrentHeight as jest.Mock).mockResolvedValue(currentHeight);
      (mockDb.getVotingStartHeight as jest.Mock).mockResolvedValue(startVotingHeight);
      (mockDb.getVotingEndHeight as jest.Mock).mockResolvedValue(endVotingHeight);

      const result = await votingUtil.initializeChainVotingPeriod(
        'oldChain',
        'newChain',
        forkHeight
      );

      expect(result).toMatchObject({
        periodId: expect.any(Number),
        startBlock: currentHeight,
        status: 'active',
        type: 'node_selection',
        chainId: 'newChain',
        competingChains: {
          oldChainId: 'oldChain',
          newChainId: 'newChain',
          commonAncestorHeight: forkHeight,
        },
      });
    });

    it('should throw ForkDepthError when fork depth exceeds maximum', async () => {
      const currentHeight = 1000;
      const forkHeight = 500; // This will exceed MAX_FORK_DEPTH of 100

      (mockDb.getCurrentHeight as jest.Mock).mockResolvedValue(currentHeight);
      (mockDb.getVotingStartHeight as jest.Mock).mockResolvedValue(990);
      (mockDb.getVotingEndHeight as jest.Mock).mockResolvedValue(1100);

      await expect(
        votingUtil.initializeChainVotingPeriod('oldChain', 'newChain', forkHeight)
      ).rejects.toThrow(ForkDepthError);

      // Verify the error was logged with correct metadata
      expect(mockAuditManager.logEvent).toHaveBeenCalledWith(expect.objectContaining({
        type: AuditEventType.SECURITY,
        severity: AuditSeverity.ERROR,
        source: 'node_selection',
        details: expect.objectContaining({
          currentHeight: 1000,
          forkHeight: 500,
          forkDepth: 500,
          maxAllowed: 100
        })
      }));
    });

    it('should throw error when voting heights are undefined', async () => {
      (mockDb.getCurrentHeight as jest.Mock).mockResolvedValue(1000);
      (mockDb.getVotingStartHeight as jest.Mock).mockResolvedValue(null);
      (mockDb.getVotingEndHeight as jest.Mock).mockResolvedValue(null);

      await expect(
        votingUtil.initializeChainVotingPeriod('oldChain', 'newChain', 995)
      ).rejects.toThrow('Voting start/end height undefined');

      // Verify the error was logged with correct metadata
      expect(mockAuditManager.logEvent).toHaveBeenCalledWith(expect.objectContaining({
        type: AuditEventType.SECURITY,
        severity: AuditSeverity.ERROR,
        source: 'node_selection',
        details: expect.objectContaining({
          startVotingHeight: null,
          endVotingHeight: null
        })
      }));
    });
  });

  describe('collectVotes', () => {
    const mockVote1: Vote = {
      voteId: 'vote1',
      periodId: 1,
      blockHash: 'hash1',
      voter: 'validator1',
      voterAddress: 'validator1',
      publicKey: 'pubKey1',
      approve: true,
      timestamp: Date.now(),
      signature: 'sig1',
      chainVoteData: {
        targetChainId: 'chain1',
        forkHeight: 100,
        amount: BigInt(1000),
      },
      balance: BigInt(1000),
      encrypted: false,
      votingPower: '1000',
      height: 1000,
    };

    const mockVote2: Vote = {
      ...mockVote1,
      voteId: 'vote2',
      voter: 'validator2',
      voterAddress: 'validator2',
      approve: false,
      signature: 'sig2',
    };

    const mockPeriod: Partial<VotingPeriod> = {
      status: 'active',
      votes: {
        vote1: mockVote1,
        vote2: mockVote2,
      },
    };

    const mockValidators = [
      { address: 'validator1', isActive: true },
      { address: 'validator2', isActive: true },
    ] as Validator[];

    it('should collect and tally votes successfully', async () => {
      (mockDb.verifySignature as jest.Mock).mockResolvedValue(true);

      const result = await votingUtil.collectVotes(mockPeriod as VotingPeriod, mockValidators);

      expect(result).toMatchObject({
        totalVotes: expect.any(Number),
        uniqueVoters: expect.any(Number),
        participationRate: expect.any(Number),
        timestamp: expect.any(Number),
      });
    });

    it('should throw error for invalid period status', async () => {
      const invalidPeriod = { ...mockPeriod, status: 'invalid' };
      await expect(
        votingUtil.collectVotes(invalidPeriod as VotingPeriod, mockValidators)
      ).rejects.toThrow('Invalid voting period status');
    });

    it('should throw error when no validators provided', async () => {
      await expect(
        votingUtil.collectVotes(mockPeriod as VotingPeriod, [])
      ).rejects.toThrow('No validators provided');
    });
  });

  describe('verifyVote', () => {
    let validVote: Vote;

    beforeEach(() => {
      jest.useFakeTimers();
      
      // Set up validVote for each test
      validVote = {
        voteId: 'vote1',
        periodId: 1,
        blockHash: 'hash1',
        voter: 'validator1',
        voterAddress: 'validator1',
        publicKey: 'pubKey1',
        approve: true,
        timestamp: Date.now(),
        signature: 'validSig',
        chainVoteData: {
          targetChainId: 'chain1',
          forkHeight: 100,
          amount: BigInt(1000),
        },
        balance: BigInt(1000),
        encrypted: false,
        votingPower: '1000',
        height: 1000,
      };
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.clearAllTimers();
    });

    it('should verify vote successfully', async () => {
      const validatorMap = new Map([
        ['validator1', { address: 'validator1', isActive: true } as Validator],
      ]);

      (mockDb.verifySignature as jest.Mock).mockResolvedValue(true);

      const result = await votingUtil.verifyVote(validVote, validatorMap);
      expect(result).toBe(true);
    });

    it('should reject vote with missing signature', async () => {
      const validatorMap = new Map([
        ['validator1', { address: 'validator1', isActive: true } as Validator],
      ]);

      const invalidVote = { ...validVote, signature: '' };
      const result = await votingUtil.verifyVote(invalidVote, validatorMap);
      expect(result).toBe(false);
    });

    it('should reject vote from inactive validator', async () => {
      const inactiveValidatorMap = new Map([
        ['validator1', { address: 'validator1', isActive: false } as Validator],
      ]);

      const result = await votingUtil.verifyVote(validVote, inactiveValidatorMap);
      expect(result).toBe(false);
    });

    it('should handle verification timeout', async () => {
      const validatorMap = new Map([
        ['validator1', { address: 'validator1', isActive: true } as Validator],
      ]);

      // Mock a slow verification
      (mockDb.verifySignature as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      const verificationPromise = votingUtil.verifyVote(validVote, validatorMap);
      
      // Fast-forward past the timeout
      await jest.runAllTimersAsync();
      
      const result = await verificationPromise;
      expect(result).toBe(false);

      // Verify that the timeout was logged
      expect(mockAuditManager.logEvent).toHaveBeenCalledWith(expect.objectContaining({
        type: AuditEventType.SECURITY,
        severity: AuditSeverity.ERROR,
        source: 'node_selection',
        details: expect.objectContaining({
          stack: expect.stringContaining('Verification timeout'),
        }),
      }));
    });
  });

  describe('processVotingResults', () => {
    let originalTimers: typeof jest.useRealTimers;

    beforeAll(() => {
      originalTimers = jest.useRealTimers;
      jest.useFakeTimers();
    });

    afterAll(() => {
      originalTimers();
    });

    const mockTally: VoteTally = {
      approved: BigInt(7),
      rejected: BigInt(3),
      totalVotes: 10,
      uniqueVoters: 10,
      participationRate: 0.7,
      timestamp: Date.now(),
    };

    it('should select new chain when approval ratio meets threshold', async () => {
      const result = await votingUtil.processVotingResults(
        mockTally,
        'oldChain',
        'newChain'
      );
      expect(result).toBe('newChain');
    });

    it('should keep old chain when approval ratio below threshold', async () => {
      const lowApprovalTally = {
        ...mockTally,
        approved: BigInt(2),
        rejected: BigInt(8),
      };

      const result = await votingUtil.processVotingResults(
        lowApprovalTally,
        'oldChain',
        'newChain'
      );
      expect(result).toBe('oldChain');
    });

    it('should handle zero votes case', async () => {
      const zeroVotesTally = {
        ...mockTally,
        approved: BigInt(0),
        rejected: BigInt(0),
        totalVotes: 0,
      };

      const result = await votingUtil.processVotingResults(
        zeroVotesTally,
        'oldChain',
        'newChain'
      );
      expect(result).toBe('oldChain');
    });

    it('should handle invalid tally', async () => {
      await expect(votingUtil.processVotingResults(
        null as unknown as VoteTally,
        'oldChain',
        'newChain'
      )).rejects.toThrow('Cannot read properties of null');

      expect(mockAuditManager.logEvent).toHaveBeenCalledWith(expect.objectContaining({
        type: AuditEventType.SECURITY,
        severity: AuditSeverity.CRITICAL,
        source: 'node_selection',
        details: expect.objectContaining({
          stack: expect.stringContaining('Cannot read properties of null')
        })
      }));
    });
  });

  describe('dispose', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.clearAllTimers();
    });

    it('should handle errors during cleanup', async () => {
      const cleanupError = new Error('Cleanup failed');
      mockDispose.mockRejectedValue(cleanupError);

      await expect(votingUtil.dispose()).rejects.toThrow('Cleanup failed');

      // Verify error was logged
      expect(mockAuditManager.logEvent).toHaveBeenCalledWith(expect.objectContaining({
        type: AuditEventType.SECURITY,
        severity: AuditSeverity.CRITICAL,
        source: 'node_selection',
        details: expect.objectContaining({
          stack: expect.stringContaining('Cleanup failed')
        })
      }));
    });
  });
});
