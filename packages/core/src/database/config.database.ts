export interface RegionConfig {
  name: string;
  isActive: boolean;
  priority: number; // Lower number = higher priority
  replicationTarget?: string[]; // Names of regions to replicate to
}

export interface LevelDBOptions {
  createIfMissing: boolean;
  errorIfExists: boolean;
  compression: boolean;
  cacheSize: number;
  writeBufferSize: number;
  blockSize: number;
  maxOpenFiles: number;
  sync: boolean; // Force sync on write
}

export interface DatabaseConfig {
  // Base configuration
  type: 'leveldb';
  defaultRegion: string;

  // Multi-region support
  regions: RegionConfig[];

  // LevelDB specific options
  options: LevelDBOptions;

  // Database structure configuration
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

export const databaseConfig: DatabaseConfig = {
  type: 'leveldb',
  defaultRegion: 'primary',

  regions: [
    {
      name: 'primary',
      isActive: true,
      priority: 1,
    },
  ],

  // Database structure configuration
  databases: {
    utxo: {
      path: './utxo-schema',
      options: {
        cacheSize: 512 * 1024 * 1024, // 512MB cache for UTXO set
      },
    },
    blockchain: {
      path: './blockchain-schema',
    },
    mining: {
      path: './mining-schema',
    },
    voting: {
      path: './voting-schema',
    },
    votingShard: {
      path: './voting-shard-schema',
    },
    wallet: {
      path: './wallet-schema',
    },
    keystore: {
      path: './keystore-schema',
    },
  },

  options: {
    createIfMissing: true,
    errorIfExists: false,
    compression: true,
    cacheSize: 8 * 1024 * 1024, // 8MB
    writeBufferSize: 4 * 1024 * 1024, // 4MB
    blockSize: 4096,
    maxOpenFiles: 1000,
    sync: false, // Set to true for stronger durability guarantees
  },
};
