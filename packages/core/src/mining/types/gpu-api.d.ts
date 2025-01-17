declare module "gpu-api" {
  export interface GPUDevice {
    createBuffer(descriptor: any): GPUBuffer;
    createCommandEncoder(): GPUCommandEncoder;
    createComputePipeline(descriptor: any): GPUComputePipeline;
    queue: GPUQueue;
  }

  export interface GPUBuffer {
    destroy(): void;
    mapAsync(mode: number): Promise<void>;
    getMappedRange(): ArrayBuffer;
  }
}
