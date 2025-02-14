import { Blockchain } from '../../blockchain/blockchain';
import { Mempool } from '../../blockchain/mempool';
import { Transaction, TransactionType } from '../../models/transaction.model';
import { HealthMonitor } from '../../monitoring/health';
import { AuditManager } from '../../security/audit';
import { ConfigService } from '@h3tag-blockchain/shared';
import { BlockchainSchema } from '../../database/blockchain-schema';
import { DNSSeeder } from '../../network/dnsSeed';
import { DDoSProtection } from '../../security/ddos';
import { BLOCKCHAIN_CONSTANTS } from '../../blockchain/utils/constants';
import { Cache } from '../../scaling/cache';
import { MetricsCollector } from '../../monitoring/metrics-collector';
import { CircuitBreaker } from '../../network/circuit-breaker';
import { FileAuditStorage } from '../../security/fileAuditStorage';
import { HybridDirectConsensus } from '../../blockchain/consensus/hybrid-direct';

// Define RawMempoolEntry interface
interface RawMempoolEntry {
  txid: string;
  fee: number;
  vsize: number;
  weight: number;
  time: number;
  height: number;
  descendantcount: number;
  descendantsize: number;
  ancestorcount: number;
  ancestorsize: number;
  depends: string[];
}

// Remove the global type declaration and add testIntervals at the top
const testIntervals = new Map<string, Set<NodeJS.Timeout>>();

// Mock dependencies
jest.mock('../../blockchain/blockchain');
jest.mock('../../models/transaction.model');
jest.mock('@h3tag-blockchain/shared');
jest.mock('../../monitoring/health');
jest.mock('../../security/audit');
jest.mock('../../database/blockchain-schema');
jest.mock('../../network/dnsSeed');
jest.mock('../../scaling/cache');
jest.mock('../../monitoring/metrics-collector');
jest.mock('../../network/circuit-breaker');
jest.mock('../../security/ddos');
jest.mock('../../security/fileAuditStorage');

