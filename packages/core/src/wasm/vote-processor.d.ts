export interface VoteData {
    balance: string;
    approved: number;
    voter: string;
}
interface ChunkResult {
    approved: number;
    rejected: number;
    voters: string[];
}
export declare class WasmVoteProcessor {
    private wasmModule;
    constructor();
    private initWasm;
    processVoteChunk(votes: VoteData[]): Promise<ChunkResult>;
}
export {};
