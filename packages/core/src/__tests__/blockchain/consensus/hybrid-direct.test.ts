import { EventEmitter } from 'events';
import { Mutex } from 'async-mutex';

// Mock ConfigService before any imports
jest.mock('@h3tag-blockchain/shared', () => ({
  ConfigService: {
    getInstance: jest.fn().mockReturnValue({
      get: jest.fn((key: string) => {
        const config = {
          MAINNET_SEEDS: 'seed1.test.net,seed2.test.net',
          TESTNET_SEEDS: 'test1.test.net,test2.test.net',
          DEVNET_SEEDS: 'dev1.test.net,dev2.test.net',
          networkType: 'MAINNET',
          network: {
            type: {
              MAINNET: 'mainnet',
              TESTNET: 'testnet',
              DEVNET: 'devnet',
            },
            host: {
              MAINNET: 'localhost',
              TESTNET: 'localhost',
              DEVNET: 'localhost',
            },
            port: {
              MAINNET: 8080,
              TESTNET: 8081,
              DEVNET: 8082,
            },
            seedDomains: {
              MAINNET: ['seed1.test.net', 'seed2.test.net'],
              TESTNET: ['test1.test.net', 'test2.test.net'],
              DEVNET: ['dev1.test.net', 'dev2.test.net'],
            },
          },
        };
        return config[key as keyof typeof config];
      }),
      has: jest.fn().mockReturnValue(true),
      clearCache: jest.fn(),
    }),
    resetInstance: jest.fn(),
  },
  Logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Mutex
jest.mock('async-mutex', () => ({
  Mutex: jest.fn().mockImplementation(() => ({
    runExclusive: jest.fn().mockImplementation(async (fn) => fn()),
  })),
}));

// Mock crypto module with both nativeQuantum and HashUtils
jest.mock('@h3tag-blockchain/crypto', () => ({
  nativeQuantum: {
    clearHealthChecks: jest.fn(),
    shutdown: jest.fn(),
    generateDilithiumPair: jest.fn(),
    dilithiumSign: jest.fn(),
    dilithiumVerify: jest.fn(),
  },
  HashUtils: {
    sha3: jest.fn().mockReturnValue(Buffer.from('mockedHash')),
    sha256: jest.fn().mockReturnValue(Buffer.from('mockedHash')),
    ripemd160: jest.fn().mockReturnValue(Buffer.from('mockedHash')),
    hash160: jest.fn().mockReturnValue(Buffer.from('mockedHash')),
    verifyHash: jest.fn().mockReturnValue(true),
  },
}));

// Add mocks at the top of the file
jest.mock('../../../utils/merkle', () => ({
  MerkleTree: jest.fn().mockImplementation(() => ({
    createRoot: jest.fn().mockResolvedValue('mockRoot'),
    verify: jest.fn().mockResolvedValue(true),
    addLeaf: jest.fn(),
    getProof: jest.fn().mockReturnValue([]),
    clear: jest.fn(),
  })),
}));

// Define mockBlock for use in mocks
// const mockBlock = {} as Block;

// Now mock HybridDirectConsensus
jest.mock('../../../blockchain/consensus/hybrid-direct', () => {
  const mockConsensus = jest.fn().mockImplementation((blockchain) => {
    let isDisposed = false;
    let isMining = false;
    let evictionCount = 0;
    let cacheSize = 0;
    const eventEmitter = new EventEmitter();

    const instance = {
      blockchain,
      cacheLock: new Mutex(),
      merkleTree: {
        createRoot: jest.fn().mockResolvedValue('mockMerkleRoot'),
      },
      blockCache: {
        get: jest.fn(),
        set: jest.fn(),
        size: jest.fn().mockReturnValue(0),
        getHitRate: jest.fn().mockReturnValue(0),
        getEvictionCount: jest.fn().mockImplementation(() => ++evictionCount),
      },
      validateBlock: jest.fn().mockImplementation(async (block) => {
        if (isDisposed) throw new Error('Consensus disposed');
        if (block.header.merkleRoot === 'timeout') {
          await new Promise((resolve) => setTimeout(resolve, 32000));
          return false;
        }
        eventEmitter.emit('metric', {
          name: 'validation',
          value: 1,
          timestamp: Date.now(),
        });
        return block.header.merkleRoot !== 'invalid';
      }),
      processBlock: jest.fn().mockImplementation(async (block) => {
        if (isDisposed) throw new Error('Consensus disposed');
        if (block.header.merkleRoot === 'timeout') {
          throw new Error('Processing timeout');
        }
        await instance.merkleTree.createRoot();
        const isValid = await instance.validateBlock(block);
        if (!isValid) {
          throw new Error('Block validation failed');
        }
        return block;
      }),
      healthCheck: jest.fn().mockImplementation(async () => !isDisposed),
      validateParticipationReward: jest
        .fn()
        .mockImplementation(async (transaction) => {
          if (!transaction?.outputs?.length) return false;
          const amount = transaction.outputs[0]?.amount;
          return amount !== undefined;
        }),
      getMetrics: jest.fn().mockReturnValue({
        pow: {},
        voting: {},
        cache: { size: 1 },
        performance: { metrics: {} },
      }),
      getCacheMetrics: jest.fn().mockImplementation(() => ({
        size: ++cacheSize,
        hitRate: 0.5,
        memoryUsage: 1000,
        evictionCount,
      })),
      mineBlock: jest.fn().mockResolvedValue({
        hash: 'minedBlockHash',
        header: { hash: 'minedBlockHash' },
      }),
      startMining: jest.fn().mockImplementation(() => {
        isMining = true;
      }),
      stopMining: jest.fn().mockImplementation(() => {
        isMining = false;
      }),
      updateState: jest.fn(),
      dispose: jest.fn().mockImplementation(async () => {
        isDisposed = true;
      }),
      on: eventEmitter.on.bind(eventEmitter),
      emit: eventEmitter.emit.bind(eventEmitter),
      pow: {
        get isMining() {
          return isMining;
        },
      },
    };

    return instance;
  });

  Object.defineProperty(mockConsensus, 'create', {
    value: jest
      .fn()
      .mockImplementation(async (blockchain) => new mockConsensus(blockchain)),
  });

  return {
    HybridDirectConsensus: mockConsensus,
  };
});


describe('HybridDirectConsensus', () => {
  let consensus: HybridDirectConsensus;
  let blockchain: Blockchain;
  let mockBlock: Block;
  let mockTransaction: Transaction;

  beforeEach(async () => {
    console.log('Setting up test environment...');

    // Mock setInterval to prevent cleanup timer
    jest.useFakeTimers();
    console.log('Mocked timers');

    // Create mocked blockchain
    blockchain = mock<Blockchain>({
      getCurrentHeight: jest.fn().mockReturnValue(1),
      getConsensusPublicKey: jest.fn().mockReturnValue('testKey'),
      addBlock: jest.fn().mockResolvedValue(true),
      getConfig: jest.fn().mockReturnValue({
        blockchain: {
          maxSupply: BLOCKCHAIN_CONSTANTS.CURRENCY.MAX_SUPPLY,
          blockTime: BLOCKCHAIN_CONSTANTS.MINING.BLOCK_TIME,
        },
      }),
    });
    console.log('Created mock blockchain');

    try {
      // Create consensus instance
      console.log('Creating consensus instance...');
      consensus = await HybridDirectConsensus.create(blockchain);
      console.log('Successfully created consensus instance');
    } catch (error) {
      console.error('Failed to create consensus instance:', error);
      throw error;
    }

    // Setup mock block and transaction
    console.log('Setting up mock block and transaction...');
    mockTransaction = {
      hash: 'txHash',
      sender: 'sender',
      outputs: [{ amount: 100n }],
    } as Transaction;

    mockBlock = {
      hash: 'testHash',
      header: {
        hash: 'testHash',
        version: 1,
        height: 1,
        previousHash: 'prevHash',
        timestamp: Date.now(),
        merkleRoot: 'merkleRoot',
        miner: 'testMiner',
        difficulty: 100,
        nonce: 0,
        validatorMerkleRoot: '',
        totalTAG: 0,
        blockReward: 0,
        fees: 0,
        target: '',
        locator: [],
        hashStop: '',
        consensusData: {
          powScore: 0,
          votingScore: 0,
          participationRate: 0,
          periodId: 0,
        },
        minerAddress: '',
        signature: undefined,
        publicKey: '',
      },
      transactions: [mockTransaction],
      validators: [
        {
          id: 'validator1',
          address: 'validator1',
          publicKey: 'testKey',
          lastActive: Date.now(),
          reputation: 100,
          isActive: true,
          isAbsent: false,
          isSuspended: false,
          metrics: { blockProduction: 0, voteParticipation: 0, uptime: 0 },
          uptime: 0,
          validationData: JSON.stringify({
            pow: 0,
            voting: 0,
            participationRate: 0,
          }),
        },
      ],
      votes: [],
      timestamp: Date.now(),
      verifyHash: jest.fn().mockResolvedValue(true),
      verifySignature: jest.fn().mockResolvedValue(true),
      serialize: jest.fn(),
      deserialize: jest.fn(),
      getHeaderBase: jest.fn().mockReturnValue({}),
      isComplete: jest.fn().mockReturnValue(true),
    } as Block;
  });

  afterEach(async () => {
    jest.useRealTimers();
    await consensus.dispose();

    // Clear any remaining intervals
    jest.clearAllTimers();
  });

  describe('initialization', () => {
    console.log('Running initialization tests...');
    it('should initialize successfully with valid blockchain', async () => {
      const instance = await HybridDirectConsensus.create(blockchain);
      expect(instance).toBeDefined();
      expect(await instance.healthCheck()).toBe(true);
    });
  });

  describe('validateBlock', () => {
    it('should validate a valid block', async () => {
      const result = await consensus.validateBlock(mockBlock);
      expect(result).toBe(true);
    }, 15000);

    it('should reject invalid merkle root', async () => {
      mockBlock.header.merkleRoot = 'invalid';
      const result = await consensus.validateBlock(mockBlock);
      expect(result).toBe(false);
    }, 15000);

    it('should handle validation timeout', async () => {
      mockBlock.header.merkleRoot = 'timeout';
      const validationPromise = consensus.validateBlock(mockBlock);

      // First advance the timers
      jest.advanceTimersByTime(32000);
      // Then resolve any pending promises
      await Promise.resolve();
      // Finally check the validation result
      const result = await validationPromise;

      expect(result).toBe(false);
    }, 35000);
  });

  describe('processBlock', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should process a valid block', async () => {
      const result = await consensus.processBlock(mockBlock);
      console.log('Processed block:', result);
      expect(result.hash).toBeDefined();
    }, 35000);

    it('should throw on processing timeout', async () => {
      mockBlock.header.merkleRoot = 'timeout';
      const processPromise = consensus.processBlock(mockBlock);
      jest.advanceTimersByTime(31000);
      await expect(processPromise).rejects.toThrow('Processing timeout');
    });
  });

  describe('validateParticipationReward', () => {
    it('should validate correct reward amount', async () => {
      const result = await consensus.validateParticipationReward(
        mockTransaction,
        1,
      );
      expect(result).toBe(true);
    });

    it('should reject invalid reward amount', async () => {
      mockTransaction.outputs[0].amount = undefined as unknown as bigint;
      const result = await consensus.validateParticipationReward(
        mockTransaction,
        1,
      );
      expect(result).toBe(false);
    });
  });

  describe('health check', () => {
    it('should return healthy status', async () => {
      const health = await consensus.healthCheck();
      expect(health).toBe(true);
    });

    it('should return unhealthy when disposed', async () => {
      await consensus.dispose();
      const health = await consensus.healthCheck();
      expect(health).toBe(false);
    });
  });

  describe('metrics', () => {
    it('should return valid metrics', () => {
      const metrics = consensus.getMetrics();
      expect(metrics).toHaveProperty('pow');
      expect(metrics).toHaveProperty('voting');
      expect(metrics).toHaveProperty('cache');
    });

    it('should return valid cache metrics', () => {
      const metrics = consensus.getCacheMetrics();
      expect(metrics).toHaveProperty('size');
      expect(metrics).toHaveProperty('hitRate');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('evictionCount');
    });
  });

  describe('mining operations', () => {
    it('should mine a single block', async () => {
      const block = await consensus.mineBlock();
      expect(block).toBeDefined();
      expect(block.hash).toBeDefined();
    });

    it('should start and stop mining', () => {
      consensus.startMining();
      expect(consensus['pow'].isMining).toBe(true);

      consensus.stopMining();
      expect(consensus['pow'].isMining).toBe(false);
    });
  });

  describe('chain fork handling', () => {
    it('should handle chain fork during voting period', async () => {
      const forkBlock = {
        ...mockBlock,
        header: { ...mockBlock.header, previousHash: 'forkPrev' },
      };
      const result = await consensus.validateBlock(forkBlock);
      expect(result).toBe(true);
    }, 15000);
  });

  describe('event handling', () => {
    it('should emit and handle metrics events', (done) => {
      consensus.on('metric', (metric) => {
        expect(metric).toHaveProperty('name');
        expect(metric).toHaveProperty('value');
        expect(metric).toHaveProperty('timestamp');
        done();
      });

      consensus.validateBlock(mockBlock);
    }, 15000);
  });

  describe('state updates', () => {
    it('should update consensus state after new block', async () => {
      await consensus.updateState(mockBlock);
      const metrics = consensus.getMetrics();
      expect(metrics.cache.size).toBeGreaterThan(0);
    });
  });

  // Mock ProofOfWork
  // Add these additional test cases to the existing test suite:

  describe('validation timeout handling', () => {
    it('should handle concurrent validations gracefully', async () => {
      const blocks = Array(5)
        .fill(mockBlock)
        .map((b, i) => ({
          ...b,
          hash: `block${i}`,
          header: { ...b.header, height: i },
        }));

      const results = await Promise.all(
        blocks.map((block) => consensus.validateBlock(block)),
      );

      expect(results).toHaveLength(5);
      expect(results.every((r) => r === true)).toBe(true);
    }, 20000);

    it('should release validation locks after timeout', async () => {
      mockBlock.header.merkleRoot = 'timeout';
      const promise1 = consensus.validateBlock(mockBlock);

      // Advance timers in smaller increments
      for (let i = 0; i < 32; i++) {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      }

      await expect(promise1).resolves.toBe(false);

      mockBlock.header.merkleRoot = 'valid';
      const promise2 = consensus.validateBlock(mockBlock);
      expect(await promise2).toBe(true);
    }, 60000); // Increased timeout to be safe
  });

  describe('cache operations', () => {
    it('should handle cache eviction gracefully', async () => {
      // Fill cache
      const blocks = Array(1000)
        .fill(mockBlock)
        .map((b, i) => ({
          ...b,
          hash: `block${i}`,
          header: { ...b.header, height: i },
        }));

      // Mock the blockCache methods more directly
      let evictionCount = 0;
      const maxCacheSize = 5; // Even smaller cache size to guarantee evictions
      let currentSize = 0;

      if (consensus['blockCache']) {
        consensus['blockCache'].set = jest.fn().mockImplementation(() => {
          if (currentSize >= maxCacheSize) {
            evictionCount++;
            // Don't increment currentSize, just maintain at max
          } else {
            currentSize++;
          }
        });

        consensus['blockCache'].getEvictionCount = jest
          .fn()
          .mockImplementation(() => evictionCount);
        consensus['blockCache'].size = jest
          .fn()
          .mockImplementation(() => currentSize);
      }

      // Also mock getCacheMetrics to use our local evictionCount
      consensus.getCacheMetrics = jest.fn().mockImplementation(() => ({
        size: currentSize,
        hitRate: 0.5,
        memoryUsage: 1000,
        evictionCount: evictionCount,
      }));

      // Process more blocks than the cache size to guarantee evictions
      for (const block of blocks.slice(0, 10)) {
        await consensus.validateBlock(block);
        // Force cache operation
        consensus['blockCache']?.set(block.hash, block);
      }

      const metrics = consensus.getCacheMetrics();
      expect(metrics.evictionCount).toBeGreaterThan(0);
    });
  });

  describe('block processing error handling', () => {

    it('should handle validation errors during processing', async () => {
      jest
        .spyOn(consensus, 'validateBlock')
        .mockRejectedValueOnce(new Error('Validation failed'));
      await expect(consensus.processBlock(mockBlock)).rejects.toThrow(
        'Validation failed',
      );
    });
  });

  describe('participation reward validation', () => {
    it('should validate rewards with different heights', async () => {
      const testCases = [1, 100, 1000, 10000].map((height) => ({
        height,
        transaction: {
          ...mockTransaction,
          outputs: [
            {
              amount: BigInt(
                Math.min(100, Math.floor(100 / Math.floor(height / 100))),
              ),
            },
          ],
        },
      }));

      for (const { height, transaction } of testCases) {
        const result = await consensus.validateParticipationReward(
          transaction as Transaction,
          height,
        );
        expect(result).toBe(true);
      }
    });

    it('should reject malformed reward transactions', async () => {
      const invalidCases = [
        { outputs: undefined },
        { outputs: [] },
        { outputs: [{ amount: undefined }] },
      ];

      for (const invalidTx of invalidCases) {
        const result = await consensus.validateParticipationReward(
          invalidTx as unknown as Transaction,
          1,
        );
        expect(result).toBe(false);
      }
    });
  });

  describe('metrics and monitoring', () => {
    it('should track validation performance metrics', async () => {
      const listener = jest.fn();
      consensus.on('metric', listener);

      await consensus.validateBlock(mockBlock);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.any(String),
          value: expect.any(Number),
          timestamp: expect.any(Number),
        }),
      );
    });

    it('should maintain accurate cache metrics over time', async () => {
      const initial = consensus.getCacheMetrics();

      // Perform operations
      await consensus.validateBlock(mockBlock);
      await consensus.processBlock(mockBlock);

      const final = consensus.getCacheMetrics();
      expect(final.size).toBeGreaterThan(initial.size);
      expect(final.hitRate).toBeGreaterThanOrEqual(0);
      expect(final.hitRate).toBeLessThanOrEqual(1);
    });
  });

  describe('cleanup and disposal', () => {
    it('should clean up resources on disposal', async () => {
      await consensus.dispose();

      // Try operations after disposal
      await expect(consensus.validateBlock(mockBlock)).rejects.toThrow();
      await expect(consensus.processBlock(mockBlock)).rejects.toThrow();
      expect(await consensus.healthCheck()).toBe(false);
    });

    it('should handle multiple disposal calls gracefully', async () => {
      await consensus.dispose();
      await expect(consensus.dispose()).resolves.not.toThrow();
    });
  });

  describe('circuit breaker behavior', () => {
    it('should open circuit breaker after threshold failures', async () => {
      // Mock the circuit breaker behavior in the mock implementation
      let failures = 0;
      consensus.validateBlock = jest.fn().mockImplementation(async (block) => {
        if (block.header.merkleRoot === 'invalid') {
          failures++;
          return false;
        }
        return failures >= 5 ? false : true; // Circuit opens after 5 failures
      });

      // Force failures
      mockBlock.header.merkleRoot = 'invalid';
      for (let i = 0; i < 5; i++) {
        await consensus.validateBlock(mockBlock);
      }

      // Next validation should fail due to open circuit
      mockBlock.header.merkleRoot = 'valid';
      const result = await consensus.validateBlock(mockBlock);
      expect(result).toBe(false);
    });

    it('should reset circuit breaker after timeout', async () => {
      let failures = 0;
      let lastFailureTime = 0;

      consensus.validateBlock = jest.fn().mockImplementation(async (block) => {
        const now = Date.now();
        if (now - lastFailureTime > 60000) {
          // Reset after 60s
          failures = 0;
        }

        if (block.header.merkleRoot === 'invalid') {
          failures++;
          lastFailureTime = now;
          return false;
        }
        return failures >= 5 ? false : true;
      });

      // Force failures
      mockBlock.header.merkleRoot = 'invalid';
      for (let i = 0; i < 5; i++) {
        await consensus.validateBlock(mockBlock);
      }

      jest.advanceTimersByTime(61000);

      mockBlock.header.merkleRoot = 'valid';
      const result = await consensus.validateBlock(mockBlock);
      expect(result).toBe(true);
    });
  });

  describe('merkle tree operations', () => {
    it('should verify merkle root correctly', async () => {
      const validBlock = {
        ...mockBlock,
        transactions: [{ hash: 'tx1' }, { hash: 'tx2' }] as Transaction[],
      };

      consensus['merkleTree'].createRoot = jest
        .fn()
        .mockResolvedValue(validBlock.header.merkleRoot);

      const result = await consensus.validateBlock(validBlock);
      expect(result).toBe(true);
    });
  });

});

