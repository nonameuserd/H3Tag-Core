import { KeyManager } from "@h3tag-blockchain/crypto";

const HALVING_INTERVAL = 210000;
const INITIAL_REWARD = 50;

export enum NetworkType {
  MAINNET = "mainnet",
  TESTNET = "testnet",
  DEVNET = "devnet",
}

export default {
  network: {
    port: 3000,
    peers: [],
    maxPeerLatency: 10000,
    dnsSeeds: [
      "seed1.h3tag.network",
      "seed2.h3tag.network",
      "seed3.h3tag.network",
      "seed4.h3tag.network",
      "seed5.h3tag.network",
      "seed6.h3tag.network",
    ],
  },
  consensus: {
    epochLength: 100,
    enableHybrid: true,
    minStakeAmount: BigInt(1000),
    minStakePeriod: 7 * 24 * 60 * 60 * 1000,
    initialDifficulty: 4,
    targetBlockTime: 60000,
    minDifficulty: 1,
    maxDifficulty: 32,
  },
  blockchain: {
    maxSupply: 69690000,
    initialSupply: 21000000,
    initialReward: 50,
    halvingInterval: 210000,
    blockTime: 600,
    getBlockReward: (blockHeight: number) => {
      const halvings = Math.floor(blockHeight / HALVING_INTERVAL);
      if (halvings >= 64) return 0; // Max number of halvings
      return Math.floor(INITIAL_REWARD * Math.pow(0.5, halvings));
    },
    isMaxSupplyReached: (currentSupply: number) => {
      return currentSupply >= 69690000;
    },
  },
};

export interface DiscoveryConfig {
  seedNodes?: string[];
  maxPeers?: number;
  minPeers?: number;
  version?: string;
}

export interface ConsensusConfig {
  epochLength: number;
  enableHybrid: boolean;
  minStakeAmount: bigint;
  minStakePeriod: number;
  difficulty: number;
  initialDifficulty: number;
  targetBlockTime: number;
  minDifficulty: number;
  maxDifficulty: number;
  lastEpochTime: number;
  minSolutionInterval: number;
}

export interface BlockchainConfig {
  currency: {
    name: string;
    symbol: string;
    decimals: number;
    initialSupply: number;
    maxSupply: number;
    units: {
      MACRO: bigint;
      MICRO: bigint;
      MILLI: bigint;
      TAG: bigint;
    };
  };
  mining: {
    blocksPerYear: number;
    initialReward: bigint;
    halvingInterval: number;
    maxHalvings: number;
    blockTime: number;
    maxDifficulty: number;
    targetTimePerBlock: number;
    difficulty: number;
    minHashthreshold: number;
    minPowNodes: number;
    maxForkDepth: number;
    emergencyPowThreshold: number;
    minPowScore: number;
    forkResolutionTimeout: number;
    difficultyAdjustmentInterval: number;
    initialDifficulty: number;
    hashBatchSize: number;
    maxTarget: bigint;
    minDifficulty: number;
    chainDecisionThreshold: number;
    orphanWindow: number;
    propagationWindow: number;
    maxPropagationTime: number;
    targetTimespan: number;
    targetBlockTime: number;
  };
  network: {
    type: NetworkType;
    port: number;
    host: string;
    seedDomains: string[];
  };
  votingConstants: {
    votingPeriodBlocks: number;
    votingPeriodMs: number;
    minPowWork: number;
    cooldownBlocks: number;
    maxVotesPerPeriod: number;
    minAccountAge: number;
    minPeerCount: number;
    voteEncryptionVersion: string;
    maxVoteSizeBytes: number;
    votingWeight: number;
    minVotesForValidity: number;
    votePowerDecay: number;
  };
  consensus: {
    powWeight: number;
    voteWeight: number;
    minPowHashrate: number;
    minVoterCount: number;
    minPeriodLength: number;
    votingPeriod: number;
    minParticipation: number;
    votePowerCap: number;
    votingDayPeriod: number;
    consensusTimeout: number;
    emergencyTimeout: number;
  };
  util: {
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
  };
  wallet: {
    address: string;
    privateKey: string | (() => Promise<string>);
    publicKey: string | (() => Promise<string>);
  };
}

