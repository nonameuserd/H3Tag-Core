import { Logger } from '@h3tag-blockchain/shared';
import { AuditError } from './audit';
import { IAuditStorage } from './audit';

export class DefaultAuditStorage implements IAuditStorage {
  private logs: Map<string, string> = new Map();
  private locks: Map<string, NodeJS.Timeout> = new Map();

  async writeAuditLog(filename: string, data: string): Promise<void> {
    try {
      this.logs.set(filename, data);
      Logger.debug(`Audit log written: ${filename}`);
    } catch (error) {
      Logger.error('Failed to write audit log:', error);
      throw new AuditError('Failed to write audit log', 'WRITE_FAILED');
    }
  }

  async readAuditLog(filename: string): Promise<string> {
    const data = this.logs.get(filename);
    if (data === undefined) {
      Logger.warn(`Audit log not found: ${filename}`);
      return '';
    }
    return data;
  }

  async listAuditLogs(): Promise<string[]> {
    return Array.from(this.logs.keys());
  }

  async acquireLock(
    lockId: string,
    lockTimeout = 5000,
  ): Promise<boolean> {
    if (this.locks.has(lockId)) return false;

    const timer = setTimeout(() => {
      if (this.locks.has(lockId)) {
        Logger.warn(
          `Lock ${lockId} auto-released after ${lockTimeout}ms timeout`,
        );
        this.locks.delete(lockId);
      }
    }, lockTimeout);
    this.locks.set(lockId, timer);
    return true;
  }

  async releaseLock(lockId: string): Promise<void> {
    const timer = this.locks.get(lockId);
    if (timer) {
      clearTimeout(timer);
      this.locks.delete(lockId);
    }
  }
}
