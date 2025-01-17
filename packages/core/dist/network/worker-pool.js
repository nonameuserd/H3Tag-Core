"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerPool = void 0;
const worker_threads_1 = require("worker_threads");
const shared_1 = require("@h3tag-blockchain/shared");
const os_1 = __importDefault(require("os"));
class WorkerPool {
    constructor(maxWorkers, scriptPath, workerOptions = {}) {
        this.scriptPath = scriptPath;
        this.workerOptions = workerOptions;
        this.workers = new Map();
        this.available = [];
        this.tasks = new Queue();
        this.maxIdleTime = 60000; // 1 minute
        this.healthCheckInterval = 30000; // 30 seconds
        this.maxWorkers = Math.max(1, Math.min(maxWorkers, os_1.default.cpus().length));
        this.startHealthCheck();
    }
    startHealthCheck() {
        setInterval(() => {
            this.checkWorkerHealth();
        }, this.healthCheckInterval);
    }
    async checkWorkerHealth() {
        const now = Date.now();
        for (const [worker, metrics] of this.workers.entries()) {
            if (now - metrics.lastActive > this.maxIdleTime) {
                await this.terminateWorker(worker);
            }
        }
    }
    async createWorker() {
        const worker = new worker_threads_1.Worker(this.scriptPath, this.workerOptions);
        const metrics = {
            tasksProcessed: 0,
            errors: 0,
            lastActive: Date.now(),
            avgProcessingTime: 0
        };
        worker.on('error', (error) => {
            metrics.errors++;
            shared_1.Logger.error('Worker error:', error);
            this.handleWorkerError(worker);
        });
        worker.on('exit', (code) => {
            if (code !== 0) {
                shared_1.Logger.warn(`Worker exited with code ${code}`);
            }
            this.workers.delete(worker);
            this.available = this.available.filter(w => w !== worker);
        });
        this.workers.set(worker, metrics);
        await new Promise(resolve => worker.once('online', resolve));
        return worker;
    }
    async handleWorkerError(worker) {
        const metrics = this.workers.get(worker);
        if (metrics && metrics.errors > 3) {
            await this.terminateWorker(worker);
            const newWorker = await this.createWorker();
            this.available.push(newWorker);
        }
    }
    async terminateWorker(worker) {
        try {
            await worker.terminate();
        }
        catch (error) {
            shared_1.Logger.error('Error terminating worker:', error);
        }
        finally {
            this.workers.delete(worker);
            this.available = this.available.filter(w => w !== worker);
        }
    }
    async getWorker() {
        if (this.available.length > 0) {
            const worker = this.available.pop();
            this.updateWorkerMetrics(worker);
            return worker;
        }
        if (this.workers.size < this.maxWorkers) {
            const worker = await this.createWorker();
            this.updateWorkerMetrics(worker);
            return worker;
        }
        return new Promise((resolve) => {
            this.tasks.enqueue({
                resolve,
                timestamp: Date.now()
            });
        });
    }
    updateWorkerMetrics(worker) {
        const metrics = this.workers.get(worker);
        if (metrics) {
            metrics.lastActive = Date.now();
            metrics.tasksProcessed++;
        }
    }
    releaseWorker(worker) {
        if (this.tasks.size > 0) {
            const task = this.tasks.dequeue();
            if (task) {
                this.updateWorkerMetrics(worker);
                task.resolve(worker);
                return;
            }
        }
        this.available.push(worker);
    }
    async dispose() {
        const terminationPromises = Array.from(this.workers.keys()).map(worker => this.terminateWorker(worker));
        await Promise.all(terminationPromises);
        this.tasks.clear();
        this.available = [];
    }
    getMetrics() {
        const totalTasksProcessed = Array.from(this.workers.values())
            .reduce((sum, metrics) => sum + metrics.tasksProcessed, 0);
        const totalErrors = Array.from(this.workers.values())
            .reduce((sum, metrics) => sum + metrics.errors, 0);
        return {
            activeWorkers: this.workers.size - this.available.length,
            availableWorkers: this.available.length,
            pendingTasks: this.tasks.size,
            totalTasksProcessed,
            totalErrors
        };
    }
}
exports.WorkerPool = WorkerPool;
// Helper Queue class for managing pending tasks
class Queue {
    constructor() {
        this.items = [];
    }
    enqueue(item) {
        this.items.push(item);
    }
    dequeue() {
        return this.items.shift();
    }
    clear() {
        this.items = [];
    }
    get size() {
        return this.items.length;
    }
}
//# sourceMappingURL=worker-pool.js.map