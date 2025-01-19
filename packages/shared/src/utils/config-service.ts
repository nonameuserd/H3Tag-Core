import { BlockchainConfig, defaultConfig } from './config';
import { Logger } from './logger';

export class ConfigurationError extends Error {
  constructor(message: string, public readonly key?: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class ConfigService {
  private readonly config: BlockchainConfig;
  private readonly cache: Map<string, any> = new Map();
  private static instance: ConfigService;

  constructor(customConfig?: Partial<BlockchainConfig>) {
    if (ConfigService.instance) {
      return ConfigService.instance;
    }

    try {
      this.config = this.validateConfig({
        ...defaultConfig,
        ...customConfig,
      });
      ConfigService.instance = this;
    } catch (error) {
      Logger.error('Configuration initialization failed:', error);
      throw new ConfigurationError('Failed to initialize configuration');
    }
  }

  public static getInstance(customConfig?: Partial<BlockchainConfig>): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService(customConfig);
    }
    return ConfigService.instance;
  }

  public get<T>(key: string, defaultValue?: T): T {
    try {
      // Check cache first
      const cached = this.cache.get(key);
      if (cached !== undefined) {
        return cached as T;
      }

      // Handle nested keys like "network.host"
      const keys = key.split('.');
      let value: any = this.config;

      for (const k of keys) {
        value = value?.[k];
        if (value === undefined) {
          // Check environment variables
          const envValue = process.env[this.toEnvKey(key)];
          if (envValue !== undefined) {
            return this.parseValue<T>(envValue);
          }
          
          if (defaultValue !== undefined) {
            return defaultValue;
          }
          
          throw new ConfigurationError(`Configuration key not found: ${key}`, key);
        }
      }

      // Cache the result
      this.cache.set(key, value);
      return value as T;
    } catch (error) {
      Logger.error(`Error retrieving config key ${key}:`, error);
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw error;
    }
  }

  public getConfig(): BlockchainConfig {
    return { ...this.config };
  }

  public has(key: string): boolean {
    try {
      this.get(key);
      return true;
    } catch {
      return false;
    }
  }

  public clearCache(): void {
    this.cache.clear();
  }

  private validateConfig(config: BlockchainConfig): BlockchainConfig {
    if (!config.network?.host) {
      throw new ConfigurationError('Network host is required');
    }

    if (!config.network?.port) {
      throw new ConfigurationError('Network port is required');
    }

    // Add more validation as needed
    return config;
  }

  private toEnvKey(key: string): string {
    return key.toUpperCase().replace(/\./g, '_');
  }

  private parseValue<T>(value: string): T {
    try {
      // Handle different types of values
      if (value.toLowerCase() === 'true') return true as T;
      if (value.toLowerCase() === 'false') return false as T;
      if (value === 'null') return null as T;
      if (value === 'undefined') return undefined as T;
      if (!isNaN(Number(value))) return Number(value) as T;
      if (value.startsWith('[') || value.startsWith('{')) {
        return JSON.parse(value) as T;
      }
      return value as T;
    } catch {
      return value as T;
    }
  }

  // Utility method for testing
  public static resetInstance(): void {
    ConfigService.instance = undefined as any;
  }
} 