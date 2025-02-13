import { Block } from '../../models/block.model';
import { BlockchainStats, IBlockchainData } from '../../blockchain/blockchain-stats';
import { Transaction } from '../../models/transaction.model';
import { BLOCKCHAIN_CONSTANTS } from '../../blockchain/utils/constants';
import * as fs from 'fs/promises';

// Mock MetricsCollector
const mockCleanup = jest.fn();
const mockGauge = {
  inc: jest.fn(),
  dec: jest.fn(),
  set: jest.fn(),
};

const mockCounter = {
  inc: jest.fn(),
};

const mockHistogram = {
  observe: jest.fn(),
};

const mockMetricsCollector = {
  gauge: jest.fn().mockReturnValue(mockGauge),
  counter: jest.fn().mockReturnValue(mockCounter),
  histogram: jest.fn().mockReturnValue(mockHistogram),
  cleanup: mockCleanup,
};

jest.mock('../../monitoring/metrics-collector', () => ({
  MetricsCollector: jest.fn().mockImplementation(() => mockMetricsCollector),
}));

// Mock Logger
jest.mock('@h3tag-blockchain/shared', () => ({
  Logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
  BlockchainStatsError: jest.fn().mockImplementation((message) => ({
    message,
    name: 'BlockchainStatsError',
  })),
}));

// Mock fs/promises and path for circuit breaker state persistence
jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  readFile: jest.fn(),
  mkdir: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn().mockReturnValue('mock/path'),
  dirname: jest.fn().mockReturnValue('mock/dir'),
  basename: jest.fn().mockReturnValue('mock-file'),
}));

interface MockBlockchainData extends IBlockchainData {
  getHeight(): number;
  getCurrentHeight(): number;
  getLatestBlock(): Block | null;
  getBlockByHeight(height: number): Block | undefined;
  getCurrentDifficulty(): number;
  getState(): { chain: Block[] };
  getConsensusMetrics(): Promise<{
    powHashrate: number;
    activeVoters: number;
    participation: number;
    currentParticipation: number;
  }>;
  getTransaction(hash: string): Promise<Transaction | undefined>;
  getCurrencyDetails(): {
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: number;
    maxSupply: number;
    circulatingSupply: number;
  };
  calculateBlockReward(height: number): bigint;
  getConfirmedUtxos(address: string): Promise<[]>;
}

