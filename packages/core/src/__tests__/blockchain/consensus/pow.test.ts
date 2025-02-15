import { ProofOfWork } from '../../../blockchain/consensus/pow';
import { createHash } from 'crypto';
import { MerkleTree } from '../../../utils/merkle';
import { BLOCKCHAIN_CONSTANTS } from '../../../blockchain/utils/constants';
import { Logger } from '@h3tag-blockchain/shared';
import { QuantumNative } from '@h3tag-blockchain/crypto';


process.env.MAINNET_SEEDS = 'dummy-seeds';

jest.mock('../../../database/mining-schema', () => {
  return {
    MiningDatabase: jest.fn().mockImplementation(() => {
      return {
        storePowSolution: jest.fn(async () => {}),
        storeMiningMetrics: jest.fn(async () => {}),
        shutdown: jest.fn(async () => {}),
      };
    }),
  };
});

jest.mock('../../../database/blockchain-schema', () => {
  return {
    BlockchainSchema: jest.fn().mockImplementation(() => {
      return {
        get: jest.fn(async () => ''),
        getCurrentHeight: jest.fn(async () => 0),
        updateDifficulty: jest.fn(async () => {}),
        saveBlock: jest.fn(async () => {}),
      };
    }),
  };
});

jest.mock('@h3tag-blockchain/crypto', () => {
  return {
    HybridCrypto: {
      hash: jest.fn(async () => 'dummyhash'),
      sign: jest.fn(async () => 'dummysign'),
      verify: jest.fn(async () => true),
      generateSharedSecret: jest.fn(async () => 'dummySharedSecret'),
    },
    SIMD: {
      initialize: jest.fn(async () => {}),
    },
  };
});

// Move this before the dummyBlockchain definition
const prevBlock = {
  header: {
    hash: 'prevhash',
    timestamp: 1000,
    nonce: 1,
    version: 1,
    height: 0,
    previousHash: '0'.repeat(64),
    merkleRoot: '1'.repeat(64),
    difficulty: 1,
  },
  hash: 'prevhash',
  transactions: [],
  getHeaderBase: () => 'prevheader',
};

// Then define dummyBlockchain
const dummyBlockchain = {
  getLatestBlock: jest.fn(() => {
    return {
      hash: '0000000000000000000000000000000000000000000000000000000000000000',
      header: {
        version: 1,
        height: 0,
        timestamp: Math.floor(Date.now() / 1000) - 1000,
        previousHash: '0'.repeat(64),
        merkleRoot: '1'.repeat(64),
        difficulty: 1,
        nonce: 0,
      },
      transactions: [],
      getHeaderBase: function () {
        return JSON.stringify({
          version: 1,
          previousHash: this.header.previousHash,
          merkleRoot: this.header.merkleRoot,
          timestamp: this.header.timestamp,
          difficulty: this.header.difficulty,
          nonce: this.header.nonce,
        });
      },
    };
  }),
  getCurrentHeight: jest.fn(() => 0),
  calculateBlockReward: jest.fn(() => BigInt(50)),
  getBlockByHeight: jest.fn((height: number) => ({
    hash: 'realhash',
    header: {
      ...prevBlock.header,
      version: 1,
      height,
      previousHash: '0'.repeat(64),
      merkleRoot: '1'.repeat(64),
      difficulty: 1,
    },
    transactions: [],
    getHeaderBase: () => JSON.stringify(prevBlock.header),
  })),
  addBlock: jest.fn(async () => true),
  hasTransaction: jest.fn(async () => false),
  isUTXOSpent: jest.fn(async () => false),
  validateTransaction: jest.fn(async () => true),
  getValidatorCount: jest.fn(async () => 10),
};

const dummyMempool = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPendingTransactions: jest.fn(async () => [{} as any]),
  removeTransactions: jest.fn(),
  hasChanged: jest.fn(async () => false),
  getSize: jest.fn(() => 0),
};

const dummyWorker = {
  terminate: jest.fn(async () => Promise.resolve()),
};

const dummyWorkerPool = {
  getWorker: jest.fn(async () => dummyWorker),
  releaseWorker: jest.fn(() => {}),
};

// Dummy miner key pair
const dummyMinerKeyPair = { address: 'dummy-address' };

