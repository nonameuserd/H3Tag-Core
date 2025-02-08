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
  approved: bigint;
  rejected: bigint;
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

      let wasmModule;
      try {
        // Attempt to instantiate via streaming
        wasmModule = await WebAssembly.instantiateStreaming(
          fetch('./pkg/vote_processor_bg.wasm'),
          importObject,
        );
      } catch (streamingError) {
        // Fallback: instantiate from ArrayBuffer if streaming fails
        console.warn('instantiateStreaming failed, falling back to ArrayBuffer instantiation', streamingError);
        const response = await fetch('./pkg/vote_processor_bg.wasm');
        const buffer = await response.arrayBuffer();
        wasmModule = await WebAssembly.instantiate(buffer, importObject);
      }

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

    // Guard: if there are no votes, return a default chunk result.
    if (votes.length === 0) {
      return {
        approved: 0n,
        rejected: 0n,
        voters: [],
      };
    }

    try {
      const serializedVotes = this.serializeVotes(votes);
      const wasmExports = this.wasmModule.exports as unknown as WasmExports;
      if (typeof wasmExports.process_vote_chunk !== 'function') {
        throw new WasmError('WASM export "process_vote_chunk" is missing');
      }
      const result = wasmExports.process_vote_chunk(serializedVotes);
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

      // Write balance as 8-byte BigInt in little-endian order.
      view.setBigInt64(offset, BigInt(vote.balance), true);
      offset += 8;

      // Write approved as a 4-byte integer in little-endian order.
      view.setInt32(offset, vote.approved, true);
      offset += 4;

      // Write the length of the voter string in bytes in little-endian order.
      view.setInt32(offset, voterBytes.length, true);
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
   */
  private deserializeResult(rawResult: WasmVoteResult): ChunkResult {
    return {
      approved: rawResult.approved,
      rejected: rawResult.rejected,
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
