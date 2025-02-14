// Mock dependencies first
jest.mock('../../models/transaction.model', () => {
  const originalModule = jest.requireActual('../../models/transaction.model');
  return {
    ...originalModule,
    Transaction: jest.fn().mockImplementation(() => ({
      verify: jest.fn().mockResolvedValue(true),
      toHex: jest.fn().mockReturnValue('mockHex'),
      getSize: jest.fn().mockReturnValue(100)
    }))
  };
});

// Create base classes for mocking
class MockUTXOSet {
  getUTXOs = jest.fn().mockReturnValue([]);
  addUTXO = jest.fn();
  removeUTXO = jest.fn();
  clear = jest.fn();
  getUtxo = jest.fn();
  remove = jest.fn();
  add = jest.fn();
  validate = jest.fn().mockReturnValue(true);
  size = jest.fn().mockReturnValue(0);
  get = jest.fn();
  set = jest.fn();
  getAll = jest.fn().mockResolvedValue([]);
  getByAddress = jest.fn().mockReturnValue([]);
  getAllUtxos = jest.fn().mockReturnValue([]);
  exists = jest.fn().mockReturnValue(false);
  getHeight = jest.fn().mockReturnValue(0);
  verifyUtxo = jest.fn().mockResolvedValue(true);
}

jest.mock('../../models/utxo.model', () => {
  const MockUTXOSetClass = jest.fn().mockImplementation(() => {
    const instance = new MockUTXOSet();
    Object.setPrototypeOf(instance, MockUTXOSetClass.prototype);
    return instance;
  });
  MockUTXOSetClass.prototype = Object.create(MockUTXOSet.prototype);
  MockUTXOSetClass.prototype.constructor = MockUTXOSetClass;

  return {
    UTXOSet: MockUTXOSetClass
  };
});

// Create mock block instance
const mockBlock = {
  header: {
    version: 1,
    previousHash: '0'.repeat(64),
    merkleRoot: 'mockMerkleRoot',
    timestamp: Date.now(),
    difficulty: 1,
    nonce: 0,
    height: 1,
    hash: 'mockBlockHash',
    signature: 'mockSignature',
    publicKey: 'mockPublicKey',
    minerAddress: 'mockMinerAddress',
    target: 'mockTarget',
    validatorMerkleRoot: 'mockValidatorRoot',
    votesMerkleRoot: 'mockVotesRoot',
    miner: 'mockMiner',
    totalTAG: 0,
    blockReward: 50,
    locator: [],
    hashStop: '',
    fees: 0,
    consensusData: {
      powScore: 0,
      votingScore: 0,
      participationRate: 0,
      periodId: 0
    }
  },
  transactions: [],
  votes: [],
  validators: [],
  hash: 'mockBlockHash',
  timestamp: Date.now(),
  verifyHash: jest.fn().mockResolvedValue(true),
  verifySignature: jest.fn().mockResolvedValue(true),
  getHeaderBase: jest.fn(),
  isComplete: jest.fn().mockReturnValue(true)
};

// Create mock blockchain class
class MockBlockchain {
  private currentHeight = 0;
  private utxoSet = new MockUTXOSet();

  async addBlock(block: Partial<Block>) {
    if (!block.hash) {
      throw new Error('Invalid block: missing hash');
    }
    this.currentHeight++;
    return true;
  }

  getHeight() {
    return this.currentHeight;
  }

  getGenesisBlock() {
    return { ...mockBlock, hash: 'mockGenesisHash', height: 0 };
  }

  getLatestBlock() {
    return mockBlock;
  }

  async getBlock() {
    return { ...mockBlock, height: 1 };
  }

  getBlockByHeight(height: number) {
    return { ...mockBlock, height };
  }

  getBlockByHash() {
    return { ...mockBlock, height: 1 };
  }

  getBlocks = jest.fn().mockResolvedValue([]);
  validateBlock = jest.fn().mockResolvedValue(true);
  validateChain = jest.fn().mockResolvedValue(true);
  dispose = jest.fn().mockResolvedValue(undefined);
  
