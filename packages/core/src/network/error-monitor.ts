import { Logger } from "@h3tag-blockchain/shared";
export class ErrorMonitor {
  private readonly errorCounts: Map<string, number> = new Map();
  private readonly errorThresholds: Map<string, number> = new Map();
  private readonly alertCallbacks: ((type: string, count: number) => void)[] =
    [];

  constructor(private readonly windowSize: number = 3600000) {
    setInterval(() => this.cleanup(), this.windowSize);
  }

  record(type: string, error: Error): void {
    const count = (this.errorCounts.get(type) || 0) + 1;
    this.errorCounts.set(type, count);

    const threshold = this.errorThresholds.get(type);
    if (threshold && count >= threshold) {
      this.alertCallbacks.forEach((cb) => cb(type, count));
    }

    Logger.error(`[${type}] ${error.message}`, {
      stack: error.stack,
      count,
      timestamp: new Date().toISOString(),
    });
  }

  setThreshold(type: string, threshold: number): void {
    this.errorThresholds.set(type, threshold);
  }

  onThresholdExceeded(callback: (type: string, count: number) => void): void {
    this.alertCallbacks.push(callback);
  }

  private cleanup(): void {
    this.errorCounts.clear();
  }
}
