# @h3tag-blockchain/core

Core blockchain implementation with hybrid consensus (PoW + Direct Voting), native quantum-resistant cryptography, and advanced sharding capabilities.

## Features

- Hybrid consensus mechanism combining Proof of Work and Direct Voting
- Native quantum-resistant cryptographic operations
- Advanced blockchain sharding
- UTXO-based transaction model
- Built-in DDoS protection
- Performance monitoring and metrics collection
- Circuit breaker pattern for system protection
- Audit logging and security monitoring
- Automatic backup management
- Configurable retry strategies

## Installation

```bash
yarn add @h3tag-blockchain/core
```

## Requirements

- Node.js >= 20.18.1
- OpenSSL
- liboqs (Open Quantum Safe library)
- C++ build tools

### macOS Dependencies

```bash
yarn add openssl liboqs
```

### Linux Dependencies

```bash
sudo apt-get install openssl liboqs-dev
```

## Building from Source

```bash
# Install dependencies
yarn install

# Build TypeScript
yarn build
```

## Contributing

Contributions are welcome! Please feel free to submit pull requests.

## License

[MIT](LICENSE)
