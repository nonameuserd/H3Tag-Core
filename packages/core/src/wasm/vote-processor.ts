class WasmError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'WasmError';
  }
}

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

interface WasmVoteResult {
  approved: bigint;
  rejected: bigint;
  voters: string[];
}

interface WasmExports {
  process_vote_chunk: (data: Uint8Array) => WasmVoteResult;
}

export class WasmVoteProcessor {
  private wasmModule: WebAssembly.Instance | null = null;
  private memory: WebAssembly.Memory | null = null;
  private readonly MAX_CHUNK_SIZE = 1000;
  private initialized = false;

  // Make the constructor private so that users create instances via the async factory.
  private constructor() {}

  /**
   * Asynchronously creates and initializes a new WasmVoteProcessor.
   */
  public static async create(): Promise<WasmVoteProcessor> {
    const processor = new WasmVoteProcessor();
    await processor.initWasm();
    return processor;
  }

  private async initWasm(): Promise<void> {
    try {
      // Create a WebAssembly memory instance.
      const memory = new WebAssembly.Memory({ initial: 10, maximum: 100 });
      const importObject = {
        env: {
          memory,
          abort: () => console.error('Wasm aborted'),
        },
      };

      // Instantiate the wasm module.
      const wasmModule = await WebAssembly.instantiateStreaming(
        fetch('./vote_processor_bg.wasm'),
        importObject,
      );

      this.wasmModule = wasmModule.instance;
      this.memory = memory;
      this.initialized = true;
    } catch (error) {
      this.initialized = false;
      throw new WasmError('WASM initialization failed', error);
    }
  }

  /**
   * Processes a chunk of votes by serializing the data, passing it to WASM, and deserializing the result.
   */
  public async processVoteChunk(votes: VoteData[]): Promise<ChunkResult> {
    if (!this.initialized || !this.wasmModule) {
      throw new WasmError('WASM module not initialized');
    }

    if (votes.length > this.MAX_CHUNK_SIZE) {
      throw new WasmError(
        `Chunk size exceeds maximum of ${this.MAX_CHUNK_SIZE}`,
      );
    }

    try {
      const serializedVotes = this.serializeVotes(votes);
      const result = (
        this.wasmModule.exports as unknown as WasmExports
      ).process_vote_chunk(serializedVotes);
      return this.deserializeResult(result);
    } catch (error) {
      throw new WasmError('Vote processing failed', error);
    }
  }

  /**
   * Serializes vote data into a Uint8Array.
   *
   * Updated to correctly serialize the voter string:
   * [balance (8 bytes)] [approved (4 bytes)] [voterLength (4 bytes)] [voter bytes (UTF-8, variable)]
   */
  private serializeVotes(votes: VoteData[]): Uint8Array {
    const encoder = new TextEncoder();

    // Pre-calculate total buffer size.
    let totalSize = 0;
    const voteByteArrays: { headerSize: number; voterBytes: Uint8Array }[] = [];
    for (const vote of votes) {
      const voterBytes = encoder.encode(vote.voter);
      const headerSize = 8 + 4 + 4; // balance (8) + approved (4) + voter length (4)
      voteByteArrays.push({ headerSize, voterBytes });
      totalSize += headerSize + voterBytes.length;
    }

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    let offset = 0;

    votes.forEach((vote, index) => {
      const { voterBytes } = voteByteArrays[index];

      // Write balance as 8-byte BigInt.
      view.setBigInt64(offset, BigInt(vote.balance));
      offset += 8;

      // Write approved as a 4-byte integer.
      view.setInt32(offset, vote.approved);
      offset += 4;

      // Write the length of the voter string in bytes.
      view.setInt32(offset, voterBytes.length);
      offset += 4;

      // Write voter string bytes.
      new Uint8Array(buffer, offset, voterBytes.length).set(voterBytes);
      offset += voterBytes.length;
    });

    return new Uint8Array(buffer);
  }

  /**
   * Deserializes the result coming from WASM.
   *
   * Note: Converting bigints to numbers might lead to precision loss if the values are large.
   */
  private deserializeResult(rawResult: WasmVoteResult): ChunkResult {
    return {
      approved: Number(rawResult.approved),
      rejected: Number(rawResult.rejected),
      voters: Array.from(rawResult.voters),
    };
  }

  /**
   * Disposes of the WASM module and its memory.
   */
  public async dispose(): Promise<void> {
    this.wasmModule = null;
    this.memory = null;
    this.initialized = false;
  }
}
