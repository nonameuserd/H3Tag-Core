export interface KeystoreSecurityConfig {
    rotationPeriod: number;
    backupInterval: number;
    maxKeyAge: number;
    alertThreshold: number;
    hsmEnabled: boolean;
    monitoringEndpoint?: string;
}
export interface KeystoreAuditLog {
    timestamp: number;
    eventType: "access" | "rotation" | "backup" | "alert" | "error";
    address?: string;
    metadata: Record<string, any>;
}
export interface KeyRotationMetadata {
    lastRotation: number;
    rotationCount: number;
    previousKeyHashes: string[];
}
