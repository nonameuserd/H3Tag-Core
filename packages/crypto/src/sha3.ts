import { loadWasmModule } from "./wasm-loader";

export class WasmSHA3 {
  private static wasmInstance: WebAssembly.Instance;

  static async initialize(): Promise<void> {
    const wasmModule = await loadWasmModule("sha3.wasm");
    this.wasmInstance = await WebAssembly.instantiate(wasmModule, {
      env: {
        memory: new WebAssembly.Memory({ initial: 256 }),
        abort: () => console.error("Wasm aborted"),
      },
    });
  }

  static hash(data: Uint8Array): Uint8Array {
    const { hash_sha3_256, memory } = this.wasmInstance.exports as any;
    const ptr = hash_sha3_256(data);
    return new Uint8Array((memory as WebAssembly.Memory).buffer, ptr, 32);
  }
}
