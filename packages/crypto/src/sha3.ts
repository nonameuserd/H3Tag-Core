import { loadWasmModule } from './wasm-loader';

interface WasmSHA3Exports {
  hash_sha3_256: (data: Uint8Array) => number;
  memory: WebAssembly.Memory;
}

export class WasmSHA3 {
  private static wasmInstance: WebAssembly.Instance | null = null;

  static async initialize(): Promise<void> {
    const wasmModule = await loadWasmModule('sha3.wasm');
    this.wasmInstance = await WebAssembly.instantiate(wasmModule, {
      env: {
        memory: new WebAssembly.Memory({ initial: 256 }),
        abort: () => console.error('Wasm aborted'),
      },
    });
  }

  static hash(data: Uint8Array): Uint8Array {
    if (!this.wasmInstance) {
      throw new Error(
        'Wasm module is not initialized. Please call WasmSHA3.initialize() before hashing.'
      );
    }
    const { hash_sha3_256, memory } = this.wasmInstance.exports as unknown as WasmSHA3Exports;
    
    const ptr = hash_sha3_256(data);
    
    const hashView = new Uint8Array(memory.buffer, ptr, 32);
    const result = new Uint8Array(32);
    result.set(hashView);
    
    return result;
  }
}