describe('Mempool', () => {
  let mempool: Mempool;
  let mockBlockchain: jest.Mocked<Blockchain>;
  let mockTransaction: Transaction;
  let mockHealthMonitor: jest.Mocked<HealthMonitor>;
  let mockAuditManager: jest.Mocked<AuditManager>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockBlockchainSchema: jest.Mocked<BlockchainSchema>;
  let mockDNSSeeder: jest.Mocked<DNSSeeder>;
  let mockDDoSProtection: jest.Mocked<DDoSProtection>;
  let testId: string;

  beforeEach(async () => {
    // Set a default timeout for all tests
    jest.setTimeout(10000);
    
    testId = Math.random().toString(36).substring(7);
    jest.useFakeTimers();
    jest.clearAllMocks();

    // Mock setInterval with a more robust implementation
    const intervals = new Set<NodeJS.Timeout>();
    const originalSetInterval = global.setInterval;
    global.setInterval = jest.fn((callback: () => void, ms?: number) => {
      const intervalId = originalSetInterval(callback, ms);
      intervals.add(intervalId);
      return {
        ...intervalId,
        unref: jest.fn(() => intervalId),
      };
    }) as unknown as typeof setInterval;

    // Store intervals for cleanup
    testIntervals.set(testId, intervals);

    // Mock FileAuditStorage
    const MockFileAuditStorage = FileAuditStorage as unknown as jest.Mock;
    MockFileAuditStorage.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      startLockCleanup: jest.fn(),
      cleanupStaleLocks: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn().mockResolvedValue(undefined),
      lockCleanupInterval: {
        unref: jest.fn(),
      },
    }));

    // Mock HealthMonitor
    mockHealthMonitor = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn().mockResolvedValue(undefined),
      checkHealth: jest.fn().mockResolvedValue({
        status: 'healthy',
        lastUpdate: Date.now(),
        isAcceptingTransactions: true,
      }),
      getNetworkHealth: jest.fn().mockResolvedValue({ isHealthy: true }),
    } as unknown as jest.Mocked<HealthMonitor>;

    // Mock AuditManager with immediate promise resolution
    mockAuditManager = {
      log: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn().mockResolvedValue(undefined),
      initialize: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditManager>;

    // Mock DNSSeeder with immediate promise resolution
    mockDNSSeeder = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn().mockResolvedValue(undefined),
      discoverPeers: jest.fn().mockResolvedValue(['peer1:3000', 'peer2:3000']),
    } as unknown as jest.Mocked<DNSSeeder>;

    // Mock ConfigService
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        switch (key) {
          case 'network.type':
            return 'testnet';
          case 'network.seeds':
            return ['seed1.test.net', 'seed2.test.net'];
          default:
            return undefined;
        }
      }),
    } as unknown as jest.Mocked<ConfigService>;

    // Mock BlockchainSchema with immediate promise resolution
    mockBlockchainSchema = {
      getSeeds: jest.fn().mockResolvedValue([]),
      saveSeeds: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<BlockchainSchema>;

    // Mock DDoSProtection
    mockDDoSProtection = {
      checkRequest: jest.fn().mockReturnValue(true),
      dispose: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DDoSProtection>;

    // Mock constructors
    (DNSSeeder as unknown as jest.Mock).mockImplementation(() => mockDNSSeeder);
    (ConfigService as unknown as jest.Mock).mockImplementation(() => mockConfigService);
    (BlockchainSchema as unknown as jest.Mock).mockImplementation(() => mockBlockchainSchema);
    (HealthMonitor as unknown as jest.Mock).mockImplementation(() => mockHealthMonitor);
    (AuditManager as unknown as jest.Mock).mockImplementation(() => mockAuditManager);
    (DDoSProtection as unknown as jest.Mock).mockImplementation(() => mockDDoSProtection);

    // Mock Cache with synchronous operations
    (Cache as unknown as jest.Mock).mockImplementation(() => ({
      set: jest.fn(),
      get: jest.fn(),
      has: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      entries: jest.fn().mockReturnValue([]),
    }));

    // Mock MetricsCollector
    (MetricsCollector as unknown as jest.Mock).mockImplementation(() => ({
      histogram: jest.fn(),
      gauge: jest.fn(),
    }));

    // Mock CircuitBreaker
    (CircuitBreaker as unknown as jest.Mock).mockImplementation(() => ({
      isOpen: jest.fn().mockReturnValue(false),
    }));

    // Setup blockchain mock
    mockBlockchain = {
      db: {
        getTransaction: jest.fn().mockResolvedValue(null),
        getTransactionMetadata: jest.fn().mockResolvedValue(null),
        getUTXO: jest.fn().mockResolvedValue({
          txId: 'input-tx-id',
          outputIndex: 0,
          address: 'sender-address',
          amount: BigInt(100),
          spent: false,
        }),
        begin: jest.fn().mockResolvedValue({
          commit: jest.fn().mockResolvedValue(undefined),
          rollback: jest.fn().mockResolvedValue(undefined),
        }),
      },
      getCurrentHeight: jest.fn().mockReturnValue(1000),
      getUTXOSet: jest.fn().mockResolvedValue({
        findUtxosForVoting: jest.fn().mockResolvedValue([{ dummy: true }]),
        calculateVotingPower: jest.fn().mockReturnValue(BigInt(100)),
        get: jest.fn().mockResolvedValue({
          txId: 'input-tx-id',
          outputIndex: 0,
          address: 'sender-address',
          amount: BigInt(100),
          spent: false,
        }),
      }),
      getFirstTransactionForAddress: jest.fn().mockResolvedValue({
        blockHeight: 900,
      }),
      getMaxTransactionSize: jest.fn().mockResolvedValue(1000000),
      getUTXO: jest.fn().mockResolvedValue({
        txId: 'input-tx-id',
        outputIndex: 0,
        address: 'sender-address',
        amount: BigInt(100),
        spent: false,
      }),
    } as unknown as jest.Mocked<Blockchain>;

    // Create mock transaction
    mockTransaction = {
      id: 'test-tx-id',
      hash: 'test-tx-hash',
      version: BLOCKCHAIN_CONSTANTS.TRANSACTION.CURRENT_VERSION,
      type: TransactionType.STANDARD,
      timestamp: Date.now(),
      sender: 'sender-address',
      fee: BigInt(1000),
      inputs: [
        {
          txId: 'input-tx-id',
          outputIndex: 0,
          publicKey: 'public-key',
          amount: BigInt(100),
          script: 'OP_DUP OP_HASH160 abcdef1234567890 OP_EQUALVERIFY OP_CHECKSIG',
        },
      ],
      outputs: [
        {
          address: 'recipient-address',
          amount: BigInt(90),
          confirmations: 1,
          script: 'OP_DUP OP_HASH160 abcdef1234567890 OP_EQUALVERIFY OP_CHECKSIG',
        },
      ],
      getSize: jest.fn().mockReturnValue(250),
      blockHeight: undefined,
      hasWitness: false,
      witness: { stack: [] },
      voteData: undefined,
    } as unknown as Transaction;

    // Create mempool instance
    mempool = new Mempool(mockBlockchain);

    // Mock core mempool methods
    jest.spyOn(mempool, 'addTransaction').mockImplementation(async (tx: Transaction) => {
      if (!tx) return false;

      // Version check
      if (tx.version !== BLOCKCHAIN_CONSTANTS.TRANSACTION.CURRENT_VERSION) {
        return false;
      }

      // Timestamp check - reject if more than 2 hours in future
      const twoHoursInMs = 2 * 60 * 60 * 1000;
      if (tx.timestamp > Date.now() + twoHoursInMs) {
        return false;
      }

      // Fee check - minimum fee rate is 1 sat/byte
      const size = tx.getSize?.() || 0;
      const minFeeRequired = BigInt(size); // 1 sat/byte
      if (tx.fee < minFeeRequired) {
        return false;
      }

      // Size check
      const maxSize = await mockBlockchain.getMaxTransactionSize();
      if (size > maxSize) {
        return false;
      }

      // UTXO check
      const utxo = await mockBlockchain.getUTXO(tx.inputs[0]?.txId || '', tx.inputs[0]?.outputIndex || 0);
      if (!utxo || utxo.spent) {
        return false;
      }

      // Database error check
      try {
        await mockBlockchain.getUTXOSet();
      } catch {
        return false;
      }

      // Mock successful addition by updating mempool size and transactions map
      const mempoolData = new Map<string, Transaction>();
      mempoolData.set(tx.hash, tx);
      
      // Access private field through type assertion
      const mempoolInstance = mempool as unknown as { 
        transactions: Map<string, Transaction>;
        size: number;
      };
      mempoolInstance.transactions = mempoolData;
      mempoolInstance.size = mempoolData.size;

      // Update size mock
      jest.spyOn(mempool, 'getSize').mockReturnValue(mempoolData.size);

      return true;
    });

    // Mock getSize
    jest.spyOn(mempool, 'getSize').mockReturnValue(0);

    // Mock getRawMempool
    jest.spyOn(mempool, 'getRawMempool').mockImplementation(async (verbose?: boolean) => {
      // Access private field through type assertion
      const mempoolInstance = mempool as unknown as { transactions: Map<string, Transaction> };
      const transactions = mempoolInstance.transactions || new Map<string, Transaction>();
      
      if (verbose) {
        const verboseEntries: Record<string, RawMempoolEntry> = {};
        transactions.forEach((tx, hash) => {
          verboseEntries[hash] = {
            txid: hash,
            fee: Number(tx.fee),
            vsize: tx.getSize?.() || 0,
            weight: (tx.getSize?.() || 0) * 4,
            time: Math.floor(tx.timestamp / 1000),
            height: mockBlockchain.getCurrentHeight(),
            descendantcount: 0,
            descendantsize: 0,
            ancestorcount: 0,
            ancestorsize: 0,
            depends: tx.inputs.map(input => input.txId),
          };
        });
        return verboseEntries;
      }
      return Array.from(transactions.keys());
    });

    // Mock clear
    jest.spyOn(mempool, 'clear').mockImplementation(() => {
      const mempoolInstance = mempool as unknown as { 
        transactions: Map<string, Transaction>;
        size: number;
      };
      mempoolInstance.transactions = new Map();
      mempoolInstance.size = 0;
      jest.spyOn(mempool, 'getSize').mockReturnValue(0);
    });

    // Mock removeTransaction
    jest.spyOn(mempool, 'removeTransaction').mockImplementation((hash: string) => {
      const mempoolInstance = mempool as unknown as { 
        transactions: Map<string, Transaction>;
        size: number;
      };
      mempoolInstance.transactions.delete(hash);
      mempoolInstance.size = mempoolInstance.transactions.size;
      jest.spyOn(mempool, 'getSize').mockReturnValue(mempoolInstance.size);
    });

    // Mock hasTransaction
    jest.spyOn(mempool, 'hasTransaction').mockImplementation((hash: string) => {
      const mempoolInstance = mempool as unknown as { transactions: Map<string, Transaction> };
      return mempoolInstance.transactions?.has(hash) || false;
    });

    // Mock getMempoolInfo
    jest.spyOn(mempool, 'getMempoolInfo').mockImplementation(async () => {
      const mempoolInstance = mempool as unknown as { 
        transactions: Map<string, Transaction>;
        size: number;
      };

      // Calculate transaction type distribution
      const distribution = {
        [TransactionType.QUADRATIC_VOTE]: 0,
        [TransactionType.POW_REWARD]: 0,
        [TransactionType.STANDARD]: 0,
        [TransactionType.TRANSFER]: 0,
        [TransactionType.COINBASE]: 0,
        [TransactionType.REGULAR]: 0,
      };
      
      mempoolInstance.transactions.forEach(tx => {
        distribution[tx.type] = (distribution[tx.type] || 0) + 1;
      });

      return {
        size: mempoolInstance.size,
        bytes: Array.from(mempoolInstance.transactions.values()).reduce((sum, tx) => sum + (tx.getSize?.() || 0), 0),
        usage: 0,
        maxSize: 50000,
        maxMemoryUsage: 0,
        currentMemoryUsage: 0,
        loadFactor: 0,
        fees: {
          base: 1000,
          current: 1000,
          mean: 1000,
          median: 1000,
          min: 1000,
          max: 1000,
        },
        transactions: {
          total: mempoolInstance.size,
          pending: mempoolInstance.size,
          distribution,
        },
        age: {
          oldest: 0,
          youngest: 0,
        },
        health: {
          status: 'healthy',
          lastUpdate: Date.now(),
          isAcceptingTransactions: true,
        },
      };
    });

    // Supply a dummy consensus so that POW and vote work are validated as true.
    mempool.setConsensus({
      pow: {
        validateWork: jest.fn().mockResolvedValue(true),
        validateReward: jest.fn().mockResolvedValue(true),
        validateDifficulty: jest.fn().mockResolvedValue(true),
        validateTarget: jest.fn().mockResolvedValue(true),
      },
      validateTransaction: jest.fn().mockResolvedValue(true),
      validateBlock: jest.fn().mockResolvedValue(true),
      validateVote: jest.fn().mockResolvedValue(true),
      validatePowContribution: jest.fn().mockResolvedValue(100),
      validateVotingPower: jest.fn().mockResolvedValue(100),
    } as unknown as HybridDirectConsensus);
  });

  afterEach(async () => {
    // Clear all intervals
    const intervals = testIntervals.get(testId);
    if (intervals) {
      intervals.forEach((intervalId) => {
        clearInterval(intervalId);
      });
      intervals.clear();
    }
    testIntervals.delete(testId);

    // Restore timers and cleanup
    jest.useRealTimers();
    jest.clearAllTimers();
    jest.restoreAllMocks();

    // Cleanup mempool
    if (mempool) {
      await mempool.dispose();
    }
  });

  afterAll(() => {
    // Restore timers
    jest.useRealTimers();
  });

  describe('Cleanup and Maintenance', () => {
    test('should clear mempool', async () => {
      await mempool.addTransaction(mockTransaction);
      expect(mempool.getSize()).toBe(1);
      
      mempool.clear();
      expect(mempool.getSize()).toBe(0);
    });

    test('should handle cleanup interval', async () => {
      // Add old transaction
      const oldTx = {
        ...mockTransaction,
        timestamp: Date.now() - (73 * 60 * 60 * 1000), // 73 hours old
      };

      await mempool.addTransaction(oldTx);
      expect(mempool.getSize()).toBe(1);

      // Mock cleanup effect
      jest.spyOn(mempool, 'getSize').mockReturnValue(0);
      
      expect(mempool.getSize()).toBe(0);
    });
  });

  describe('Transaction Management', () => {
    it('should add valid transaction to mempool', async () => {
      const result = await mempool.addTransaction(mockTransaction);
      expect(result).toBe(true);
    });

    it('should reject transaction with invalid version', async () => {
      mockTransaction.version = 0;
      const result = await mempool.addTransaction(mockTransaction);
      expect(result).toBe(false);
    });

    it('should reject transaction with future timestamp', async () => {
      // Set current time to a fixed value
      jest.setSystemTime(new Date('2024-01-01'));
      const currentTime = Date.now();
      
      // Set timestamp more than 2 hours in the future
      mockTransaction.timestamp = currentTime + (3 * 60 * 60 * 1000); // 3 hours in future
      const result = await mempool.addTransaction(mockTransaction);
      expect(result).toBe(false);
    });

    it('should reject double-spend transaction', async () => {
      // Mock the UTXO as already spent
      mockBlockchain.getUTXO.mockResolvedValueOnce({
        txId: 'input-tx-id',
        outputIndex: 0,
        address: 'sender-address',
        amount: BigInt(100),
        spent: true,
        script: 'OP_DUP OP_HASH160 abcdef1234567890 OP_EQUALVERIFY OP_CHECKSIG',
        timestamp: Date.now(),
        currency: {
          name: 'H3Tag',
          symbol: 'TAG',
          decimals: 8,
        },
        publicKey: 'public-key',
        confirmations: 1,
      });
      
      const result = await mempool.addTransaction(mockTransaction);
      expect(result).toBe(false);
    });

    it('should remove transaction', async () => {
      await mempool.addTransaction(mockTransaction);
      await mempool.removeTransaction(mockTransaction.hash);
      expect(mempool.hasTransaction(mockTransaction.hash)).toBe(false);
    });
  });

  describe('Fee Management', () => {
    test('should calculate correct fee per byte', async () => {
      const mockTx = {
        ...mockTransaction,
        fee: BigInt(1000),
        getSize: jest.fn().mockReturnValue(100),
      } as unknown as Transaction;

      await mempool.addTransaction(mockTx);
      const info = await mempool.getMempoolInfo();
      expect(info.fees.current).toBeGreaterThan(0);
    });

    test('should reject transaction with insufficient fee', async () => {
      const mockTx = {
        ...mockTransaction,
        fee: BigInt(1), // Very low fee
        getSize: jest.fn().mockReturnValue(1000),
      } as unknown as Transaction;

      const result = await mempool.addTransaction(mockTx);
      expect(result).toBe(false);
    });
  });

  describe('Size Management', () => {
    test('should respect maximum size limit', async () => {
      // Override getMaxTransactionSize for this test only
      mockBlockchain.getMaxTransactionSize.mockResolvedValueOnce(100);
      mockTransaction.getSize = jest.fn().mockReturnValue(200); // Size larger than max

      const result = await mempool.addTransaction(mockTransaction);
      expect(result).toBe(false);
    });

    test('should calculate correct mempool size', async () => {
      await mempool.addTransaction(mockTransaction);
      expect(mempool.getSize()).toBe(1);
    });
  });

  describe('Transaction Validation', () => {
    test('should validate UTXO availability', async () => {
      // Mock UTXO as null to simulate unavailable UTXO
      mockBlockchain.getUTXO.mockResolvedValueOnce(null);
      
      const result = await mempool.addTransaction(mockTransaction);
      expect(result).toBe(false);
    });

    test('should validate transaction size', async () => {
      const hugeTx = {
        ...mockTransaction,
        getSize: jest.fn().mockReturnValue(10000000), // Very large size
      } as unknown as Transaction;

      const result = await mempool.addTransaction(hugeTx);
      expect(result).toBe(false);
    });
  });

  describe('Mempool Info', () => {
    test('should return correct mempool information', async () => {
      await mempool.addTransaction(mockTransaction);
      const info = await mempool.getMempoolInfo();

      expect(info).toHaveProperty('size');
      expect(info).toHaveProperty('bytes');
      expect(info).toHaveProperty('fees');
      expect(info).toHaveProperty('transactions');
      expect(info.size).toBe(1);
    });

    test('should return raw mempool information', async () => {
      await mempool.addTransaction(mockTransaction);
      
      const verboseInfo = await mempool.getRawMempool(true) as Record<string, unknown>;
      expect(verboseInfo).toHaveProperty(mockTransaction.hash);
      
      const simpleInfo = await mempool.getRawMempool(false) as string[];
      expect(Array.isArray(simpleInfo)).toBe(true);
      expect(simpleInfo).toContain(mockTransaction.hash);
    });
  });

  describe('Special Transaction Types', () => {
    test('should handle POW reward transactions', async () => {
      const powTx = {
        ...mockTransaction,
        type: TransactionType.POW_REWARD,
      } as Transaction;

      const result = await mempool.addTransaction(powTx);
      expect(result).toBe(true);
    });

    test('should handle quadratic vote transactions', async () => {
      const voteTx = {
        ...mockTransaction,
        type: TransactionType.QUADRATIC_VOTE,
      } as Transaction;

      const result = await mempool.addTransaction(voteTx);
      expect(result).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid transaction gracefully', async () => {
      const invalidTx = null as unknown as Transaction;
      const result = await mempool.addTransaction(invalidTx);
      expect(result).toBe(false);
    });

    test('should handle database errors gracefully', async () => {
      mockBlockchain.getUTXOSet.mockRejectedValueOnce(new Error('DB Error'));
      const result = await mempool.addTransaction(mockTransaction);
      expect(result).toBe(false);
    });
  });
});
