export declare class SIMD {
    private static wasmSIMD;
    /**
     * Initializes the SIMD module.
     * Throws immediately if SIMD is not supported.
     */
    static initialize(): Promise<void>;
    /**
     * Computes the batch SHA3-256 hash for the given string data using the SIMD WASM module.
     * Depending on your wasm module implementation, the module may expect either a direct
     * Uint8Array or (more likely) a pointer to an input buffer plus its length.
     *
     * @param data The input string to hash.
     * @returns Array of hash strings.
     */
    static batchHashSHA3(data: string): Promise<string[]>;
    /**
     * Helper to decode a null-terminated string from WASM memory.
     * Throws an error if no null terminator is found within memory bounds.
     *
     * @param ptr Pointer to the string in WASM memory.
     * @param memory The wasm.Memory instance.
     * @returns The decoded JavaScript string.
     */
    private static decodeWasmString;
}