let pow: ProofOfWork;

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pow = new ProofOfWork(dummyBlockchain as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pow as any).mempool = dummyMempool;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pow as any).workerPool = dummyWorkerPool;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pow as any).minerKeyPair = dummyMinerKeyPair;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pow as any).ddosProtection = { checkRequest: jest.fn(() => true) };
});

jest.spyOn(Logger, 'error').mockImplementation(() => Logger);

describe('ProofOfWork', () => {
  it('calculateBlockHash returns correct hash', () => {
    const block = {
      header: {
        version: 1,
        previousHash: '0'.repeat(64),
        merkleRoot: '1'.repeat(64),
        timestamp: 1234567890,
        difficulty: 1,
        nonce: 42,
      },
      hash: '',
      transactions: [],
    };
    const expected = createHash('sha3-256')
      .update(
        JSON.stringify({
          version: 1,
          previousHash: '0'.repeat(64),
          merkleRoot: '1'.repeat(64),
          timestamp: 1234567890,
          difficulty: 1,
          nonce: 42,
        }),
      )
      .digest('hex');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calculated = pow.calculateBlockHash(block as any);
    expect(calculated).toBe(expected);
  });

  it('getTarget returns correct target', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const target = (pow as any).getTarget(1);
    expect(target).toBeDefined();
    expect(typeof target).toBe('bigint');
  });

  it('validateWork returns false if ddosProtection blocks request', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).ddosProtection = { checkRequest: jest.fn(() => false) };
    const result = await pow.validateWork('testdata', 1);
    expect(result).toBe(false);
  });

  it('generateCoinbaseScript returns correctly formatted script', async () => {
    // Force getCurrentHeight to 0 so blockHeight becomes 1
    dummyBlockchain.getCurrentHeight.mockReturnValue(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const script = await (pow as any).generateCoinbaseScript();
    expect(typeof script).toBe('string');
    // 8 chars for block height + 30 for miner tag hex (15*2) + 8 for extra nonce = 46
    expect(script.length).toBe(46);
  });

  it('createCoinbaseTransaction returns valid coinbase transaction', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = await (pow as any).createCoinbaseTransaction(BigInt(50));
    expect(tx.sender).toBe('coinbase');
    expect(tx.inputs.length).toBe(0);
    expect(tx.outputs.length).toBe(1);
    expect(tx.outputs[0].address).toBe(dummyMinerKeyPair.address);
  });

  it('getBlockTemplate returns a valid block template', async () => {
    // Override dependencies to simplify template creation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).createCoinbaseTransaction = jest.fn(async () => ({
      type: 'POW_REWARD',
      sender: 'coinbase',
      inputs: [],
      outputs: [
        {
          address: 'template-address',
          amount: BigInt(50),
          script: 'dummy-script',
          currency: { name: 'H3TAG', symbol: 'HTAG', decimals: 8 },
          index: 0,
          confirmations: 0,
        },
      ],
      timestamp: Date.now(),
      fee: BigInt(0),
      version: 1,
      status: 'pending',
      currency: { name: 'H3TAG', symbol: 'HTAG', decimals: 8 },
      id: 'dummy',
      hash: 'dummy',
      signature: 'dummy',
      recipient: 'template-address',
      verify: async () => true,
      toHex: () => '',
      getSize: () => 100,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).selectTransactions = jest.fn(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coinbase = await (pow as any).createCoinbaseTransaction(BigInt(50));
      return [coinbase];
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).merkleTree = {
      createRoot: jest.fn(async () => 'dummy-merkle-root'),
    };
    dummyBlockchain.getCurrentHeight.mockReturnValue(1);
    (dummyBlockchain.getLatestBlock as jest.Mock).mockReturnValue({
      hash: 'prevhash',
      header: {
        version: 1,
        height: 1,
        timestamp: Math.floor(Date.now() / 1000) - 100,
        previousHash: '0'.repeat(64),
        merkleRoot: 'dummy',
        difficulty: 1,
        nonce: 0,
      },
      transactions: [],
      getHeaderBase: () => '{"dummy":"base"}',
    });
    const template = await pow.getBlockTemplate('test-miner');
    expect(template).toHaveProperty('version');
    expect(template).toHaveProperty('height');
    expect(template).toHaveProperty('previousHash');
    expect(template).toHaveProperty('timestamp');
    expect(template).toHaveProperty('difficulty');
    expect(template).toHaveProperty('transactions');
    expect(template.transactions[0].outputs[0].address).toBe('test-miner');
    expect(template).toHaveProperty('merkleRoot');
    expect(template.merkleRoot).toBe('dummy-merkle-root');
    expect(template).toHaveProperty('target');
    expect(template).toHaveProperty('minTime');
    expect(template).toHaveProperty('maxTime');
  });

  it('mineBlock returns a mined block when mining strategy succeeds', async () => {
    const dummyBlock = {
      header: {
        version: 1,
        height: 2,
        timestamp: Math.floor(Date.now() / 1000),
        previousHash: 'prevhash',
        merkleRoot: 'dummy-merkle',
        difficulty: 1,
        nonce: 0,
        miner: 'dummy',
      },
      hash: '',
      transactions: [
        {
          type: 'POW_REWARD',
          sender: 'coinbase',
          inputs: [],
          outputs: [
            {
              address: dummyMinerKeyPair.address,
              amount: BigInt(50),
              script: 'dummy-script',
              currency: { name: 'H3TAG', symbol: 'HTAG', decimals: 8 },
              index: 0,
              confirmations: 0,
            },
          ],
          timestamp: Date.now(),
          fee: BigInt(0),
          version: 1,
          status: 'pending',
          currency: { name: 'H3TAG', symbol: 'HTAG', decimals: 8 },
          id: 'dummy',
          hash: 'dummy',
          signature: 'dummy',
          recipient: dummyMinerKeyPair.address,
          verify: async () => true,
          toHex: () => '',
          getSize: () => 100,
        },
      ],
    };
    // Override tryMiningStrategies to simulate successful mining
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).tryMiningStrategies = jest.fn(async (block) => {
      block.header.nonce = 123;
      block.hash = 'minedhash';
      return block;
    });
    // Override txSelectionLock to directly execute the callback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).txSelectionLock = {
      runExclusive: async (callback: () => Promise<void>) => callback(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const minedBlock = await pow.mineBlock(dummyBlock as any);
    expect(minedBlock.header.nonce).toBe(123);
    expect(minedBlock.hash).toBe('minedhash');
  });

  it('stopMining sets isMining to false and interrupts mining', () => {
    pow.stopMining();
    expect(pow.isMining).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((pow as any).isInterrupted).toBe(true);
  });

  it('interruptMining and resumeMining update the isInterrupted flag', () => {
    pow.interruptMining();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((pow as any).isInterrupted).toBe(true);
    pow.resumeMining();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((pow as any).isInterrupted).toBe(false);
  });

  it('on and off event listeners work', (done) => {
    const listener = jest.fn();
    pow.on('testEvent', listener);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).eventEmitter.emit('testEvent', { data: 123 });
    setTimeout(() => {
      expect(listener).toHaveBeenCalledWith({ data: 123 });
      pow.off('testEvent', listener);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pow as any).eventEmitter.emit('testEvent', { data: 456 });
      setTimeout(() => {
        expect(listener).toHaveBeenCalledTimes(1);
        done();
      }, 10);
    }, 10);
  });

  it('getInflightBlocks returns empty array when no blocks are in flight', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).blocksInFlight = new Map();
    const inflight = pow.getInflightBlocks();
    expect(inflight).toEqual([]);
  });

  it('updateDifficulty calls db.updateDifficulty', async () => {
    const dummyBlock = {
      hash: 'dummyhash',
      header: {
        difficulty: 1,
        height: 1,
        timestamp: Math.floor(Date.now() / 1000) - 100,
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).calculateNextDifficulty = jest.fn(async () => 2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).db = { updateDifficulty: jest.fn(async () => {}) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await pow.updateDifficulty(dummyBlock as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((pow as any).db.updateDifficulty).toHaveBeenCalledWith(
      'dummyhash',
      2,
    );
  });

  it('dispose cleans up workers and shuts down caches', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).workers = [{ terminate: jest.fn(async () => {}) }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).nonceCache = { shutdown: jest.fn(async () => {}) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).blockCache = { shutdown: jest.fn(async () => {}) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).eventEmitter = { removeAllListeners: jest.fn() };
    await pow.dispose();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((pow as any).workers.length).toBe(0);
  });
});

