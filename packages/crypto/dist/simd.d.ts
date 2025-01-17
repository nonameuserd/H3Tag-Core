export declare class SIMD {
    private static wasmSIMD;
    static initialize(): Promise<void>;
    static batchHashSHA3(data: string): Promise<string[]>;
}
