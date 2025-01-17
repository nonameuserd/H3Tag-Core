# H3TAG Blockchain API

A RESTful API service for interacting with the H3TAG blockchain network. This API provides comprehensive endpoints for blockchain operations, transaction management, peer networking, mining operations, and voting functionality.

## Features

- Complete blockchain operations (blocks, transactions, mempool)
- Peer-to-peer network management
- Mining operations and block templates
- Transaction validation and signing
- Voting system integration
- Swagger/OpenAPI documentation
- Error handling and logging
- RESTful architecture

## Installation

```bash
yarn add @h3tag-blockchain/api
```

## Usage

### Starting the API Server

```typescript
import app from "@h3tag-blockchain/api";

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
```

## API Endpoints

### Blockchain Operations

- `GET /api/v1/blockchain/stats` - Get blockchain statistics
- `POST /api/v1/blockchain/transactions` - Submit a new transaction
- `GET /api/v1/blockchain/height` - Get current blockchain height
- `GET /api/v1/blockchain/info` - Get blockchain information
- `GET /api/v1/blockchain/node` - Get node information

### Transaction Operations

- `GET /api/v1/transactions/:txId` - Get transaction details
- `POST /api/v1/transactions/decode` - Decode raw transaction
- `POST /api/v1/transactions/validate-address` - Validate blockchain address
- `POST /api/v1/transactions/sign-message` - Sign a message
- `POST /api/v1/transactions/verify-message` - Verify a signed message

### Mining Operations

- `GET /api/v1/mining/info` - Get mining information
- `GET /api/v1/mining/network-hashps` - Get network hash rate
- `POST /api/v1/mining/template` - Get block template for mining
- `POST /api/v1/mining/submit-block` - Submit a mined block

### Peer Management

- `GET /api/v1/peers` - List connected peers
- `POST /api/v1/peers` - Add a new peer
- `DELETE /api/v1/peers/:peerId` - Remove a peer
- `GET /api/v1/peers/network-info` - Get network information
- `GET /api/v1/peers/bans` - List banned peers

### Voting System

- `POST /api/v1/voting/vote` - Submit a vote
- `GET /api/v1/voting/metrics` - Get voting metrics
- `GET /api/v1/voting/period/current` - Get current voting period
- `GET /api/v1/voting/votes/:address` - Get votes by address

## API Documentation

The API includes Swagger documentation accessible at `/api-docs` when running the server. You can also get the OpenAPI specification in JSON format at `/api-docs.json`.

## Error Handling

The API implements standardized error responses:

- `400 Bad Request` - Invalid input parameters
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server-side errors

All error responses include a message describing the error.

## Contributing

Contributions are welcome! Please feel free to submit pull requests.

## License

[MIT](LICENSE)
