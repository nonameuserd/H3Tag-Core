"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigService = exports.ConfigurationError = void 0;
const config_1 = require("./config");
const logger_1 = require("./logger");
class ConfigurationError extends Error {
    constructor(message, key) {
        super(message);
        this.key = key;
        this.name = 'ConfigurationError';
    }
}
exports.ConfigurationError = ConfigurationError;
class ConfigService {
    constructor(customConfig) {
        this.cache = new Map();
        if (ConfigService.instance) {
            return ConfigService.instance;
        }
        try {
            this.config = this.validateConfig({
                ...config_1.defaultConfig,
                ...customConfig,
            });
            ConfigService.instance = this;
        }
        catch (error) {
            logger_1.Logger.error('Configuration initialization failed:', error);
            throw new ConfigurationError('Failed to initialize configuration');
        }
    }
    static getInstance(customConfig) {
        if (!ConfigService.instance) {
            ConfigService.instance = new ConfigService(customConfig);
        }
        return ConfigService.instance;
    }
    get(key, defaultValue) {
        try {
            // Check cache first
            const cached = this.cache.get(key);
            if (cached !== undefined) {
                return cached;
            }
            // Handle nested keys like "network.host"
            const keys = key.split('.');
            let value = this.config;
            for (const k of keys) {
                value = value?.[k];
                if (value === undefined) {
                    // Check environment variables
                    const envValue = process.env[this.toEnvKey(key)];
                    if (envValue !== undefined) {
                        return this.parseValue(envValue);
                    }
                    if (defaultValue !== undefined) {
                        return defaultValue;
                    }
                    throw new ConfigurationError(`Configuration key not found: ${key}`, key);
                }
            }
            // Cache the result
            this.cache.set(key, value);
            return value;
        }
        catch (error) {
            logger_1.Logger.error(`Error retrieving config key ${key}:`, error);
            if (defaultValue !== undefined) {
                return defaultValue;
            }
            throw error;
        }
    }
    getConfig() {
        return { ...this.config };
    }
    has(key) {
        try {
            this.get(key);
            return true;
        }
        catch {
            return false;
        }
    }
    clearCache() {
        this.cache.clear();
    }
    validateConfig(config) {
        if (!config.network?.host) {
            throw new ConfigurationError('Network host is required');
        }
        if (!config.network?.port) {
            throw new ConfigurationError('Network port is required');
        }
        // Add more validation as needed
        return config;
    }
    toEnvKey(key) {
        return key.toUpperCase().replace(/\./g, '_');
    }
    parseValue(value) {
        try {
            // Handle different types of values
            if (value.toLowerCase() === 'true')
                return true;
            if (value.toLowerCase() === 'false')
                return false;
            if (value === 'null')
                return null;
            if (value === 'undefined')
                return undefined;
            if (!isNaN(Number(value)))
                return Number(value);
            if (value.startsWith('[') || value.startsWith('{')) {
                return JSON.parse(value);
            }
            return value;
        }
        catch {
            return value;
        }
    }
    // Utility method for testing
    static resetInstance() {
        ConfigService.instance = undefined;
    }
}
exports.ConfigService = ConfigService;
