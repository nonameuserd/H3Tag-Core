# H3Tag Blockchain CLI Tool

A comprehensive command-line interface for interacting with the blockchain network. This CLI provides a set of commands for managing blockchain operations, transactions, wallets, voting, and much more.

## Installation

```bash
npm install @h3tag-blockchain/cli
```

## Usage

The CLI organizes functionality into several command groups. Below are the available commands:

### Blockchain Commands

```bash
# Get blockchain statistics
blockchain stats

# Get block information by providing the block hash
blockchain block <hash>

# Submit a new transaction
blockchain submit-tx -s <sender> -r <recipient> -a <amount> -g <signature>

# Get UTXOs for an address
blockchain utxos <address>

# Get blockchain node information
blockchain node-info

# Get the blockchain version
blockchain version

# Get the best (latest) block hash
blockchain best-block-hash

# Get general blockchain information
blockchain info

# Get current mining difficulty
blockchain difficulty
```

### Mempool Commands

```bash
# Get mempool information
mempool info

# Get raw mempool transactions (use -v for verbose output)
mempool raw [-v]

# Get detailed information about a specific mempool transaction
mempool entry -t <txid>
```

### Mining Commands

```bash
# Get mining information
mining info

# Get network hash rate per second
mining hashps

# Get block template for mining (provide miner address)
mining template -a <address>

# Submit a mined block (provide header, transactions, and miner keypair as JSON)
mining submit-block --header <json> --transactions <json> --keypair <json>
```

### Node Commands

```bash
# Create a new testnet node
node create-testnet [-r <region>] [-t <type>] [-p <port>] [-h <host>]

# Create a new mainnet node
node create-mainnet [-r <region>] [-t <type>] [-p <port>] [-h <host>]

# Get node status
node status <nodeId>

# Stop a node
node stop <nodeId>

# Get active validators for a node
node validators <nodeId>

# Discover peers for a node
node discover-peers <nodeId>

# Connect to a specific peer
node connect-peer -n <nodeId> -a <address>
```

### Peer Commands

```bash
# Add a new peer
peer add -a <address> [-n <network>] [-k <public-key>]

# List all connected peers
peer list

# Remove a peer by its ID
peer remove <peerId>

# Ban a peer by its ID
peer ban <peerId>

# Get detailed information about a specific peer
peer info <peerId>

# Set ban status for an IP (add or remove ban)
peer setban -i <ip> -c <command> [-t <seconds>] [-r <reason>]

# List all banned peers
peer listbans

# Get ban information for a specific IP
peer baninfo <ip>

# Clear all bans
peer clearbans

# Get network information
peer network
```

### Transaction Commands

```bash
# Get transaction details by transaction ID (output as json or table)
transaction get <txId> [-f <format>]

# Get raw transaction data (output as json or hex)
transaction get-raw <txId> [-f <format>]

# Send a raw transaction (provide raw hex string)
transaction send-raw <rawTx>

# Decode a raw transaction (output as json or table)
transaction decode <rawTx> [-f <format>]

# Estimate transaction fee (specify target blocks with -b)
transaction estimate-fee [-b <blocks>]

# Sign a message using cryptography
transaction sign-message -m <message> -k <private-key>

# Verify a signed message
transaction verify-message -m <message> -s <signature> -p <public-key>

# Validate a blockchain address
transaction validate-address -a <address>
```

### Wallet Commands

```bash
# Create a new wallet (optionally with a password and/or mnemonic)
wallet create [-p <password>] [-m <mnemonic>]

# Get wallet information
wallet info <address>

# Sign a transaction
wallet sign <address> -f <from> -t <to> -a <amount> -k <public-key> -p <password> [--fee <fee>]

# Send tokens from one wallet to another
wallet send <fromAddress> -t <to> -a <amount> -p <password>

# Get wallet balance
wallet balance <address>

# Generate a new address for the wallet
wallet new-address <address>

# Export wallet private key (encrypted)
wallet export <address> -p <password>

# Import wallet from an encrypted private key
wallet import -k <encryptedKey> -a <address> -p <password>

# List unspent transaction outputs (UTXOs)
wallet unspent <address> [options]

# Get details of a specific transaction output
wallet txout <txid> <n>
```

### Voting Commands

```bash
# Submit a new vote
voting submit -v <voter> -c <choice> -s <signature> -a <amount>

# Get voting metrics
voting metrics

# Get current voting period information
voting period

# Retrieve votes for a specific address
voting votes <address>

# Check participation status for an address
voting check-participation <address>

# Get the voting schedule
voting schedule

# Calculate voting power for a given amount
voting power <amount>
```

### Metrics Commands

```bash
# Get general blockchain metrics
metrics info [-t <time-window>]

# Get TAG fee metrics
metrics fees [-t <time-window>]

# Get network metrics
metrics network

# Get blockchain sync status
metrics sync

# Get TAG volume metrics
metrics volume [-t <time-window>]
```

## Environment Variables

Create a `.env` file in your project root to define necessary environment variables:

```env
# Add your environment variables here (e.g., API URLs, ports, etc.)
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).
