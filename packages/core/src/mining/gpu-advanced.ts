import { GPUMiner } from "./gpu";

/**
 * @fileoverview AdvancedGPUMiner implements optimized GPU-based mining operations.
 * It extends the base GPUMiner with advanced features like shader caching, workgroup
 * optimization, and enhanced error handling.
 *
 * @module AdvancedGPUMiner
 */

/**
 * AdvancedGPUMiner provides optimized GPU mining capabilities with advanced features.
 *
 * @class AdvancedGPUMiner
 * @extends {GPUMiner}
 *
 * @property {number} workgroupSize - Size of GPU workgroups
 * @property {number} maxComputeUnits - Maximum available compute units
 * @property {Map<string, GPUComputePipeline>} shaderCache - Cache for compiled shaders
 * @property {GPUBuffer} blockBuffer - Buffer for block data
 * @property {GPUBuffer} resultBuffer - Buffer for mining results
 * @property {Object} CURRENCY_CONSTANTS - Currency-specific constants
 *
 * @example
 * const miner = new AdvancedGPUMiner();
 * await miner.initialize();
 * const result = await miner.mineOptimized(blockData, target);
 */

export class AdvancedGPUMiner extends GPUMiner {
  private workgroupSize = 256;
  private maxComputeUnits: number;
  private shaderCache: Map<string, GPUComputePipeline>;
  private blockBuffer: GPUBuffer;
  private resultBuffer: GPUBuffer;

  // Add currency constants
  private readonly CURRENCY_CONSTANTS = {
    REWARD_PRECISION: 100000000, // 8 decimals for TAG
    SYMBOL: "TAG",
    NAME: "H3Tag",
  };

  /**
   * Initializes the GPU miner
   *
   * @async
   * @method initialize
   * @returns {Promise<void>}
   * @throws {Error} If GPU device initialization fails
   *
   * @example
   * await miner.initialize();
   */

