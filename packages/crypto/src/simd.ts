import { loadWasmModule } from "./wasm-loader";

export class SIMD {
  private static wasmSIMD: WebAssembly.Instance;

  static async initialize(): Promise<void> {
    // Check for SIMD support
    if (
      WebAssembly.validate(
        new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])
      )
    ) {
      const module = await loadWasmModule("simd_sha3.wasm");
      this.wasmSIMD = await WebAssembly.instantiate(module);
    }
  }

  static async batchHashSHA3(data: string): Promise<string[]> {
    if (!this.wasmSIMD) {
      throw new Error("SIMD not supported or not initialized");
    }

    const { batch_hash_sha3_256 } = this.wasmSIMD.exports as any;
    const input = new TextEncoder().encode(data);
    return batch_hash_sha3_256(input);
  }
}
