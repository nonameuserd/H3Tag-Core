# H3TAG Blockchain Shared Package

This package acts as the backbone of the H3TAG blockchain projects by providing core utilities and configurations that are shared across various packages. The shared module contains centralized configuration management, logging, status codes for common HTTP responses, and utility functions for currencies and other type definitions. It reduces redundancy and ensures consistency across the project.

## Features

- **Configuration Management**
  - Robust configuration service (`ConfigService`) for handling environment variables and default configurations in a type-safe manner.
  - Built-in validation and caching of configuration values.
- **Logging Utilities**
  - Integrated [Winston](https://github.com/winstonjs/winston) logging framework with daily rotation and support for Express request logging.
- **Status Codes & Messages**
  - Predefined sets of HTTP status codes and descriptive messages for success and error responses.
- **Currency Constants & Utilities**

  - Define currency details such as name, symbol, decimals, and unit conversions.
  - Utility functions for conversion between TAG units and smallest currency units (wei).

- **Common Type Definitions**
  - Shared interfaces and types used across the blockchain ecosystem.

## Installation

To install the package, run:

```bash
yarn add @h3tag-blockchain/shared
```

## Usage

### Importing Shared Utilities

For example, to use the configuration service:

```typescript
import { ConfigService } from '@h3tag-blockchain/shared';

// Get the global configuration instance
const configService = ConfigService.getInstance();
const host = configService.get<string>('network.host');
console.log('Network Host:', host);
```

To use the currency utilities:

```typescript
import { CurrencyUtils } from '@h3tag-blockchain/shared';

const weiValue = CurrencyUtils.toWei(1);
console.log('1 TAG in wei:', weiValue);

const tagValue = CurrencyUtils.fromWei(weiValue);
console.log('Wei to TAG:', tagValue);
```

To log messages:

```typescript
import { Logger } from '@h3tag-blockchain/shared';

Logger.info('Application has started...');
```

### Configuration Options

Detailed configuration options are available in the [`src/utils/config.ts`](./src/utils/config.ts) file. Key configuration areas include:

- **Network Configuration**

  - `type`: Network type (MAINNET, TESTNET, DEVNET)
  - `port`: Specific ports for each network type
  - `host`: Domain names for respective network types
  - `seedDomains`: Lists of seed domains for node discovery

- **Blockchain & Mining Configuration**

  - Token supply limits, block timing, mining rewards, and difficulty settings

- **Consensus & Voting Configuration**

  - Proof of Work parameters and voting settings to ensure network consensus

- **Currency Configuration**
  - Currency details like name, symbol, decimals, and unit conversion factors

For advanced customization, refer directly to the source code to see how configuration parameters are validated and merged with default settings.

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open an issue if you have ideas for improvements or encounter any bugs.

## License

This project is licensed under the [MIT License](LICENSE).
