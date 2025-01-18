# Contributing to H3TAG

First off, thank you for considering contributing to H3TAG Blockchain. The project implements a unique hybrid consensus mechanism that combines Proof of Work (PoW) and Direct Voting, as implemented in the core consensus files:

- [`hybrid-direct.ts`](packages/core/src/blockchain/consensus/hybrid-direct.ts): Main consensus orchestrator
- [`pow.ts`](packages/core/src/blockchain/consensus/pow.ts): Proof of Work implementation
- [`voting.ts`](packages/core/src/blockchain/consensus/voting.ts): Voting mechanism

The consensus mechanism is built on two key pillars:

- **Security & Decentralization (PoW)**:

  - Utilizes traditional PoW for baseline security and block production
  - Maintains network decentralization through mining
  - Implements difficulty adjustment based on block time targets
  - Supports CPU, GPU and parallel mining strategies
  - Features mining metrics and performance monitoring
  - Includes worker pool management for efficient mining
  - Implements nonce caching for optimization
  - Provides mining interruption and resumption controls
  - Validates blocks against difficulty targets
  - Maintains merkle root verification for transactions
  - Features comprehensive error handling and logging
  - Includes automatic cleanup and resource management

- **Governance & Consensus (Voting)**:
  - Implements direct voting where:
    - Token holders participate in node selection through the `DirectVoting` class
    - No delegation or intermediaries (managed by `VotingPeriod` system)
    - Uses quadratic voting power calculation: `votingPower = sqrt(amount)`
    - Implements period-based node selection voting
    - Features comprehensive validation and auditing
    - Uses mutex locks and caching for scalability
    - Includes DDoS protection and circuit breakers
    - Maintains vote merkle roots for verification
    - Handles chain fork resolution through node selection voting
    - Tracks participation rates and voting metrics
    - Implements automatic backup and recovery systems
    - Voting periods are scheduled based on block height

The `HybridDirectConsensus` class combines these mechanisms by:

- Using PoW for block production and basic security
- Employing direct voting for fork resolution and governance
- Maintaining both consensus states simultaneously
- Providing fallback mechanisms when either system faces issues
- Scaling to handle thousands to billions of participants through efficient caching and sharding

This hybrid approach provides both the security benefits of PoW and the democratic governance benefits of direct voting, while maintaining scalability through careful system design.

## New Contributor Guide

To get an overview of the project, read the [README](README.md). Here are some resources to help you get started with open source contributions:

- [Finding ways to contribute to open source on GitHub](https://docs.github.com/en/get-started/exploring-projects-on-github/finding-ways-to-contribute-to-open-source-on-github)
- [Set up Git](https://docs.github.com/en/get-started/quickstart/set-up-git)
- [GitHub flow](https://docs.github.com/en/get-started/quickstart/github-flow)
- [Collaborating with pull requests](https://docs.github.com/en/github/collaborating-with-pull-requests)

## Project Structure

H3TAG is organized as a monorepo with the following packages:

- [`packages/api`](packages/api/): REST API server and endpoints for blockchain operations
- [`packages/cli`](packages/cli/): Command-line interface tools for api
- [`packages/core`](packages/core/): Core blockchain implementation
- [`packages/crypto`](packages/crypto/): Cryptographic utilities and functions
- [`packages/shared`](packages/shared/): Shared utilities and types

## Getting Started

### Prerequisites

- Node.js (version specified in `.node-version`)
- yarn (preferred package manager)
- Git

### Development Environment Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/nonameuserd/h3tag.git
   cd H3TAG-Core
   ```
3. Install dependencies:
   ```bash
   yarn install
   ```
4. Build all packages:
   ```bash
   yarn build
   ```

## Issues

### Create a New Issue

If you spot a problem, search if an issue already exists. If not, you can open a new issue.

### Solve an Issue

Scan through our issues to find one that interests you. You can narrow down the search using labels as filters.

## Making Changes

### Using GitHub Codespaces

1. Navigate to the repository on GitHub
2. Click the "Code" button
3. Click "Open with Codespaces"
4. Create a new branch for your changes
5. Make your changes
6. Commit and push your changes

### Making Changes Locally

1. Create a new branch:
   ```bash
   git checkout -b fix/issue-description
   ```
2. Make your changes
3. Test your changes:
   ```bash
   yarn test
   ```
4. Format and lint your code:
   ```bash
   yarn format
   yarn lint
   ```

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` New features

```bash
   example: git commit -m "feat: description of changes"
```

- `fix:` Bug fixes

```bash
   example: git commit -m "fix: description of changes"
```

- `docs:` Documentation changes

```bash
   example: git commit -m "docs: description of changes"
```

- `style:` Code style changes (formatting, etc.)

```bash
   example: git commit -m "style: description of changes"
```

- `refactor:` Code refactoring

```bash
   example: git commit -m "refactor: description of changes"
```

- `test:` Adding or modifying tests

```bash
   example: git commit -m "test: description of changes"
```

- `chore:` Maintenance tasks

```bash
   example: git commit -m "chore: description of changes"
```

## Pull Request Process

1. Update the README.md with details of changes if needed
2. Update any relevant documentation
3. Ensure all tests pass
4. Fill in the pull request template
5. Link the PR to any relevant issues

### Self Review Checklist

- [ ] Code follows project style guidelines
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] Commit messages follow guidelines
- [ ] Branch is up to date with main
- [ ] No unnecessary changes included
- [ ] Code has been self-reviewed
- [ ] Format and lint code

## Package-Specific Guidelines

### API Package

- Follow REST best practices
- Include API documentation with Swagger
- Add integration tests if applicable

### CLI Package

- Follow command naming conventions
- Include help text
- Add command tests if applicable
- Include documentation with Swagger

### Core Package

- Include unit tests
- Update technical documentation with JSDoc
- Follow blockchain standards

### Crypto Package

- Include security considerations
- Add comprehensive tests if applicable
- Document cryptographic choices

### Shared Package

- Keep utilities generic
- Include type definitions
- Add unit tests if applicable

## Getting Help

- Ask in [GitHub Discussions](../../discussions)
- Email at [nonameuserd007@outlook.com](mailto:nonameuserd007@outlook.com)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## License

By contributing to H3TAG, you agree that your contributions will be licensed under its [MIT License](LICENSE).
