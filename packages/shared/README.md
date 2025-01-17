# H3TAG Blockchain Shared Package

Core utilities and configurations shared across the H3TAG blockchain packages.

## Features

- Configuration management
- Logging utilities
- Status codes and messages
- Currency constants and utilities
- Common type definitions

## Installation

```bash
yarn add @h3tag-blockchain/shared
```

## Usage

## Configuration Options

### Network Configuration

- `type`: Network type (MAINNET, TESTNET, DEVNET)
- `port`: Network port
- `host`: Network host
- `seedDomains`: List of seed nodes

### Blockchain Configuration

- `maxSupply`: Maximum token supply
- `initialSupply`: Initial token supply
- `blockTime`: Target block time
- `halvingInterval`: Blocks between reward halvings

### Consensus Configuration

- `powWeight`: Proof of Work weight
- `voteWeight`: Voting weight
- `minPowHashrate`: Minimum hashrate requirement
- `votingPeriod`: Voting period duration

### Currency Configuration

- `name`: Currency name
- `symbol`: Currency symbol
- `decimals`: Decimal places
- `units`: Currency unit definitions

## Contributing

Contributions are welcome! Please feel free to submit pull requests.

## License

[MIT](LICENSE)
