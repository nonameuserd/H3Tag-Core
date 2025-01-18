"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadWasmModule = void 0;
async function loadWasmModule(modulePath) {
    try {
        const response = await fetch(modulePath);
        const bytes = await response.arrayBuffer();
        return WebAssembly.compile(bytes);
    }
    catch (error) {
        throw new Error(`Failed to load WASM module: ${error}`);
    }
}
exports.loadWasmModule = loadWasmModule;
