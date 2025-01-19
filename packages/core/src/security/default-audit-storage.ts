import { Logger } from '@h3tag-blockchain/shared';
import { AuditError } from './audit';
import { IAuditStorage } from './audit';

export class DefaultAuditStorage implements IAuditStorage {
  private logs: Map<string, string> = new Map();
  private locks: Set<string> = new Set();

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
    if (!data) {
      Logger.warn(`Audit log not found: ${filename}`);
      return '';
    }
    return data;
  }

  async listAuditLogs(): Promise<string[]> {
    return Array.from(this.logs.keys());
  }

  async acquireLock(lockId: string): Promise<boolean> {
    if (this.locks.has(lockId)) return false;
    this.locks.add(lockId);
    return true;
  }

  async releaseLock(lockId: string): Promise<void> {
    this.locks.delete(lockId);
  }
}
