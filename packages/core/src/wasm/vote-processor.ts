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

export class WasmVoteProcessor {
    private wasmModule: any;

    constructor() {
        this.initWasm();
    }

    private async initWasm() {
        try {
            this.wasmModule = await import('./vote_processor_bg.wasm');
        } catch (error) {
            throw new Error('Failed to initialize WASM module: ' + error);
        }
    }

    async processVoteChunk(votes: VoteData[]): Promise<ChunkResult> {
        if (!this.wasmModule) {
            throw new Error('WASM module not initialized');
        }

        try {
            return await this.wasmModule.process_vote_chunk(votes);
        } catch (error) {
            throw new Error('Failed to process vote chunk: ' + error);
        }
    }
} 