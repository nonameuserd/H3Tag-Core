# @h3tag-blockchain/core

**H3Tag Blockchain Core** is the heart of the H3Tag blockchain ecosystem. Blockchain implementation with a hybrid consensus system that combines the security of Proof of Work with Direct Voting. Designed to be future-proof, it features native quantum-resistant cryptographic operations and advanced sharding capabilities to ensure scalability and resilience.

## Key Features

- **Hybrid Consensus:** Combines Proof of Work (PoW) and Direct Voting to achieve robust and decentralized consensus.
- **Quantum-Resistant Cryptography:** Incorporates native operations to secure the network against potential quantum-based threats.
- **Advanced Sharding:** Dynamically shards the blockchain to boost performance and scalability.
- **UTXO-Based Transactions:** Implements a transactional model inspired by Bitcoin for efficient and secure fund management.
- **Built-In DDoS Protection:** Employs layered strategies to mitigate Distributed Denial of Service attacks.
- **Performance Monitoring:** Gathers critical metrics for continuous network optimization.
- **Circuit Breaker Pattern:** Automatically isolates issues to protect system integrity.
- **Audit & Security Logging:** Provides comprehensive logging for in-depth analysis and compliance.
- **Automatic Backup Management:** Ensures data safety through streamlined backup operations.
- **Configurable Retry Strategies:** Offers flexible error handling mechanisms to improve transaction robustness.

## Quick Start

### Installation

To install the package, run:

```bash
yarn add @h3tag-blockchain/core
```

### Requirements

Ensure your system meets these prerequisites:

- **Node.js:** Version >= 20.18.1
- **OpenSSL:** Required for cryptographic operations
- **liboqs:** The Open Quantum Safe library for quantum resistance
- **C++ Build Tools:** Needed for compiling native modules

#### macOS Dependencies

```bash
yarn add openssl liboqs
```

#### Linux Dependencies

```bash
sudo apt-get install openssl liboqs-dev
```

## Building from Source

1. Install the dependencies:
   ```bash
   yarn install
   ```
2. Build the TypeScript sources:
   ```bash
   yarn build
   ```

## Testing

Run tests to validate the installation:

```bash
yarn test
```

For watch mode:

```bash
yarn test:watch
```

## Contributing

Contributions are welcome! Please review the contribution guidelines before submitting pull requests.

## License

This project is licensed under the [MIT License](LICENSE).
