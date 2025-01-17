/// <reference types="@webgpu/types" />
import { Block } from "../models/block.model";
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
export declare class GPUMiner {
    protected readonly MAX_NONCE: number;
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
    private hashBlockHeader;
    initialize(): Promise<void>;
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
    mine(block: Block, target: bigint): Promise<MiningResult>;
    /**
     * Gets block header as string
     *
     * @private
     * @method getBlockHeaderString
     * @param {Block} block - Block to process
     * @param {number} nonce - Nonce value
     * @returns {string} Block header string
     */
    private getBlockHeaderString;
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
    dispose(): Promise<void>;
}
export {};
