import { Command } from 'commander';
import { api } from '../services/api';

export const blockchainCommand = new Command('blockchain').description(
  'Manage blockchain operations',
);

// Get blockchain stats command
blockchainCommand
  .command('stats')
  .description('Get blockchain statistics')
  .action(async () => {
    try {
      const response = await api.get('/blockchain/stats');
      console.log('Blockchain Statistics:');
      console.log('---------------------');
      console.log(`Height: ${response.data.height}`);
      console.log(`Total Transactions: ${response.data.totalTransactions}`);
      console.log(`Difficulty: ${response.data.difficulty}`);
      console.log(`Hashrate: ${response.data.hashrate} H/s`);
      console.log(`Average Block Time: ${response.data.blockTime}s`);
    } catch (error: unknown) {
      console.error(
        'Failed to get blockchain stats:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });

// Get block info command
blockchainCommand
  .command('block')
  .description('Get block information')
  .argument('<hash>', 'Block hash')
  .action(async (hash) => {
    try {
      const response = await api.get(`/blockchain/blocks/${hash}`);
      console.log('Block Information:');
      console.log('-----------------');
      console.log(`Hash: ${response.data.hash}`);
      console.log(`Height: ${response.data.height}`);
      console.log(`Previous Hash: ${response.data.previousHash}`);
      console.log(
        `Timestamp: ${new Date(response.data.timestamp).toLocaleString()}`,
      );
      console.log(`Merkle Root: ${response.data.merkleRoot}`);
      console.log(`Transactions: ${response.data.transactions.length}`);
    } catch (error: unknown) {
      console.error(
        'Failed to get block info:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });

// Submit transaction command
blockchainCommand
  .command('submit-tx')
  .description('Submit a new transaction')
  .requiredOption('-s, --sender <address>', 'Sender address')
  .requiredOption('-r, --recipient <address>', 'Recipient address')
  .requiredOption('-a, --amount <amount>', 'Transaction amount')
  .requiredOption('-g, --signature <signature>', 'Transaction signature')
  .action(async (options) => {
    try {
      const response = await api.post('/blockchain/transactions', {
        sender: options.sender,
        recipient: options.recipient,
        amount: Number(options.amount),
        signature: options.signature,
      });
      console.log('Transaction submitted successfully');
      console.log('Transaction ID:', response.data.txId);
    } catch (error: unknown) {
      console.error(
        'Failed to submit transaction:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });

// Get UTXOs command
blockchainCommand
  .command('utxos')
  .description('Get UTXOs for an address')
  .argument('<address>', 'Wallet address')
  .action(async (address) => {
    try {
      const response = await api.get(
        `/blockchain/transactions/${address}/utxos`,
      );
      console.log('UTXOs:');
      console.table(
        response.data.map((utxo: { txId: string; outputIndex: number; amount: number; script: string }) => ({
          TxId: utxo.txId,
          Index: utxo.outputIndex,
          Amount: utxo.amount,
          Script: utxo.script,
        })),
      );
    } catch (error: unknown) {
      console.error(
        'Failed to get UTXOs:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });

// Get node info command
blockchainCommand
  .command('node-info')
  .description('Get blockchain node information')
  .action(async () => {
    try {
      const response = await api.get('/blockchain/node');
      console.log('Node Information:');
      console.log('----------------');
      console.log(`Network Type: ${response.data.networkType}`);
      console.log(`Port: ${response.data.port}`);
      console.log(`Connected Peers: ${response.data.peersCount}`);
      console.log(`Version: ${response.data.version}`);
      console.log(`Running: ${response.data.isRunning}`);
      console.log('\nSync Status:');
      console.log(`Synced: ${response.data.syncStatus.synced}`);
      console.log(`Height: ${response.data.syncStatus.height}`);
    } catch (error: unknown) {
      console.error(
        'Failed to get node info:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });

// Get blockchain height command
blockchainCommand
  .command('height')
  .description('Get current blockchain height')
  .action(async () => {
    try {
      const response = await api.get('/blockchain/height');
      console.log('Current Height:', response.data);
    } catch (error: unknown) {
      console.error(
        'Failed to get blockchain height:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });

// Get blockchain version command
blockchainCommand
  .command('version')
  .description('Get blockchain version')
  .action(async () => {
    try {
      const response = await api.get('/blockchain/version');
      console.log('Blockchain Version:', response.data);
    } catch (error: unknown) {
      console.error(
        'Failed to get blockchain version:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });

// Get best block hash command
blockchainCommand
  .command('best-block-hash')
  .description('Get the hash of the best (latest) block')
  .action(async () => {
    try {
      const response = await api.get('/blockchain/best-block-hash');
      console.log('Best Block Hash:', response.data.hash);
    } catch (error: unknown) {
      console.error(
        'Failed to get best block hash:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });

// Get blockchain info command
blockchainCommand
  .command('info')
  .description('Get blockchain information')
  .action(async () => {
    try {
      const response = await api.get('/blockchain/info');
      console.log('Blockchain Information:');
      console.log('----------------------');
      console.log(`Chain: ${response.data.chain}`);
      console.log(`Blocks: ${response.data.blocks}`);
      console.log(`Headers: ${response.data.headers}`);
      console.log(`Best Block Hash: ${response.data.bestBlockHash}`);
      console.log(`Difficulty: ${response.data.difficulty}`);
      console.log(
        `Median Time: ${new Date(response.data.medianTime).toLocaleString()}`,
      );
      console.log(
        `Verification Progress: ${(
          response.data.verificationProgress * 100
        ).toFixed(2)}%`,
      );
      console.log(`Chain Work: ${response.data.chainWork}`);
      console.log(
        `Initial Block Download: ${
          response.data.initialBlockDownload ? 'Yes' : 'No'
        }`,
      );
    } catch (error: unknown) {
      console.error(
        'Failed to get blockchain info:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });

// Get current difficulty command
blockchainCommand
  .command('difficulty')
  .description('Get current mining difficulty')
  .action(async () => {
    try {
      const response = await api.get('/blockchain/difficulty');
      console.log('Current Difficulty:');
      console.log('------------------');
      console.log(`Current: ${response.data.current}`);
      console.log(`Next: ${response.data.next}`);
      console.log(`Target: ${response.data.target}`);
      console.log(`Retarget in: ${response.data.blocksUntilRetarget} blocks`);
    } catch (error: unknown) {
      console.error(
        'Failed to get difficulty:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
      process.exit(1);
    }
  });
