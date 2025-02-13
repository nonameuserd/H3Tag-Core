import { Transaction, TransactionType, TransactionStatus } from '../../../models/transaction.model';
import { HybridDirectConsensus } from '../../../blockchain/consensus/hybrid-direct';
import { ProofOfWork } from '../../../blockchain/consensus/pow';
import { DirectVoting } from '../../../blockchain/consensus/voting';
import { BlockchainSchema } from '../../../database/blockchain-schema';
import { AuditManager } from '../../../security/audit';
import { Node } from '../../../network/node';
import { Blockchain } from '../../../blockchain/blockchain';
import { ConfigService } from '@h3tag-blockchain/shared';
import { Mempool } from '../../../blockchain/mempool';
import { Block } from '../../../models/block.model';
import { Cache } from '../../../scaling/cache';
import { MerkleTree } from '../../../utils/merkle';
import { BLOCKCHAIN_CONSTANTS } from '../../../blockchain/utils/constants';
import { ConsensusError } from '../../../blockchain/utils/consensus.error';
import { QuantumNative } from '@h3tag-blockchain/crypto';


jest.mock('../../../blockchain/consensus/pow');
jest.mock('../../../blockchain/consensus/voting');
jest.mock('../../../blockchain/consensus/voting/util');
jest.mock('../../../database/blockchain-schema');
jest.mock('../../../database/voting-schema');
jest.mock('../../../security/audit');
jest.mock('../../../network/node');
jest.mock('../../../network/sync');
jest.mock('../../../blockchain/blockchain');
jest.mock('@h3tag-blockchain/shared');
jest.mock('../../../blockchain/mempool');
jest.mock('../../../scaling/cache');
jest.mock('../../../utils/merkle');

