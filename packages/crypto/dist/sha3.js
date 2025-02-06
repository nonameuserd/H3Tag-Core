"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WasmSHA3 = void 0;
const wasm_loader_1 = require("./wasm-loader");
class WasmSHA3 {
    static async initialize() {
        const wasmModule = await (0, wasm_loader_1.loadWasmModule)('sha3.wasm');
        this.wasmInstance = await WebAssembly.instantiate(wasmModule, {
            env: {
                memory: new WebAssembly.Memory({ initial: 256 }),
                abort: () => console.error('Wasm aborted'),
            },
        });
    }
    static hash(data) {
        if (!this.wasmInstance) {
            throw new Error('Wasm module is not initialized. Please call WasmSHA3.initialize() before hashing.');
        }
        const { hash_sha3_256, memory } = this.wasmInstance.exports;
        const ptr = hash_sha3_256(data);
        const hashView = new Uint8Array(memory.buffer, ptr, 32);
        const result = new Uint8Array(32);
        result.set(hashView);
        return result;
    }
}
exports.WasmSHA3 = WasmSHA3;
WasmSHA3.wasmInstance = null;
