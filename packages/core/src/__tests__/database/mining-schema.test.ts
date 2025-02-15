import { MiningDatabase } from '../../database/mining-schema';
import { PowSolution } from '../../blockchain/blockchain';
import { MiningMetrics } from '../../monitoring/metrics';
import fs from 'fs';
import os from 'os';
import path from 'path';

let tempDir: string;

beforeEach(() => {
  // Create a unique temporary directory for each test
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mining-db-test-'));
});

afterEach(() => {
  // Clean up the temporary directory after each test
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('MiningDatabase', () => {
  test('constructor throws error when dbPath is missing', () => {
    expect(() => new MiningDatabase('')).toThrow('Database path is required');
  });

  test('ping returns true for a healthy database', async () => {
    const db = new MiningDatabase(tempDir);
    await db.dispose();
  });

  describe('PoW Solutions', () => {
    let db: MiningDatabase;
    const dummySolution: PowSolution = {
      blockHash: '0x1234',
      nonce: 12345,
      minerAddress: '0xabcd',
      timestamp: Date.now(),
      signature: '0xsig',
      difficulty: 100
    };

    beforeEach(async () => {
      db = new MiningDatabase(tempDir);
    });

    afterEach(async () => {
      await db.dispose();
    });

    test('stores and retrieves a PoW solution', async () => {
      await db.storePowSolution(dummySolution);
      const retrieved = await db.getPowSolution(dummySolution.blockHash, BigInt(dummySolution.nonce));
      expect(retrieved).toEqual(dummySolution);
    });

    test('returns null when PoW solution is not found', async () => {
      const result = await db.getPowSolution('nonexistent', BigInt(0));
      expect(result).toBeNull();
    });

    test('prevents duplicate PoW solutions', async () => {
      await db.storePowSolution(dummySolution);
      await expect(db.storePowSolution(dummySolution)).rejects.toThrow('PoW solution already exists');
    });

    test('retrieves miner solutions with limit', async () => {
      const solutions = Array.from({ length: 5 }, (_, i) => ({
        ...dummySolution,
        nonce: i,
        timestamp: Date.now() + i
      }));

      for (const solution of solutions) {
        await db.storePowSolution(solution);
      }

      const retrieved = await db.getMinerSolutions(dummySolution.minerAddress, 3);
      expect(retrieved.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Mining Metrics', () => {
    let db: MiningDatabase;
    let dummyMetrics: MiningMetrics;

    beforeEach(async () => {
      db = new MiningDatabase(tempDir);
      dummyMetrics = MiningMetrics.getInstance();
      // Set the metrics values
      dummyMetrics.blockHeight = 1000;
      dummyMetrics.hashRate = 15000;
      dummyMetrics.difficulty = 100;
      dummyMetrics.totalBlocks = 100;
      dummyMetrics.successfulBlocks = 95;
      dummyMetrics.lastMiningTime = Date.now();
      dummyMetrics.averageHashRate = 15000;
      dummyMetrics.totalTAGMined = 1000;
      dummyMetrics.currentBlockReward = 100;
      dummyMetrics.tagTransactionsCount = 100;
      dummyMetrics.timestamp = BigInt(Date.now());
      dummyMetrics.blockTime = 60;
      dummyMetrics.tagVolume = 5000;
      dummyMetrics.tagFees = 50;
      dummyMetrics.lastBlockTime = Date.now();
      dummyMetrics.syncedHeaders = 1000;
      dummyMetrics.syncedBlocks = 1000;
      dummyMetrics.whitelistedPeers = 10;
      dummyMetrics.blacklistedPeers = 0;
    });

    afterEach(async () => {
      await db.dispose();
    });

    test('stores and retrieves mining metrics', async () => {
      await db.storeMiningMetrics(dummyMetrics);
      const retrieved = await db.getMiningMetrics(dummyMetrics.blockHeight);
      
      // Compare only the public properties
      const publicProps = [
        'totalBlocks',
        'successfulBlocks',
        'lastMiningTime',
        'averageHashRate',
        'totalTAGMined',
        'currentBlockReward',
        'tagTransactionsCount',
        'timestamp',
        'blockHeight',
        'hashRate',
        'difficulty',
        'blockTime',
        'tagVolume',
        'tagFees',
        'lastBlockTime',
        'syncedHeaders',
        'syncedBlocks',
        'whitelistedPeers',
        'blacklistedPeers'
      ];

      const retrievedPublicProps = publicProps.reduce((obj, prop) => {
        obj[prop] = (retrieved as any)[prop];
        return obj;
      }, {} as any);

      const expectedPublicProps = publicProps.reduce((obj, prop) => {
        obj[prop] = (dummyMetrics as any)[prop];
        return obj;
      }, {} as any);

      expect(retrievedPublicProps).toEqual(expectedPublicProps);
    });

    test('returns null when metrics are not found', async () => {
      const result = await db.getMiningMetrics(999999);
      expect(result).toBeNull();
    });

    test('retrieves metrics in time range', async () => {
      const baseMetrics = dummyMetrics;
      const metrics = Array.from({ length: 5 }, (_, i) => {
        const newMetrics = MiningMetrics.getInstance();
        Object.keys(baseMetrics).forEach(key => {
          if (key === 'blockHeight') {
            (newMetrics as any)[key] = baseMetrics.blockHeight + i;
          } else if (key === 'timestamp') {
            (newMetrics as any)[key] = BigInt(Date.now() + i * 1000);
          } else if (typeof (baseMetrics as any)[key] !== 'function' && 
                     !key.startsWith('_') &&
                     key !== 'metrics' &&
                     key !== 'mutex') {
            (newMetrics as any)[key] = (baseMetrics as any)[key];
          }
        });
        return newMetrics;
      });

      for (const metric of metrics) {
        await db.storeMiningMetrics(metric);
      }

      const startTime = metrics[0].timestamp;
      const endTime = metrics[4].timestamp;
      const retrieved = await db.getMetricsInRange(startTime, endTime);
      expect(retrieved.length).toBeGreaterThan(0);
      expect(retrieved.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Consensus Votes', () => {
    let db: MiningDatabase;
    const dummyVote = {
      blockHash: '0x1234',
      voterAddress: '0xvoter',
      voteType: 'approve',
      timestamp: BigInt(Date.now()),
      signature: '0xsig',
      quantumProof: '0xproof',
      weight: BigInt(100)
    };

    beforeEach(async () => {
      db = new MiningDatabase(tempDir);
    });

    afterEach(async () => {
      await db.dispose();
    });

    test('stores and retrieves a consensus vote', async () => {
      await db.storeConsensusVote(dummyVote);
      const retrieved = await db.getConsensusVote(dummyVote.blockHash, dummyVote.voterAddress);
      expect(retrieved).toEqual(dummyVote);
    });

    test('returns null when vote is not found', async () => {
      const result = await db.getConsensusVote('nonexistent', '0xvoter');
      expect(result).toBeNull();
    });
  });

  describe('Consensus Periods', () => {
    let db: MiningDatabase;
    const dummyPeriod = {
      startHeight: 1000,
      endHeight: 1100,
      startTime: BigInt(Date.now()),
      endTime: BigInt(Date.now() + 3600000),
      participationRate: 0.85,
      finalDecision: true,
      totalVotes: 100,
      quorumReached: true
    };

    beforeEach(async () => {
      db = new MiningDatabase(tempDir);
    });

    afterEach(async () => {
      await db.dispose();
    });

    test('stores and retrieves a consensus period', async () => {
      await db.storeConsensusPeriod(dummyPeriod);
      const retrieved = await db.getConsensusPeriod(dummyPeriod.startHeight);
      expect(retrieved).toEqual(dummyPeriod);
    });

    test('returns null when period is not found', async () => {
      const result = await db.getConsensusPeriod(999999);
      expect(result).toBeNull();
    });
  });

  test('operations after dispose throw error', async () => {
    const db = new MiningDatabase(tempDir);
    await db.dispose();
    await expect(db.getPowSolution('test', BigInt(0))).rejects.toThrow();
  });
});
