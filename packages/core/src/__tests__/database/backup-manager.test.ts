import { promises as fs } from 'fs';
import { join } from 'path';
import { BackupManager } from '../../database/backup-manager';
import { Logger } from '@h3tag-blockchain/shared';
import { Readable, Writable } from 'stream';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';

// Mock external dependencies
jest.mock('fs');
jest.mock('zlib');
jest.mock('stream/promises');
jest.mock('crypto');

// Mock the logger
jest.mock('@h3tag-blockchain/shared', () => {
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    http: jest.fn(),
    debug: jest.fn(),
  };

  return {
    Logger: mockLogger,
    __esModule: true,
    default: mockLogger,
  };
});

describe('BackupManager', () => {
  let backupManager: BackupManager;
  const mockDbPath = '/test/db';
  const mockBackupPath = '/test/db/backups';
  const defaultConfig = {
    maxBackups: 5,
    compressionLevel: 6,
    backupPath: mockBackupPath,
    retentionDays: 7,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup fs mocks
    const mockFs = {
      promises: {
        mkdir: jest.fn(),
        readdir: jest.fn(),
        writeFile: jest.fn(),
        readFile: jest.fn(),
        stat: jest.fn(),
        rm: jest.fn().mockImplementation(() => Promise.resolve()),
        access: jest.fn(),
      },
      createReadStream: jest.fn(() => new Readable({ read() {} })),
      createWriteStream: jest.fn(() => new Writable({ write() {} })),
    };

    // Setup zlib mocks
    const mockZlib = {
      createGzip: jest.fn(() => new Readable({ read() {} })),
      createGunzip: jest.fn(() => new Writable({ write() {} })),
    };

    // Setup stream mocks
    const mockStream = {
      pipeline: jest.fn().mockImplementation(() => Promise.resolve()),
    };

    // Setup crypto mock
    const mockHash = {
      update: jest.fn(),
      digest: jest.fn().mockReturnValue('valid-checksum'),
    };
    (createHash as jest.Mock).mockReturnValue(mockHash);

    // Apply mocks
    (jest.requireMock('fs')).promises = mockFs.promises;
    (jest.requireMock('fs')).createReadStream = mockFs.createReadStream;
    (jest.requireMock('fs')).createWriteStream = mockFs.createWriteStream;
    (jest.requireMock('zlib')).createGzip = mockZlib.createGzip;
    (jest.requireMock('zlib')).createGunzip = mockZlib.createGunzip;
    (jest.requireMock('stream/promises')).pipeline = mockStream.pipeline;

    backupManager = new BackupManager(mockDbPath, defaultConfig);
  });

  describe('createBackup', () => {
    it('should create a backup successfully', async () => {
      const mockFiles = ['file1.db', 'file2.db'];
      const mockStats = { isFile: () => true, size: 1000 };

      (fs.readdir as jest.Mock)
        .mockImplementation((path) => {
          if (path === mockDbPath) return Promise.resolve(mockFiles);
          return Promise.resolve(['file1.gz', 'file2.gz']);
        });
      
      (fs.stat as jest.Mock)
        .mockImplementation(() => Promise.resolve(mockStats));
      
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (pipeline as jest.Mock).mockResolvedValue(undefined);
      
      const result = await backupManager.createBackup('test-backup');
      
      expect(result).toContain('backup-test-backup');
      expect(fs.mkdir).toHaveBeenCalledWith(mockBackupPath, { recursive: true });
      expect(fs.writeFile).toHaveBeenCalled();
      expect(pipeline).toHaveBeenCalled();
    });

    it('should throw error if no files to backup', async () => {
      (fs.readdir as jest.Mock).mockResolvedValueOnce([]);

      await expect(backupManager.createBackup('test-backup'))
        .rejects
        .toThrow('No files found to backup');
    });

    it('should clean up on failure', async () => {
      (fs.readdir as jest.Mock).mockRejectedValueOnce(new Error('Read error'));
      
      await expect(backupManager.createBackup('test-backup'))
        .rejects
        .toThrow('Read error');
      
      expect(Logger.error).toHaveBeenCalled();
    });
  });

  describe('verifyBackup', () => {
    const mockBackupDir = join(mockBackupPath, 'backup-test');

    it('should verify a valid backup', async () => {
      const mockMetadata = {
        timestamp: '2024-01-01',
        label: 'test',
        size: 1000,
        checksum: 'valid-checksum',
        compressionLevel: 6,
        dbVersion: '1.0.0',
      };

      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockMetadata));
      (fs.readdir as jest.Mock)
        .mockImplementation((path) => {
          if (path === mockBackupDir) {
            return Promise.resolve(['file1.gz', 'file2.gz', 'metadata.json']);
          }
          return Promise.resolve(['file1.gz', 'file2.gz']);
        });
      (fs.stat as jest.Mock).mockResolvedValue({ isFile: () => true, size: 1000 });
      (pipeline as jest.Mock).mockResolvedValue(undefined);

      const result = await backupManager.verifyBackup(mockBackupDir);
      expect(result).toBe(true);
    });

    it('should return false for invalid metadata', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue('{"invalid": "metadata"}');

      const result = await backupManager.verifyBackup(mockBackupDir);
      expect(result).toBe(false);
    });

    it('should return false when metadata file is missing', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));

      const result = await backupManager.verifyBackup(mockBackupDir);
      expect(result).toBe(false);
    });
  });

  describe('restoreBackup', () => {
    const mockBackupDir = join(mockBackupPath, 'backup-test');

    it('should restore backup successfully', async () => {
      const mockFiles = ['file1.gz', 'file2.gz'];
      const mockMetadata = {
        timestamp: '2024-01-01',
        label: 'test',
        size: 1000,
        checksum: 'valid-checksum',
        compressionLevel: 6,
        dbVersion: '1.0.0',
      };

      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockMetadata));
      (fs.readdir as jest.Mock)
        .mockImplementation((path) => {
          if (path === mockBackupDir) {
            return Promise.resolve([...mockFiles, 'metadata.json']);
          }
          return Promise.resolve(mockFiles);
        });
      (fs.stat as jest.Mock).mockResolvedValue({ isFile: () => true, size: 1000 });
      (pipeline as jest.Mock).mockResolvedValue(undefined);
      
      await backupManager.restoreBackup(mockBackupDir);
      
      expect(pipeline).toHaveBeenCalledTimes(mockFiles.length * 2);
      expect(Logger.info).toHaveBeenCalled();
    });

    it('should throw error if backup verification fails', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));

      await expect(backupManager.restoreBackup(mockBackupDir))
        .rejects
        .toThrow('Backup verification failed');
    });
  });

  describe('getLatestBackup', () => {
    it('should return the latest backup', async () => {
      const mockBackups = [
        'backup-test-2024-01-02',
        'backup-test-2024-01-01',
      ];

      (fs.readdir as jest.Mock).mockResolvedValue(mockBackups);

      const result = await backupManager.getLatestBackup();
      expect(result).toBe(join(mockBackupPath, mockBackups[0]));
    });

    it('should return null if no backups exist', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([]);

      const result = await backupManager.getLatestBackup();
      expect(result).toBeNull();
    });
  });

  describe('cleanup and disposal', () => {
    it('should dispose resources properly', async () => {
      await backupManager.dispose();
      expect(Logger.warn).not.toHaveBeenCalled();
    });

    it('should clean old backups based on retention policy', async () => {
      const mockBackups = Array.from({ length: 10 }, (_, i) => 
        `backup-test-2024-01-${String(i + 1).padStart(2, '0')}`
      );

      (fs.readdir as jest.Mock)
        .mockImplementation((path) => {
          if (path === mockDbPath) {
            return Promise.resolve(['file1.db']);
          }
          return Promise.resolve(mockBackups);
        });

      (fs.stat as jest.Mock).mockResolvedValue({ 
        mtime: new Date('2024-01-01'),
        isFile: () => true,
        size: 1000,
      });

      await backupManager.createBackup('test');
      
      expect(fs.rm).toHaveBeenCalled();
    });
  });
});
