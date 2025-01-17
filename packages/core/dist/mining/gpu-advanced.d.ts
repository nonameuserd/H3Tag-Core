/// <reference types="@webgpu/types" />
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
export declare class AdvancedGPUMiner extends GPUMiner {
    private workgroupSize;
    private maxComputeUnits;
    private shaderCache;
    private blockBuffer;
    private resultBuffer;
    private readonly CURRENCY_CONSTANTS;
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
    initialize(): Promise<void>;
    /**
     * Calculates optimal workgroup size
     *
     * @private
     * @method calculateOptimalWorkgroupSize
     * @returns {number} Optimal workgroup size
     */
    private calculateOptimalWorkgroupSize;
    /**
     * Creates an optimized compute pipeline
     *
     * @private
     * @method createOptimizedPipeline
     * @param {bigint} target - Mining target difficulty
     * @returns {Promise<GPUComputePipeline>} Compiled pipeline
     * @throws {Error} If shader compilation fails
     */
    private createOptimizedPipeline;
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
    mineOptimized(blockBuffer: GPUBuffer, target: number): Promise<number | null>;
    /**
     * Creates a bind group for GPU operations
     *
     * @private
     * @method createBindGroup
     * @param {number} chunkIndex - Mining chunk index
     * @returns {GPUBindGroup} Configured bind group
     * @throws {Error} If pipeline not initialized
     */
    private createBindGroup;
    /**
     * Retrieves mining results
     *
     * @private
     * @method getResult
     * @returns {Promise<number>} Mining result
     */
    private getResult;
    /**
     * Reads data from a GPU buffer
     *
     * @private
     * @method readBufferData
     * @param {GPUBuffer} buffer - GPU buffer to read
     * @returns {Promise<ArrayBuffer>} Buffer data
     */
    private readBufferData;
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
