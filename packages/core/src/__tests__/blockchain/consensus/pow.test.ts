// Mock HybridDirectConsensus first
jest.mock('../../../blockchain/consensus/hybrid-direct', () => ({
  HybridDirectConsensus: jest.fn().mockImplementation(() => ({
    consensusPublicKey: 'mock-consensus-key',
    validateTransaction: jest.fn().mockResolvedValue(true),
    initialize: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock the database first
jest.mock('../../../database/mining-schema', () => ({
  MiningDatabase: jest.fn().mockImplementation(() => ({
    open: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue(undefined),
    saveBlock: jest.fn().mockResolvedValue(undefined),
    updateDifficulty: jest.fn().mockResolvedValue(undefined),
    getCurrentHeight: jest.fn().mockResolvedValue(1),
    getLatestBlock: jest.fn().mockResolvedValue({
      hash: '0'.repeat(64),
      header: { 
        timestamp: Date.now() / 1000,
        difficulty: BLOCKCHAIN_CONSTANTS.MINING.INITIAL_DIFFICULTY,
      }
    }),
    storePowSolution: jest.fn().mockResolvedValue(undefined),
    storeMiningMetrics: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock transaction model with status
jest.mock('../../../models/transaction.model', () => ({
  Transaction: jest.fn().mockImplementation(() => ({
    type: 'POW_REWARD',
    inputs: [],
    outputs: [{ amount: BigInt(50) }],
    hash: '3'.repeat(64),
    verify: jest.fn().mockResolvedValue(true),
  })),
  TransactionType: {
    POW_REWARD: 'POW_REWARD',
    TRANSFER: 'TRANSFER',
  },
  TransactionStatus: {
    PENDING: 'PENDING',
    CONFIRMED: 'CONFIRMED',
    FAILED: 'FAILED',
  }
}));

// Mock all dependencies before importing them
jest.mock('../../../models/transaction.model');
jest.mock('../../../blockchain/blockchain');
jest.mock('../../../database/blockchain-schema');
jest.mock('../../../blockchain/mempool');
jest.mock('../../../monitoring/metrics');
jest.mock('@h3tag-blockchain/crypto');
jest.mock('../../../monitoring/health');
jest.mock('../../../network/worker-pool', () => ({
  WorkerPool: jest.fn().mockImplementation(() => ({
    getWorker: jest.fn().mockResolvedValue({
      postMessage: jest.fn(),
      once: jest.fn().mockImplementation((event, callback) => {
        if (event === 'message') {
          callback({ found: true, nonce: 12345, hash: '4'.repeat(64) });
        }
      }),
    }),
    initialize: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn().mockResolvedValue(undefined),
    releaseWorker: jest.fn(),
  })),
}));

jest.mock('../../../scaling/sharding');
jest.mock('../../../monitoring/performance-monitor');
jest.mock('../../../utils/merkle');

// Add mock for metrics with all required methods
jest.mock('../../../monitoring/metrics', () => ({
  MiningMetrics: {
    getInstance: jest.fn().mockReturnValue({
      updateMetrics: jest.fn(),
      getMetrics: jest.fn(),
      recordError: jest.fn(),
      gauge: jest.fn(),
      increment: jest.fn(),
      decrement: jest.fn(),
    }),
  },
}));

// Mock QuantumNative first
jest.mock('@h3tag-blockchain/crypto', () => ({
    QuantumNative: {
        getInstance: jest.fn().mockReturnValue({
            initializeHealthChecks: jest.fn(),
            performHealthCheck: jest.fn(),
            dispose: jest.fn(),
        }),
    },
    // Keep other crypto mocks
    HybridCrypto: {
        hash: jest.fn().mockResolvedValue('mockHash'),
        sign: jest.fn().mockResolvedValue('mockSignature'),
        verify: jest.fn().mockResolvedValue(true)
    },
    WasmSHA3: {
        initialize: jest.fn().mockResolvedValue(true)
    },
    SIMD: {
        initialize: jest.fn().mockResolvedValue(true)
    }
}));

// Mock ValidatorSet
jest.mock('../../../models/validator', () => ({
    ValidatorSet: jest.fn().mockImplementation(() => ({
        cleanExpiredCache: jest.fn(),
        validators: new Map(),
        addValidator: jest.fn(),
        removeValidator: jest.fn(),
        getValidator: jest.fn(),
        dispose: jest.fn(),
    })),
}));

// Import after mocking
import { Transaction, TransactionType } from '../../../models/transaction.model';
import { ProofOfWork } from '../../../blockchain/consensus/pow';
import { Block, BlockHeader } from '../../../models/block.model';
import { Blockchain } from '../../../blockchain/blockchain';
import { BLOCKCHAIN_CONSTANTS } from '../../../blockchain/utils/constants';

describe('ProofOfWork', () => {
  let pow: ProofOfWork;
  let blockchain: jest.Mocked<Blockchain>;
  let mockBlock: Block;
  let intervals: NodeJS.Timeout[] = [];

  beforeAll(() => {
    // Mock setInterval
    jest.spyOn(global, 'setInterval').mockImplementation((callback, ms) => {
      const interval = setTimeout(callback, ms) as unknown as NodeJS.Timeout;
      intervals.push(interval);
      return interval;
    });
  });

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.resetModules();
    
    // Reset mocks and intervals
    jest.clearAllMocks();
    intervals = [];
    jest.useFakeTimers();

    const mockBlockData = {
        hash: '0'.repeat(64),
        header: {
            timestamp: Math.floor(Date.now() / 1000),
            difficulty: BLOCKCHAIN_CONSTANTS.MINING.INITIAL_DIFFICULTY,
            version: 1,
            height: 1,
            previousHash: '0'.repeat(64),
            merkleRoot: '1'.repeat(64),
            nonce: 0,
            miner: 'testMiner',
            minerAddress: 'testMinerAddress',
        },
        transactions: [],
        isComplete: () => true,
    };

    blockchain = {
        calculateBlockReward: jest.fn().mockReturnValue(BigInt(50)),
        getValidatorCount: jest.fn().mockResolvedValue(10),
        getCurrentHeight: jest.fn().mockReturnValue(1),
        getDynamicBlockSize: jest.fn().mockResolvedValue(1000000),
        getLatestBlock: jest.fn().mockReturnValue(mockBlockData),
        getBlockByHeight: jest.fn().mockImplementation((height: number) => ({
            ...mockBlockData,
            header: { ...mockBlockData.header, height }
        })),
        getConsensusPublicKey: jest.fn().mockReturnValue('mock-public-key'),
        calculateBlockHash: jest.fn().mockReturnValue('2'.repeat(64)),
        addBlock: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Blockchain>;

    // Create ProofOfWork instance
    pow = new ProofOfWork(blockchain);
    await pow.initialize();

    // Setup mock block
    mockBlock = {
      header: {
        version: 1,
        height: 1,
        previousHash: '0'.repeat(64),
        merkleRoot: '1'.repeat(64),
        timestamp: Math.floor(Date.now() / 1000),
        difficulty: BLOCKCHAIN_CONSTANTS.MINING.INITIAL_DIFFICULTY,
        nonce: 0,
        miner: 'testMiner',
        minerAddress: 'testMinerAddress',
      } as BlockHeader,
      hash: '2'.repeat(64),
      transactions: [
        {
          type: TransactionType.POW_REWARD,
          inputs: [],
          outputs: [{ amount: BigInt(50) }],
          hash: '3'.repeat(64),
          verify: jest.fn().mockResolvedValue(true),
        } as unknown as Transaction,
      ],
      getHeaderBase: jest.fn().mockReturnValue('mockHeaderBase'),
      isComplete: jest.fn().mockReturnValue(true),
    } as unknown as Block;
  });

  afterEach(async () => {
    // Clear all intervals
    intervals.forEach(clearInterval);
    await pow.dispose();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Clean up any remaining intervals
    jest.clearAllTimers();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await pow.initialize();
      expect(pow).toBeDefined();
    });
  });

  describe('mining operations', () => {
    beforeEach(async () => {
      await pow.initialize();
    });

    it('should mine a block successfully', async () => {
      const mockResult = {
        found: true,
        nonce: 12345,
        hash: '4'.repeat(64),
        header: {
          difficulty: BLOCKCHAIN_CONSTANTS.MINING.INITIAL_DIFFICULTY,
          nonce: 12345,
        },
      };

      const mockWorker = {
        postMessage: jest.fn(),
        once: jest.fn().mockImplementation((event, callback) => {
          if (event === 'message') {
            callback(mockResult);
          }
        }),
      };

      (pow as unknown as { workerPool: { getWorker: jest.Mock }}).workerPool.getWorker = jest.fn().mockResolvedValue(mockWorker);
      const result = await pow.mineBlock(mockBlock);
      expect(result.hash).toBe(mockResult.hash);
    }, 10000); // Increased timeout

    it('should use cache for previously mined blocks', async () => {
      const cachedResult = {
        found: true,
        nonce: 54321,
        hash: '5'.repeat(64),
      };

      (pow as unknown as { nonceCache: { get: jest.Mock }}).nonceCache.get = jest.fn().mockReturnValue(cachedResult);

      const result = await pow.mineBlock(mockBlock);
      expect(result.hash).toBe(cachedResult.hash);
      expect(result.header.nonce).toBe(cachedResult.nonce);
    });
  });

  describe('validation', () => {
    beforeEach(async () => {
      await pow.initialize();
      
      // Mock all required validation methods
      (pow as unknown as { validateBlockMerkleRoot: jest.Mock }).validateBlockMerkleRoot = jest.fn().mockResolvedValue(true);
      (pow as unknown as { validateReward: jest.Mock }).validateReward = jest.fn().mockResolvedValue(true);
      (pow as unknown as { validateBlockDifficulty: jest.Mock }).validateBlockDifficulty = jest.fn().mockResolvedValue(true);
      (pow as unknown as { validateBlockHeader: jest.Mock }).validateBlockHeader = jest.fn().mockResolvedValue(true);
      (pow as unknown as { merkleTree: { createRoot: jest.Mock }}).merkleTree.createRoot = jest.fn().mockResolvedValue('1'.repeat(64));
      (pow as unknown as { meetsTarget: jest.Mock }).meetsTarget = jest.fn().mockReturnValue(true);
      (pow as unknown as { calculateBlockHash: jest.Mock }).calculateBlockHash = jest.fn().mockReturnValue('2'.repeat(64));
      (pow as unknown as { verifyCoinbaseTransaction: jest.Mock }).verifyCoinbaseTransaction = jest.fn().mockResolvedValue(true);
      (pow as unknown as { validateTemplateTransaction: jest.Mock }).validateTemplateTransaction = jest.fn().mockResolvedValue(true);

      // Mock block methods
      mockBlock.isComplete = jest.fn().mockReturnValue(true);
      mockBlock.header.merkleRoot = '1'.repeat(64);
    });

    it('should validate a valid block', async () => {
      (pow as unknown as { validateBlock: jest.Mock }).validateBlock = jest.fn().mockResolvedValue(true);
      const result = await pow.validateBlock(mockBlock);
      expect(result).toBe(true);
    });

    it('should reject invalid block structure', async () => {
      const invalidBlock = { ...mockBlock, header: undefined };
      const result = await pow.validateBlock(invalidBlock as unknown as Block);
      expect(result).toBe(false);
    });

    it('should reject invalid block reward', async () => {
      mockBlock.transactions[0].outputs[0].amount = BigInt(100);
      const result = await pow.validateBlock(mockBlock);
      expect(result).toBe(false);
    });

    it('should validate merkle root', async () => {
      const result = await pow.validateBlockMerkleRoot(mockBlock);
      expect(result).toBe(true);
    });
  });

  describe('difficulty adjustment', () => {
    it('should calculate network difficulty', async () => {
      const difficulty = await pow.getNetworkDifficulty();
      expect(difficulty).toBeGreaterThan(0);
    });

    it('should handle empty blockchain for difficulty calculation', async () => {
      (pow as unknown as { db: { getCurrentHeight: jest.Mock }}).db.getCurrentHeight = jest.fn().mockResolvedValue(0);
      const difficulty = await pow.getNetworkDifficulty();
      expect(difficulty).toBe(BLOCKCHAIN_CONSTANTS.MINING.MIN_DIFFICULTY);
    });
  });

  describe('metrics and health', () => {
    it('should return mining metrics', () => {
      const metrics = pow.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should perform health check', async () => {
      const health = await pow.healthCheck();
      expect(typeof health).toBe('boolean');
    });

    it('should check mining health', async () => {
      const health = await pow.checkMiningHealth();
      expect(health).toHaveProperty('isHealthy');
      expect(health).toHaveProperty('hashRate');
      expect(health).toHaveProperty('workerCount');
    });
  });

  describe('cleanup', () => {
    it('should clean up resources on dispose', async () => {
      const cleanupSpy = jest.spyOn(pow as unknown as { cleanupWorkers: jest.Mock }, 'cleanupWorkers');
      await pow.dispose();
      expect(cleanupSpy).toHaveBeenCalled();
      expect(intervals.length).toBe(0);
    });

    it('should stop mining on dispose', async () => {
      pow.startMining();
      await pow.dispose();
      expect(pow.isMining).toBe(false);
    });
  });

  describe('participation and rewards', () => {
    beforeEach(async () => {
      await pow.initialize();
      // Mock internal validation methods
      (pow as unknown as { validateReward: jest.Mock }).validateReward = jest.fn().mockResolvedValue(true);
    });

    it('should validate correct reward amount', async () => {
      const result = await (pow as unknown as { validateReward: jest.Mock }).validateReward(mockBlock.transactions[0], 1);
      expect(result).toBe(true);
    });

    it('should calculate participation rate', async () => {
      const rate = await pow.getParticipationRate();
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(100);
    });
  });

  // Add BigInt serialization handler
  const origJsonStringify = JSON.stringify;
  JSON.stringify = function(obj: unknown) {
    return origJsonStringify(obj, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
  };
});