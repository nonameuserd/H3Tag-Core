/// <reference types="node" />
/// <reference types="node" />
import { Worker } from "worker_threads";
export declare class WorkerPool {
    private readonly scriptPath;
    private readonly workerOptions;
    private workers;
    private available;
    private tasks;
    private readonly maxWorkers;
    private readonly maxIdleTime;
    private readonly healthCheckInterval;
    constructor(maxWorkers: number, scriptPath: string, workerOptions?: WorkerOptions);
    private startHealthCheck;
    private checkWorkerHealth;
    private createWorker;
    private handleWorkerError;
    private terminateWorker;
    getWorker(): Promise<Worker>;
    private updateWorkerMetrics;
    releaseWorker(worker: Worker): void;
    dispose(): Promise<void>;
    getMetrics(): {
        activeWorkers: number;
        availableWorkers: number;
        pendingTasks: number;
        totalTasksProcessed: number;
        totalErrors: number;
    };
}
interface WorkerOptions {
    env?: NodeJS.ProcessEnv;
    workerData?: any;
    stdin?: boolean;
    stdout?: boolean;
    stderr?: boolean;
}
export {};
