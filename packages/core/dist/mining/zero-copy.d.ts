/**
 * @fileoverview ZeroCopyCompression provides GPU-accelerated zero-copy compression using WebGPU.
 * It allows for efficient data compression with minimal memory overhead and high performance.
 *
 * @module ZeroCopyCompression
 */
/**
 * ZeroCopyCompression provides GPU-accelerated zero-copy compression using WebGPU.
 *
 * @class ZeroCopyCompression
 *
 * @property {GPUDevice} device - GPU device instance
 * @property {Map<string, SharedArrayBuffer>} sharedBuffers - Map of shared buffers
 * @property {boolean} isWebGPUSupported - Flag indicating WebGPU support
 *
 * @example
 * const compressor = new ZeroCopyCompression();
 * await compressor.initialize();
 * const compressed = await compressor.compress(data);
 */
export declare class ZeroCopyCompression {
    private device;
    private sharedBuffers;
    private isWebGPUSupported;
    constructor(device?: GPUDevice);
    compressInPlace(buffer: GPUBuffer): Promise<void>;
    private createBindGroup;
    private getCompressionPipeline;
    allocateSharedBuffer(id: string, size: number): Promise<SharedArrayBuffer>;
    compressWithSharedMemory(id: string): Promise<void>;
    releaseSharedBuffer(id: string): boolean;
    getSharedBuffer(id: string): SharedArrayBuffer | undefined;
    dispose(): Promise<void>;
}