describe('BlockchainStats', () => {
  let blockchainStats: BlockchainStats;
  let mockBlockchain: jest.Mocked<MockBlockchainData>;
  let mockBlock: Block;
  let mockTransaction: Transaction;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock transaction
    mockTransaction = {
      hash: 'mockTxHash',
      // Add other required transaction properties
    } as Transaction;

    // Create mock block
    mockBlock = {
      hash: 'mockBlockHash',
      header: {
        timestamp: Date.now(),
        previousHash: 'previousHash',
        difficulty: 100000,
      },
      transactions: [mockTransaction],
      metadata: {
        receivedTimestamp: Date.now() + 1000, // 1 second after block timestamp
      },
    } as Block;

    // Create mock blockchain
    mockBlockchain = {
      getHeight: jest.fn().mockReturnValue(100),
      getCurrentHeight: jest.fn().mockReturnValue(100),
      getLatestBlock: jest.fn().mockReturnValue(mockBlock),
      getBlockByHeight: jest.fn().mockReturnValue(mockBlock),
      getCurrentDifficulty: jest.fn().mockReturnValue(100000),
      getState: jest.fn().mockReturnValue({ chain: [mockBlock, mockBlock] }),
      getConsensusMetrics: jest.fn().mockResolvedValue({
        powHashrate: 1000,
        activeVoters: 10,
        participation: 0.8,
        currentParticipation: 0.75,
      }),
      getTransaction: jest.fn().mockResolvedValue(mockTransaction),
      getCurrencyDetails: jest.fn().mockReturnValue({
        name: 'TestCoin',
        symbol: 'TEST',
        decimals: 8,
        totalSupply: 1000000,
        maxSupply: 21000000,
        circulatingSupply: 500000,
      }),
      calculateBlockReward: jest.fn().mockReturnValue(BigInt(50)),
      getConfirmedUtxos: jest.fn().mockResolvedValue([]),
    } as jest.Mocked<MockBlockchainData>;

    // Create BlockchainStats instance
    blockchainStats = new BlockchainStats(mockBlockchain);
  });

  afterEach(() => {
    blockchainStats.cleanup();
  });

  describe('getVotingStats', () => {
    it('should return voting statistics', async () => {
      const stats = await blockchainStats.getVotingStats();
      
      expect(stats).toEqual({
        currentPeriod: expect.any(Number),
        blocksUntilNextVoting: expect.any(Number),
        participationRate: 0.75,
        powWeight: BLOCKCHAIN_CONSTANTS.CONSENSUS.POW_WEIGHT,
        votingWeight: BLOCKCHAIN_CONSTANTS.CONSENSUS.VALIDATOR_WEIGHT,
      });
    });

    it('should throw error when height is insufficient', async () => {
      mockBlockchain.getHeight.mockReturnValue(5);
      
      await expect(blockchainStats.getVotingStats()).rejects.toThrow('Insufficient blockchain height');
    });
  });

  describe('getOrphanRate', () => {
    it('should calculate orphan rate', async () => {
      // Mock blocks with no orphans
      const blocks = Array(BLOCKCHAIN_CONSTANTS.MINING.ORPHAN_WINDOW).fill(mockBlock).map((block, index) => ({
        ...block,
        hash: `hash${index}`,
        header: {
          ...block.header,
          previousHash: index === 0 ? 'genesis' : `hash${index - 1}`,
        },
      }));

      mockBlockchain.getBlockByHeight.mockImplementation((height) => blocks[height % blocks.length]);

      const rate = await blockchainStats.getOrphanRate();
      expect(rate).toBe(0);
      expect(mockBlockchain.getBlockByHeight).toHaveBeenCalled();
    });

    it('should handle invalid height', async () => {
      mockBlockchain.getHeight.mockReturnValue(0);
      mockBlockchain.getBlockByHeight.mockReturnValue(undefined);
      
      const rate = await blockchainStats.getOrphanRate();
      expect(rate).toBe(0);
    });
  });

  describe('getConsensusHealth', () => {
    it('should return consensus health metrics', async () => {
      const health = await blockchainStats.getConsensusHealth();
      
      expect(health).toEqual({
        powHashrate: 1000,
        activeVoters: 10,
        consensusParticipation: 0.8,
        isHealthy: true,
      });
    });

    it('should handle missing metrics', async () => {
      mockBlockchain.getConsensusMetrics.mockResolvedValue({
        powHashrate: 0,
        activeVoters: 0,
        participation: 0,
        currentParticipation: 0,
      });

      const health = await blockchainStats.getConsensusHealth();
      expect(health.isHealthy).toBe(false);
    });
  });

  describe('getAverageBlockTime', () => {
    it('should calculate average block time', async () => {
      const blocks = Array(10).fill(mockBlock);
      mockBlockchain.getBlockByHeight.mockImplementation((height) => blocks[height % blocks.length]);

      const avgTime = await blockchainStats.getAverageBlockTime();
      expect(avgTime).toBeGreaterThan(0);
    });

    it('should return default time when insufficient blocks', async () => {
      mockBlockchain.getBlockByHeight.mockReturnValue(undefined);

      const avgTime = await blockchainStats.getAverageBlockTime();
      expect(avgTime).toBe(600);
    });
  });

  describe('getBlockPropagationStats', () => {
    it('should calculate block propagation statistics', async () => {
      const stats = await blockchainStats.getBlockPropagationStats();
      
      expect(stats).toEqual({
        average: expect.any(Number),
        median: expect.any(Number),
      });
    });

    it('should handle empty propagation times', async () => {
      const modifiedBlock = {
        ...mockBlock,
        metadata: {},
      } as Block;
      mockBlockchain.getBlockByHeight.mockReturnValue(modifiedBlock);

      const stats = await blockchainStats.getBlockPropagationStats();
      expect(stats).toEqual({ average: 0, median: 0 });
    });
  });

  describe('getChainStats', () => {
    it('should return chain statistics', async () => {
      const stats = await blockchainStats.getChainStats();
      
      expect(stats).toEqual({
        totalBlocks: 2,
        totalTransactions: 2,
        averageBlockSize: expect.any(Number),
        difficulty: 100000,
      });
    });

    it('should handle empty chain', async () => {
      mockBlockchain.getState.mockReturnValue({ chain: [] });

      await expect(blockchainStats.getChainStats()).rejects.toThrow('Failed to calculate chain stats');
    });
  });

  describe('getNetworkHashRate', () => {
    it('should calculate network hash rate', async () => {
      const hashRate = await blockchainStats.getNetworkHashRate();
      
      expect(hashRate).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing current block', async () => {
      mockBlockchain.getLatestBlock.mockReturnValue(null);

      await expect(blockchainStats.getNetworkHashRate()).rejects.toThrow('Failed to calculate network hash rate');
    });
  });

  describe('getMedianTime', () => {
    it('should calculate median time', async () => {
      const medianTime = await blockchainStats.getMedianTime();
      
      expect(medianTime).toBeGreaterThan(0);
      expect(mockBlockchain.getBlockByHeight).toHaveBeenCalled();
    });

    it('should handle no blocks', async () => {
      mockBlockchain.getBlockByHeight.mockReturnValue(undefined);

      const medianTime = await blockchainStats.getMedianTime();
      expect(medianTime).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid block timestamps', async () => {
      const modifiedBlock = {
        ...mockBlock,
        header: { ...mockBlock.header, timestamp: 0 },
      } as Block;
      mockBlockchain.getBlockByHeight.mockReturnValue(modifiedBlock);

      const avgTime = await blockchainStats.getAverageBlockTime();
      expect(avgTime).toBe(600);
    });

    it('should handle block size calculation errors', async () => {
      const modifiedBlock = {
        ...mockBlock,
        transactions: [] as Transaction[],
      } as Block;
      mockBlockchain.getState.mockReturnValue({ chain: [modifiedBlock] });

      const stats = await blockchainStats.getChainStats();
      expect(stats.averageBlockSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('File System Operations', () => {
    it('should handle file system errors gracefully', async () => {
      const mockFs = fs as jest.Mocked<typeof fs>;
      mockFs.writeFile.mockRejectedValue(new Error('Write error'));
      mockFs.readFile.mockRejectedValue(new Error('Read error'));

      // These operations should not throw errors
      await blockchainStats.getVotingStats();
      blockchainStats.cleanup();
    });

    it('should handle invalid circuit breaker state file', async () => {
      const mockFs = fs as jest.Mocked<typeof fs>;
      mockFs.readFile.mockResolvedValue('invalid json' as string);

      // Should not throw error
      await blockchainStats.getVotingStats();
    });
  });

  describe('Cache and Circuit Breaker', () => {
    it('should cache results', async () => {
      const firstCall = await blockchainStats.getVotingStats();
      const secondCall = await blockchainStats.getVotingStats();
      
      expect(firstCall).toEqual(secondCall);
      expect(mockBlockchain.getConsensusMetrics).toHaveBeenCalledTimes(1);
    });

    it('should handle circuit breaker failures', async () => {
      mockBlockchain.getConsensusMetrics.mockRejectedValue(new Error('Test error'));

      for (let i = 0; i < 5; i++) {
        await expect(blockchainStats.getVotingStats()).rejects.toThrow();
      }

      // Circuit should be open now
      await expect(blockchainStats.getVotingStats()).rejects.toThrow('Circuit breaker is open');
    }, 30000); // Increase timeout further

    it('should reset circuit breaker after cooldown', async () => {
      mockBlockchain.getConsensusMetrics.mockRejectedValue(new Error('Test error'));

      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await expect(blockchainStats.getVotingStats()).rejects.toThrow();
      }

      // Mock Date.now() to simulate cooldown period
      const realDateNow = Date.now;
      const mockNow = jest.fn(() => realDateNow() + 61000); // 61 seconds later
      global.Date.now = mockNow;

      // Mock successful call
      mockBlockchain.getConsensusMetrics.mockResolvedValue({
        powHashrate: 1000,
        activeVoters: 10,
        participation: 0.8,
        currentParticipation: 0.75,
      });

      // Circuit should be closed and call should succeed
      const stats = await blockchainStats.getVotingStats();
      expect(stats).toBeDefined();

      // Restore Date.now
      global.Date.now = realDateNow;
    }, 30000); // Increase timeout further
  });

  describe('Cleanup', () => {
    it('should clean up resources', () => {
      blockchainStats.cleanup();
      expect(mockCleanup).toHaveBeenCalled();
    });
  });
});
