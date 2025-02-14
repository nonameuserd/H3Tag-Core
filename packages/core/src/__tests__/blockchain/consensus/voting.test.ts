import { DirectVoting } from '../../../blockchain/consensus/voting';
import { BlockchainSchema } from '../../../database/blockchain-schema';
import { IVotingSchema } from '../../../database/voting-schema';
import { AuditManager } from '../../../security/audit';
import { DirectVotingUtil } from '../../../blockchain/consensus/voting/util';
import { Node } from '../../../network/node';
import { BlockchainSync } from '../../../network/sync';
import { Mempool } from '../../../blockchain/mempool';
import { Vote, VotingPeriod } from '../../../models/vote.model';
import { Validator } from '../../../models/validator';
import { SyncState } from '../../../network/sync';
import { ConfigService } from '@h3tag-blockchain/shared';
import { Blockchain } from '../../../blockchain/blockchain';
import { Level } from 'level';
import { Block } from '../../../models/block.model';
import { Peer } from '../../../network/peer';
import { Cache } from '../../../scaling/cache';
import { createHash } from 'crypto';

// Mock dependencies
jest.mock('../../../database/blockchain-schema');
jest.mock('../../../database/voting-schema');
jest.mock('../../../security/audit');
jest.mock('../../../blockchain/consensus/voting/util');
jest.mock('../../../network/node');
jest.mock('../../../network/sync');
jest.mock('../../../blockchain/mempool');
jest.mock('@h3tag-blockchain/shared');
jest.mock('level');

