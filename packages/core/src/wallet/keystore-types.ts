export interface KeystoreSecurityConfig {
  rotationPeriod: number; // in milliseconds
  backupInterval: number; // in milliseconds
  maxKeyAge: number; // in milliseconds
  alertThreshold: number; // number of failed attempts before alerting
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
