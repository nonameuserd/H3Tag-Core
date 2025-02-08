import { Logger } from '@h3tag-blockchain/shared';
import { IAuditStorage } from './audit';

export class InMemoryAuditStorage implements IAuditStorage {
  private auditLogs: Map<string, string> = new Map();
  private locks: Map<string, boolean> = new Map();
  private readonly MAX_LOG_ENTRIES = 10000; // Add maximum capacity

  async writeAuditLog(filename: string, data: string): Promise<void> {
    if (!filename || typeof filename !== 'string') {
      throw new Error('Invalid filename');
    }
    if (!data || typeof data !== 'string') {
      throw new Error('Invalid audit data');
    }
    // If the log already exists, remove it to refresh its insertion order.
    if (this.auditLogs.has(filename)) {
      this.auditLogs.delete(filename);
    }
    // Add cleanup when reaching capacity
    if (this.auditLogs.size >= this.MAX_LOG_ENTRIES) {
      const oldestKey = this.auditLogs.keys().next().value;
      if (oldestKey) {
        this.auditLogs.delete(oldestKey);
      }
    }
    this.auditLogs.set(filename, data);
    Logger.debug(`Audit log written: ${filename}`);
  }

  async readAuditLog(filename: string): Promise<string> {
    const data = this.auditLogs.get(filename);
    if (!data) {
      throw new Error(
        `Audit log not found: ${filename}. Available logs: ${Array.from(this.auditLogs.keys()).join(', ')}`,
      );
    }
    return data;
  }

  async listAuditLogs(): Promise<string[]> {
    return Array.from(this.auditLogs.keys());
  }

  async acquireLock(lockId: string): Promise<boolean> {
    const MAX_ATTEMPTS = 10;
    const RETRY_DELAY = 50;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (!this.locks.get(lockId)) {
        this.locks.set(lockId, true);
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
    return false;
  }

  async releaseLock(lockId: string): Promise<void> {
    this.locks.delete(lockId);
  }
}
