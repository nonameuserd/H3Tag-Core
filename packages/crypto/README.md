# @h3tag-blockchain/crypto

A comprehensive cryptographic library that combines traditional and quantum-resistant cryptographic operations for blockchain applications.

## Features

- Hybrid cryptographic operations (classical + quantum-resistant)
- Support for multiple quantum-resistant algorithms (Dilithium, Kyber)
- Extensive hashing utilities (SHA3, SHA256, RIPEMD160, etc.)
- Base58 encoding/decoding
- Key pair generation and management
- Native quantum cryptography module integration
- Configurable security levels

## Installation

```bash
yarn add @h3tag-blockchain/crypto

yarn install

yarn build
```

## Usage

### Basic Hash Operations

The library includes a range of hashing utilities. For example, to generate a SHA3-512 hash:

```typescript
import { HashUtils } from '@h3tag-blockchain/crypto';
const data = 'Hello, blockchain!';
const hashHex = HashUtils.sha3(data);
console.log('SHA3-512 Hash:', hashHex);
```

### Hybrid Cryptography (Signing & Verification)

Use the `HybridCrypto` class to sign messages using a combination of classical and quantum-resistant methods, and verify them accordingly:

```typescript
import { HybridCrypto } from '@h3tag-blockchain/crypto';
const message = 'Secure transaction data';
const keyPair = await HybridCrypto.generateKeyPair();
const signature = await HybridCrypto.sign(message, keyPair);
const isValid = await HybridCrypto.verify(
  message,
  signature,
  keyPair.publicKey,
);
console.log('Signature valid?', isValid);
```

### Advanced Quantum Operations

For advanced use cases, you can directly interact with quantum-resistant primitives such as those in the `Dilithium` and `Kyber` modules—or use the unified interface provided by the `QuantumWrapper` for:

- Quantum-resistant key generation
- Signing and verification
- Hybrid hash generation

## API Reference

Detailed API documentation is available in the source code and generated TypeScript declaration files. Major modules include:

- **HybridCrypto:** Handles hybrid encryption, decryption, signing, and verification.
- **HashUtils:** Provides classical and hybrid hash functions.
- **KeyManager:** Manages generation, serialization, and validation of key pairs.
- **QuantumCrypto & QuantumWrapper:** Native implementations and wrappers exposing quantum-resistant cryptographic operations.
- **SIMD:** WebAssembly-based SIMD functions for accelerated batch hashing.

## Contributing

Contributions are welcome! Please review the contribution guidelines before submitting pull requests.

## License

This project is licensed under the [MIT License](LICENSE).
