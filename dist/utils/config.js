"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigService = exports.NetworkType = void 0;
const crypto_1 = require("@h3tag-blockchain/crypto");
const HALVING_INTERVAL = 210000;
const INITIAL_REWARD = 50;
var NetworkType;
(function (NetworkType) {
    NetworkType["MAINNET"] = "mainnet";
    NetworkType["TESTNET"] = "testnet";
    NetworkType["DEVNET"] = "devnet";
})(NetworkType = exports.NetworkType || (exports.NetworkType = {}));
exports.default = {
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
            "seed6.h3tag.network"
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
        maxDifficulty: 32
    },
    blockchain: {
        maxSupply: 69690000,
        initialSupply: 21000000,
        initialReward: 50,
        halvingInterval: 210000,
        blockTime: 600,
        getBlockReward: (blockHeight) => {
            const halvings = Math.floor(blockHeight / HALVING_INTERVAL);
            if (halvings >= 64)
                return 0; // Max number of halvings
            return Math.floor(INITIAL_REWARD * Math.pow(0.5, halvings));
        },
        isMaxSupplyReached: (currentSupply) => {
            return currentSupply >= 69690000;
        }
    }
};
class ConfigService {
    constructor(config) {
        this.config = config || defaultConfig;
    }
    static getConfig() {
        return defaultConfig;
    }
    get consensus() {
        return this.config.consensus;
    }
    get(key) {
        return JSON.parse(process.env[key] || '{}');
    }
}
exports.ConfigService = ConfigService;
const defaultConfig = {
    network: {
        type: NetworkType.MAINNET,
        port: 8333,
        host: 'localhost',
        seedDomains: [
            "seed1.h3tag.net",
            "seed2.h3tag.net",
            "seed3.h3tag.net",
            "seed4.h3tag.net",
            "seed5.h3tag.net",
            "seed6.h3tag.net", // South America
        ]
    },
    currency: {
        name: 'H3TAG',
        symbol: 'TAG',
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
        maxTarget: BigInt("0x00000000ffff0000000000000000000000000000000000000000000000000000"),
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
        consensusTimeout: 30 * 60 * 1000,
        emergencyTimeout: 60 * 60 * 1000, // 1 hour
    },
    wallet: {
        address: '',
        publicKey: async () => {
            const keyPair = await crypto_1.KeyManager.generateKeyPair();
            return typeof keyPair.publicKey === 'function'
                ? await keyPair.publicKey()
                : keyPair.publicKey;
        },
        privateKey: async () => {
            const keyPair = await crypto_1.KeyManager.generateKeyPair();
            return typeof keyPair.privateKey === 'function'
                ? await keyPair.privateKey()
                : keyPair.privateKey;
        }
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
        cacheTtl: 60000,
        pruneThreshold: 0.8,
    },
};
//# sourceMappingURL=config.js.map