"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeerDiscovery = exports.PeerType = exports.DiscoveryState = void 0;
const events_1 = require("events");
const peer_1 = require("./peer");
const rateLimit_1 = require("../security/rateLimit");
const cache_1 = require("../scaling/cache");
const audit_1 = require("../security/audit");
const fileAuditStorage_1 = require("../security/fileAuditStorage");
const peer_model_1 = require("../models/peer.model");
const shared_1 = require("@h3tag-blockchain/shared");
const discovery_error_1 = require("./discovery-error");
var DiscoveryState;
(function (DiscoveryState) {
    DiscoveryState["INITIALIZING"] = "INITIALIZING";
    DiscoveryState["ACTIVE"] = "ACTIVE";
    DiscoveryState["SYNCING"] = "SYNCING";
    DiscoveryState["ERROR"] = "ERROR";
})(DiscoveryState = exports.DiscoveryState || (exports.DiscoveryState = {}));
var PeerType;
(function (PeerType) {
    PeerType["MINER"] = "miner";
    PeerType["FULL_NODE"] = "full_node";
    PeerType["LIGHT_NODE"] = "light_node";
    PeerType["VALIDATOR"] = "validator";
})(PeerType = exports.PeerType || (exports.PeerType = {}));
class PeerDiscovery {
    constructor(config, mempool, utxoSet) {
        this.statePromise = Promise.resolve();
        this.banThreshold = 100;
        this.eventEmitter = new events_1.EventEmitter();
        this.config = config;
        this.mempool = mempool;
        this.utxoSet = utxoSet;
        this.state = DiscoveryState.INITIALIZING;
        this.peers = new Map();
        this.miners = new Set();
        this.bannedPeers = new Map();
        this.peerScores = new Map();
        this.peerAddresses = new Map();
        this.dnsSeeds = this.config.get("network.dnsSeeds") || [];
        this.rateLimit = new rateLimit_1.RateLimit({
            windowMs: 60000,
            maxRequests: {
                pow: 200,
                qudraticVote: 150,
                default: 100,
            },
            keyPrefix: "peer_discovery:",
        }, new audit_1.AuditManager(new fileAuditStorage_1.FileAuditStorage()));
        this.peerCache = new cache_1.Cache({
            ttl: PeerDiscovery.PEER_CACHE_TTL,
            checkPeriod: 600,
        });
        // Add feeler connection interval for testing new peers
        this.feelerInterval = setInterval(() => this.attemptFeelerConnection(), 120000);
        // Set up message handling for each peer
        this.peers.forEach(peer => {
            peer.eventEmitter.on('message', (message) => {
                this.processMessage(message).catch(error => {
                    shared_1.Logger.error('Error processing peer message:', error);
                });
            });
        });
        this.initializeDiscovery().catch((error) => {
            shared_1.Logger.error("Discovery initialization failed:", error);
            this.state = DiscoveryState.ERROR;
            throw new discovery_error_1.DiscoveryError("Failed to initialize peer discovery", "INIT_FAILED");
        });
    }
    async initializeDiscovery() {
        try {
            await this.setState(DiscoveryState.INITIALIZING);
            // First try to load cached peers
            await this.loadCachedPeers();
            // If we don't have enough peers, query DNS seeds
            if (this.peers.size < this.getTargetOutbound()) {
                await this.queryDnsSeeds();
            }
            // Start periodic peer discovery
            this.discoveryInterval = setInterval(() => this.managePeerConnections(), PeerDiscovery.DISCOVERY_INTERVAL);
            await this.setState(DiscoveryState.ACTIVE);
        }
        catch (error) {
            await this.setState(DiscoveryState.ERROR);
            throw error;
        }
    }
    async queryDnsSeeds() {
        for (const seed of this.dnsSeeds) {
            try {
                const addresses = await this.resolveDnsSeed(seed);
                addresses.forEach(addr => {
                    this.addPeerAddress({
                        url: addr,
                        timestamp: Date.now(),
                        services: 0,
                        attempts: 0,
                        lastSuccess: 0,
                        lastAttempt: 0,
                        banScore: 0
                    });
                });
            }
            catch (error) {
                shared_1.Logger.warn(`Failed to query DNS seed ${seed}:`, error);
            }
        }
    }
    async managePeerConnections() {
        const targetConnections = this.getTargetOutbound();
        // Remove excess connections
        while (this.peers.size > targetConnections) {
            const [oldestPeer] = this.peers.entries().next().value;
            await this.removePeer(oldestPeer);
        }
        // Add new connections if needed
        while (this.peers.size < targetConnections) {
            const candidate = this.selectPeerCandidate();
            if (!candidate)
                break;
            try {
                await this.connectToPeer(candidate.url);
                this.updatePeerScore(candidate.url, 1);
            }
            catch (error) {
                this.updatePeerScore(candidate.url, -1);
            }
        }
    }
    updatePeerScore(url, score) {
        const peerAddr = this.peerAddresses.get(url);
        if (peerAddr) {
            peerAddr.banScore += score;
            // Ban peer if score exceeds threshold
            if (peerAddr.banScore >= this.banThreshold) {
                this.bannedPeers.set(url, Date.now() + PeerDiscovery.BAN_DURATION);
                this.peerAddresses.delete(url);
            }
        }
    }
    selectPeerCandidate() {
        const candidates = Array.from(this.peerAddresses.values())
            .filter(addr => !this.peers.has(addr.url) &&
            !this.bannedPeers.has(addr.url))
            .sort((a, b) => {
            // Prefer peers that have succeeded recently
            if (a.lastSuccess && !b.lastSuccess)
                return -1;
            if (!a.lastSuccess && b.lastSuccess)
                return 1;
            // Then prefer peers with fewer attempts
            return a.attempts - b.attempts;
        });
        return candidates[0] || null;
    }
    async loadCachedPeers() {
        const cachedPeers = this.peerCache.getAll();
        const connectPromises = cachedPeers
            .filter((peerInfo) => this.isValidPeer(peerInfo))
            .map((peerInfo) => this.connectToPeer(peerInfo.url));
        await Promise.allSettled(connectPromises);
    }
    async connectToSeedNodes() {
        const seedNodes = this.config.get("SEED_NODES")?.split(",") || [];
        const connectPromises = seedNodes
            .filter((node) => !this.peers.has(node) && !this.bannedPeers.has(node))
            .map((node) => this.connectToPeer(node));
        await Promise.allSettled(connectPromises);
    }
    async discoverPeers() {
        if (this.state !== DiscoveryState.ACTIVE) {
            return;
        }
        try {
            await this.setState(DiscoveryState.SYNCING);
            const minPeers = parseInt(this.config.get("MIN_PEERS") || "10");
            if (this.peers.size < minPeers) {
                shared_1.Logger.info(`Discovering new peers (current: ${this.peers.size}, min: ${minPeers})`);
                await this.requestNewPeers();
            }
            await this.updatePeerTypes();
            await this.setState(DiscoveryState.ACTIVE);
        }
        catch (error) {
            await this.setState(DiscoveryState.ERROR);
            this.eventEmitter.emit("discovery_error", error);
        }
    }
    async requestNewPeers() {
        if (!this.rateLimit.checkLimit("peer_discovery")) {
            return;
        }
        const selectedPeers = Array.from(this.peers.values())
            .sort(() => Math.random() - 0.5)
            .slice(0, 3); // Only query 3 random peers at a time
        const discoveryPromises = selectedPeers.map((peer) => this.requestPeers(peer));
        const results = await Promise.allSettled(discoveryPromises);
        const newPeers = results
            .filter((result) => result.status === "fulfilled")
            .map((result) => result.value)
            .flat();
        await this.connectToNewPeers(newPeers);
    }
    async updatePeerTypes() {
        const updatePromises = Array.from(this.peers.values()).map(async (peer) => {
            try {
                const info = await peer.getNodeInfo();
                const url = peer.getInfo().url;
                // Check TAG requirements for miners
                const isValidMiner = info.isMiner &&
                    info.tagInfo.minedBlocks >= 1 &&
                    BigInt(info.tagInfo.votingPower) >= BigInt(1000) &&
                    info.tagInfo.voteParticipation >= 0.1;
                if (isValidMiner) {
                    this.miners.add(url);
                    shared_1.Logger.debug(`Added TAG miner: ${url}, blocks: ${info.tagInfo.minedBlocks}`);
                }
                else {
                    this.miners.delete(url);
                }
                // Update peer metrics
                this.peerScores.set(url, (this.peerScores.get(url) || 0) + (isValidMiner ? 2 : 1));
            }
            catch (error) {
                const url = peer.getInfo().url;
                shared_1.Logger.warn(`Failed to update peer type for ${url}:`, error);
                this.peerScores.set(url, (this.peerScores.get(url) || 0) - 1);
                this.miners.delete(url);
            }
        });
        await Promise.allSettled(updatePromises);
    }
    async cleanup() {
        this.cleanupOldPeers();
        this.cleanupBannedPeers();
        this.cleanupResources();
    }
    cleanupOldPeers() {
        const now = Date.now();
        for (const [url, peer] of this.peers.entries()) {
            if (now - peer.getInfo().lastSeen > PeerDiscovery.MAX_PEER_AGE) {
                this.removePeer(url);
            }
        }
    }
    cleanupBannedPeers() {
        const now = Date.now();
        for (const [url, banExpiry] of this.bannedPeers.entries()) {
            if (now > banExpiry) {
                this.bannedPeers.delete(url);
            }
        }
    }
    cleanupResources() {
        // Only clear expired entries
        this.peerCache.clear(true);
        // Remove low-scoring peers
        for (const [url, score] of this.peerScores.entries()) {
            if (score < 0) {
                this.removePeer(url);
            }
        }
        // Limit total connections
        const maxPeers = parseInt(this.config.get("MAX_PEERS") || "50");
        if (this.peers.size > maxPeers) {
            const excessPeers = Array.from(this.peers.keys()).slice(maxPeers);
            excessPeers.forEach((url) => this.removePeer(url));
        }
    }
    getPeersByType(type) {
        switch (type) {
            case PeerType.MINER:
                return Array.from(this.miners);
            default:
                return Array.from(this.peers.keys());
        }
    }
    async shutdown() {
        try {
            await this.setState(DiscoveryState.INITIALIZING);
            clearInterval(this.discoveryInterval);
            clearInterval(this.cleanupInterval);
            clearInterval(this.feelerInterval);
            const disconnectPromises = Array.from(this.peers.values()).map((peer) => peer.disconnect());
            await Promise.allSettled(disconnectPromises);
            this.peers.clear();
            this.miners.clear();
            this.bannedPeers.clear();
            this.peerCache.clear();
            shared_1.Logger.info("Peer discovery shutdown complete");
        }
        catch (error) {
            await this.setState(DiscoveryState.ERROR);
            throw new discovery_error_1.DiscoveryError("Shutdown failed", "SHUTDOWN_ERROR");
        }
    }
    isValidPeer(peerInfo) {
        const now = Date.now();
        return (peerInfo.url &&
            peerInfo.lastSeen > now - PeerDiscovery.MAX_PEER_AGE &&
            !this.bannedPeers.has(peerInfo.url) &&
            !this.peers.has(peerInfo.url));
    }
    async connectToPeer(url, retryCount = 0) {
        try {
            const [address, portStr] = url.split(':');
            if (!address || !portStr) {
                throw new Error(`Invalid peer URL: ${url}`);
            }
            const port = parseInt(portStr);
            if (isNaN(port) || port <= 0 || port > 65535) {
                throw new Error(`Invalid port number: ${portStr}`);
            }
            const peer = new peer_1.Peer(address, port, {}, // config
            this.config, // configService
            this.database);
            await peer.connect();
            // Set up message handling for the new peer
            peer.eventEmitter.on('message', (message) => {
                this.processMessage(message).catch(error => {
                    shared_1.Logger.error('Error processing peer message:', error);
                });
            });
            this.peers.set(url, peer);
        }
        catch (error) {
            if (retryCount < PeerDiscovery.MAX_RECONNECT_ATTEMPTS) {
                await new Promise(resolve => setTimeout(resolve, PeerDiscovery.RECONNECT_DELAY));
                return this.connectToPeer(url, retryCount + 1);
            }
            throw error;
        }
    }
    async requestPeers(peer) {
        try {
            const peerList = await peer.getPeers();
            return peerList.map((p) => p.url);
        }
        catch (error) {
            shared_1.Logger.warn(`Failed to get peers from ${peer.getInfo().url}:`, error);
            return [];
        }
    }
    async connectToNewPeers(peers) {
        const connectPromises = peers
            .filter((url) => !this.peers.has(url) && !this.bannedPeers.has(url))
            .map((url) => this.connectToPeer(url));
        await Promise.allSettled(connectPromises);
    }
    async removePeer(url) {
        const peer = this.peers.get(url);
        if (peer) {
            peer.disconnect();
            this.peers.delete(url);
            this.miners.delete(url);
            this.peerCache.delete(url);
            shared_1.Logger.info(`Removed peer: ${url}`);
        }
    }
    async setState(newState) {
        this.statePromise = this.statePromise.then(async () => {
            const oldState = this.state;
            this.state = newState;
            shared_1.Logger.info(`Discovery state changed: ${oldState} -> ${newState}`);
            this.eventEmitter.emit("stateChange", { old: oldState, new: newState });
            if (newState === DiscoveryState.ERROR) {
                await this.cleanup();
            }
        });
        await this.statePromise;
    }
    async attemptFeelerConnection() {
        const candidate = this.selectPeerCandidate();
        if (candidate) {
            try {
                await this.connectToPeer(candidate.url);
                this.updatePeerScore(candidate.url, 1);
            }
            catch (error) {
                this.updatePeerScore(candidate.url, -1);
            }
        }
    }
    getTargetOutbound() {
        return parseInt(this.config.get("network.maxPeers")) || 8;
    }
    async resolveDnsSeed(seed) {
        try {
            const dns = require('dns');
            const addresses = await new Promise((resolve, reject) => {
                dns.resolve(seed, (err, addresses) => {
                    if (err)
                        reject(err);
                    else
                        resolve(addresses);
                });
            });
            return addresses.filter(addr => this.isValidAddress(addr));
        }
        catch (error) {
            shared_1.Logger.warn(`DNS resolution failed for ${seed}:`, error);
            return [];
        }
    }
    isValidAddress(address) {
        try {
            // Check if address is empty or too long
            if (!address || address.length > 45)
                return false;
            // IPv4 validation
            if (address.includes('.')) {
                const parts = address.split('.');
                if (parts.length !== 4)
                    return false;
                return parts.every(part => {
                    const num = parseInt(part);
                    return !isNaN(num) &&
                        num >= 0 &&
                        num <= 255 &&
                        part === num.toString(); // Ensures no leading zeros
                });
            }
            // IPv6 validation
            if (address.includes(':')) {
                // Remove IPv6 zone index if present
                const zoneIndex = address.indexOf('%');
                if (zoneIndex !== -1) {
                    address = address.substring(0, zoneIndex);
                }
                const parts = address.split(':');
                if (parts.length > 8)
                    return false;
                // Handle :: compression
                const emptyGroupsCount = parts.filter(p => p === '').length;
                if (emptyGroupsCount > 1 && !(emptyGroupsCount === 2 && parts[0] === '' && parts[1] === '')) {
                    return false;
                }
                // Validate each hextet
                return parts.every(part => {
                    if (part === '')
                        return true; // Allow empty parts for ::
                    if (part.length > 4)
                        return false;
                    const num = parseInt(part, 16);
                    return !isNaN(num) && num >= 0 && num <= 0xffff;
                });
            }
            return false; // Neither IPv4 nor IPv6
        }
        catch {
            return false;
        }
    }
    addPeerAddress(address) {
        if (!this.peerAddresses.has(address.url)) {
            this.peerAddresses.set(address.url, address);
        }
    }
    async processMessage(message) {
        try {
            switch (message.type) {
                case peer_model_1.PeerMessageType.VERSION:
                    await this.handleVersion(message.payload);
                    break;
                case peer_model_1.PeerMessageType.ADDR:
                    await this.handleAddr(message.payload);
                    break;
                case peer_model_1.PeerMessageType.INV:
                    await this.handleInventory(message.payload);
                    break;
                default:
                    shared_1.Logger.debug(`Unhandled message type: ${message.type}`);
            }
        }
        catch (error) {
            shared_1.Logger.error(`Error processing message ${message.type}:`, error);
        }
    }
    async handleVersion(payload) {
        try {
            const { version, services, timestamp } = payload;
            shared_1.Logger.debug(`Received version message: v${version}, services: ${services}`);
            // Additional version handling logic here
        }
        catch (error) {
            shared_1.Logger.error('Error handling version message:', error);
        }
    }
    async handleAddr(payload) {
        try {
            const addresses = payload.addresses || [];
            for (const addr of addresses) {
                this.addPeerAddress({
                    url: addr.url,
                    timestamp: Date.now(),
                    services: addr.services || 0,
                    attempts: 0,
                    lastSuccess: 0,
                    lastAttempt: 0,
                    banScore: 0
                });
            }
        }
        catch (error) {
            shared_1.Logger.error('Error handling addr message:', error);
        }
    }
    async handleInventory(payload) {
        try {
            // Handle inventory announcements (new blocks, transactions, etc)
            shared_1.Logger.debug('Received inventory message:', payload);
            this.eventEmitter.emit('inventory', payload);
        }
        catch (error) {
            shared_1.Logger.error('Error handling inventory message:', error);
        }
    }
}
exports.PeerDiscovery = PeerDiscovery;
PeerDiscovery.DISCOVERY_INTERVAL = 30000;
PeerDiscovery.CLEANUP_INTERVAL = 300000;
PeerDiscovery.PEER_CACHE_TTL = 3600;
PeerDiscovery.BAN_DURATION = 24 * 60 * 60 * 1000;
PeerDiscovery.MAX_PEER_AGE = 3 * 24 * 60 * 60 * 1000;
PeerDiscovery.MAX_RECONNECT_ATTEMPTS = 3;
PeerDiscovery.RECONNECT_DELAY = 5000;
//# sourceMappingURL=discovery.js.map