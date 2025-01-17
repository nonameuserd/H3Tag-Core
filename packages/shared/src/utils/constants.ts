import { DiscoveryConfig } from "./config";

export const DISCOVERY_CONFIG: DiscoveryConfig = {
  seedNodes: JSON.parse(process.env.SEED_NODES),
  maxPeers: parseInt(process.env.MAX_PEERS),
  minPeers: parseInt(process.env.MIN_PEERS),
  version: process.env.VERSION,
};
