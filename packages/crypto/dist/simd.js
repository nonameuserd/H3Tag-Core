"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SIMD = void 0;
const wasm_loader_1 = require("./wasm-loader");
class SIMD {
    static async initialize() {
        // Check for SIMD support
        if (WebAssembly.validate(new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]))) {
            const module = await (0, wasm_loader_1.loadWasmModule)("simd_sha3.wasm");
            this.wasmSIMD = await WebAssembly.instantiate(module);
        }
    }
    static async batchHashSHA3(data) {
        if (!this.wasmSIMD) {
            throw new Error("SIMD not supported or not initialized");
        }
        const { batch_hash_sha3_256 } = this.wasmSIMD.exports;
        const input = new TextEncoder().encode(data);
        return batch_hash_sha3_256(input);
    }
}
exports.SIMD = SIMD;
//# sourceMappingURL=simd.js.map