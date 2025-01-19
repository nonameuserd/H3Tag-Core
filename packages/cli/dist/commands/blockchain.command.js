"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockchainCommand = void 0;
const commander_1 = require("commander");
const api_1 = require("../services/api");
exports.blockchainCommand = new commander_1.Command("blockchain").description("Manage blockchain operations");
// Get blockchain stats command
exports.blockchainCommand
    .command("stats")
    .description("Get blockchain statistics")
    .action(async () => {
    try {
        const response = await api_1.api.get("/blockchain/stats");
        console.log("Blockchain Statistics:");
        console.log("---------------------");
        console.log(`Height: ${response.data.height}`);
        console.log(`Total Transactions: ${response.data.totalTransactions}`);
        console.log(`Difficulty: ${response.data.difficulty}`);
        console.log(`Hashrate: ${response.data.hashrate} H/s`);
        console.log(`Average Block Time: ${response.data.blockTime}s`);
    }
    catch (error) {
        console.error("Failed to get blockchain stats:", error.response?.data?.error || error.message);
    }
});
// Get block info command
exports.blockchainCommand
    .command("block")
    .description("Get block information")
    .argument("<hash>", "Block hash")
    .action(async (hash) => {
    try {
        const response = await api_1.api.get(`/blockchain/blocks/${hash}`);
        console.log("Block Information:");
        console.log("-----------------");
        console.log(`Hash: ${response.data.hash}`);
        console.log(`Height: ${response.data.height}`);
        console.log(`Previous Hash: ${response.data.previousHash}`);
        console.log(`Timestamp: ${new Date(response.data.timestamp).toLocaleString()}`);
        console.log(`Merkle Root: ${response.data.merkleRoot}`);
        console.log(`Transactions: ${response.data.transactions.length}`);
    }
    catch (error) {
        console.error("Failed to get block info:", error.response?.data?.error || error.message);
    }
});
// Submit transaction command
exports.blockchainCommand
    .command("submit-tx")
    .description("Submit a new transaction")
    .requiredOption("-s, --sender <address>", "Sender address")
    .requiredOption("-r, --recipient <address>", "Recipient address")
    .requiredOption("-a, --amount <amount>", "Transaction amount")
    .requiredOption("-g, --signature <signature>", "Transaction signature")
    .action(async (options) => {
    try {
        const response = await api_1.api.post("/blockchain/transactions", {
            sender: options.sender,
            recipient: options.recipient,
            amount: Number(options.amount),
            signature: options.signature,
        });
        console.log("Transaction submitted successfully");
        console.log("Transaction ID:", response.data.txId);
    }
    catch (error) {
        console.error("Failed to submit transaction:", error.response?.data?.error || error.message);
    }
});
// Get UTXOs command
exports.blockchainCommand
    .command("utxos")
    .description("Get UTXOs for an address")
    .argument("<address>", "Wallet address")
    .action(async (address) => {
    try {
        const response = await api_1.api.get(`/blockchain/transactions/${address}/utxos`);
        console.log("UTXOs:");
        console.table(response.data.map((utxo) => ({
            TxId: utxo.txId,
            Index: utxo.outputIndex,
            Amount: utxo.amount,
            Script: utxo.script,
        })));
    }
    catch (error) {
        console.error("Failed to get UTXOs:", error.response?.data?.error || error.message);
    }
});
// Get node info command
exports.blockchainCommand
    .command("node-info")
    .description("Get blockchain node information")
    .action(async () => {
    try {
        const response = await api_1.api.get("/blockchain/node");
        console.log("Node Information:");
        console.log("----------------");
        console.log(`Network Type: ${response.data.networkType}`);
        console.log(`Port: ${response.data.port}`);
        console.log(`Connected Peers: ${response.data.peersCount}`);
        console.log(`Version: ${response.data.version}`);
        console.log(`Running: ${response.data.isRunning}`);
        console.log("\nSync Status:");
        console.log(`Synced: ${response.data.syncStatus.synced}`);
        console.log(`Height: ${response.data.syncStatus.height}`);
    }
    catch (error) {
        console.error("Failed to get node info:", error.response?.data?.error || error.message);
    }
});
// Get blockchain height command
exports.blockchainCommand
    .command("height")
    .description("Get current blockchain height")
    .action(async () => {
    try {
        const response = await api_1.api.get("/blockchain/height");
        console.log("Current Height:", response.data);
    }
    catch (error) {
        console.error("Failed to get blockchain height:", error.response?.data?.error || error.message);
    }
});
// Get blockchain version command
exports.blockchainCommand
    .command("version")
    .description("Get blockchain version")
    .action(async () => {
    try {
        const response = await api_1.api.get("/blockchain/version");
        console.log("Blockchain Version:", response.data);
    }
    catch (error) {
        console.error("Failed to get blockchain version:", error.response?.data?.error || error.message);
    }
});
// Get best block hash command
exports.blockchainCommand
    .command("best-block-hash")
    .description("Get the hash of the best (latest) block")
    .action(async () => {
    try {
        const response = await api_1.api.get("/blockchain/best-block-hash");
        console.log("Best Block Hash:", response.data.hash);
    }
    catch (error) {
        console.error("Failed to get best block hash:", error.response?.data?.error || error.message);
    }
});
// Get blockchain info command
exports.blockchainCommand
    .command("info")
    .description("Get blockchain information")
    .action(async () => {
    try {
        const response = await api_1.api.get("/blockchain/info");
        console.log("Blockchain Information:");
        console.log("----------------------");
        console.log(`Chain: ${response.data.chain}`);
        console.log(`Blocks: ${response.data.blocks}`);
        console.log(`Headers: ${response.data.headers}`);
        console.log(`Best Block Hash: ${response.data.bestBlockHash}`);
        console.log(`Difficulty: ${response.data.difficulty}`);
        console.log(`Median Time: ${new Date(response.data.medianTime).toLocaleString()}`);
        console.log(`Verification Progress: ${(response.data.verificationProgress * 100).toFixed(2)}%`);
        console.log(`Chain Work: ${response.data.chainWork}`);
        console.log(`Initial Block Download: ${response.data.initialBlockDownload ? "Yes" : "No"}`);
    }
    catch (error) {
        console.error("Failed to get blockchain info:", error.response?.data?.error || error.message);
    }
});
// Get current difficulty command
exports.blockchainCommand
    .command("difficulty")
    .description("Get current mining difficulty")
    .action(async () => {
    try {
        const response = await api_1.api.get("/blockchain/difficulty");
        console.log("Current Difficulty:");
        console.log("------------------");
        console.log(`Current: ${response.data.current}`);
        console.log(`Next: ${response.data.next}`);
        console.log(`Target: ${response.data.target}`);
        console.log(`Retarget in: ${response.data.blocksUntilRetarget} blocks`);
    }
    catch (error) {
        console.error("Failed to get difficulty:", error.response?.data?.error || error.message);
        process.exit(1);
    }
});
