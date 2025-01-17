export declare enum NetworkType {
    MAINNET = "mainnet",
    TESTNET = "testnet",
    DEVNET = "devnet"
}
declare const _default: {
    network: {
        port: number;
        peers: any[];
        maxPeerLatency: number;
        dnsSeeds: string[];
    };
    consensus: {
        epochLength: number;
        enableHybrid: boolean;
        minStakeAmount: bigint;
        minStakePeriod: number;
        initialDifficulty: number;
        targetBlockTime: number;
        minDifficulty: number;
        maxDifficulty: number;
    };
    blockchain: {
        maxSupply: number;
        initialSupply: number;
        initialReward: number;
        halvingInterval: number;
        blockTime: number;
        getBlockReward: (blockHeight: number) => number;
        isMaxSupplyReached: (currentSupply: number) => boolean;
    };
};
export default _default;
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
    status: 'active' | 'inactive';
}
export type Config = DiscoveryConfig & BlockchainConfig;
export declare class ConfigService {
    config: BlockchainConfig;
    constructor(config?: BlockchainConfig);
    static getConfig(): BlockchainConfig;
    get consensus(): {
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
    get<T>(key: string): T;
}