describe('DirectVoting', () => {
  let directVoting: DirectVoting;
  let mockDb: jest.Mocked<BlockchainSchema>;
  let mockVotingDb: jest.Mocked<IVotingSchema>;
  let mockAuditManager: jest.Mocked<AuditManager>;
  let mockVotingUtil: jest.Mocked<DirectVotingUtil>;
  let mockNode: jest.Mocked<Node>;
  let mockSync: jest.Mocked<BlockchainSync>;
  let mockMempool: jest.Mocked<Mempool>;
  let validVote: Vote;
  let mockBlockchain: jest.Mocked<Blockchain>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockLevel: jest.Mocked<Level>;
  let validBlock: Block;

  const mockValidator = {
    id: '1',
    address: '0x123',
    publicKey: 'mock-public-key',
    lastActive: Date.now(),
    reputation: 100,
    votingPower: '100',
    stake: '1000',
    delegations: [],
    rewards: '0',
    slashed: false,
    active: true,
    isActive: true,
    isSuspended: false,
    isAbsent: false,
    uptime: 100,
    missedBlocks: 0,
    totalBlocks: 1000,
    metrics: {
      performance: 100,
      reliability: 100,
      lastUpdated: Date.now()
    },
    validationData: {
      lastValidation: Date.now(),
      validationErrors: []
    }
  } as unknown as Validator;

  const setupMocks = () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize mocks
    mockLevel = new Level('./data/blockchain') as jest.Mocked<Level>;
    
    const mockCache = new Cache<Block>();
    const mockPeers = new Map<string, Peer>();
    
    mockDb = {
      db: mockLevel,
      getCurrentHeight: jest.fn().mockResolvedValue(1000),
      getLastNBlocks: jest.fn().mockResolvedValue([
        { header: { timestamp: 1000 }, hash: 'hash1' } as Block,
        { header: { timestamp: 2000 }, hash: 'hash2' } as Block
      ]),
      getValidators: jest.fn().mockResolvedValue([] as Validator[]),
      getTransactionExecutor: jest.fn().mockImplementation((fn) => fn),
      getPath: jest.fn().mockReturnValue('./data/blockchain'),
      cache: mockCache,
      peers: mockPeers
    } as unknown as jest.Mocked<BlockchainSchema>;

    mockVotingDb = {
      getVotesByPeriod: jest.fn().mockResolvedValue([]),
      getTotalVotes: jest.fn().mockResolvedValue(0),
      getTotalEligibleVoters: jest.fn().mockResolvedValue(100),
      transaction: jest.fn().mockImplementation(async (fn) => fn({ put: jest.fn() })),
      createVotingPeriod: jest.fn(),
      storePeriod: jest.fn(),
      storeVote: jest.fn(),
      close: jest.fn(),
      updateVotingPeriod: jest.fn(),
      getVotesByAddress: jest.fn()
    } as unknown as jest.Mocked<IVotingSchema>;
    
    mockAuditManager = {
      logEvent: jest.fn(),
      logError: jest.fn(),
      logWarning: jest.fn(),
      logInfo: jest.fn(),
      dispose: jest.fn()
    } as unknown as jest.Mocked<AuditManager>;
    
    mockVotingUtil = {
      verifyVote: jest.fn().mockResolvedValue(true),
      dispose: jest.fn().mockResolvedValue(undefined),
      collectVotes: jest.fn().mockResolvedValue({
        approved: BigInt(100),
        rejected: BigInt(50),
        totalVotes: 150,
        uniqueVoters: 100,
        participationRate: 0.75,
        timestamp: Date.now()
      }),
      processVotingResults: jest.fn().mockResolvedValue('chain1'),
      initializeChainVotingPeriod: jest.fn()
    } as unknown as jest.Mocked<DirectVotingUtil>;
    mockBlockchain = {
      initialize: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      dispose: jest.fn(),
      addBlock: jest.fn(),
      validateBlock: jest.fn(),
      getHeight: jest.fn().mockResolvedValue(1000),
      getLatestBlock: jest.fn()
    } as unknown as jest.Mocked<Blockchain>;
    mockConfigService = {
      get: jest.fn(),
      set: jest.fn(),
      load: jest.fn(),
      save: jest.fn()
    } as unknown as jest.Mocked<ConfigService>;
    mockMempool = {
      initialize: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      dispose: jest.fn(),
      addTransaction: jest.fn(),
      removeTransaction: jest.fn(),
      getExpectedValidators: jest.fn().mockResolvedValue([{
        address: '0x123',
        votingPower: '100'
      }]),
      getActiveValidators: jest.fn().mockResolvedValue([{
        address: '0x123',
        votingPower: '100'
      }]),
      handleValidationFailure: jest.fn()
    } as unknown as jest.Mocked<Mempool>;
    mockNode = {
      ...new Node(mockBlockchain, mockDb, mockMempool, mockConfigService, mockAuditManager),
      getPeerCount: jest.fn().mockReturnValue(10),
      getActiveValidators: jest.fn().mockResolvedValue([{
        address: '0x123',
        votingPower: '100'
      }]),
      close: jest.fn()
    } as unknown as jest.Mocked<Node>;
    mockSync = new BlockchainSync(mockBlockchain, mockPeers, { publicKey: 'mock-public-key' }, mockDb, mockMempool) as jest.Mocked<BlockchainSync>;

    // Setup default mock implementations
    mockNode.getPeerCount.mockReturnValue(10);
    mockSync.getState.mockReturnValue(SyncState.SYNCED);

    // Initialize validVote with all required properties
    validVote = {
      voteId: '123',
      periodId: 1,
      blockHash: '0xabc',
      voterAddress: '0x123',
      approve: true,
      timestamp: Date.now(),
      signature: '0xsig',
      publicKey: '0xpub',
      encrypted: false,
      voter: '0x123',
      votingPower: '100',
      chainVoteData: {
        targetChainId: 'chain1',
        forkHeight: 1000,
        amount: BigInt(1000)
      },
      height: 1000,
      balance: BigInt(1000)
    };

    validBlock = {
      hash: '0x123',
      header: {
        votesMerkleRoot: '0xabc',
        timestamp: Date.now()
      },
      votes: [validVote],
      validators: [mockValidator]
    } as unknown as Block;
  };

  beforeEach(() => {
    setupMocks();

    // Initialize DirectVoting instance
    directVoting = new DirectVoting(
      mockDb,
      mockVotingDb,
      mockAuditManager,
      mockVotingUtil,
      mockNode,
      mockSync,
      mockMempool
    );
  });

  afterEach(async () => {
    await directVoting.dispose();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(directVoting.initialize()).resolves.not.toThrow();
      expect(mockDb.getCurrentHeight).toHaveBeenCalled();
    });

    it('should handle initialization failure gracefully', async () => {
      mockDb.getCurrentHeight.mockRejectedValueOnce(new Error('DB Error'));
      mockMempool.initialize.mockRejectedValueOnce(new Error('Mempool Error'));
      await expect(directVoting.initialize()).rejects.toThrow();
    });
  });

  describe('submitVote', () => {
    beforeEach(() => {
      // Set up current period
      ((directVoting as unknown) as { currentPeriod: VotingPeriod }).currentPeriod = {
        periodId: 1,
        status: 'active',
        startTime: Date.now() - 1000,
        endTime: Date.now() + 1000,
        votes: {},
        isAudited: false,
        votesMerkleRoot: '',
        startBlock: 0,
        endBlock: 1000,
        type: 'node_selection',
        createdAt: Date.now()
      } as VotingPeriod;
    });

    it('should submit valid vote successfully', async () => {
      const result = await directVoting.submitVote(validVote);
      expect(result).toBe(true);
      expect(mockVotingDb.storeVote).toHaveBeenCalled();
    });

    it('should reject vote when no active period', async () => {
      ((directVoting as unknown) as { currentPeriod: VotingPeriod | null }).currentPeriod = null;
      await expect(directVoting.submitVote(validVote)).rejects.toThrow();
    });

    it('should reject vote with invalid amount', async () => {
      const invalidVote = { ...validVote, chainVoteData: { amount: BigInt("0") } };
      await expect(directVoting.submitVote(invalidVote as Vote)).rejects.toThrow();
    });
  });

  describe('handleChainFork', () => {
    const oldChainId = 'chain1';
    const newChainId = 'chain2';
    const forkHeight = 1000;
    const validators: Validator[] = [
      { address: '0x1', votingPower: '100' } as Validator
    ];

    beforeEach(() => {
      mockVotingUtil.initializeChainVotingPeriod.mockResolvedValue({} as VotingPeriod);
      mockVotingUtil.collectVotes.mockResolvedValue({
        approved: BigInt(100),
        rejected: BigInt(50),
        totalVotes: 150,
        uniqueVoters: 100,
        participationRate: 0.75,
        timestamp: Date.now()
      });
      mockVotingUtil.processVotingResults.mockResolvedValue(oldChainId);
    });

    it('should handle chain fork successfully', async () => {
      const result = await directVoting.handleChainFork(
        oldChainId,
        newChainId,
        forkHeight,
        validators
      );
      expect(result).toBe(oldChainId);
      expect(mockVotingUtil.initializeChainVotingPeriod).toHaveBeenCalled();
      expect(mockVotingUtil.collectVotes).toHaveBeenCalled();
      expect(mockVotingUtil.processVotingResults).toHaveBeenCalled();
    });

    it('should return old chain when network is not stable', async () => {
      mockNode.getPeerCount.mockReturnValue(1); // Below minimum
      const result = await directVoting.handleChainFork(
        oldChainId,
        newChainId,
        forkHeight,
        validators
      );
      expect(result).toBe(oldChainId);
    });
  });

  describe('validateVotes', () => {
    beforeEach(() => {
      // Mock validators consistently
      const validators = [mockValidator];
      mockMempool.getExpectedValidators.mockResolvedValue(validators);
      mockNode.getActiveValidators.mockResolvedValue(validators);
      mockDb.getValidators.mockResolvedValue(validators);

      // Mock vote verification
      mockVotingUtil.verifyVote.mockResolvedValue(true);
      mockMempool.handleValidationFailure.mockResolvedValue(true);

      // Mock network state
      mockSync.getState.mockReturnValue(SyncState.SYNCED);
      mockNode.getPeerCount.mockReturnValue(10);

      // Set up valid block with matching merkle root
      const timestamp = Date.now();
      validVote = {
        ...validVote,
        timestamp,
        voter: mockValidator.address,
        signature: '0xsig',
        publicKey: mockValidator.publicKey,
        chainVoteData: {
          targetChainId: 'chain1',
          amount: BigInt(1000),
          forkHeight: 1000
        }
      };

      // Create merkle root for the vote
      const voteData = JSON.stringify({
        voteId: validVote.voteId,
        voter: validVote.voter,
        timestamp: validVote.timestamp
      });
      const merkleRoot = createHash('sha256').update(voteData).digest('hex');

      validBlock = {
        hash: '0x123',
        header: {
          votesMerkleRoot: merkleRoot,
          timestamp
        },
        votes: [validVote],
        validators: [mockValidator]
      } as unknown as Block;

      // Set up current period with matching vote
      ((directVoting as unknown) as { currentPeriod: VotingPeriod }).currentPeriod = {
        periodId: 1,
        status: 'active',
        startTime: timestamp - 1000,
        endTime: timestamp + 1000,
        votes: { [validVote.voteId]: validVote },
        isAudited: false,
        votesMerkleRoot: merkleRoot,
        startBlock: 0,
        endBlock: 1000,
        startHeight: 0,
        endHeight: 1000,
        type: 'node_selection',
        createdAt: timestamp
      } as VotingPeriod;

      // Mock getVotingSchedule
      jest.spyOn(directVoting as unknown as { getVotingSchedule: () => Promise<{ currentPeriod: VotingPeriod }> }, 'getVotingSchedule').mockResolvedValue({
        currentPeriod: {
          periodId: 1,
          status: 'active',
          startTime: timestamp - 1000,
          endTime: timestamp + 1000,
          votes: { [validVote.voteId]: validVote },
          isAudited: false,
          votesMerkleRoot: merkleRoot,
          startBlock: 0,
          endBlock: 1000,
          startHeight: 0,
          endHeight: 1000,
          type: 'node_selection',
          createdAt: timestamp
        }
      });

      // Mock createVoteMerkleRoot
      jest.spyOn(directVoting as unknown as { createVoteMerkleRoot: (votes: Vote[]) => Promise<string> }, 'createVoteMerkleRoot').mockResolvedValue(merkleRoot);
    });

    it('should validate block with valid votes', async () => {
      const result = await directVoting.validateVotes(validBlock);
      expect(result).toBe(true);
    });

    it('should reject block with invalid votes structure', async () => {
      const invalidBlock = { ...validBlock, votes: null };
      const result = await directVoting.validateVotes(invalidBlock as unknown as Block);
      expect(result).toBe(false);
    });
  });

  describe('getVotingMetrics', () => {
    beforeEach(() => {
      mockVotingDb.getTotalVotes.mockResolvedValue(50);
      mockVotingDb.getTotalEligibleVoters.mockResolvedValue(100);
    });

    it('should return correct voting metrics', async () => {
      const metrics = await directVoting.getVotingMetrics();
      expect(metrics).toHaveProperty('totalVotes');
      expect(metrics).toHaveProperty('activeVoters');
      expect(metrics).toHaveProperty('participationRate');
    });
  });

  describe('healthCheck', () => {
    beforeEach(() => {
      const timestamp = Date.now();
      const validators = [mockValidator];

      // Mock voting metrics with high participation rate (80%)
      mockVotingDb.getTotalVotes.mockResolvedValue(80);
      mockVotingDb.getTotalEligibleVoters.mockResolvedValue(100);
      mockVotingDb.getVotesByPeriod.mockResolvedValue([validVote]);

      // Mock network state as healthy
      mockSync.getState.mockReturnValue(SyncState.SYNCED);
      mockNode.getPeerCount.mockReturnValue(10);

      // Mock validators consistently
      mockDb.getValidators.mockResolvedValue(validators);
      mockMempool.getExpectedValidators.mockResolvedValue(validators);
      mockNode.getActiveValidators.mockResolvedValue(validators);

      // Mock vote verification
      mockVotingUtil.verifyVote.mockResolvedValue(true);

      // Set up current period as active with recent votes
      ((directVoting as unknown) as { currentPeriod: VotingPeriod }).currentPeriod = {
        periodId: 1,
        status: 'active',
        startTime: timestamp - 1000,
        endTime: timestamp + 1000,
        votes: { [validVote.voteId]: validVote },
        isAudited: false,
        votesMerkleRoot: '',
        startBlock: 0,
        endBlock: 1000,
        startHeight: 0,
        endHeight: 1000,
        type: 'node_selection',
        createdAt: timestamp
      } as VotingPeriod;

      // Mock getVotingSchedule
      jest.spyOn(directVoting as unknown as { getVotingSchedule: () => Promise<{ currentPeriod: VotingPeriod }> }, 'getVotingSchedule').mockResolvedValue({
        currentPeriod: {
          periodId: 1,
          status: 'active',
          startTime: timestamp - 1000,
          endTime: timestamp + 1000,
          votes: { [validVote.voteId]: validVote },
          isAudited: false,
          votesMerkleRoot: '',
          startBlock: 0,
          endBlock: 1000,
          startHeight: 0,
          endHeight: 1000,
          type: 'node_selection',
          createdAt: timestamp
        }
      });

      // Mock getParticipationRate
      jest.spyOn(directVoting as unknown as { getParticipationRate: () => Promise<number> }, 'getParticipationRate').mockResolvedValue(0.8);
    });

    it('should return true when system is healthy', async () => {
      const result = await directVoting.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false when participation is too low', async () => {
      mockVotingDb.getTotalVotes.mockResolvedValue(0);
      mockVotingDb.getTotalEligibleVoters.mockResolvedValue(1000);
      // Mock getParticipationRate to return a low value
      jest.spyOn(directVoting as unknown as { getParticipationRate: () => Promise<number> }, 'getParticipationRate').mockResolvedValue(0.05);
      const result = await directVoting.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('getVotesByAddress', () => {
    const testAddress = '0x123';
    const testVotes = [
      { voteId: '1', voter: testAddress },
      { voteId: '2', voter: testAddress }
    ] as Vote[];

    beforeEach(() => {
      mockVotingDb.getVotesByAddress = jest.fn().mockResolvedValue(testVotes);
    });

    it('should return votes for valid address', async () => {
      const votes = await directVoting.getVotesByAddress(testAddress);
      expect(votes).toEqual(testVotes);
      expect(mockVotingDb.getVotesByAddress).toHaveBeenCalledWith(testAddress);
    });

    it('should throw error for invalid address', async () => {
      await expect(directVoting.getVotesByAddress('')).rejects.toThrow();
    });
  });

  describe('getVotesByAddresses', () => {
    const testAddresses = ['0x123', '0x456'];
    const testVotes: Record<string, Vote[]> = {
      '0x123': [{ voteId: '1' }] as Vote[],
      '0x456': [{ voteId: '2' }] as Vote[]
    };

    beforeEach(() => {
      mockVotingDb.getVotesByAddress = jest.fn().mockImplementation(
        async (address: string) => testVotes[address] || []
      );
    });

    it('should return votes for multiple addresses', async () => {
      const result = await directVoting.getVotesByAddresses(testAddresses);
      expect(result).toHaveProperty('0x123');
      expect(result).toHaveProperty('0x456');
      expect(mockVotingDb.getVotesByAddress).toHaveBeenCalledTimes(2);
    });

    it('should handle invalid addresses array', async () => {
      await expect(directVoting.getVotesByAddresses(null as unknown as string[])).rejects.toThrow();
    });
  });

  describe('dispose', () => {
    it('should cleanup resources properly', async () => {
      await directVoting.dispose();
      expect(mockVotingDb.close).toHaveBeenCalled();
      expect(mockNode.close).toHaveBeenCalled();
    });
  });
});
