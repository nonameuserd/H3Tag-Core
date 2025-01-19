import { IAuditStorage } from "./audit";
export declare class DefaultAuditStorage implements IAuditStorage {
    private logs;
    private locks;
    writeAuditLog(filename: string, data: string): Promise<void>;
    readAuditLog(filename: string): Promise<string>;
    listAuditLogs(): Promise<string[]>;
    acquireLock(lockId: string): Promise<boolean>;
    releaseLock(lockId: string): Promise<void>;
}
