"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Node = void 0;
const shared_1 = require("@h3tag-blockchain/shared");
const peer_1 = require("./peer");
const dnsSeed_1 = require("./dnsSeed");
const circuit_breaker_1 = require("./circuit-breaker");
const cache_1 = require("../scaling/cache");
const async_mutex_1 = require("async-mutex");
const metrics_collector_1 = require("../monitoring/metrics-collector");
const health_1 = require("../monitoring/health");
const ddos_1 = require("../security/ddos");
const audit_1 = require("../security/audit");
const dnsSeed_2 = require("./dnsSeed");
const discovery_1 = require("./discovery");
const utxo_model_1 = require("../models/utxo.model");
const peer_model_1 = require("../models/peer.model");
const constants_1 = require("../blockchain/utils/constants");
const transaction_model_1 = require("../models/transaction.model");
const verification_1 = require("./verification");
class Node {
    constructor(blockchain, db, mempool, configService, auditManager) {
        this.blockchain = blockchain;
        this.db = db;
        this.mempool = mempool;
        this.configService = configService;
        this.auditManager = auditManager;
        this.mutex = new async_mutex_1.Mutex();
        this.isRunning = false;
        this.config = {
            ...Node.DEFAULT_CONFIG,
            ...configService.config,
        };
        this.peers = new Map();
        this.peerStates = new Map();
        this.bannedPeers = new Map();
        this.orphanBlocks = new Map();
        this.orphanTxs = new Map();
        this.peerCircuitBreakers = new Map();
        this.seeder = new dnsSeed_1.DNSSeeder(configService, db, {
            networkType: this.config.networkType,
            port: this.config.port,
        });
        this.metrics = new metrics_collector_1.MetricsCollector("node");
        this.health = new health_1.HealthMonitor({
            interval: 60000,
            thresholds: {
                minPowHashrate: 1000000000,
                minPowNodes: 100,
                minTagDistribution: 0.5,
                maxTagConcentration: 0.2,
            },
        });
        this.ddosProtection = new ddos_1.DDoSProtection({
            maxRequests: {
                pow: 200,
                qudraticVote: 100,
                default: 50,
            },
            windowMs: 60000, // 1 minute
        }, this.audit);
        this.audit = new audit_1.AuditManager();
        this.peerCache = new cache_1.Cache({
            ttl: 3600000,
            maxSize: 1000,
        });
        this.discovery = new discovery_1.PeerDiscovery(configService, mempool, new utxo_model_1.UTXOSet());
        // Setup event handlers
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.eventEmitter.on("peer:connect", this.handlePeerConnect.bind(this));
        this.eventEmitter.on("peer:disconnect", this.handlePeerDisconnect.bind(this));
        this.eventEmitter.on("peer:message", this.handlePeerMessage.bind(this));
        this.eventEmitter.on("peer:error", this.handlePeerError.bind(this));
        this.eventEmitter.on("block:received", this.handleBlockReceived.bind(this));
        this.eventEmitter.on("tx:received", this.handleTransactionReceived.bind(this));
    }
    async start() {
        if (this.isRunning)
            return;
        try {
            this.isRunning = true;
            // Start DNS seeder
            await this.seeder.start();
            // Load cached peer data
            await this.loadPeerCache();
            // Initial peer discovery
            await this.discoverPeers();
            // Start maintenance timer
            this.maintenanceTimer = setInterval(() => this.performMaintenance(), this.config.pruneInterval);
            shared_1.Logger.info("Node started successfully", {
                network: this.config.networkType,
                port: this.config.port,
            });
        }
        catch (error) {
            this.isRunning = false;
            shared_1.Logger.error("Failed to start node:", error);
            throw error;
        }
    }
    async stop() {
        if (!this.isRunning)
            return;
        try {
            this.isRunning = false;
            // Clear maintenance timer
            if (this.maintenanceTimer) {
                clearInterval(this.maintenanceTimer);
            }
            // Disconnect all peers
            await Promise.all(Array.from(this.peers.values()).map((peer) => peer.disconnect()));
            // Stop DNS seeder
            await this.seeder.stop();
            // Save peer cache
            await this.savePeerCache();
            shared_1.Logger.info("Node stopped successfully");
        }
        catch (error) {
            shared_1.Logger.error("Error stopping node:", error);
            throw error;
        }
    }
    // Peer Management Methods
    async discoverPeers() {
        const release = await this.mutex.acquire();
        try {
            if (this.peers.size >= this.config.maxPeers)
                return;
            const peerAddresses = this.discovery.getPeersByType(discovery_1.PeerType.FULL_NODE);
            const connectPromises = peerAddresses
                .filter((addr) => !this.peers.has(addr) && !this.isBanned(addr))
                .slice(0, this.config.maxPeers - this.peers.size)
                .map((addr) => this.connectToPeer(addr));
            await Promise.allSettled(connectPromises);
            this.metrics.gauge("peer_count", this.peers.size);
            if (this.peers.size < this.config.minPeers) {
                shared_1.Logger.warn("Low peer count", {
                    current: this.peers.size,
                    minimum: this.config.minPeers,
                });
            }
        }
        finally {
            release();
        }
    }
    async connectToPeer(address) {
        const release = await this.mutex.acquire();
        try {
            // Early checks
            if (this.peers.has(address))
                return;
            if (this.isBanned(address))
                return;
            const breaker = this.getCircuitBreaker(address);
            if (!breaker.isAvailable())
                return;
            // Create temporary peer connection to get node info
            const tempPeer = new peer_1.Peer(address, this.config.port, {
                version: this.blockchain.getVersion(),
                services: this.config.services,
                timeout: this.config.connectionTimeout,
            }, this.configService, this.db);
            // Get node info through handshake
            const nodeInfo = await tempPeer.handshake();
            // Verify the node using NodeVerifier
            const isVerified = await verification_1.NodeVerifier.verifyNode({
                version: nodeInfo.version.toString(),
                height: nodeInfo.height,
                peers: nodeInfo.peers || 0,
                isMiner: nodeInfo.isMiner || false,
                publicKey: nodeInfo.publicKey,
                signature: nodeInfo.signature,
                timestamp: Date.now(),
                address: address,
                tagInfo: {
                    minedBlocks: nodeInfo.minedBlocks || 0,
                    voteParticipation: nodeInfo.voteParticipation || 0,
                    lastVoteHeight: nodeInfo.lastVoteHeight || 0,
                    currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
                    votingPower: nodeInfo.votingPower,
                },
            });
            if (!isVerified) {
                shared_1.Logger.warn("Peer verification failed", { address });
                tempPeer.disconnect();
                this.increasePeerBanScore(address, 10);
                return;
            }
            // If verification passed, use the peer
            this.peers.set(address, tempPeer);
            this.updatePeerState(address, {
                id: tempPeer.getId(),
                address,
                port: this.config.port,
                version: nodeInfo.version,
                services: nodeInfo.services,
                lastSeen: Date.now(),
                banScore: 0,
                synced: false,
                height: nodeInfo.height,
            });
            breaker.onSuccess();
            this.eventEmitter.emit("peer:connect", tempPeer);
            shared_1.Logger.info("Peer connected and verified", {
                address,
                version: nodeInfo.version,
                height: nodeInfo.height,
            });
        }
        catch (error) {
            this.getCircuitBreaker(address).onFailure();
            shared_1.Logger.error("Failed to connect to peer:", {
                address,
                error: error.message,
            });
            this.increasePeerBanScore(address, 1);
        }
        finally {
            release();
        }
    }
    // Message Handling
    async handlePeerMessage(peer, message) {
        try {
            if (!this.ddosProtection.checkRequest("peer_message", peer.getId())) {
                this.increasePeerBanScore(peer.getId(), 10);
                return;
            }
            switch (message.type) {
                case "block":
                    await this.handleBlockMessage(peer, message.data);
                    break;
                case "tx":
                    await this.handleTransactionMessage(peer, message.data);
                    break;
                case "inv":
                    await this.handleInventoryMessage(peer, message.data);
                    break;
                case "getdata":
                    await this.handleGetDataMessage(peer, message.data);
                    break;
                case "ping":
                    await peer.send(peer_model_1.PeerMessageType.PONG, { nonce: message.data.nonce });
                    break;
                default:
                    shared_1.Logger.warn("Unknown message type:", message.type);
            }
            this.updatePeerLastSeen(peer.getId());
        }
        catch (error) {
            shared_1.Logger.error("Error handling peer message:", {
                peerId: peer.getId(),
                error: error.message,
            });
            this.increasePeerBanScore(peer.getId(), 1);
        }
    }
    // Block and Transaction Handling
    async handleBlockMessage(peer, block) {
        try {
            if (this.blockchain.hasBlock(block.hash))
                return;
            if (!(await this.blockchain.validateBlock(block))) {
                this.increasePeerBanScore(peer.getId(), 20);
                return;
            }
            if (!block.header.previousHash ||
                !this.blockchain.hasBlock(block.header.previousHash)) {
                this.handleOrphanBlock(block);
                return;
            }
            await this.blockchain.addBlock(block);
            this.processOrphanBlocks(block.hash);
            this.eventEmitter.emit("block:received", block);
        }
        catch (error) {
            shared_1.Logger.error("Error handling block message:", {
                blockHash: block.hash,
                error: error.message,
            });
        }
    }
    async handleTransactionMessage(peer, tx) {
        try {
            if (this.mempool.hasTransaction(tx.id))
                return;
            if (!(await this.mempool.validateTransaction(tx, await this.blockchain.getUTXOSet(), this.blockchain.getCurrentHeight()))) {
                this.increasePeerBanScore(peer.getId(), 10);
                return;
            }
            await this.mempool.addTransaction(tx);
            this.eventEmitter.emit("tx:received", tx);
        }
        catch (error) {
            shared_1.Logger.error("Error handling transaction message:", {
                txId: tx.id,
                error: error.message,
            });
        }
    }
    // Peer State Management
    updatePeerState(address, state) {
        if (!address) {
            shared_1.Logger.warn("Attempted to update state for null peer address");
            return;
        }
        const currentState = this.peerStates.get(address) || {
            id: "",
            address,
            port: this.config.port,
            version: 0,
            services: 0,
            lastSeen: 0,
            banScore: 0,
            synced: false,
            height: 0,
        };
        this.peerStates.set(address, { ...currentState, ...state });
        this.peerCache.set(address, this.peerStates.get(address));
    }
    increasePeerBanScore(peerId, score) {
        const state = this.peerStates.get(peerId);
        if (!state)
            return;
        state.banScore += score;
        if (state.banScore >= this.config.maxBanScore) {
            this.banPeer(peerId);
        }
    }
    banPeer(peerId) {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.disconnect();
            this.peers.delete(peerId);
            this.bannedPeers.set(peerId, Date.now() + this.config.banTime);
            shared_1.Logger.warn("Peer banned:", {
                peerId,
                banScore: this.peerStates.get(peerId)?.banScore,
            });
        }
    }
    // Utility Methods
    getCircuitBreaker(address) {
        if (!this.peerCircuitBreakers.has(address)) {
            this.peerCircuitBreakers.set(address, new circuit_breaker_1.CircuitBreaker({
                failureThreshold: 3,
                resetTimeout: 60000,
            }));
        }
        return this.peerCircuitBreakers.get(address);
    }
    isCompatibleVersion(version) {
        const minVersion = this.configService.get("MIN_PEER_VERSION");
        return version >= minVersion;
    }
    isBanned(address) {
        const banExpiry = this.bannedPeers.get(address);
        if (!banExpiry)
            return false;
        if (Date.now() >= banExpiry) {
            this.bannedPeers.delete(address);
            return false;
        }
        return true;
    }
    // Public Methods
    getAddress() {
        return this.configService.get("NODE_ADDRESS");
    }
    getPeerCount() {
        return this.peers.size;
    }
    getBannedPeers() {
        return Array.from(this.bannedPeers.keys());
    }
    async broadcastBlock(block) {
        try {
            const promises = Array.from(this.peers.values()).map((peer) => peer.send(peer_model_1.PeerMessageType.BLOCK, block));
            await Promise.allSettled(promises);
        }
        catch (error) {
            shared_1.Logger.error("Failed to broadcast block:", error);
        }
    }
    async broadcastTransaction(tx) {
        const promises = Array.from(this.peers.values()).map((peer) => peer.send(peer_model_1.PeerMessageType.TX, tx));
        await Promise.allSettled(promises);
    }
    handlePeerConnect(peer) {
        shared_1.Logger.info("Peer connected:", peer.getId());
    }
    handlePeerDisconnect(peer) {
        const peerId = peer.getId();
        this.peers.delete(peerId);
        this.peerStates.delete(peerId);
        this.peerCircuitBreakers.delete(peerId);
        shared_1.Logger.info("Peer disconnected:", peerId);
    }
    handlePeerError(peer, error) {
        shared_1.Logger.error("Peer error:", {
            peerId: peer.getId(),
            error: error.message,
        });
    }
    handleBlockReceived(block) {
        shared_1.Logger.info("Block received:", block.hash);
    }
    handleTransactionReceived(tx) {
        shared_1.Logger.info("Transaction received:", tx.id);
    }
    async loadPeerCache() {
        try {
            const cachedPeers = this.peerCache.getAll();
            for (const [address, state] of Object.entries(cachedPeers)) {
                this.peerStates.set(address, state);
            }
            shared_1.Logger.debug("Loaded peer cache:", {
                peerCount: Object.keys(cachedPeers).length,
            });
        }
        catch (error) {
            shared_1.Logger.error("Failed to load peer cache:", error);
        }
    }
    async savePeerCache() {
        try {
            for (const [address, state] of this.peerStates.entries()) {
                this.peerCache.set(address, state);
            }
            shared_1.Logger.debug("Saved peer cache:", { peerCount: this.peerStates.size });
        }
        catch (error) {
            shared_1.Logger.error("Failed to save peer cache:", error);
        }
    }
    async performMaintenance() {
        try {
            // Clean up stale peers
            await this.evictStalePeers();
            // Prune orphan blocks and transactions
            this.pruneOrphans();
            // Save peer cache
            await this.savePeerCache();
            shared_1.Logger.debug("Maintenance completed");
        }
        catch (error) {
            shared_1.Logger.error("Maintenance error:", error);
        }
    }
    async evictStalePeers() {
        const now = Date.now();
        const staleThreshold = now - this.config.connectionTimeout * 2;
        for (const [address, state] of this.peerStates.entries()) {
            if (state.lastSeen < staleThreshold) {
                const peer = this.peers.get(address);
                if (peer) {
                    peer.disconnect();
                    this.peers.delete(address);
                }
                this.peerStates.delete(address);
                shared_1.Logger.debug("Evicted stale peer:", { address });
            }
        }
    }
    pruneOrphans() {
        const now = Date.now();
        const maxAge = 3600000; // 1 hour
        for (const [key, block] of this.orphanBlocks.entries()) {
            if (now - block.timestamp > maxAge) {
                this.orphanBlocks.delete(key);
            }
        }
    }
    async handleInventoryMessage(peer, data) {
        for (const item of data) {
            if (item.type === "block" && !this.blockchain.hasBlock(item.hash)) {
                await peer.send(peer_model_1.PeerMessageType.GETDATA, {
                    type: "block",
                    hash: item.hash,
                });
            }
            else if (item.type === "tx" &&
                !this.mempool.hasTransaction(item.hash)) {
                await peer.send(peer_model_1.PeerMessageType.GETDATA, {
                    type: "tx",
                    hash: item.hash,
                });
            }
        }
    }
    async handleGetDataMessage(peer, data) {
        for (const item of data) {
            if (item.type === "block") {
                const block = await this.blockchain.getBlock(item.hash);
                if (block)
                    await peer.send(peer_model_1.PeerMessageType.BLOCK, block);
            }
            else if (item.type === "tx") {
                const tx = await this.mempool.getTransaction(item.hash);
                if (tx)
                    await peer.send(peer_model_1.PeerMessageType.TX, tx);
            }
        }
    }
    updatePeerLastSeen(peerId) {
        this.updatePeerState(peerId, {
            lastSeen: Date.now(),
        });
    }
    async handleOrphanBlock(block) {
        const orphanKey = `${block.header.previousHash}:${block.hash}`;
        this.orphanBlocks.set(orphanKey, block);
        shared_1.Logger.debug("Added orphan block:", {
            hash: block.hash,
            previousHash: block.header.previousHash,
        });
    }
    async processOrphanBlocks(parentHash) {
        for (const [key, block] of this.orphanBlocks.entries()) {
            if (block.header.previousHash === parentHash) {
                await this.blockchain.addBlock(block);
                this.orphanBlocks.delete(key);
                await this.processOrphanBlocks(block.hash); // Recursively process children
            }
        }
    }
    async getActiveValidators() {
        const [peerValidators, dbValidators] = await Promise.all([
            Array.from(this.peers.values())
                .filter((peer) => peer.isConnected() && peer.hasVoted())
                .map((peer) => ({ address: peer.getAddress() })),
            this.db.getActiveValidators(),
        ]);
        // Combine and deduplicate validators
        const uniqueAddresses = new Set([
            ...peerValidators.map((v) => v.address),
            ...dbValidators.map((v) => v.address),
        ]);
        return Array.from(uniqueAddresses).map((address) => ({ address }));
    }
    async close() {
        this.isRunning = false;
        if (this.maintenanceTimer) {
            clearInterval(this.maintenanceTimer);
        }
        // Disconnect all peers
        const disconnectPromises = Array.from(this.peers.values()).map((peer) => peer.disconnect());
        await Promise.all(disconnectPromises);
        this.peers.clear();
        this.peerStates.clear();
        await this.savePeerCache();
    }
    getInfo() {
        return {
            networkType: this.config.networkType,
            port: this.config.port,
            peersCount: this.peers.size,
            version: this.blockchain.getVersion(),
            isRunning: this.isRunning,
            syncStatus: {
                synced: this.peers.size > 0,
                height: this.blockchain.getCurrentHeight(),
            },
        };
    }
    /**
     * Broadcast raw transaction to connected peers
     * @param rawTx Serialized transaction data
     * @returns Promise<string> Transaction ID
     */
    async broadcastRawTransaction(rawTx) {
        const release = await this.mutex.acquire();
        try {
            // Deserialize and validate transaction
            const txBuilder = new transaction_model_1.TransactionBuilder();
            const txId = await txBuilder.sendRawTransaction(rawTx);
            // Get transaction object
            const tx = await this.db.getTransaction(txId);
            if (!tx) {
                throw new Error("Transaction not found after creation");
            }
            // Broadcast to all connected peers
            const broadcastPromises = Array.from(this.peers.values())
                .filter((peer) => peer.isConnected() && !peer.isBanned())
                .map((peer) => peer.sendTransaction(tx));
            // Wait for broadcast completion with timeout
            const results = await Promise.allSettled(broadcastPromises);
            // Check broadcast success rate
            const successCount = results.filter((r) => r.status === "fulfilled").length;
            const minPeers = Math.ceil(this.peers.size * 0.51); // Require >50% success
            if (successCount < minPeers) {
                throw new Error("Failed to broadcast to sufficient peers");
            }
            shared_1.Logger.info("Transaction broadcast successful", {
                txId,
                successPeers: successCount,
                totalPeers: this.peers.size,
            });
            return txId;
        }
        catch (error) {
            shared_1.Logger.error("Transaction broadcast failed:", error);
            throw error;
        }
        finally {
            release();
        }
    }
    getMempool() {
        return this.mempool;
    }
    getConfig() {
        return this.config;
    }
    getPeer(address) {
        return this.peers.get(address);
    }
}
exports.Node = Node;
Node.DEFAULT_CONFIG = {
    networkType: dnsSeed_2.NetworkType[constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.type.MAINNET],
    port: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.port.MAINNET,
    maxPeers: 100000,
    minPeers: 1,
    connectionTimeout: constants_1.BLOCKCHAIN_CONSTANTS.UTIL.VALIDATION_TIMEOUT_MS,
    syncInterval: 10000,
    banTime: 86400000,
    maxBanScore: 100,
    pruneInterval: 3600000,
    maxOrphans: constants_1.BLOCKCHAIN_CONSTANTS.MINING.ORPHAN_WINDOW,
    maxReorg: constants_1.BLOCKCHAIN_CONSTANTS.MINING.MAX_FORK_DEPTH,
    services: 1, // NODE_NETWORK
};
//# sourceMappingURL=node.js.map