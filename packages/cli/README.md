# Blockchain CLI Tool

A comprehensive command-line interface for interacting with the blockchain network. This CLI provides commands for managing blockchain operations, transactions, wallets, voting, and more.

## Installation

```bash
npm install @h3tag-blockchain/cli
```

## Usage

The CLI provides several command groups for different blockchain operations:

### Blockchain Commands

```bash
# Get blockchain statistics
blockchain stats

# Get block information
blockchain block <hash>

# Submit transaction
blockchain submit-tx -s <sender> -r <recipient> -a <amount> -g <signature>

# Get UTXOs for an address
blockchain utxos <address>

# Get node information
blockchain node-info

# Get blockchain version
blockchain version

# Get best block hash
blockchain best-block-hash

# Get blockchain information
blockchain info

# Get current mining difficulty
blockchain difficulty
```

### Mempool Commands

```bash
# Get mempool information
mempool info

# Get raw mempool transactions
mempool raw [-v]

# Get detailed transaction information
mempool entry -t <txid>
```

### Mining Commands

```bash
# Get mining information
mining info

# Get network hash per second
mining hashps

# Get block template for mining
mining template -a <address>

# Submit mined block
mining submit-block -h <header> -t <transactions> -k <keypair>
```

### Node Commands

```bash
# Create testnet node
node create-testnet [-r <region>] [-t <type>] [-p <port>] [-h <host>]

# Create mainnet node
node create-mainnet [-r <region>] [-t <type>] [-p <port>] [-h <host>]

# Get node status
node status <nodeId>

# Stop node
node stop <nodeId>

# Get active validators
node validators <nodeId>

# Discover peers
node discover-peers <nodeId>

# Connect to peer
node connect-peer -n <nodeId> -a <address>
```

### Transaction Commands

```bash
# Get transaction details
transaction get <txId> [-f <format>]

# Get raw transaction data
transaction get-raw <txId> [-f <format>]

# Send raw transaction
transaction send-raw <rawTx>

# Decode transaction
transaction decode <rawTx> [-f <format>]

# Estimate transaction fee
transaction estimate-fee [-b <blocks>]

# Sign message
transaction sign-message -m <message> -k <private-key>

# Verify message
transaction verify-message -m <message> -s <signature> -p <public-key>

# Validate address
transaction validate-address -a <address>
```

### Wallet Commands

```bash
# Create new wallet
wallet create [-p <password>] [-m <mnemonic>]

# Get wallet information
wallet info <address>

# Sign transaction
wallet sign <address> -f <from> -t <to> -a <amount> -k <public-key> -p <password> [--fee <fee>]

# Send tokens
wallet send <fromAddress> -t <to> -a <amount> -p <password>

# Get wallet balance
wallet balance <address>

# Generate new address
wallet new-address

# Export private key
wallet export <address> -p <password>

# Import wallet
wallet import -k <encryptedKey> -a <address> -p <password>

# List UTXOs
wallet utxos <address> [options]

# Get transaction output details
wallet txout <txid> <n>
```

### Voting Commands

```bash
# Submit vote
voting submit -v <voter> -c <choice> -s <signature> -a <amount>

# Get voting metrics
voting metrics

# Get current voting period
voting period

# Get votes for address
voting votes <address>

# Check participation
voting check-participation <address>

# Get voting schedule
voting schedule

# Calculate voting power
voting power <amount>
```

## Environment Variables

Create a `.env` file in your project root:

```env
# Add your environment variables here
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](LICENSE)