describe('Additional Coverage', () => {
  it('calculateClassicalHash returns expected hash', async () => {
    const testStr = 'hello';
    const expected = createHash('sha3-256')
      .update(Buffer.from(testStr))
      .digest('hex');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await (pow as any).calculateClassicalHash(testStr);
    expect(hash).toBe(expected);
  });

  it('getNetworkDifficulty returns min difficulty when no valid recent block', async () => {
    // Override db methods to simulate no valid recent block
    // eslint-disable-next-line @typescript-eslint/no-explicit-any  
    (pow as any).db.getCurrentHeight = jest.fn().mockResolvedValue(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).db.getBlockByHeight = jest.fn().mockResolvedValue(null);
    const difficulty = await pow.getNetworkDifficulty();
    expect(difficulty).toBe(pow.getMinDifficulty());
  });

  it('tryCPUMining returns a mined block when worker responds with result', async () => {
    const dummyBlock = {
      header: {
        nonce: 0,
        difficulty: 1,
        previousHash: '0'.repeat(64),
        merkleRoot: '1'.repeat(64),
        timestamp: 12345678,
      },
      getHeaderBase: () => 'dummyHeader',
      hash: '',
      transactions: [],
    };
    const dummyWorker = {
      once: jest.fn((event, cb) => {
        if (event === 'message') {
          cb({ found: true, nonce: 999, hash: 'dummyhash' });
        }
      }),
      postMessage: jest.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalGetWorker = (pow as any).workerPool.getWorker;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).workerPool.getWorker = jest
      .fn()
      .mockResolvedValue(dummyWorker);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (pow as any).tryCPUMining(dummyBlock);
    expect(result).not.toBeNull();
    expect(result.header.nonce).toBe(999);
    expect(result.hash).toBe('dummyhash');
    // Restore original function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).workerPool.getWorker = originalGetWorker;
  });

  it('tryParallelMining returns a mined block when worker responds with result', async () => {
    const dummyBlock = {
      header: {
        nonce: 0,
        difficulty: 1,
        previousHash: '0'.repeat(64),
        merkleRoot: '1'.repeat(64),
        timestamp: 12345678,
      },
      getHeaderBase: () => 'dummyHeader',
      hash: '',
      transactions: [],
    };
    const dummyWorker = {
      once: jest.fn((event, cb) => {
        if (event === 'message') {
          cb({ found: true, nonce: 888, hash: 'parallelhash' });
        }
      }),
      postMessage: jest.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalGetWorker = (pow as any).workerPool.getWorker;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).workerPool.getWorker = jest
      .fn()
      .mockResolvedValue(dummyWorker);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (pow as any).tryParallelMining(dummyBlock);
    expect(result).not.toBeNull();
    expect(result.header.nonce).toBe(888);
    expect(result.hash).toBe('parallelhash');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).workerPool.getWorker = originalGetWorker;
  });

  it('addInflightBlock and removeInflightBlock work correctly', () => {
    const dummyBlock = {
      header: {
        height: 100,
        nonce: 0,
        previousHash: '0'.repeat(64),
        merkleRoot: '1'.repeat(64),
        timestamp: Date.now(),
        difficulty: 1,
      },
      hash: 'dummyblockhash',
      transactions: [],
      getHeaderBase: () => 'dummyHeader',
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).addInflightBlock(dummyBlock);
    expect(pow.getInflightBlocks().length).toBeGreaterThan(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).removeInflightBlock(dummyBlock.header.height);
    expect(pow.getInflightBlocks().length).toBe(0);
  });

  it('validateBlockMerkleRoot returns true for valid merkle root', async () => {
    const dummyTx = { hash: 'txhash1' };
    const dummyBlock = {
      header: {
        merkleRoot: '',
        timestamp: Date.now(),
        nonce: 0,
        previousHash: '0'.repeat(64),
        difficulty: 1,
      },
      transactions: [dummyTx],
    };
    const merkleTree = new MerkleTree();
    const computedRoot = await merkleTree.createRoot([dummyTx.hash]);
    dummyBlock.header.merkleRoot = computedRoot;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isValid = await (pow as any).validateBlockMerkleRoot(dummyBlock);
    expect(isValid).toBe(true);
  });

  it('getBlock throws error when block data is not found', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).db.get = jest.fn().mockResolvedValue(null);
    await expect(pow.getBlock(999)).rejects.toThrow(
      'Block at height 999 not found',
    );
  });

  it('validateBlockHeader returns true for a valid block header', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const prevBlock = {
      header: { 
        hash: 'prevhash',
        timestamp: currentTime - 600,
        nonce: 1,
        version: BLOCKCHAIN_CONSTANTS.MINING.CURRENT_VERSION,
        height: 1,
        previousHash: '0'.repeat(64),
        merkleRoot: '1'.repeat(64),
        difficulty: pow.getMinDifficulty()
      },
      hash: 'prevhash',
      transactions: [],
      getHeaderBase: () => 'prevheader'
    };

    const originalGetBlockByHeight = dummyBlockchain.getBlockByHeight;
    dummyBlockchain.getBlockByHeight = jest.fn().mockResolvedValue(prevBlock);

    const validBlock = {
      header: {
        version: BLOCKCHAIN_CONSTANTS.MINING.CURRENT_VERSION,
        height: 2,
        timestamp: currentTime,
        previousHash: 'prevhash',
        merkleRoot: '1'.repeat(64),
        difficulty: pow.getMinDifficulty()
      },
      hash: '0'.repeat(64),
      transactions: [{ hash: 'tx1', inputs: [], outputs: [] }],
      getHeaderBase: () => 'headerbase'
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isValid = await (pow as any).validateBlockHeader(validBlock);
    expect(isValid).toBe(true);
    dummyBlockchain.getBlockByHeight = originalGetBlockByHeight;
  });
});

