import { Command } from 'commander';
import { api } from '../services/api';

export const mempoolCommand = new Command('mempool').description(
  'Manage mempool operations',
);

// Get mempool info command
mempoolCommand
  .command('info')
  .description('Get mempool information')
  .action(async () => {
    try {
      const response = await api.get('/mempool/info');
      console.log('Mempool Information:');
      console.log('-------------------');
      console.log(`Size: ${response.data.size} transactions`);
      console.log(`Total Size: ${response.data.bytes} bytes`);
      console.log(`Memory Usage: ${response.data.usage} bytes`);
      console.log(`Max Size: ${response.data.maxSize} transactions`);
      console.log('\nFees:');
      console.log(`Base: ${response.data.fees.base}`);
      console.log(`Current: ${response.data.fees.current}`);
      console.log(`Mean: ${response.data.fees.mean}`);
      console.log(`Median: ${response.data.fees.median}`);
      console.log(`Min: ${response.data.fees.min}`);
      console.log(`Max: ${response.data.fees.max}`);
      console.log('\nHealth:');
      console.log(`Status: ${response.data.health.status}`);
      console.log(
        `Accepting Transactions: ${response.data.health.isAcceptingTransactions}`,
      );
    } catch (error: unknown) {
      console.error(
        'Failed to get mempool info:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
      process.exit(1);
    }
  });

// Add raw mempool command
mempoolCommand
  .command('raw')
  .description('Get raw mempool transactions')
  .option('-v, --verbose', 'Show detailed transaction information')
  .action(async (options) => {
    try {
      const response = await api.get('/mempool/raw', {
        params: { verbose: options.verbose },
      });

      if (!options.verbose) {
        console.log('\nTransaction IDs in mempool:');
        console.log('-------------------------');
        response.data.forEach((txid: string) => console.log(txid));
        console.log(`\nTotal transactions: ${response.data.length}`);
      } else {
        console.log('\nDetailed Mempool Transactions:');
        console.log('---------------------------');
        Object.entries(response.data).forEach(
          ([txid, entry]: [string, any]) => {
            console.log(`\nTransaction: ${txid}`);
            console.log(`Fee: ${entry.fee}`);
            console.log(`Size: ${entry.vsize} bytes`);
            console.log(`Weight: ${entry.weight}`);
            console.log(
              `Time: ${new Date(entry.time * 1000).toLocaleString()}`,
            );
            console.log(`Height: ${entry.height}`);
            console.log(
              `Descendants: ${entry.descendantcount} (${entry.descendantsize} bytes)`,
            );
            console.log(
              `Ancestors: ${entry.ancestorcount} (${entry.ancestorsize} bytes)`,
            );
            console.log(
              'Depends on:',
              entry.depends.length ? entry.depends.join(', ') : 'none',
            );
          },
        );
      }
    } catch (error: unknown) {
      console.error(
        'Failed to get raw mempool:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
      process.exit(1);
    }
  });

// Add mempool entry command
mempoolCommand
  .command('entry')
  .description(
    'Get detailed information about a specific transaction in the mempool',
  )
  .requiredOption('-t, --txid <string>', 'Transaction ID to lookup')
  .action(async (options) => {
    try {
      const response = await api.get(`/mempool/entry/${options.txid}`);
      console.log('\nMempool Entry Details:');
      console.log('---------------------');
      console.log(`Transaction: ${response.data.txid}`);
      console.log(`Fee: ${response.data.fee}`);
      console.log(`Size: ${response.data.vsize} bytes`);
      console.log(`Weight: ${response.data.weight}`);
      console.log(
        `Time: ${new Date(response.data.time * 1000).toLocaleString()}`,
      );
      console.log(`Height: ${response.data.height}`);
      console.log(
        `Descendants: ${response.data.descendantcount} (${response.data.descendantsize} bytes)`,
      );
      console.log(
        `Ancestors: ${response.data.ancestorcount} (${response.data.ancestorsize} bytes)`,
      );
      console.log(
        'Depends on:',
        response.data.depends.length
          ? response.data.depends.join(', ')
          : 'none',
      );
    } catch (error: unknown) {
      console.error(
        'Failed to get mempool entry:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
      process.exit(1);
    }
  });
