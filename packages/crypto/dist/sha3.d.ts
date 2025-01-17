export declare class WasmSHA3 {
    private static wasmInstance;
    static initialize(): Promise<void>;
    static hash(data: Uint8Array): Uint8Array;
}