describe('ProofOfWork - Extra Coverage', () => {
  // Test validateWork with out-of-range difficulty
  it('validateWork returns false for out-of-range difficulty', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).ddosProtection = { checkRequest: jest.fn(() => true) };
    const minDiff = BLOCKCHAIN_CONSTANTS.MINING.MIN_DIFFICULTY;
    const maxDiff = BLOCKCHAIN_CONSTANTS.MINING.MAX_DIFFICULTY;
    const resultLow = await pow.validateWork('testdata', minDiff - 1);
    const resultHigh = await pow.validateWork('testdata', maxDiff + 1);
    expect(resultLow).toBe(false);
    expect(resultHigh).toBe(false);
  });

  // Test getMinDifficulty and getMaxDifficulty
  it('getMinDifficulty and getMaxDifficulty return numbers', () => {
    expect(typeof pow.getMinDifficulty()).toBe('number');
    expect(typeof pow.getMaxDifficulty()).toBe('number');
  });

  // Test validateBlock fails if block hash does not match computed hash
  it('validateBlock fails if block hash does not match computed hash', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validBlock = dummyBlockchain.getLatestBlock() as any;
    // Tamper with block.hash
    validBlock.hash = '0'.repeat(64);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isValid = await pow.validateBlock(validBlock as any);
    expect(isValid).toBe(false);
  });

  // Test validateBlock fails if block structure is invalid
  it('validateBlock fails if block structure is invalid', async () => {
    const invalidBlock = {
      header: {
        version: 1,
        height: 1,
        timestamp: 12345,
        previousHash: '0'.repeat(64),
        merkleRoot: '1'.repeat(64),
        difficulty: 1,
        nonce: 0,
      },
      hash: '0'.repeat(64), // Valid hash format
      transactions: [],
      getHeaderBase: () => JSON.stringify({
        version: 1,
        previousHash: '0'.repeat(64),
        merkleRoot: '1'.repeat(64),
        timestamp: 12345,
        difficulty: 1,
        nonce: 0
      })
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isValid = await pow.validateBlock(invalidBlock as any);
    expect(isValid).toBe(false);
  });

  // Test validateBlock fails if block hash does not meet difficulty target
  it('validateBlock fails if block hash does not meet difficulty target', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validBlock = dummyBlockchain.getLatestBlock() as any;
    // Set block.hash to a high value
    validBlock.hash = 'f'.repeat(64);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isValid = await pow.validateBlock(validBlock as any);
    expect(isValid).toBe(false);
  });

  // Test validateBlockHeader returns false for invalid version
  it('validateBlockHeader returns false for invalid version', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const block = dummyBlockchain.getLatestBlock() as any;
    block.header.version = BLOCKCHAIN_CONSTANTS.MINING.MIN_VERSION - 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isValid = await (pow as any).validateBlockHeader(block);
    expect(isValid).toBe(false);
  });

  // Test validateBlockHeader returns false when previous block hash mismatches
  it('validateBlockHeader returns false when previous block hash mismatches', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const block = dummyBlockchain.getLatestBlock() as any;
    block.header.height = 1;
    block.header.previousHash = 'invalid';
    const originalGetBlockByHeight = dummyBlockchain.getBlockByHeight;
     
    dummyBlockchain.getBlockByHeight = jest.fn(
      (height: number) =>
        ({
          hash: 'realhash',
          header: block.header,
          transactions: [],
          height: height,
          getHeaderBase: () => JSON.stringify(block.header),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isValid = await (pow as any).validateBlockHeader(block);
    expect(isValid).toBe(false);
    dummyBlockchain.getBlockByHeight = originalGetBlockByHeight;
  });

  // Test submitBlock throws error when block hash does not meet target
  it('submitBlock throws error when block hash does not meet target', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const block = dummyBlockchain.getLatestBlock() as any;
    block.hash = 'f'.repeat(64);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).meetsTarget = jest.fn(() => false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(pow.submitBlock(block as any)).rejects.toThrow(
      'Block hash does not meet target difficulty',
    );
  });

  // Test successful submitBlock
  it('submitBlock successfully submits a valid block', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const block = dummyBlockchain.getLatestBlock() as any;
    block.header.target = '1'.repeat(64);  // Set a valid target
    block.hash = '0'.repeat(64);  // Set a valid hash that will meet any target
    block.transactions = [
      {
        type: 'POW_REWARD',
        sender: 'coinbase',
        inputs: [],
        outputs: [
          {
            address: dummyMinerKeyPair.address,
            amount: BigInt(50),
            script: 'a'.repeat(46),
            currency: { name: 'H3TAG', symbol: 'HTAG', decimals: 8 },
            index: 0,
            confirmations: 0,
          },
        ],
        timestamp: Date.now(),
        fee: BigInt(0),
        version: 1,
        status: 'pending',
        currency: { name: 'H3TAG', symbol: 'HTAG', decimals: 8 },
        id: 'dummy',
        hash: 'dummy',
        signature: 'dummy',
        recipient: dummyMinerKeyPair.address,
        verify: async () => true,
        toHex: () => '',
        getSize: () => 100,
      },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).validateBlockHeader = jest.fn(async () => true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).verifyCoinbaseTransaction = jest.fn(async () => true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).validateTemplateTransaction = jest.fn(async () => true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).merkleTree = new MerkleTree();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any  
    (pow as any).merkleTree.createRoot = jest.fn(async () => block.header.merkleRoot);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).meetsTarget = jest.fn(() => true);  // Mock meetsTarget to return true
     
    dummyBlockchain.addBlock = jest.fn(async () => true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(pow.submitBlock(block as any)).resolves.toBe(true);
  });

  // Test tryParallelMining returns null when no result is found
  it('tryParallelMining returns null when no mining result found', async () => {
    const dummyWorker = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      once: (event: string, cb: (msg: any) => void) => {
        if (event === 'message') {
          cb({ found: false });
        }
      },
      postMessage: jest.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).workerPool.getWorker = jest
      .fn()
      .mockResolvedValue(dummyWorker);
    const dummyBlock = {
      header: {
        nonce: 0,
        difficulty: 1,
        previousHash: '0'.repeat(64),
        merkleRoot: '1'.repeat(64),
        timestamp: 12345678,
      },
      getHeaderBase: () => 'headerBase',
      hash: '',
      transactions: [],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (pow as any).tryParallelMining(dummyBlock);
    expect(result).toBeNull();
  });

  // Test tryCPUMining returns null when no result is found
  it('tryCPUMining returns null when no mining result found', async () => {
    const dummyWorker = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      once: (event: string, cb: (msg: any) => void) => {
        if (event === 'message') {
          cb({ found: false });
        }
      },
      postMessage: jest.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).workerPool.getWorker = jest
      .fn()
      .mockResolvedValue(dummyWorker);
    const dummyBlock = {
      header: {
        nonce: 0,
        difficulty: 1,
        previousHash: '0'.repeat(64),
        merkleRoot: '1'.repeat(64),
        timestamp: 12345678,
      },
      getHeaderBase: () => 'headerBase',
      hash: '',
      transactions: [],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (pow as any).tryCPUMining(dummyBlock);
    expect(result).toBeNull();
  });

  // Test block inflight timeout handling
  it('handles block timeout and emits blockFailed event', (done) => {
    // Set a small BLOCK_TIMEOUT for testing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).BLOCK_TIMEOUT = 10;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const block = dummyBlockchain.getLatestBlock() as any;
    block.header.height = 999;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).addInflightBlock(block);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pow.on('blockFailed', (data: any) => {
      try {
        expect(data.height).toBe(999);
        expect(data.attempts).toBeGreaterThanOrEqual(1);
        pow.off('blockFailed', () => {});
        done();
      } catch (err) {
        done(err);
      }
    });
  });

  // Test removeInflightBlock with non-existent block
  it('removeInflightBlock does not error on non-existent block', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pow as any).removeInflightBlock(12345);
    }).not.toThrow();
  });

  // Test getGPUStatus under various conditions
  it('getGPUStatus returns correct status', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any  
    (pow as any).gpuMiner = undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((pow as any).getGPUStatus()).toBe('Not Available');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).gpuMiner = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).gpuCircuitBreaker = { isOpen: () => true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((pow as any).getGPUStatus()).toBe('Circuit Breaker Open');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pow as any).gpuCircuitBreaker = { isOpen: () => false };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((pow as any).getGPUStatus()).toBe('Active');
  });

  // Test selectTransactions selects valid transactions and skips oversized ones
  it('selectTransactions selects valid transactions and skips oversized ones', async () => {
    const coinbase = {
      type: 'POW_REWARD',
      sender: 'coinbase',
      inputs: [],
      outputs: [
        {
          address: dummyMinerKeyPair.address,
          amount: BigInt(50),
          script: 'a'.repeat(46),
          currency: { name: 'H3TAG', symbol: 'HTAG', decimals: 8 },
          index: 0,
          confirmations: 0,
        },
      ],
      timestamp: Date.now(),
      fee: BigInt(0),
      version: 1,
      status: 'pending',
      currency: { name: 'H3TAG', symbol: 'HTAG', decimals: 8 },
      id: 'dummy',
      hash: 'dummy_coinbase',
      signature: 'dummy',
      recipient: dummyMinerKeyPair.address,
      verify: async () => true,
      toHex: () => '',
      getSize: () => 100,
      toJSON: function() {
        return {
          ...this,
          fee: Number(this.fee),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          outputs: this.outputs.map((out: any) => ({
            ...out,
            amount: Number(out.amount)
          }))
        };
      }
    };
    const validTx = {
      type: 'PAYMENT',
      sender: 'A',
      inputs: [],
      outputs: [
        {
          address: 'B',
          amount: BigInt(10),
          script: 'script',
          currency: { name: 'H3TAG', symbol: 'HTAG', decimals: 8 },
          index: 0,
          confirmations: 0,
        },
      ],
      timestamp: Date.now(),
      fee: BigInt(1),
      version: 1,
      status: 'pending',
      currency: { name: 'H3TAG', symbol: 'HTAG', decimals: 8 },
      id: 'tx1',
      hash: 'txhash1',
      signature: 'sig',
      recipient: 'B',
      verify: async () => true,
      toHex: () => '',
      getSize: () => 100,
      toJSON: function() {
        return {
          ...this,
          fee: Number(this.fee),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          outputs: this.outputs.map((out: any) => ({
            ...out,
            amount: Number(out.amount)
          }))
        };
      }
    };
    const oversizedTx = {
      ...validTx,
      id: 'tx2',
      hash: 'txhash2',
      extra: 'x'.repeat(BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIZE),
      toJSON: function() {
        return {
          ...this,
          fee: Number(this.fee),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          outputs: this.outputs.map((out: any) => ({
            ...out,
            amount: Number(out.amount)
          }))
        };
      }
    };
    dummyBlockchain.hasTransaction = jest.fn(async () => false);
    dummyBlockchain.validateTransaction = jest.fn(async () => true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selected = await (pow as any).selectTransactions(
      [validTx, oversizedTx],
      10000,
      coinbase,
    );
    expect(selected.length).toBe(2);
  });

  // Test validateTemplateTransaction for oversized and invalid signature
  it('validateTemplateTransaction returns false for oversized transaction or invalid signature', async () => {
    const txOversized = {
      type: 'PAYMENT',
      sender: 'A',
      inputs: [],
      outputs: [
        {
          address: 'B',
          amount: BigInt(10),
          script: 'script',
          currency: { name: 'H3TAG', symbol: 'HTAG', decimals: 8 },
          index: 0,
          confirmations: 0,
        },
      ],
      timestamp: Date.now(),
      fee: BigInt(1),
      version: 1,
      status: 'pending',
      currency: { name: 'H3TAG', symbol: 'HTAG', decimals: 8 },
      id: 'tx3',
      hash: 'txhash3',
      signature: 'sig',
      recipient: 'B',
      verify: async () => true,
      toHex: () => '',
      getSize: () => BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIZE + 1,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultOversized = await (pow as any).validateTemplateTransaction(
      txOversized,
    );
    expect(resultOversized).toBe(false);
    const txInvalidSig = { ...txOversized, getSize: () => 100 };
    txInvalidSig.verify = async () => false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultInvalid = await (pow as any).validateTemplateTransaction(
      txInvalidSig,
    );
    expect(resultInvalid).toBe(false);
  });

  // Test verifyCoinbaseTransaction returns false for invalid coinbase tx
  it('verifyCoinbaseTransaction returns false for invalid coinbase transaction', async () => {
    const invalidCoinbase = {
      type: 'POW_REWARD',
      sender: 'coinbase',
      inputs: [],
      outputs: [],
      timestamp: Date.now(),
      fee: BigInt(0),
      version: 1,
      status: 'pending',
      currency: { name: 'H3TAG', symbol: 'HTAG', decimals: 8 },
      id: 'dummy',
      hash: 'dummy',
      signature: 'dummy',
      recipient: dummyMinerKeyPair.address,
      verify: async () => true,
      toHex: () => '',
      getSize: () => 100,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (pow as any).verifyCoinbaseTransaction(
      invalidCoinbase,
    );
    expect(result).toBe(false);
  });

  // Test startMining handles failures and stops mining after stopMining is called
  it('startMining handles failures and stops mining after stopMining is called', async () => {
    // Mock createAndMineBlock to throw an error
    jest.spyOn(pow, 'createAndMineBlock').mockImplementation(async () => {
      pow.isMining = true; // Ensure mining is started
      throw new Error('Test error');
    });
    
    // Start mining in background
    const miningPromise = pow.startMining();
    
    // Wait for mining to start
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Stop mining
    pow.stopMining();
    
    // Wait for mining to complete and verify error
    await expect(miningPromise).resolves.toBeUndefined();
    expect(pow.isMining).toBe(false);
  }, 30000);

  // Test getMiningInfo returns a valid mining info object
  it('getMiningInfo returns a valid mining info object', async () => {
    dummyMempool.getPendingTransactions.mockResolvedValue([{}]);
    dummyMempool.getSize.mockReturnValue(1);
    dummyBlockchain.getValidatorCount.mockResolvedValue(10);
    const info = await pow.getMiningInfo();
    expect(info).toHaveProperty('powEnabled');
    expect(info).toHaveProperty('mining');
    expect(info).toHaveProperty('hashRate');
    expect(info).toHaveProperty('difficulty');
    expect(info).toHaveProperty('networkHashRate');
    expect(info).toHaveProperty('blockHeight');
    expect(info).toHaveProperty('lastBlockTime');
    expect(info).toHaveProperty('workers');
    expect(info).toHaveProperty('hardware');
    expect(info).toHaveProperty('mempool');
    expect(info).toHaveProperty('performance');
    expect(info).toHaveProperty('network');
  });

  // Test getNetworkHashPS with insufficient recent blocks
  it('getNetworkHashPS estimates hash rate when insufficient blocks', async () => {
    // Add type assertion to bypass the type check
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(pow as any, 'getRecentBlocks')
      .mockResolvedValueOnce([dummyBlockchain.getLatestBlock()]);
    const hashPS = await pow.getNetworkHashPS(5, -1);
    expect(typeof hashPS).toBe('number');
  });
});

afterEach(async () => {
  // Dispose the ProofOfWork instance to clear any open handles
  await pow.dispose();
});

afterAll(() => {
  // Clear the healthCheckInterval from QuantumNative if it exists
  if (QuantumNative?.getInstance) {
    const quantumInstance = QuantumNative.getInstance();
    if (quantumInstance?.healthCheckInterval) {
      clearInterval(quantumInstance.healthCheckInterval);
    }
  }
  jest.clearAllTimers();
});
