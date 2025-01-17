"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkStats = void 0;
const peer_1 = require("./peer");
const events_1 = require("events");
const constants_1 = require("../blockchain/utils/constants");
const network_error_1 = require("./network-error");
const shared_1 = require("@h3tag-blockchain/shared");
class NetworkStats {
    constructor() {
        this.eventEmitter = new events_1.EventEmitter();
        this.blockPropagationTimes = [];
        this.globalHashRate = 0;
        this.peerLatencies = new Map();
        this.peers = new Map();
        this.currentDifficulty = 1;
        this.discoveryTimer = null;
        this.peerScores = new Map();
        this.lastSeen = new Map();
        this.bannedPeers = new Set();
        this.startTime = Math.floor(Date.now() / 1000);
        // Add TAG specific metrics
        this.h3TagMetrics = {
            price: 0,
            volume24h: 0,
            marketCap: 0,
            holders: 0,
            distribution: {
                gini: 0,
                top10Percent: 0,
                top50Percent: 0,
            },
        };
        this.startDiscoveryLoop();
    }
    startDiscoveryLoop() {
        this.discoveryTimer = setInterval(() => {
            this.performDiscovery();
        }, NetworkStats.DISCOVERY_INTERVAL);
    }
    async performDiscovery() {
        const peersToRemove = new Set();
        const now = Date.now();
        try {
            // First, identify peers to remove
            for (const [peerId, lastSeenTime] of this.lastSeen.entries()) {
                if (now - lastSeenTime > NetworkStats.PEER_TIMEOUT) {
                    peersToRemove.add(peerId);
                }
            }
            // Then, perform removals in a transaction-like manner
            await Promise.all(Array.from(peersToRemove).map(async (peerId) => {
                try {
                    await this.removePeer(peerId);
                }
                catch (error) {
                    shared_1.Logger.error(`Failed to remove peer ${peerId}:`, error);
                }
            }));
            // Update scores atomically
            for (const [peerId, score] of this.peerScores.entries()) {
                if (!peersToRemove.has(peerId)) {
                    this.peerScores.set(peerId, score * NetworkStats.SCORE_DECAY);
                }
            }
            this.eventEmitter.emit("discovery_cycle", {
                timestamp: now,
                activePeers: this.getActivePeerCount(),
                bannedPeers: this.bannedPeers.size,
                averageScore: this.getAveragePeerScore(),
            });
        }
        catch (error) {
            shared_1.Logger.error("Discovery cycle failed:", error);
        }
    }
    updatePeerScore(peerId, delta) {
        try {
            // Check if peer exists
            if (!this.peers.has(peerId)) {
                throw new network_error_1.NetworkError("Peer not found", network_error_1.NetworkErrorCode.PEER_NOT_FOUND);
            }
            const currentScore = this.peerScores.get(peerId) ?? 0;
            const newScore = Math.max(NetworkStats.MIN_SCORE, Math.min(NetworkStats.MAX_SCORE, currentScore + delta));
            this.peerScores.set(peerId, newScore);
            this.lastSeen.set(peerId, Date.now());
            if (newScore <= NetworkStats.MIN_SCORE) {
                this.banPeer(peerId);
            }
        }
        catch (error) {
            shared_1.Logger.error("Failed to update peer score:", error);
        }
    }
    banPeer(peerId) {
        try {
            this.bannedPeers.add(peerId);
            this.removePeer(peerId);
            this.eventEmitter.emit("peer_banned", {
                peerId,
                timestamp: Date.now(),
                reason: "Low score",
            });
        }
        catch (error) {
            shared_1.Logger.error("Failed to ban peer:", error);
        }
    }
    getAveragePeerScore() {
        const scores = Array.from(this.peerScores.values());
        return scores.length
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : 0;
    }
    on(event, listener) {
        this.eventEmitter.on(event, listener);
    }
    off(event, listener) {
        this.eventEmitter.off(event, listener);
    }
    removeAllListeners() {
        this.eventEmitter.removeAllListeners();
    }
    async addPeer(peer) {
        try {
            if (!peer || !(peer instanceof peer_1.Peer)) {
                throw new network_error_1.NetworkError("Invalid peer object", network_error_1.NetworkErrorCode.PEER_VALIDATION_FAILED, { peer });
            }
            const peerInfo = await peer.getInfo();
            if (!peerInfo?.id) {
                throw new network_error_1.NetworkError("Invalid peer info", network_error_1.NetworkErrorCode.PEER_VALIDATION_FAILED, { peerInfo });
            }
            // Check peer limit
            if (this.peers.size >= NetworkStats.MAX_PEERS) {
                throw new network_error_1.NetworkError("Maximum peer limit reached", network_error_1.NetworkErrorCode.PEER_VALIDATION_FAILED, { currentPeers: this.peers.size });
            }
            if (this.bannedPeers.has(peerInfo.id)) {
                throw new network_error_1.NetworkError("Peer is banned", network_error_1.NetworkErrorCode.PEER_BANNED, {
                    peerId: peerInfo.id,
                });
            }
            // Initialize peer score
            this.peerScores.set(peerInfo.id, 0);
            this.lastSeen.set(peerInfo.id, Date.now());
            // Add event listeners
            NetworkStats.PEER_EVENTS.forEach((event) => {
                peer.eventEmitter.on(event, (...args) => this.handlePeerEvent(peerInfo.id, event, ...args));
            });
            this.peers.set(peerInfo.id, peer);
            // Emit peer added event
            this.eventEmitter.emit("peer_added", {
                peerId: peerInfo.id,
                peerInfo,
                timestamp: Date.now(),
                totalPeers: this.peers.size,
            });
            shared_1.Logger.info(`Peer added: ${peerInfo.id}, total peers: ${this.peers.size}`);
        }
        catch (error) {
            shared_1.Logger.error("Failed to add peer:", error);
            throw error;
        }
    }
    removePeer(peerId) {
        try {
            if (!peerId || typeof peerId !== "string") {
                throw new network_error_1.NetworkError("Invalid peer ID", network_error_1.NetworkErrorCode.PEER_VALIDATION_FAILED, { peerId });
            }
            const peer = this.peers.get(peerId);
            if (!peer) {
                shared_1.Logger.warn(`Attempted to remove non-existent peer: ${peerId}`);
                return;
            }
            // Remove event listeners
            NetworkStats.PEER_EVENTS.forEach((event) => {
                peer.eventEmitter.removeAllListeners(event);
            });
            this.peers.delete(peerId);
            this.peerLatencies.delete(peerId);
            // Emit peer removed event
            this.eventEmitter.emit("peer_removed", {
                peerId,
                timestamp: Date.now(),
                remainingPeers: this.peers.size,
            });
            shared_1.Logger.info(`Peer removed: ${peerId}, remaining peers: ${this.peers.size}`);
        }
        catch (error) {
            shared_1.Logger.error("Failed to remove peer:", error);
            throw error;
        }
    }
    getActivePeerCount() {
        try {
            const activePeers = Array.from(this.peers.values()).filter((peer) => peer.isConnected()).length;
            // Emit metrics
            this.eventEmitter.emit("active_peers_updated", {
                count: activePeers,
                total: this.peers.size,
                timestamp: Date.now(),
            });
            return activePeers;
        }
        catch (error) {
            shared_1.Logger.error("Failed to get active peer count:", error);
            throw new network_error_1.NetworkError("Failed to get active peer count", network_error_1.NetworkErrorCode.PEER_VALIDATION_FAILED, { error });
        }
    }
    async getAverageLatency() {
        try {
            // Get connected peers
            const connectedPeers = Array.from(this.peers.values())
                .filter((peer) => peer.isConnected())
                .slice(0, NetworkStats.MAX_SAMPLE_SIZE); // Limit sample size for performance
            if (connectedPeers.length === 0) {
                shared_1.Logger.debug("No connected peers for latency calculation");
                return NetworkStats.DEFAULT_LATENCY;
            }
            let validSamples = 0;
            const latencies = await Promise.all(connectedPeers.map(async (peer) => {
                try {
                    const peerInfo = await peer.getInfo();
                    const latency = peerInfo?.latency;
                    if (typeof latency === "number" && latency >= NetworkStats.MIN_LATENCY && latency <= NetworkStats.MAX_LATENCY) {
                        validSamples++;
                        return latency;
                    }
                    return 0;
                }
                catch (error) {
                    shared_1.Logger.warn(`Failed to get latency for peer, error: ${error.message}`, error);
                    return 0;
                }
            }));
            const totalLatency = latencies.reduce((sum, latency) => sum + latency, 0);
            if (validSamples === 0) {
                shared_1.Logger.warn("No valid latency samples available");
                return NetworkStats.DEFAULT_LATENCY;
            }
            const averageLatency = totalLatency / validSamples;
            // Emit metrics
            this.eventEmitter.emit("average_latency_updated", {
                average: averageLatency,
                sampleSize: validSamples,
                totalPeers: this.peers.size,
                timestamp: Date.now(),
            });
            return averageLatency;
        }
        catch (error) {
            shared_1.Logger.error("Failed to calculate average latency:", error);
            throw new network_error_1.NetworkError("Failed to calculate average latency", network_error_1.NetworkErrorCode.PEER_VALIDATION_FAILED, { error });
        }
    }
    addBlockPropagationTime(time) {
        try {
            if (!Number.isFinite(time) ||
                time < NetworkStats.MIN_PROPAGATION_TIME ||
                time > NetworkStats.MAX_PROPAGATION_TIME) {
                throw new network_error_1.NetworkError("Invalid propagation time", network_error_1.NetworkErrorCode.INVALID_PROPAGATION_TIME, { time });
            }
            this.blockPropagationTimes.push(time);
            while (this.blockPropagationTimes.length > NetworkStats.MAX_PROPAGATION_TIMES) {
                this.blockPropagationTimes.shift();
            }
            this.eventEmitter.emit("propagation_time_added", { time });
        }
        catch (error) {
            shared_1.Logger.error("Failed to add propagation time:", error);
            throw error;
        }
    }
    updateGlobalHashRate(hashRate) {
        try {
            if (!Number.isFinite(hashRate) || hashRate < NetworkStats.MIN_HASH_RATE) {
                throw new network_error_1.NetworkError("Invalid hash rate value", network_error_1.NetworkErrorCode.INVALID_HASH_RATE, { hashRate });
            }
            this.globalHashRate = hashRate;
            this.eventEmitter.emit("hashrate_updated", { hashRate });
        }
        catch (error) {
            shared_1.Logger.error("Hash rate update failed:", error);
            throw error;
        }
    }
    updatePeerLatency(peerId, latency) {
        try {
            if (!peerId || typeof peerId !== "string") {
                throw new network_error_1.NetworkError("Invalid peer ID", network_error_1.NetworkErrorCode.PEER_VALIDATION_FAILED, { peerId });
            }
            if (!Number.isFinite(latency) ||
                latency < NetworkStats.MIN_LATENCY ||
                latency > NetworkStats.MAX_LATENCY) {
                throw new network_error_1.NetworkError("Invalid latency value", network_error_1.NetworkErrorCode.PEER_VALIDATION_FAILED, { peerId, latency });
            }
            this.peerLatencies.set(peerId, latency);
            this.eventEmitter.emit("peer_latency_updated", { peerId, latency });
        }
        catch (error) {
            shared_1.Logger.error("Latency update failed:", error);
            throw error;
        }
    }
    getAveragePropagationTime() {
        try {
            if (this.blockPropagationTimes.length === 0) {
                return NetworkStats.DEFAULT_PROPAGATION_TIME;
            }
            const samples = this.blockPropagationTimes.slice(-NetworkStats.MAX_SAMPLE_SIZE);
            const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
            // Add safety check for standard deviation
            const variance = samples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / samples.length;
            const stdDev = Math.sqrt(variance) || 1; // Prevent division by zero
            const validSamples = samples.filter((time) => Math.abs(time - mean) <= NetworkStats.OUTLIER_THRESHOLD * stdDev);
            // Return mean if no valid samples after filtering
            return validSamples.length > 0
                ? validSamples.reduce((a, b) => a + b, 0) / validSamples.length
                : mean;
        }
        catch (error) {
            shared_1.Logger.error("Failed to calculate average propagation time:", error);
            return NetworkStats.DEFAULT_PROPAGATION_TIME;
        }
    }
    handlePeerEvent(peerId, event, ...args) {
        try {
            if (!NetworkStats.VALID_EVENTS.has(event)) {
                throw new network_error_1.NetworkError("Invalid event type", network_error_1.NetworkErrorCode.MESSAGE_VALIDATION_FAILED);
            }
            const eventName = `peer_${event}`;
            const listener = (data) => {
                this.eventEmitter.emit(eventName, {
                    peerId,
                    args,
                    timestamp: Date.now(),
                    eventId: `${peerId}_${event}_${Date.now()}`,
                    peerCount: this.peers.size,
                });
            };
            this.eventEmitter.once(eventName, listener);
            const peer = this.peers.get(peerId);
            if (peer) {
                peer.eventEmitter.on(event, listener);
            }
        }
        catch (error) {
            shared_1.Logger.error("Failed to handle peer event:", error);
        }
    }
    getVotingStats() {
        try {
            // Calculate voting participation rate
            const activeVoters = Array.from(this.peers.values()).filter((peer) => peer.hasVoted()).length;
            return {
                participation: activeVoters / this.peers.size,
                averageVoteTime: this.calculateAverageVoteTime(),
                totalVoters: this.peers.size,
            };
        }
        catch (error) {
            shared_1.Logger.error("Failed to calculate voting stats:", error);
            return {
                participation: 0,
                averageVoteTime: 0,
                totalVoters: 0,
            };
        }
    }
    calculateAverageVoteTime() {
        try {
            const voteTimes = Array.from(this.peers.values())
                .filter((peer) => peer.hasVoted())
                .map((peer) => peer.getVoteTime() || 0);
            if (voteTimes.length === 0)
                return 0;
            return voteTimes.reduce((a, b) => a + b, 0) / voteTimes.length;
        }
        catch (error) {
            shared_1.Logger.error("Failed to calculate average vote time:", error);
            return 0;
        }
    }
    /**
     * Update TAG price and market metrics
     */
    updateHBXMetrics(metrics) {
        try {
            Object.assign(this.h3TagMetrics, metrics);
            this.eventEmitter.emit("h3Tag_metrics_updated", {
                ...this.h3TagMetrics,
                currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY,
                timestamp: Date.now(),
            });
        }
        catch (error) {
            shared_1.Logger.error("Failed to update TAG metrics:", error);
            throw new network_error_1.NetworkError("Failed to update TAG metrics", network_error_1.NetworkErrorCode.METRICS_UPDATE_FAILED, { metrics });
        }
    }
    /**
     * Get current TAG metrics
     */
    getMetrics() {
        return {
            ...this.h3TagMetrics,
            currency: {
                name: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NAME,
                symbol: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
                decimals: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.DECIMALS,
            },
        };
    }
    async initialize() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Network stats initialization timeout"));
            }, 30000); // 30 second timeout
            try {
                this.peerLatencies = new Map();
                this.blockPropagationTimes = [];
                this.globalHashRate = 0;
                // Start discovery loop
                this.startDiscoveryLoop();
                clearTimeout(timeout);
                shared_1.Logger.debug("Network stats initialized");
                resolve();
            }
            catch (error) {
                clearTimeout(timeout);
                shared_1.Logger.error("Failed to initialize network stats:", error);
                reject(error);
            }
        });
    }
    cleanup() {
        if (this.discoveryTimer) {
            clearInterval(this.discoveryTimer);
            this.discoveryTimer = null;
        }
        this.removeAllListeners();
        this.peers.clear();
        this.peerScores.clear();
        this.lastSeen.clear();
        this.bannedPeers.clear();
    }
    getNetworkInfo() {
        try {
            // Get connected peers
            const connectedPeers = Array.from(this.peers.values()).filter((peer) => peer.isConnected());
            // Calculate connection metrics
            const inbound = connectedPeers.filter((peer) => peer.isInbound()).length;
            const outbound = connectedPeers.length - inbound;
            const verified = connectedPeers.filter((peer) => peer.isVerified()).length;
            // Get network metrics
            const metrics = {
                totalBytesRecv: connectedPeers.reduce((sum, peer) => sum + peer.getBytesReceived(), 0),
                totalBytesSent: connectedPeers.reduce((sum, peer) => sum + peer.getBytesSent(), 0),
                timeConnected: Math.floor(Date.now() / 1000) - this.startTime,
                blockHeight: this.blockchain.getHeight(),
                difficulty: this.blockchain.getCurrentDifficulty(),
                hashRate: this.globalHashRate,
                mempool: this.getMempoolInfo(),
            };
            // Get local addresses
            const localAddresses = this.getLocalAddresses();
            return {
                version: constants_1.BLOCKCHAIN_CONSTANTS.VERSION.toString(),
                subversion: constants_1.BLOCKCHAIN_CONSTANTS.USER_AGENT,
                protocolVersion: constants_1.BLOCKCHAIN_CONSTANTS.PROTOCOL_VERSION,
                localServices: this.getLocalServices(),
                connections: {
                    total: connectedPeers.length,
                    inbound,
                    outbound,
                    verified,
                },
                networks: [
                    {
                        name: "ipv4",
                        limited: false,
                        reachable: true,
                        proxy: this.configService.get("PROXY_IPV4") || "none",
                        proxy_randomize_credentials: true,
                    },
                    {
                        name: "ipv6",
                        limited: false,
                        reachable: true,
                        proxy: this.configService.get("PROXY_IPV6") || "none",
                        proxy_randomize_credentials: true,
                    },
                    {
                        name: "onion",
                        limited: true,
                        reachable: false,
                        proxy: "none",
                        proxy_randomize_credentials: true,
                    },
                ],
                localAddresses,
                warnings: this.getNetworkWarnings(),
                metrics,
            };
        }
        catch (error) {
            shared_1.Logger.error("Failed to get network info:", error);
            throw new network_error_1.NetworkError("Failed to get network info", network_error_1.NetworkErrorCode.NETWORK_INFO_FAILED, { error });
        }
    }
    getMempoolInfo() {
        try {
            const mempool = this.blockchain.getMempool();
            return {
                size: mempool.size,
                bytes: mempool.bytes,
                usage: mempool.usage,
                maxmempool: constants_1.BLOCKCHAIN_CONSTANTS.MAX_MEMPOOL_SIZE,
                mempoolminfee: constants_1.BLOCKCHAIN_CONSTANTS.MIN_RELAY_TX_FEE,
            };
        }
        catch (error) {
            shared_1.Logger.warn("Failed to get mempool info:", error);
            return {
                size: 0,
                bytes: 0,
                usage: 0,
                maxmempool: constants_1.BLOCKCHAIN_CONSTANTS.MAX_MEMPOOL_SIZE,
                mempoolminfee: constants_1.BLOCKCHAIN_CONSTANTS.MIN_RELAY_TX_FEE,
            };
        }
    }
    getLocalServices() {
        const services = [];
        if (this.configService.get("NETWORK_NODE"))
            services.push("NODE_NETWORK");
        if (this.configService.get("NETWORK_BLOOM"))
            services.push("NODE_BLOOM");
        if (this.configService.get("NETWORK_WITNESS"))
            services.push("NODE_WITNESS");
        if (this.configService.get("NETWORK_COMPACT"))
            services.push("NODE_COMPACT_FILTERS");
        return services;
    }
    getLocalAddresses() {
        try {
            return (this.configService.get("LOCAL_ADDRESSES")?.split(",") || []);
        }
        catch (error) {
            shared_1.Logger.warn("Failed to get local addresses:", error);
            return [];
        }
    }
    getNetworkWarnings() {
        const warnings = [];
        // Check for version updates
        if (this.isVersionOutdated()) {
            warnings.push("WARNING: Client version is outdated. Please upgrade.");
        }
        // Check network health
        if (this.peers.size < constants_1.BLOCKCHAIN_CONSTANTS.MIN_PEERS) {
            warnings.push("WARNING: Low peer count. Network connectivity may be limited.");
        }
        // Check sync status
        if (!this.isSynced()) {
            warnings.push("WARNING: Node is not fully synced with the network.");
        }
        return warnings.join(" ");
    }
    isVersionOutdated() {
        try {
            const currentVersion = parseFloat(constants_1.BLOCKCHAIN_CONSTANTS.VERSION.toString());
            const latestVersion = parseFloat(this.configService.get("LATEST_VERSION"));
            return currentVersion < latestVersion;
        }
        catch (error) {
            shared_1.Logger.warn("Failed to check version:", error);
            return false;
        }
    }
    async isSynced() {
        try {
            return (!this.blockchain.isInitialBlockDownload() &&
                (await this.blockchain.getVerificationProgress()) >= 0.99);
        }
        catch (error) {
            shared_1.Logger.warn("Failed to check sync status:", error);
            return false;
        }
    }
}
exports.NetworkStats = NetworkStats;
NetworkStats.MAX_PROPAGATION_TIMES = 50;
NetworkStats.MIN_HASH_RATE = 0;
NetworkStats.MAX_LATENCY = 5000; // 5 seconds
NetworkStats.MIN_LATENCY = 0;
NetworkStats.MAX_PEERS = 100;
NetworkStats.PEER_EVENTS = ["disconnect", "error", "ban"];
NetworkStats.DEFAULT_LATENCY = 0;
NetworkStats.MAX_SAMPLE_SIZE = 1000;
NetworkStats.VALID_EVENTS = new Set([
    "disconnect",
    "error",
    "ban",
    "timeout",
    "message",
    "sync",
]);
NetworkStats.DEFAULT_PROPAGATION_TIME = 0;
NetworkStats.OUTLIER_THRESHOLD = 3; // Standard deviations
NetworkStats.DISCOVERY_INTERVAL = 30000; // 30 seconds
NetworkStats.PEER_TIMEOUT = 120000; // 2 minutes
NetworkStats.MAX_SCORE = 100;
NetworkStats.MIN_SCORE = -100;
NetworkStats.SCORE_DECAY = 0.95;
// Add validation constants
NetworkStats.MIN_DIFFICULTY = 1;
NetworkStats.MAX_DIFFICULTY = Number.MAX_SAFE_INTEGER;
NetworkStats.MIN_PROPAGATION_TIME = 0;
NetworkStats.MAX_PROPAGATION_TIME = 30000; // 30 seconds
//# sourceMappingURL=network-stats.js.map