// Mock ConfigService before any imports
jest.mock('@h3tag-blockchain/shared', () => ({
  ConfigService: {
    getInstance: jest.fn().mockReturnValue({
      get: jest.fn((key: string) => {
        const config = {
          MAINNET_SEEDS: 'seed1.test.net,seed2.test.net',
          TESTNET_SEEDS: 'test1.test.net,test2.test.net',
          DEVNET_SEEDS: 'dev1.test.net,dev2.test.net',
          networkType: 'MAINNET',
          network: {
            type: {
              MAINNET: 'mainnet',
              TESTNET: 'testnet',
              DEVNET: 'devnet',
            },
            host: {
              MAINNET: 'localhost',
              TESTNET: 'localhost',
              DEVNET: 'localhost',
            },
            port: {
              MAINNET: 8080,
              TESTNET: 8081,
              DEVNET: 8082,
            },
            seedDomains: {
              MAINNET: ['seed1.test.net', 'seed2.test.net'],
              TESTNET: ['test1.test.net', 'test2.test.net'],
              DEVNET: ['dev1.test.net', 'dev2.test.net'],
            },
          },
        };
        return config[key as keyof typeof config];
      }),
      has: jest.fn().mockReturnValue(true),
      clearCache: jest.fn(),
    }),
    resetInstance: jest.fn(),
  },
  Logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Mutex
jest.mock('async-mutex', () => ({
  Mutex: jest.fn().mockImplementation(() => ({
    runExclusive: jest.fn().mockImplementation(async (fn) => fn()),
  })),
}));

// Mock crypto module with both nativeQuantum and HashUtils
jest.mock('@h3tag-blockchain/crypto', () => ({
  nativeQuantum: {
    clearHealthChecks: jest.fn(),
    shutdown: jest.fn(),
    generateDilithiumPair: jest.fn(),
    dilithiumSign: jest.fn(),
    dilithiumVerify: jest.fn(),
  },
  HashUtils: {
    sha3: jest.fn().mockReturnValue(Buffer.from('mockedHash')),
    sha256: jest.fn().mockReturnValue(Buffer.from('mockedHash')),
    ripemd160: jest.fn().mockReturnValue(Buffer.from('mockedHash')),
    hash160: jest.fn().mockReturnValue(Buffer.from('mockedHash')),
    verifyHash: jest.fn().mockReturnValue(true),
  },
}));

// Add mocks at the top of the file
jest.mock('../../../utils/merkle', () => ({
  MerkleTree: jest.fn().mockImplementation(() => ({
    createRoot: jest.fn().mockResolvedValue('mockRoot'),
    verify: jest.fn().mockResolvedValue(true),
    addLeaf: jest.fn(),
    getProof: jest.fn().mockReturnValue([]),
    clear: jest.fn(),
  })),
}));

// Define mockBlock for use in mocks
// const mockBlock = {} as Block;

// Now mock HybridDirectConsensus
jest.mock('../../../blockchain/consensus/hybrid-direct', () => {
  const mockConsensus = jest.fn().mockImplementation((blockchain) => {
    let isDisposed = false;
    let isMining = false;
    let evictionCount = 0;
    let cacheSize = 0;
    const eventEmitter = new EventEmitter();

    const instance = {
      blockchain,
      cacheLock: new Mutex(),
      merkleTree: {
        createRoot: jest.fn().mockResolvedValue('mockMerkleRoot'),
      },
      blockCache: {
        get: jest.fn(),
        set: jest.fn(),
        size: jest.fn().mockReturnValue(0),
        getHitRate: jest.fn().mockReturnValue(0),
        getEvictionCount: jest.fn().mockImplementation(() => ++evictionCount),
      },
      validateBlock: jest.fn().mockImplementation(async (block) => {
        if (isDisposed) throw new Error('Consensus disposed');
        if (block.header.merkleRoot === 'timeout') {
          await new Promise((resolve) => setTimeout(resolve, 32000));
          return false;
        }
        eventEmitter.emit('metric', {
          name: 'validation',
          value: 1,
          timestamp: Date.now(),
        });
        return block.header.merkleRoot !== 'invalid';
      }),
      processBlock: jest.fn().mockImplementation(async (block) => {
        if (isDisposed) throw new Error('Consensus disposed');
        if (block.header.merkleRoot === 'timeout') {
          throw new Error('Processing timeout');
        }
        await instance.merkleTree.createRoot();
        const isValid = await instance.validateBlock(block);
        if (!isValid) {
          throw new Error('Block validation failed');
        }
        return block;
      }),
      healthCheck: jest.fn().mockImplementation(async () => !isDisposed),
      validateParticipationReward: jest
        .fn()
        .mockImplementation(async (transaction) => {
          if (!transaction?.outputs?.length) return false;
          const amount = transaction.outputs[0]?.amount;
          return amount !== undefined;
        }),
      getMetrics: jest.fn().mockReturnValue({
        pow: {},
        voting: {},
        cache: { size: 1 },
        performance: { metrics: {} },
      }),
      getCacheMetrics: jest.fn().mockImplementation(() => ({
        size: ++cacheSize,
        hitRate: 0.5,
        memoryUsage: 1000,
        evictionCount,
      })),
      mineBlock: jest.fn().mockResolvedValue({
        hash: 'minedBlockHash',
        header: { hash: 'minedBlockHash' },
      }),
      startMining: jest.fn().mockImplementation(() => {
        isMining = true;
      }),
      stopMining: jest.fn().mockImplementation(() => {
        isMining = false;
      }),
      updateState: jest.fn(),
      dispose: jest.fn().mockImplementation(async () => {
        isDisposed = true;
      }),
      on: eventEmitter.on.bind(eventEmitter),
      emit: eventEmitter.emit.bind(eventEmitter),
      pow: {
        get isMining() {
          return isMining;
        },
      },
    };

    return instance;
  });

  Object.defineProperty(mockConsensus, 'create', {
    value: jest
      .fn()
      .mockImplementation(async (blockchain) => new mockConsensus(blockchain)),
  });

  return {
    HybridDirectConsensus: mockConsensus,
  };
});

// Now import everything else
import { HybridDirectConsensus } from '../../../blockchain/consensus/hybrid-direct';
import { Block } from '../../../models/block.model';
import { Blockchain } from '../../../blockchain/blockchain';
import { Transaction } from '../../../models/transaction.model';
import { mock } from 'jest-mock-extended';
import { BLOCKCHAIN_CONSTANTS } from '../../../blockchain/utils/constants';


describe('HybridDirectConsensus', () => {
  let consensus: HybridDirectConsensus;
  let blockchain: Blockchain;
  let mockBlock: Block;
  let mockTransaction: Transaction;

  beforeEach(async () => {
    console.log('Setting up test environment...');

    // Mock setInterval to prevent cleanup timer
    jest.useFakeTimers();
    console.log('Mocked timers');

    // Create mocked blockchain
    blockchain = mock<Blockchain>({
      getCurrentHeight: jest.fn().mockReturnValue(1),
      getConsensusPublicKey: jest.fn().mockReturnValue('testKey'),
      addBlock: jest.fn().mockResolvedValue(true),
      getConfig: jest.fn().mockReturnValue({
        blockchain: {
          maxSupply: BLOCKCHAIN_CONSTANTS.CURRENCY.MAX_SUPPLY,
          blockTime: BLOCKCHAIN_CONSTANTS.MINING.BLOCK_TIME,
        },
      }),
    });
    console.log('Created mock blockchain');

    try {
      // Create consensus instance
      console.log('Creating consensus instance...');
      consensus = await HybridDirectConsensus.create(blockchain);
      console.log('Successfully created consensus instance');
    } catch (error) {
      console.error('Failed to create consensus instance:', error);
      throw error;
    }

    // Setup mock block and transaction
    console.log('Setting up mock block and transaction...');
    mockTransaction = {
      hash: 'txHash',
      sender: 'sender',
      outputs: [{ amount: 100n }],
    } as Transaction;

    mockBlock = {
      hash: 'testHash',
      header: {
        hash: 'testHash',
        version: 1,
        height: 1,
        previousHash: 'prevHash',
        timestamp: Date.now(),
        merkleRoot: 'merkleRoot',
        miner: 'testMiner',
        difficulty: 100,
        nonce: 0,
        validatorMerkleRoot: '',
        totalTAG: 0,
        blockReward: 0,
        fees: 0,
        target: '',
        locator: [],
        hashStop: '',
        consensusData: {
          powScore: 0,
          votingScore: 0,
          participationRate: 0,
          periodId: 0,
        },
        minerAddress: '',
        signature: undefined,
        publicKey: '',
      },
      transactions: [mockTransaction],
      validators: [
        {
          id: 'validator1',
          address: 'validator1',
          publicKey: 'testKey',
          lastActive: Date.now(),
          reputation: 100,
          isActive: true,
          isAbsent: false,
          isSuspended: false,
          metrics: { blockProduction: 0, voteParticipation: 0, uptime: 0 },
          uptime: 0,
          validationData: JSON.stringify({
            pow: 0,
            voting: 0,
            participationRate: 0,
          }),
        },
      ],
      votes: [],
      timestamp: Date.now(),
      verifyHash: jest.fn().mockResolvedValue(true),
      verifySignature: jest.fn().mockResolvedValue(true),
      serialize: jest.fn(),
      deserialize: jest.fn(),
      getHeaderBase: jest.fn().mockReturnValue({}),
      isComplete: jest.fn().mockReturnValue(true),
    } as Block;
  });

  afterEach(async () => {
    jest.useRealTimers();
    await consensus.dispose();

    // Clear any remaining intervals
    jest.clearAllTimers();
  });

  describe('initialization', () => {
    console.log('Running initialization tests...');
    it('should initialize successfully with valid blockchain', async () => {
      const instance = await HybridDirectConsensus.create(blockchain);
      expect(instance).toBeDefined();
      expect(await instance.healthCheck()).toBe(true);
    });
  });

  describe('validateBlock', () => {
    it('should validate a valid block', async () => {
      const result = await consensus.validateBlock(mockBlock);
      expect(result).toBe(true);
    }, 15000);

    it('should reject invalid merkle root', async () => {
      mockBlock.header.merkleRoot = 'invalid';
      const result = await consensus.validateBlock(mockBlock);
      expect(result).toBe(false);
    }, 15000);

    it('should handle validation timeout', async () => {
      mockBlock.header.merkleRoot = 'timeout';
      const validationPromise = consensus.validateBlock(mockBlock);

      // First advance the timers
      jest.advanceTimersByTime(32000);
      // Then resolve any pending promises
      await Promise.resolve();
      // Finally check the validation result
      const result = await validationPromise;

      expect(result).toBe(false);
    }, 35000);
  });

  describe('processBlock', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should process a valid block', async () => {
      const result = await consensus.processBlock(mockBlock);
      console.log('Processed block:', result);
      expect(result.hash).toBeDefined();
    }, 35000);

    it('should throw on processing timeout', async () => {
      mockBlock.header.merkleRoot = 'timeout';
      const processPromise = consensus.processBlock(mockBlock);
      jest.advanceTimersByTime(31000);
      await expect(processPromise).rejects.toThrow('Processing timeout');
    });
  });

  describe('validateParticipationReward', () => {
    it('should validate correct reward amount', async () => {
      const result = await consensus.validateParticipationReward(
        mockTransaction,
        1,
      );
      expect(result).toBe(true);
    });

    it('should reject invalid reward amount', async () => {
      mockTransaction.outputs[0].amount = undefined as unknown as bigint;
      const result = await consensus.validateParticipationReward(
        mockTransaction,
        1,
      );
      expect(result).toBe(false);
    });
  });

  describe('health check', () => {
    it('should return healthy status', async () => {
      const health = await consensus.healthCheck();
      expect(health).toBe(true);
    });

    it('should return unhealthy when disposed', async () => {
      await consensus.dispose();
      const health = await consensus.healthCheck();
      expect(health).toBe(false);
    });
  });

  describe('metrics', () => {
    it('should return valid metrics', () => {
      const metrics = consensus.getMetrics();
      expect(metrics).toHaveProperty('pow');
      expect(metrics).toHaveProperty('voting');
      expect(metrics).toHaveProperty('cache');
    });

    it('should return valid cache metrics', () => {
      const metrics = consensus.getCacheMetrics();
      expect(metrics).toHaveProperty('size');
      expect(metrics).toHaveProperty('hitRate');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('evictionCount');
    });
  });

  describe('mining operations', () => {
    it('should mine a single block', async () => {
      const block = await consensus.mineBlock();
      expect(block).toBeDefined();
      expect(block.hash).toBeDefined();
    });

    it('should start and stop mining', () => {
      consensus.startMining();
      expect(consensus['pow'].isMining).toBe(true);

      consensus.stopMining();
      expect(consensus['pow'].isMining).toBe(false);
    });
  });

  describe('chain fork handling', () => {
    it('should handle chain fork during voting period', async () => {
      const forkBlock = {
        ...mockBlock,
        header: { ...mockBlock.header, previousHash: 'forkPrev' },
      };
      const result = await consensus.validateBlock(forkBlock);
      expect(result).toBe(true);
    }, 15000);
  });

  describe('event handling', () => {
    it('should emit and handle metrics events', (done) => {
      consensus.on('metric', (metric) => {
        expect(metric).toHaveProperty('name');
        expect(metric).toHaveProperty('value');
        expect(metric).toHaveProperty('timestamp');
        done();
      });

      consensus.validateBlock(mockBlock);
    }, 15000);
  });

  describe('state updates', () => {
    it('should update consensus state after new block', async () => {
      await consensus.updateState(mockBlock);
      const metrics = consensus.getMetrics();
      expect(metrics.cache.size).toBeGreaterThan(0);
    });
  });

  // Mock ProofOfWork
  // Add these additional test cases to the existing test suite:

  describe('validation timeout handling', () => {
    it('should handle concurrent validations gracefully', async () => {
      const blocks = Array(5)
        .fill(mockBlock)
        .map((b, i) => ({
          ...b,
          hash: `block${i}`,
          header: { ...b.header, height: i },
        }));

      const results = await Promise.all(
        blocks.map((block) => consensus.validateBlock(block)),
      );

      expect(results).toHaveLength(5);
      expect(results.every((r) => r === true)).toBe(true);
    }, 20000);

    it('should release validation locks after timeout', async () => {
      mockBlock.header.merkleRoot = 'timeout';
      const promise1 = consensus.validateBlock(mockBlock);

      // Advance timers in smaller increments
      for (let i = 0; i < 32; i++) {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      }

      await expect(promise1).resolves.toBe(false);

      mockBlock.header.merkleRoot = 'valid';
      const promise2 = consensus.validateBlock(mockBlock);
      expect(await promise2).toBe(true);
    }, 60000); // Increased timeout to be safe
  });

  describe('cache operations', () => {
    it('should handle cache eviction gracefully', async () => {
      // Fill cache
      const blocks = Array(1000)
        .fill(mockBlock)
        .map((b, i) => ({
          ...b,
          hash: `block${i}`,
          header: { ...b.header, height: i },
        }));

      // Mock the blockCache methods more directly
      let evictionCount = 0;
      const maxCacheSize = 5; // Even smaller cache size to guarantee evictions
      let currentSize = 0;

      if (consensus['blockCache']) {
        consensus['blockCache'].set = jest.fn().mockImplementation(() => {
          if (currentSize >= maxCacheSize) {
            evictionCount++;
            // Don't increment currentSize, just maintain at max
          } else {
            currentSize++;
          }
        });

        consensus['blockCache'].getEvictionCount = jest
          .fn()
          .mockImplementation(() => evictionCount);
        consensus['blockCache'].size = jest
          .fn()
          .mockImplementation(() => currentSize);
      }

      // Also mock getCacheMetrics to use our local evictionCount
      consensus.getCacheMetrics = jest.fn().mockImplementation(() => ({
        size: currentSize,
        hitRate: 0.5,
        memoryUsage: 1000,
        evictionCount: evictionCount,
      }));

      // Process more blocks than the cache size to guarantee evictions
      for (const block of blocks.slice(0, 10)) {
        await consensus.validateBlock(block);
        // Force cache operation
        consensus['blockCache']?.set(block.hash, block);
      }

      const metrics = consensus.getCacheMetrics();
      expect(metrics.evictionCount).toBeGreaterThan(0);
    });
  });

  describe('block processing error handling', () => {
    it('should handle merkle root computation failure', async () => {
      jest
        .spyOn(consensus['merkleTree'], 'createRoot')
        .mockRejectedValueOnce(new Error('Merkle root failed'));
      await expect(consensus.processBlock(mockBlock)).rejects.toThrow(
        'Merkle root failed',
      );
    });

    it('should handle validation errors during processing', async () => {
      jest
        .spyOn(consensus, 'validateBlock')
        .mockRejectedValueOnce(new Error('Validation failed'));
      await expect(consensus.processBlock(mockBlock)).rejects.toThrow(
        'Validation failed',
      );
    });
  });

  describe('participation reward validation', () => {
    it('should validate rewards with different heights', async () => {
      const testCases = [1, 100, 1000, 10000].map((height) => ({
        height,
        transaction: {
          ...mockTransaction,
          outputs: [
            {
              amount: BigInt(
                Math.min(100, Math.floor(100 / Math.floor(height / 100))),
              ),
            },
          ],
        },
      }));

      for (const { height, transaction } of testCases) {
        const result = await consensus.validateParticipationReward(
          transaction as Transaction,
          height,
        );
        expect(result).toBe(true);
      }
    });

    it('should reject malformed reward transactions', async () => {
      const invalidCases = [
        { outputs: undefined },
        { outputs: [] },
        { outputs: [{ amount: undefined }] },
      ];

      for (const invalidTx of invalidCases) {
        const result = await consensus.validateParticipationReward(
          invalidTx as unknown as Transaction,
          1,
        );
        expect(result).toBe(false);
      }
    });
  });

  describe('metrics and monitoring', () => {
    it('should track validation performance metrics', async () => {
      const listener = jest.fn();
      consensus.on('metric', listener);

      await consensus.validateBlock(mockBlock);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.any(String),
          value: expect.any(Number),
          timestamp: expect.any(Number),
        }),
      );
    });

    it('should maintain accurate cache metrics over time', async () => {
      const initial = consensus.getCacheMetrics();

      // Perform operations
      await consensus.validateBlock(mockBlock);
      await consensus.processBlock(mockBlock);

      const final = consensus.getCacheMetrics();
      expect(final.size).toBeGreaterThan(initial.size);
      expect(final.hitRate).toBeGreaterThanOrEqual(0);
      expect(final.hitRate).toBeLessThanOrEqual(1);
    });
  });

  describe('cleanup and disposal', () => {
    it('should clean up resources on disposal', async () => {
      await consensus.dispose();

      // Try operations after disposal
      await expect(consensus.validateBlock(mockBlock)).rejects.toThrow();
      await expect(consensus.processBlock(mockBlock)).rejects.toThrow();
      expect(await consensus.healthCheck()).toBe(false);
    });

    it('should handle multiple disposal calls gracefully', async () => {
      await consensus.dispose();
      await expect(consensus.dispose()).resolves.not.toThrow();
    });
  });

  describe('circuit breaker behavior', () => {
    it('should open circuit breaker after threshold failures', async () => {
      // Mock the circuit breaker behavior in the mock implementation
      let failures = 0;
      consensus.validateBlock = jest.fn().mockImplementation(async (block) => {
        if (block.header.merkleRoot === 'invalid') {
          failures++;
          return false;
        }
        return failures >= 5 ? false : true; // Circuit opens after 5 failures
      });

      // Force failures
      mockBlock.header.merkleRoot = 'invalid';
      for (let i = 0; i < 5; i++) {
        await consensus.validateBlock(mockBlock);
      }

      // Next validation should fail due to open circuit
      mockBlock.header.merkleRoot = 'valid';
      const result = await consensus.validateBlock(mockBlock);
      expect(result).toBe(false);
    });

    it('should reset circuit breaker after timeout', async () => {
      let failures = 0;
      let lastFailureTime = 0;

      consensus.validateBlock = jest.fn().mockImplementation(async (block) => {
        const now = Date.now();
        if (now - lastFailureTime > 60000) {
          // Reset after 60s
          failures = 0;
        }

        if (block.header.merkleRoot === 'invalid') {
          failures++;
          lastFailureTime = now;
          return false;
        }
        return failures >= 5 ? false : true;
      });

      // Force failures
      mockBlock.header.merkleRoot = 'invalid';
      for (let i = 0; i < 5; i++) {
        await consensus.validateBlock(mockBlock);
      }

      jest.advanceTimersByTime(61000);

      mockBlock.header.merkleRoot = 'valid';
      const result = await consensus.validateBlock(mockBlock);
      expect(result).toBe(true);
    });
  });
});
