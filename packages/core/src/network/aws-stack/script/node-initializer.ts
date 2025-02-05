import { BlockchainConfig } from '@h3tag-blockchain/shared';

interface DatabaseConfig {
  path: string;
  options: {
    createIfMissing: boolean;
    compression: boolean;
    cacheSize: number;
    writeBufferSize: number;
    blockSize: number;
    maxOpenFiles: number;
  };
}

export class NodeInitializer {
  private static getDatabaseConfig(
    basePath: string,
  ): Record<string, DatabaseConfig> {
    const defaultOptions = {
      createIfMissing: true,
      compression: true,
      cacheSize: 32 * 1024 * 1024, // 32MB
      writeBufferSize: 8 * 1024 * 1024, // 8MB
      blockSize: 8192,
      maxOpenFiles: 500,
    };

    return {
      main: { path: `${basePath}/main`, options: defaultOptions },
      mining: { path: `${basePath}/mining`, options: defaultOptions },
      keystore: { path: `${basePath}/keystore`, options: defaultOptions },
      utxo: { path: `${basePath}/utxo`, options: defaultOptions },
      wallet: { path: `${basePath}/wallet`, options: defaultOptions },
      voting: { path: `${basePath}/voting`, options: defaultOptions },
      votingShard: {
        path: `${basePath}/voting-shard`,
        options: defaultOptions,
      },
    };
  }

