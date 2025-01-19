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
export declare class BackupManager {
    private readonly dbPath;
    private readonly config;
    private readonly mutex;
    private isProcessing;
    private isLocked;
    private queue;
    constructor(dbPath: string, config?: BackupConfig);
    private withLock;
    createBackup(label: string): Promise<string>;
    private compressDatabase;
    private compressFile;
    private createChecksum;
    private processQueue;
    private executeTaskWithRetry;
    queueTask(task: () => Promise<void>): Promise<void>;
    getLatestBackup(): Promise<string | null>;
    private validateBackupPath;
    verifyBackup(backupPath: string): Promise<boolean>;
    private isValidMetadata;
    copyAndDecompressDatabase(backupPath: string, targetPath: string): Promise<void>;
    restoreBackup(backupPath: string, targetPath?: string): Promise<void>;
    dispose(): Promise<void>;
    private cleanOldBackups;
    private getDirectorySize;
    cleanup(): Promise<void>;
    private acquireLock;
    private releaseLock;
    private cleanupFailedBackup;
}
export {};
