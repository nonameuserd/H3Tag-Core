# H3TAG Blockchain API

H3TAG Blockchain API is an extensible RESTful service for interacting with the H3TAG blockchain network. The API is designed with a clear folder structure that separates concerns into controllers, DTOs, middleware, services, and routes. Whether you're managing blockchain operations, mining, node networking, peer management, voting, or wallet functionalities—the API covers it all.

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [API Documentation](#api-documentation)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Comprehensive Blockchain Operations:** Retrieve blockchain stats, blocks, height, version, difficulty, and more.
- **Modular Design:** Clear separation into controllers, DTOs, services, and middleware for easy maintenance and scalability.
- **Peer and Node Management:** Create and manage nodes and peers with built-in support for connection, banning, and status monitoring.
- **Secure Transactions:** Built-in endpoints for transaction handling, including raw transaction processing, decoding, fee estimation, and cryptographic message signing/verification.
- **Voting and Wallet Support:** Manage voting processes and wallet operations such as creation, signing, sending funds, and key management.
- **Swagger/OpenAPI Documentation:** Automatically generated interactive API docs for quick exploration and integration.
- **Robust Middleware:** Security headers, rate limiting, logging, and error handling are integrated to ensure reliable operations.

## Project Structure

The project follows a modular structure:

## Installation

```bash
yarn add @h3tag-blockchain/api
```

## Usage

### Starting the API Server

```typescript
import app from '@h3tag-blockchain/api';

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

This project is licensed under the [MIT License](LICENSE).
