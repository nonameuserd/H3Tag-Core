"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseConfig = void 0;
exports.databaseConfig = {
    type: "leveldb",
    defaultRegion: "primary",
    regions: [
        {
            name: "primary",
            isActive: true,
            priority: 1,
        },
    ],
    // Database structure configuration
    databases: {
        utxo: {
            path: "./utxo-schema",
            options: {
                cacheSize: 512 * 1024 * 1024, // 512MB cache for UTXO set
            },
        },
        blockchain: {
            path: "./blockchain-schema",
        },
        mining: {
            path: "./mining-schema",
        },
        voting: {
            path: "./voting-schema",
        },
        votingShard: {
            path: "./voting-shard-schema",
        },
        wallet: {
            path: "./wallet-schema",
        },
        keystore: {
            path: "./keystore-schema",
        },
    },
    options: {
        createIfMissing: true,
        errorIfExists: false,
        compression: true,
        cacheSize: 8 * 1024 * 1024,
        writeBufferSize: 4 * 1024 * 1024,
        blockSize: 4096,
        maxOpenFiles: 1000,
        sync: false, // Set to true for stronger durability guarantees
    },
};
//# sourceMappingURL=config.database.js.map