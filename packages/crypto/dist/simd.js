"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SIMD = void 0;
class SIMD {
    /**
     * Initializes the SIMD module.
     * Throws immediately if SIMD is not supported.
     */
    static async initialize() {
        const simdSupported = await (await Promise.resolve().then(() => __importStar(require('wasm-feature-detect')))).simd();
        if (!simdSupported) {
            throw new Error('SIMD is not supported in this environment.');
        }
        // Load the wasm module using the improved loader.
        this.wasmSIMD = await (await Promise.resolve().then(() => __importStar(require('./wasm-loader')))).loadWasmModule('simd_sha3.wasm');
    }
    /**
     * Computes the batch SHA3-256 hash for the given string data using the SIMD WASM module.
     * Depending on your wasm module implementation, the module may expect either a direct
     * Uint8Array or (more likely) a pointer to an input buffer plus its length.
     *
     * @param data The input string to hash.
     * @returns Array of hash strings.
     */
    static async batchHashSHA3(data) {
        if (!this.wasmSIMD) {
            throw new Error('SIMD not supported or not initialized');
        }
        // Ensure the wasm export is present and correctly typed.
        const batchHashFunc = this.wasmSIMD.exports.batch_hash_sha3_256;
        if (typeof batchHashFunc !== 'function') {
            throw new Error('WASM export "batch_hash_sha3_256" is not a function');
        }
        // Encode the string to a Uint8Array.
        const input = new TextEncoder().encode(data);
        // Check for required exports for manual memory management.
        if ('memory' in this.wasmSIMD.exports &&
            typeof this.wasmSIMD.exports.allocate === 'function' &&
            typeof this.wasmSIMD.exports.deallocate === 'function') {
            const memory = this.wasmSIMD.exports.memory;
            const allocate = this.wasmSIMD.exports.allocate;
            const deallocate = this.wasmSIMD.exports.deallocate;
            // Allocate buffer in WASM memory.
            const inputPtr = allocate(input.length);
            try {
                // Write the input data into the WASM memory.
                const memoryBuffer = new Uint8Array(memory.buffer);
                memoryBuffer.set(input, inputPtr);
                // Call the WASM function passing the pointer and length.
                const outputPtr = batchHashFunc(inputPtr, input.length);
                // For example purposes, we assume that:
                //   a) outputPtr is a pointer to a JSON-encoded result in WASM memory.
                //   b) The JSON result is null-terminated.
                const outputJSON = SIMD.decodeWasmString(outputPtr, memory);
                try {
                    return JSON.parse(outputJSON);
                }
                catch (parseError) {
                    throw new Error(`Failed to parse output JSON from WASM: ${parseError}`);
                }
            }
            finally {
                // Free the allocated memory for the input buffer.
                deallocate(inputPtr, input.length);
            }
        }
        else {
            // Fallback: if manual memory management is not provided
            return batchHashFunc(input);
        }
    }
    /**
     * Helper to decode a null-terminated string from WASM memory.
     * Throws an error if no null terminator is found within memory bounds.
     *
     * @param ptr Pointer to the string in WASM memory.
     * @param memory The wasm.Memory instance.
     * @returns The decoded JavaScript string.
     */
    static decodeWasmString(ptr, memory) {
        const memoryBuffer = new Uint8Array(memory.buffer);
        let end = ptr;
        const max = memoryBuffer.length;
        while (end < max && memoryBuffer[end] !== 0) {
            end++;
        }
        if (end === max) {
            throw new Error('Failed to decode string from WASM memory: null terminator not found');
        }
        const stringBytes = memoryBuffer.subarray(ptr, end);
        return new TextDecoder('utf8').decode(stringBytes);
    }
}
exports.SIMD = SIMD;
SIMD.wasmSIMD = null;
