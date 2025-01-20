import { Command } from 'commander';
import { api } from '../services/api';

export const peerCommand = new Command('peer').description(
  'Manage blockchain peers',
);

// Add peer command
peerCommand
  .command('add')
  .description('Add a new peer')
  .requiredOption('-a, --address <address>', 'Peer address (host:port)')
  .option(
    '-n, --network <network>',
    'Network type (MAINNET/TESTNET)',
    'MAINNET',
  )
  .option('-k, --public-key <key>', 'Peer public key')
  .action(async (options) => {
    try {
      const response = await api.post('/peers', {
        address: options.address,
        networkType: options.network,
        publicKey: options.publicKey,
      });
      console.log('Peer added successfully:', response.data);
    } catch (error: unknown) {
      console.error(
        'Failed to add peer:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });

// List peers command
peerCommand
  .command('list')
  .description('List all connected peers')
  .action(async () => {
    try {
      const response = await api.get('/peers');
      console.table(
        response.data.map((peer: { peerId: string; address: string; status: string; version: string; height: number; latency: number }) => ({
          ID: peer.peerId,
          Address: peer.address,
          Status: peer.status,
          Version: peer.version,
          Height: peer.height,
          Latency: `${peer.latency}ms`,
        })),
      );
    } catch (error: unknown) {
      console.error(
        'Failed to list peers:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });

// Remove peer command
peerCommand
  .command('remove')
  .description('Remove a peer')
  .argument('<peerId>', 'Peer identifier')
  .action(async (peerId) => {
    try {
      await api.delete(`/peers/${peerId}`);
      console.log('Peer removed successfully');
    } catch (error: unknown) {
      console.error(
        'Failed to remove peer:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });

// Ban peer command
peerCommand
  .command('ban')
  .description('Ban a peer')
  .argument('<peerId>', 'Peer identifier')
  .action(async (peerId) => {
    try {
      const response = await api.post(`/peers/${peerId}/ban`);
      console.log('Peer banned successfully:', response.data);
    } catch (error: unknown) {
      console.error(
        'Failed to ban peer:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });

// Get peer info command
peerCommand
  .command('info')
  .description('Get detailed peer information')
  .argument('<peerId>', 'Peer identifier')
  .action(async (peerId) => {
    try {
      const response = await api.get(`/peers/${peerId}/info`);
      console.log('Peer Detailed Information:');
      console.log('------------------------');
      console.log(`ID: ${response.data.id}`);
      console.log(`Address: ${response.data.address}:${response.data.port}`);
      console.log(`Version: ${response.data.version}`);
      console.log(`State: ${response.data.state}`);
      console.log(`Services: ${response.data.services}`);
      console.log(
        `Last Seen: ${new Date(response.data.lastSeen).toLocaleString()}`,
      );
      console.log(
        `Last Send: ${new Date(response.data.lastSend).toLocaleString()}`,
      );

      console.log('\nSync Status:');
      console.log(`Synced Blocks: ${response.data.syncedBlocks}`);
      console.log(
        `In-flight Blocks: ${response.data.inflight.join(', ') || 'None'}`,
      );

      console.log('\nSecurity Status:');
      console.log(`Whitelisted: ${response.data.whitelisted ? 'Yes' : 'No'}`);
      console.log(`Blacklisted: ${response.data.blacklisted ? 'Yes' : 'No'}`);

      console.log('\nCapabilities:');
      response.data.capabilities.forEach((cap: string) =>
        console.log(`- ${cap}`),
      );

      console.log(`\nUser Agent: ${response.data.userAgent}`);
    } catch (error: unknown) {
      console.error(
        'Failed to get peer info:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });

// Set ban status command
peerCommand
  .command('setban')
  .description('Set ban status for a peer')
  .requiredOption('-i, --ip <ip>', 'IP address to ban')
  .requiredOption('-c, --command <command>', 'Ban command (add/remove)')
  .option(
    '-t, --time <seconds>',
    'Ban duration in seconds (0 for permanent)',
    '0',
  )
  .option('-r, --reason <reason>', 'Reason for ban')
  .action(async (options) => {
    try {
      await api.post('/peers/ban', {
        ip: options.ip,
        command: options.command,
        banTime: parseInt(options.time),
        reason: options.reason,
      });
      console.log(
        `Peer ${
          options.command === 'add' ? 'banned' : 'unbanned'
        } successfully`,
      );
    } catch (error: unknown) {
      console.error(
        'Failed to set ban status:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });

// List bans command
peerCommand
  .command('listbans')
  .description('List all banned peers')
  .action(async () => {
    try {
      const response = await api.get('/peers/bans');
      console.table(
        response.data.map((ban: { ip: string; timeRemaining: number; createdAt: string; reason: string }) => ({
          IP: ban.ip,
          'Time Remaining': `${Math.floor(
            ban.timeRemaining / 3600,
          )}h ${Math.floor((ban.timeRemaining % 3600) / 60)}m`,
          'Created At': ban.createdAt,
          Reason: ban.reason,
        })),
      );
    } catch (error: unknown) {
      console.error(
        'Failed to list bans:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });

// Get ban info command
peerCommand
  .command('baninfo')
  .description('Get ban information for a specific IP')
  .argument('<ip>', 'IP address')
  .action(async (ip) => {
    try {
      const response = await api.get(`/peers/ban/${ip}`);
      console.log('Ban information:');
      console.log('----------------');
      console.log(`IP: ${response.data.ip}`);
      console.log(
        `Time Remaining: ${Math.floor(
          response.data.timeRemaining / 3600,
        )}h ${Math.floor((response.data.timeRemaining % 3600) / 60)}m`,
      );
      console.log(`Created At: ${response.data.createdAt}`);
      console.log(`Reason: ${response.data.reason}`);
    } catch (error: unknown) {
      console.error(
        'Failed to get ban info:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });

// Clear all bans command
peerCommand
  .command('clearbans')
  .description('Clear all bans')
  .action(async () => {
    try {
      await api.delete('/peers/bans');
      console.log('All bans cleared successfully');
    } catch (error: unknown) {
      console.error(
        'Failed to clear bans:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });

// Get network info command
peerCommand
  .command('network')
  .description('Get network information')
  .action(async () => {
    try {
      const response = await api.get('/peers/network');
      console.log('Network Information:');
      console.log('-------------------');
      console.log(`Version: ${response.data.version}`);
      console.log(`Protocol Version: ${response.data.protocolVersion}`);
      console.log('\nConnections:');
      console.log(`Total: ${response.data.connections}`);
      console.log(`Inbound: ${response.data.inbound}`);
      console.log(`Outbound: ${response.data.outbound}`);
      console.log(
        `Network Active: ${response.data.networkActive ? 'Yes' : 'No'}`,
      );

      if (response.data.localAddresses.length > 0) {
        console.log('\nLocal Addresses:');
        response.data.localAddresses.forEach((address: string) => {
          console.log(`- ${address}`);
        });
      }
    } catch (error: unknown) {
      console.error(
        'Failed to get network info:',
        (error as { response?: { data?: { error?: string } } }).response?.data
          ?.error || (error as Error).message,
      );
    }
  });