  static getInitializationScript(blockchainConfig: BlockchainConfig): string {
    const dbConfig = this.getDatabaseConfig('/data/blockchain');

    return `
      const { Database } = require('@h3tag-blockchain/core/dist/database/database');
      const { MiningDatabase } = require('@h3tag-blockchain/core/dist/database/mining-schema');
      const { KeystoreDatabase } = require('@h3tag-blockchain/core/dist/database/keystore-database');
      const { UTXODatabase } = require('@h3tag-blockchain/core/dist/database/utxo-schema');
      const { WalletDatabase } = require('@h3tag-blockchain/core/dist/database/wallet-database');
      const { VotingDatabase } = require('@h3tag-blockchain/core/dist/database/voting-schema');
      const { ConfigService, Logger, BLOCKCHAIN_CONSTANTS } = require('@h3tag-blockchain/shared');
      
      const { Blockchain } = require('@h3tag-blockchain/core/dist/blockchain/blockchain');
      const { ProofOfWork } = require('@h3tag-blockchain/core/dist/blockchain/consensus/pow');
      const { DirectVoting } = require('@h3tag-blockchain/core/dist/blockchain/consensus/direct-voting');
      const { HybridDirectConsensus } = require('@h3tag-blockchain/core/dist/consensus/hybrid-direct');
      
      const { HybridCrypto } = require('@h3tag-blockchain/crypto');
      const { AuditManager } = require('@h3tag-blockchain/core/dist/security/audit');
      const { InMemoryAuditStorage } = require('@h3tag-blockchain/core/dist/security/storage');
      
      const { Node } = require('@h3tag-blockchain/core/dist/network/node');
      const { Peer } = require('@h3tag-blockchain/core/dist/network/peer');
      const { BlockchainSync } = require('@h3tag-blockchain/core/dist/network/sync');
      const { Mempool } = require('@h3tag-blockchain/core/dist/blockchain/mempool');
      const { MetricsCollector } = require('@h3tag-blockchain/core/dist/monitoring/metrics-collector');
      const { HealthMonitor } = require('@h3tag-blockchain/core/dist/monitoring/health');
      const { WorkerPool } = require('@h3tag-blockchain/core/dist/network/worker-pool');
      const { Cache } = require('@h3tag-blockchain/core/dist/scaling/cache');
      const { DDoSProtection } = require('@h3tag-blockchain/core/dist/security/ddos');
      const { DNSSeeder } = require('@h3tag-blockchain/core/dist/network/dnsSeed');
      const { PeerDiscovery } = require('@h3tag-blockchain/core/dist/network/discovery');
      const { MerkleTree } = require('@h3tag-blockchain/core/dist/utils/merkle');
      const { RetryStrategy } = require('@h3tag-blockchain/core/dist/utils/retry');
      
      // Additional modules required for sharding, keystore and metrics.
      const { Keystore } = require('@h3tag-blockchain/core/dist/security/keystore');
      const { CacheMetrics } = require('@h3tag-blockchain/core/dist/monitoring/cache-metrics');
      const { BlockchainSchema } = require('@h3tag-blockchain/core/dist/database/blockchain-schema');
      const { ShardManager } = require('@h3tag-blockchain/core/dist/sharding/shard-manager');
      
      async function initializeNode() {
        let healthCheckInterval;
        try {
          Logger.info('Starting seed node initialization...');
      
          // Initialize audit manager first.
          const auditStorage = new InMemoryAuditStorage();
          const auditManager = new AuditManager(auditStorage);
      
          // Set up the retry strategy before its first use.
          const retryConfig = {
            maxAttempts: 3,
            delay: 1000,
            exponentialBackoff: true,
            maxDelay: 10000,
            retryableErrors: [
              'ECONNREFUSED',
              'ETIMEDOUT',
              /network error/i
            ]
          };
          const retryStrategy = new RetryStrategy(retryConfig);
      
          // Initialize security with proper error handling.
          let securityKeys;
          try {
            securityKeys = await retryStrategy.execute(async () => {
              await HybridCrypto.initialize();
              return HybridCrypto.generateKeyPair();
            });
          } catch (error) {
            Logger.error('Failed to initialize security:', error);
            throw error;
          }
      
          // Initialize cache (use a single cache instance for the remainder of the script).
          const cacheConfig = {
            ttl: 3600,
            maxSize: 1000,
            maxMemory: 1024 * 1024 * 512,
            compression: true
          };
          const cache = new Cache(cacheConfig);
      
          // Initialize merkle tree for block verification.
          const merkleTree = new MerkleTree();
      
          const dbConfig = ${JSON.stringify(dbConfig)};
      
          const mainDb = new Database(dbConfig.main.path, dbConfig.main.options);
          const miningDb = new MiningDatabase(dbConfig.mining.path, dbConfig.mining.options);
          const keystoreDb = new KeystoreDatabase(dbConfig.keystore.path, dbConfig.keystore.options);
          const utxoDb = new UTXODatabase(dbConfig.utxo.path, dbConfig.utxo.options);
          const walletDb = new WalletDatabase(dbConfig.wallet.path, dbConfig.wallet.options);
          const votingDb = new VotingDatabase(dbConfig.voting.path, dbConfig.voting.options);
      
          const workerPool = new WorkerPool(4);
      
          // Create a deep copy of the blockchain configuration and inject the security keys.
          const blockchainConfigCopy = JSON.parse(JSON.stringify(${JSON.stringify(blockchainConfig)}));
          blockchainConfigCopy.wallet.privateKey = securityKeys.privateKey;
      
          const blockchain = new Blockchain(blockchainConfigCopy);
          await blockchain.initialize();
      
          const mempool = new Mempool(blockchain);
          const dnsSeeder = new DNSSeeder(ConfigService.getConfig(), mainDb, {
            networkType: blockchainConfigCopy.network.type,
            port: blockchainConfigCopy.network.port
          });
      
          const node = new Node(
            blockchain,
            mainDb,
            mempool,
            ConfigService.getConfig(),
            auditManager
          );
      
          const peerDiscovery = new PeerDiscovery(node, dnsSeeder);
          await peerDiscovery.initialize();
      
          const blockchainSync = new BlockchainSync(
            blockchain,
            mempool,
            node.getPeers(),
            { 
              traditional: securityKeys.publicKey,
              merkleTree,
              retryStrategy
            },
            mainDb
          );
      
          const pow = new ProofOfWork(blockchain);
          await pow.initialize();
      
          const directVoting = new DirectVoting(mainDb, auditManager);
          await directVoting.initialize();
      
          const consensus = new HybridDirectConsensus({
            pow,
            directVoting,
            mempool,
            blockchain
          });
          await consensus.initialize();
      
          // Initialize Keystore.
          await Keystore.initialize();
          Logger.info("Keystore initialized successfully");
      
          // Initialize cache metrics (reusing the previous cache instance).
          const cacheMetrics = new CacheMetrics();
          Logger.info("Cache system initialized successfully");
      
          // Initialize sharding using the main database path.
          const shardConfig = {
            shardCount: 16,
            votingShards: 4,
            powShards: 4,
            maxShardSize: 1000000,
            replicationFactor: 3,
            reshardThreshold: 0.8,
            syncInterval: 30000
          };
          const schema = new BlockchainSchema(dbConfig.main.path);
          const shardManager = new ShardManager(shardConfig, schema);
          await shardManager.initialize();
          Logger.info("Shard manager initialized successfully");
      
          // Initialize WebAssembly modules.
          try {
            const wasmModule = await import("../../../wasm/pkg/vote_processor");
            if (!wasmModule) {
              throw new Error("Failed to load WebAssembly module");
            }
            Logger.info("WebAssembly modules initialized successfully");
          } catch (error) {
            Logger.error("WebAssembly initialization failed:", error);
            throw error;
          }
      
          // Set up health monitoring with periodic checks.
          healthCheckInterval = setInterval(async () => {
            const keystoreHealth = await Keystore.healthCheck();
            const cacheHealth = cache.getHitRate() > 0.7; // 70% hit rate threshold
            const shardHealth = await shardManager.healthCheck();
      
            if (!keystoreHealth || !cacheHealth || !shardHealth) {
              Logger.warn("Health check failed:", {
                keystore: keystoreHealth,
                cache: cacheHealth,
                sharding: shardHealth
              });
            }
          }, 300000);
      
          // Cleanup handling.
          const cleanup = async () => {
            clearInterval(healthCheckInterval);
            await workerPool.shutdown();
            await mainDb.close();
            await miningDb.close();
            // ... close other resources ...
            process.exit(0);
          };
      
          process.on('SIGTERM', cleanup);
          process.on('SIGINT', cleanup);
      
          await node.initialize();
          await blockchainSync.start();
      
          // Export the configuration to an environment variable.
          try {
            process.env.BLOCKCHAIN_CONFIG = JSON.stringify({
              blockchain: blockchain.getConfig(),
              database: dbConfig,
              consensus: consensus.getConfig(),
              security: {
                publicKey: securityKeys.publicKey
              }
            });
          } catch (error) {
            Logger.error('Failed to set BLOCKCHAIN_CONFIG:', error);
            throw error;
          }
      
          Logger.info('Seed node initialization completed successfully');
          await node.start();
      
        } catch (error) {
          clearInterval(healthCheckInterval);
          Logger.error('Failed to initialize seed node:', error);
          process.exit(1);
        }
      }
      
      // Run initialization.
      initializeNode().catch(console.error);
    `;
  }
}
