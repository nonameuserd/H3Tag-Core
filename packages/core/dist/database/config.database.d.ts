export interface RegionConfig {
    name: string;
    isActive: boolean;
    priority: number;
    replicationTarget?: string[];
}
export interface LevelDBOptions {
    createIfMissing: boolean;
    errorIfExists: boolean;
    compression: boolean;
    cacheSize: number;
    writeBufferSize: number;
    blockSize: number;
    maxOpenFiles: number;
    sync: boolean;
}
export interface DatabaseConfig {
    type: "leveldb";
    defaultRegion: string;
    regions: RegionConfig[];
    options: LevelDBOptions;
    databases: {
        utxo: {
            path: string;
            options: {
                cacheSize: number;
            };
        };
        blockchain: {
            path: string;
        };
        mining: {
            path: string;
        };
        voting: {
            path: string;
        };
        votingShard: {
            path: string;
        };
        wallet: {
            path: string;
        };
        keystore: {
            path: string;
        };
    };
}
export declare const databaseConfig: DatabaseConfig;
