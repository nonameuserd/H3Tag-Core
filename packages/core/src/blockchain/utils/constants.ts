import { NetworkType } from "@h3tag-blockchain/shared";

export const BLOCKCHAIN_CONSTANTS = {
  CURRENCY: {
    NAME: "H3Tag",
    SYMBOL: "TAG",
    DECIMALS: 8,
    INITIAL_SUPPLY: 0,
    MAX_SUPPLY: 696900000,
    UNITS: {
      MACRO: 1n,
      MICRO: 1000000n,
      MILLI: 1000000000n,
      TAG: 1000000000000n,
    },
    NETWORK: {
      type: {
        MAINNET: "mainnet" as NetworkType,
        TESTNET: "testnet" as NetworkType,
        DEVNET: "devnet" as NetworkType,
      },
      port: {
        MAINNET: 8333,
        TESTNET: 10001,
        DEVNET: 10002,
      },
      host: {
        MAINNET: "mainnet.h3tag.com",
        TESTNET: "testnet.h3tag.com",
        DEVNET: "devnet.h3tag.com",
      },
      seedDomains: {
        MAINNET: [
          "seed1.h3tag.com",
          "seed2.h3tag.com",
          "seed3.h3tag.com",
          "seed4.h3tag.com",
          "seed5.h3tag.com",
          "seed6.h3tag.com",
        ],
        TESTNET: [
          "test-seed1.h3tag.com",
          "test-seed2.h3tag.com",
          "test-seed3.h3tag.com",
        ],
        DEVNET: ["dev-seed1.h3tag.com", "dev-seed2.h3tag.com"],
      },
    },
  },
  MINING: {
    MAX_ATTEMPTS: 1000,
    CURRENT_VERSION: 1,
    MAX_VERSION: 2,
    MIN_VERSION: 1,
    BATCH_SIZE: 10000,
    BLOCKS_PER_YEAR: 52560,
    INITIAL_REWARD: BigInt(5000000000),
    MIN_REWARD: BigInt(546),
    HALVING_INTERVAL: 210000,
    MAX_HALVINGS: 69,
    BLOCK_TIME: 600000,
    MAX_BLOCK_TIME: 600000,
    MAX_DIFFICULTY: 1000000,
    TARGET_TIME_PER_BLOCK: 600000,
    DIFFICULTY: 7,
    MIN_HASHRATE: 1000000,
    MIN_POW_NODES: 3,
    MAX_FORK_DEPTH: 100,
    EMERGENCY_POW_THRESHOLD: 0.85,
    MIN_POW_SCORE: 0.51,
    FORK_RESOLUTION_TIMEOUT_MS: 600000,
    DIFFICULTY_ADJUSTMENT_INTERVAL: 2016,
    INITIAL_DIFFICULTY: 0x1d0000ffff,
    HASH_BATCH_SIZE: 10000,
    MAX_TARGET: BigInt(
      "0x0000000000ffff0000000000000000000000000000000000000000000000000000"
    ),
    MIN_DIFFICULTY: 2,
    NODE_SELECTION_THRESHOLD: 0.67,
    ORPHAN_WINDOW: 100,
    PROPAGATION_WINDOW: 50,
    MAX_PROPAGATION_TIME: 30000,
    TARGET_TIMESPAN: 14 * 24 * 60 * 60,
    TARGET_BLOCK_TIME: 600,
    ADJUSTMENT_INTERVAL: 2016,
    MAX_ADJUSTMENT_FACTOR: 0.25,
    VOTE_INFLUENCE: 0.4,
    MIN_VOTES_WEIGHT: 0.1,
    MAX_CHAIN_LENGTH: 10000000,
    FORK_RESOLUTION_TIMEOUT: 600000,
    MIN_REWARD_CONTRIBUTION: BigInt(2016),
    MAX_BLOCK_SIZE: 1048576,
    MIN_BLOCK_SIZE: 1024,
    MAX_TRANSACTIONS: 10000,
    MIN_BLOCKS_MINED: 100,
    BLOCK_REWARD: 50n * 10n ** 8n,
    MAX_TX_SIZE: 1048576,
    MIN_FEE_PER_BYTE: 1n,
    AUTO_MINE: process.env.AUTO_MINE === "true" || false,
    CACHE_TTL: 3600000,
    MAX_SUPPLY: BigInt(50000000),
    SAFE_CONFIRMATION_TIME: 3600000,
  },
  VOTING_CONSTANTS: {
    VOTING_PERIOD_BLOCKS: 210240,
    VOTING_PERIOD_MS: 126144000000,
    PERIOD_CHECK_INTERVAL: 60000,
    MIN_POW_WORK: 10000,
    COOLDOWN_BLOCKS: 100,
    MAX_VOTES_PER_PERIOD: 100000,
    MAX_VOTES_PER_WINDOW: 5,
    MIN_ACCOUNT_AGE: 20160,
    MIN_PEER_COUNT: 3,
    VOTE_ENCRYPTION_VERSION: "1.0",
    MAX_VOTE_SIZE_BYTES: 1024 * 100,
    VOTING_WEIGHT: 0.4,
    MIN_VOTES_FOR_VALIDITY: 0.1,
    VOTE_POWER_DECAY: 0.5,
    MIN_VOTING_POWER: BigInt(100),
    MAX_VOTING_POWER: BigInt(1000000),
    MATURITY_PERIOD: 86400000,
    CACHE_DURATION: 300000,
    MIN_VOTE_AMOUNT: 1,
    MIN_POW_CONTRIBUTION: 1000,
    REPUTATION_THRESHOLD: 100,
    RATE_LIMIT_WINDOW: 3600, // 1 hour in seconds
  },
  CONSENSUS: {
    POW_WEIGHT: 0.6,
    MIN_POW_HASH_RATE: 1000000,
    MIN_VOTER_COUNT: 1000,
    MIN_PERIOD_LENGTH: 1000,
    VOTING_PERIOD: 210240,
    MIN_PARTICIPATION: 0.1,
    VOTE_POWER_CAP: 0.05,
    VOTING_DAY_PERIOD: 690 * 24 * 60 * 60 * 1000,
    CONSENSUS_TIMEOUT: 30 * 60 * 1000,
    EMERGENCY_TIMEOUT: 60 * 60 * 1000,
    NODE_SELECTION_TIMEOUT: 5 * 60 * 1000,
    VOTE_COLLECTION_TIMEOUT: 3 * 60 * 1000,
    INITIAL_REWARD: BigInt(546),
    BASE_REWARD: 100n * 10n ** 18n,
    MIN_REWARD: 10n * 10n ** 18n,
    MAX_SAFE_REWARD: 1000000n * 10n ** 18n,
    HALVING_INTERVAL: 210000,
    BASE_DIFFICULTY: 1n,
    MAX_FORK_LENGTH: 100,
    VALIDATOR_WEIGHT: 100,
  },
  UTIL: {
    RETRY: {
      MAX_ATTEMPTS: 1000,
      INITIAL_DELAY_MS: 1000,
      MAX_DELAY_MS: 30000,
      BACKOFF_FACTOR: 2,
    },
    CACHE: {
      TTL_MS: 60000,
      TTL_HOURS: 24,
      CLEANUP_INTERVAL_MS: 300000,
    },
    PROCESSING_TIMEOUT_MS: 30000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 1000,
    CACHE_TTL_HOURS: 24,
    VALIDATION_TIMEOUT_MS: 30000,
    INITIAL_RETRY_DELAY: 1000,
    MAX_RETRY_DELAY: 30000,
    BACKOFF_FACTOR: 2,
    MAX_RETRIES: 1000,
    CACHE_TTL: 60000,
    PRUNE_THRESHOLD: 0.8,
    BASE_MAX_SIZE: 1000000,
    ABSOLUTE_MAX_SIZE: 10000000,
    STALE_THRESHOLD: 7 * 24 * 60 * 60 * 1000,
  },
  VALIDATOR: {
    MIN_VALIDATOR_UPTIME: 0.97,
    MIN_VOTE_PARTICIPATION: 0.99,
    MIN_BLOCK_PRODUCTION: 0.75,
  },
  TRANSACTION: {
    MIN_FEE: BigInt(1),
    CURRENT_VERSION: 1,
    MAX_INPUTS: 1000,
    MAX_OUTPUTS: 1000,
    MAX_TIME_DRIFT: 7200000,
    AMOUNT_LIMITS: {
      MIN: BigInt(1),
      MAX: BigInt("5000000000000000"),
      DECIMALS: 8,
    },
    MEMPOOL: {
      MAX_SIZE: 300000, // 300K transactions
      HIGH_CONGESTION_THRESHOLD: 50000,
      MAX_MB: 300, // 300MB total size
      MIN_FEE_RATE: BigInt(1),
      FEE_RATE_MULTIPLIER: 1.5,
      EVICTION_INTERVAL: 600000,
      CLEANUP_INTERVAL: 60000,
      MAX_MEMORY_USAGE: 536870912, // 512MB memory limit
      MIN_SIZE: 1000, // Minimum transactions to maintain
    },
    PROCESSING_TIMEOUT: 30000,
    MAX_SIZE: 1000000, // 1MB limit
    MAX_SCRIPT_SIZE: 1000000, // 1MB limit
    MAX_TOTAL_INPUT: BigInt("1000000000000000"),
    MAX_SIGNATURE_SIZE: 520,
    MAX_PUBKEY_SIZE: 65,
    MIN_INPUT_AGE: 3600000,
    MIN_TX_VERSION: 1,
    MAX_TX_VERSION: 1,
    REQUIRED: 6,
    MAX_MESSAGE_AGE: 300000,
  },
  BACKUP_VALIDATOR_CONFIG: {
    MAX_BACKUP_ATTEMPTS: 3,
    BACKUP_SELECTION_TIMEOUT: 30000, // 30 seconds
    MIN_BACKUP_REPUTATION: 70,
    MIN_BACKUP_UPTIME: 0.95,
  },
  VERSION: 1,
  MIN_SAFE_CONFIRMATIONS: 6,
  MAX_SAFE_UTXO_AMOUNT: 1_000_000_000_000,
  COINBASE_MATURITY: 100,
  USER_AGENT: "/H3Tag:1.0.0/",
  PROTOCOL_VERSION: 1,
  MAX_MEMPOOL_SIZE: 50000,
  MIN_RELAY_TX_FEE: 0.00001,
  MIN_PEERS: 3,
  MESSAGE: {
    PREFIX: "\x18H3Tag Signed Message:\n",
    MAX_LENGTH: 100000,
    MIN_LENGTH: 1,
  },
};


BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIZE = Math.floor(
  BLOCKCHAIN_CONSTANTS.MINING.MAX_BLOCK_SIZE * 0.8
);