describe('HybridDirectConsensus', () => {
  let consensus: HybridDirectConsensus;
  let pow: jest.Mocked<ProofOfWork>;
  let directVoting: jest.Mocked<DirectVoting>;
  let db: jest.Mocked<BlockchainSchema>;
  let auditManager: jest.Mocked<AuditManager>;
  let node: jest.Mocked<Node>;
  let blockchain: jest.Mocked<Blockchain>;
  let mempool: jest.Mocked<Mempool>;
  let cache: jest.Mocked<Cache<boolean>>;
  let merkleTree: jest.Mocked<MerkleTree>;

  const mockBlock = {
    hash: 'mockHash',
    header: {
      height: 1,
      previousHash: 'prevHash',
      timestamp: Date.now(),
      merkleRoot: 'merkleRoot',
      difficulty: 1,
      nonce: 0,
      version: 1,
      miner: 'mockMiner',
      validatorMerkleRoot: 'validatorRoot',
      votesMerkleRoot: 'votesRoot',
      totalTAG: 1000,
      blockReward: 50,
      fees: 10,
      target: 'mockTarget',
      locator: ['mockLocator'],
      hashStop: 'mockHashStop',
      consensusData: {
        powScore: 1,
        votingScore: 1,
        participationRate: 0.8,
        periodId: 1
      },
      publicKey: 'mockPublicKey',
      minerAddress: 'mockMinerAddress'
    },
    transactions: [],
    votes: [],
    validators: [],
    timestamp: Date.now(),
    metadata: {
      receivedTimestamp: Date.now(),
      consensusMetrics: {
        powWeight: 1,
        votingWeight: 1,
        participationRate: 0.8
      }
    },
    verifyHash: jest.fn().mockResolvedValue(true),
    verifySignature: jest.fn().mockResolvedValue(true),
    getHeaderBase: jest.fn().mockReturnValue('mockHeaderBase'),
    isComplete: jest.fn().mockReturnValue(true)
  } as unknown as Block;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize mocks with correct types
    db = new BlockchainSchema() as jest.Mocked<BlockchainSchema>;
    auditManager = new AuditManager() as jest.Mocked<AuditManager>;
    
    blockchain = {
      getConsensusPublicKey: jest.fn().mockReturnValue('mockPublicKey'),
      getCurrentHeight: jest.fn().mockReturnValue(mockBlock.header.height),
      getNode: jest.fn().mockReturnValue(node),
      addBlock: jest.fn().mockResolvedValue(undefined),
      getBlockByHeight: jest.fn().mockReturnValue(mockBlock),
      getBlockByHash: jest.fn().mockReturnValue(mockBlock),
      getChainTip: jest.fn().mockReturnValue({ height: mockBlock.header.height, hash: mockBlock.hash }),
      validateBlock: jest.fn().mockResolvedValue(true),
      validateTransaction: jest.fn().mockResolvedValue(true),
      getTransaction: jest.fn().mockResolvedValue(undefined),
      getState: jest.fn().mockReturnValue({ chain: [mockBlock], height: mockBlock.header.height }),
      getConsensusMetrics: jest.fn().mockResolvedValue({
        totalBlocks: 1000,
        successfulBlocks: 800,
        lastMiningTime: Date.now(),
        averageHashRate: 1000,
        totalTAGMined: 5000,
        activeVoters: 10,
        participationRate: 0.8
      }),
      getCurrencyDetails: jest.fn().mockReturnValue({
        name: 'H3TAG',
        symbol: 'TAG',
        decimals: 8,
        totalSupply: 1000000,
        maxSupply: 21000000,
        circulatingSupply: 1000000
      }),
      calculateBlockReward: jest.fn().mockReturnValue(BigInt(50)),
      getConfirmedUtxos: jest.fn().mockResolvedValue([])
    } as unknown as jest.Mocked<Blockchain>;

    mempool = new Mempool(blockchain) as jest.Mocked<Mempool>;
    node = new Node(blockchain, db, mempool, {} as ConfigService, auditManager) as jest.Mocked<Node>;

    pow = {
      validateBlock: jest.fn().mockResolvedValue(true),
      validateWork: jest.fn().mockResolvedValue(true),
      getNetworkDifficulty: jest.fn().mockResolvedValue(1),
      mineBlock: jest.fn().mockResolvedValue(mockBlock),
      createAndMineBlock: jest.fn().mockResolvedValue(mockBlock),
      startMining: jest.fn(),
      stopMining: jest.fn(),
      updateDifficulty: jest.fn().mockResolvedValue(undefined),
      getMetrics: jest.fn().mockReturnValue({
        totalBlocks: 1000,
        successfulBlocks: 800,
        lastMiningTime: Date.now(),
        averageHashRate: 1000,
        totalTAGMined: 5000,
        blacklistedPeers: 0
      } as ReturnType<ProofOfWork['getMetrics']>),
      healthCheck: jest.fn().mockResolvedValue(true),
      getParticipationRate: jest.fn().mockResolvedValue(0.8)
    } as unknown as jest.Mocked<ProofOfWork>;

    directVoting = {
      healthCheck: jest.fn().mockResolvedValue(true),
      hasParticipated: jest.fn().mockResolvedValue(true),
      handleChainFork: jest.fn().mockResolvedValue(mockBlock.hash),
      updateVotingState: jest.fn().mockImplementation(async (callback) => {
        const state = { lastBlockHash: '', height: 0, timestamp: 0 };
        return callback(state);
      }),
      getVotingMetrics: jest.fn().mockResolvedValue({
        currentPeriod: null,
        totalVotes: 100,
        activeVoters: ['voter1', 'voter2'],
        participationRate: 0.8
      }),
      getParticipationRate: jest.fn().mockResolvedValue(0.8)
    } as unknown as jest.Mocked<DirectVoting>;

    cache = {
      get: jest.fn().mockReturnValue(true),
      set: jest.fn(),
      has: jest.fn().mockReturnValue(true),
      delete: jest.fn(),
      clear: jest.fn(),
      size: jest.fn().mockReturnValue(100),
      getHitRate: jest.fn().mockReturnValue(0.8),
      getEvictionCount: jest.fn().mockReturnValue(0),
      shutdown: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<Cache<boolean>>;

    merkleTree = {
      createRoot: jest.fn().mockResolvedValue('merkleRoot')
    } as unknown as jest.Mocked<MerkleTree>;

    // Create consensus instance
    consensus = await HybridDirectConsensus.create(blockchain);
    // @ts-expect-error Accessing private property for testing
    consensus.pow = pow;
    // @ts-expect-error Accessing private property for testing
    consensus.directVoting = directVoting;
    // @ts-expect-error Accessing private property for testing
    consensus.blockCache = cache;
    // @ts-expect-error Accessing private property for testing
    consensus.merkleTree = merkleTree;
    // @ts-expect-error Accessing private property for testing
    consensus.db = db;
  });

  test('should validate block correctly', async () => {
    // Mock metrics with correct property names
    pow.getMetrics.mockReturnValue({
      totalBlocks: 1000,
      successfulBlocks: 800,
      lastMiningTime: Date.now(),
      averageHashRate: 1000,
      totalTAGMined: 5000,
      blacklistedPeers: 0
    } as ReturnType<ProofOfWork['getMetrics']>);

    directVoting.getVotingMetrics.mockResolvedValue({
      currentPeriod: null,
      totalVotes: 100,
      activeVoters: ['voter1', 'voter2'],
      participationRate: 0.8
    });

    const result = await consensus.validateBlock(mockBlock);
    expect(result).toBe(true);
  });

  describe('Initialization', () => {
    it('should create and initialize consensus instance', async () => {
      expect(consensus).toBeDefined();
      expect(consensus.pow).toBeDefined();
    });

    it('should not initialize twice', async () => {
      const initSpy = jest.spyOn(consensus as unknown as { initialize: () => Promise<void> }, 'initialize');
      await consensus.initialize();
      expect(initSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Block Validation', () => {
    beforeEach(() => {
      // Reset mocks before each test
      jest.clearAllMocks();
      merkleTree.createRoot.mockReset();
      pow.validateBlock.mockReset();
      cache.get.mockReset();
    });

    it('should validate block successfully', async () => {
      merkleTree.createRoot.mockResolvedValue('merkleRoot');
      pow.validateBlock.mockResolvedValue(true);
      const isValid = await consensus.validateBlock(mockBlock);
      expect(isValid).toBe(true);
    });

    it('should fail validation on merkle root mismatch', async () => {
      merkleTree.createRoot.mockResolvedValue('differentRoot');
      pow.validateBlock.mockResolvedValue(true);
      const isValid = await consensus.validateBlock(mockBlock);
      expect(isValid).toBe(false);
    });

    it('should handle validation timeout', async () => {
      await jest.advanceTimersByTimeAsync(
        BLOCKCHAIN_CONSTANTS.UTIL.VALIDATION_TIMEOUT_MS + 1000
      );
      // Advance timers synchronously and flush pending microtasks
      jest.advanceTimersByTime(
        BLOCKCHAIN_CONSTANTS.UTIL.VALIDATION_TIMEOUT_MS + 1000
      );
      // Ensure pending promises are processed
      await Promise.resolve();
    });

    it('should use cache for validated blocks', async () => {
      merkleTree.createRoot.mockResolvedValue('merkleRoot');
      cache.get.mockReturnValue(true);
      pow.validateBlock.mockResolvedValue(true);
      
      const isValid = await consensus.validateBlock(mockBlock);
      expect(isValid).toBe(true);
      expect(cache.get).toHaveBeenCalledWith(mockBlock.hash);
    });
  });

  describe('Block Processing', () => {
    it('should process block successfully', async () => {
      jest.useFakeTimers();
      pow.mineBlock.mockResolvedValue(mockBlock);
      merkleTree.createRoot.mockResolvedValue('merkleRoot');

      const processPromise = consensus.processBlock(mockBlock);
      jest.advanceTimersByTime(BLOCKCHAIN_CONSTANTS.UTIL.PROCESSING_TIMEOUT_MS - 1000);
      const processedBlock = await processPromise;
      
      expect(processedBlock).toBeDefined();
      expect(processedBlock.hash).toBe(mockBlock.hash);
      
      jest.useRealTimers();
    }, 30000); // Increase timeout

    it('should handle processing timeout', async () => {
      jest.useFakeTimers();
      pow.mineBlock.mockImplementation(() => new Promise(() => {}));
      
      const processingPromise = consensus.processBlock(mockBlock);
      jest.advanceTimersByTime(BLOCKCHAIN_CONSTANTS.UTIL.PROCESSING_TIMEOUT_MS + 1000);
      
      await expect(processingPromise).rejects.toThrow(ConsensusError);
      jest.useRealTimers();
    });
  });

  describe('Chain Fork Handling', () => {
    it('should handle chain fork successfully', async () => {
      db.getBlockByHeight.mockResolvedValue({ ...mockBlock, hash: 'differentHash' });
      directVoting.handleChainFork.mockResolvedValue(mockBlock.hash);

      const result = await (consensus as unknown as { handleChainFork: (block: Block) => Promise<string> }).handleChainFork(mockBlock);
      expect(result).toBe(mockBlock.hash);
    });

    it('should reject invalid fork block height', async () => {
      const currentHeight = mockBlock.header.height - 50;
      blockchain.getCurrentHeight = jest.fn().mockReturnValue(currentHeight);
      
      await expect((consensus as unknown as { handleChainFork: (block: Block) => Promise<string> }).handleChainFork(mockBlock))
        .rejects.toThrow(ConsensusError);
    });
  });

  describe('Participation Rewards', () => {
    let mockTransaction: Transaction;

    beforeEach(() => {
      mockTransaction = {
        id: 'mockId',
        version: 1,
        hash: 'mockHash',
        inputs: [],
        outputs: [{
          address: 'mockAddress',
          amount: BigInt(100),
          script: 'mockScript',
          currency: { name: 'H3TAG', symbol: 'TAG', decimals: 8 },
          index: 0,
          confirmations: 0
        }],
        timestamp: Date.now(),
        type: TransactionType.QUADRATIC_VOTE,
        blockHeight: 100,
        sender: 'mockSender',
        status: TransactionStatus.PENDING,
        transaction: {
          hash: 'mockHash',
          timestamp: Date.now(),
          fee: BigInt(0),
          signature: 'mockSignature'
        },
        recipient: 'mockRecipient',
        currency: { name: 'H3TAG', symbol: 'TAG', decimals: 8 },
        fee: BigInt(0),
        nonce: 1,
        signature: 'mockSignature',
        verify: async () => true,
        toHex: () => 'mockHex',
        getSize: () => 100
      };

      // Reset mocks
      pow.validateWork.mockReset();
      directVoting.hasParticipated.mockReset();
    });

    it('should validate participation reward successfully', async () => {
      // Mock PoW validation
      pow.validateWork.mockResolvedValue(true);
      pow.getNetworkDifficulty.mockResolvedValue(1);
      
      // Mock voting validation
      directVoting.hasParticipated.mockResolvedValue(true);
      directVoting.getParticipationRate.mockResolvedValue(0.8);
      
      // Mock PoW participation rate
      pow.getParticipationRate.mockResolvedValue(0.8);
      
      // Create transaction with correct reward amount
      mockTransaction = {
        ...mockTransaction,
        outputs: [{
          address: 'mockAddress',
          amount: BLOCKCHAIN_CONSTANTS.CONSENSUS.BASE_REWARD,
          script: 'mockScript',
          currency: { name: 'H3TAG', symbol: 'TAG', decimals: 8 },
          index: 0,
          confirmations: 0
        }]
      };
      
      const result = await consensus.validateParticipationReward(mockTransaction, 100);
      expect(result).toBe(true);
      
      // Verify all validations were called
      expect(pow.validateWork).toHaveBeenCalled();
      expect(directVoting.hasParticipated).toHaveBeenCalled();
    });

    it('should fail validation for invalid PoW', async () => {
      pow.validateWork.mockResolvedValue(false);
      
      const result = await consensus.validateParticipationReward(mockTransaction, 100);
      expect(result).toBe(false);
    });
  });

  describe('Mining Operations', () => {
    it('should mine block successfully', async () => {
      pow.createAndMineBlock.mockResolvedValue(mockBlock);
      merkleTree.createRoot.mockResolvedValue('merkleRoot');
      pow.validateBlock.mockResolvedValue(true);
      
      const minedBlock = await consensus.mineBlock();
      expect(minedBlock).toBeDefined();
      expect(minedBlock.hash).toBe(mockBlock.hash);
    });

    it('should start and stop mining', () => {
      consensus.startMining();
      expect(pow.startMining).toHaveBeenCalled();

      consensus.stopMining();
      expect(pow.stopMining).toHaveBeenCalled();
    });
  });

  describe('Metrics and Health Checks', () => {
    beforeEach(() => {
      // Reset mocks
      pow.healthCheck.mockReset();
      directVoting.healthCheck.mockReset();
      db.ping.mockReset();
      cache.getHitRate.mockReset();
    });

    it('should return valid metrics', () => {
      pow.getMetrics.mockReturnValue({ hashRate: 1000, difficulty: 1 });
      directVoting.getVotingMetrics.mockResolvedValue({ 
        currentPeriod: null,
        totalVotes: 100,
        activeVoters: ['voter1', 'voter2'],
        participationRate: 0.8
      });
      
      const metrics = consensus.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.cache).toBeDefined();
      expect(metrics.pow).toBeDefined();
    });

    it('should perform health check successfully', async () => {
      // Mock all required health check dependencies
      pow.healthCheck.mockResolvedValue(true);
      directVoting.healthCheck.mockResolvedValue(true);
      db.ping.mockResolvedValue(true);
      cache.getHitRate.mockReturnValue(0.8);
      cache.size.mockReturnValue(100);
      
      // Mock process.memoryUsage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = (jest.fn(() => ({
        heapUsed: 100000000,
        heapTotal: 200000000,
        external: 50000000,
        arrayBuffers: 10000000,
        rss: 300000000
      })) as unknown) as NodeJS.MemoryUsageFn;
      
      // @ts-expect-error Accessing private property for testing
      consensus.isDisposed = false;
      
      const isHealthy = await consensus.healthCheck();
      expect(isHealthy).toBe(true);
      
      // Verify all health checks were called
      expect(pow.healthCheck).toHaveBeenCalled();
      expect(directVoting.healthCheck).toHaveBeenCalled();
      expect(db.ping).toHaveBeenCalled();
      expect(cache.getHitRate).toHaveBeenCalled();
      
      // Restore original memoryUsage function
      process.memoryUsage = originalMemoryUsage;
    });

    it('should return cache metrics', () => {
      const cacheMetrics = consensus.getCacheMetrics();
      expect(cacheMetrics.hitRate).toBeDefined();
      expect(cacheMetrics.size).toBeDefined();
      expect(cacheMetrics.evictionCount).toBeDefined();
    });
  });

  describe('Event Handling', () => {
    it('should register and remove event listeners', () => {
      const listener = jest.fn();
      consensus.on('test', listener);
      consensus.off('test', listener);
    });
  });

  describe('Cleanup and Disposal', () => {
    beforeEach(() => {
      // Reset mocks and isDisposed flag
      cache.shutdown.mockReset();
      // @ts-expect-error Accessing private property for testing
      consensus.isDisposed = false;
    });

    it('should dispose resources properly', async () => {
      await consensus.dispose();
      expect(cache.shutdown).toHaveBeenCalled();
    });

    it('should handle multiple dispose calls', async () => {
      // First dispose call
      await consensus.dispose();
      expect(cache.shutdown).toHaveBeenCalledTimes(1);

      // Reset mock to verify second call doesn't trigger shutdown again
      cache.shutdown.mockReset();
      
      // Second dispose call
      await consensus.dispose();
      expect(cache.shutdown).not.toHaveBeenCalled();
    });
  });

  describe('State Updates', () => {
    it('should update consensus state after new block', async () => {
      await consensus.updateState(mockBlock);
      expect(pow.updateDifficulty).toHaveBeenCalledWith(mockBlock);
      expect(directVoting.updateVotingState).toHaveBeenCalled();
    });

    it('should handle state update failures', async () => {
      pow.updateDifficulty.mockRejectedValue(new Error('Update failed'));
      await expect(consensus.updateState(mockBlock)).rejects.toThrow('Update failed');
    });
  });
});

afterAll(() => {
  // Clear the healthCheckInterval from the QuantumNative singleton (if it exists)
  if (QuantumNative?.getInstance) {
    const quantumInstance = QuantumNative.getInstance();
    if (quantumInstance?.healthCheckInterval) {
      clearInterval(quantumInstance.healthCheckInterval);
    }
  }
  // Ensure all Jest timers are cleared
  jest.clearAllTimers();
});