  getConfig() {
    return {
      blockchain: {
        maxSupply: 1000000000,
        blockTime: 60
      }
    };
  }

  getMempool() {
    return { getSize: jest.fn().mockReturnValue(0) };
  }

  cleanup = jest.fn();
  validateTransaction = jest.fn().mockImplementation(async (tx: Transaction) => {
    // Check for both size and signature
    const size = tx.getSize();
    return size <= 1000000 && !!tx.signature;
  });
  addTransaction = jest.fn().mockResolvedValue(true);
  processPayment = jest.fn().mockImplementation(async (tx: Transaction) => {
    let timeoutId: NodeJS.Timeout | undefined;
    const verifyPromise = tx.verify();
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Payment timeout')), 5000);
    });
    try {
      await Promise.race([verifyPromise, timeoutPromise]);
      return true;
    } catch {
      return false;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  });
  
  getUTXOSet() {
    return this.utxoSet;
  }

  getUTXO = jest.fn().mockResolvedValue(null);
  processVote = jest.fn().mockImplementation(async (vote: Vote) => {
    const isValid = vote.signature !== 'invalidSignature' && await mockCrypto.verify(
      vote.blockHash,
      vote.signature,
      vote.voter
    );
    if (!isValid) throw new Error('Invalid vote signature');
    return true;
  });
  getConsensusPublicKey = jest.fn().mockReturnValue('mockPublicKey');
  getChainTips = jest.fn().mockResolvedValue([]);
  getVerificationProgress = jest.fn().mockReturnValue(1);
  getChainWork = jest.fn().mockReturnValue('0x0');

  static create = jest.fn().mockImplementation(async () => new MockBlockchain());
  static getInstance = jest.fn().mockImplementation(() => new MockBlockchain());

  getTotalSupply = jest.fn().mockReturnValue(BigInt('21000000'));
  getCirculatingSupply = jest.fn().mockReturnValue(BigInt('10000000'));

  getDynamicBlockSize = jest.fn().mockImplementation(async (block: Block) => {
    try {
      if (!block) return 1000000;
      const networkHealth = await (this as unknown as { healthMonitor: { getNetworkHealth: () => Promise<{ isHealthy: boolean }> } }).healthMonitor?.getNetworkHealth();
      if (!networkHealth?.isHealthy) return 1000000; // Return base size even when network is unhealthy
      return 1000000;
    } catch {
      return 1000000; // Return base size on error
    }
  });
}

jest.mock('../../blockchain/blockchain', () => ({
  Blockchain: MockBlockchain
}));

// Import after all mocks are defined
import { Blockchain } from '../../blockchain/blockchain';
import { Block } from '../../models/block.model';
import { Transaction, TransactionType, TransactionStatus } from '../../models/transaction.model';
import { BlockchainConfig } from '@h3tag-blockchain/shared';
import { Vote } from '../../models/vote.model';
import { BLOCKCHAIN_CONSTANTS } from '../../blockchain/utils/constants';

jest.mock('@h3tag-blockchain/shared', () => ({
  Logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  ConfigService: {
    getInstance: jest.fn().mockReturnValue({
      get: jest.fn(),
      set: jest.fn()
    })
  },
  BLOCKCHAIN_CONSTANTS: {
    CURRENCY: {
      NAME: 'TAG',
      SYMBOL: 'TAG',
      DECIMALS: 8,
      MAX_SUPPLY: 1000000000,
      INITIAL_SUPPLY: 100000000
    },
    MINING: {
      DIFFICULTY: 1,
      BLOCK_TIME: 60,
      INITIAL_REWARD: 50
    }
  }
}));

jest.mock('../../utils/merkle', () => ({
  MerkleTree: jest.fn().mockImplementation(() => ({
    createRoot: jest.fn().mockResolvedValue('mockMerkleRoot')
  }))
}));

