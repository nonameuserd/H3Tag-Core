import { GPUMiner } from './gpu';
import { Block } from '../models/block.model';
import { HashUtils } from '@h3tag-blockchain/crypto';

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

interface MiningResult {
  found: boolean;
  nonce: number;
  hash: string;
}

export class AdvancedGPUMiner extends GPUMiner {
  protected readonly MAX_NONCE = Math.pow(2, 32);
  private workgroupSize = 256;
  private maxComputeUnits: number = 0;
  private shaderCache: Map<string, GPUComputePipeline> = new Map();
  private blockBuffer: GPUBuffer | null = null;
  private resultBuffer: GPUBuffer | null = null;
  private deviceLostHandler: (info: GPUDeviceLostInfo) => void;

  // Add currency constants
  private readonly CURRENCY_CONSTANTS = {
    REWARD_PRECISION: 100000000, // 8 decimals for TAG
    SYMBOL: 'TAG',
    NAME: 'H3Tag',
  };

  constructor() {
    super();
    this.deviceLostHandler = this.handleDeviceLost.bind(this);
  }

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
      throw new Error('GPU device not initialized');
    }

    // Add device lost handler
    this.device.lost.then(this.deviceLostHandler);

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
    if (!adapter) throw new Error('No GPU adapter found');

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
      1024, // WebGPU max workgroup size
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

  private async createOptimizedPipeline(target: bigint): Promise<GPUComputePipeline> {
    const cacheKey = `pipeline_${target}`;
    
    // Add double-check locking pattern
    if (this.shaderCache.has(cacheKey)) {
        return this.shaderCache.get(cacheKey)!;
    }

    try {
        const pipeline = await this.createPipelineInternal(target);
        this.shaderCache.set(cacheKey, pipeline);
        return pipeline;
    } catch (error) {
        // Clean up failed pipeline
        this.shaderCache.delete(cacheKey);
        throw error;
    }
  }

  private async createPipelineInternal(target: bigint): Promise<GPUComputePipeline> {
    const shader = `
                @group(0) @binding(0) var<storage, read> blockData: array<u32>;
                @group(0) @binding(1) var<storage, read_write> result: array<u32>;
                @group(0) @binding(2) var<uniform> offset: u32;

                const REWARD_PRECISION: u32 = ${
                  this.CURRENCY_CONSTANTS.REWARD_PRECISION
                }u;
                const REWARD_SCALE: f32 = ${
                  1.0 / this.CURRENCY_CONSTANTS.REWARD_PRECISION
                }f;

                fn compute_hash(data: u32, nonce: u32) -> u32 {
                    // Insert a valid hash function here.
                    return data ^ nonce;
                }

                @compute @workgroup_size(${this.workgroupSize})
                fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
                    let nonce = global_id.x + offset;
                    // Check whether nonce is out-of-bounds
                    if (nonce >= ${this.MAX_NONCE}u) {
                        return;
                    }
                    let hash = compute_hash(blockData[0], nonce);
                    let reward = u32(f32(hash) * REWARD_SCALE);
                    if (hash < ${target}u) {
                        atomicStore(&result[0], nonce);
                        atomicStore(&result[1], reward);
                    }
                }
            `;

    if (!this.device) throw new Error('GPU device not initialized');
    const pipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: this.device.createShaderModule({ code: shader }),
        entryPoint: 'main',
      },
    });

    return pipeline;
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
    target: number,
  ): Promise<number | null> {
    // Calculate chunks using MAX_NONCE constant
    const chunks = Math.ceil(
      this.MAX_NONCE / (this.workgroupSize * this.maxComputeUnits),
    );
    const commands: GPUCommandBuffer[] = [];

    // Get difficulty directly from the blockBuffer data
    const difficultyView = new DataView(await this.readBufferData(blockBuffer));
    const difficulty = difficultyView.getUint32(0);

    // Build a pipeline key and retrieve (or create) the pipeline
    const pipelineKey = `${difficulty}_${target}`;
    let pipeline = this.shaderCache.get(pipelineKey);
    if (!pipeline) {
      pipeline = await this.createOptimizedPipeline(BigInt(target));
      // Cache under the pipelineKey for multiple chunks of the same work
      this.shaderCache.set(pipelineKey, pipeline);
    }

    for (let i = 0; i < chunks; i++) {
      const commandEncoder = this.device?.createCommandEncoder();
      if (!commandEncoder) {
        throw new Error('Failed to create command encoder');
      }
      const pass = commandEncoder.beginComputePass();

      // Pass the already obtained pipeline to the bind group creation.
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, this.createBindGroup(pipeline, blockBuffer, i));
      pass.dispatchWorkgroups(this.maxComputeUnits);
      pass.end();

      commands.push(commandEncoder.finish());
    }

    if (!this.device) throw new Error('GPU device not initialized');
    this.device.queue.submit(commands);
    return this.getResult();
  }

  /**
   * Updated createBindGroup now accepts the pipeline so that it can extract its layout.
   * Also, it uses the block buffer passed to the function instead of the internal one.
   */
  private createBindGroup(
    pipeline: GPUComputePipeline,
    blockBuffer: GPUBuffer,
    chunkIndex: number,
  ): GPUBindGroup {
    const offset = chunkIndex * this.workgroupSize * this.maxComputeUnits;
    if (!this.device) {
      throw new Error('GPU device not initialized');
    }
    return this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: blockBuffer,
            offset: offset * 4, // Assuming 4 bytes per uint32
            size: blockBuffer.size - offset * 4,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.resultBuffer!,
            offset: 0,
            size: this.resultBuffer!.size,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: this.blockBuffer!,
            offset: 0,
            size: this.blockBuffer!.size,
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
    if (!this.device) throw new Error('GPU device not initialized');
    const readBuffer = this.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    if (!readBuffer) throw new Error('Failed to create read buffer');

    try {
      const commandEncoder = this.device.createCommandEncoder();
      commandEncoder.copyBufferToBuffer(
        this.resultBuffer!, 
        0, 
        readBuffer, 
        0, 
        4
      );
      this.device.queue.submit([commandEncoder.finish()]);

      await readBuffer.mapAsync(GPUMapMode.READ);
      const resultArray = new Uint32Array(readBuffer.getMappedRange());
      return resultArray[0];
    } finally {
      readBuffer.unmap();
      readBuffer.destroy();
    }
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
    if (!this.device) throw new Error('GPU device not initialized');
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
    this.blockBuffer?.destroy();
    this.resultBuffer?.destroy();
    this.device?.destroy();
  }

  private handleDeviceLost(info: GPUDeviceLostInfo): void {
    this.dispose();
    throw new Error(`Device lost: ${info.message}`);
  }

  /**
   * Helper method to compute the block header hash as a 32-bit unsigned integer.
   */
  protected hashBlockHeader(block: Block): number {
    const header = block.header;
    const data = [
      header.version,
      header.previousHash,
      header.merkleRoot,
      header.timestamp,
      header.difficulty,
      header.nonce,
    ].join('');

    return parseInt(HashUtils.sha3(data).slice(0, 8), 16);
  }

  /**
   * Helper method to get the block header string including the nonce,
   * used to compute the final hash.
   */
  protected getBlockHeaderString(block: Block, nonce: number): string {
    const header = block.header;
    return [
      header.version,
      header.previousHash,
      header.merkleRoot,
      header.timestamp,
      header.difficulty,
      nonce,
    ].join('');
  }

  /**
   * Mines a block by iterating over nonce chunks. For every chunk, the nonce offset
   * is updated in the shader via a uniform buffer.
   *
   * @param block The block to mine.
   * @param target The mining target difficulty (as a bigint, converted to 32-bit).
   * @returns The mining result indicating success and the corresponding nonce and hash.
   */
  async mine(block: Block, target: bigint): Promise<MiningResult> {
    if (!this.device || !this.shaderCache.has(target.toString())) {
      throw new Error('GPU not initialized');
    }

    // Create a storage buffer for the header hash and mining result (8 bytes: 2 x uint32).
    const storageBuffer = this.device.createBuffer({
      size: 8,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    // Initialize with header hash and a sentinel value (0xffffffff) for nonce.
    const initData = new Uint32Array([this.hashBlockHeader(block), 0xffffffff]);
    this.device.queue.writeBuffer(storageBuffer, 0, initData);

    // Create a target buffer (4 bytes) and write the target value.
    const targetBuffer = this.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const targetNumber = Number(target);
    const targetArray = new Uint32Array([targetNumber]);
    this.device.queue.writeBuffer(targetBuffer, 0, targetArray);

    // Create a uniform buffer for the offset (4 bytes).
    const offsetBuffer = this.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Determine maximum dispatchable workgroups per chunk.
    const maxWorkgroups = this.device.limits.maxComputeWorkgroupsPerDimension;
    // Dispatch count is set to the maximum workgroups allowed.
    const dispatchCount = maxWorkgroups;
    // Amount of nonces processed per chunk.
    const noncesPerChunk = this.workgroupSize * dispatchCount;

    let foundNonce = 0xffffffff;
    let currentOffset = 0;

    // Loop over chunks in the nonce space.
    while (currentOffset <= this.MAX_NONCE) {
      // Update offset uniform with the current offset value.
      const offsetArray = new Uint32Array([currentOffset]);
      this.device.queue.writeBuffer(offsetBuffer, 0, offsetArray);

      // Create a bind group including storage, target, and offset buffers.
      const bindGroup = this.device.createBindGroup({
        layout: this.shaderCache.get(target.toString())!.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: storageBuffer } },
          { binding: 1, resource: { buffer: targetBuffer } },
          { binding: 2, resource: { buffer: offsetBuffer } },
        ],
      });

      // Create command encoder and compute pass.
      const commandEncoder = this.device.createCommandEncoder();
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(this.shaderCache.get(target.toString())!);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(dispatchCount);
      pass.end();

      // Prepare a read buffer to extract the nonce result.
      const readBuffer = this.device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
      // Copy nonce (stored at offset 4) from the storage buffer.
      commandEncoder.copyBufferToBuffer(storageBuffer, 4, readBuffer, 0, 4);

      // Submit the command buffer.
      this.device.queue.submit([commandEncoder.finish()]);
      await readBuffer.mapAsync(GPUMapMode.READ);
      const result = new Uint32Array(readBuffer.getMappedRange())[0];
      readBuffer.unmap();
      readBuffer.destroy();

      // If the sentinel has been overwritten, a valid nonce was found.
      if (result !== 0xffffffff) {
        foundNonce = result;
        break;
      }

      // Update the offset to process the next chunk.
      currentOffset += noncesPerChunk;
      if (currentOffset > this.MAX_NONCE) {
        break;
      }
    }

    const found = foundNonce !== 0xffffffff;
    const hashValue = found
      ? HashUtils.sha3(this.getBlockHeaderString(block, foundNonce)).slice(0, 8)
      : '';

    // Cleanup allocated buffers.
    storageBuffer.destroy();
    targetBuffer.destroy();
    offsetBuffer.destroy();

    return {
      found,
      nonce: foundNonce,
      hash: hashValue,
    };
  }
}
