import { Level } from 'level';
import { BlockchainSchema } from '../../database/blockchain-schema';
import { Block, BlockHeader } from '../../models/block.model';
import { Transaction, TransactionType, TransactionStatus } from '../../models/transaction.model';
import { Vote } from '../../models/vote.model';
import { UTXO } from '../../models/utxo.model';
import { Validator } from '../../models/validator';
import { Logger } from '@h3tag-blockchain/shared';
import { AbstractChainedBatch } from 'abstract-leveldown';

// Mock Level
jest.mock('level');

// Mock Logger
jest.mock('@h3tag-blockchain/shared', () => ({
  Logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock blockchain constants to lower validator thresholds
jest.mock('../../blockchain/utils/constants', () => ({
  BLOCKCHAIN_CONSTANTS: {
    VALIDATOR: {
      MIN_VALIDATOR_UPTIME: 0,
      MIN_VOTE_PARTICIPATION: 0,
      MIN_BLOCK_PRODUCTION: 0,
    },
    UTIL: {
      CACHE_TTL: 3600,
    },
    CURRENCY: {
      SYMBOL: 'TAG',
    },
  },
}));

// Helper function to serialize data with BigInt support
const serializeWithBigInt = (obj: unknown): string => {
  return JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
};


describe('BlockchainSchema', () => {
  let blockchainSchema: BlockchainSchema;
  let mockDb: jest.Mocked<Level>;
  let mockBatch: jest.Mocked<AbstractChainedBatch<unknown, unknown>>;
  const testDbPath = './test-db';

  // Mock data
  const mockBlockHeader: BlockHeader = {
    version: 1,
    height: 1,
    previousHash: 'prev-hash',
    timestamp: Date.now(),
    merkleRoot: 'merkle-root',
    difficulty: 1,
    nonce: 1,
    miner: 'test-miner',
    validatorMerkleRoot: 'validator-root',
    votesMerkleRoot: 'votes-root',
    totalTAG: 1000,
    blockReward: 50,
    fees: 10,
    target: 'target-hash',
    locator: ['hash1', 'hash2'],
    hashStop: 'stop-hash',
    consensusData: {
      powScore: 1,
      votingScore: 1,
      participationRate: 0.8,
      periodId: 1,
    },
    publicKey: 'miner-pubkey',
    hash: 'block-hash',
    minerAddress: 'miner-address',
  };

  const mockBlock: Block = {
    hash: 'test-hash',
    header: mockBlockHeader,
    transactions: [],
    votes: [],
    validators: [],
    timestamp: Date.now(),
    metadata: {
      receivedTimestamp: Date.now(),
      consensusMetrics: {
        powWeight: 1,
        votingWeight: 1,
        participationRate: 0.8,
      },
    },
    verifyHash: jest.fn().mockResolvedValue(true),
    verifySignature: jest.fn().mockResolvedValue(true),
    getHeaderBase: jest.fn().mockReturnValue('header-base'),
    isComplete: jest.fn().mockReturnValue(true),
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock batch
    mockBatch = {
      put: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      clear: jest.fn().mockReturnThis(),
      write: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
    } as unknown as jest.Mocked<AbstractChainedBatch<unknown, unknown>>;

    // Create mock implementations
    mockDb = {
      get: jest.fn(),
      put: jest.fn(),
      del: jest.fn(),
      batch: jest.fn().mockReturnValue(mockBatch),
      iterator: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<Level>;

    // Mock Level constructor
    (Level as unknown as jest.Mock).mockImplementation(() => mockDb);

    // Create new instance for each test
    blockchainSchema = new BlockchainSchema(testDbPath);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Basic Operations', () => {
    it('should initialize with correct path', () => {
      expect(blockchainSchema.getPath()).toBe(testDbPath);
    });

    it('should close database connection', async () => {
      await blockchainSchema.close();
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockDb.get.mockRejectedValue(new Error('Database error'));
      await expect(blockchainSchema.getCurrentHeight()).rejects.toThrow();
    });
  });

  describe('Block Operations', () => {
    it('should save block', async () => {
      await blockchainSchema.saveBlock(mockBlock);
      expect(mockBatch.put).toHaveBeenCalledTimes(2);
      expect(mockBatch.write).toHaveBeenCalled();
    });

    it('should get block by hash', async () => {
      const serializedBlock = {
        ...mockBlock,
        verifyHash: undefined,
        verifySignature: undefined,
        getHeaderBase: undefined,
        isComplete: undefined,
      };
      mockDb.get.mockResolvedValue(JSON.stringify(serializedBlock));
      const block = await blockchainSchema.getBlock(mockBlock.hash);
      expect(block).toEqual(expect.objectContaining({
        hash: mockBlock.hash,
        header: mockBlock.header,
        transactions: mockBlock.transactions,
        votes: mockBlock.votes,
        validators: mockBlock.validators,
      }));
    });

    it('should get block by height', async () => {
      const serializedBlock = {
        ...mockBlock,
        verifyHash: undefined,
        verifySignature: undefined,
        getHeaderBase: undefined,
        isComplete: undefined,
      };
      mockDb.get.mockResolvedValue(JSON.stringify(serializedBlock));
      const block = await blockchainSchema.getBlockByHeight(mockBlock.header.height);
      expect(block).toEqual(expect.objectContaining({
        hash: mockBlock.hash,
        header: mockBlock.header,
        transactions: mockBlock.transactions,
        votes: mockBlock.votes,
        validators: mockBlock.validators,
      }));
    });

    it('should return null for non-existent block', async () => {
      mockDb.get.mockRejectedValue({ notFound: true });
      const block = await blockchainSchema.getBlock('non-existent');
      expect(block).toBeNull();
    });
  });

  describe('Transaction Operations', () => {
    const mockTransaction: Transaction = {
      id: 'tx-id',
      version: 1,
      type: TransactionType.TRANSFER,
      hash: 'tx-hash',
      status: TransactionStatus.CONFIRMED,
      inputs: [],
      outputs: [],
      transaction: {
        hash: 'tx-hash',
        timestamp: Date.now(),
        fee: BigInt(100),
        signature: 'signature',
      },
      timestamp: Date.now(),
      fee: BigInt(100),
      signature: 'signature',
      sender: 'sender-address',
      recipient: 'recipient-address',
      currency: {
        name: 'H3TAG',
        symbol: 'TAG',
        decimals: 8,
      },
      verify: jest.fn().mockResolvedValue(true),
      toHex: jest.fn().mockReturnValue('tx-hex'),
      getSize: jest.fn().mockReturnValue(250),
    };

    it('should save transaction', async () => {
      // Create mock put function that captures calls
      const putCalls: Array<[string, string]> = [];
      const mockPut = jest.fn().mockImplementation((key: string, value: string) => {
        putCalls.push([key, value]);
        return mockBatchOps;
      });

      // Mock batch operations
      const mockBatchOps = {
        put: mockPut,
        write: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockReturnThis(),
        clear: jest.fn().mockReturnThis(),
        close: jest.fn(),
        db: mockDb,
        length: 0,
      };

      mockDb.batch.mockReturnValue(mockBatchOps);

      await blockchainSchema.saveTransaction(mockTransaction);

      // Verify the batch put operations
      expect(putCalls).toHaveLength(2);
      expect(mockBatchOps.write).toHaveBeenCalled();

      // Verify the first put call (transaction data)
      const [firstPutKey, firstPutValue] = putCalls[0];
      expect(firstPutKey).toBe(`transactions:${mockTransaction.hash}`);
      
      // Parse the serialized data to verify BigInt handling
      const parsedData = JSON.parse(firstPutValue, (_, value) => {
        if (typeof value === 'string' && /^\d+$/.test(value)) {
          try {
            return BigInt(value);
          } catch {
            return value;
          }
        }
        return value;
      });

      // Verify the transaction data was properly serialized
      expect(parsedData.fee.toString()).toBe(mockTransaction.fee.toString());
      expect(parsedData.transaction.fee.toString()).toBe(mockTransaction.transaction.fee.toString());

      // Verify the second put call (transaction type index)
      const [secondPutKey, secondPutValue] = putCalls[1];
      expect(secondPutKey).toBe(`tx_type:${mockTransaction.type}:${mockTransaction.hash}`);
      expect(secondPutValue).toBe(mockTransaction.hash);
    });

    it('should get transaction by hash', async () => {
      const serializedTx = {
        ...mockTransaction,
        verify: undefined,
        toHex: undefined,
        getSize: undefined,
        transaction: {
          ...mockTransaction.transaction,
          fee: mockTransaction.transaction.fee.toString(),
        },
        fee: mockTransaction.fee.toString(),
      };
      mockDb.get.mockResolvedValue(JSON.stringify(serializedTx));
      const tx = await blockchainSchema.getTransaction(mockTransaction.hash);
      expect(tx).toEqual(expect.objectContaining({
        hash: mockTransaction.hash,
        type: mockTransaction.type,
        status: mockTransaction.status,
      }));
    });

    it('should delete transaction', async () => {
      const serializedTx = {
        ...mockTransaction,
        verify: undefined,
        toHex: undefined,
        getSize: undefined,
        transaction: {
          ...mockTransaction.transaction,
          fee: mockTransaction.transaction.fee.toString(),
        },
        fee: mockTransaction.fee.toString(),
      };
      mockDb.get.mockResolvedValue(JSON.stringify(serializedTx));
      await blockchainSchema.deleteTransaction(mockTransaction.hash);
      expect(mockBatch.del).toHaveBeenCalledTimes(2);
      expect(mockBatch.write).toHaveBeenCalled();
    });
  });

  describe('UTXO Operations', () => {
    const mockUTXO: UTXO = {
      txId: 'tx-id',
      outputIndex: 0,
      amount: BigInt(100),
      address: 'test-address',
      spent: false,
      blockHeight: 1,
      script: 'utxo-script',
      timestamp: Date.now(),
      currency: {
        name: 'H3TAG',
        symbol: 'TAG',
        decimals: 8,
      },
      publicKey: 'pub-key',
      confirmations: 10,
    };

    it('should get UTXOs by address', async () => {
      // Mock current height
      mockDb.get.mockResolvedValueOnce('100'); // Current height

      const serializedUTXO = {
        ...mockUTXO,
        amount: mockUTXO.amount.toString(),
      };

      const mockIterator = {
        [Symbol.asyncIterator]: async function* () {
          yield [`utxo:${mockUTXO.address}:${mockUTXO.txId}:${mockUTXO.outputIndex}`, serializeWithBigInt(serializedUTXO)];
        },
        next: jest.fn(),
        nextv: jest.fn(),
        all: jest.fn(),
        seek: jest.fn(),
        end: jest.fn(),
        close: jest.fn(),
        getIndex: jest.fn(),
      } as unknown;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockDb.iterator.mockReturnValue(mockIterator as any);

      const utxos = await blockchainSchema.getUtxosByAddress('test-address');
      expect(utxos).toHaveLength(1);
      expect(utxos[0]).toEqual(expect.objectContaining({
        txId: mockUTXO.txId,
        amount: mockUTXO.amount,
        address: mockUTXO.address,
        spent: false,
      }));
    });

    it('should get UTXO by txId and outputIndex', async () => {
      const serializedUTXO = {
        ...mockUTXO,
        amount: mockUTXO.amount.toString(),
      };

      mockDb.get.mockResolvedValue(JSON.stringify(serializedUTXO));
      const utxo = await blockchainSchema.getUTXO(mockUTXO.txId, mockUTXO.outputIndex);
      expect(utxo).toEqual(expect.objectContaining({
        txId: mockUTXO.txId,
        amount: mockUTXO.amount,
        address: mockUTXO.address,
        spent: false,
      }));
    });
  });

  describe('Voting Operations', () => {
    const mockVote: Vote = {
      voter: 'test-voter',
      voteId: 'test-vote-id',
      periodId: 1,
      blockHash: 'test-block-hash',
      voterAddress: 'test-voter-address',
      approve: true,
      timestamp: Date.now(),
      signature: 'test-signature',
      publicKey: 'test-pub-key',
      encrypted: false,
      votingPower: '1000',
      height: 100,
      balance: BigInt(1000),
    };

    const mockPeriod = {
      startBlock: 1,
      endBlock: 100,
      totalEligibleVoters: 10,
      minimumParticipation: 0.1,
      status: 'active',
      createdAt: Date.now(),
    };

    it('should create a voting period', async () => {
      mockDb.put.mockResolvedValue(undefined);
      const periodId = await blockchainSchema.createVotingPeriod(1, 100);
      expect(periodId).toBeDefined();
      expect(mockDb.put).toHaveBeenCalledWith(
        `voting_period:${periodId}`,
        expect.any(String)
      );
    });

    it('should record a vote', async () => {
      const periodId = Date.now();
      
      // Mock period data
       
      mockDb.get.mockImplementation(async (_key: unknown, ) => {
        const key = _key as string;
        if (key === `voting_period:${periodId}`) {
          return JSON.stringify(mockPeriod);
        }
        if (key === `vote:${periodId}:${mockVote.voter}`) {
          throw new Error('Not found'); // No existing vote
        }
        throw new Error('Unexpected key');
      });

      const mockBatchOps = {
        put: jest.fn(),
        write: jest.fn().mockResolvedValue(undefined),
        del: jest.fn(),
        clear: jest.fn(),
        close: jest.fn(),
        db: mockDb,
        length: 0,
      };
      mockDb.batch.mockReturnValue(mockBatchOps);

      const result = await blockchainSchema.recordVote(mockVote, periodId);
      expect(result).toBe(true);
    });

    it('should prevent double voting', async () => {
      const periodId = Date.now();
      
      // Mock existing vote with proper serialization
      mockDb.get.mockResolvedValue(serializeWithBigInt(mockVote));

      const result = await blockchainSchema.recordVote(mockVote, periodId);
      expect(result).toBe(false);
    });
  });

  describe('Validator Operations', () => {
    const mockValidator: Validator = {
      id: 'validator-id',
      address: 'validator-address',
      publicKey: 'public-key',
      isActive: true,
      isSuspended: false,
      isAbsent: false,
      uptime: 99.9,
      lastActive: Date.now(),
      reputation: 100,
      metrics: {
        uptime: 99.9,
        voteParticipation: 98.5,
        blockProduction: 95.0,
      },
      validationData: 'validation-data',
      votingPower: '1000',
    };

    it('should get validators', async () => {
      // Updated validator metrics: using values that pass selection thresholds
      mockDb.get.mockImplementation(async (key: unknown) => {
        const keyStr = key as string;
        if (keyStr.startsWith('validator_uptime:')) return '100';
        if (keyStr.startsWith('vote_participation:')) return '100';
        if (keyStr.startsWith('block_production:')) return '100';
        if (keyStr.startsWith('slashing_history:')) return '[]';
        throw { notFound: true };
      });

      mockDb.iterator.mockImplementation((options) => {
        if (options && options.gte && typeof options.gte === 'string') {
          if (options.gte.startsWith('slash:')) {
            // For slashing history queries, return an empty async iterator with required properties
            return {
              [Symbol.asyncIterator]: async function* () {
                // Yield nothing for slashing history
              },
              next: jest.fn(),
              nextv: jest.fn(),
              all: jest.fn(),
              seek: jest.fn(),
              end: jest.fn(),
              close: jest.fn(),
              getIndex: jest.fn(),
              db: mockDb,
              count: 0,
              limit: 0,
            };
          }
          if (options.gte.startsWith('validator:')) {
            // For validator records, yield two validators with required properties
            return {
              [Symbol.asyncIterator]: async function* () {
                yield ['validator:active:validator-address', serializeWithBigInt(mockValidator)];
                yield [
                  'validator:active:other-address',
                  serializeWithBigInt({ ...mockValidator, address: 'other-address' }),
                ];
              },
              next: jest.fn(),
              nextv: jest.fn(),
              all: jest.fn(),
              seek: jest.fn(),
              end: jest.fn(),
              close: jest.fn(),
              getIndex: jest.fn(),
              db: mockDb,
              count: 0,
              limit: 0,
            };
          }
        }
        // Fallback: Return an empty iterator with required properties
        return {
          [Symbol.asyncIterator]: async function* () {},
          next: jest.fn(),
          nextv: jest.fn(),
          all: jest.fn(),
          seek: jest.fn(),
          end: jest.fn(),
          close: jest.fn(),
          getIndex: jest.fn(),
          db: mockDb,
          count: 0,
          limit: 0,
        };
      });

      const validators = await blockchainSchema.getValidators();
      expect(validators).toHaveLength(2);
      expect(validators[0].address).toBe('validator-address');
      expect(validators[1].address).toBe('other-address');
    });

     
    it('should get validator performance', async () => {
      mockDb.iterator.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield ['key', serializeWithBigInt({ successful: true })] as [string, string];
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const performance = await blockchainSchema.getValidatorPerformance(mockValidator.address, 100);
      expect(performance).toBeDefined();
      expect(performance.successfulValidations).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Transaction Management', () => {
    beforeEach(async () => {
      // Clear any existing transaction
      await blockchainSchema.rollbackTransaction().catch(() => {});
      jest.clearAllMocks();
    });

    it('should start transaction', async () => {
      await blockchainSchema.startTransaction();
      expect(mockDb.batch).toHaveBeenCalled();
    }, 10000);

    it('should commit transaction', async () => {
      mockBatch.write.mockImplementationOnce((callback: (error: unknown) => void) => {
        callback(null);
      });
      await blockchainSchema.startTransaction();
      await blockchainSchema.commitTransaction();
      expect(mockBatch.write).toHaveBeenCalled();
    }, 10000);

    it('should rollback transaction', async () => {
      await blockchainSchema.startTransaction();
      await blockchainSchema.rollbackTransaction();
      // Since we're using a mutex, we just verify the transaction is cleared
      expect(blockchainSchema['transaction']).toBeNull();
    }, 10000);

    it('should prevent nested transactions', async () => {
      await blockchainSchema.startTransaction();
      
      // Attempt to start a nested transaction
      await expect(blockchainSchema.startTransaction())
        .rejects
        .toThrow('Transaction already in progress');

      // Clean up
      await blockchainSchema.rollbackTransaction();
    }, 10000);
  });

  describe('Cache Operations', () => {
    beforeEach(() => {
      // Clear cache between tests
      blockchainSchema['cache'].clear();
      jest.clearAllMocks();
    });

    it('should use cache for frequently accessed data', async () => {
      const serializedBlock = {
        ...mockBlock,
        verifyHash: jest.fn().mockResolvedValue(true),
        verifySignature: jest.fn().mockResolvedValue(true),
        getHeaderBase: jest.fn().mockReturnValue('header-base'),
        isComplete: jest.fn().mockReturnValue(true),
      };

      // First call should hit the database
      mockDb.get.mockResolvedValue(serializeWithBigInt(serializedBlock));
      const block1 = await blockchainSchema.getBlock(mockBlock.hash);
      expect(mockDb.get).toHaveBeenCalledTimes(1);

      // Second call should use cache
      mockDb.get.mockClear();
      const block2 = await blockchainSchema.getBlock(mockBlock.hash);
      expect(mockDb.get).not.toHaveBeenCalled();
      expect(block2).toEqual(block1);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockDb.get.mockRejectedValue(new Error('Connection failed'));
      await expect(blockchainSchema.getCurrentHeight()).rejects.toThrow();
      expect(Logger.error).toHaveBeenCalled();
    });

    it('should handle invalid data errors', async () => {
      mockDb.get.mockResolvedValue('{"invalid": true, "missing": "closing"');
      await expect(blockchainSchema.getBlock('test-hash')).rejects.toThrow();
    });

    it('should handle missing data gracefully', async () => {
      mockDb.get.mockRejectedValue({ notFound: true });
      const result = await blockchainSchema.getBlock('non-existent');
      expect(result).toBeNull();
    });
  });
});
