export class SIMD {
  private static wasmSIMD: WebAssembly.Instance | null = null;

  /**
   * Initializes the SIMD module.
   * Throws immediately if SIMD is not supported.
   */
  static async initialize(): Promise<void> {
    const simdSupported = await (await import('wasm-feature-detect')).simd();
    if (!simdSupported) {
      throw new Error('SIMD is not supported in this environment.');
    }

    // Load the wasm module using the improved loader.
    this.wasmSIMD = await (await import('./wasm-loader')).loadWasmModule('simd_sha3.wasm');
  }

  /**
   * Computes the batch SHA3-256 hash for the given string data using the SIMD WASM module.
   * Depending on your wasm module implementation, the module may expect either a direct
   * Uint8Array or (more likely) a pointer to an input buffer plus its length.
   *
   * @param data The input string to hash.
   * @returns Array of hash strings.
   */
  static async batchHashSHA3(data: string): Promise<string[]> {
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
      const memory = this.wasmSIMD.exports.memory as WebAssembly.Memory;
      const allocate = this.wasmSIMD.exports.allocate as (size: number) => number;
      const deallocate = this.wasmSIMD.exports.deallocate as (ptr: number, size: number) => void;

      // Allocate buffer in WASM memory.
      const inputPtr = allocate(input.length);
      try {
        // Write the input data into the WASM memory.
        const memoryBuffer = new Uint8Array(memory.buffer);
        memoryBuffer.set(input, inputPtr);

        // Call the WASM function passing the pointer and length.
        const outputPtr = (batchHashFunc as (ptr: number, len: number) => number)(inputPtr, input.length);

        // For example purposes, we assume that:
        //   a) outputPtr is a pointer to a JSON-encoded result in WASM memory.
        //   b) The JSON result is null-terminated.
        const outputJSON = SIMD.decodeWasmString(outputPtr, memory);
        try {
          return JSON.parse(outputJSON);
        } catch (parseError) {
          throw new Error(`Failed to parse output JSON from WASM: ${parseError}`);
        }
      } finally {
        // Free the allocated memory for the input buffer.
        deallocate(inputPtr, input.length);
      }
    } else {
      // Fallback: if manual memory management is not provided
      return (batchHashFunc as (input: Uint8Array) => string[])(input);
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
  private static decodeWasmString(ptr: number, memory: WebAssembly.Memory): string {
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
