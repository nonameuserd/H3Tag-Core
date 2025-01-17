"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainSync = exports.SyncError = exports.SyncState = void 0;
const events_1 = require("events");
const peer_model_1 = require("../models/peer.model");
const vote_processor_1 = require("../wasm/vote-processor");
const shared_1 = require("@h3tag-blockchain/shared");
const constants_1 = require("../blockchain/utils/constants");
const async_mutex_1 = require("async-mutex");
var SyncState;
(function (SyncState) {
    SyncState["IDLE"] = "IDLE";
    SyncState["SYNCING"] = "SYNCING";
    SyncState["SYNCED"] = "SYNCED";
    SyncState["ERROR"] = "ERROR";
})(SyncState = exports.SyncState || (exports.SyncState = {}));
class SyncError extends Error {
    constructor(message) {
        super(message);
        this.name = "SyncError";
    }
}
exports.SyncError = SyncError;
class BlockchainSync {
    constructor(blockchain, mempool, peers, consensusPublicKey, db) {
        this.consensusPublicKey = consensusPublicKey;
        this.db = db;
        this.eventEmitter = new events_1.EventEmitter();
        this.syncStats = {
            startTime: 0,
            endTime: 0,
            blocksProcessed: 0,
            votesProcessed: 0,
            failedAttempts: 0,
        };
        this.headerSync = {
            startHeight: 0,
            currentHeight: 0,
            targetHeight: 0,
            headers: new Map(),
            pendingRequests: new Set(),
            clear() {
                this.headers.clear();
                this.pendingRequests.clear();
            },
        };
        this.mutex = new async_mutex_1.Mutex();
        this.blockchain = blockchain;
        this.mempool = mempool;
        this.peers = peers;
        this.state = SyncState.IDLE;
        this.lastSyncHeight = 0;
        this.retryAttempts = 0;
        this.consensusPublicKey = consensusPublicKey;
        this.currentEpoch = 0;
        this.setupEventListeners();
        this.startPeriodicSync();
    }
    setupEventListeners() {
        this.peers.forEach((peer) => this.setupPeerListeners(peer));
    }
    setupPeerListeners(peer) {
        peer.eventEmitter.on("new_block", async (block) => {
            try {
                await this.handleNewBlock(block, peer);
            }
            catch (error) {
                shared_1.Logger.error(`Error handling new block from peer ${(await peer.getInfo()).url}:`, error);
                this.eventEmitter.emit("sync_error", error);
            }
        });
        peer.eventEmitter.on("new_transaction", async (transaction) => {
            try {
                await this.handleNewTransaction(transaction, peer);
            }
            catch (error) {
                shared_1.Logger.error(`Error handling new transaction from peer ${(await peer.getInfo()).url}:`, error);
                this.eventEmitter.emit("sync_error", error);
            }
        });
        peer.eventEmitter.on("disconnect", () => {
            if (peer === this.syncingPeer) {
                this.handleSyncingPeerDisconnect();
            }
        });
    }
    async handleSyncingPeerDisconnect() {
        shared_1.Logger.warn("Syncing peer disconnected, attempting to find new peer");
        this.syncingPeer = undefined;
        if (this.state === SyncState.SYNCING) {
            await this.startSync();
        }
    }
    startPeriodicSync() {
        setInterval(() => {
            if (this.state === SyncState.IDLE) {
                this.checkSync().catch((error) => {
                    shared_1.Logger.error("Periodic sync check failed:", error);
                });
            }
        }, BlockchainSync.SYNC_CHECK_INTERVAL);
    }
    async startSync() {
        this.syncStats = {
            startTime: Date.now(),
            endTime: 0,
            blocksProcessed: 0,
            votesProcessed: 0,
            failedAttempts: 0,
        };
        if (this.state === SyncState.SYNCING) {
            return;
        }
        try {
            this.state = SyncState.SYNCING;
            this.eventEmitter.emit("sync_started", {
                currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
                timestamp: Date.now(),
            });
            shared_1.Logger.info(`Starting ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NAME} blockchain synchronization`);
            const bestPeer = await this.selectBestPeer();
            if (!bestPeer) {
                throw new SyncError(`No suitable peers for ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} synchronization`);
            }
            this.syncingPeer = bestPeer;
            this.setupSyncTimeout();
            await this.synchronize(bestPeer);
            this.state = SyncState.SYNCED;
            this.clearSyncTimeout();
            this.eventEmitter.emit("sync_completed", {
                currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
                timestamp: Date.now(),
            });
            shared_1.Logger.info(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NAME} blockchain synchronization completed`);
        }
        catch (error) {
            this.syncStats.failedAttempts++;
            this.syncStats.endTime = Date.now();
            this.handleSyncError(error);
        }
    }
    setupSyncTimeout() {
        this.clearSyncTimeout();
        this.syncTimeout = setTimeout(() => {
            this.handleSyncTimeout();
        }, BlockchainSync.SYNC_TIMEOUT);
    }
    clearSyncTimeout() {
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
            this.syncTimeout = undefined;
        }
    }
    handleSyncTimeout() {
        shared_1.Logger.error(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} sync timeout occurred`);
        this.state = SyncState.ERROR;
        this.eventEmitter.emit("sync_timeout", {
            currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
            timestamp: Date.now(),
        });
        this.handleSyncError(new SyncError(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} sync timeout`));
    }
    async handleSyncError(error) {
        this.state = SyncState.ERROR;
        this.eventEmitter.emit("sync_error", {
            error,
            currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
            timestamp: Date.now(),
        });
        shared_1.Logger.error(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NAME} blockchain synchronization failed:`, error);
        if (this.retryAttempts < BlockchainSync.MAX_RETRY_ATTEMPTS) {
            this.retryAttempts++;
            shared_1.Logger.info(`Retrying ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} sync (attempt ${this.retryAttempts})`);
            await this.startSync();
        }
        else {
            shared_1.Logger.error(`${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} sync: Max retry attempts reached`);
            this.eventEmitter.emit("sync_failed", {
                currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
                timestamp: Date.now(),
            });
        }
    }
    async selectBestPeer() {
        const connectedPeers = Array.from(this.peers.values()).filter((peer) => peer.isConnected() && !peer.isBanned());
        if (connectedPeers.length === 0) {
            return undefined;
        }
        // Add timeout to peer validation
        const validPeers = await Promise.race([
            Promise.all(connectedPeers.map(async (peer) => ({
                peer,
                isValid: await this.validatePeerBeforeSync(peer).catch(() => false),
            }))),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Peer validation timeout")), BlockchainSync.SYNC_TIMEOUTS.PEER_SELECTION)),
        ]);
        const validConnectedPeers = validPeers
            .filter(({ isValid }) => isValid)
            .map(({ peer }) => peer);
        const peersWithInfo = await Promise.all(validConnectedPeers.map(async (peer) => ({
            peer,
            info: await peer.getInfo()
        })));
        return peersWithInfo
            .sort((a, b) => {
            const heightDiff = b.info.height - a.info.height;
            if (heightDiff !== 0)
                return heightDiff;
            return a.info.latency - b.info.latency;
        })
            .map(({ peer }) => peer)[0];
    }
    async synchronize(peer) {
        let syncTimeout;
        try {
            syncTimeout = setTimeout(() => {
                throw new SyncError("Sync timeout");
            }, BlockchainSync.SYNC_TIMEOUT);
            await this.syncHeaders(peer);
            await this.syncBlocks(peer);
            await this.verifyChain();
        }
        catch (error) {
            shared_1.Logger.error("Synchronization failed:", error);
            throw new SyncError(`Sync failed: ${error.message}`);
        }
        finally {
            if (syncTimeout)
                clearTimeout(syncTimeout);
        }
    }
    async syncHeaders(peer) {
        const release = await this.mutex.acquire();
        try {
            const currentHeight = this.blockchain.getHeight();
            const targetHeight = (await peer.getInfo()).height;
            this.headerSync = {
                startHeight: currentHeight + 1,
                currentHeight: currentHeight + 1,
                targetHeight,
                headers: new Map(),
                pendingRequests: new Set(),
                clear() {
                    this.headers.clear();
                    this.pendingRequests.clear();
                },
            };
            shared_1.Logger.info(`Starting headers sync from ${currentHeight} to ${targetHeight}`);
            while (this.headerSync.currentHeight <= targetHeight) {
                const endHeight = Math.min(this.headerSync.currentHeight +
                    BlockchainSync.SYNC_PARAMETERS.HEADERS_BATCH_SIZE, targetHeight);
                try {
                    const headers = await this.requestHeadersWithRetry(peer, this.headerSync.currentHeight, endHeight);
                    if (!this.validateHeaders(headers)) {
                        // Rewind some headers on validation failure
                        this.rewindHeaders(BlockchainSync.SYNC_PARAMETERS.MAX_HEADERS_REWIND);
                        continue;
                    }
                    // Store valid headers
                    headers.forEach((header) => {
                        this.headerSync.headers.set(header.header.height, header);
                    });
                    this.headerSync.currentHeight = endHeight + 1;
                    this.emitSyncProgress(currentHeight, endHeight, targetHeight);
                }
                catch (error) {
                    shared_1.Logger.error(`Header sync failed at height ${this.headerSync.currentHeight}:`, error);
                    await this.handleSyncError(error);
                }
            }
        }
        finally {
            release();
        }
    }
    async syncBlocks(peer) {
        // Process blocks in parallel batches
        for (const [height, header] of this.headerSync.headers) {
            const batch = new Set();
            // Create batch of block requests
            for (let i = 0; i < BlockchainSync.SYNC_PARAMETERS.BLOCKS_BATCH_SIZE; i++) {
                const nextHeight = height + i;
                if (this.headerSync.headers.has(nextHeight)) {
                    batch.add(nextHeight);
                }
            }
            await this.downloadBlockBatch(peer, batch);
        }
    }
    async downloadBlockBatch(peer, heights) {
        const promises = Array.from(heights).map(async (height) => {
            try {
                const block = await this.requestBlockWithRetry(peer, height);
                await this.validateAndProcessBlock(block);
                this.syncStats.blocksProcessed++;
            }
            catch (error) {
                shared_1.Logger.error(`Failed to download block at height ${height}:`, error);
                throw error;
            }
        });
        await Promise.all(promises);
    }
    async validateAndProcessBlock(block) {
        // Verify block matches stored header
        const storedHeader = this.headerSync.headers.get(block.header.height);
        if (!storedHeader || storedHeader.header.hash !== block.header.hash) {
            throw new SyncError("Block does not match stored header");
        }
        await this.processBlock(block);
    }
    rewindHeaders(count) {
        const newHeight = Math.max(this.headerSync.startHeight, this.headerSync.currentHeight - count);
        // Remove headers after new height
        for (let h = this.headerSync.currentHeight; h > newHeight; h--) {
            this.headerSync.headers.delete(h);
        }
        this.headerSync.currentHeight = newHeight;
    }
    async processBlocksInParallel(blocks) {
        // Process blocks in batches to control memory usage
        for (let i = 0; i < blocks.length; i += BlockchainSync.MAX_PARALLEL_BLOCKS) {
            const batch = blocks.slice(i, i + BlockchainSync.MAX_PARALLEL_BLOCKS);
            await Promise.all(batch.map((block) => this.processBlock(block)));
        }
    }
    async processBlock(block) {
        try {
            await this.blockchain.addBlock(block);
            this.syncStats.blocksProcessed++;
            // Remove processed transactions from mempool
            for (const tx of block.transactions) {
                try {
                    this.mempool.removeTransaction(tx.id);
                }
                catch (error) {
                    shared_1.Logger.warn(`Failed to remove transaction ${tx.id} from mempool:`, error);
                }
            }
        }
        catch (error) {
            this.syncStats.failedAttempts++;
            shared_1.Logger.error(`Error processing block ${block.header.height}:`, error);
            throw new SyncError(`Failed to process block ${block.header.height}: ${error.message}`);
        }
    }
    emitSyncProgress(currentHeight, endHeight, targetHeight) {
        this.eventEmitter.emit("sync_progress", {
            currentHeight: endHeight,
            targetHeight,
            percentage: ((endHeight - currentHeight) / (targetHeight - currentHeight)) * 100,
            currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        });
    }
    async requestBlocks(peer, startHeight, endHeight) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new SyncError("Block request timeout"));
            }, BlockchainSync.SYNC_TIMEOUT);
            peer
                .request(peer_model_1.PeerMessageType.GET_BLOCKS, { startHeight, endHeight })
                .then((response) => {
                clearTimeout(timeout);
                if (!Array.isArray(response.blocks)) {
                    throw new SyncError("Invalid blocks response from peer");
                }
                resolve(response.blocks);
            })
                .catch(reject);
        });
    }
    async handleNewBlock(block, peer) {
        try {
            if (block.header.height > this.blockchain.getHeight() + 1) {
                await this.startSync();
                return;
            }
            await this.blockchain.addBlock(block);
            this.eventEmitter.emit("new_block", {
                block,
                currency: constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
                timestamp: Date.now(),
            });
            // Broadcast to other peers
            this.broadcastToPeers(peer_model_1.PeerMessageType.NEW_BLOCK, block, peer);
        }
        catch (error) {
            shared_1.Logger.error(`Error handling new ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} block:`, error);
            throw new SyncError(`Failed to handle new ${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} block: ${error.message}`);
        }
    }
    async handleNewTransaction(transaction, peer) {
        try {
            await this.mempool.addTransaction(transaction);
            this.eventEmitter.emit("new_transaction", transaction);
            // Broadcast to other peers
            this.broadcastToPeers(peer_model_1.PeerMessageType.NEW_TRANSACTION, transaction, peer);
        }
        catch (error) {
            shared_1.Logger.error(`Error handling new transaction:`, error);
        }
    }
    async broadcastToPeers(type, data, excludePeer) {
        const broadcastPromises = Array.from(this.peers.values())
            .filter((peer) => peer !== excludePeer && peer.isConnected())
            .map((peer) => peer.request(type, data).catch((error) => {
            shared_1.Logger.error(`Failed to broadcast to peer, error: ${error.message}`, error);
        }));
        await Promise.all(broadcastPromises);
    }
    getState() {
        return this.state;
    }
    async stop() {
        this.clearSyncTimeout();
        this.state = SyncState.IDLE;
        this.syncingPeer = undefined;
        this.eventEmitter.emit("sync_stopped");
    }
    async checkSync() {
        const bestPeer = await this.selectBestPeer();
        if (bestPeer && (await bestPeer.getInfo()).height > this.blockchain.getHeight()) {
            await this.startSync();
        }
    }
    async syncVotes(peer) {
        try {
            const response = await peer.request(peer_model_1.PeerMessageType.GET_VOTES, {
                fromHeight: this.lastSyncHeight,
                toHeight: (await this.syncingPeer?.getInfo()).height,
            });
            if (!Array.isArray(response.votes)) {
                throw new SyncError("Invalid votes response from peer");
            }
            // Process votes in parallel
            await Promise.all(response.votes.map(async (vote) => {
                try {
                    await this.processVote(vote);
                    await peer.recordVote();
                }
                catch (error) {
                    shared_1.Logger.error(`Error processing vote:`, error);
                }
            }));
        }
        catch (error) {
            shared_1.Logger.error("Vote sync failed:", error);
            throw new SyncError(`Failed to sync votes: ${error.message}`);
        }
    }
    async processVote(vote) {
        try {
            // Validate vote format
            if (!vote || !vote.signature || !vote.blockHash) {
                throw new SyncError("Invalid vote format");
            }
            // Use the WASM vote processor
            const voteProcessor = new vote_processor_1.WasmVoteProcessor();
            const voteData = {
                balance: vote.balance.toString() || "0",
                approved: vote.approve ? 1 : 0,
                voter: vote.voter,
            };
            const result = await voteProcessor.processVoteChunk([voteData]);
            if (result.approved > 0) {
                await this.blockchain.processVote(vote);
                this.eventEmitter.emit("vote_processed", {
                    blockHash: vote.blockHash,
                    timestamp: Date.now(),
                });
            }
        }
        catch (error) {
            shared_1.Logger.error("Failed to process vote:", error);
            throw new SyncError(`Vote processing failed: ${error.message}`);
        }
    }
    async dispose() {
        await this.stop();
        await this.blockchain.dispose();
    }
    async requestBlocksWithRetry(peer, startHeight, endHeight) {
        for (let attempt = 0; attempt < BlockchainSync.MAX_RETRIES.BLOCK_REQUEST; attempt++) {
            try {
                return await Promise.race([
                    peer.request(peer_model_1.PeerMessageType.GET_BLOCKS, { startHeight, endHeight }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), BlockchainSync.SYNC_TIMEOUTS.BLOCK_REQUEST)),
                ]);
            }
            catch (error) {
                if (attempt === BlockchainSync.MAX_RETRIES.BLOCK_REQUEST - 1)
                    throw error;
                await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
        throw new Error("Max retries exceeded");
    }
    async processBlocksInBatches(blocks) {
        for (let i = 0; i < blocks.length; i += BlockchainSync.BATCH_SIZES.BLOCKS) {
            const batch = blocks.slice(i, i + BlockchainSync.BATCH_SIZES.BLOCKS);
            await Promise.all(batch.map(async (block) => {
                try {
                    await this.blockchain.addBlock(block);
                    this.syncStats.blocksProcessed++;
                    this.emitDetailedProgress();
                }
                catch (error) {
                    shared_1.Logger.error(`Block processing failed at height ${block.header.height}:`, error);
                    throw error;
                }
            }));
        }
    }
    emitDetailedProgress() {
        const progress = {
            ...this.syncStats,
            currentTime: Date.now(),
            blocksPerSecond: this.calculateBlocksPerSecond(),
            estimatedTimeRemaining: this.calculateEstimatedTime(),
            failureRate: this.calculateFailureRate(),
        };
        this.eventEmitter.emit("sync_detailed_progress", progress);
    }
    async validatePeerBeforeSync(peer) {
        try {
            const peerInfo = peer.getInfo();
            const localHeight = this.blockchain.getHeight();
            if ((await peerInfo).height <= localHeight)
                return false;
            if (!(await peer.validatePeerCurrency(await peerInfo)))
                return false;
            if (peer.getAverageBandwidth() < 1000000)
                return false; // 1MB/s minimum
            return true;
        }
        catch (error) {
            shared_1.Logger.error("Peer validation failed:", error);
            return false;
        }
    }
    calculateBlocksPerSecond() {
        const elapsedSeconds = (Date.now() - this.syncStats.startTime) / 1000;
        return elapsedSeconds > 0
            ? this.syncStats.blocksProcessed / elapsedSeconds
            : 0;
    }
    async calculateEstimatedTime() {
        const blocksPerSecond = this.calculateBlocksPerSecond();
        const remainingBlocks = (await this.syncingPeer?.getInfo()).height - this.lastSyncHeight;
        return blocksPerSecond > 0 ? (remainingBlocks / blocksPerSecond) * 1000 : 0;
    }
    calculateFailureRate() {
        const totalAttempts = this.syncStats.blocksProcessed + this.syncStats.failedAttempts;
        return totalAttempts > 0
            ? (this.syncStats.failedAttempts / totalAttempts) * 100
            : 0;
    }
    on(event, listener) {
        this.eventEmitter.on(event, listener);
    }
    emitSyncComplete() {
        this.eventEmitter.emit("sync_completed");
    }
    emitSyncError(error) {
        this.eventEmitter.emit("sync_error", error);
    }
    off(event, listener) {
        this.eventEmitter.removeListener(event, listener);
    }
    async verifyChain() {
        const currentHeight = this.blockchain.getHeight();
        for (let height = 1; height <= currentHeight; height++) {
            const block = await this.blockchain.getBlockByHeight(height);
            if (!block || !(await this.blockchain.verifyBlock(block))) {
                throw new SyncError(`Chain verification failed at height ${height}`);
            }
        }
        shared_1.Logger.info("Chain verification completed successfully");
    }
    async requestHeadersWithRetry(peer, startHeight, endHeight) {
        for (let attempt = 0; attempt < BlockchainSync.MAX_RETRIES.BLOCK_REQUEST; attempt++) {
            try {
                return await Promise.race([
                    peer.request(peer_model_1.PeerMessageType.GETHEADERS, { startHeight, endHeight }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), BlockchainSync.SYNC_TIMEOUTS.BLOCK_REQUEST)),
                ]);
            }
            catch (error) {
                if (attempt === BlockchainSync.MAX_RETRIES.BLOCK_REQUEST - 1)
                    throw error;
                await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
        throw new Error("Max retries exceeded");
    }
    validateHeaders(headers) {
        try {
            if (!headers?.length) {
                shared_1.Logger.warn("Empty headers array received for validation");
                return false;
            }
            // Validate first header connects to our chain
            const firstHeader = headers[0];
            if (firstHeader.header.height !== this.headerSync.currentHeight) {
                shared_1.Logger.warn(`Invalid starting height. Expected: ${this.headerSync.currentHeight}, Got: ${firstHeader.header.height}`);
                return false;
            }
            // Validate header sequence
            for (let i = 1; i < headers.length; i++) {
                const prevHeader = headers[i - 1];
                const currentHeader = headers[i];
                // Validate height sequence
                if (currentHeader.header.height !== prevHeader.header.height + 1) {
                    shared_1.Logger.warn(`Non-sequential block heights at index ${i}. Expected: ${prevHeader.header.height + 1}, Got: ${currentHeader.header.height}`);
                    return false;
                }
                // Validate hash linkage
                if (currentHeader.header.previousHash !== prevHeader.header.hash) {
                    shared_1.Logger.warn(`Invalid hash chain at height ${currentHeader.header.height}. Expected previous: ${prevHeader.header.hash}, Got: ${currentHeader.header.previousHash}`);
                    return false;
                }
                // Validate timestamp is reasonable
                if (currentHeader.header.timestamp <= prevHeader.header.timestamp) {
                    shared_1.Logger.warn(`Invalid timestamp at height ${currentHeader.header.height}`);
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            shared_1.Logger.error("Header validation failed:", error);
            return false;
        }
    }
    async requestBlockWithRetry(peer, height) {
        for (let attempt = 0; attempt < BlockchainSync.MAX_RETRIES.BLOCK_REQUEST; attempt++) {
            try {
                return await Promise.race([
                    peer.request(peer_model_1.PeerMessageType.GET_BLOCK, { height }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), BlockchainSync.SYNC_TIMEOUTS.BLOCK_REQUEST)),
                ]);
            }
            catch (error) {
                if (attempt === BlockchainSync.MAX_RETRIES.BLOCK_REQUEST - 1)
                    throw error;
                await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
        throw new Error("Max retries exceeded");
    }
    async getVerificationProgress() {
        if (this.state !== SyncState.SYNCING)
            return 1;
        const currentHeight = this.blockchain.getCurrentHeight();
        const targetHeight = (await this.syncingPeer?.getInfo()).height || currentHeight;
        return targetHeight ? currentHeight / targetHeight : 1;
    }
    isInitialBlockDownload() {
        return this.state === SyncState.SYNCING;
    }
}
exports.BlockchainSync = BlockchainSync;
BlockchainSync.SYNC_TIMEOUT = 30000; // 30 seconds
BlockchainSync.MAX_BLOCKS_PER_REQUEST = 500;
BlockchainSync.MAX_RETRY_ATTEMPTS = 3;
BlockchainSync.SYNC_CHECK_INTERVAL = 60000; // 1 minute
BlockchainSync.MAX_PARALLEL_BLOCKS = 10; // Maximum parallel block processing
BlockchainSync.SYNC_TIMEOUTS = {
    BLOCK_REQUEST: 30000,
    VOTE_REQUEST: 15000,
    PEER_SELECTION: 10000,
    SYNC_INTERVAL: 300000, // 5m between sync checks
};
BlockchainSync.MAX_RETRIES = {
    BLOCK_REQUEST: 3,
    VOTE_REQUEST: 2,
    PEER_SELECTION: 3,
};
BlockchainSync.BATCH_SIZES = {
    BLOCKS: 50,
    VOTES: 100, // Process 100 votes per batch
};
BlockchainSync.SYNC_PARAMETERS = {
    HEADERS_BATCH_SIZE: 2000,
    BLOCKS_BATCH_SIZE: 100,
    DISCOVERY_INTERVAL: 10000,
    TIMEOUT_BASE: 1000,
    MAX_HEADERS_REWIND: 100,
    MIN_PEER_HEIGHT_DIFF: 3, // Minimum height difference to trigger sync
};
//# sourceMappingURL=sync.js.map