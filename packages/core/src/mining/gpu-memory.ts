/**
 * @fileoverview AdaptiveGPUMemory implements dynamic GPU memory management for mining operations.
 * It provides efficient memory allocation, pooling, and automatic scaling based on workload
 * demands while preventing memory fragmentation and overflow.
 *
 * @module AdaptiveGPUMemory
 */

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

export class AdaptiveGPUMemory {
  private device: GPUDevice | null = null;
  private memoryPools: Map<string, GPUBuffer[]> = new Map();
  private memoryUsage: Map<string, number> = new Map();
  private readonly MAX_MEMORY_USAGE = 0.8; // 80% of available GPU memory
  private bufferUsageMap: Map<GPUBuffer, number> = new Map();

  async initialize(device: GPUDevice): Promise<void> {
    if (!device) throw new Error('GPU device not initialized');
    this.device = device;
    this.memoryPools.clear();
    this.memoryUsage.clear();

    // Initialize with safer buffer sizes
    await this.createMemoryPool('hash', 64 * 1024 * 1024); // 64MB for hashes
    await this.createMemoryPool('nonce', 32 * 1024 * 1024); // 32MB for nonces
  }

  private async createMemoryPool(
    type: string,
    initialSize: number,
  ): Promise<void> {
    if (initialSize <= 0) throw new Error('Invalid initial size');
    if (!this.device) throw new Error('GPU device not initialized');

    const buffer = this.device.createBuffer({
      size: initialSize,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST,
      mappedAtCreation: false,
      label: `pool-${type}`,
    });

    if (!buffer) {
      throw new Error(`Failed to create buffer for pool ${type}`);
    }

    this.memoryPools.set(type, [buffer]);
    this.memoryUsage.set(type, 0);
    this.bufferUsageMap.set(buffer, 0);
  }

  async allocateMemory(type: string, size: number): Promise<GPUBuffer> {
    if (!type || size <= 0) throw new Error('Invalid allocation parameters');

    const pool = this.memoryPools.get(type);
    if (!pool) throw new Error(`Memory pool not found for type: ${type}`);

    const usage = this.memoryUsage.get(type) || 0;
    const totalSize = this.getPoolSize(type);

    if (usage + size > totalSize) {
      await this.expandPool(type);
    }

    try {
      const buffer = this.findAvailableBuffer(type, size);
      this.memoryUsage.set(type, usage + size);
      return buffer;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Memory allocation failed: ${error.message}`);
      }
      throw new Error('Memory allocation failed: Unknown error');
    }
  }

  private async expandPool(type: string): Promise<void> {
    if (!this.device) throw new Error('GPU device not initialized');
    const currentSize = this.getPoolSize(type);
    if (currentSize >= (this.device.limits.maxBufferSize || 0)) {
      throw new Error('Maximum GPU buffer size reached');
    }

    const newSize = Math.min(
      currentSize * 2,
      this.device.limits.maxBufferSize || 0,
    );

    const newBuffer = this.device.createBuffer({
      size: newSize,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST,
      label: `pool-${type}-expanded`,
    });

    if (!newBuffer) {
      throw new Error(`Failed to expand memory pool for type: ${type}`);
    }

    this.memoryPools.get(type)!.push(newBuffer);
    this.bufferUsageMap.set(newBuffer, 0);
  }

  private findAvailableBuffer(type: string, size: number): GPUBuffer {
    if (!this.device) throw new Error('GPU device not initialized');
    const pool = this.memoryPools.get(type);
    if (!pool) throw new Error(`No memory pool found for type: ${type}`);

    // Sum usage only for buffers in this pool.
    const poolUsage = pool.reduce((sum, buffer) => {
      return sum + (this.bufferUsageMap.get(buffer) || 0);
    }, 0);
    const poolCapacity = this.getPoolSize(type);
    if (poolUsage + size > poolCapacity * this.MAX_MEMORY_USAGE) {
      throw new Error('GPU memory limit exceeded for pool ' + type);
    }

    // Only reuse buffers that are completely free (usage === 0)
    // to avoid partially shared buffers.
    for (const buffer of pool) {
      const allocated = this.bufferUsageMap.get(buffer) || 0;
      if (allocated === 0 && buffer.size >= size) {
        this.bufferUsageMap.set(buffer, size);
        return buffer;
      }
    }

    // No free buffer available; create a dedicated new GPUBuffer
    const newBuffer = this.device.createBuffer({
      size: size,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST,
      mappedAtCreation: false,
      label: `pool-${type}-new`,
    });

    if (!newBuffer) {
      throw new Error(`Failed to allocate new buffer for pool ${type}`);
    }
    pool.push(newBuffer);
    this.bufferUsageMap.set(newBuffer, size);
    return newBuffer;
  }

  async releaseMemory(type: string, buffer: GPUBuffer): Promise<void> {
    if (!buffer || !type) return;

    const allocated = this.bufferUsageMap.get(buffer) || 0;
    const currentUsage = this.memoryUsage.get(type) || 0;

    // Deduct the allocated size from the pool's usage.
    this.memoryUsage.set(type, Math.max(0, currentUsage - allocated));

    // Remove the tracking for this buffer.
    this.bufferUsageMap.delete(buffer);

    // Destroy the buffer – safe because we never share a buffer between allocations.
    buffer.destroy();
    await this.device?.queue.onSubmittedWorkDone();
  }

  private getPoolSize(type: string): number {
    const pool = this.memoryPools.get(type);
    if (!pool) return 0;
    return pool.reduce((total, buffer) => total + buffer.size, 0);
  }

  public async dispose(): Promise<void> {
    try {
      for (const pool of this.memoryPools.values()) {
        pool.forEach((buffer) => buffer.destroy());
      }
      this.memoryPools.clear();
      this.memoryUsage.clear();
      this.bufferUsageMap.clear();
    } catch (error) {
      console.error('Error during disposal:', error);
    }
  }
}
