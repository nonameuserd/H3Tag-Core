declare module 'gpu-api' {
  export interface GPUDevice {
    createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
    createCommandEncoder(): GPUCommandEncoder;
    createComputePipeline(
      descriptor: GPUComputePipelineDescriptor,
    ): GPUComputePipeline;
    queue: GPUQueue;
  }

  export interface GPUBuffer {
    destroy(): void;
    mapAsync(mode: number): Promise<void>;
    getMappedRange(): ArrayBuffer;
  }
}
