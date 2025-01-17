"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletCommand = void 0;
const commander_1 = require("commander");
const api_1 = require("../services/api");
exports.walletCommand = new commander_1.Command("wallet").description("Manage blockchain wallets");
// Create wallet command
exports.walletCommand
    .command("create")
    .description("Create a new wallet")
    .option("-p, --password <password>", "Password to encrypt the wallet")
    .option("-m, --mnemonic <mnemonic>", "Optional mnemonic phrase for wallet recovery")
    .action(async (options) => {
    try {
        const response = await api_1.api.post("/wallets", {
            password: options.password,
            mnemonic: options.mnemonic,
        });
        console.log("Wallet created successfully:", response.data);
        if (response.data.mnemonic) {
            console.log("\nIMPORTANT: Save your mnemonic phrase securely:");
            console.log(response.data.mnemonic);
        }
    }
    catch (error) {
        console.error("Failed to create wallet:", error.response?.data?.error || error.message);
    }
});
// Get wallet info command
exports.walletCommand
    .command("info")
    .description("Get wallet information")
    .argument("<address>", "Wallet address")
    .action(async (address) => {
    try {
        const response = await api_1.api.get(`/wallets/${address}`);
        console.log("Wallet information:", response.data);
    }
    catch (error) {
        console.error("Failed to get wallet info:", error.response?.data?.error || error.message);
    }
});
// Sign transaction command
exports.walletCommand
    .command("sign")
    .description("Sign a transaction")
    .argument("<address>", "Wallet address")
    .requiredOption("-f, --from <address>", "Sender address")
    .requiredOption("-t, --to <address>", "Recipient address")
    .requiredOption("-a, --amount <amount>", "Amount to send")
    .requiredOption("-k, --public-key <key>", "Sender public key")
    .requiredOption("-p, --password <password>", "Wallet password")
    .option("--fee <fee>", "Transaction fee")
    .action(async (address, options) => {
    try {
        const response = await api_1.api.post(`/wallets/${address}/sign`, {
            transaction: {
                fromAddress: options.from,
                toAddress: options.to,
                amount: Number(options.amount),
                publicKey: options.publicKey,
                fee: options.fee ? Number(options.fee) : undefined,
            },
            password: options.password,
        });
        console.log("Transaction signed successfully");
        console.log("Signature:", response.data.signature);
    }
    catch (error) {
        console.error("Failed to sign transaction:", error.response?.data?.error || error.message);
    }
});
// Send tokens command
exports.walletCommand
    .command("send")
    .description("Send tokens to another address")
    .argument("<fromAddress>", "Sender wallet address")
    .requiredOption("-t, --to <address>", "Recipient address")
    .requiredOption("-a, --amount <amount>", "Amount to send")
    .requiredOption("-p, --password <password>", "Wallet password")
    .action(async (fromAddress, options) => {
    try {
        const response = await api_1.api.post(`/wallets/${fromAddress}/send`, {
            toAddress: options.to,
            amount: options.amount,
            password: options.password,
        });
        console.log("Transaction sent successfully");
        console.log("Transaction ID:", response.data.txId);
    }
    catch (error) {
        console.error("Failed to send transaction:", error.response?.data?.error || error.message);
    }
});
// Get wallet balance command
exports.walletCommand
    .command("balance")
    .description("Get wallet balance")
    .argument("<address>", "Wallet address")
    .action(async (address) => {
    try {
        const response = await api_1.api.get(`/wallets/${address}/balance`);
        console.log("Wallet balance:");
        console.log("Confirmed:", response.data.confirmed);
        console.log("Unconfirmed:", response.data.unconfirmed);
    }
    catch (error) {
        console.error("Failed to get balance:", error.response?.data?.error || error.message);
    }
});
// Generate new address command
exports.walletCommand
    .command("new-address")
    .description("Generate new address for wallet")
    .argument("<address>", "Master wallet address")
    .action(async (address) => {
    try {
        const response = await api_1.api.post(`/wallets/${address}/addresses`);
        console.log("New address generated:", response.data.address);
    }
    catch (error) {
        console.error("Failed to generate address:", error.response?.data?.error || error.message);
    }
});
// Export private key command
exports.walletCommand
    .command("export")
    .description("Export wallet private key")
    .argument("<address>", "Wallet address")
    .requiredOption("-p, --password <password>", "Wallet password")
    .action(async (address, options) => {
    try {
        const response = await api_1.api.post(`/wallets/${address}/export`, {
            password: options.password,
        });
        console.log("Private key exported successfully");
        console.log("Encrypted private key:", response.data.privateKey);
    }
    catch (error) {
        console.error("Failed to export private key:", error.response?.data?.error || error.message);
    }
});
// Import private key command
exports.walletCommand
    .command("import")
    .description("Import wallet from private key")
    .requiredOption("-k, --key <encryptedKey>", "Encrypted private key")
    .requiredOption("-a, --address <address>", "Original wallet address")
    .requiredOption("-p, --password <password>", "Password for the new wallet")
    .action(async (options) => {
    try {
        const response = await api_1.api.post("/wallets/import", {
            encryptedKey: options.key,
            originalAddress: options.address,
            password: options.password,
        });
        console.log("Wallet imported successfully");
        console.log("New wallet address:", response.data.address);
    }
    catch (error) {
        console.error("Failed to import wallet:", error.response?.data?.error || error.message);
    }
});
// Add this command with the existing wallet commands
exports.walletCommand
    .command("unspent")
    .description("List unspent transaction outputs (UTXOs)")
    .argument("<address>", "Wallet address")
    .option("-m, --min-conf <number>", "Minimum confirmations")
    .option("-M, --max-conf <number>", "Maximum confirmations")
    .option("--min-amount <amount>", "Minimum amount")
    .option("--max-amount <amount>", "Maximum amount")
    .action(async (address, options) => {
    try {
        const response = await api_1.api.get(`/wallets/${address}/unspent`, {
            params: {
                minConfirmations: options.minConf,
                maxConfirmations: options.maxConf,
                minAmount: options.minAmount,
                maxAmount: options.maxAmount,
            },
        });
        console.table(response.data.map((utxo) => ({
            "Transaction ID": utxo.txid,
            "Output Index": utxo.vout,
            Amount: utxo.amount,
            Confirmations: utxo.confirmations,
            Spendable: utxo.spendable ? "Yes" : "No",
        })));
    }
    catch (error) {
        console.error("Failed to list UTXOs:", error.response?.data?.error || error.message);
    }
});
// Add this command with the existing wallet commands
exports.walletCommand
    .command("txout")
    .description("Get transaction output details")
    .argument("<txid>", "Transaction ID")
    .argument("<n>", "Output index")
    .action(async (txid, n) => {
    try {
        const response = await api_1.api.get(`/wallets/txout/${txid}/${n}`);
        console.log("Transaction Output Details:");
        console.table({
            "Transaction ID": response.data.txid,
            "Output Index": response.data.n,
            Value: response.data.value,
            Confirmations: response.data.confirmations,
            "Script Type": response.data.scriptType,
            Address: response.data.address,
            Spendable: response.data.spendable ? "Yes" : "No",
        });
    }
    catch (error) {
        console.error("Failed to get transaction output:", error.response?.data?.error || error.message);
    }
});
//# sourceMappingURL=wallet.commands.js.map