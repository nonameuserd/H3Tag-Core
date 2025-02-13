import { Command } from 'commander';
import { api } from '../services/api';

export const miningCommand = new Command('mining').description(
  'Manage mining operations',
);

// Get mining info command
miningCommand
  .command('info')
  .description('Get mining information')
  .action(async () => {
    try {
      const response = await api.get('/mining/info');
      console.log('Mining Information:');
      console.log('------------------');
      console.log(`Block Height: ${response.data.blocks}`);
      console.log(`Difficulty: ${response.data.difficulty}`);
      console.log(`Network Hashrate: ${response.data.networkHashrate} H/s`);
      console.log(`Block Reward: ${response.data.reward} coins`);
      console.log(`Chain Work: ${response.data.chainWork}`);
      console.log(
        `Mining Active: ${response.data.isNetworkMining ? 'Yes' : 'No'}`,
      );
      console.log(`Network HashPS: ${response.data.networkHashPS} H/s`);
    } catch (error: unknown) {
      console.error(
        'Failed to get mining info:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
      process.exit(1);
    }
  });

// Add new command for getting network hash per second
miningCommand
  .command('hashps')
  .description('Get network hash per second')
  .action(async () => {
    try {
      const response = await api.get('/mining/hashps');
      console.log(`Network Hash Rate: ${response.data.hashPS} H/s`);
    } catch (error: unknown) {
      console.error(
        'Failed to get network hash rate:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
      process.exit(1);
    }
  });

// Add block template command
miningCommand
  .command('template')
  .description('Get block template for mining')
  .requiredOption('-a, --address <string>', 'Miner address to receive rewards')
  .action(async (options) => {
    try {
      const response = await api.post('/mining/template', {
        minerAddress: options.address,
      });

      console.log('Block Template:');
      console.log('--------------');
      console.log(`Version: ${response.data.version}`);
      console.log(`Height: ${response.data.height}`);
      console.log(`Previous Hash: ${response.data.previousHash}`);
      console.log(`Timestamp: ${response.data.timestamp}`);
      console.log(`Difficulty: ${response.data.difficulty}`);
      console.log(`Merkle Root: ${response.data.merkleRoot}`);
      console.log(`Target: ${response.data.target}`);
      console.log(`Transactions: ${response.data.transactions.length}`);
      console.log(
        `Time Range: ${response.data.minTime} - ${response.data.maxTime}`,
      );
      console.log(
        `Version Range: ${response.data.minVersion} - ${response.data.maxVersion}`,
      );
    } catch (error: unknown) {
      console.error(
        'Failed to get block template:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
      process.exit(1);
    }
  });

// Add submit block command
miningCommand
  .command('submit-block')
  .description('Submit a mined block')
  .requiredOption('--header <json>', 'Block header data in JSON format')
  .requiredOption('--transactions <json>', 'Block transactions in JSON format')
  .requiredOption('--keypair <json>', 'Miner keypair in JSON format')
  .action(async (options) => {
    try {
      const header = JSON.parse(options.header);
      const transactions = JSON.parse(options.transactions);
      const minerKeyPair = JSON.parse(options.keypair);

      const response = await api.post('/mining/submit-block', {
        header,
        transactions,
        minerKeyPair,
      });

      console.log('Block Submission Result:');
      console.log('----------------------');
      console.log(`Status: ${response.data.status}`);
      console.log(`Block Hash: ${response.data.blockHash}`);
    } catch (error: unknown) {
      console.error(
        'Failed to submit block:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
      process.exit(1);
    }
  });
