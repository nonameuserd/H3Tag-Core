export const DISCOVERY_CONFIG = {
  seedNodes: JSON.parse(process.env.SEED_NODES || '[]'),
  maxPeers: parseInt(process.env.MAX_PEERS || '0'),
  minPeers: parseInt(process.env.MIN_PEERS || '0'),
  version: process.env.VERSION || '0.0.0',
};