export interface NetworkNode {
  address: string;
  lastSeen: number;
  version: string;
  status: "active" | "inactive";
}

export type Config = DiscoveryConfig & BlockchainConfig;

export class ConfigService {
  public config: BlockchainConfig;

  constructor(config?: BlockchainConfig) {
    this.config = config || defaultConfig;
  }

  static getConfig(): BlockchainConfig {
    return defaultConfig;
  }

  get consensus() {
    return this.config.consensus;
  }

  get<T>(key: string): T {
    return JSON.parse(process.env[key] || "{}") as T;
  }
}

const defaultConfig: BlockchainConfig = {
  network: {
    type: NetworkType.MAINNET,
    port: 8333,
    host: "localhost",
    seedDomains: [
      "seed1.h3tag.net", // US East
      "seed2.h3tag.net", // US West
      "seed3.h3tag.net", // Europe
      "seed4.h3tag.net", // Asia
      "seed5.h3tag.net", // Africa
      "seed6.h3tag.net", // South America
    ],
  },
  currency: {
    name: "H3TAG",
    symbol: "TAG",
    decimals: 18,
    initialSupply: 21000000,
    maxSupply: 69690000,
    units: {
      MACRO: 1n,
      MICRO: 1000000n,
      MILLI: 1000000000n,
      TAG: 1000000000000n,
    },
  },
  mining: {
    blocksPerYear: 52560,
    initialReward: 50n,
    halvingInterval: 210000,
    maxHalvings: 69,
    blockTime: 600,
    maxDifficulty: 1000000,
    targetTimePerBlock: 60000,
    difficulty: 7,
    minHashthreshold: 1000000,
    minPowNodes: 3,
    maxForkDepth: 100,
    emergencyPowThreshold: 0.85,
    minPowScore: 0.51,
    forkResolutionTimeout: 600000,
    difficultyAdjustmentInterval: 2016,
    initialDifficulty: 1,
    hashBatchSize: 10000,
    minDifficulty: 3,
    chainDecisionThreshold: 0.67,
    orphanWindow: 100,
    propagationWindow: 50,
    maxPropagationTime: 30000,
    targetTimespan: 14 * 24 * 60 * 60,
    targetBlockTime: 600,
    maxTarget: BigInt(
      "0x00000000ffff0000000000000000000000000000000000000000000000000000"
    ),
  },
  votingConstants: {
    votingPeriodBlocks: 210240,
    votingPeriodMs: 690 * 24 * 60 * 60 * 1000,
    minPowWork: 1000,
    cooldownBlocks: 1000,
    maxVotesPerPeriod: 1000,
    minAccountAge: 1000,
    minPeerCount: 1000,
    voteEncryptionVersion: "1.0",
    maxVoteSizeBytes: 1000,
    votingWeight: 1000,
    minVotesForValidity: 1000,
    votePowerDecay: 1000,
  },
  consensus: {
    powWeight: 0.6,
    voteWeight: 0.4,
    minPowHashrate: 1000000,
    minVoterCount: 1000,
    minPeriodLength: 1000,
    votingPeriod: 210240,
    minParticipation: 0.1,
    votePowerCap: 0.05,
    votingDayPeriod: 690 * 24 * 60 * 60 * 1000,
    consensusTimeout: 30 * 60 * 1000, // 30 minutes
    emergencyTimeout: 60 * 60 * 1000, // 1 hour
  },
  wallet: {
    address: "",
    publicKey: async () => {
      const keyPair = await KeyManager.generateKeyPair();
      return typeof keyPair.publicKey === "function"
        ? await keyPair.publicKey()
        : keyPair.publicKey;
    },
    privateKey: async () => {
      const keyPair = await KeyManager.generateKeyPair();
      return typeof keyPair.privateKey === "function"
        ? await keyPair.privateKey()
        : keyPair.privateKey;
    },
  },
  util: {
    retryAttempts: 3,
    retryDelayMs: 1000,
    cacheTtlHours: 24,
    validationTimeoutMs: 30000,
    initialRetryDelay: 1000,
    maxRetryDelay: 30000,
    backoffFactor: 2,
    maxRetries: 1000,
    cacheTtl: 60000, // 1 minute,
    pruneThreshold: 0.8,
  },
};
