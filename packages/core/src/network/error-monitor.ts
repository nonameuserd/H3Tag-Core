import { Logger } from '@h3tag-blockchain/shared';
import { EventEmitter } from 'events';

export class ErrorMonitor extends EventEmitter {
  private readonly errorCounts: Map<string, number> = new Map();
  private readonly errorThresholds: Map<string, number> = new Map();
  private readonly alertCallbacks: ((type: string, count: number) => void)[] =
    [];
  private readonly alertedErrorTypes: Set<string> = new Set();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(private readonly windowSize = 3600000) {
    super();
    this.cleanupInterval = setInterval(() => this.cleanup(), this.windowSize);
  }

  record(type: string, error: Error): void {
    const count = (this.errorCounts.get(type) || 0) + 1;
    this.errorCounts.set(type, count);

    const threshold = this.errorThresholds.get(type);
    if (threshold && count >= threshold && !this.alertedErrorTypes.has(type)) {
      this.alertCallbacks.forEach((cb) => {
        try {
          cb(type, count);
        } catch (callbackError) {
          Logger.error('Alert callback error:', callbackError);
        }
      });
      this.alertedErrorTypes.add(type);
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
    this.alertedErrorTypes.clear();
  }

  public dispose(): void {
    clearInterval(this.cleanupInterval);
  }
}