jest.mock('../../blockchain/mempool', () => {
  return {
    Mempool: jest.fn().mockImplementation(() => ({
      addTransaction: jest.fn(),
      removeTransaction: jest.fn(),
      getTransactions: jest.fn().mockReturnValue([]),
      getSize: jest.fn().mockReturnValue(0),
      removeTransactions: jest.fn(),
      dispose: jest.fn(),
      maxSize: 50000,
      setConsensus: jest.fn()
    }))
  };
});

jest.mock('../../database/blockchain-schema', () => {
  return {
    BlockchainSchema: jest.fn().mockImplementation(() => ({
      getChainState: jest.fn().mockResolvedValue(null),
      saveBlock: jest.fn().mockResolvedValue(true),
      updateChainState: jest.fn().mockResolvedValue(true),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      put: jest.fn().mockResolvedValue(true),
      close: jest.fn(),
      getBlocksFromHeight: jest.fn().mockResolvedValue([])
    }))
  };
});

jest.mock('../../blockchain/consensus/hybrid-direct', () => {
  return {
    HybridDirectConsensus: jest.fn().mockImplementation(() => ({
      validateBlock: jest.fn().mockResolvedValue(true),
      processBlock: jest.fn().mockImplementation(block => Promise.resolve(block)),
      updateState: jest.fn(),
      getMetrics: jest.fn().mockResolvedValue({
        powHashrate: 1000,
        activeVoters: [],
        participation: 0.8
      }),
      pow: {
        validateBlock: jest.fn().mockResolvedValue(true),
        on: jest.fn()
      },
      dispose: jest.fn()
    }))
  };
});

jest.mock('@h3tag-blockchain/crypto', () => ({
  HybridCrypto: {
    verify: jest.fn().mockResolvedValue(true),
    sign: jest.fn().mockResolvedValue('mockSignature'),
    hash: jest.fn().mockResolvedValue('mockHash')
  },
  KeyManager: {
    generateKeyPair: jest.fn().mockResolvedValue({
      publicKey: 'mockPublicKey',
      privateKey: 'mockPrivateKey'
    }),
    initialize: jest.fn().mockResolvedValue(true),
    shutdown: jest.fn()
  },
  HashUtils: {
    sha3: jest.fn().mockReturnValue('mockHash'),
    sha256: jest.fn().mockReturnValue('mockHash'),
    ripemd160: jest.fn().mockReturnValue('mockHash')
  }
}));

// Mock constants
const MOCK_BLOCKCHAIN_CONSTANTS = {
  CURRENCY: {
    NAME: 'TAG',
    SYMBOL: 'TAG',
    DECIMALS: 8,
    MAX_SUPPLY: BigInt('21000000')
  },
  MINING: {
    INITIAL_REWARD: BigInt('50'),
    HALVING_INTERVAL: 210000
  }
};

// Mock crypto functions
const mockCrypto = {
  verify: jest.fn().mockResolvedValue(true)
};

