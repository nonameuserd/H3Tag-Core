import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import { Logger } from '@h3tag-blockchain/shared';
import os from 'os';

interface WorkerMetrics {
  tasksProcessed: number;
  errors: number;
  lastActive: number;
  avgProcessingTime: number;
}

export class WorkerPool {
  private workers: Map<Worker, WorkerMetrics> = new Map();
  private available: Worker[] = [];
  private tasks: Queue<Task> = new Queue();
  private readonly maxWorkers: number;
  private readonly maxIdleTime = 60000; // 1 minute
  private readonly healthCheckInterval = 30000; // 30 seconds
  private healthCheckIntervalId: NodeJS.Timeout | undefined;
  private disposed = false;

  constructor(
    maxWorkers: number,
    private readonly scriptPath: string,
    private readonly workerOptions: WorkerOptions = {},
  ) {
    this.maxWorkers = Math.max(1, Math.min(maxWorkers, os.cpus().length));
    this.startHealthCheck();
  }

  private startHealthCheck(): void {
    this.healthCheckIntervalId = setInterval(() => {
      this.checkWorkerHealth();
    }, this.healthCheckInterval);
  }

  private async checkWorkerHealth(): Promise<void> {
    const now = Date.now();
    const idleWorkers = [...this.available];

    for (const worker of idleWorkers) {
      const metrics = this.workers.get(worker);
      if (metrics && now - metrics.lastActive > this.maxIdleTime) {
        await this.terminateWorker(worker);
      }
    }
  }

  // In createWorker(), add a timeout while waiting for the worker to come online,
  // in order to reduce the possibility of hanging indefinitely if the worker fails to start.
  private async createWorker(): Promise<Worker> {
    const worker = new Worker(this.scriptPath, this.workerOptions) as Worker &
      EventEmitter;

    const metrics: WorkerMetrics = {
      tasksProcessed: 0,
      errors: 0,
      lastActive: Date.now(),
      avgProcessingTime: 0,
    };

    worker.on('error', (error) => {
      metrics.errors++;
      Logger.error('Worker error:', error?.stack || error);
      this.handleWorkerError(worker);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        Logger.warn(`Worker exited with code ${code}`);
      }
      this.workers.delete(worker);
      // Remove from available workers if they happen to be there.
      this.available = this.available.filter((w) => w !== worker);
    });

    this.workers.set(worker, metrics);

    // Wait for the worker to be online with a timeout.
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker online event timeout'));
      }, 5000); // 5 seconds
      worker.once('online', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    return worker;
  }
  private async handleWorkerError(worker: Worker): Promise<void> {
    const metrics = this.workers.get(worker);
    if (metrics && metrics.errors > 3) {
      await this.terminateWorker(worker);
      const newWorker = await this.createWorker();
      this.available.push(newWorker);
    }
  }

  private async terminateWorker(worker: Worker): Promise<void> {
    try {
      await worker.terminate();
    } catch (error) {
      Logger.error('Error terminating worker:', error);
    } finally {
      this.workers.delete(worker);
      this.available = this.available.filter((w) => w !== worker);
    }
  }

  public async getWorker(): Promise<Worker> {
    if (this.disposed) {
      return Promise.reject(new Error('WorkerPool is disposed'));
    }

    if (this.available.length > 0) {
      const worker = this.available.pop()!;
      this.updateWorkerMetrics(worker);
      return worker;
    }

    if (this.workers.size < this.maxWorkers) {
      const worker = await this.createWorker();
      this.updateWorkerMetrics(worker);
      return worker;
    }

    return new Promise((resolve, reject) => {
      this.tasks.enqueue({
        resolve,
        reject,
        timestamp: Date.now(),
      });
    });
  }

  private updateWorkerMetrics(worker: Worker): void {
    const metrics = this.workers.get(worker);
    if (metrics) {
      metrics.lastActive = Date.now();
      metrics.tasksProcessed++;
    }
  }

  public releaseWorker(worker: Worker): void {
    if (this.tasks.size > 0) {
      const task = this.tasks.dequeue();
      if (task) {
        this.updateWorkerMetrics(worker);
        task.resolve(worker);
        return;
      }
    }

    const metrics = this.workers.get(worker);
    if (metrics) {
      metrics.lastActive = Date.now();
    }

    this.available.push(worker);
  }

  public async dispose(): Promise<void> {
    this.disposed = true;

    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
      this.healthCheckIntervalId = undefined;
    }

    const terminationPromises = Array.from(this.workers.keys()).map((worker) =>
      this.terminateWorker(worker),
    );

    await Promise.all(terminationPromises);

    while (this.tasks.size > 0) {
      const task = this.tasks.dequeue();
      if (task) {
        task.reject(
          new Error(
            'WorkerPool disposed; rejecting pending getWorker request.',
          ),
        );
        Logger.warn(
          'WorkerPool disposed; rejecting pending getWorker request.',
        );
      }
    }
    this.available = [];
  }

  public getMetrics(): {
    activeWorkers: number;
    availableWorkers: number;
    pendingTasks: number;
    totalTasksProcessed: number;
    totalErrors: number;
  } {
    const totalTasksProcessed = Array.from(this.workers.values()).reduce(
      (sum, metrics) => sum + metrics.tasksProcessed,
      0,
    );

    const totalErrors = Array.from(this.workers.values()).reduce(
      (sum, metrics) => sum + metrics.errors,
      0,
    );

    return {
      activeWorkers: this.workers.size - this.available.length,
      availableWorkers: this.available.length,
      pendingTasks: this.tasks.size,
      totalTasksProcessed,
      totalErrors,
    };
  }
}

// Helper Queue class for managing pending tasks
class Queue<T> {
  private items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  clear(): void {
    this.items = [];
  }

  get size(): number {
    return this.items.length;
  }
}

export interface Task {
  resolve: (worker: Worker) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

export interface WorkerOptions {
  env?: NodeJS.ProcessEnv;
  workerData?: { [key: string]: unknown };
  stdin?: boolean;
  stdout?: boolean;
  stderr?: boolean;
}
