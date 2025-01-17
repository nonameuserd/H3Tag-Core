"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateFee = exports.TransactionBuilder = exports.TransactionStatus = exports.TransactionType = exports.TransactionError = void 0;
const shared_1 = require("@h3tag-blockchain/shared");
const merkle_1 = require("../utils/merkle");
const constants_1 = require("../blockchain/utils/constants");
const blockchain_schema_1 = require("../database/blockchain-schema");
const crypto_1 = require("@h3tag-blockchain/crypto");
const pow_1 = require("../blockchain/consensus/pow");
const hybrid_direct_1 = require("../blockchain/consensus/hybrid-direct");
const blockchain_1 = require("../blockchain/blockchain");
const async_mutex_1 = require("async-mutex");
const mempool_1 = require("../blockchain/mempool");
const crypto_2 = require("crypto");
class TransactionError extends Error {
    constructor(message) {
        super(message);
        this.name = "TransactionError";
    }
}
exports.TransactionError = TransactionError;
var TransactionType;
(function (TransactionType) {
    TransactionType["QUADRATIC_VOTE"] = "quadratic_vote";
    TransactionType["POW_REWARD"] = "pow";
    TransactionType["STANDARD"] = "standard";
    TransactionType["TRANSFER"] = "transfer";
    TransactionType["COINBASE"] = "coinbase";
    TransactionType["REGULAR"] = "regular";
})(TransactionType = exports.TransactionType || (exports.TransactionType = {}));
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["PENDING"] = "pending";
    TransactionStatus["CONFIRMED"] = "confirmed";
    TransactionStatus["FAILED"] = "failed";
})(TransactionStatus = exports.TransactionStatus || (exports.TransactionStatus = {}));
class TransactionBuilder {
    constructor() {
        this.inputs = [];
        this.outputs = [];
        this.mutex = new async_mutex_1.Mutex();
        this.signature = { address: "" };
        this.sender = "";
        this.mempool = new mempool_1.Mempool(TransactionBuilder.blockchain);
        this.type = TransactionType.STANDARD;
        this.timestamp = Date.now();
        this.merkleTree = new merkle_1.MerkleTree();
        this.db = new blockchain_schema_1.BlockchainSchema();
    }
    async addInput(txId, // Previous transaction ID
    outputIndex, // Index of output in previous transaction
    publicKey, // Sender's public key
    amount // Amount to spend
    ) {
        // Input validation
        if (!txId?.match(/^[a-f0-9]{64}$/i)) {
            throw new TransactionError("Invalid transaction ID format");
        }
        if (outputIndex < 0 || !Number.isInteger(outputIndex)) {
            throw new TransactionError("Invalid output index");
        }
        if (!publicKey ||
            amount <= 0 ||
            amount > constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.AMOUNT_LIMITS.MAX) {
            throw new TransactionError("Invalid input parameters");
        }
        if (this.inputs.length >= TransactionBuilder.MAX_INPUTS) {
            throw new TransactionError("Maximum inputs reached");
        }
        // Verify UTXO exists and is unspent
        const release = await this.mutex.acquire();
        try {
            const utxo = await this.db.getUTXO(txId, outputIndex);
            if (!utxo || utxo.spent) {
                throw new TransactionError("UTXO not found or already spent");
            }
        }
        finally {
            release();
        }
        // Check for duplicate inputs
        const isDuplicate = this.inputs.some((input) => input.txId === txId && input.outputIndex === outputIndex);
        if (isDuplicate) {
            throw new TransactionError("Duplicate input detected");
        }
        // Check total input amount
        const totalInputAmount = this.inputs.reduce((sum, input) => sum + input.amount, BigInt(0));
        if (totalInputAmount + amount >
            constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_TOTAL_INPUT) {
            throw new TransactionError("Total input amount exceeds limit");
        }
        // Check input age
        const inputTx = await this.db.getTransaction(txId);
        if (!inputTx ||
            Date.now() - inputTx.timestamp <
                constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MIN_INPUT_AGE) {
            throw new TransactionError("Input too recent");
        }
        const input = {
            txId,
            outputIndex,
            signature: "",
            publicKey,
            amount,
            currency: {
                symbol: "TAG",
                decimals: 8,
            },
            address: await crypto_1.KeyManager.deriveAddress(publicKey),
            confirmations: 0,
            script: await this.generateInputScript(publicKey),
            sequence: 0xffffffff, // Maximum sequence number by default
        };
        this.inputs.push(input);
        return this;
    }
    async generateInputScript(publicKey) {
        try {
            // Input validation
            if (!publicKey) {
                throw new TransactionError("Invalid public key");
            }
            // Get address from public key
            const address = await crypto_1.KeyManager.deriveAddress(publicKey);
            // Check address type and generate appropriate script
            if (address.startsWith("TAG1")) {
                // Native SegWit equivalent for our blockchain
                return `0 ${await crypto_1.KeyManager.getPublicKeyHash(publicKey)}`;
            }
            else if (address.startsWith("TAG3")) {
                // Script Hash equivalent for our blockchain
                return `OP_HASH160 ${address} OP_EQUAL`;
            }
            else if (address.startsWith("TAG")) {
                // Legacy address equivalent
                return `OP_DUP OP_HASH160 ${address} OP_EQUALVERIFY OP_CHECKSIG`;
            }
            throw new TransactionError("Unsupported address format");
        }
        catch (error) {
            shared_1.Logger.error("Script generation failed:", error);
            throw new TransactionError(`Failed to generate input script: ${error.message}`);
        }
    }
    async addOutput(address, // Recipient's address
    amount // Amount to send
    ) {
        // Output validation
        if (!this.isValidAddress(address)) {
            throw new TransactionError("Invalid address format");
        }
        if (amount <= 0) {
            throw new TransactionError("Invalid amount");
        }
        if (this.outputs.length >= TransactionBuilder.MAX_OUTPUTS) {
            throw new TransactionError("Maximum outputs reached");
        }
        const script = await this.generateOutputScript(address, amount);
        this.outputs.push({
            address,
            amount,
            script,
            currency: {
                symbol: "TAG",
                decimals: 8,
            },
            index: this.outputs.length,
        });
        return this;
    }
    async generateOutputScript(address, amount) {
        try {
            // Input validation
            if (!address || !amount) {
                throw new TransactionError("Invalid script parameters");
            }
            // Version control for future script upgrades
            const scriptVersion = "01";
            // Generate quantum-safe address hash
            const addressHash = await this.hashAddress(address);
            // Script constants
            const SCRIPT_CONSTANTS = {
                MAX_SCRIPT_SIZE: 10000,
            };
            // Amount validation
            if (amount < constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.AMOUNT_LIMITS.MIN ||
                amount > constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.AMOUNT_LIMITS.MAX) {
                throw new TransactionError("Invalid amount range");
            }
            // P2PKH (Pay to Public Key Hash) script
            const scriptElements = [
                "OP_DUP",
                "OP_HASH160",
                addressHash,
                "OP_EQUALVERIFY",
                "OP_CHECKSIG", // Check signature
            ];
            // Build script with version
            const script = scriptElements.join(" ");
            // Validate script size
            if (script.length > SCRIPT_CONSTANTS.MAX_SCRIPT_SIZE) {
                throw new TransactionError("Script size exceeds limit");
            }
            // Format: version:script
            const finalScript = `${scriptVersion}:${script}`;
            shared_1.Logger.debug("Generated output script", {
                version: scriptVersion,
                addressHash: addressHash.substring(0, 10) + "...",
                scriptSize: script.length,
            });
            return finalScript;
        }
        catch (error) {
            shared_1.Logger.error("Script generation failed:", {
                error,
                address: address.substring(0, 8) + "...",
                amount: amount.toString(),
            });
            throw new TransactionError(error instanceof TransactionError
                ? error.message
                : "Script generation failed");
        }
    }
    /**
     * Build the transaction
     * @returns Promise<Transaction> The built transaction
     * @throws TransactionError If the transaction cannot be built
     */
    async build() {
        const release = await this.mutex.acquire();
        try {
            // 1. Validate structure
            if (!this.inputs.length || !this.outputs.length) {
                throw new TransactionError("Transaction must have inputs and outputs");
            }
            // 2. Calculate and validate amounts
            const inputAmount = TransactionBuilder.calculateInputAmount(this.inputs.map((input) => ({
                amount: input.amount,
                address: input.address,
                txId: input.txId,
                outputIndex: input.outputIndex,
                script: input.signature,
                timestamp: this.timestamp,
                spent: false,
                currency: {
                    name: "TAG",
                    symbol: "TAG",
                    decimals: 8,
                },
                publicKey: input.publicKey,
                confirmations: input.confirmations,
            })));
            const outputAmount = TransactionBuilder.calculateOutputAmount(this.outputs);
            if (inputAmount < outputAmount) {
                throw new TransactionError("Insufficient input amount");
            }
            // 3. Calculate fee
            const fee = inputAmount - outputAmount;
            if (fee < constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MIN_FEE ||
                fee > constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_FEE) {
                throw new TransactionError("Invalid fee amount");
            }
            // 4. Generate transaction hash
            const hash = await this.calculateTransactionHash();
            const tx = {
                id: hash,
                version: constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.CURRENT_VERSION,
                type: this.type,
                hash,
                status: TransactionStatus.PENDING,
                inputs: this.inputs,
                outputs: this.outputs,
                timestamp: this.timestamp,
                fee,
                signature: { address: "" },
                sender: await this.deriveSenderAddress(this.inputs[0].publicKey),
                currency: {
                    symbol: "TAG",
                    decimals: 8,
                },
                recipient: "",
                memo: "",
                verify: async () => await this.verify(),
                toHex: () => JSON.stringify(tx),
                getSize: () => this.getSize(),
            };
            // Check transaction size
            const txSize = TransactionBuilder.calculateTransactionSize(tx);
            if (txSize > constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIZE) {
                throw new TransactionError(`Transaction size ${txSize} exceeds limit ${constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIZE}`);
            }
            // Add UTXO validation
            for (const input of this.inputs) {
                const utxo = await TransactionBuilder.blockchain.getUTXO(input.txId, input.outputIndex);
                if (!utxo || utxo.spent) {
                    throw new TransactionError(`UTXO ${input.txId}:${input.outputIndex} is already spent or doesn't exist`);
                }
                // Verify amount matches
                if (utxo.amount !== input.amount) {
                    throw new TransactionError(`Input amount mismatch for UTXO ${input.txId}:${input.outputIndex}`);
                }
            }
            return tx;
        }
        catch (error) {
            shared_1.Logger.error("Transaction build failed:", error);
            throw new TransactionError(error instanceof TransactionError ? error.message : "Build failed");
        }
        finally {
            release();
        }
    }
    async calculateTransactionHash() {
        try {
            const txData = {
                inputs: this.inputs.map((input) => ({
                    txId: input.txId,
                    outputIndex: input.outputIndex,
                    publicKey: input.publicKey,
                })),
                outputs: this.outputs,
                timestamp: this.timestamp,
            };
            const merkleRoot = await this.merkleTree.createRoot([
                JSON.stringify(txData.inputs),
                JSON.stringify(txData.outputs),
                txData.timestamp.toString(),
            ]);
            return merkleRoot;
        }
        catch (error) {
            shared_1.Logger.error("Transaction hash calculation failed:", {
                error,
                inputCount: this.inputs.length,
                outputCount: this.outputs.length,
            });
            if (error instanceof Error) {
                throw new TransactionError(`Merkle tree error: ${error.message}`);
            }
            else if (error instanceof Error) {
                throw new TransactionError(`JSON serialization error: ${error.message}`);
            }
            else {
                throw new TransactionError(`Failed to calculate transaction hash: ${error.message}`);
            }
        }
    }
    async deriveSenderAddress(publicKey) {
        try {
            if (!publicKey) {
                shared_1.Logger.warn("No public key provided for sender derivation");
                return "";
            }
            return await crypto_1.KeyManager.deriveAddress(publicKey);
        }
        catch (error) {
            shared_1.Logger.error("Failed to derive sender address", { error });
            return "";
        }
    }
    isValidAddress(address) {
        try {
            // Input sanitization
            if (!address || typeof address !== "string") {
                shared_1.Logger.error("Invalid address input type", { type: typeof address });
                return false;
            }
            // Length check before regex to prevent ReDoS attacks
            if (address.length < 31 || address.length > 46) {
                shared_1.Logger.warn("Address length out of bounds", { length: address.length });
                return false;
            }
            // Basic format validation
            const H3TAG_ADDRESS_REGEX = /^TAG[a-zA-Z0-9]{30,45}$/;
            if (!H3TAG_ADDRESS_REGEX.test(address)) {
                shared_1.Logger.warn("Address failed format validation", {
                    address: address.substring(0, 8) + "...",
                });
                return false;
            }
            // Checksum validation
            const checksumValid = this.validateAddressChecksum(address);
            if (!checksumValid) {
                shared_1.Logger.error("Address checksum validation failed", {
                    address: address.substring(0, 8) + "...",
                });
                return false;
            }
            // Network prefix validation
            const network = this.validateNetworkPrefix(address);
            if (!network) {
                shared_1.Logger.error("Invalid network prefix", {
                    prefix: address.substring(0, 3),
                });
                return false;
            }
            shared_1.Logger.debug("Address validation successful", {
                network,
                length: address.length,
                prefix: address.substring(0, 3),
            });
            return true;
        }
        catch (error) {
            shared_1.Logger.error("Address validation error", { error });
            return false;
        }
    }
    validateAddressChecksum(address) {
        try {
            const decodedArray = Uint8Array.from(crypto_1.HashUtils.fromBase58(address));
            const payload = decodedArray.slice(0, -4);
            const checksum = decodedArray.slice(-4);
            const calculatedChecksum = Buffer.from(crypto_1.HashUtils.doubleSha256(Buffer.from(payload).toString("hex")).slice(0, 4));
            return (Buffer.from(checksum).toString("hex") ===
                calculatedChecksum.toString("hex"));
        }
        catch (error) {
            shared_1.Logger.error("Checksum validation failed", { error });
            return false;
        }
    }
    validateNetworkPrefix(address) {
        const networkPrefixes = {
            TAG: "mainnet",
            THX: "testnet",
            DBX: "devnet",
        };
        const prefix = address.substring(0, 3);
        return networkPrefixes[prefix] || null;
    }
    async hashAddress(address) {
        try {
            // Use quantum-safe hash function
            const addressBuffer = Buffer.from(address);
            const hashBuffer = await crypto_1.QuantumCrypto.nativeHash(addressBuffer);
            return hashBuffer.toString("hex");
        }
        catch (error) {
            shared_1.Logger.error("Address hashing failed", { error, address });
            throw new TransactionError("Failed to hash address");
        }
    }
    /**
     * Verify transaction
     * @param tx Transaction to verify
     * @returns Promise<boolean> True if the transaction is valid, false otherwise
     * it's been used in block.validator.ts
     */
    static async verify(tx) {
        try {
            // 1. Input validation
            if (!tx?.hash || !tx?.inputs?.length || !tx?.outputs?.length) {
                shared_1.Logger.warn("Invalid transaction structure", { txId: tx?.hash });
                return false;
            }
            // 2. Verify merkle tree
            const merkleTree = new merkle_1.MerkleTree();
            const txData = [
                JSON.stringify(tx.inputs),
                JSON.stringify(tx.outputs),
                tx.timestamp.toString(),
            ];
            const isValidHash = await merkleTree.verify(tx.hash, txData);
            if (!isValidHash) {
                shared_1.Logger.warn("Invalid merkle hash", { txId: tx.hash });
                return false;
            }
            if (tx.type === TransactionType.POW_REWARD) {
                if (!(await TransactionBuilder.pow.validateReward(tx, tx.blockHeight))) {
                    shared_1.Logger.warn("Invalid PoW", { txId: tx.hash });
                    return false;
                }
            }
            if (tx.type === TransactionType.QUADRATIC_VOTE) {
                if (!(await TransactionBuilder.hybridDirect.validateParticipationReward(tx, tx.blockHeight))) {
                    shared_1.Logger.warn("Invalid participation reward", { txId: tx.hash });
                    return false;
                }
            }
            // 4. Verify each input's signatures
            for (const input of tx.inputs) {
                try {
                    const isValid = await crypto_1.HybridCrypto.verify(tx.hash, { address: input.signature }, {
                        address: TransactionBuilder.safeJsonParse(input.publicKey)
                            .address,
                    });
                    if (!isValid)
                        return false;
                }
                catch (error) {
                    shared_1.Logger.error("Signature verification failed", { error });
                    return false;
                }
            }
            // 5. Verify amounts and other business rules
            const isValidStructure = this.validateTransaction(tx, []);
            if (!isValidStructure) {
                shared_1.Logger.warn("Invalid transaction structure", { txId: tx.hash });
                return false;
            }
            // Add UTXO double-spend check
            const spentUTXOs = new Set();
            for (const input of tx.inputs) {
                const utxoKey = `${input.txId}:${input.outputIndex}`;
                // Check for duplicate inputs within the same transaction
                if (spentUTXOs.has(utxoKey)) {
                    shared_1.Logger.warn("Double-spend attempt within transaction", {
                        txId: tx.hash,
                    });
                    return false;
                }
                spentUTXOs.add(utxoKey);
                // Verify UTXO exists and is unspent
                const utxo = await TransactionBuilder.blockchain.getUTXO(input.txId, input.outputIndex);
                if (!utxo || utxo.spent) {
                    shared_1.Logger.warn("UTXO already spent or doesn't exist", { txId: tx.hash });
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            shared_1.Logger.error("Transaction verification failed", {
                error,
                txId: tx?.hash,
                inputCount: tx?.inputs?.length,
            });
            return false;
        }
    }
    static safeJsonParse(str) {
        try {
            return JSON.parse(str);
        }
        catch (error) {
            shared_1.Logger.error("JSON parse failed", { error });
            throw new TransactionError("Invalid JSON format");
        }
    }
    /**
     * Calculate total input amount with overflow protection
     * @param utxos The UTXOs to calculate the input amount from
     * @returns The total input amount
     * @throws TransactionError If the input amount calculation fails
     */
    static calculateInputAmount(utxos) {
        return utxos.reduce((sum, utxo) => {
            try {
                const amount = BigInt(utxo.amount);
                const newSum = sum + amount;
                if (newSum < sum) {
                    throw new TransactionError("Input amount overflow");
                }
                return newSum;
            }
            catch (error) {
                throw new TransactionError(`Invalid amount format: ${error.message}`);
            }
        }, BigInt(0));
    }
    /**
     * Calculate total output amount with overflow protection
     */
    static calculateOutputAmount(outputs) {
        try {
            return outputs.reduce((sum, output) => {
                if (!output?.amount) {
                    throw new TransactionError("Invalid output amount");
                }
                const newSum = sum + BigInt(output.amount);
                if (newSum < sum) {
                    throw new TransactionError("Output amount overflow");
                }
                return newSum;
            }, BigInt(0));
        }
        catch (error) {
            shared_1.Logger.error("Output amount calculation failed:", error);
            throw new TransactionError("Output calculation failed");
        }
    }
    /**
     * Validate transaction structure and amounts
     */
    static validateTransaction(tx, utxos) {
        try {
            if (!tx?.version ||
                tx.version !== constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.CURRENT_VERSION) {
                shared_1.Logger.warn("Invalid transaction version", {
                    txId: tx?.hash,
                    version: tx?.version,
                });
                return false;
            }
            // 1. Basic structure validation
            if (!tx?.hash || !tx?.inputs?.length || !tx?.outputs?.length) {
                shared_1.Logger.warn("Invalid transaction structure", { txId: tx?.hash });
                return false;
            }
            // 2. Validate input/output counts
            if (tx.inputs.length > constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_INPUTS ||
                tx.outputs.length > constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_OUTPUTS) {
                shared_1.Logger.warn("Too many inputs/outputs", {
                    txId: tx.hash,
                    inputs: tx.inputs.length,
                    outputs: tx.outputs.length,
                });
                return false;
            }
            // 3. Calculate amounts with overflow protection
            const inputAmount = this.calculateInputAmount(utxos);
            const outputAmount = this.calculateOutputAmount(tx.outputs);
            // 4. Validate amounts
            if (inputAmount < outputAmount) {
                shared_1.Logger.warn("Insufficient inputs", {
                    txId: tx.hash,
                    inputAmount: inputAmount.toString(),
                    outputAmount: outputAmount.toString(),
                });
                return false;
            }
            // 5. Validate fee
            const fee = inputAmount - outputAmount;
            if (fee < constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MIN_FEE ||
                fee > constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_FEE) {
                shared_1.Logger.warn("Invalid fee", {
                    txId: tx.hash,
                    fee: fee.toString(),
                });
                return false;
            }
            // Add UTXO amount validation
            for (let i = 0; i < tx.inputs.length; i++) {
                const input = tx.inputs[i];
                const utxo = utxos[i];
                if (!utxo || input.amount !== utxo.amount) {
                    return false;
                }
            }
            const txSize = TransactionBuilder.calculateTransactionSize(tx);
            if (txSize > constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIZE) {
                shared_1.Logger.warn("Transaction too large", { size: txSize });
                return false;
            }
            return true;
        }
        catch (error) {
            shared_1.Logger.error("Transaction validation failed:", {
                error,
                txId: tx?.hash,
            });
            return false;
        }
    }
    static calculateTransactionSize(tx) {
        try {
            const txData = {
                inputs: tx.inputs,
                outputs: tx.outputs,
                metadata: {
                    version: constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.CURRENT_VERSION,
                    type: tx.type,
                    timestamp: tx.timestamp,
                },
            };
            const serialized = JSON.stringify(txData);
            return Buffer.from(serialized).length;
        }
        catch (error) {
            shared_1.Logger.error("Failed to calculate transaction size", { error });
            throw new TransactionError("Failed to serialize transaction");
        }
    }
    async verify() {
        try {
            const message = JSON.stringify({
                inputs: this.inputs,
                outputs: this.outputs,
                timestamp: this.timestamp,
                fee: this.fee,
            });
            const isValidSignature = await crypto_1.HybridCrypto.verify(message, { address: this.signature.address }, { address: this.sender });
            if (!isValidSignature)
                return false;
            // Verify amounts
            const totalInput = this.inputs.reduce((sum, input) => sum + input.amount, BigInt(0));
            const totalOutput = this.outputs.reduce((sum, output) => sum + output.amount, BigInt(0));
            return totalInput >= totalOutput + this.fee;
        }
        catch (error) {
            shared_1.Logger.error("Transaction verification failed:", error);
            return false;
        }
    }
    setSignature(signature) {
        this.signature = signature;
        return this;
    }
    setSender(sender) {
        this.sender = sender;
        return this;
    }
    setFee(fee) {
        if (fee < 0) {
            throw new TransactionError("Fee cannot be negative");
        }
        this.fee = fee;
        return this;
    }
    /**
     * Get detailed transaction information
     * @param txId Transaction ID to fetch
     * @returns Promise<Transaction | null> Transaction details or null if not found
     * @throws TransactionError If there's an error fetching the transaction
     */
    async getTransaction(txId) {
        const release = await this.mutex.acquire();
        try {
            // Input validation
            if (!txId?.match(/^[a-f0-9]{64}$/i)) {
                throw new TransactionError("Invalid transaction ID format");
            }
            // Fetch transaction from database
            const tx = await this.db.getTransaction(txId);
            if (!tx) {
                shared_1.Logger.debug("Transaction not found", { txId });
                return null;
            }
            // Fetch and attach UTXO information
            const utxos = [];
            for (const input of tx.inputs) {
                const utxo = await this.db.getUTXO(input.txId, input.outputIndex);
                if (utxo) {
                    utxos.push({
                        txId: utxo.txId,
                        outputIndex: utxo.outputIndex,
                        amount: BigInt(utxo.amount),
                        address: utxo.address,
                        script: utxo.script,
                        timestamp: utxo.timestamp,
                        spent: utxo.spent,
                        currency: {
                            name: "H3Tag",
                            symbol: "TAG",
                            decimals: 8,
                        },
                        publicKey: utxo.publicKey,
                        confirmations: utxo.confirmations,
                    });
                }
            }
            // Validate transaction
            const isValid = await TransactionBuilder.validateTransaction(tx, utxos);
            if (!isValid) {
                shared_1.Logger.warn("Retrieved invalid transaction", { txId });
                return null;
            }
            // Calculate confirmations
            const currentHeight = await TransactionBuilder.blockchain.getHeight();
            if (tx.blockHeight) {
                tx.inputs = tx.inputs.map((input) => ({
                    ...input,
                    confirmations: currentHeight - tx.blockHeight + 1,
                }));
            }
            shared_1.Logger.debug("Transaction retrieved successfully", {
                txId,
                type: tx.type,
                status: tx.status,
            });
            return tx;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get transaction:", {
                error,
                txId,
            });
            throw new TransactionError(`Failed to get transaction: ${error.message}`);
        }
        finally {
            release();
        }
    }
    /**
     * Broadcast a raw transaction to the network
     * @param rawTx Serialized transaction data
     * @returns Promise<string> Transaction ID if successful
     * @throws TransactionError if validation or broadcast fails
     */
    async sendRawTransaction(rawTx) {
        try {
            // Input validation
            if (!rawTx || typeof rawTx !== "string") {
                throw new TransactionError("Invalid raw transaction format");
            }
            // Deserialize and validate transaction
            const tx = await this.deserializeTransaction(rawTx);
            if (!(await tx.verify())) {
                throw new TransactionError("Transaction verification failed");
            }
            // Check if transaction already exists
            const existingTx = await this.db.getTransaction(tx.id);
            if (existingTx) {
                throw new TransactionError("Transaction already exists");
            }
            // Emit transaction for network broadcast
            this.emitter.emit("transaction:broadcast", tx);
            return tx.id;
        }
        catch (error) {
            shared_1.Logger.error("Failed to send raw transaction:", error);
            throw new TransactionError(error instanceof TransactionError
                ? error.message
                : "Failed to send transaction");
        }
    }
    async deserializeTransaction(rawTx) {
        try {
            const txData = JSON.parse(rawTx);
            // Validate required fields
            if (!txData.inputs || !txData.outputs || !txData.type) {
                throw new TransactionError("Missing required transaction fields");
            }
            // Build transaction object
            const tx = {
                ...txData,
                id: await this.calculateTransactionHash(),
                status: TransactionStatus.PENDING,
                timestamp: Date.now(),
                verify: async () => await TransactionBuilder.verify(tx),
            };
            return tx;
        }
        catch (error) {
            throw new TransactionError("Invalid transaction format");
        }
    }
    /**
     * Get raw transaction data
     * @param txId Transaction ID to fetch
     * @returns Promise<string> Raw transaction data in serialized format
     * @throws TransactionError If there's an error fetching or serializing the transaction
     */
    async getRawTransaction(txId) {
        const release = await this.mutex.acquire();
        try {
            // Input validation
            if (!txId?.match(/^[a-f0-9]{64}$/i)) {
                throw new TransactionError("Invalid transaction ID format");
            }
            // Fetch transaction
            const tx = await this.db.getTransaction(txId);
            if (!tx) {
                throw new TransactionError("Transaction not found");
            }
            // Prepare transaction data for serialization
            const rawTx = {
                version: tx.version,
                type: tx.type,
                inputs: tx.inputs.map((input) => ({
                    txId: input.txId,
                    outputIndex: input.outputIndex,
                    signature: input.signature,
                    publicKey: input.publicKey,
                    amount: input.amount.toString(),
                    script: input.script,
                    address: input.address,
                })),
                outputs: tx.outputs.map((output) => ({
                    address: output.address,
                    amount: output.amount.toString(),
                    script: output.script,
                    index: output.index,
                    currency: output.currency,
                })),
                timestamp: tx.timestamp,
                fee: tx.fee.toString(),
                signature: tx.signature,
                sender: tx.sender,
                recipient: tx.recipient,
                hash: tx.hash,
                currency: tx.currency,
            };
            // Add optional fields if they exist
            if (tx.memo)
                rawTx["memo"] = tx.memo;
            if (tx.lockTime)
                rawTx["lockTime"] = tx.lockTime;
            if (tx.powData)
                rawTx["powData"] = tx.powData;
            if (tx.voteData)
                rawTx["voteData"] = tx.voteData;
            if (tx.blockHeight)
                rawTx["blockHeight"] = tx.blockHeight;
            if (tx.nonce)
                rawTx["nonce"] = tx.nonce;
            // Serialize with proper formatting
            const serialized = JSON.stringify(rawTx, null, 2);
            // Validate serialized data size
            if (Buffer.from(serialized).length >
                constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_SIZE) {
                throw new TransactionError("Serialized transaction exceeds size limit");
            }
            shared_1.Logger.debug("Raw transaction retrieved successfully", {
                txId,
                size: Buffer.from(serialized).length,
            });
            return serialized;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get raw transaction:", {
                error,
                txId,
            });
            throw new TransactionError(`Failed to get raw transaction: ${error.message}`);
        }
        finally {
            release();
        }
    }
    /**
     * Decode a raw transaction hex string
     * @param rawTx Raw transaction hex string
     * @returns Promise<Transaction> Decoded transaction
     * @throws TransactionError If decoding fails
     */
    static async decodeRawTransaction(rawTx) {
        try {
            // Input validation
            if (!rawTx || typeof rawTx !== "string") {
                throw new TransactionError("Invalid raw transaction format");
            }
            // Parse the JSON string
            let txData;
            try {
                txData = JSON.parse(rawTx);
            }
            catch (error) {
                throw new TransactionError("Invalid transaction JSON format");
            }
            // Validate required fields
            const requiredFields = [
                "version",
                "type",
                "inputs",
                "outputs",
                "timestamp",
            ];
            for (const field of requiredFields) {
                if (!txData[field]) {
                    throw new TransactionError(`Missing required field: ${field}`);
                }
            }
            // Convert amounts back to BigInt
            txData.inputs = txData.inputs.map((input) => ({
                ...input,
                amount: BigInt(input.amount),
            }));
            txData.outputs = txData.outputs.map((output) => ({
                ...output,
                amount: BigInt(output.amount),
            }));
            if (txData.fee) {
                txData.fee = BigInt(txData.fee);
            }
            // Create Transaction object
            const tx = {
                ...txData,
                verify: async () => await TransactionBuilder.verify(tx),
                toHex: () => rawTx,
            };
            // Validate transaction structure
            if (!(await TransactionBuilder.verify(tx))) {
                throw new TransactionError("Invalid transaction structure");
            }
            shared_1.Logger.debug("Transaction decoded successfully", {
                txId: tx.id,
                type: tx.type,
                inputCount: tx.inputs.length,
                outputCount: tx.outputs.length,
            });
            return tx;
        }
        catch (error) {
            shared_1.Logger.error("Failed to decode transaction:", error);
            throw new TransactionError(error instanceof TransactionError
                ? error.message
                : "Failed to decode transaction");
        }
    }
    getSize() {
        const inputSize = this.inputs.reduce((sum, input) => {
            return (sum + (input.signature?.length || 0) + (input.publicKey?.length || 0));
        }, 0);
        const outputSize = this.outputs.reduce((sum, output) => {
            return sum + (output.script?.length || 0);
        }, 0);
        return inputSize + outputSize + 8; // 8 bytes for version and locktime
    }
    /**
     * Sign a message using hybrid cryptography (classical + quantum-resistant)
     * @param {string} message - Message to sign
     * @param {string} privateKey - Classical private key in hex format (64 characters)
     * @returns {Promise<string>} Combined signature hash that includes:
     *   - Classical ECC signature (secp256k1)
     *   - Dilithium quantum-resistant signature
     *   - Kyber key encapsulation
     * @throws {TransactionError} If signing fails or input validation fails
     */
    static async signMessage(message, privateKey) {
        try {
            // Input validation
            if (!message || typeof message !== "string") {
                throw new TransactionError("Invalid message format");
            }
            if (!privateKey?.match(/^[a-f0-9]{64}$/i)) {
                throw new TransactionError("Invalid private key format");
            }
            // Prepare message for signing
            const messagePrefix = constants_1.BLOCKCHAIN_CONSTANTS.MESSAGE.PREFIX;
            const messageBuffer = Buffer.from(messagePrefix + message);
            const messageHash = (0, crypto_2.createHash)("sha256").update(messageBuffer).digest();
            // Sign message hash
            const signature = await crypto_1.HybridCrypto.sign(messageHash.toString("hex"), {
                privateKey: privateKey,
                publicKey: crypto_1.HybridCrypto.TRADITIONAL_CURVE.keyFromPrivate(privateKey).getPublic("hex"),
                address: crypto_1.HashUtils.sha256(crypto_1.HybridCrypto.TRADITIONAL_CURVE.keyFromPrivate(privateKey).getPublic("hex")),
            });
            // Encode signature
            const encodedSignature = signature.address;
            shared_1.Logger.debug("Message signed successfully", {
                messageLength: message.length,
                signatureLength: encodedSignature.length,
            });
            return encodedSignature;
        }
        catch (error) {
            shared_1.Logger.error("Message signing failed:", error);
            throw new TransactionError(error instanceof TransactionError
                ? error.message
                : "Failed to sign message");
        }
    }
    /**
     * Verify a message signature using hybrid cryptography
     * @param {string} message - Original message that was signed
     * @param {string} signature - Hybrid signature hash to verify
     * @param {string} publicKey - Public key in hex format
     * @returns {Promise<boolean>} True if signature is valid
     * @throws {TransactionError} If verification fails due to invalid input
     */
    static async verifyMessage(message, signature, publicKey) {
        try {
            // Input validation
            if (!message || typeof message !== "string") {
                throw new TransactionError("Invalid message format");
            }
            if (!signature?.match(/^[a-f0-9]{128}$/i)) {
                throw new TransactionError("Invalid signature format");
            }
            if (!publicKey?.match(/^[a-f0-9]{130}$/i)) {
                throw new TransactionError("Invalid public key format");
            }
            // Prepare message for verification
            const messagePrefix = constants_1.BLOCKCHAIN_CONSTANTS.MESSAGE.PREFIX;
            const messageBuffer = Buffer.from(messagePrefix + message);
            const messageHash = (0, crypto_2.createHash)("sha256").update(messageBuffer).digest();
            // Verify using HybridCrypto
            const isValid = await crypto_1.HybridCrypto.verify(messageHash.toString("hex"), { address: signature }, { address: crypto_1.HashUtils.sha256(publicKey) });
            shared_1.Logger.debug("Message verification completed", {
                messageLength: message.length,
                signatureLength: signature.length,
                isValid,
            });
            return isValid;
        }
        catch (error) {
            shared_1.Logger.error("Message verification failed:", error);
            throw new TransactionError(error instanceof TransactionError
                ? error.message
                : "Failed to verify message");
        }
    }
    /**
     * Validates a blockchain address format and checksum
     * @param {string} address - The address to validate
     * @returns {boolean} True if the address is valid
     */
    static validateAddress(address) {
        try {
            // 1. Basic input validation
            if (!address || typeof address !== "string") {
                shared_1.Logger.warn("Invalid address input type", { type: typeof address });
                return false;
            }
            // 2. Length validation (25-34 chars is standard for base58 addresses)
            if (address.length < 25 || address.length > 34) {
                shared_1.Logger.warn("Address length out of bounds", { length: address.length });
                return false;
            }
            // 3. Prefix validation with network type check
            const networkType = this.getNetworkType();
            const validPrefix = networkType === "mainnet"
                ? "TAG"
                : networkType === "testnet"
                    ? "THX"
                    : "DBX";
            if (!address.startsWith(validPrefix)) {
                shared_1.Logger.warn("Invalid address prefix", {
                    prefix: address.substring(0, 3),
                    expected: validPrefix,
                });
                return false;
            }
            // 4. Character set validation (base58 alphabet) - after prefix
            const base58Part = address.slice(3);
            const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
            if (!base58Regex.test(base58Part)) {
                shared_1.Logger.warn("Invalid base58 characters in address");
                return false;
            }
            // 5. Version and checksum validation
            const decoded = crypto_1.HashUtils.fromBase58(base58Part);
            if (decoded.length !== 25) {
                // 1 version + 1 quantum + 20 hash + 4 checksum
                shared_1.Logger.warn("Invalid decoded length", { length: decoded.length });
                return false;
            }
            const [version, quantumVersion] = decoded;
            if (version !== 0x00 ||
                (quantumVersion !== 0x00 && quantumVersion !== 0x01)) {
                shared_1.Logger.warn("Invalid version bytes", { version, quantumVersion });
                return false;
            }
            // 6. Checksum validation
            const decodedArray = Uint8Array.from(decoded);
            const payload = decodedArray.slice(0, -4);
            const checksum = decodedArray.slice(-4);
            const calculatedChecksum = Buffer.from(crypto_1.HashUtils.doubleSha256(Buffer.from(payload).toString("hex")).slice(0, 4));
            return (Buffer.from(checksum).toString("hex") ===
                calculatedChecksum.toString("hex"));
        }
        catch (error) {
            shared_1.Logger.error("Address validation error", { error, address });
            return false;
        }
    }
    static getNetworkType() {
        return (constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.type?.toString() || "MAINNET").toLowerCase();
    }
}
exports.TransactionBuilder = TransactionBuilder;
TransactionBuilder.MAX_INPUTS = 1500; // Bitcoin-like limit
TransactionBuilder.MAX_OUTPUTS = 1500;
TransactionBuilder.blockchain = new blockchain_1.Blockchain();
TransactionBuilder.pow = new pow_1.ProofOfWork(TransactionBuilder.blockchain);
TransactionBuilder.hybridDirect = new hybrid_direct_1.HybridDirectConsensus(TransactionBuilder.blockchain);
/**
 * Estimates the fee for a transaction based on its size and current network conditions
 * @param {number} targetBlocks - Number of blocks within which the transaction should be included
 * @returns {Promise<bigint>} Estimated fee in smallest currency unit
 */
