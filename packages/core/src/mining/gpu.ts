import { Block } from '../models/block.model';
import { HashUtils } from '@h3tag-blockchain/crypto';

interface MiningResult {
  found: boolean;
  nonce: number;
  hash: string;
}

/**
 * @fileoverview GPUMiner implements WebGPU-based mining operations for the H3Tag blockchain.
 * It provides high-performance parallel mining capabilities with efficient hash computation
 * and nonce search using GPU acceleration.
 *
 * @module GPUMiner
 */

/**
 * GPUMiner provides base GPU mining capabilities with WebGPU.
 *
 * @class GPUMiner
 *
 * @property {GPUDevice} device - GPU device instance
 * @property {GPUComputePipeline} pipeline - Compute pipeline for mining
 * @property {GPUBindGroup} bindGroup - Binding group for shader resources
 * @property {number} MAX_NONCE - Maximum nonce value (0xFFFFFFFF)
 *
 * @example
 * const miner = new GPUMiner();
 * await miner.initialize();
 * const result = await miner.mine(block, target);
 */

export class GPUMiner {
  protected readonly MAX_NONCE: number = 0xffffffff;
  protected device: GPUDevice | null | undefined = null;
  protected pipeline: GPUComputePipeline | null | undefined = null;
  protected bindGroup: GPUBindGroup | null | undefined = null;

  /**
   * Initializes the GPU miner
   *
   * @async
   * @method initialize
   * @returns {Promise<void>}
   * @throws {Error} If WebGPU not supported or initialization fails
   *
   * @example
   * await miner.initialize();
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

  async initialize(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported');
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });
    if (!adapter) {
      throw new Error('No GPU adapter found');
    }

    this.device = await adapter.requestDevice({
      requiredFeatures: ['timestamp-query'],
      requiredLimits: {
        maxComputeWorkgroupsPerDimension: 65535,
        maxStorageBufferBindingSize: 1024 * 1024 * 128,
      },
    });

    this.device.lost.then((info) => {
      throw new Error(`GPU device was lost: ${info.message}`);
    });

    try {
      const shader = `
                @compute @workgroup_size(256)
                fn main(
                    @builtin(global_invocation_id) global_id: vec3<u32>,
                    @binding(0) data: array<u32>,
                    @binding(1) target: u32
                ) {
                    let nonce = global_id.x;
                    let hash = sha3_256(data[0], nonce);
                    if (hash <= target) {
                        atomicStore(&data[1], nonce);
                    }
                }
            `;

      this.pipeline = this.device.createComputePipeline({
        layout: 'auto',
        compute: {
          module: this.device.createShaderModule({
            code: shader,
          }),
          entryPoint: 'main',
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to create pipeline: ${error.message}`);
      }
      throw new Error('Failed to create pipeline: Unknown error');
    }
  }

  /**
   * Mines a block with the given target difficulty
   *
   * @async
   * @method mine
   * @param {Block} block - Block to mine
   * @param {bigint} target - Mining target difficulty
   * @param {number} [batchSize] - Optional batch size for mining
   * @returns {Promise<MiningResult>} Mining result with nonce and hash
   * @throws {Error} If GPU not initialized or mining fails
   *
   * @example
   * const result = await miner.mine(block, target);
   * if (result.found) {
   *   console.log(`Found nonce: ${result.nonce}`);
   * }
   */

  async mine(block: Block, target: bigint, batchSize?: number): Promise<MiningResult> {
    if (!this.device || !this.pipeline) {
      throw new Error('GPU not initialized');
    }

    // Use provided batch size or default to 256
    const effectiveBatchSize = batchSize || 256;

    // Create a storage buffer for the block data and mining result.
    // We only need 8 bytes: 2 x uint32 (4 bytes each)
    const buffer = this.device.createBuffer({
      size: 8, // 2 * 4 bytes for two uint32 values.
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    // Initialize the storage buffer with:
    //  - data[0] = block header hash (computed from the block)
    //  - data[1] = sentinel value 0xffffffff indicating "not found"
    const initialData = new Uint32Array([this.hashBlockHeader(block), 0xffffffff]);
    this.device.queue.writeBuffer(buffer, 0, initialData);

    // Create a target buffer, holding the mining target as a 32-bit unsigned integer.
    const targetBuffer = this.device.createBuffer({
      size: 4, // 4 bytes for a single uint32 value.
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    // Convert the bigint target to number (ensure target is in 32-bit range)
    const targetNumber = Number(target);
    const targetData = new Uint32Array([targetNumber]);
    this.device.queue.writeBuffer(targetBuffer, 0, targetData);

    // Create bind group with the expected layout:
    // Bind group slot 0: the data buffer (block header and nonce result)
    // Bind group slot 1: the target buffer
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer } },
        { binding: 1, resource: { buffer: targetBuffer } },
      ],
    });

    // Create command encoder and compute pass.
    const commandEncoder = this.device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);

    // IMPORTANT: Limit the dispatch count to what the GPU supports.
    // Instead of dispatching Math.ceil(MAX_NONCE / effectiveBatchSize) workgroups (which would be huge),
    // we clip it to the device limit.
    const maxWorkgroups = this.device.limits.maxComputeWorkgroupsPerDimension;
    const dispatchCount = Math.min(
      Math.ceil(this.MAX_NONCE / effectiveBatchSize),
      maxWorkgroups
    );
    pass.dispatchWorkgroups(dispatchCount);
    pass.end();

    // Create a read-buffer to extract only the nonce result (stored in data[1], i.e. offset of 4 bytes).
    const readBuffer = this.device.createBuffer({
      size: 4, // Only 4 bytes are needed.
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    // Copy from offset 4 of our storage buffer.
    commandEncoder.copyBufferToBuffer(buffer, 4, readBuffer, 0, 4);

    // Submit the GPU commands.
    this.device.queue.submit([commandEncoder.finish()]);
    await readBuffer.mapAsync(GPUMapMode.READ);
    const result = new Uint32Array(readBuffer.getMappedRange())[0];

    readBuffer.unmap();
    buffer.destroy();
    targetBuffer.destroy();
    readBuffer.destroy();

    // Determine if a valid nonce was found. If the result still equals the sentinel then nothing was found.
    const found = result !== 0xffffffff;

    return {
      found,
      nonce: result,
      hash: found
        ? HashUtils.sha3(this.getBlockHeaderString(block, result)).slice(0, 8)
        : '', // Return an empty hash if not found.
    };
  }

  /**
   * Gets block header as string
   *
   * @protected
   * @method getBlockHeaderString
   * @param {Block} block - Block to process
   * @param {number} nonce - Nonce value
   * @returns {string} Block header string
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
    if (this.device) {
      await this.device.queue.onSubmittedWorkDone();
      this.device.destroy();
      this.pipeline = null;
      this.bindGroup = null;
    }
  }
}
