"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryAuditStorage = void 0;
const shared_1 = require("@h3tag-blockchain/shared");
class InMemoryAuditStorage {
    constructor() {
        this.auditLogs = new Map();
        this.locks = new Map();
    }
    async writeAuditLog(filename, data) {
        this.auditLogs.set(filename, data);
        shared_1.Logger.debug(`Audit log written: ${filename}`);
    }
    async readAuditLog(filename) {
        const data = this.auditLogs.get(filename);
        if (!data) {
            throw new Error(`Audit log not found: ${filename}`);
        }
        return data;
    }
    async listAuditLogs() {
        return Array.from(this.auditLogs.keys());
    }
    async acquireLock(lockId) {
        if (this.locks.get(lockId)) {
            return false;
        }
        this.locks.set(lockId, true);
        return true;
    }
    async releaseLock(lockId) {
        this.locks.delete(lockId);
    }
}
exports.InMemoryAuditStorage = InMemoryAuditStorage;
