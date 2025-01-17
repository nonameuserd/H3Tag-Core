/**
 * @fileoverview AdaptiveGPUMemory implements dynamic GPU memory management for mining operations.
 * It provides efficient memory allocation, pooling, and automatic scaling based on workload
 * demands while preventing memory fragmentation and overflow.
 *
 * @module AdaptiveGPUMemory
 */
/// <reference types="@webgpu/types" />
/**
 * AdaptiveGPUMemory manages GPU memory allocation with dynamic pooling and scaling.
 *
 * @class AdaptiveGPUMemory
 *
 * @property {GPUDevice} device - GPU device instance
 * @property {Map<string, GPUBuffer[]>} memoryPools - Memory pools by type
 * @property {Map<string, number>} memoryUsage - Memory usage tracking by pool
 * @property {number} MAX_MEMORY_USAGE - Maximum memory usage threshold (80%)
 * @property {Map<GPUBuffer, number>} bufferUsageMap - Individual buffer usage tracking
 *
 * @example
 * const memory = new AdaptiveGPUMemory();
 * await memory.initialize(device);
 * const buffer = await memory.allocateMemory('hash', 1024);
 */
/**
 * Initializes GPU memory management
 *
 * @async
 * @method initialize
 * @param {GPUDevice} device - GPU device instance
 * @returns {Promise<void>}
 * @throws {Error} If GPU device not initialized
 *
 * @example
 * await memory.initialize(device);
 */
/**
 * Creates a new memory pool
 *
 * @private
 * @method createMemoryPool
 * @param {string} type - Pool type identifier
 * @param {number} initialSize - Initial pool size in bytes
 * @returns {Promise<void>}
 * @throws {Error} If invalid initial size
 */
/**
 * Allocates memory from a pool
 *
 * @async
 * @method allocateMemory
 * @param {string} type - Pool type identifier
 * @param {number} size - Allocation size in bytes
 * @returns {Promise<GPUBuffer>} Allocated buffer
 * @throws {Error} If allocation fails or pool not found
 *
 * @example
 * const buffer = await memory.allocateMemory('hash', 1024);
 */
/**
 * Expands a memory pool
 *
 * @private
 * @method expandPool
 * @param {string} type - Pool type identifier
 * @returns {Promise<void>}
 * @throws {Error} If maximum buffer size reached
 */
/**
 * Finds available buffer in pool
 *
 * @private
 * @method findAvailableBuffer
 * @param {string} type - Pool type identifier
 * @param {number} size - Required size in bytes
 * @returns {GPUBuffer} Available buffer
 * @throws {Error} If no suitable buffer found
 */
/**
 * Releases allocated memory
 *
 * @async
 * @method releaseMemory
 * @param {string} type - Pool type identifier
 * @param {GPUBuffer} buffer - Buffer to release
 * @returns {Promise<void>}
 *
 * @example
 * await memory.releaseMemory('hash', buffer);
 */
/**
 * Gets total pool size
 *
 * @private
 * @method getPoolSize
 * @param {string} type - Pool type identifier
 * @returns {number} Total pool size in bytes
 */
/**
 * Disposes all GPU memory resources
 *
 * @async
 * @method dispose
 * @returns {Promise<void>}
 *
 * @example
 * await memory.dispose();
 */
export declare class AdaptiveGPUMemory {
    private device;
    private memoryPools;
    private memoryUsage;
    private readonly MAX_MEMORY_USAGE;
    private bufferUsageMap;
    initialize(device: GPUDevice): Promise<void>;
    private createMemoryPool;
    allocateMemory(type: string, size: number): Promise<GPUBuffer>;
    private expandPool;
    private findAvailableBuffer;
    releaseMemory(type: string, buffer: GPUBuffer): Promise<void>;
    private getPoolSize;
    dispose(): Promise<void>;
}
