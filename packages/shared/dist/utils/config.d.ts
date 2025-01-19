import { CurrencyConstants } from "./currency-constants";
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
    currency: CurrencyConstants;
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
export declare const defaultConfig: BlockchainConfig;
