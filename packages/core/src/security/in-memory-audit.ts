import { Logger } from '@h3tag-blockchain/shared';
import { IAuditStorage } from './audit';

export class InMemoryAuditStorage implements IAuditStorage {
  private auditLogs: Map<string, string> = new Map();
  private locks: Map<string, boolean> = new Map();

  async writeAuditLog(filename: string, data: string): Promise<void> {
    this.auditLogs.set(filename, data);
    Logger.debug(`Audit log written: ${filename}`);
  }

  async readAuditLog(filename: string): Promise<string> {
    const data = this.auditLogs.get(filename);
    if (!data) {
      throw new Error(`Audit log not found: ${filename}`);
    }
    return data;
  }

  async listAuditLogs(): Promise<string[]> {
    return Array.from(this.auditLogs.keys());
  }

  async acquireLock(lockId: string): Promise<boolean> {
    if (this.locks.get(lockId)) {
      return false;
    }
    this.locks.set(lockId, true);
    return true;
  }

  async releaseLock(lockId: string): Promise<void> {
    this.locks.delete(lockId);
  }
}
