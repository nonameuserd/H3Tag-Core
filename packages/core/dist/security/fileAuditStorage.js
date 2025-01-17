"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileAuditStorage = exports.FileAuditStorageError = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const zlib_1 = __importDefault(require("zlib"));
const util_1 = require("util");
const shared_1 = require("@h3tag-blockchain/shared");
const constants_1 = require("../blockchain/utils/constants");
const gzip = (0, util_1.promisify)(zlib_1.default.gzip);
const gunzip = (0, util_1.promisify)(zlib_1.default.gunzip);
class FileAuditStorageError extends Error {
    constructor(message, code) {
        super(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} Audit Error: ${message}`);
        this.code = code;
        this.name = "FileAuditStorageError";
    }
}
exports.FileAuditStorageError = FileAuditStorageError;
class FileAuditStorage {
    constructor(config = {}) {
        this.locks = new Map();
        this.writeQueue = Promise.resolve();
        this.activeWrites = 0;
        this.lockTimeout = 30000; // 30 seconds
        this.config = { ...FileAuditStorage.DEFAULT_CONFIG, ...config };
        this.initialize();
        this.startLockCleanup();
    }
    async initialize() {
        try {
            await promises_1.default.mkdir(this.config.baseDir, { recursive: true });
            shared_1.Logger.info(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NAME} audit storage initialized`);
        }
        catch (error) {
            const msg = `Failed to initialize ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} audit storage: ${error.message}`;
            shared_1.Logger.error(msg);
            throw new FileAuditStorageError(msg, "INIT_FAILED");
        }
    }
    startLockCleanup() {
        this.lockCleanupInterval = setInterval(() => {
            this.cleanupStaleLocks();
        }, 60000); // Cleanup every minute
        this.lockCleanupInterval.unref();
    }
    async cleanupStaleLocks() {
        const now = Date.now();
        for (const [lockId, timestamp] of this.locks.entries()) {
            if (typeof timestamp === 'number' && now - timestamp > this.lockTimeout) {
                await this.releaseLock(lockId);
            }
        }
    }
    async writeAuditLog(filename, data) {
        while (this.activeWrites >= this.config.maxConcurrentWrites) {
            await this.delay(100);
        }
        this.activeWrites++;
        try {
            await this.queueWrite(async () => {
                const filePath = this.getFilePath(filename);
                let attempt = 0;
                let lastError = null;
                while (attempt < this.config.maxRetries) {
                    try {
                        const compressedData = this.config.compression
                            ? await this.compressData(data)
                            : Buffer.from(data);
                        await promises_1.default.writeFile(filePath, compressedData);
                        return;
                    }
                    catch (error) {
                        lastError = error;
                        attempt++;
                        if (attempt < this.config.maxRetries) {
                            await this.delay(this.config.retryDelay * attempt); // Exponential backoff
                        }
                    }
                }
                throw lastError || new Error('Write failed');
            });
        }
        finally {
            this.activeWrites--;
        }
    }
    async readAuditLog(filename) {
        try {
            const filePath = this.getFilePath(filename);
            const data = await promises_1.default.readFile(filePath);
            return this.config.compression
                ? (await gunzip(data)).toString()
                : data.toString();
        }
        catch (error) {
            throw new FileAuditStorageError(`Failed to read ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} audit log: ${error.message}`, "READ_FAILED");
        }
    }
    async listAuditLogs() {
        try {
            return await promises_1.default.readdir(this.config.baseDir);
        }
        catch (error) {
            throw new FileAuditStorageError(`Failed to list ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} audit logs: ${error.message}`, "LIST_FAILED");
        }
    }
    async acquireLock(lockId) {
        if (this.locks.has(lockId))
            return false;
        this.locks.set(lockId, Date.now());
        return true;
    }
    async releaseLock(lockId) {
        this.locks.delete(lockId);
    }
    async queueWrite(writeOperation) {
        while (this.activeWrites >= this.config.maxConcurrentWrites) {
            await this.delay(100);
        }
        this.activeWrites++;
        try {
            this.writeQueue = this.writeQueue.then(writeOperation);
            await this.writeQueue;
        }
        finally {
            this.activeWrites--;
        }
    }
    getFilePath(filename) {
        return path_1.default.join(this.config.baseDir, filename);
    }
    async compressData(data) {
        try {
            return await gzip(Buffer.from(data));
        }
        catch (error) {
            throw new FileAuditStorageError(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} compression failed: ${error.message}`, "COMPRESSION_FAILED");
        }
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async dispose() {
        clearInterval(this.lockCleanupInterval);
        this.locks.clear();
        await this.writeQueue;
    }
}
exports.FileAuditStorage = FileAuditStorage;
FileAuditStorage.DEFAULT_CONFIG = {
    baseDir: "audit_logs",
    compression: true,
    maxRetries: 3,
    retryDelay: 1000,
    maxConcurrentWrites: 5,
    currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
};
//# sourceMappingURL=fileAuditStorage.js.map