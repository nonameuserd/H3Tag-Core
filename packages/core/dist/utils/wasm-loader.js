"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadWasmModule = void 0;
async function loadWasmModule(path) {
    const response = await fetch(path);
    const bytes = await response.arrayBuffer();
    return WebAssembly.compile(bytes);
}
exports.loadWasmModule = loadWasmModule;
//# sourceMappingURL=wasm-loader.js.map