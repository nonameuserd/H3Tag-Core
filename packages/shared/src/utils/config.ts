import { CurrencyConstantsInterface } from './currency-constants';

export interface NetworkConfig {
  type: {
    MAINNET: string;
    TESTNET: string;
    DEVNET: string;
  };
  port: {
    MAINNET: number;
    TESTNET: number;
    DEVNET: number;
  };
  host: {
    MAINNET: string;
    TESTNET: string;
    DEVNET: string;
  };
  seedDomains: {
    MAINNET: string[];
    TESTNET: string[];
    DEVNET: string[];
  };
}

export interface MiningConfig {
  maxAttempts: number;
  currentVersion: number;
  maxVersion: number;
  minVersion: number;
  batchSize: number;
  blocksPerYear: number;
  initialReward: bigint;
  minReward: bigint;
  halvingInterval: number;
  maxHalvings: number;
  blockTime: number;
  maxBlockTime: number;
  maxDifficulty: number;
  targetTimePerBlock: number;
  difficulty: number;
  minHashrate: number;
  minPowNodes: number;
  maxForkDepth: number;
  emergencyPowThreshold: number;
  minPowScore: number;
  forkResolutionTimeoutMs: number;
  difficultyAdjustmentInterval: number;
  initialDifficulty: number;
  hashBatchSize: number;
  maxTarget: bigint;
  minDifficulty: number;
  nodeSelectionThreshold: number;
  orphanWindow: number;
  propagationWindow: number;
  maxPropagationTime: number;
  targetTimespan: number;
  targetBlockTime: number;
  adjustmentInterval: number;
  maxAdjustmentFactor: number;
  voteInfluence: number;
  minVotesWeight: number;
  maxChainLength: number;
  forkResolutionTimeout: number;
  minRewardContribution: bigint;
  maxBlockSize: number;
  minBlockSize: number;
  maxTransactions: number;
  minBlocksMined: number;
  blockReward: bigint;
  maxTxSize: number;
  minFeePerByte: bigint;
  autoMine: boolean;
  cacheTtl: number;
  maxSupply: bigint;
  safeConfirmationTime: number;
}

export interface ConsensusConfig {
  powWeight: number;
  minPowHashRate: number;
  minVoterCount: number;
  minPeriodLength: number;
  votingPeriod: number;
  minParticipation: number;
  votePowerCap: number;
  votingDayPeriod: number;
  consensusTimeout: number;
  emergencyTimeout: number;
  nodeSelectionTimeout: number;
  voteCollectionTimeout: number;
  initialReward: bigint;
  baseReward: bigint;
  minReward: bigint;
  maxSafeReward: bigint;
  halvingInterval: number;
  baseDifficulty: bigint;
  maxForkLength: number;
  validatorWeight: number;
}

export interface VotingConfig {
  votingPeriodBlocks: number;
  votingPeriodMs: number;
  periodCheckInterval: number;
  minPowWork: number;
  cooldownBlocks: number;
  maxVotesPerPeriod: number;
  maxVotesPerWindow: number;
  minAccountAge: number;
  minPeerCount: number;
  voteEncryptionVersion: string;
  maxVoteSizeBytes: number;
  votingWeight: number;
  minVotesForValidity: number;
  votePowerDecay: number;
  minVotingPower: bigint;
  maxVotingPower: bigint;
  maturityPeriod: number;
  cacheDuration: number;
  minVoteAmount: number;
  minPowContribution: number;
  reputationThreshold: number;
  rateLimitWindow: number;
}

export interface WalletConfig {
  address: string;
  privateKey: string | (() => Promise<string>);
  publicKey: string | (() => Promise<string>);
}

export interface UtilConfig {
  retry: {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffFactor: number;
  };
  cache: {
    ttlMs: number;
    ttlHours: number;
    cleanupIntervalMs: number;
  };
  processingTimeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  cacheTtlHours: number;
  validationTimeoutMs: number;
  initialRetryDelay: number;
  maxRetryDelay: number;
  backoffFactor: number;
  maxRetries: number;
  cacheTtl: number;
  pruneThreshold: number;
  baseMaxSize: number;
  absoluteMaxSize: number;
  staleThreshold: number;
}

export interface TransactionConfig {
  currentVersion: number;
  maxInputs: number;
  maxOutputs: number;
  maxTimeDrift: number;
  amountLimits: {
    min: bigint;
    max: bigint;
    decimals: number;
  };
  mempool: {
    highCongestionThreshold: number;
    maxMb: number;
    minFeeRate: bigint;
    feeRateMultiplier: number;
    evictionInterval: number;
    cleanupInterval: number;
    maxMemoryUsage: number;
    minSize: number;
  };
  processingTimeout: number;
  maxSize: number;
  maxScriptSize: number;
  maxTotalInput: bigint;
  maxSignatureSize: number;
  maxPubkeySize: number;
  minInputAge: number;
  minTxVersion: number;
  maxTxVersion: number;
  required: number;
  maxMessageAge: number;
}

