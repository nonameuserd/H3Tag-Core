import { promises as fs } from 'fs';
import { join } from 'path';
import { Logger } from '@h3tag-blockchain/shared';
import { createHash } from 'crypto';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import { setTimeout } from 'timers/promises';
import { Mutex } from 'async-mutex';

/**
 * @fileoverview BackupManager handles database backup creation, verification, and restoration.
 * It implements compression, checksums, and metadata tracking for reliable backup operations.
 *
 * @module BackupManager
 */

/**
 * BackupManager handles database backup operations with built-in safety checks.
 *
 * @class BackupManager
 *
 * @property {string} dbPath - Path to database directory
 * @property {Required<BackupConfig>} config - Backup configuration
 * @property {Mutex} mutex - Mutex for synchronizing operations
 * @property {boolean} isProcessing - Flag indicating active processing
 * @property {boolean} isLocked - Flag indicating backup lock state
 * @property {Array<() => Promise<void>>} queue - Operation queue
 *
 * @example
 * const manager = new BackupManager(dbPath, config);
 * await manager.createBackup('daily');
 * await manager.verifyBackup(backupPath);
 */

/**
 * @typedef {Object} BackupConfig
 * @property {number} [maxBackups=5] - Maximum number of backups to retain
 * @property {number} [compressionLevel=6] - Compression level (0-9)
 * @property {string} [backupPath] - Custom backup directory path
 * @property {number} [retentionDays=7] - Days to retain backups
 */

/**
 * @typedef {Object} BackupMetadata
 * @property {string} timestamp - Backup creation timestamp
 * @property {string} label - Backup label/identifier
 * @property {number} size - Total backup size in bytes
 * @property {string} checksum - SHA-256 checksum of backup
 * @property {number} compressionLevel - Used compression level
 * @property {string} dbVersion - Database version
 */

/**
 * Creates a new backup with metadata and compression
 *
 * @async
 * @method createBackup
 * @param {string} label - Backup identifier
 * @returns {Promise<string>} Path to created backup
 * @throws {Error} If backup creation fails
 *
 * @example
 * const backupPath = await manager.createBackup('weekly');
 */

/**
 * Verifies backup integrity using checksums
 *
 * @async
 * @method verifyBackup
 * @param {string} backupPath - Path to backup
 * @returns {Promise<boolean>} True if backup is valid
 *
 * @example
 * const isValid = await manager.verifyBackup(backupPath);
 * if (!isValid) {
 *   console.error('Backup verification failed');
 * }
 */

/**
 * Restores database from backup
 *
 * @async
 * @method restoreBackup
 * @param {string} backupPath - Path to backup
 * @param {string} [targetPath] - Optional restore target path
 * @returns {Promise<void>}
 * @throws {Error} If restore operation fails
 *
 * @example
 * await manager.restoreBackup(backupPath);
 */

/**
 * Gets latest available backup
 *
 * @async
 * @method getLatestBackup
 * @returns {Promise<string | null>} Path to latest backup or null
 *
 * @example
 * const latest = await manager.getLatestBackup();
 * if (latest) {
 *   await manager.verifyBackup(latest);
 * }
 */

/**
 * Cleans up old backups based on retention policy
 *
 * @private
 * @async
 * @method cleanOldBackups
 * @returns {Promise<void>}
 */

/**
 * Validates backup path for security
 *
 * @private
 * @method validateBackupPath
 * @param {string} path - Path to validate
 * @throws {Error} If path is invalid or outside backup directory
 */

/**
 * Queues an async operation with retry logic
 *
 * @async
 * @method queueTask
 * @param {() => Promise<void>} task - Task to queue
 * @returns {Promise<void>}
 * @throws {Error} If queue is full
 */

/**
 * Disposes backup manager resources
 *
 * @async
 * @method dispose
 * @returns {Promise<void>}
 */

interface BackupConfig {
  maxBackups?: number;
  compressionLevel?: number;
  backupPath?: string;
  retentionDays?: number;
}

type BackupMetadata = {
  timestamp: string;
  label: string;
  size: number;
  checksum: string;
  compressionLevel: number;
  dbVersion: string;
};

const TIMEOUT_MS = 30000; // 30 seconds
const MAX_QUEUE_SIZE = 100;

class LockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LockError';
  }
}

export class BackupManager {
  private readonly dbPath: string;
  private readonly config: Required<BackupConfig>;
  private readonly mutex = new Mutex();
  private isProcessing = false;
  private isLocked = false;
  private queue: Array<() => Promise<void>> = [];

