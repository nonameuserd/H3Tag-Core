"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nodeCommand = void 0;
const commander_1 = require("commander");
const api_1 = require("../services/api");
const shared_1 = require("@h3tag-blockchain/shared");
exports.nodeCommand = new commander_1.Command("node").description("Manage blockchain nodes");
// Create testnet node command
exports.nodeCommand
    .command("create-testnet")
    .description("Create a new testnet node")
    .option("-r, --region <region>", "Region for node deployment")
    .option("-t, --type <type>", "Node type (full, light, archive)", "full")
    .option("-p, --port <port>", "Port number", "4000")
    .option("-h, --host <host>", "Host address", "localhost")
    .action(async (options) => {
    try {
        const response = await api_1.api.post("/nodes/testnet", {
            networkType: shared_1.NetworkType.TESTNET,
            region: options.region,
            nodeType: options.type,
            port: parseInt(options.port),
            host: options.host,
        });
        console.log("Testnet node created successfully:", response.data);
    }
    catch (error) {
        console.error("Failed to create testnet node:", error.response?.data?.error || error.message);
    }
});
// Create mainnet node command
exports.nodeCommand
    .command("create-mainnet")
    .description("Create a new mainnet node")
    .option("-r, --region <region>", "Region for node deployment")
    .option("-t, --type <type>", "Node type (full, light, archive)", "full")
    .option("-p, --port <port>", "Port number", "8333")
    .option("-h, --host <host>", "Host address", "localhost")
    .action(async (options) => {
    try {
        const response = await api_1.api.post("/nodes/mainnet", {
            networkType: shared_1.NetworkType.MAINNET,
            region: options.region,
            nodeType: options.type,
            port: parseInt(options.port),
            host: options.host,
        });
        console.log("Mainnet node created successfully:", response.data);
    }
    catch (error) {
        console.error("Failed to create mainnet node:", error.response?.data?.error || error.message);
    }
});
// Get node status command
exports.nodeCommand
    .command("status")
    .description("Get node status")
    .argument("<nodeId>", "Node identifier")
    .action(async (nodeId) => {
    try {
        const response = await api_1.api.get(`/nodes/${nodeId}/status`);
        console.log("Node status:", response.data);
    }
    catch (error) {
        console.error("Failed to get node status:", error.response?.data?.error || error.message);
    }
});
// Stop node command
exports.nodeCommand
    .command("stop")
    .description("Stop a running node")
    .argument("<nodeId>", "Node identifier")
    .action(async (nodeId) => {
    try {
        const response = await api_1.api.post(`/nodes/${nodeId}/stop`);
        console.log("Node stopped successfully:", response.data);
    }
    catch (error) {
        console.error("Failed to stop node:", error.response?.data?.error || error.message);
    }
});
// Get validators command
exports.nodeCommand
    .command("validators")
    .description("Get active validators for a node")
    .argument("<nodeId>", "Node identifier")
    .action(async (nodeId) => {
    try {
        const response = await api_1.api.get(`/nodes/${nodeId}/validators`);
        console.log("Active validators:", response.data);
    }
    catch (error) {
        console.error("Failed to get validators:", error.response?.data?.error || error.message);
    }
});
// Discover peers command
exports.nodeCommand
    .command("discover-peers")
    .description("Trigger peer discovery for a node")
    .argument("<nodeId>", "Node identifier")
    .action(async (nodeId) => {
    try {
        const response = await api_1.api.post(`/nodes/${nodeId}/discover-peers`);
        console.log("\nPeer Discovery Results:");
        console.log("---------------------");
        console.log(`New Peers Found: ${response.data.discoveredPeers}`);
        console.log(`Total Connected Peers: ${response.data.totalPeers}`);
        console.log("\nPeer Metrics:");
        console.log(`Current Peers: ${response.data.peerMetrics.current}`);
        console.log(`Minimum Required: ${response.data.peerMetrics.minimum}`);
        // Add status indicator
        const peerStatus = response.data.peerMetrics.current >= response.data.peerMetrics.minimum
            ? "✅ Healthy peer count"
            : "⚠️ Below minimum peer threshold";
        console.log(`\nStatus: ${peerStatus}`);
    }
    catch (error) {
        console.error("Failed to discover peers:", error.response?.data?.error || error.message);
        process.exit(1);
    }
});
// Connect to peer command
exports.nodeCommand
    .command("connect-peer")
    .description("Connect to a specific peer")
    .requiredOption("-n, --node-id <string>", "Node identifier")
    .requiredOption("-a, --address <string>", "Peer address (e.g., 127.0.0.1:8333)")
    .action(async (options) => {
    try {
        const response = await api_1.api.post(`/nodes/${options.nodeId}/connect-peer`, {
            address: options.address,
        });
        console.log("\nPeer Connection Details:");
        console.log("----------------------");
        console.log(`Status: ${response.data.status}`);
        console.log(`Address: ${response.data.address}`);
        console.log(`Version: ${response.data.version}`);
        console.log(`Height: ${response.data.height}`);
        console.log(`Connected At: ${response.data.connectedAt}`);
    }
    catch (error) {
        console.error("Failed to connect to peer:", error.response?.data?.error || error.message);
        process.exit(1);
    }
});
//# sourceMappingURL=node.command.js.map