  async initialize(): Promise<void> {
    await super.initialize();

    // Add error handling for device initialization
    if (!this.device) {
      throw new Error("GPU device not initialized");
    }

    // Increase buffer sizes to handle potential overflow
    this.blockBuffer = this.device.createBuffer({
      size: 8, // Increase to 8 bytes for uint64
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.resultBuffer = this.device.createBuffer({
      size: 8, // Increase to handle both nonce and reward
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    // Add null check for adapter
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("No GPU adapter found");

    // Get compute capabilities
    const limits = adapter.limits;
    this.maxComputeUnits = limits.maxComputeWorkgroupsPerDimension || 16;
    this.shaderCache = new Map();

    // Optimize workgroup size based on GPU
    this.workgroupSize = this.calculateOptimalWorkgroupSize();
  }

  /**
   * Calculates optimal workgroup size
   *
   * @private
   * @method calculateOptimalWorkgroupSize
   * @returns {number} Optimal workgroup size
   */

  private calculateOptimalWorkgroupSize(): number {
    // Adjust based on GPU architecture
    return Math.min(
      this.maxComputeUnits * 32, // 32 threads per compute unit
      1024 // WebGPU max workgroup size
    );
  }

  /**
   * Creates an optimized compute pipeline
   *
   * @private
   * @method createOptimizedPipeline
   * @param {bigint} target - Mining target difficulty
   * @returns {Promise<GPUComputePipeline>} Compiled pipeline
   * @throws {Error} If shader compilation fails
   */

  private async createOptimizedPipeline(
    target: bigint
  ): Promise<GPUComputePipeline> {
    const cacheKey = `pipeline_${target}`;

    // Add error handling for shader compilation
    try {
      let pipeline = this.shaderCache.get(cacheKey);
      if (pipeline) return pipeline;

      const shader = `
                @group(0) @binding(0) var<storage, read> blockData: array<u32>;
                @group(0) @binding(1) var<storage, read_write> result: array<u32>;

                const REWARD_PRECISION: u32 = ${
                  this.CURRENCY_CONSTANTS.REWARD_PRECISION
                }u;
                const REWARD_SCALE: f32 = ${
                  1.0 / this.CURRENCY_CONSTANTS.REWARD_PRECISION
                }f;

                @compute @workgroup_size(${this.workgroupSize})
                fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
                    let nonce = global_id.x;
                    let hash = compute_hash(blockData[0], nonce);
                    
                    // Add bounds checking
                    if (nonce >= ${this.MAX_NONCE}u) {
                        return;
                    }
                    
                    let reward = u32(f32(hash) * REWARD_SCALE);
                    
                    if (hash < ${target}u) {
                        atomicStore(&result[0], nonce);
                        atomicStore(&result[1], reward);
                    }
                }
            `;

      pipeline = this.device.createComputePipeline({
        layout: "auto",
        compute: {
          module: this.device.createShaderModule({ code: shader }),
          entryPoint: "main",
        },
      });

      this.shaderCache.set(cacheKey, pipeline);
      return pipeline;
    } catch (error) {
      throw new Error(`Failed to create pipeline: ${error.message}`);
    }
  }

  /**
   * Mines a block with optimized settings
   *
   * @async
   * @method mineOptimized
   * @param {GPUBuffer} blockBuffer - Block data buffer
   * @param {number} target - Mining target
   * @returns {Promise<number | null>} Mining result or null if not found
   *
   * @example
   * const result = await miner.mineOptimized(blockBuffer, target);
   */

  async mineOptimized(
    blockBuffer: GPUBuffer,
    target: number
  ): Promise<number | null> {
    // Split work into optimal chunks
    const chunks = Math.ceil(
      this.MAX_NONCE / (this.workgroupSize * this.maxComputeUnits)
    );
    const commands: GPUCommandBuffer[] = [];

    for (let i = 0; i < chunks; i++) {
      const commandEncoder = this.device.createCommandEncoder();
      const pass = commandEncoder.beginComputePass();

      // Read difficulty from buffer
      const difficultyView = new DataView(
        await this.readBufferData(blockBuffer)
      );
      const difficulty = difficultyView.getUint32(0);

      // Use pipeline caching
      const pipelineKey = `${difficulty}_${target}`;
      let pipeline = this.shaderCache.get(pipelineKey);
      if (!pipeline) {
        pipeline = await this.createOptimizedPipeline(BigInt(target));
        this.shaderCache.set(pipelineKey, pipeline);
      }

      pass.setPipeline(pipeline);
      pass.setBindGroup(0, this.createBindGroup(i));
      pass.dispatchWorkgroups(this.maxComputeUnits);
      pass.end();

      commands.push(commandEncoder.finish());
    }

    // Submit all work in parallel
    this.device.queue.submit(commands);
    return this.getResult();
  }

  /**
   * Creates a bind group for GPU operations
   *
   * @private
   * @method createBindGroup
   * @param {number} chunkIndex - Mining chunk index
   * @returns {GPUBindGroup} Configured bind group
   * @throws {Error} If pipeline not initialized
   */

  private createBindGroup(chunkIndex: number): GPUBindGroup {
    // Fix potential race condition with pipeline access
    const pipeline = this.shaderCache.get("current_pipeline");
    if (!pipeline) throw new Error("Pipeline not initialized");

    // Add offset calculation for chunk-based mining
    const offset = chunkIndex * this.workgroupSize * this.maxComputeUnits;

    return this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.blockBuffer,
            offset: 0,
            size: this.blockBuffer.size,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.resultBuffer,
            offset: 0,
            size: this.resultBuffer.size,
          },
        },
      ],
    });
  }

  /**
   * Retrieves mining results
   *
   * @private
   * @method getResult
   * @returns {Promise<number>} Mining result
   */

  private async getResult(): Promise<number> {
    // Create a buffer to read results
    const readBuffer = this.device.createBuffer({
      size: 4, // uint32
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    // Copy result to readable buffer
    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(this.resultBuffer, 0, readBuffer, 0, 4);
    this.device.queue.submit([commandEncoder.finish()]);

    // Read the result
    await readBuffer.mapAsync(GPUMapMode.READ);
    const result = new Uint32Array(readBuffer.getMappedRange())[0];
    readBuffer.unmap();
    readBuffer.destroy();

    return result;
  }

  /**
   * Reads data from a GPU buffer
   *
   * @private
   * @method readBufferData
   * @param {GPUBuffer} buffer - GPU buffer to read
   * @returns {Promise<ArrayBuffer>} Buffer data
   */

  private async readBufferData(buffer: GPUBuffer): Promise<ArrayBuffer> {
    const readBuffer = this.device.createBuffer({
      size: buffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, buffer.size);
    this.device.queue.submit([commandEncoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const data = readBuffer.getMappedRange().slice(0);
    readBuffer.unmap();
    readBuffer.destroy();

    return data;
  }

  /**
   * Disposes GPU resources
   *
   * @async
   * @method dispose
   * @returns {Promise<void>}
   *
   * @example
   * await miner.dispose();
   */

  public async dispose(): Promise<void> {
    this.shaderCache.clear();
    this.blockBuffer.destroy();
    this.resultBuffer.destroy();
    this.device?.destroy();
  }
}
