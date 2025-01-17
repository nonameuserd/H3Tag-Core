import { Block } from "../models/block.model";
import { HashUtils } from "@h3tag-blockchain/crypto";

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
  protected device: GPUDevice;
  protected pipeline: GPUComputePipeline;
  protected bindGroup: GPUBindGroup;

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

  private hashBlockHeader(block: Block): number {
    const header = block.header;
    const data = [
      header.version,
      header.previousHash,
      header.merkleRoot,
      header.timestamp,
      header.difficulty,
      header.nonce,
    ].join("");

    return parseInt(HashUtils.sha3(data).slice(0, 8), 16);
  }

  async initialize(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error("WebGPU not supported");
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance",
    });
    if (!adapter) {
      throw new Error("No GPU adapter found");
    }

    this.device = await adapter.requestDevice({
      requiredFeatures: ["timestamp-query"],
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
        layout: "auto",
        compute: {
          module: this.device.createShaderModule({
            code: shader,
          }),
          entryPoint: "main",
        },
      });
    } catch (error) {
      throw new Error(`Failed to create pipeline: ${error.message}`);
    }
  }

  /**
   * Mines a block with the given target difficulty
   *
   * @async
   * @method mine
   * @param {Block} block - Block to mine
   * @param {bigint} target - Mining target difficulty
   * @returns {Promise<MiningResult>} Mining result with nonce and hash
   * @throws {Error} If GPU not initialized or mining fails
   *
   * @example
   * const result = await miner.mine(block, target);
   * if (result.found) {
   *   console.log(`Found nonce: ${result.nonce}`);
   * }
   */

  async mine(block: Block, target: bigint): Promise<MiningResult> {
    if (!this.device || !this.pipeline) {
      throw new Error("GPU not initialized");
    }

    const buffer = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const blockData = new Uint32Array([this.hashBlockHeader(block)]);
    const targetData = new BigUint64Array([target]);

    try {
      this.device.queue.writeBuffer(buffer, 0, blockData);
      this.device.queue.writeBuffer(buffer, 8, targetData);

      const targetBuffer = this.device.createBuffer({
        size: 8,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(targetBuffer, 0, targetData);

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
      pass.dispatchWorkgroups(Math.ceil(this.MAX_NONCE / 256));
      pass.end();

      const readBuffer = this.device.createBuffer({
        size: 8,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
      commandEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, 8);

      this.device.queue.submit([commandEncoder.finish()]);
      await readBuffer.mapAsync(GPUMapMode.READ);
      const result = new Uint32Array(readBuffer.getMappedRange())[0];

      readBuffer.unmap();
      buffer.destroy();
      targetBuffer.destroy();
      readBuffer.destroy();

      return {
        found: true,
        nonce: result,
        hash: HashUtils.sha3(this.getBlockHeaderString(block, result)).slice(
          0,
          8
        ),
      };
    } catch (error) {
      throw new Error(`Mining operation failed: ${error.message}`);
    }
  }

  /**
   * Gets block header as string
   *
   * @private
   * @method getBlockHeaderString
   * @param {Block} block - Block to process
   * @param {number} nonce - Nonce value
   * @returns {string} Block header string
   */

  private getBlockHeaderString(block: Block, nonce: number): string {
    const header = block.header;
    return [
      header.version,
      header.previousHash,
      header.merkleRoot,
      header.timestamp,
      header.difficulty,
      nonce,
    ].join("");
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
