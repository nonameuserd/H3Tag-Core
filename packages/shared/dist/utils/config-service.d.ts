import { BlockchainConfig } from './config';
export declare class ConfigurationError extends Error {
    readonly key?: string;
    constructor(message: string, key?: string);
}
export declare class ConfigService {
    private readonly config;
    private readonly cache;
    private static instance;
    constructor(customConfig?: Partial<BlockchainConfig>);
    static getInstance(customConfig?: Partial<BlockchainConfig>): ConfigService;
    get<T>(key: string, defaultValue?: T): T;
    getConfig(): BlockchainConfig;
    has(key: string): boolean;
    clearCache(): void;
    private validateConfig;
    private toEnvKey;
    private parseValue;
    static resetInstance(): void;
}