  constructor(dbPath: string, config: BackupConfig = {}) {
    this.dbPath = dbPath;
    this.config = {
      maxBackups: config.maxBackups || 5,
      compressionLevel: config.compressionLevel || 6,
      backupPath: config.backupPath || join(dbPath, '../backups'),
      retentionDays: config.retentionDays || 7,
    };
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const release = await this.mutex.acquire();
    try {
      return await Promise.race([
        operation(),
        setTimeout(TIMEOUT_MS).then(() => {
          throw new LockError('Operation timeout exceeded');
        }),
      ]);
    } finally {
      release();
    }
  }

  async createBackup(label: string): Promise<string> {
    return this.withLock(async () => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = join(
        this.config.backupPath,
        `backup-${label}-${timestamp}`,
      );

      try {
        await fs.mkdir(this.config.backupPath, { recursive: true });
        await this.compressDatabase(backupPath);

        const metadata: BackupMetadata = {
          timestamp,
          label,
          size: await this.getDirectorySize(backupPath),
          checksum: await this.createChecksum(backupPath),
          compressionLevel: this.config.compressionLevel,
          dbVersion: process.env.DB_VERSION || '1.0.0',
        };

        await fs.writeFile(
          join(backupPath, 'metadata.json'),
          JSON.stringify(metadata, null, 2),
        );

        await this.cleanOldBackups();
        return backupPath;
      } catch (error: unknown) {
        await this.cleanupFailedBackup(backupPath, error as Error);
        throw error;
      }
    });
  }

  private async compressDatabase(backupPath: string): Promise<void> {
    let backupDirCreated = false;
    try {
      const files = await fs.readdir(this.dbPath);

      if (files.length === 0) {
        throw new Error('No files found to backup');
      }

      await fs.mkdir(backupPath, { recursive: true });
      backupDirCreated = true;

      await Promise.all(
        files.map((file) => this.compressFile(file, backupPath)),
      );
    } catch (error: unknown) {
      if (backupDirCreated) {
        await fs
          .rm(backupPath, { recursive: true, force: true })
          .catch((err: unknown) =>
            Logger.error(
              'Failed to cleanup after compression error:',
              err as Error,
            ),
          );
      }
      throw error;
    }
  }

  private async compressFile(file: string, backupPath: string): Promise<void> {
    const sourceFile = join(this.dbPath, file);
    const targetFile = join(backupPath, `${file}.gz`);

    try {
      const stats = await fs.stat(sourceFile);
      if (!stats.isFile()) return;

      await pipeline(
        createReadStream(sourceFile),
        createGzip({ level: this.config.compressionLevel }),
        createWriteStream(targetFile),
      );
    } catch (error) {
      Logger.error(
        `Failed to compress file "${file}" from "${sourceFile}" to "${targetFile}":`,
        error,
      );
      await fs.rm(targetFile, { force: true }).catch(() => {});
      throw error;
    } 
  }

  private async createChecksum(path: string): Promise<string> {
    const files = await fs.readdir(path);
    const hash = createHash('sha256');

    for (const file of files.sort()) {
      // Sort for consistency
      const filePath = join(path, file);
      const stats = await fs.stat(filePath);

      if (!stats.isFile()) continue;

      await pipeline(createReadStream(filePath), async function* (source) {
        for await (const chunk of source) {
          hash.update(chunk);
          yield chunk;
        }
      });
    }

    return hash.digest('hex');
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    return this.withLock(async () => {
      this.isProcessing = true;
      const errors: Error[] = [];

      try {
        while (this.queue.length > 0) {
          const task = this.queue.shift();
          if (!task) continue;

          try {
            await this.executeTaskWithRetry(task);
          } catch (error) {
            Logger.error('Queue task failed:', error);
            errors.push(error as Error);
          }
        }

        if (errors.length > 0) {
          throw new Error(errors.map((e) => e.message).join(', '));
        }
      } finally {
        this.isProcessing = false;
      }
    });
  }

  private async executeTaskWithRetry(
    task: () => Promise<void>,
    maxRetries = 3,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await Promise.race([
          task(),
          setTimeout(TIMEOUT_MS).then(() => {
            throw new Error('Task timeout exceeded');
          }),
        ]);
        return; // Success
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await setTimeout(delay);
        }
      }
    }

    throw lastError || new Error('Task failed after retries');
  }

  async queueTask(task: () => Promise<void>): Promise<void> {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      throw new Error('Queue is full');
    }

    this.queue.push(task);
    return this.processQueue();
  }

  async getLatestBackup(): Promise<string | null> {
    try {
      const backups = await fs.readdir(this.config.backupPath);
      const sortedBackups = backups
        .filter((b) => b.startsWith('backup-'))
        .sort((a, b) => b.localeCompare(a));

      return sortedBackups.length
        ? join(this.config.backupPath, sortedBackups[0])
        : null;
    } catch (error) {
      Logger.error('Failed to get latest backup:', error);
      return null;
    }
  }

  private validateBackupPath(path: string): void {
    if (!path || typeof path !== 'string') {
      throw new Error('Invalid backup path');
    }
    if (!path.startsWith(this.config.backupPath)) {
      throw new Error('Backup path must be within configured backup directory');
    }
  }

  async verifyBackup(backupPath: string): Promise<boolean> {
    this.validateBackupPath(backupPath);

    try {
      const metadataPath = join(backupPath, 'metadata.json');
      const metadataExists = await fs
        .access(metadataPath)
        .then(() => true)
        .catch(() => false);

      if (!metadataExists) {
        Logger.error('Backup metadata not found');
        return false;
      }

      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));

      // Validate metadata structure
      if (!this.isValidMetadata(metadata)) {
        Logger.error('Invalid backup metadata structure');
        return false;
      }

      const currentChecksum = await this.createChecksum(backupPath);
      return currentChecksum === metadata.checksum;
    } catch (error) {
      Logger.error('Backup verification failed:', error);
      return false;
    }
  }

  private isValidMetadata(metadata: unknown): metadata is BackupMetadata {
    if (typeof metadata !== 'object' || metadata === null) {
      return false;
    }
    const meta = metadata as Record<string, unknown>;
    return (
      typeof meta.timestamp === 'string' &&
      typeof meta.label === 'string' &&
      typeof meta.size === 'number' &&
      typeof meta.checksum === 'string' &&
      typeof meta.compressionLevel === 'number' &&
      typeof meta.dbVersion === 'string'
    );
  }

  async copyAndDecompressDatabase(
    backupPath: string,
    targetPath: string,
  ): Promise<void> {
    await fs.mkdir(targetPath, { recursive: true });
    const files = await fs.readdir(backupPath);

    await Promise.all(
      files
        .filter((f) => f.endsWith('.gz'))
        .map((file) =>
          pipeline(
            createReadStream(join(backupPath, file)),
            createGunzip(),
            createWriteStream(join(targetPath, file.replace('.gz', ''))),
          ),
        ),
    );
  }

  async restoreBackup(backupPath: string, targetPath?: string): Promise<void> {
    return this.withLock(async () => {
      if (!(await this.verifyBackup(backupPath))) {
        throw new Error('Backup verification failed');
      }
      const restorePath = targetPath || this.dbPath;
      await this.copyAndDecompressDatabase(backupPath, restorePath);
      Logger.info('Backup restored successfully:', { path: backupPath });
    });
  }

  async dispose(): Promise<void> {
    return this.withLock(async () => {
      if (this.isProcessing) {
        Logger.warn('Waiting for queue to complete before disposal...');
        let attempts = 0;
        while (this.isProcessing && attempts < 30) {
          await setTimeout(100);
          attempts++;
        }
        if (this.isProcessing) {
          Logger.error('Force stopping queue processing');
        }
      }

      // Clear any remaining tasks
      const remainingTasks = this.queue.length;
      if (remainingTasks > 0) {
        Logger.warn(`Disposing with ${remainingTasks} pending tasks`);
      }

      this.queue = [];
      this.isProcessing = false;
    });
  }

  private async cleanOldBackups(): Promise<void> {
    try {
      const backups = await fs.readdir(this.config.backupPath);
      const sortedBackups = backups
        .filter((b) => b.startsWith('backup-'))
        .sort((a, b) => b.localeCompare(a));

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      await Promise.all(
        sortedBackups.slice(this.config.maxBackups).map(async (backup) => {
          const backupPath = join(this.config.backupPath, backup);
          const stats = await fs.stat(backupPath);
          if (stats.mtime < cutoffDate) {
            await fs.rm(backupPath, { recursive: true }).catch((error) => {
              Logger.error(`Failed to delete old backup ${backup}:`, error);
            });
          }
        }),
      );
    } catch (error) {
      Logger.error('Failed to clean old backups:', error);
      throw error;
    }
  }

  private async getDirectorySize(path: string): Promise<number> {
    const files = await fs.readdir(path);
    const stats = await Promise.all(
      files.map(async (file) => {
        const stat = await fs.stat(join(path, file));
        return stat.isFile() ? stat.size : 0;
      }),
    );
    return stats.reduce((acc, size) => acc + size, 0);
  }

  async cleanup(): Promise<void> {
    await this.dispose();
  }

  private async cleanupFailedBackup(path: string, error: Error): Promise<void> {
    Logger.error(`Backup creation failed at "${path}":`, error);
    try {
      await fs.rm(path, { recursive: true, force: true });
    } catch (cleanupError) {
      Logger.error(`Failed to cleanup backup at "${path}":`, cleanupError);
    }
  }
}