export interface ValidatorConfig {
  minValidatorUptime: number;
  minVoteParticipation: number;
  minBlockProduction: number;
}

export interface BackupValidatorConfig {
  maxBackupAttempts: number;
  backupSelectionTimeout: number;
  minBackupReputation: number;
  minBackupUptime: number;
}

export interface MessageConfig {
  prefix: string;
  maxLength: number;
  minLength: number;
}

export interface BlockchainConfig {
  currency: CurrencyConstantsInterface;
  network: NetworkConfig;
  mining: MiningConfig;
  consensus: ConsensusConfig;
  votingConstants: VotingConfig;
  util: UtilConfig;
  transaction: TransactionConfig;
  validator: ValidatorConfig;
  backupValidatorConfig: BackupValidatorConfig;
  version: number;
  minSafeConfirmations: number;
  maxSafeUtxoAmount: number;
  coinbaseMaturity: number;
  userAgent: string;
  protocolVersion: number;
  maxMempoolSize: number;
  minRelayTxFee: number;
  minPeers: number;
  message: MessageConfig;
  wallet: WalletConfig;
}

export const defaultConfig: BlockchainConfig = {
  currency: {
    name: 'H3TAG',
    symbol: 'TAG',
    decimals: 8,
    initialSupply: BigInt(21000000),
    maxSupply: BigInt(696900000),
    units: {
      MACRO: 1n,
      MICRO: 1000000n,
      MILLI: 1000000000n,
      TAG: 1000000000000n,
    },
  },
  network: {
    type: {
      MAINNET: 'mainnet',
      TESTNET: 'testnet',
      DEVNET: 'devnet',
    },
    port: {
      MAINNET: 8333,
      TESTNET: 10001,
      DEVNET: 10002,
    },
    host: {
      MAINNET: 'mainnet.h3tag.com',
      TESTNET: 'testnet.h3tag.com',
      DEVNET: 'devnet.h3tag.com',
    },
    seedDomains: {
      MAINNET: [
        'seed1.h3tag.com',
        'seed2.h3tag.com',
        'seed3.h3tag.com',
        'seed4.h3tag.com',
        'seed5.h3tag.com',
        'seed6.h3tag.com',
      ],
      TESTNET: [
        'test-seed1.h3tag.com',
        'test-seed2.h3tag.com',
        'test-seed3.h3tag.com',
      ],
      DEVNET: ['dev-seed1.h3tag.com', 'dev-seed2.h3tag.com'],
    },
  },
  mining: {
    maxAttempts: 1000,
    currentVersion: 1,
    maxVersion: 2,
    minVersion: 1,
    batchSize: 10000,
    blocksPerYear: 52560,
    initialReward: BigInt(5000000000),
    minReward: BigInt(546),
    halvingInterval: 210000,
    maxHalvings: 69,
    blockTime: 600000,
    maxBlockTime: 600000,
    maxDifficulty: 1000000,
    targetTimePerBlock: 600000,
    difficulty: 7,
    minHashrate: 1000000,
    minPowNodes: 3,
    maxForkDepth: 100,
    emergencyPowThreshold: 0.85,
    minPowScore: 0.51,
    forkResolutionTimeoutMs: 600000,
    difficultyAdjustmentInterval: 2016,
    initialDifficulty: 0x1d0000ffff,
    hashBatchSize: 10000,
    maxTarget: BigInt(
      '0x0000000000ffff0000000000000000000000000000000000000000000000000000',
    ),
    minDifficulty: 2,
    nodeSelectionThreshold: 0.67,
    orphanWindow: 100,
    propagationWindow: 50,
    maxPropagationTime: 30000,
    targetTimespan: 14 * 24 * 60 * 60,
    targetBlockTime: 600,
    adjustmentInterval: 2016,
    maxAdjustmentFactor: 0.25,
    voteInfluence: 0.4,
    minVotesWeight: 0.1,
    maxChainLength: 10000000,
    forkResolutionTimeout: 600000,
    minRewardContribution: BigInt(2016),
    maxBlockSize: 1048576,
    minBlockSize: 1024,
    maxTransactions: 10000,
    minBlocksMined: 100,
    blockReward: 50n * 10n ** 8n,
    maxTxSize: 1048576,
    minFeePerByte: 1n,
    autoMine: process.env.AUTO_MINE === 'true' || false,
    cacheTtl: 3600000,
    maxSupply: BigInt(50000000),
    safeConfirmationTime: 3600000,
  },
  consensus: {
    powWeight: 0.6,
    minPowHashRate: 1000000,
    minVoterCount: 1000,
    minPeriodLength: 1000,
    votingPeriod: 210240,
    minParticipation: 0.1,
    votePowerCap: 0.05,
    votingDayPeriod: 690 * 24 * 60 * 60 * 1000,
    consensusTimeout: 30 * 60 * 1000,
    emergencyTimeout: 60 * 60 * 1000,
    nodeSelectionTimeout: 5 * 60 * 1000,
    voteCollectionTimeout: 3 * 60 * 1000,
    initialReward: BigInt(546),
    baseReward: 100n * 10n ** 18n,
    minReward: 10n * 10n ** 18n,
    maxSafeReward: 1000000n * 10n ** 18n,
    halvingInterval: 210000,
    baseDifficulty: 1n,
    maxForkLength: 100,
    validatorWeight: 100,
  },
  votingConstants: {
    votingPeriodBlocks: 210240,
    votingPeriodMs: 126144000000,
    periodCheckInterval: 60000,
    minPowWork: 10000,
    cooldownBlocks: 100,
    maxVotesPerPeriod: 100000,
    maxVotesPerWindow: 5,
    minAccountAge: 20160,
    minPeerCount: 3,
    voteEncryptionVersion: '1.0',
    maxVoteSizeBytes: 1024 * 100,
    votingWeight: 0.4,
    minVotesForValidity: 0.1,
    votePowerDecay: 0.5,
    minVotingPower: BigInt(100),
    maxVotingPower: BigInt(1000000),
    maturityPeriod: 86400000,
    cacheDuration: 300000,
    minVoteAmount: 1,
    minPowContribution: 1000,
    reputationThreshold: 100,
    rateLimitWindow: 3600,
  },
  util: {
    retry: {
      maxAttempts: 1000,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffFactor: 2,
    },
    cache: {
      ttlMs: 60000,
      ttlHours: 24,
      cleanupIntervalMs: 300000,
    },
    processingTimeoutMs: 30000,
    retryAttempts: 3,
    retryDelayMs: 1000,
    cacheTtlHours: 24,
    validationTimeoutMs: 30000,
    initialRetryDelay: 1000,
    maxRetryDelay: 30000,
    backoffFactor: 2,
    maxRetries: 1000,
    cacheTtl: 60000,
    pruneThreshold: 0.8,
    baseMaxSize: 1000000,
    absoluteMaxSize: 10000000,
    staleThreshold: 7 * 24 * 60 * 60 * 1000,
  },
  transaction: {
    currentVersion: 1,
    maxInputs: 1000,
    maxOutputs: 1000,
    maxTimeDrift: 7200000,
    amountLimits: {
      min: BigInt(1),
      max: BigInt('5000000000000000'),
      decimals: 8,
    },
    mempool: {
      highCongestionThreshold: 50000,
      maxMb: 300,
      minFeeRate: BigInt(1),
      feeRateMultiplier: 1.5,
      evictionInterval: 600000,
      cleanupInterval: 60000,
      maxMemoryUsage: 536870912,
      minSize: 1000,
    },
    processingTimeout: 30000,
    maxSize: 1000000,
    maxScriptSize: 1000000,
    maxTotalInput: BigInt('1000000000000000'),
    maxSignatureSize: 520,
    maxPubkeySize: 65,
    minInputAge: 3600000,
    minTxVersion: 1,
    maxTxVersion: 1,
    required: 6,
    maxMessageAge: 300000,
  },
  validator: {
    minValidatorUptime: 0.97,
    minVoteParticipation: 0.99,
    minBlockProduction: 0.75,
  },
  backupValidatorConfig: {
    maxBackupAttempts: 3,
    backupSelectionTimeout: 30000,
    minBackupReputation: 70,
    minBackupUptime: 0.95,
  },
  version: 1,
  minSafeConfirmations: 6,
  maxSafeUtxoAmount: 1_000_000_000_000,
  coinbaseMaturity: 100,
  userAgent: '/H3Tag:1.0.0/',
  protocolVersion: 1,
  maxMempoolSize: 50000,
  minRelayTxFee: 0.00001,
  minPeers: 3,
  message: {
    prefix: '\x18H3Tag Signed Message:\n',
    maxLength: 100000,
    minLength: 1,
  },
  wallet: {
    address: '',
    privateKey: '',
    publicKey: '',
  },
};
