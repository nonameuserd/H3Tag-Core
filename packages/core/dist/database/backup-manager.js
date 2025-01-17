"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupManager = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const shared_1 = require("@h3tag-blockchain/shared");
const crypto_1 = require("crypto");
const zlib_1 = require("zlib");
const promises_1 = require("stream/promises");
const fs_2 = require("fs");
const promises_2 = require("timers/promises");
const async_mutex_1 = require("async-mutex");
const TIMEOUT_MS = 30000; // 30 seconds
const MAX_QUEUE_SIZE = 100;
class LockError extends Error {
    constructor(message) {
        super(message);
        this.name = "LockError";
    }
}
class BackupManager {
    constructor(dbPath, config = {}) {
        this.mutex = new async_mutex_1.Mutex();
        this.isProcessing = false;
        this.isLocked = false;
        this.queue = [];
        this.dbPath = dbPath;
        this.config = {
            maxBackups: config.maxBackups || 5,
            compressionLevel: config.compressionLevel || 6,
            backupPath: config.backupPath || (0, path_1.join)(dbPath, "../backups"),
            retentionDays: config.retentionDays || 7,
        };
    }
    async withLock(operation) {
        const release = await this.mutex.acquire();
        try {
            return await Promise.race([
                operation(),
                (0, promises_2.setTimeout)(TIMEOUT_MS).then(() => {
                    throw new LockError("Operation timeout exceeded");
                }),
            ]);
        }
        finally {
            release();
        }
    }
    async createBackup(label) {
        return this.withLock(async () => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const backupPath = (0, path_1.join)(this.config.backupPath, `backup-${label}-${timestamp}`);
            try {
                await fs_1.promises.mkdir(this.config.backupPath, { recursive: true });
                await this.compressDatabase(backupPath);
                const metadata = {
                    timestamp,
                    label,
                    size: await this.getDirectorySize(backupPath),
                    checksum: await this.createChecksum(backupPath),
                    compressionLevel: this.config.compressionLevel,
                    dbVersion: process.env.DB_VERSION || "1.0.0",
                };
                await fs_1.promises.writeFile((0, path_1.join)(backupPath, "metadata.json"), JSON.stringify(metadata, null, 2));
                await this.cleanOldBackups();
                return backupPath;
            }
            catch (error) {
                await this.cleanupFailedBackup(backupPath, error);
                throw error;
            }
        });
    }
    async compressDatabase(backupPath) {
        let backupDirCreated = false;
        try {
            const files = await fs_1.promises.readdir(this.dbPath);
            if (files.length === 0) {
                throw new Error("No files found to backup");
            }
            await fs_1.promises.mkdir(backupPath, { recursive: true });
            backupDirCreated = true;
            await Promise.all(files.map((file) => this.compressFile(file, backupPath)));
        }
        catch (error) {
            if (backupDirCreated) {
                await fs_1.promises
                    .rm(backupPath, { recursive: true, force: true })
                    .catch((err) => shared_1.Logger.error("Failed to cleanup after compression error:", err));
            }
            throw error;
        }
    }
    async compressFile(file, backupPath) {
        const sourceFile = (0, path_1.join)(this.dbPath, file);
        const targetFile = (0, path_1.join)(backupPath, `${file}.gz`);
        try {
            const stats = await fs_1.promises.stat(sourceFile);
            if (!stats.isFile())
                return;
            await (0, promises_1.pipeline)((0, fs_2.createReadStream)(sourceFile), (0, zlib_1.createGzip)({ level: this.config.compressionLevel }), (0, fs_2.createWriteStream)(targetFile));
        }
        catch (error) {
            shared_1.Logger.error(`Failed to compress file ${file}:`, error);
            await fs_1.promises.rm(targetFile, { force: true }).catch(() => { });
            throw error;
        }
    }
    async createChecksum(path) {
        const files = await fs_1.promises.readdir(path);
        const hash = (0, crypto_1.createHash)("sha256");
        for (const file of files.sort()) {
            // Sort for consistency
            const filePath = (0, path_1.join)(path, file);
            const stats = await fs_1.promises.stat(filePath);
            if (!stats.isFile())
                continue;
            await (0, promises_1.pipeline)((0, fs_2.createReadStream)(filePath), async function* (source) {
                for await (const chunk of source) {
                    hash.update(chunk);
                }
            });
        }
        return hash.digest("hex");
    }
    async processQueue() {
        if (this.isProcessing)
            return;
        return this.withLock(async () => {
            this.isProcessing = true;
            const errors = [];
            try {
                while (this.queue.length > 0) {
                    const task = this.queue.shift();
                    if (!task)
                        continue;
                    try {
                        await this.executeTaskWithRetry(task);
                    }
                    catch (error) {
                        shared_1.Logger.error("Queue task failed:", error);
                        errors.push(error);
                    }
                }
                if (errors.length > 0) {
                    throw new Error(errors.map((e) => e.message).join(", "));
                }
            }
            finally {
                this.isProcessing = false;
            }
        });
    }
    async executeTaskWithRetry(task, maxRetries = 3) {
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await Promise.race([
                    task(),
                    (0, promises_2.setTimeout)(TIMEOUT_MS).then(() => {
                        throw new Error("Task timeout exceeded");
                    }),
                ]);
                return; // Success
            }
            catch (error) {
                lastError = error;
                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                    await (0, promises_2.setTimeout)(delay);
                }
            }
        }
        throw lastError || new Error("Task failed after retries");
    }
    async queueTask(task) {
        if (this.queue.length >= MAX_QUEUE_SIZE) {
            throw new Error("Queue is full");
        }
        this.queue.push(task);
        return this.processQueue();
    }
    async getLatestBackup() {
        try {
            const backups = await fs_1.promises.readdir(this.config.backupPath);
            const sortedBackups = backups
                .filter((b) => b.startsWith("backup-"))
                .sort((a, b) => b.localeCompare(a));
            return sortedBackups.length
                ? (0, path_1.join)(this.config.backupPath, sortedBackups[0])
                : null;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get latest backup:", error);
            return null;
        }
    }
    validateBackupPath(path) {
        if (!path || typeof path !== "string") {
            throw new Error("Invalid backup path");
        }
        if (!path.startsWith(this.config.backupPath)) {
            throw new Error("Backup path must be within configured backup directory");
        }
    }
    async verifyBackup(backupPath) {
        this.validateBackupPath(backupPath);
        try {
            const metadataPath = (0, path_1.join)(backupPath, "metadata.json");
            const metadataExists = await fs_1.promises
                .access(metadataPath)
                .then(() => true)
                .catch(() => false);
            if (!metadataExists) {
                shared_1.Logger.error("Backup metadata not found");
                return false;
            }
            const metadata = JSON.parse(await fs_1.promises.readFile(metadataPath, "utf8"));
            // Validate metadata structure
            if (!this.isValidMetadata(metadata)) {
                shared_1.Logger.error("Invalid backup metadata structure");
                return false;
            }
            const currentChecksum = await this.createChecksum(backupPath);
            return currentChecksum === metadata.checksum;
        }
        catch (error) {
            shared_1.Logger.error("Backup verification failed:", error);
            return false;
        }
    }
    isValidMetadata(metadata) {
        return (typeof metadata === "object" &&
            metadata !== null &&
            "timestamp" in metadata &&
            "checksum" in metadata &&
            "size" in metadata &&
            "label" in metadata &&
            "compressionLevel" in metadata &&
            "dbVersion" in metadata);
    }
    async copyAndDecompressDatabase(backupPath, targetPath) {
        await fs_1.promises.mkdir(targetPath, { recursive: true });
        const files = await fs_1.promises.readdir(backupPath);
        await Promise.all(files
            .filter((f) => f.endsWith(".gz"))
            .map((file) => (0, promises_1.pipeline)((0, fs_2.createReadStream)((0, path_1.join)(backupPath, file)), (0, zlib_1.createGunzip)(), (0, fs_2.createWriteStream)((0, path_1.join)(targetPath, file.replace(".gz", ""))))));
    }
    async restoreBackup(backupPath, targetPath) {
        return new Promise((resolve, reject) => {
            const task = async () => {
                try {
                    await this.acquireLock();
                    if (!(await this.verifyBackup(backupPath))) {
                        throw new Error("Backup verification failed");
                    }
                    const restorePath = targetPath || this.dbPath;
                    await this.copyAndDecompressDatabase(backupPath, restorePath);
                    shared_1.Logger.info("Backup restored successfully:", { path: backupPath });
                    resolve();
                }
                catch (error) {
                    shared_1.Logger.error("Restore failed:", error);
                    reject(error);
                }
                finally {
                    this.releaseLock();
                }
            };
            this.queueTask(task).catch(reject);
        });
    }
    async dispose() {
        return this.withLock(async () => {
            if (this.isProcessing) {
                shared_1.Logger.warn("Waiting for queue to complete before disposal...");
                let attempts = 0;
                while (this.isProcessing && attempts < 30) {
                    await (0, promises_2.setTimeout)(100);
                    attempts++;
                }
                if (this.isProcessing) {
                    shared_1.Logger.error("Force stopping queue processing");
                }
            }
            // Clear any remaining tasks
            const remainingTasks = this.queue.length;
            if (remainingTasks > 0) {
                shared_1.Logger.warn(`Disposing with ${remainingTasks} pending tasks`);
            }
            this.queue = [];
            this.isProcessing = false;
        });
    }
    async cleanOldBackups() {
        try {
            const backups = await fs_1.promises.readdir(this.config.backupPath);
            const sortedBackups = backups
                .filter((b) => b.startsWith("backup-"))
                .sort((a, b) => b.localeCompare(a));
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
            await Promise.all(sortedBackups.slice(this.config.maxBackups).map(async (backup) => {
                const backupPath = (0, path_1.join)(this.config.backupPath, backup);
                const stats = await fs_1.promises.stat(backupPath);
                if (stats.mtime < cutoffDate) {
                    await fs_1.promises.rm(backupPath, { recursive: true }).catch((error) => {
                        shared_1.Logger.error(`Failed to delete old backup ${backup}:`, error);
                    });
                }
            }));
        }
        catch (error) {
            shared_1.Logger.error("Failed to clean old backups:", error);
            throw error;
        }
    }
    async getDirectorySize(path) {
        const files = await fs_1.promises.readdir(path);
        const stats = await Promise.all(files.map((file) => fs_1.promises.stat((0, path_1.join)(path, file))));
        return stats.reduce((acc, stat) => acc + stat.size, 0);
    }
    async cleanup() {
        await this.dispose();
    }
    async acquireLock(timeoutMs = TIMEOUT_MS) {
        const startTime = Date.now();
        while (this.isLocked) {
            if (Date.now() - startTime > timeoutMs) {
                throw new LockError("Timeout while waiting for lock");
            }
            await (0, promises_2.setTimeout)(100);
        }
        this.isLocked = true;
    }
    releaseLock() {
        this.isLocked = false;
    }
    async cleanupFailedBackup(path, error) {
        shared_1.Logger.error("Backup failed:", error);
        try {
            await fs_1.promises.rm(path, { recursive: true, force: true });
        }
        catch (cleanupError) {
            shared_1.Logger.error("Failed to cleanup failed backup:", cleanupError);
        }
    }
}
exports.BackupManager = BackupManager;
//# sourceMappingURL=backup-manager.js.map