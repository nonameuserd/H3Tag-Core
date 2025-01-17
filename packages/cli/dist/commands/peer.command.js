"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.peerCommand = void 0;
const commander_1 = require("commander");
const api_1 = require("../services/api");
exports.peerCommand = new commander_1.Command("peer").description("Manage blockchain peers");
// Add peer command
exports.peerCommand
    .command("add")
    .description("Add a new peer")
    .requiredOption("-a, --address <address>", "Peer address (host:port)")
    .option("-n, --network <network>", "Network type (MAINNET/TESTNET)", "MAINNET")
    .option("-k, --public-key <key>", "Peer public key")
    .action(async (options) => {
    try {
        const response = await api_1.api.post("/peers", {
            address: options.address,
            networkType: options.network,
            publicKey: options.publicKey,
        });
        console.log("Peer added successfully:", response.data);
    }
    catch (error) {
        console.error("Failed to add peer:", error.response?.data?.error || error.message);
    }
});
// List peers command
exports.peerCommand
    .command("list")
    .description("List all connected peers")
    .action(async () => {
    try {
        const response = await api_1.api.get("/peers");
        console.table(response.data.map((peer) => ({
            ID: peer.peerId,
            Address: peer.address,
            Status: peer.status,
            Version: peer.version,
            Height: peer.height,
            Latency: `${peer.latency}ms`,
        })));
    }
    catch (error) {
        console.error("Failed to list peers:", error.response?.data?.error || error.message);
    }
});
// Remove peer command
exports.peerCommand
    .command("remove")
    .description("Remove a peer")
    .argument("<peerId>", "Peer identifier")
    .action(async (peerId) => {
    try {
        await api_1.api.delete(`/peers/${peerId}`);
        console.log("Peer removed successfully");
    }
    catch (error) {
        console.error("Failed to remove peer:", error.response?.data?.error || error.message);
    }
});
// Ban peer command
exports.peerCommand
    .command("ban")
    .description("Ban a peer")
    .argument("<peerId>", "Peer identifier")
    .action(async (peerId) => {
    try {
        const response = await api_1.api.post(`/peers/${peerId}/ban`);
        console.log("Peer banned successfully:", response.data);
    }
    catch (error) {
        console.error("Failed to ban peer:", error.response?.data?.error || error.message);
    }
});
// Get peer info command
exports.peerCommand
    .command("info")
    .description("Get detailed peer information")
    .argument("<peerId>", "Peer identifier")
    .action(async (peerId) => {
    try {
        const response = await api_1.api.get(`/peers/${peerId}/info`);
        console.log("Peer Detailed Information:");
        console.log("------------------------");
        console.log(`ID: ${response.data.id}`);
        console.log(`Address: ${response.data.address}:${response.data.port}`);
        console.log(`Version: ${response.data.version}`);
        console.log(`State: ${response.data.state}`);
        console.log(`Services: ${response.data.services}`);
        console.log(`Last Seen: ${new Date(response.data.lastSeen).toLocaleString()}`);
        console.log(`Last Send: ${new Date(response.data.lastSend).toLocaleString()}`);
        console.log("\nSync Status:");
        console.log(`Synced Blocks: ${response.data.syncedBlocks}`);
        console.log(`In-flight Blocks: ${response.data.inflight.join(", ") || "None"}`);
        console.log("\nSecurity Status:");
        console.log(`Whitelisted: ${response.data.whitelisted ? "Yes" : "No"}`);
        console.log(`Blacklisted: ${response.data.blacklisted ? "Yes" : "No"}`);
        console.log("\nCapabilities:");
        response.data.capabilities.forEach((cap) => console.log(`- ${cap}`));
        console.log(`\nUser Agent: ${response.data.userAgent}`);
    }
    catch (error) {
        console.error("Failed to get peer info:", error.response?.data?.error || error.message);
    }
});
// Set ban status command
exports.peerCommand
    .command("setban")
    .description("Set ban status for a peer")
    .requiredOption("-i, --ip <ip>", "IP address to ban")
    .requiredOption("-c, --command <command>", "Ban command (add/remove)")
    .option("-t, --time <seconds>", "Ban duration in seconds (0 for permanent)", "0")
    .option("-r, --reason <reason>", "Reason for ban")
    .action(async (options) => {
    try {
        await api_1.api.post("/peers/ban", {
            ip: options.ip,
            command: options.command,
            banTime: parseInt(options.time),
            reason: options.reason,
        });
        console.log(`Peer ${options.command === "add" ? "banned" : "unbanned"} successfully`);
    }
    catch (error) {
        console.error("Failed to set ban status:", error.response?.data?.error || error.message);
    }
});
// List bans command
exports.peerCommand
    .command("listbans")
    .description("List all banned peers")
    .action(async () => {
    try {
        const response = await api_1.api.get("/peers/bans");
        console.table(response.data.map((ban) => ({
            IP: ban.ip,
            "Time Remaining": `${Math.floor(ban.timeRemaining / 3600)}h ${Math.floor((ban.timeRemaining % 3600) / 60)}m`,
            "Created At": ban.createdAt,
            Reason: ban.reason,
        })));
    }
    catch (error) {
        console.error("Failed to list bans:", error.response?.data?.error || error.message);
    }
});
// Get ban info command
exports.peerCommand
    .command("baninfo")
    .description("Get ban information for a specific IP")
    .argument("<ip>", "IP address")
    .action(async (ip) => {
    try {
        const response = await api_1.api.get(`/peers/ban/${ip}`);
        console.log("Ban information:");
        console.log("----------------");
        console.log(`IP: ${response.data.ip}`);
        console.log(`Time Remaining: ${Math.floor(response.data.timeRemaining / 3600)}h ${Math.floor((response.data.timeRemaining % 3600) / 60)}m`);
        console.log(`Created At: ${response.data.createdAt}`);
        console.log(`Reason: ${response.data.reason}`);
    }
    catch (error) {
        console.error("Failed to get ban info:", error.response?.data?.error || error.message);
    }
});
// Clear all bans command
exports.peerCommand
    .command("clearbans")
    .description("Clear all bans")
    .action(async () => {
    try {
        await api_1.api.delete("/peers/bans");
        console.log("All bans cleared successfully");
    }
    catch (error) {
        console.error("Failed to clear bans:", error.response?.data?.error || error.message);
    }
});
// Get network info command
exports.peerCommand
    .command("network")
    .description("Get network information")
    .action(async () => {
    try {
        const response = await api_1.api.get("/peers/network");
        console.log("Network Information:");
        console.log("-------------------");
        console.log(`Version: ${response.data.version}`);
        console.log(`Protocol Version: ${response.data.protocolVersion}`);
        console.log("\nConnections:");
        console.log(`Total: ${response.data.connections}`);
        console.log(`Inbound: ${response.data.inbound}`);
        console.log(`Outbound: ${response.data.outbound}`);
        console.log(`Network Active: ${response.data.networkActive ? "Yes" : "No"}`);
        if (response.data.localAddresses.length > 0) {
            console.log("\nLocal Addresses:");
            response.data.localAddresses.forEach((address) => {
                console.log(`- ${address}`);
            });
        }
    }
    catch (error) {
        console.error("Failed to get network info:", error.response?.data?.error || error.message);
    }
});
//# sourceMappingURL=peer.command.js.map