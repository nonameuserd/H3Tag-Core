"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadWasmModule = loadWasmModule;
async function loadWasmModule(path) {
    const response = await fetch(path);
    const bytes = await response.arrayBuffer();
    return WebAssembly.compile(bytes);
}
