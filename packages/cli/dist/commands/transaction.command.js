"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionCommand = void 0;
const commander_1 = require("commander");
const api_1 = require("../services/api");
exports.transactionCommand = new commander_1.Command('transaction')
    .description('Manage transaction operations');
exports.transactionCommand
    .command('get')
    .description('Get transaction details by ID')
    .argument('<txId>', 'Transaction ID to fetch')
    .option('-f, --format <type>', 'Output format (json/table)', 'table')
    .action(async (txId, options) => {
    try {
        const response = await api_1.api.get(`/api/v1/transactions/${txId}`);
        if (options.format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
        }
        else {
            console.table({
                id: response.data.id,
                type: response.data.type,
                status: response.data.status,
                fromAddress: response.data.fromAddress,
                toAddress: response.data.toAddress,
                amount: response.data.amount,
                fee: response.data.fee,
                timestamp: response.data.timestamp,
                blockHeight: response.data.blockHeight || 'Pending',
                confirmations: response.data.confirmations
            });
        }
    }
    catch (error) {
        console.error('Failed to get transaction:', error.response?.data?.error || error.message);
        process.exit(1);
    }
});
exports.transactionCommand
    .command('get-raw')
    .description('Get raw transaction data')
    .argument('<txId>', 'Transaction ID to fetch')
    .option('-f, --format <type>', 'Output format (json/hex)', 'json')
    .action(async (txId, options) => {
    try {
        const response = await api_1.api.get(`/api/v1/transactions/${txId}/raw`);
        if (options.format === 'hex') {
            console.log(response.data.hex);
        }
        else {
            console.log(JSON.stringify(response.data, null, 2));
        }
    }
    catch (error) {
        console.error('Failed to get raw transaction:', error.response?.data?.error || error.message);
        process.exit(1);
    }
});
exports.transactionCommand
    .command('send-raw')
    .description('Send raw transaction')
    .argument('<rawTx>', 'Raw transaction hex string')
    .action(async (rawTx) => {
    try {
        const response = await api_1.api.post('/api/v1/transactions/raw', {
            rawTransaction: rawTx
        });
        console.log('Transaction sent successfully!');
        console.log('Transaction ID:', response.data.txId);
    }
    catch (error) {
        console.error('Failed to send transaction:', error.response?.data?.error || error.message);
        process.exit(1);
    }
});
exports.transactionCommand
    .command('decode')
    .description('Decode raw transaction')
    .argument('<rawTx>', 'Raw transaction hex string')
    .option('-f, --format <type>', 'Output format (json/table)', 'table')
    .action(async (rawTx, options) => {
    try {
        const response = await api_1.api.post('/api/v1/transactions/decode', {
            rawTransaction: rawTx
        });
        if (options.format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
        }
        else {
            console.table({
                txid: response.data.txid,
                version: response.data.version,
                inputCount: response.data.vin.length,
                outputCount: response.data.vout.length,
                hash: response.data.hash
            });
            console.log('\nInputs:');
            console.table(response.data.vin);
            console.log('\nOutputs:');
            console.table(response.data.vout);
        }
    }
    catch (error) {
        console.error('Failed to decode transaction:', error.response?.data?.error || error.message);
        process.exit(1);
    }
});
exports.transactionCommand
    .command('estimate-fee')
    .description('Estimate transaction fee')
    .option('-b, --blocks <number>', 'Target number of blocks for confirmation', '6')
    .action(async (options) => {
    try {
        const response = await api_1.api.post('/api/v1/transactions/estimate-fee', {
            targetBlocks: parseInt(options.blocks)
        });
        console.log('\nFee Estimation:');
        console.log('---------------');
        console.log(`Estimated Fee: ${response.data.estimatedFee} satoshis`);
        console.log(`Target Blocks: ${response.data.targetBlocks}`);
        // helpful context
        if (response.data.targetBlocks <= 2) {
            console.log('\nNote: This is a high-priority fee estimation (fast confirmation)');
        }
        else if (response.data.targetBlocks <= 6) {
            console.log('\nNote: This is a standard fee estimation (normal confirmation)');
        }
        else {
            console.log('\nNote: This is a low-priority fee estimation (slower confirmation)');
        }
    }
    catch (error) {
        console.error('Failed to estimate fee:', error.response?.data?.error || error.message);
        process.exit(1);
    }
});
exports.transactionCommand
    .command('sign-message')
    .description('Sign a message using hybrid cryptography')
    .requiredOption('-m, --message <string>', 'Message to sign')
    .requiredOption('-k, --private-key <string>', 'Private key in hex format (64 characters)')
    .action(async (options) => {
    try {
        const response = await api_1.api.post('/api/v1/transactions/sign-message', {
            message: options.message,
            privateKey: options.privateKey
        });
        console.log('\nMessage Signature:');
        console.log('----------------');
        console.log(`Message: ${options.message}`);
        console.log(`Signature: ${response.data.signature}`);
    }
    catch (error) {
        console.error('Failed to sign message:', error.response?.data?.error || error.message);
        process.exit(1);
    }
});
exports.transactionCommand
    .command('verify-message')
    .description('Verify a signed message')
    .requiredOption('-m, --message <string>', 'Original message that was signed')
    .requiredOption('-s, --signature <string>', 'Signature to verify (128 hex characters)')
    .requiredOption('-p, --public-key <string>', 'Public key in hex format (130 characters)')
    .action(async (options) => {
    try {
        const response = await api_1.api.post('/api/v1/transactions/verify-message', {
            message: options.message,
            signature: options.signature,
            publicKey: options.publicKey
        });
        console.log('\nMessage Verification:');
        console.log('-------------------');
        console.log(`Message: ${options.message}`);
        console.log(`Signature: ${options.signature}`);
        console.log(`Public Key: ${options.publicKey}`);
        console.log(`\nVerification Result: ${response.data.isValid ? 'Valid ✓' : 'Invalid ✗'}`);
    }
    catch (error) {
        console.error('Failed to verify message:', error.response?.data?.error || error.message);
        process.exit(1);
    }
});
exports.transactionCommand
    .command('validate-address')
    .description('Validate a blockchain address')
    .requiredOption('-a, --address <string>', 'Blockchain address to validate')
    .action(async (options) => {
    try {
        const response = await api_1.api.post('/api/v1/transactions/validate-address', {
            address: options.address
        });
        console.log('\nAddress Validation:');
        console.log('------------------');
        console.log(`Address: ${options.address}`);
        console.log(`Valid: ${response.data.isValid ? 'Yes ✓' : 'No ✗'}`);
        if (response.data.isValid && response.data.network) {
            console.log(`Network: ${response.data.network}`);
        }
    }
    catch (error) {
        console.error('Failed to validate address:', error.response?.data?.error || error.message);
        process.exit(1);
    }
});
//# sourceMappingURL=transaction.command.js.map