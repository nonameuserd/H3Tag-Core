"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DNSSeeder = exports.DNSSeederError = exports.NetworkType = void 0;
const dns_1 = __importDefault(require("dns"));
const util_1 = require("util");
const shared_1 = require("@h3tag-blockchain/shared");
const async_mutex_1 = require("async-mutex");
const events_1 = require("events");
const cache_1 = require("../scaling/cache");
const metrics_collector_1 = require("../monitoring/metrics-collector");
const circuit_breaker_1 = require("../network/circuit-breaker");
var NetworkType;
(function (NetworkType) {
    NetworkType["MAINNET"] = "mainnet";
    NetworkType["TESTNET"] = "testnet";
    NetworkType["DEVNET"] = "devnet";
})(NetworkType || (exports.NetworkType = NetworkType = {}));
class DNSSeederError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "DNSSeederError";
    }
}
exports.DNSSeederError = DNSSeederError;
class DNSSeeder extends events_1.EventEmitter {
    constructor(configService, db, config) {
        super();
        this.configService = configService;
        this.db = db;
        this.resolve4Async = (0, util_1.promisify)(dns_1.default.resolve4);
        this.resolve6Async = (0, util_1.promisify)(dns_1.default.resolve6);
        this.lookupAsync = (0, util_1.promisify)(dns_1.default.lookup);
        this.mutex = new async_mutex_1.Mutex();
        this.isRunning = false;
        this.config = {
            networkType: NetworkType.MAINNET,
            minPeers: 10,
            maxPeers: 100,
            port: 3000,
            timeout: 5000,
            retryDelay: 1000,
            maxRetries: 3,
            cacheExpiry: 3600000, // 1 hour
            requiredServices: 1, // NODE_NETWORK
            banThreshold: 5,
            seedRanking: true,
            ...config,
        };
        this.seedDomains = this.loadSeeds();
        this.activeSeeds = new Set();
        this.seedCache = new cache_1.Cache({
            ttl: this.config.cacheExpiry,
            maxSize: 1000,
            onEvict: (key, value) => this.handleCacheEviction(key, value),
        });
        this.metrics = new metrics_collector_1.MetricsCollector("dns_seeder");
        this.circuitBreaker = new circuit_breaker_1.CircuitBreaker({
            failureThreshold: 5,
            resetTimeout: 30000,
        });
    }
    async start() {
        if (this.isRunning)
            return;
        try {
            this.isRunning = true;
            await this.loadCachedSeeds();
            await this.startDiscovery();
            this.discoveryTimer = setInterval(() => {
                this.startDiscovery().catch((error) => shared_1.Logger.error("Discovery failed:", error));
            }, this.config.cacheExpiry / 2);
        }
        catch (error) {
            this.isRunning = false;
            throw error;
        }
    }
    async stop() {
        this.isRunning = false;
        const timer = this.discoveryTimer;
        this.discoveryTimer = undefined;
        if (timer) {
            clearInterval(timer);
        }
        try {
            await this.saveSeedsToCache();
        }
        catch (error) {
            shared_1.Logger.error("Failed to save seeds:", error);
            throw error;
        }
    }
    async loadCachedSeeds() {
        try {
            const cached = await this.db.getSeeds();
            cached.forEach((seed) => {
                if (this.isValidSeed(seed)) {
                    this.seedCache.set(seed.address, seed);
                }
            });
        }
        catch (error) {
            shared_1.Logger.error("Failed to load cached seeds:", error);
        }
    }
    async saveSeedsToCache() {
        try {
            const seeds = Array.from(this.seedCache.entries());
            await this.db.saveSeeds(seeds);
        }
        catch (error) {
            shared_1.Logger.error("Failed to save seeds to cache:", error);
        }
    }
    async discoverPeers() {
        const release = await this.mutex.acquire();
        try {
            if (this.circuitBreaker.isOpen()) {
                throw new DNSSeederError("Circuit breaker is open", "CIRCUIT_OPEN");
            }
            const startTime = Date.now();
            const peers = await this.resolvePeers(this.seedDomains);
            this.metrics.histogram("discovery_time", Date.now() - startTime);
            this.metrics.gauge("active_peers", peers.length);
            return this.formatPeerUrls(peers);
        }
        catch (error) {
            this.circuitBreaker.recordFailure();
            throw error;
        }
        finally {
            release();
        }
    }
    async resolvePeers(seeds) {
        const uniquePeers = new Set();
        const promises = [];
        for (const seed of seeds) {
            if (this.activeSeeds.has(seed))
                continue;
            promises.push((async () => {
                const release = await this.mutex.acquire();
                try {
                    this.activeSeeds.add(seed);
                    const startTime = Date.now();
                    const addresses = await this.resolveWithRetry(seed);
                    const latency = Date.now() - startTime;
                    this.updateSeedMetrics(seed, addresses.length, latency);
                    addresses.forEach((addr) => uniquePeers.add(addr));
                }
                catch (error) {
                    this.handleSeedFailure(seed, error);
                }
                finally {
                    this.activeSeeds.delete(seed);
                    release();
                }
            })());
        }
        await Promise.allSettled(promises);
        return this.rankPeers(Array.from(uniquePeers));
    }
    async resolveWithRetry(seed, retryCount = 0) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new DNSSeederError("DNS timeout", "DNS_TIMEOUT")), this.config.timeout);
        });
        try {
            const results = await Promise.race([
                Promise.all([
                    this.resolve4Async(seed),
                    this.resolve6Async(seed).catch(() => []),
                    this.lookupAsync(seed)
                        .then((result) => [result.address])
                        .catch(() => []),
                ]),
                timeoutPromise,
            ]);
            const [ipv4Addresses, ipv6Addresses, lookupResult] = results;
            const uniqueAddresses = new Set([
                ...ipv4Addresses,
                ...ipv6Addresses,
                ...lookupResult,
            ]);
            return Array.from(uniqueAddresses);
        }
        catch (error) {
            if (retryCount < this.config.maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
                return this.resolveWithRetry(seed, retryCount + 1);
            }
            throw error;
        }
    }
    rankPeers(peers) {
        if (!this.config.seedRanking) {
            return peers.slice(0, this.config.maxPeers);
        }
        return peers
            .map((peer) => ({
            address: peer,
            score: this.calculatePeerScore(peer),
        }))
            .sort((a, b) => b.score - a.score)
            .slice(0, this.config.maxPeers)
            .map((p) => p.address);
    }
    calculatePeerScore(peer) {
        const info = this.seedCache.get(peer);
        if (!info)
            return 0;
        let score = 100;
        // Reduce score based on failures
        score -= info.failures * 10;
        // Prefer peers with lower latency
        score -= Math.floor(info.latency / 100);
        // Prefer peers seen recently
        const hoursSinceLastSeen = (Date.now() - info.lastSeen) / 3600000;
        score -= Math.floor(hoursSinceLastSeen * 2);
        return Math.max(0, score);
    }
    updateSeedMetrics(seed, addressCount, latency) {
        const info = this.seedCache.get(seed) || {
            address: seed,
            services: this.config.requiredServices,
            lastSeen: 0,
            attempts: 0,
            failures: 0,
            latency: 0,
            score: 0,
        };
        info.lastSeen = Date.now();
        info.attempts++;
        info.latency = (info.latency + latency) / 2;
        this.seedCache.set(seed, info);
        this.metrics.gauge(`seed_latency_${seed}`, latency);
        this.metrics.gauge(`seed_addresses_${seed}`, addressCount);
    }
    handleSeedFailure(seed, error) {
        const info = this.seedCache.get(seed);
        if (info) {
            info.failures++;
            if (info.failures >= this.config.banThreshold) {
                this.seedCache.delete(seed);
                shared_1.Logger.warn(`Banned seed ${seed} due to excessive failures`);
            }
            else {
                this.seedCache.set(seed, info);
            }
        }
        shared_1.Logger.error(`Seed ${seed} failed:`, error);
        this.metrics.increment(`seed_failures_${seed}`);
    }
    handleCacheEviction(key, value) {
        this.metrics.increment("cache_evictions");
        shared_1.Logger.debug(`Evicted seed ${key} from cache`, value);
    }
    isValidSeed(seed) {
        return (seed &&
            typeof seed.address === "string" &&
            typeof seed.services === "number" &&
            seed.services >= this.config.requiredServices &&
            seed.failures < this.config.banThreshold);
    }
    formatPeerUrls(peers) {
        return peers
            .filter((ip) => this.isValidIpAddress(ip))
            .map((ip) => `https://${ip}:${this.config.port}`);
    }
    isValidIpAddress(ip) {
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip))
            return false;
        if (ipv4Regex.test(ip)) {
            const parts = ip.split(".").map(Number);
            return parts.every((part) => part >= 0 && part <= 255);
        }
        return true; // IPv6 format already validated by regex
    }
    getActiveSeedCount() {
        return this.activeSeeds.size;
    }
    getSeedCount() {
        return this.seedDomains.length;
    }
    getCachedPeerCount() {
        return this.seedCache.size();
    }
    loadSeeds() {
        const seeds = this.configService.get(`${this.config.networkType.toUpperCase()}_SEEDS`)?.split(",") || [];
        return this.validateSeeds(seeds);
    }
    validateSeeds(seeds) {
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
        return seeds.filter((seed) => {
            if (!seed || typeof seed !== "string") {
                shared_1.Logger.warn(`Invalid seed value: ${seed}`);
                return false;
            }
            if (!domainRegex.test(seed)) {
                shared_1.Logger.warn(`Invalid seed domain: ${seed}`);
                return false;
            }
            return true;
        });
    }
    async startDiscovery() {
        try {
            await this.discoverPeers();
        }
        catch (error) {
            shared_1.Logger.error("Discovery failed:", error);
        }
    }
    getPowNodeCount() {
        return Array.from(this.seedCache.values()).filter((seed) => (seed.services & 1) === 1).length;
    }
    getVotingNodeCount() {
        return Array.from(this.seedCache.values()).filter((seed) => (seed.services & 2) === 2).length;
    }
    getNetworkHashrate() {
        return Array.from(this.seedCache.values()).reduce((total, seed) => total + (seed.services & 4 ? 1 : 0), 0);
    }
    async getTagHolderCount() {
        return this.db.getTagHolderCount();
    }
    async getTagDistribution() {
        return this.db.getTagDistribution();
    }
    async dispose() {
        try {
            this.isRunning = false;
            if (this.discoveryTimer) {
                clearInterval(this.discoveryTimer);
                this.discoveryTimer = undefined;
            }
            await this.saveSeedsToCache();
            this.removeAllListeners();
            await this.circuitBreaker.reset();
        }
        catch (error) {
            shared_1.Logger.error("Failed to dispose DNS seeder:", error);
            throw error;
        }
    }
}
exports.DNSSeeder = DNSSeeder;