async function estimateFee(targetBlocks = 6) {
    try {
        // Input validation
        if (targetBlocks < 1 || targetBlocks > 1008) {
            // 1008 blocks = 1 week
            throw new TransactionError("Invalid target block range (1-1008)");
        }
        // Base fee calculation constants
        const BASE_FEE = constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.BASE_FEE;
        const MIN_FEE = constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MIN_FEE;
        const MAX_FEE = constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_FEE;
        // Congestion-based multiplier
        const congestionMultiplier = Math.max(1, (20 - targetBlocks) / 10);
        // Dynamic fee calculation based on target confirmation blocks
        let estimatedFee = BigInt(Math.floor(Number(BASE_FEE) *
            congestionMultiplier *
            (1 + (Math.log(targetBlocks) / Math.log(2)) * 0.1)));
        // Apply network conditions adjustment
        const networkMultiplier = await getNetworkConditionsMultiplier();
        estimatedFee =
            (estimatedFee * BigInt(Math.ceil(networkMultiplier * 100))) / BigInt(100);
        // Ensure fee is within acceptable range
        estimatedFee = estimatedFee < MIN_FEE ? MIN_FEE : estimatedFee;
        estimatedFee = estimatedFee > MAX_FEE ? MAX_FEE : estimatedFee;
        shared_1.Logger.debug("Fee estimation", {
            targetBlocks,
            estimatedFee: estimatedFee.toString(),
            congestionMultiplier,
            networkMultiplier,
        });
        return estimatedFee;
    }
    catch (error) {
        shared_1.Logger.error("Fee estimation failed:", error);
        throw new TransactionError("Failed to estimate fee");
    }
}
exports.estimateFee = estimateFee;
/**
 * Get network conditions multiplier for fee adjustment
 * @returns {Promise<number>} Network conditions multiplier
 */
async function getNetworkConditionsMultiplier() {
    try {
        const mempoolInfo = await this.mempool.getMempoolInfo();
        const loadFactor = mempoolInfo.loadFactor;
        // Progressive scaling based on mempool load
        if (loadFactor <= 0.5)
            return 1.0;
        if (loadFactor <= 0.75)
            return 1.0 + (loadFactor - 0.5) * 2;
        if (loadFactor <= 0.9)
            return 1.5 + (loadFactor - 0.75) * 4;
        return 2.1 + (loadFactor - 0.9) * 8;
    }
    catch (error) {
        shared_1.Logger.warn("Failed to get network conditions:", error);
        return 1.0; // Conservative fallback
    }
}
//# sourceMappingURL=transaction.model.js.map