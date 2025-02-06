"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadWasmModule = void 0;
async function loadWasmModule(modulePath, importObject = {}) {
    try {
        const response = await fetch(modulePath);
        if (!response.ok) {
            throw new Error(`Failed to fetch WASM module [${modulePath}]: ${response.statusText}`);
        }
        // Try using instantiateStreaming for efficiency.
        if (WebAssembly.instantiateStreaming) {
            try {
                const { instance } = await WebAssembly.instantiateStreaming(response, importObject);
                return instance;
            }
            catch (error) {
                // If instantiateStreaming fails (likely due to MIME type issues), fall back to ArrayBuffer instantiation.
                console.warn(`instantiateStreaming failed for ${modulePath}: ${error}. Falling back to ArrayBuffer approach.`);
            }
        }
        // Fallback: manually read the bytes, compile, and instantiate.
        const bytes = await response.arrayBuffer();
        const module = await WebAssembly.compile(bytes);
        const instance = await WebAssembly.instantiate(module, importObject);
        return instance;
    }
    catch (error) {
        throw new Error(`Failed to load WASM module [${modulePath}]: ${error}`);
    }
}
exports.loadWasmModule = loadWasmModule;
