"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Peer = exports.PeerState = void 0;
const events_1 = require("events");
const ws_1 = __importDefault(require("ws"));
const shared_1 = require("@h3tag-blockchain/shared");
const circuit_breaker_1 = require("./circuit-breaker");
const metrics_collector_1 = require("../monitoring/metrics-collector");
const crypto_1 = require("@h3tag-blockchain/crypto");
const async_mutex_1 = require("async-mutex");
const crypto_2 = require("crypto");
const peer_model_1 = require("../models/peer.model");
const constants_1 = require("../blockchain/utils/constants");
var PeerState;
(function (PeerState) {
    PeerState["DISCONNECTED"] = "disconnected";
    PeerState["CONNECTING"] = "connecting";
    PeerState["CONNECTED"] = "connected";
    PeerState["READY"] = "ready";
    PeerState["SYNCING"] = "syncing";
    PeerState["BANNED"] = "banned";
})(PeerState || (exports.PeerState = PeerState = {}));
class Peer {
    constructor(address, port, config, configService, database, isInbound = false) {
        this.address = address;
        this.port = port;
        this.configService = configService;
        this.ws = null;
        this.state = PeerState.DISCONNECTED;
        this.mutex = new async_mutex_1.Mutex();
        this.messageQueue = [];
        this.pendingRequests = new Map();
        this.lastPing = 0;
        this.bytesReceived = 0;
        this.bytesSent = 0;
        this.messagesSent = 0;
        this.messagesReceived = 0;
        this.lastMessageTime = 0;
        this.eventEmitter = new events_1.EventEmitter();
        this.peerId = crypto.randomUUID();
        this.latencyWindow = [];
        this.lastVoteTime = null;
        this.peerState = { banScore: 0 };
        this.inbound = false;
        this.syncedHeaders = 0;
        this.syncedBlocks = 0;
        this.isWhitelisted = false;
        this.isBlacklisted = false;
        this.blocksInFlight = new Map();
        this.peers = new Set();
        this.height = 0;
        this.messageTimestamps = [];
        this.lastBytesReceived = 0;
        this.id = crypto.randomUUID();
        this.config = {
            version: 70015,
            services: [peer_model_1.PeerServices.NODE],
            minPingInterval: 120000, // 2 minutes
            connectionTimeout: 10000,
            handshakeTimeout: 30000,
            messageTimeout: 30000,
            maxReconnectAttempts: 3,
            reconnectDelay: 5000,
            keepAlive: true,
            maxBufferSize: 10000000, // 10MB
            rateLimits: {
                messages: 100,
                bytes: 5000000, // 5MB
                interval: 60000, // 1 minute
            },
            maxBanScore: 100, // Default max ban score
            ...config,
        };
        this.metrics = new metrics_collector_1.MetricsCollector(`peer_${this.address}`);
        this.circuitBreaker = new circuit_breaker_1.CircuitBreaker({
            failureThreshold: 3,
            resetTimeout: 60000,
        });
        this.database = database;
        this.inbound = isInbound;
        // Check configured lists
        const whitelistedPeers = this.configService.get("WHITELISTED_PEERS")?.split(",") || [];
        const blacklistedPeers = this.configService.get("BLACKLISTED_PEERS")?.split(",") || [];
        this.isWhitelisted = whitelistedPeers.includes(`${this.address}:${this.port}`);
        this.isBlacklisted = blacklistedPeers.includes(`${this.address}:${this.port}`);
        if (this.isBlacklisted) {
            shared_1.Logger.warn(`Peer ${this.address}:${this.port} is blacklisted`);
        }
        if (this.isWhitelisted) {
            shared_1.Logger.info(`Peer ${this.address}:${this.port} is whitelisted`);
        }
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.eventEmitter.on("message", this.handleMessage.bind(this));
        this.eventEmitter.on("error", this.handleError.bind(this));
        this.eventEmitter.on("close", this.handleClose.bind(this));
    }
    async connect() {
        if (this.state !== PeerState.DISCONNECTED) {
            throw new Error("Peer is not in disconnected state");
        }
        const release = await this.mutex.acquire();
        try {
            this.state = PeerState.CONNECTING;
            this.ws = new ws_1.default(`wss://${this.address}:${this.port}`, {
                handshakeTimeout: this.config.handshakeTimeout,
                maxPayload: this.config.maxBufferSize,
                perMessageDeflate: true,
            });
            await this.setupWebSocket();
            await this.performHandshake();
            this.startPingInterval();
            this.state = PeerState.READY;
            this.eventEmitter.emit("ready");
        }
        catch (error) {
            this.handleConnectionError(error);
            throw error;
        }
        finally {
            release();
        }
    }
    async setupWebSocket() {
        if (!this.ws)
            throw new Error("WebSocket not initialized");
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Connection timeout"));
            }, this.config.connectionTimeout);
            this.ws.on("open", () => {
                clearTimeout(timeout);
                this.state = PeerState.CONNECTED;
                this.eventEmitter.emit("connect");
                resolve();
            })
                .on("message", (data) => this.handleIncomingMessage(data))
                .on("error", (error) => this.handleError(error))
                .on("close", (code, reason) => this.handleClose(code, reason))
                .on("ping", () => this.ws?.pong())
                .on("pong", () => this.handlePong());
        });
    }
    async performHandshake() {
        this.handshakeTimer = setTimeout(() => {
            this.disconnect(1002, "Handshake timeout");
        }, this.config.handshakeTimeout);
        await this.sendVersion();
        await this.waitForVerack();
    }
    async handleIncomingMessage(data) {
        try {
            this.updateMessageMetrics(data);
            if (!this.checkRateLimits()) {
                this.eventEmitter.emit("error", new Error("Rate limit exceeded"));
                return;
            }
            const message = this.parseMessage(data);
            if (!message)
                return;
            this.lastMessageTime = Date.now();
            this.messagesReceived++;
            this.eventEmitter.emit("message", message);
            await this.processMessage(message);
        }
        catch (error) {
            shared_1.Logger.error("Error handling incoming message:", error);
            this.eventEmitter.emit("error", error);
        }
    }
    async processMessage(message) {
        switch (message.type) {
            case peer_model_1.PeerMessageType.VERSION:
                await this.handleVersion({
                    version: message.payload.version,
                    timestamp: message.payload.timestamp,
                });
                break;
            case peer_model_1.PeerMessageType.VERACK:
                this.handleVerack();
                break;
            case peer_model_1.PeerMessageType.PING:
                await this.handlePing(message.payload);
                break;
            case peer_model_1.PeerMessageType.INV:
                await this.handleInventory(message.payload.inventory);
                break;
            case peer_model_1.PeerMessageType.TX:
                await this.handleTransactionMessage(message.payload.transaction);
                break;
            case peer_model_1.PeerMessageType.BLOCK:
                await this.handleBlockMessage(message.payload.block);
                break;
            case peer_model_1.PeerMessageType.GET_VOTES:
                await this.handleGetVotes();
                break;
            case peer_model_1.PeerMessageType.GET_HEADERS:
                await this.handleGetHeaders({
                    locator: message.payload.headers[0].locator,
                    hashStop: message.payload.headers[0].hashStop,
                });
                break;
            case peer_model_1.PeerMessageType.GET_BLOCKS:
                await this.handleGetBlocks({
                    locator: message.payload.blocks[0].header.locator,
                    hash: message.payload.blocks[0].header.hashStop,
                });
                break;
            case peer_model_1.PeerMessageType.GET_NODE_INFO:
                await this.handleGetNodeInfo();
                break;
            default:
                this.eventEmitter.emit("unknown_message", message);
        }
    }
    async send(type, payload) {
        if (!this.isConnected()) {
            throw new Error("Peer not connected");
        }
        const message = {
            type,
            payload: payload,
            version: this.version?.toString(),
            checksum: await this.calculateChecksum(payload),
        };
        return new Promise((resolve, reject) => {
            this.ws.send(JSON.stringify(message), (error) => {
                if (error) {
                    this.handleError(error);
                    reject(error);
                }
                else {
                    this.updateSendMetrics(message);
                    resolve();
                }
            });
        });
    }
    async request(type, payload, timeout = this.config.messageTimeout) {
        const requestId = (0, crypto_2.randomBytes)(32).toString("hex");
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request timeout: ${type}`));
            }, timeout);
            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout: timeoutId,
            });
            this.send(type, { ...payload, requestId }).catch(reject);
        });
    }
    disconnect(code = 1000, reason = "Normal closure") {
        if (this.ws && this.isConnected()) {
            this.ws.close(code, reason);
        }
        this.cleanup();
    }
    cleanup() {
        this.state = PeerState.DISCONNECTED;
        if (this.pingInterval)
            clearInterval(this.pingInterval);
        if (this.handshakeTimer)
            clearTimeout(this.handshakeTimer);
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        this.pendingRequests.forEach(({ timeout }) => clearTimeout(timeout));
        this.pendingRequests.clear();
        this.messageQueue.length = 0;
        this.ws = null;
    }
    // Utility methods
    isConnected() {
        return this.ws?.readyState === ws_1.default.OPEN;
    }
    async calculateChecksum(payload) {
        const data = typeof payload === "string" ? payload : JSON.stringify(payload);
        return await crypto_1.HybridCrypto.hash(data);
    }
    checkRateLimits() {
        const now = Date.now();
        const window = now - this.config.rateLimits.interval;
        try {
            // Clean up old metrics outside the window
            while (this.messageTimestamps.length > 0 &&
                this.messageTimestamps[0] < window) {
                this.messageTimestamps.shift();
            }
            // Check message count limit
            if (this.messageTimestamps.length >= this.config.rateLimits.messages) {
                shared_1.Logger.warn(`Peer ${this.address} exceeded message rate limit`);
                this.adjustPeerScore(1);
                return false;
            }
            // Check bandwidth limit
            const recentBytes = this.bytesReceived - this.lastBytesReceived;
            if (recentBytes > this.config.rateLimits.bytes) {
                shared_1.Logger.warn(`Peer ${this.address} exceeded bandwidth limit`);
                this.adjustPeerScore(1);
                return false;
            }
            // Update metrics
            this.messageTimestamps.push(now);
            this.lastBytesReceived = this.bytesReceived;
            return true;
        }
        catch (error) {
            shared_1.Logger.error("Rate limit check failed:", error);
            return false;
        }
    }
    updateMessageMetrics(data) {
        this.bytesReceived += data.toString().length;
        this.metrics.increment("bytes_received", data.toString().length);
        this.metrics.increment("messages_received");
    }
    updateSendMetrics(message) {
        const size = JSON.stringify(message).length;
        this.bytesSent += size;
        this.messagesSent++;
        this.metrics.increment("bytes_sent", size);
        this.metrics.increment("messages_sent");
    }
    // Getters
    getState() {
        return this.state;
    }
    getAddress() {
        return this.address;
    }
    getVersion() {
        return this.version;
    }
    getLastSeen() {
        return this.lastMessageTime;
    }
    getMetrics() {
        return {
            bytesReceived: this.bytesReceived,
            bytesSent: this.bytesSent,
            messagesReceived: this.messagesReceived,
            messagesSent: this.messagesSent,
            lastSeen: this.lastMessageTime,
            state: this.state,
            version: this.version,
            services: this.services,
        };
    }
    async getNodeInfo() {
        const response = await this.request(peer_model_1.PeerMessageType.GET_NODE_INFO, {});
        return {
            ...response,
            publicKey: response.publicKey || "",
            signature: response.signature || "",
            tagInfo: {
                ...response.tagInfo,
                lastVoteHeight: response.tagInfo.lastVoteHeight || 0,
                minedBlocks: await this.getMinedBlocks(),
                voteParticipation: await this.getVoteParticipation(),
                votingPower: await this.getVotingPower(),
            },
            isMiner: response.isMiner || false,
        };
    }
    async getInfo() {
        return {
            id: this.peerId,
            url: `${this.address}:${this.port}`,
            timestamp: Date.now(),
            version: this.version?.toString() || "1",
            height: this.startHeight || 0,
            lastSeen: this.lastMessageTime,
            latency: this.getLatency(),
            capabilities: ["sync", "transactions"],
            connectedAt: this.lastMessageTime,
            consensusRole: "participant",
            consensusStats: {
                powContributions: await this.getMinedBlocks(),
                votingParticipation: await this.getVoteParticipation(),
                lastVoteHeight: this.lastVoteTime ? await this.getBlockHeight() : 0,
                reputation: this.peerState?.banScore
                    ? 100 - this.peerState.banScore
                    : 100,
            },
            peers: this.peers.size,
            currency: {
                name: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
                symbol: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
                decimals: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
                currentSupply: 0,
                maxSupply: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.MAX_SUPPLY,
                blockReward: Number(constants_1.BLOCKCHAIN_CONSTANTS.MINING.BLOCK_REWARD),
            },
            services: Object.values(peer_model_1.PeerServices)
                .filter((service) => typeof service === "number")
                .filter((service) => {
                const currentServices = this.services || [peer_model_1.PeerServices.NODE];
                return currentServices.some((s) => s & service);
            }),
        };
    }
    getLatency() {
        try {
            // Remove old samples (older than LATENCY_WINDOW_MS)
            const now = Date.now();
            while (this.latencyWindow.length > 0 &&
                now - this.latencyWindow[0] > Peer.LATENCY_WINDOW_MS) {
                this.latencyWindow.shift();
            }
            if (this.latencyWindow.length === 0) {
                return 0;
            }
            // Calculate average latency from recent samples
            const sum = this.latencyWindow.reduce((a, b) => a + b, 0);
            return Math.round(sum / this.latencyWindow.length);
        }
        catch (error) {
            shared_1.Logger.error("Failed to calculate latency:", error);
            return 0;
        }
    }
    // Add this method to update latency samples
    updateLatency(rtt) {
        this.latencyWindow.push(rtt);
        while (this.latencyWindow.length > Peer.MAX_LATENCY_SAMPLES) {
            this.latencyWindow.shift();
        }
    }
    async getPeers() {
        const response = await this.request(peer_model_1.PeerMessageType.GETADDR, {});
        return response;
    }
    hasVoted() {
        return this.lastVoteTime !== null;
    }
    getVoteTime() {
        return this.lastVoteTime;
    }
    getId() {
        return this.id;
    }
    async handleMessage(message) {
        await this.processMessage(message);
    }
    handleError(error) {
        shared_1.Logger.error("Peer error:", error);
        this.eventEmitter.emit("error", error);
    }
    handleClose(code, reason) {
        this.cleanup();
        this.eventEmitter.emit("close", code, reason);
    }
    async handshake() {
        await this.connect();
        const nodeInfo = await this.getNodeInfo();
        return {
            version: this.version || 0,
            services: this.services || [],
            height: this.startHeight || 0,
            peers: this.peers.size || 0,
            isMiner: nodeInfo.isMiner,
            publicKey: nodeInfo.publicKey,
            signature: nodeInfo.signature,
            minedBlocks: nodeInfo.tagInfo.minedBlocks,
            voteParticipation: nodeInfo.tagInfo.voteParticipation,
            lastVoteHeight: nodeInfo.tagInfo.lastVoteHeight,
            votingPower: Number(nodeInfo.tagInfo.votingPower) || 0,
        };
    }
    startPingInterval() {
        if (this.pingInterval)
            clearInterval(this.pingInterval);
        this.pingInterval = setInterval(async () => {
            try {
                await this.send(peer_model_1.PeerMessageType.PING, { timestamp: Date.now() });
            }
            catch (error) {
                shared_1.Logger.error("Ping failed:", error);
            }
        }, this.config.minPingInterval);
    }
    handleConnectionError(error) {
        shared_1.Logger.error("Connection error:", error);
        this.state = PeerState.DISCONNECTED;
        this.eventEmitter.emit("error", error);
        this.cleanup();
    }
    handlePong() {
        const rtt = Date.now() - this.lastPing;
        this.updateLatency(rtt);
        this.lastPing = Date.now();
    }
    async sendVersion() {
        await this.send(peer_model_1.PeerMessageType.VERSION, {
            version: this.config.version,
            services: this.config.services,
            timestamp: Date.now(),
            height: this.startHeight || 0,
        });
    }
    async waitForVerack() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Verack timeout"));
            }, this.config.handshakeTimeout);
            this.eventEmitter.once(peer_model_1.PeerMessageType.VERACK, () => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }
    parseMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            if (!message.type ||
                !Object.values(peer_model_1.PeerMessageType).includes(message.type)) {
                shared_1.Logger.warn("Invalid message type received");
                return null;
            }
            return message;
        }
        catch (error) {
            shared_1.Logger.error("Failed to parse message:", error);
            return null;
        }
    }
    async handleVersion(payload) {
        this.version = payload.version;
        this.services = payload.services;
        this.startHeight = payload.startHeight;
        this.userAgent = payload.userAgent;
        await this.send(peer_model_1.PeerMessageType.VERACK, {});
    }
    handleVerack() {
        if (this.handshakeTimer) {
            clearTimeout(this.handshakeTimer);
            this.handshakeTimer = undefined;
        }
        this.eventEmitter.emit(peer_model_1.PeerMessageType.VERACK);
    }
    async handlePing(payload) {
        await this.send(peer_model_1.PeerMessageType.PONG, payload);
    }
    async handleInventory(inventory) {
        try {
            if (!Array.isArray(inventory)) {
                throw new Error("Invalid inventory format");
            }
            // Process each inventory item
            for (const item of inventory) {
                if (!item.type || !item.hash) {
                    shared_1.Logger.warn("Invalid inventory item format", item);
                    continue;
                }
                // Update metrics
                this.metrics.increment(`inventory_received_${item.type.toLowerCase()}`);
                // Handle different inventory types
                switch (item.type) {
                    case "BLOCK":
                        await this.handleBlockInventory(item.hash);
                        break;
                    case "TX":
                        await this.handleTransactionInventory(item.hash);
                        break;
                    default:
                        shared_1.Logger.debug(`Unhandled inventory type: ${item.type}`);
                }
            }
            // Emit inventory event for external handlers
            this.eventEmitter.emit("inventory", inventory);
        }
        catch (error) {
            shared_1.Logger.error("Error processing inventory:", error);
            this.adjustPeerScore(1); // Penalize peer for invalid inventory
        }
    }
    async handleBlockInventory(hash) {
        // Check if we already have this block
        const hasBlock = await this.database.hasBlock(hash);
        if (!hasBlock) {
            this.eventEmitter.emit("new_block", { hash });
        }
    }
    async handleTransactionInventory(hash) {
        // Check if we already have this transaction
        const hasTx = await this.database.hasTransaction(hash);
        if (!hasTx) {
            this.eventEmitter.emit("new_transaction", { hash });
        }
    }
    adjustPeerScore(adjustment) {
        const currentScore = this.peerState?.banScore || 0;
        this.updatePeerState({ banScore: currentScore + adjustment });
        if (currentScore + adjustment >= this.config.maxBanScore) {
            this.disconnect(1008, "Ban score exceeded");
        }
    }
    updatePeerState(update) {
        this.peerState = { ...this.peerState, ...update };
    }
    async getBlockHeight() {
        try {
            const response = await this.request(peer_model_1.PeerMessageType.GET_NODE_INFO, {
                metric: "blockHeight",
            });
            const height = response?.headers[0].height || this.startHeight || 0;
            // Update peer state in database
            await this.database.put(`peer:${this.id}:height`, height.toString());
            return height;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get block height:", error);
            // Fallback to last known height from database
            const stored = await this.database
                .get(`peer:${this.id}:height`)
                .catch(() => "0");
            return parseInt(stored) || 0;
        }
    }
    async getMinedBlocks() {
        try {
            const response = await this.request(peer_model_1.PeerMessageType.GET_NODE_INFO, {
                metric: "minedBlocks",
            });
            const minedBlocks = response?.minedBlocks || 0;
            // Update mined blocks count in database
            await this.database.put(`peer:${this.id}:minedBlocks`, minedBlocks.toString());
            return minedBlocks;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get mined blocks:", error);
            // Fallback to last known count from database
            const stored = await this.database
                .get(`peer:${this.id}:minedBlocks`)
                .catch(() => "0");
            return parseInt(stored) || 0;
        }
    }
    async getVoteParticipation() {
        const now = Date.now();
        try {
            const recentVotes = this.database.db.iterator({
                gte: `peer:${this.id}:vote:${now - 24 * 60 * 60 * 1000}`, // Last 24 hours
                lte: `peer:${this.id}:vote:${now}`,
            });
            let voteCount = 0;
            for await (const [value] of recentVotes) {
                const vote = this.votingDatabase.getSafeParse(value);
                if (vote && this.votingDatabase.getValidateVote(vote)) {
                    voteCount++;
                }
            }
            // Calculate participation rate (0-1)
            const participation = voteCount / (24 * 60); // Expected votes per minute
            return Math.min(participation, 1);
        }
        catch (error) {
            shared_1.Logger.error("Failed to get vote participation:", error);
            return this.lastVoteTime && now - this.lastVoteTime < 3600000 ? 1 : 0;
        }
    }
    // Helper method to record votes
    async recordVote() {
        const timestamp = Date.now();
        this.lastVoteTime = timestamp;
        try {
            await this.database.put(`peer:${this.id}:vote:${timestamp}`, JSON.stringify({
                timestamp,
                height: await this.getBlockHeight(),
            }));
        }
        catch (error) {
            shared_1.Logger.error("Failed to record vote:", error);
        }
    }
    async validatePeerCurrency(peerInfo) {
        try {
            if (!peerInfo.currency?.symbol ||
                peerInfo.currency.symbol !== constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL) {
                return false;
            }
            const response = await this.request(peer_model_1.PeerMessageType.GET_NODE_INFO, {
                metric: "currency",
            });
            return (response?.currency?.symbol === constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL);
        }
        catch (error) {
            shared_1.Logger.error("Currency validation failed:", error);
            return false;
        }
    }
    getAverageBandwidth() {
        const timeWindow = 60000; // 1 minute
        const totalBytes = Number(this.bytesSent) + Number(this.bytesReceived);
        return (totalBytes / timeWindow) * 1000; // Convert to bytes/second
    }
    isBanned() {
        return (this.state === PeerState.BANNED ||
            (this.peerState?.banScore || 0) >= this.config.maxBanScore);
    }
    /**
     * Send transaction to peer
     * @param tx Transaction to send
     * @returns Promise<void>
     */
    async sendTransaction(tx) {
        try {
            // Rate limiting check
            if (!this.checkRateLimits()) {
                throw new Error("Rate limit exceeded");
            }
            // Send transaction message
            await this.send(peer_model_1.PeerMessageType.TX, {
                transaction: tx,
                timestamp: Date.now(),
            });
            // Update metrics
            this.metrics.increment("transactions_sent");
            shared_1.Logger.debug("Transaction sent to peer", {
                peerId: this.getId(),
                txId: tx.id,
            });
        }
        catch (error) {
            shared_1.Logger.error("Failed to send transaction to peer:", {
                peerId: this.getId(),
                error: error.message,
            });
            // Increase ban score for failed transactions
            this.adjustPeerScore(1);
            throw error;
        }
    }
    /**
     * Handle incoming transaction message
     * @param payload Transaction message payload
     */
    async handleTransactionMessage(payload) {
        try {
            const { transaction, timestamp } = payload;
            // Basic validation
            if (!transaction || !timestamp) {
                throw new Error("Invalid transaction message format");
            }
            // Check message age
            const messageAge = Date.now() - timestamp;
            if (messageAge > constants_1.BLOCKCHAIN_CONSTANTS.TRANSACTION.MAX_MESSAGE_AGE) {
                throw new Error("Transaction message too old");
            }
            // Emit transaction received event
            this.eventEmitter.emit("transaction", transaction);
            // Update metrics
            this.metrics.increment("transactions_received");
        }
        catch (error) {
            shared_1.Logger.error("Transaction message handling failed:", {
                peerId: this.getId(),
                error: error.message,
            });
            this.adjustPeerScore(1);
        }
    }
    /**
     * Ban or unban a peer
     * @param command 'add' to ban, 'remove' to unban
     * @param banTime Duration of ban in seconds (0 for permanent)
     * @param reason Reason for the ban
     */
    async setBan(command, banTime = 0, reason = "") {
        const release = await this.mutex.acquire();
        try {
            const banKey = `ban:${this.address}`;
            if (command === "add") {
                // Calculate ban expiration
                const banExpiration = banTime === 0 ? 0 : Date.now() + banTime * 1000;
                const banData = {
                    address: this.address,
                    timestamp: Date.now(),
                    expiration: banExpiration,
                    reason,
                    banScore: this.peerState.banScore,
                };
                // Store ban information
                await this.database.put(banKey, JSON.stringify(banData));
                // Update peer state
                this.state = PeerState.BANNED;
                // Disconnect the peer
                this.disconnect(1008, `Banned: ${reason}`);
                // Log the ban
                shared_1.Logger.warn(`Peer banned: ${this.address}`, {
                    reason,
                    duration: banTime === 0 ? "permanent" : `${banTime}s`,
                    banScore: this.peerState.banScore,
                });
                // Emit ban event
                this.eventEmitter.emit("banned", banData);
            }
            else if (command === "remove") {
                // Remove ban record
                await this.database.del(banKey);
                // Reset ban score
                this.peerState.banScore = 0;
                // Log unban
                shared_1.Logger.info(`Peer unbanned: ${this.address}`);
                // Emit unban event
                this.eventEmitter.emit("unbanned", { address: this.address });
            }
        }
        catch (error) {
            shared_1.Logger.error("Failed to set ban status:", error);
            throw error;
        }
        finally {
            release();
        }
    }
    /**
     * Check if peer is currently banned
     * @returns Promise<boolean>
     */
    async checkBanStatus() {
        try {
            const banKey = `ban:${this.address}`;
            const banData = await this.database.get(banKey);
            if (!banData) {
                return false;
            }
            const ban = JSON.parse(banData);
            // Check if ban has expired
            if (ban.expiration !== 0 && ban.expiration < Date.now()) {
                // Remove expired ban
                await this.setBan("remove");
                return false;
            }
            return true;
        }
        catch (error) {
            // If no ban record exists, peer is not banned
            if (error.type === "NotFoundError") {
                return false;
            }
            shared_1.Logger.error("Failed to check ban status:", error);
            throw error;
        }
    }
    /**
     * Get ban information for the peer
     * @returns Promise<BanInfo | null>
     */
    async getBanInfo() {
        try {
            const banKey = `ban:${this.address}`;
            const banData = await this.database.get(banKey);
            if (!banData) {
                return null;
            }
            return JSON.parse(banData);
        }
        catch (error) {
            if (error.type === "NotFoundError") {
                return null;
            }
            shared_1.Logger.error("Failed to get ban info:", error);
            throw error;
        }
    }
    /**
     * List all banned peers
     * @returns Promise<Array<BanInfo>>
     */
    async listBans() {
        try {
            const bans = [];
            // Iterate through database to find ban records
            for await (const [value] of this.database.iterator({
                gte: "ban:",
                lte: "ban:\xFF",
            })) {
                const banData = JSON.parse(value);
                const now = Date.now();
                // Calculate remaining ban time
                const timeRemaining = banData.expiration === 0
                    ? 0 // Permanent ban
                    : Math.max(0, banData.expiration - now); // Temporary ban
                // Add ban info with remaining time
                bans.push({
                    ...banData,
                    timeRemaining,
                });
            }
            // Sort by timestamp (most recent first)
            return bans.sort((a, b) => b.timestamp - a.timestamp);
        }
        catch (error) {
            shared_1.Logger.error("Failed to list bans:", error);
            throw error;
        }
    }
    /**
     * Remove ban for a specific peer address
     * @param address Peer address to unban
     * @returns Promise<boolean> True if ban was removed, false if peer wasn't banned
     */
    async removeBan(address) {
        const release = await this.mutex.acquire();
        try {
            const banKey = `ban:${address}`;
            // Check if peer is banned
            const banData = await this.database.get(banKey);
            if (!banData) {
                return false;
            }
            // Remove ban record
            await this.database.del(banKey);
            // Log unban
            shared_1.Logger.info(`Removed ban for peer: ${address}`);
            // Emit unban event
            this.eventEmitter.emit("unbanned", { address });
            return true;
        }
        catch (error) {
            if (error.type === "NotFoundError") {
                return false;
            }
            shared_1.Logger.error("Failed to remove ban:", error);
            throw error;
        }
        finally {
            release();
        }
    }
    /**
     * Clear all bans
     * @returns Promise<number> Number of bans cleared
     */
    async clearBans() {
        const release = await this.mutex.acquire();
        try {
            let count = 0;
            // Iterate and remove all ban records
            for await (const [key] of this.database.iterator({
                gte: "ban:",
                lte: "ban:\xFF",
            })) {
                await this.database.del(key);
                count++;
            }
            shared_1.Logger.info(`Cleared ${count} peer bans`);
            this.eventEmitter.emit("bansCleared", { count });
            return count;
        }
        catch (error) {
            shared_1.Logger.error("Failed to clear bans:", error);
            throw error;
        }
        finally {
            release();
        }
    }
    isInbound() {
        return this.inbound;
    }
    isVerified() {
        return this.state === PeerState.READY;
    }
    getBytesReceived() {
        return this.bytesReceived;
    }
    getBytesSent() {
        return this.bytesSent;
    }
    getPeerInfo() {
        const now = Date.now();
        const connectionDuration = this.lastMessageTime
            ? now - this.lastMessageTime
            : 0;
        return {
            id: this.peerId,
            address: this.address,
            port: this.port,
            version: this.version?.toString() || "unknown",
            state: this.state,
            services: this.services || [],
            lastSeen: this.lastMessageTime,
            lastSend: this.bytesSent > 0 ? this.lastMessageTime : 0,
            lastReceive: this.bytesReceived > 0 ? this.lastMessageTime : 0,
            connectionTime: connectionDuration,
            bytesReceived: this.bytesReceived,
            bytesSent: this.bytesSent,
            messagesReceived: this.messagesReceived,
            messagesSent: this.messagesSent,
            latency: this.getLatency(),
            inbound: this.inbound,
            startingHeight: this.startHeight || 0,
            banScore: this.peerState.banScore,
            syncedHeaders: this.blockchainSync.headerSync.currentHeight,
            syncedBlocks: this.syncedBlocks,
            inflight: this.getInflightBlocks().map((block) => block.height),
            whitelisted: this.isWhitelisted,
            blacklisted: this.isBlacklisted,
            capabilities: [
                "NETWORK",
                this.services ? "BLOOM" : "",
                this.services ? "WITNESS" : "",
                this.services ? "COMPACT_FILTERS" : "",
            ].filter(Boolean),
            userAgent: this.userAgent || "unknown",
        };
    }
    updateSyncedBlocks(height) {
        this.syncedBlocks = Math.max(this.syncedBlocks, height);
        this.metrics.gauge("synced_blocks", this.syncedBlocks);
    }
    setWhitelisted(status) {
        // Only allow manual whitelisting if peer is in configured whitelist
        const whitelistedPeers = this.configService.get("WHITELISTED_PEERS")?.split(",") || [];
        const isPeerInWhitelist = whitelistedPeers.includes(`${this.address}:${this.port}`);
        if (!isPeerInWhitelist && status) {
            shared_1.Logger.warn(`Cannot whitelist peer ${this.peerId} - not in configured whitelist`);
            return;
        }
        this.isWhitelisted = status;
        this.metrics.gauge("whitelisted", status ? 1 : 0);
        shared_1.Logger.info(`Peer ${this.peerId} whitelist status set to ${status}`);
    }
    setBlacklisted(status) {
        this.isBlacklisted = status;
        this.metrics.gauge("blacklisted", status ? 1 : 0);
        shared_1.Logger.info(`Peer ${this.peerId} blacklist status set to ${status}`);
        if (status) {
            // Automatically disconnect blacklisted peers
            this.disconnect(1008, "Peer blacklisted");
            this.adjustPeerScore(this.config.maxBanScore);
        }
    }
    isBlocked() {
        return this.isBlacklisted || this.isBanned();
    }
    getInflightBlocks() {
        return Array.from(this.blocksInFlight.values());
    }
    getHeight() {
        return this.height;
    }
    setHeight(height) {
        this.height = height;
    }
    async getVotingPower() {
        const release = await this.mutex.acquire();
        try {
            // Check cache first
            const cacheKey = `votingPower:${this.peerId}`;
            const cached = this.database.cache.get(cacheKey);
            if (cached && typeof cached === "object" && "balance" in cached) {
                return BigInt(cached.balance);
            }
            // Get balance from database
            const stored = await this.database.get(`peer:${this.peerId}:balance`);
            if (stored) {
                const balance = BigInt(stored);
                const votingPower = BigInt(Math.floor(Math.sqrt(Number(balance))));
                this.database.cache.set(cacheKey, {
                    balance: votingPower,
                    holdingPeriod: 0,
                });
                return votingPower;
            }
            // If not found, fetch from peer
            const response = await this.request(peer_model_1.PeerMessageType.GET_NODE_INFO, {
                metric: "balance",
            });
            const balance = BigInt(response?.balance || 0);
            const votingPower = BigInt(Math.floor(Math.sqrt(Number(balance))));
            // Store in database and cache
            await this.database.put(`peer:${this.peerId}:balance`, balance.toString());
            this.database.cache.set(cacheKey, {
                balance: votingPower,
                holdingPeriod: 0,
            });
            return votingPower;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get voting power:", error);
            return BigInt(0);
        }
        finally {
            release();
        }
    }
    async updateInfo(info) {
        const release = await this.mutex.acquire();
        try {
            this.version = info.version;
            this.services = info.services;
            this.startHeight = info.startHeight;
            this.userAgent = info.userAgent;
            this.lastMessageTime = info.lastSeen;
            // Update database
            await this.database.put(`peer:${this.id}:info`, JSON.stringify(info));
            shared_1.Logger.debug(`Updated peer info: ${this.id}`, info);
        }
        catch (error) {
            shared_1.Logger.error("Failed to update peer info:", error);
            throw error;
        }
        finally {
            release();
        }
    }
    async handleBlockMessage(blockMessage) {
        try {
            this.eventEmitter.emit("block", blockMessage.block);
            this.metrics.increment("blocks_received");
        }
        catch (error) {
            shared_1.Logger.error("Block message handling failed:", error);
            this.adjustPeerScore(1);
        }
    }
    async handleGetVotes() {
        try {
            const votes = await this.votingDatabase.getVotes();
            await this.send(peer_model_1.PeerMessageType.GET_VOTES, { votes });
        }
        catch (error) {
            shared_1.Logger.error("Get votes handling failed:", error);
        }
    }
    async handleGetHeaders(payload) {
        try {
            const headers = await this.database.getHeaders(payload.locator, payload.hashStop);
            await this.send(peer_model_1.PeerMessageType.HEADERS, { headers });
        }
        catch (error) {
            shared_1.Logger.error("Get headers handling failed:", error);
        }
    }
    async handleGetBlocks(payload) {
        try {
            const blocks = await this.database.getBlocks(payload.locator, payload.hash);
            await this.send(peer_model_1.PeerMessageType.GET_BLOCKS, { blocks });
        }
        catch (error) {
            shared_1.Logger.error("Get blocks handling failed:", error);
        }
    }
    async handleGetNodeInfo() {
        try {
            const nodeInfo = await this.getNodeInfo();
            await this.send(peer_model_1.PeerMessageType.GET_NODE_INFO, nodeInfo);
        }
        catch (error) {
            shared_1.Logger.error("Get node info handling failed:", error);
        }
    }
}
exports.Peer = Peer;
Peer.MAX_LATENCY_SAMPLES = 10;
Peer.LATENCY_WINDOW_MS = 60000; // 1 minute
