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
      // Updated shader using a 12-byte buffer layout.
      const shader = `
                struct MiningData {
                    hash: u32,
                    found: atomic<u32>,
                    nonce: u32,
                };

                @group(0) @binding(0) var<storage, read_write> miningData: MiningData;
                @group(0) @binding(1) var<storage, read> target: u32;

                @compute @workgroup_size(256)
                fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
                    let currentNonce = global_id.x;
                    let computedHash = sha3_256(miningData.hash, currentNonce);
                    if (computedHash <= target) {
                        // Only one thread may claim the result.
                        if (atomicCompareExchangeWeak(&miningData.found, 0u, 1u).exchanged) {
                           miningData.nonce = currentNonce;
                        }
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

  async mine(
    block: Block,
    target: bigint,
    batchSize?: number,
  ): Promise<MiningResult> {
    if (!this.device || !this.pipeline) {
      throw new Error('GPU not initialized');
    }
    
    // Use provided batchSize or default to 256.
    const effectiveBatchSize = batchSize ?? 256;
    
    // If a custom batchSize is provided, recompile the pipeline with the new workgroup size.
    if (batchSize !== undefined && batchSize !== 256) {
      const shader = `
          override const WORKGROUP_SIZE: u32 = ${effectiveBatchSize};
          struct MiningData {
              hash: u32,
              found: atomic<u32>,
              nonce: u32,
          };

          @group(0) @binding(0) var<storage, read_write> miningData: MiningData;
          @group(0) @binding(1) var<storage, read> target: u32;

          @compute @workgroup_size(WORKGROUP_SIZE)
          fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
              let currentNonce = global_id.x;
              let computedHash = sha3_256(miningData.hash, currentNonce);
              if (computedHash <= target) {
                  if (atomicCompareExchangeWeak(&miningData.found, 0u, 1u).exchanged) {
                      miningData.nonce = currentNonce;
                  }
              }
          }
      `;
      this.pipeline = this.device.createComputePipeline({
        layout: 'auto',
        compute: {
          module: this.device.createShaderModule({ code: shader }),
          entryPoint: 'main',
        },
      });
    }
    
    // Compute dispatch count based on effectiveBatchSize.
    const maxWorkgroups = this.device.limits.maxComputeWorkgroupsPerDimension;
    const dispatchCount = Math.min(
      Math.ceil(this.MAX_NONCE / effectiveBatchSize),
      maxWorkgroups,
    );
    
    // Updated: Create a storage buffer with 12 bytes.
    // Layout: [blockHeaderHash (uint32), found flag (uint32), nonce (uint32)]
    const buffer = this.device.createBuffer({
      size: 12, // 3 * 4 bytes
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST, // Added COPY_DST for writeBuffer allowance.
    });

    const initialData = new Uint32Array([
      this.hashBlockHeader(block), // block header hash goes to data[0]
      0,                           // found flag (0 means "not found")
      0,                           // nonce placeholder (unused until found)
    ]);
    this.device.queue.writeBuffer(buffer, 0, initialData);

    // Create target buffer (same as before).
    const targetBuffer = this.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const targetNumber = Number(target);
    const targetData = new Uint32Array([targetNumber]);
    this.device.queue.writeBuffer(targetBuffer, 0, targetData);

    // Create bind group 
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer } },
        { binding: 1, resource: { buffer: targetBuffer } },
      ],
    });

    const commandEncoder = this.device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);

    pass.dispatchWorkgroups(dispatchCount);
    pass.end();

    // Updated: Read back the full 12 bytes to get both the found flag and nonce.
    const readBuffer = this.device.createBuffer({
      size: 12,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    commandEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, 12);

    this.device.queue.submit([commandEncoder.finish()]);
    await readBuffer.mapAsync(GPUMapMode.READ);
    const resultArray = new Uint32Array(readBuffer.getMappedRange());
    const foundFlag = resultArray[1];
    const nonce = resultArray[2];

    readBuffer.unmap();
    buffer.destroy();
    targetBuffer.destroy();
    readBuffer.destroy();

    const found = foundFlag !== 0; // found flag is 1 if a valid nonce was set

    return {
      found,
      nonce,
      hash: found
        ? HashUtils.sha3(this.getBlockHeaderString(block, nonce)).slice(0, 8)
        : '',
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
