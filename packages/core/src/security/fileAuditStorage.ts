import fs from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
import { IAuditStorage } from './audit';
import { Logger } from '@h3tag-blockchain/shared';
import { BLOCKCHAIN_CONSTANTS } from '../blockchain/utils/constants';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class FileAuditStorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(`${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} Audit Error: ${message}`);
    this.name = 'FileAuditStorageError';
  }
}

interface StorageConfig {
  baseDir: string;
  compression: boolean;
  maxRetries: number;
  retryDelay: number;
  maxConcurrentWrites: number;
  currency?: string;
  maxFileSize: number;
}

export class FileAuditStorage implements IAuditStorage {
  private readonly config: StorageConfig;
  private locks = new Map<string, number>();
  private writeQueue: Promise<void> = Promise.resolve();
  private activeWrites = 0;
  private readonly lockTimeout = 30000; // 30 seconds
  private lockCleanupInterval: NodeJS.Timeout | undefined;

  private static readonly DEFAULT_CONFIG: StorageConfig = {
    baseDir: 'audit_logs',
    compression: true,
    maxRetries: 3,
    retryDelay: 1000,
    maxConcurrentWrites: 5,
    currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
    maxFileSize: 1024 * 1024 * 100, // 100MB
  };

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...FileAuditStorage.DEFAULT_CONFIG, ...config };
    this.initialize();
    this.startLockCleanup();
  }

  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.config.baseDir, { recursive: true });
      Logger.info(
        `${BLOCKCHAIN_CONSTANTS.CURRENCY.NAME} audit storage initialized`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const msg = `Failed to initialize ${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} audit storage: ${errorMessage}`;
      Logger.error(msg);
      throw new FileAuditStorageError(msg, 'INIT_FAILED');
    }
  }

  private startLockCleanup(): void {
    this.lockCleanupInterval = setInterval(() => {
      this.cleanupStaleLocks();
    }, 60000); // Cleanup every minute
    this.lockCleanupInterval.unref();
  }

  private async cleanupStaleLocks(): Promise<void> {
    const now = Date.now();
    for (const [lockId, timestamp] of this.locks.entries()) {
      if (typeof timestamp === 'number' && now - timestamp > this.lockTimeout) {
        await this.releaseLock(lockId);
      }
    }
  }

  public async writeAuditLog(filename: string, data: string): Promise<void> {
    if (!filename || !data) {
      throw new FileAuditStorageError(
        'Invalid filename or data',
        'INVALID_INPUT',
      );
    }
    if (data.length > this.config.maxFileSize) {
      throw new FileAuditStorageError(
        'File size exceeds limit',
        'FILE_SIZE_LIMIT',
      );
    }
    while (this.activeWrites >= this.config.maxConcurrentWrites) {
      await this.delay(100);
    }

    this.activeWrites++;
    try {
      await this.queueWrite(async () => {
        const filePath = this.getFilePath(filename);
        let attempt = 0;
        let lastError: Error | null = null;

        while (attempt < this.config.maxRetries) {
          try {
            const compressedData = this.config.compression
              ? await this.compressData(data)
              : Buffer.from(data);

            await fs.writeFile(filePath, compressedData);
            return;
          } catch (error: unknown) {
            lastError = error as Error;
            attempt++;
            if (attempt < this.config.maxRetries) {
              await this.delay(this.config.retryDelay * attempt); // Exponential backoff
            }
          }
        }
        throw lastError || new Error('Write failed');
      });
    } catch (error) {
      throw new FileAuditStorageError(
        `Write failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WRITE_FAILED',
      );
    } finally {
      this.activeWrites--;
    }
  }

  public async readAuditLog(filename: string): Promise<string> {
    try {
      const filePath = this.getFilePath(filename);
      const data = await fs.readFile(filePath);

      return this.config.compression
        ? (await gunzip(data)).toString()
        : data.toString();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new FileAuditStorageError(
        `Failed to read ${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} audit log: ${errorMessage}`,
        'READ_FAILED',
      );
    }
  }

  public async listAuditLogs(): Promise<string[]> {
    try {
      return await fs.readdir(this.config.baseDir);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new FileAuditStorageError(
        `Failed to list ${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} audit logs: ${errorMessage}`,
        'LIST_FAILED',
      );
    }
  }

  public async acquireLock(lockId: string): Promise<boolean> {
    if (this.locks.has(lockId)) {
      const timestamp = this.locks.get(lockId);
      if (
        typeof timestamp === 'number' &&
        Date.now() - timestamp > this.lockTimeout
      ) {
        await this.releaseLock(lockId);
      } else {
        return false;
      }
    }
    this.locks.set(lockId, Date.now());
    return true;
  }

  public async releaseLock(lockId: string): Promise<void> {
    this.locks.delete(lockId);
  }

  private async queueWrite(writeOperation: () => Promise<void>): Promise<void> {
    while (this.activeWrites >= this.config.maxConcurrentWrites) {
      await this.delay(100);
    }

    this.activeWrites++;
    try {
      this.writeQueue = this.writeQueue.then(writeOperation).catch(() => {});
      await this.writeQueue;
    } finally {
      this.activeWrites--;
    }
  }

  private getFilePath(filename: string): string {
    const safeFilename = path
      .normalize(filename)
      .replace(/^(\.\.(\/|\\|$))+/g, '');
    return path.join(this.config.baseDir, safeFilename);
  }

  private async compressData(data: string): Promise<Buffer> {
    try {
      return await gzip(Buffer.from(data));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new FileAuditStorageError(
        `${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} compression failed: ${errorMessage}`,
        'COMPRESSION_FAILED',
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public async dispose(): Promise<void> {
    clearInterval(this.lockCleanupInterval);
    this.locks.clear();
    await this.writeQueue;
    this.writeQueue = Promise.resolve(); // Reset the queue
  }
}
