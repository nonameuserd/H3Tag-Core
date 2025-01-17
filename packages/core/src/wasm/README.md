# WebAssembly Vote Processor

This directory contains the WebAssembly implementation of the vote processing system, which provides a high-performance, cross-platform solution for tallying votes in the blockchain.

## Prerequisites

Before you begin, ensure you have the following installed:

1. Rust and Cargo: 
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. WebAssembly target:
```bash
rustup target add wasm32-unknown-unknown
```
3. wasm-pack:
```bash
cargo install wasm-pack
```
wasm/
├── Cargo.toml # Rust dependencies and project configuration
├── src/
│ └── lib.rs # Rust implementation of vote processor
├── vote-processor.ts # TypeScript interface for the Wasm module
└── README.md # This file

## Building the WASM module

To build the WASM module, run the following command:
```bash
cd packages/core/src/wasm
wasm-pack build --target web
```

This will generate a `pkg` directory containing:
- `vote_processor_bg.wasm`: The WebAssembly binary
- `vote_processor.js`: JavaScript bindings
- `vote_processor.d.ts`: TypeScript type definitions

## Implementation Details

The vote processor is implemented in three main parts:

1. **Rust Implementation** (`vote-processor.rs`):
   - Uses parallel processing via `rayon`
   - Handles vote chunks efficiently
   - Provides SIMD optimizations where available
   - Manages memory efficiently using Rust's ownership system

2. **TypeScript Interface** (`vote-processor.ts`):
   - Provides a clean API for JavaScript/TypeScript usage
   - Handles WebAssembly initialization
   - Manages async operations

3. **Build Configuration** (`Cargo.toml`):
toml
[package]
name = "vote-processor"
version = "0.1.0"
edition = "2021"
[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1.0", features = ["derive"] }
serde-wasm-bindgen = "0.5"
rayon = "1.7"
web-sys = "0.3"
js-sys = "0.3"
[lib]
crate-type = ["cdylib"]


## Usage

In your TypeScript code:
```ts
import { WasmVoteProcessor } from './wasm/vote-processor';

const processor = new WasmVoteProcessor();
const result = await processor.processVoteChunk(votes);
```

## Performance Considerations

- Processes votes in chunks of 100,000 for optimal memory usage
- Utilizes parallel processing where available
- Falls back gracefully when GPU/CPU optimizations aren't available
- Provides consistent performance across different platforms

## Troubleshooting

If you encounter build issues:

1. Ensure all prerequisites are installed:
```bash
rustc --version
wasm-pack --version
```

2. Clear the target directory:
```bash
cargo clean
```

3. Update Rust toolchain:
```bash
rustup update
```

## Contributing

When modifying the WebAssembly implementation:

1. Update the Rust code in `vote-processor.rs`
2. Update TypeScript interfaces if necessary
3. Rebuild using `wasm-pack build --target web`
4. Test the integration with the main application
5. Update this documentation if you make significant changes

## Testing

To run the Rust tests:
```bash
cargo test
```

To run the integration tests:
```bash
wasm-pack test --node
```

## TypeScript Configuration

1. Ensure your `tsconfig.json` has the correct module setting:

```json
{
  "compilerOptions": {
   "module": "esnext", // or "es2020"   
  }
}
```

2. Add WebAssembly type declarations in `types.d.ts`:
```ts
declare module "*.wasm" {
    const content: any;
    export default content;
}
```


3. Include the wasm directory in your TypeScript compilation:
```ts
"include": [
  "src//"
]
```
