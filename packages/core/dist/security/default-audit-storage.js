"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultAuditStorage = void 0;
const shared_1 = require("@h3tag-blockchain/shared");
const audit_1 = require("./audit");
class DefaultAuditStorage {
    constructor() {
        this.logs = new Map();
        this.locks = new Set();
    }
    async writeAuditLog(filename, data) {
        try {
            this.logs.set(filename, data);
            shared_1.Logger.debug(`Audit log written: ${filename}`);
        }
        catch (error) {
            shared_1.Logger.error("Failed to write audit log:", error);
            throw new audit_1.AuditError("Failed to write audit log", "WRITE_FAILED");
        }
    }
    async readAuditLog(filename) {
        const data = this.logs.get(filename);
        if (!data) {
            shared_1.Logger.warn(`Audit log not found: ${filename}`);
            return "";
        }
        return data;
    }
    async listAuditLogs() {
        return Array.from(this.logs.keys());
    }
    async acquireLock(lockId) {
        if (this.locks.has(lockId))
            return false;
        this.locks.add(lockId);
        return true;
    }
    async releaseLock(lockId) {
        this.locks.delete(lockId);
    }
}
exports.DefaultAuditStorage = DefaultAuditStorage;