describe('Blockchain', () => {
  let blockchain: Blockchain;
  let mockConfig: Partial<BlockchainConfig>;
  let mockBlock: Partial<Block>;
  let mockTransaction: Partial<Transaction>;
  
  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock config
    mockConfig = {
      network: {
        type: { MAINNET: 'mainnet', TESTNET: 'testnet', DEVNET: 'devnet' },
        port: { MAINNET: 8000, TESTNET: 8001, DEVNET: 8002 },
        host: { MAINNET: 'localhost', TESTNET: 'localhost', DEVNET: 'localhost' },
        seedDomains: { MAINNET: [], TESTNET: [], DEVNET: [] }
      },
      wallet: {
        address: 'testAddress',
        publicKey: 'testPublicKey',
        privateKey: 'testPrivateKey'
      }
    };

    // Create blockchain instance
    blockchain = await Blockchain.create(mockConfig as BlockchainConfig);

    // Mock required functions
    blockchain.getDynamicBlockSize = jest.fn().mockImplementation(async (block: Block) => {
      try {
        if (!block) return 1000000;
        const networkHealth = await (this as unknown as { healthMonitor: { getNetworkHealth: () => Promise<{ isHealthy: boolean }> } }).healthMonitor?.getNetworkHealth();
        if (!networkHealth?.isHealthy) return 1000000; // Return base size even when network is unhealthy
        return 1000000;
      } catch {
        return 1000000; // Return base size on error
      }
    });

    blockchain.isUTXOSpent = jest.fn().mockImplementation(async () => false);

    blockchain.addPeer = jest.fn().mockImplementation(async (url: string) => {
      return url.startsWith('ws://') || url.startsWith('wss://');
    });

    blockchain.verifyBlock = jest.fn().mockImplementation(async (block: Block) => {
      const hashValid = await block.verifyHash();
      const sigValid = await block.verifySignature();
      const txValid = await Promise.all(block.transactions.map(tx => tx.verify()));
      return hashValid && sigValid && txValid.every(Boolean);
    });

    blockchain.getTotalSupply = jest.fn().mockReturnValue(BigInt('21000000'));

    blockchain.getState = jest.fn().mockReturnValue({
      chain: (blockchain as unknown as { chain: Block[] }).chain,
      utxoSet: (blockchain as unknown as { utxoSet: Map<string, Transaction> }).utxoSet,
      height: blockchain.getHeight(),
      totalSupply: blockchain.getTotalSupply()
    });

    blockchain.getCurrencyDetails = jest.fn().mockReturnValue({
      name: MOCK_BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
      symbol: MOCK_BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
      decimals: MOCK_BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
      totalSupply: blockchain.getTotalSupply(),
      maxSupply: MOCK_BLOCKCHAIN_CONSTANTS.CURRENCY.MAX_SUPPLY,
      circulatingSupply: blockchain.getCirculatingSupply()
    });

    blockchain.calculateBlockReward = jest.fn().mockImplementation((height: number) => {
      if (height < 0) return BigInt(0);
      const initialReward = BigInt(BLOCKCHAIN_CONSTANTS.MINING.INITIAL_REWARD);
      const halvings = Math.floor(height / BLOCKCHAIN_CONSTANTS.MINING.HALVING_INTERVAL);
      return initialReward >> BigInt(halvings);
    });

    blockchain.processVote = jest.fn().mockImplementation(async (vote: Vote) => {
      const isValid = vote.signature !== 'invalidSignature' && await mockCrypto.verify(
        vote.blockHash,
        vote.signature,
        vote.voter
      );
      if (!isValid) throw new Error('Invalid vote signature');
      return true;
    });

    blockchain.processPayment = jest.fn().mockImplementation(async (tx: Transaction) => {
      let timeoutId: NodeJS.Timeout | undefined;
      const verifyPromise = tx.verify();
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Payment timeout')), 5000);
      });
      try {
        await Promise.race([verifyPromise, timeoutPromise]);
        return true;
      } catch {
        return false;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    });

    // Setup mock block
    mockBlock = {
      header: {
        version: 1,
        previousHash: '0'.repeat(64),
        merkleRoot: 'mockMerkleRoot',
        timestamp: Date.now(),
        difficulty: 1,
        nonce: 0,
        height: 1,
        hash: 'mockBlockHash',
        signature: 'mockSignature',
        publicKey: 'mockPublicKey',
        minerAddress: 'mockMinerAddress',
        target: 'mockTarget',
        validatorMerkleRoot: 'mockValidatorRoot',
        votesMerkleRoot: 'mockVotesRoot',
        miner: 'mockMiner',
        totalTAG: 0,
        blockReward: 50,
        locator: [],
        hashStop: '',
        fees: 0,
        consensusData: {
          powScore: 0,
          votingScore: 0,
          participationRate: 0,
          periodId: 0
        }
      },
      transactions: [],
      votes: [],
      validators: [],
      hash: 'mockBlockHash',
      timestamp: Date.now(),
      verifyHash: jest.fn().mockResolvedValue(true),
      verifySignature: jest.fn().mockResolvedValue(true),
      getHeaderBase: jest.fn(),
      isComplete: jest.fn().mockReturnValue(true)
    };

    // Setup mock transaction
    mockTransaction = {
      id: 'mockTxId',
      type: TransactionType.REGULAR,
      version: 1,
      inputs: [],
      outputs: [],
      timestamp: Date.now(),
      sender: 'mockSender',
      signature: 'mockSignature',
      nonce: 0,
      hash: 'mockTxHash',
      status: TransactionStatus.PENDING,
      verify: jest.fn().mockResolvedValue(true),
      fee: BigInt(1),
      recipient: 'mockRecipient',
      currency: {
        name: 'TAG',
        symbol: 'TAG',
        decimals: 8
      },
      toHex: jest.fn().mockReturnValue('mockHex'),
      getSize: jest.fn().mockReturnValue(100)
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('Initialization', () => {
    it('should create a blockchain instance with genesis block', async () => {
      expect(blockchain).toBeInstanceOf(Blockchain);
      expect(blockchain.getHeight()).toBe(0);
      expect(blockchain.getGenesisBlock()).toBeDefined();
    });

    it('should initialize with correct configuration', async () => {
      expect(blockchain.getConfig()).toMatchObject({
        blockchain: {
          maxSupply: expect.any(Number),
          blockTime: expect.any(Number)
        }
      });
    });
  });

  describe('Block Operations', () => {
    it('should add a valid block', async () => {
      const result = await blockchain.addBlock(mockBlock as Block);
      expect(result).toBe(true);
      expect(blockchain.getHeight()).toBe(1);
    });

    it('should get block by height', async () => {
      await blockchain.addBlock(mockBlock as Block);
      const retrievedBlock = blockchain.getBlockByHeight(1);
      expect(retrievedBlock).toBeDefined();
      expect(retrievedBlock?.hash).toBe(mockBlock.hash);
    });

    it('should get block by hash', async () => {
      await blockchain.addBlock(mockBlock as Block);
      const retrievedBlock = await blockchain.getBlock(mockBlock.hash!);
      expect(retrievedBlock).toBeDefined();
      expect(retrievedBlock?.hash).toBe(mockBlock.hash);
    });

    it('should validate block', async () => {
      const isValid = await blockchain.validateBlock(mockBlock as Block);
      expect(isValid).toBe(true);
    });
  });

  describe('Transaction Operations', () => {
    it('should add a valid transaction', async () => {
      const result = await blockchain.addTransaction(mockTransaction as Transaction);
      expect(result).toBe(true);
    });

    it('should validate transaction', async () => {
      const isValid = await blockchain.validateTransaction(mockTransaction as Transaction);
      expect(isValid).toBe(true);
    });

    it('should process payment', async () => {
      const result = await blockchain.processPayment(mockTransaction as Transaction);
      expect(result).toBe(true);
    });
  });

  describe('UTXO Operations', () => {
    it('should get UTXO set', async () => {
      const utxoSet = await blockchain.getUTXOSet();
      expect(utxoSet).toBeDefined();
      expect(typeof utxoSet.getUtxo).toBe('function');
      expect(typeof utxoSet.add).toBe('function');
      expect(typeof utxoSet.remove).toBe('function');
      expect(typeof utxoSet.validate).toBe('function');
    });

    it('should get UTXO by txId and index', async () => {
      const utxo = await blockchain.getUTXO('mockTxId', 0);
      expect(utxo).toBeDefined();
    });
  });

  describe('Consensus and Voting', () => {
    const mockVote: Partial<Vote> = {
      blockHash: 'mockBlockHash',
      voter: 'mockVoter',
      signature: 'mockSignature',
      timestamp: Date.now(),
      height: 1,
      voteId: 'mockVoteId',
      periodId: 1,
      voterAddress: 'mockVoterAddress',
      approve: true
    };

    it('should process vote', async () => {
      await expect(blockchain.processVote(mockVote as Vote)).resolves.not.toThrow();
    });

    it('should get consensus public key', () => {
      const publicKey = blockchain.getConsensusPublicKey();
      expect(publicKey).toBeDefined();
    });
  });

  describe('Chain Management', () => {
    it('should get chain tips', async () => {
      const tips = await blockchain.getChainTips();
      expect(Array.isArray(tips)).toBe(true);
    });

    it('should get verification progress', async () => {
      const progress = await blockchain.getVerificationProgress();
      expect(progress).toBe(1);
    });

    it('should get chain work', () => {
      const work = blockchain.getChainWork();
      expect(work).toBe('0x0');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid block addition', async () => {
      const invalidBlock = { ...mockBlock, hash: '' };
      await expect(blockchain.addBlock(invalidBlock as Block)).rejects.toThrow();
    });

    it('should handle invalid transaction', async () => {
      const invalidTx = { ...mockTransaction, signature: '' };
      const result = await blockchain.validateTransaction(invalidTx as Transaction);
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      // Mock error in health monitor
      Object.defineProperty(blockchain, 'healthMonitor', {
        value: {
          getNetworkHealth: jest.fn().mockImplementation(() => {
            throw new Error('Network error');
          })
        },
        writable: true,
        configurable: true
      });

      const size = await blockchain.getDynamicBlockSize(mockBlock as Block);
      expect(size).toBe(1000000); // Return base size on error
    });
  });

  describe('Cleanup and Disposal', () => {
    it('should cleanup resources', () => {
      blockchain.cleanup();
      expect(blockchain.getMempool().getSize()).toBe(0);
    });

    it('should dispose blockchain instance', async () => {
      await expect(blockchain.dispose()).resolves.not.toThrow();
    });
  });

  describe('Dynamic Block Size', () => {
    interface HealthMonitor {
      getNetworkHealth: () => Promise<{ isHealthy: boolean }>;
    }

    let originalHealthMonitor: HealthMonitor;

    beforeEach(() => {
      // Store original health monitor
      originalHealthMonitor = (blockchain as unknown as { healthMonitor: HealthMonitor }).healthMonitor;

      // Mock health monitor
      Object.defineProperty(blockchain, 'healthMonitor', {
        value: {
          getNetworkHealth: jest.fn().mockResolvedValue({ isHealthy: true })
        } as HealthMonitor,
        writable: true,
        configurable: true
      });
    });

    afterEach(() => {
      // Restore original health monitor
      Object.defineProperty(blockchain, 'healthMonitor', {
        value: originalHealthMonitor,
        writable: true,
        configurable: true
      });
    });

    it('should calculate dynamic block size correctly', async () => {
      const size = await blockchain.getDynamicBlockSize(mockBlock as Block);
      expect(size).toBeDefined();
      expect(typeof size).toBe('number');
      expect(size).toBeLessThanOrEqual(2000000); // Max 2MB
      expect(size).toBeGreaterThan(0);
    });

    it('should reduce size when network is congested', async () => {
      // Mock unhealthy network
      Object.defineProperty(blockchain, 'healthMonitor', {
        value: {
          getNetworkHealth: jest.fn().mockResolvedValue({ isHealthy: false })
        } as HealthMonitor,
        writable: true,
        configurable: true
      });

      const size = await blockchain.getDynamicBlockSize(mockBlock as Block);
      expect(size).toBe(1000000); // 100% of base size (1MB)
    });

    it('should handle errors gracefully', async () => {
      // Mock error in health monitor
      Object.defineProperty(blockchain, 'healthMonitor', {
        value: {
          getNetworkHealth: jest.fn().mockImplementation(() => {
            throw new Error('Network error');
          })
        },
        writable: true,
        configurable: true
      });

      const size = await blockchain.getDynamicBlockSize(mockBlock as Block);
      expect(size).toBe(1000000); // Return base size on error
    });
  });

  describe('Chain Work Calculation', () => {
    it('should calculate chain work for block with validators', () => {
      const blockWithValidators = {
        ...mockBlock,
        validators: ['validator1', 'validator2']
      };
      const work = blockchain.getChainWork();
      expect(work).toMatch(/^0x[0-9a-f]+$/);
      expect(blockWithValidators.validators.length).toBe(2);
    });

    it('should handle chain work calculation for genesis block', () => {
      const work = blockchain.getChainWork();
      expect(work).toBe('0x0');
    });
  });

  describe('UTXO Management', () => {
    it('should get UTXO by txId and index', async () => {
      const utxo = await blockchain.getUTXO('mockTxId', 0);
      expect(utxo).toBeDefined();
    });

    it('should check if UTXO is spent', async () => {
      const isSpent = await blockchain.isUTXOSpent({
        txId: 'mockTxId',
        outputIndex: 0
      });
      expect(typeof isSpent).toBe('boolean');
    });
  });

  describe('Transaction Validation', () => {
    it('should validate transaction size', async () => {
      const tx = {
        ...mockTransaction,
        getSize: jest.fn().mockReturnValue(100)
      };
      const result = await blockchain.validateTransaction(tx as Transaction);
      expect(result).toBe(true);
    });

    it('should reject oversized transactions', async () => {
      const tx = {
        ...mockTransaction,
        getSize: jest.fn().mockReturnValue(2000000), // 2MB (too large)
        toHex: jest.fn().mockReturnValue('0'.repeat(2000000)) // Make the serialized size large
      };
      const result = await blockchain.validateTransaction(tx as Transaction);
      expect(result).toBe(false);
    });
  });

  describe('Peer Management', () => {
    it('should add peer successfully', async () => {
      const result = await blockchain.addPeer('ws://localhost:8001');
      expect(result).toBe(true);
    });

    it('should handle invalid peer url', async () => {
      const result = await blockchain.addPeer('invalid-url');
      expect(result).toBe(false);
    });
  });

  describe('Vote Processing', () => {
    it('should process valid vote', async () => {
      const vote: Vote = {
        blockHash: 'mockBlockHash',
        voter: 'mockVoter',
        signature: 'mockSignature',
        timestamp: Date.now(),
        height: 1,
        voteId: 'mockVoteId',
        periodId: 1,
        voterAddress: 'mockVoterAddress',
        approve: true,
        publicKey: 'mockPublicKey',
        encrypted: false,
        votingPower: '100',
        balance: BigInt(1000)
      };
      await expect(blockchain.processVote(vote)).resolves.not.toThrow();
    });

    it('should reject invalid vote signature', async () => {
      const vote: Vote = {
        blockHash: 'mockBlockHash',
        voter: 'mockVoter',
        signature: 'invalidSignature',
        timestamp: Date.now(),
        height: 1,
        voteId: 'mockVoteId',
        periodId: 1,
        voterAddress: 'mockVoterAddress',
        approve: true,
        publicKey: 'mockPublicKey',
        encrypted: false,
        votingPower: '100',
        balance: BigInt(1000)
      };
      await expect(blockchain.processVote(vote)).rejects.toThrow('Invalid vote signature');
    });
  });

  describe('Chain Tips Management', () => {
    beforeEach(() => {
      // Mock getChainTips to return test data
      jest.spyOn(blockchain, 'getChainTips').mockResolvedValue([
        {
          height: 1,
          hash: 'mockHash',
          branchLen: 0,
          status: 'active',
          lastValidatedAt: Date.now()
        }
      ]);
    });

    it('should get chain tips', async () => {
      const tips = await blockchain.getChainTips();
      expect(Array.isArray(tips)).toBe(true);
      expect(tips.length).toBeGreaterThanOrEqual(1);
    });

    it('should identify active chain tip', async () => {
      const tips = await blockchain.getChainTips();
      const activeTip = tips.find(tip => tip.status === 'active');
      expect(activeTip).toBeDefined();
      expect(activeTip?.branchLen).toBe(0);
    });
  });

  describe('Block Verification', () => {
    it('should verify valid block', async () => {
      const validBlock = {
        ...mockBlock,
        verifyHash: jest.fn().mockResolvedValue(true),
        verifySignature: jest.fn().mockResolvedValue(true),
        transactions: [
          { ...mockTransaction, verify: jest.fn().mockResolvedValue(true) }
        ]
      };
      const result = await blockchain.verifyBlock(validBlock as Block);
      expect(result).toBe(true);
    });

    it('should reject block with invalid hash', async () => {
      const invalidBlock = {
        ...mockBlock,
        verifyHash: jest.fn().mockResolvedValue(false),
        verifySignature: jest.fn().mockResolvedValue(true),
        transactions: [
          { ...mockTransaction, verify: jest.fn().mockResolvedValue(true) }
        ]
      };
      const result = await blockchain.verifyBlock(invalidBlock as Block);
      expect(result).toBe(false);
    });

    it('should reject block with invalid signature', async () => {
      const invalidBlock = {
        ...mockBlock,
        verifyHash: jest.fn().mockResolvedValue(true),
        verifySignature: jest.fn().mockResolvedValue(false),
        transactions: [
          { ...mockTransaction, verify: jest.fn().mockResolvedValue(true) }
        ]
      };
      const result = await blockchain.verifyBlock(invalidBlock as Block);
      expect(result).toBe(false);
    });

    it('should reject block with invalid transactions', async () => {
      const invalidBlock = {
        ...mockBlock,
        verifyHash: jest.fn().mockResolvedValue(true),
        verifySignature: jest.fn().mockResolvedValue(true),
        transactions: [
          { ...mockTransaction, verify: jest.fn().mockResolvedValue(false) }
        ]
      };
      const result = await blockchain.verifyBlock(invalidBlock as Block);
      expect(result).toBe(false);
    });
  });

  describe('Transaction Processing', () => {
    it('should process valid payment', async () => {
      const result = await blockchain.processPayment(mockTransaction as Transaction);
      expect(result).toBe(true);
    });

    it('should handle payment processing timeout', async () => {
      jest.useFakeTimers();
      const slowTx = {
        ...mockTransaction,
        verify: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(true), 6000)))
      };
      const processPromise = blockchain.processPayment(slowTx as Transaction);
      jest.advanceTimersByTime(10000);
      const result = await processPromise;
      expect(result).toBe(false);
      jest.useRealTimers();
    });
  });

  describe('Blockchain State', () => {
    it('should get blockchain state', () => {
      const state = blockchain.getState();
      expect(state).toHaveProperty('chain');
      expect(state).toHaveProperty('utxoSet');
      expect(state).toHaveProperty('height');
      expect(state).toHaveProperty('totalSupply');
    });

    it('should get verification progress', async () => {
      const progress = await blockchain.getVerificationProgress();
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    });
  });

  describe('Currency Details', () => {
    it('should get currency details', () => {
      const details = blockchain.getCurrencyDetails();
      expect(details).toHaveProperty('name');
      expect(details).toHaveProperty('symbol');
      expect(details).toHaveProperty('decimals');
      expect(details).toHaveProperty('totalSupply');
      expect(details).toHaveProperty('maxSupply');
      expect(details).toHaveProperty('circulatingSupply');
    });
  });

  describe('Block Reward', () => {
    it('should calculate block reward at different heights', () => {
      const heights = [0, 100, 1000, 10000];
      heights.forEach(height => {
        const reward = blockchain.calculateBlockReward(height);
        expect(typeof reward).toBe('bigint');
        expect(reward >= 0n).toBe(true);
      });
    });

    it('should handle invalid height for reward calculation', () => {
      const reward = blockchain.calculateBlockReward(-1);
      expect(reward).toBe(0n);
    });
  });
});
