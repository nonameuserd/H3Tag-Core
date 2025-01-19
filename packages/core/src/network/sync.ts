import { EventEmitter } from "events";
import { Block } from "../models/block.model";
import { Transaction } from "../models/transaction.model";
import { Peer } from "./peer";
import { Blockchain } from "../blockchain/blockchain";
import { Mempool } from "../blockchain/mempool";
import { BlockchainSchema } from "../database/blockchain-schema";
import { MessagePayload, PeerMessageType } from "../models/peer.model";
import { Logger } from "@h3tag-blockchain/shared";
import { BLOCKCHAIN_CONSTANTS } from "../blockchain/utils/constants";
import { Mutex } from "async-mutex";

export enum SyncState {
  IDLE = "IDLE",
  SYNCING = "SYNCING",
  SYNCED = "SYNCED",
  ERROR = "ERROR",
}

export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncError";
  }
}

export class BlockchainSync {
  private readonly blockchain: Blockchain;
  private readonly mempool: Mempool;
  private readonly peers: Map<string, Peer>;
  private state: SyncState;
  private syncingPeer?: Peer;
  private lastSyncHeight: number;
  private retryAttempts: number;
  private syncTimeout?: NodeJS.Timeout;
  private currentEpoch: number;
  private readonly eventEmitter = new EventEmitter();
  private static readonly SYNC_TIMEOUT = 30000; // 30 seconds
  private static readonly MAX_BLOCKS_PER_REQUEST = 500;
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly SYNC_CHECK_INTERVAL = 60000; // 1 minute
  private static readonly MAX_PARALLEL_BLOCKS = 10; // Maximum parallel block processing

  private static readonly SYNC_TIMEOUTS = {
    BLOCK_REQUEST: 30000, // 30s for block requests
    VOTE_REQUEST: 15000, // 15s for vote requests
    PEER_SELECTION: 10000, // 10s for peer selection
    SYNC_INTERVAL: 300000, // 5m between sync checks
  };

  private static readonly MAX_RETRIES = {
    BLOCK_REQUEST: 3,
    VOTE_REQUEST: 2,
    PEER_SELECTION: 3,
  };

  private syncStats = {
    startTime: 0,
    endTime: 0,
    blocksProcessed: 0,
    votesProcessed: 0,
    failedAttempts: 0,
  };

  private static readonly BATCH_SIZES = {
    BLOCKS: 50, // Process 50 blocks per batch
    VOTES: 100, // Process 100 votes per batch
  };

  private static readonly SYNC_PARAMETERS = {
    HEADERS_BATCH_SIZE: 2000, // Bitcoin uses 2000 headers per request
    BLOCKS_BATCH_SIZE: 100, // Number of full blocks to download in parallel
    DISCOVERY_INTERVAL: 10000, // Peer discovery interval (10s)
    TIMEOUT_BASE: 1000, // Base timeout for exponential backoff
    MAX_HEADERS_REWIND: 100, // Headers to rewind on invalid chain
    MIN_PEER_HEIGHT_DIFF: 3, // Minimum height difference to trigger sync
  };

  public headerSync = {
    startHeight: 0,
    currentHeight: 0,
    targetHeight: 0,
    headers: new Map<number, Block>(),
    pendingRequests: new Set<number>(),

    clear(): void {
      this.headers.clear();
      this.pendingRequests.clear();
    },
  };

  private readonly mutex = new Mutex();

  constructor(
    blockchain: Blockchain,
    mempool: Mempool,
    peers: Map<string, Peer>,
    private readonly consensusPublicKey: {
      publicKey: string;
    },
    private readonly db: BlockchainSchema
  ) {
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

  private setupEventListeners(): void {
    this.peers.forEach((peer) => this.setupPeerListeners(peer));
  }

  private setupPeerListeners(peer: Peer): void {
    peer.eventEmitter.on("new_block", async (block: Block) => {
      try {
        await this.handleNewBlock(block, peer);
      } catch (error) {
        Logger.error(
          `Error handling new block from peer ${(await peer.getInfo()).url}:`,
          error
        );
        this.eventEmitter.emit("sync_error", error);
      }
    });

    peer.eventEmitter.on(
      "new_transaction",
      async (transaction: Transaction) => {
        try {
          await this.handleNewTransaction({ transaction }, peer);
        } catch (error) {
          Logger.error(
            `Error handling new transaction from peer ${(await peer.getInfo()).url}:`,
            error
          );
          this.eventEmitter.emit("sync_error", error);
        }
      }
    );

    peer.eventEmitter.on("disconnect", () => {
      if (peer === this.syncingPeer) {
        this.handleSyncingPeerDisconnect();
      }
    });
  }

  private async handleSyncingPeerDisconnect(): Promise<void> {
    Logger.warn("Syncing peer disconnected, attempting to find new peer");
    this.syncingPeer = undefined;
    if (this.state === SyncState.SYNCING) {
      await this.startSync();
    }
  }

  private startPeriodicSync(): void {
    setInterval(() => {
      if (this.state === SyncState.IDLE) {
        this.checkSync().catch((error) => {
          Logger.error("Periodic sync check failed:", error);
        });
      }
    }, BlockchainSync.SYNC_CHECK_INTERVAL);
  }

  public async startSync(): Promise<void> {
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
        currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        timestamp: Date.now(),
      });
      Logger.info(
        `Starting ${BLOCKCHAIN_CONSTANTS.CURRENCY.NAME} blockchain synchronization`
      );

      const bestPeer = await this.selectBestPeer();
      if (!bestPeer) {
        throw new SyncError(
          `No suitable peers for ${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} synchronization`
        );
      }

      this.syncingPeer = bestPeer;
      this.setupSyncTimeout();
      await this.synchronize(bestPeer);

      this.state = SyncState.SYNCED;
      this.clearSyncTimeout();
      this.eventEmitter.emit("sync_completed", {
        currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        timestamp: Date.now(),
      });
      Logger.info(
        `${BLOCKCHAIN_CONSTANTS.CURRENCY.NAME} blockchain synchronization completed`
      );
    } catch (error) {
      this.syncStats.failedAttempts++;
      this.syncStats.endTime = Date.now();
      this.handleSyncError(error);
    }
  }

  private setupSyncTimeout(): void {
    this.clearSyncTimeout();
    this.syncTimeout = setTimeout(() => {
      this.handleSyncTimeout();
    }, BlockchainSync.SYNC_TIMEOUT);
  }

  private clearSyncTimeout(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = undefined;
    }
  }

  private handleSyncTimeout(): void {
    Logger.error(
      `${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} sync timeout occurred`
    );
    this.state = SyncState.ERROR;
    this.eventEmitter.emit("sync_timeout", {
      currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
      timestamp: Date.now(),
    });
    this.handleSyncError(
      new SyncError(`${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} sync timeout`)
    );
  }

  private async handleSyncError(error: Error): Promise<void> {
    this.state = SyncState.ERROR;
    this.eventEmitter.emit("sync_error", {
      error,
      currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
      timestamp: Date.now(),
    });
    Logger.error(
      `${BLOCKCHAIN_CONSTANTS.CURRENCY.NAME} blockchain synchronization failed:`,
      error
    );

    if (this.retryAttempts < BlockchainSync.MAX_RETRY_ATTEMPTS) {
      this.retryAttempts++;
      Logger.info(
        `Retrying ${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} sync (attempt ${this.retryAttempts})`
      );
      await this.startSync();
    } else {
      Logger.error(
        `${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} sync: Max retry attempts reached`
      );
      this.eventEmitter.emit("sync_failed", {
        currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        timestamp: Date.now(),
      });
    }
  }

  private async selectBestPeer(): Promise<Peer | undefined> {
    const connectedPeers = Array.from(this.peers.values()).filter(
      (peer) => peer.isConnected() && !peer.isBanned()
    );

    if (connectedPeers.length === 0) {
      return undefined;
    }

    // Add timeout to peer validation
    const validPeers = await Promise.race([
      Promise.all(
        connectedPeers.map(async (peer) => ({
          peer,
          isValid: await this.validatePeerBeforeSync(peer).catch(() => false),
        }))
      ),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Peer validation timeout")),
          BlockchainSync.SYNC_TIMEOUTS.PEER_SELECTION
        )
      ),
    ]);

    const validConnectedPeers = validPeers
      .filter(({ isValid }) => isValid)
      .map(({ peer }) => peer);

    const peersWithInfo = await Promise.all(
      validConnectedPeers.map(async peer => ({
        peer,
        info: await peer.getInfo()
      }))
    );

    return peersWithInfo
      .sort((a, b) => {
        const heightDiff = b.info.height - a.info.height;
        if (heightDiff !== 0) return heightDiff;
        return a.info.latency - b.info.latency;
      })
      .map(({ peer }) => peer)[0];
  }

  public async synchronize(peer: Peer): Promise<void> {
    let syncTimeout: NodeJS.Timeout | undefined;
    try {
      syncTimeout = setTimeout(() => {
        throw new SyncError("Sync timeout");
      }, BlockchainSync.SYNC_TIMEOUT);

      await this.syncHeaders(peer);
      await this.syncBlocks(peer);
      await this.verifyChain();
    } catch (error) {
      Logger.error("Synchronization failed:", error);
      throw new SyncError(`Sync failed: ${error.message}`);
    } finally {
      if (syncTimeout) clearTimeout(syncTimeout);
    }
  }

  public async syncHeaders(peer: Peer): Promise<void> {
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
        clear(): void {
          this.headers.clear();
          this.pendingRequests.clear();
        },
      };

      Logger.info(
        `Starting headers sync from ${currentHeight} to ${targetHeight}`
      );

      while (this.headerSync.currentHeight <= targetHeight) {
        const endHeight = Math.min(
          this.headerSync.currentHeight +
            BlockchainSync.SYNC_PARAMETERS.HEADERS_BATCH_SIZE,
          targetHeight
        );

        try {
          const headers = await this.requestHeadersWithRetry(
            peer,
            this.headerSync.currentHeight,
            endHeight
          );

          if (!this.validateHeaders(headers)) {
            // Rewind some headers on validation failure
            this.rewindHeaders(
              BlockchainSync.SYNC_PARAMETERS.MAX_HEADERS_REWIND
            );
            continue;
          }

          // Store valid headers
          headers.forEach((header) => {
            this.headerSync.headers.set(header.header.height, header);
          });

          this.headerSync.currentHeight = endHeight + 1;
          this.emitSyncProgress(currentHeight, endHeight, targetHeight);
        } catch (error) {
          Logger.error(
            `Header sync failed at height ${this.headerSync.currentHeight}:`,
            error
          );
          await this.handleSyncError(error);
        }
      }
    } finally {
      release();
    }
  }

  private async syncBlocks(peer: Peer): Promise<void> {
    // Process blocks in parallel batches
    for (const [height] of this.headerSync.headers) {
      const batch = new Set<number>();

      // Create batch of block requests
      for (
        let i = 0;
        i < BlockchainSync.SYNC_PARAMETERS.BLOCKS_BATCH_SIZE;
        i++
      ) {
        const nextHeight = height + i;
        if (this.headerSync.headers.has(nextHeight)) {
          batch.add(nextHeight);
        }
      }

      await this.downloadBlockBatch(peer, batch);
    }
  }

  private async downloadBlockBatch(
    peer: Peer,
    heights: Set<number>
  ): Promise<void> {
    const promises = Array.from(heights).map(async (height) => {
      try {
        const block = await this.requestBlockWithRetry(peer, height);
        await this.validateAndProcessBlock(block);
        this.syncStats.blocksProcessed++;
      } catch (error) {
        Logger.error(`Failed to download block at height ${height}:`, error);
        throw error;
      }
    });

    await Promise.all(promises);
  }

  private async validateAndProcessBlock(block: Block): Promise<void> {
    // Verify block matches stored header
    const storedHeader = this.headerSync.headers.get(block.header.height);
    if (!storedHeader || storedHeader.header.hash !== block.header.hash) {
      throw new SyncError("Block does not match stored header");
    }

    await this.processBlock(block);
  }

  private rewindHeaders(count: number): void {
    const newHeight = Math.max(
      this.headerSync.startHeight,
      this.headerSync.currentHeight - count
    );

    // Remove headers after new height
    for (let h = this.headerSync.currentHeight; h > newHeight; h--) {
      this.headerSync.headers.delete(h);
    }

    this.headerSync.currentHeight = newHeight;
  }

  private async processBlocksInParallel(blocks: Block[]): Promise<void> {
    // Process blocks in batches to control memory usage
    for (
      let i = 0;
      i < blocks.length;
      i += BlockchainSync.MAX_PARALLEL_BLOCKS
    ) {
      const batch = blocks.slice(i, i + BlockchainSync.MAX_PARALLEL_BLOCKS);
      await Promise.all(batch.map((block) => this.processBlock(block)));
    }
  }

  private async processBlock(block: Block): Promise<void> {
    try {
      await this.blockchain.addBlock(block);
      this.syncStats.blocksProcessed++;

      // Remove processed transactions from mempool
      for (const tx of block.transactions) {
        try {
          this.mempool.removeTransaction(tx.id);
        } catch (error) {
          Logger.warn(
            `Failed to remove transaction ${tx.id} from mempool:`,
            error
          );
        }
      }
    } catch (error) {
      this.syncStats.failedAttempts++;
      Logger.error(`Error processing block ${block.header.height}:`, error);
      throw new SyncError(
        `Failed to process block ${block.header.height}: ${error.message}`
      );
    }
  }

  private emitSyncProgress(
    currentHeight: number,
    endHeight: number,
    targetHeight: number
  ): void {
    this.eventEmitter.emit("sync_progress", {
      currentHeight: endHeight,
      targetHeight,
      percentage:
        ((endHeight - currentHeight) / (targetHeight - currentHeight)) * 100,
      currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
    });
  }

  private async requestBlocks(
    peer: Peer,
    startHeight: number,
    endHeight: number
  ): Promise<Block[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new SyncError("Block request timeout"));
      }, BlockchainSync.SYNC_TIMEOUT);

      peer
        .request(PeerMessageType.GET_BLOCKS, { startHeight, endHeight })
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

  private async handleNewBlock(block: Block, peer: Peer): Promise<void> {
    try {
      if (block.header.height > this.blockchain.getHeight() + 1) {
        await this.startSync();
        return;
      }

      await this.blockchain.addBlock(block);
      this.eventEmitter.emit("new_block", {
        block,
        currency: BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL,
        timestamp: Date.now(),
      });

      // Broadcast to other peers
      this.broadcastToPeers(PeerMessageType.NEW_BLOCK, block, peer);
    } catch (error) {
      Logger.error(
        `Error handling new ${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} block:`,
        error
      );
      throw new SyncError(
        `Failed to handle new ${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} block: ${error.message}`
      );
    }
  }

  private async handleNewTransaction(
    transaction: { transaction: Transaction },
    peer: Peer
  ): Promise<void> {
    try {
      await this.mempool.addTransaction(transaction.transaction);
      this.eventEmitter.emit("new_transaction", transaction);

      // Broadcast to other peers
      this.broadcastToPeers(PeerMessageType.NEW_TRANSACTION, transaction, peer);
    } catch (error) {
      Logger.error(`Error handling new transaction:`, error);
    }
  }

  private async broadcastToPeers(
    type: PeerMessageType,
    data: MessagePayload,
    excludePeer: Peer
  ): Promise<void> {
    const broadcastPromises = Array.from(this.peers.values())
      .filter((peer) => peer !== excludePeer && peer.isConnected())
      .map((peer) =>
        peer.request(type, data).catch((error) => {
          Logger.error(
            `Failed to broadcast to peer, error: ${error.message}`,
            error
          );
        })
      );

    await Promise.all(broadcastPromises);
  }

  public getState(): SyncState {
    return this.state;
  }

  public async stop(): Promise<void> {
    this.clearSyncTimeout();
    this.state = SyncState.IDLE;
    this.syncingPeer = undefined;
    this.eventEmitter.emit("sync_stopped");
  }

  private async checkSync(): Promise<void> {
    const bestPeer = await this.selectBestPeer();
    if (bestPeer && (await bestPeer.getInfo()).height > this.blockchain.getHeight()) {
      await this.startSync();
    }
  }

  public async dispose(): Promise<void> {
    await this.stop();
    await this.blockchain.dispose();
  }

  private async validatePeerBeforeSync(peer: Peer): Promise<boolean> {
    try {
      const peerInfo = peer.getInfo();
      const localHeight = this.blockchain.getHeight();

      if ((await peerInfo).height <= localHeight) return false;
      if (!(await peer.validatePeerCurrency(await peerInfo))) return false;
      if (peer.getAverageBandwidth() < 1000000) return false; // 1MB/s minimum

      return true;
    } catch (error) {
      Logger.error("Peer validation failed:", error);
      return false;
    }
  }

  public on(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  private emitSyncComplete(): void {
    this.eventEmitter.emit("sync_completed");
  }

  private emitSyncError(error: Error): void {
    this.eventEmitter.emit("sync_error", error);
  }

  public off(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.removeListener(event, listener);
  }

  private async verifyChain(): Promise<void> {
    const currentHeight = this.blockchain.getHeight();

    for (let height = 1; height <= currentHeight; height++) {
      const block = this.blockchain.getBlockByHeight(height);
      if (!block || !(await this.blockchain.verifyBlock(block))) {
        throw new SyncError(`Chain verification failed at height ${height}`);
      }
    }

    Logger.info("Chain verification completed successfully");
  }

  private async requestHeadersWithRetry(
    peer: Peer,
    startHeight: number,
    endHeight: number
  ): Promise<Block[]> {
    for (let attempt = 0; attempt < BlockchainSync.MAX_RETRIES.BLOCK_REQUEST; attempt++) {
      try {
        const response = await Promise.race([
          peer.request(PeerMessageType.GETHEADERS, { startHeight, endHeight }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), BlockchainSync.SYNC_TIMEOUTS.BLOCK_REQUEST)
          ),
        ]);
        return response.blocks;
      } catch (error) {
        if (attempt === BlockchainSync.MAX_RETRIES.BLOCK_REQUEST - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    throw new Error("Max retries exceeded");
  }

  private validateHeaders(headers: Block[]): boolean {
    try {
      if (!headers?.length) {
        Logger.warn("Empty headers array received for validation");
        return false;
      }

      // Validate first header connects to our chain
      const firstHeader = headers[0];
      if (firstHeader.header.height !== this.headerSync.currentHeight) {
        Logger.warn(
          `Invalid starting height. Expected: ${this.headerSync.currentHeight}, Got: ${firstHeader.header.height}`
        );
        return false;
      }

      // Validate header sequence
      for (let i = 1; i < headers.length; i++) {
        const prevHeader = headers[i - 1];
        const currentHeader = headers[i];

        // Validate height sequence
        if (currentHeader.header.height !== prevHeader.header.height + 1) {
          Logger.warn(
            `Non-sequential block heights at index ${i}. Expected: ${
              prevHeader.header.height + 1
            }, Got: ${currentHeader.header.height}`
          );
          return false;
        }

        // Validate hash linkage
        if (currentHeader.header.previousHash !== prevHeader.header.hash) {
          Logger.warn(
            `Invalid hash chain at height ${currentHeader.header.height}. Expected previous: ${prevHeader.header.hash}, Got: ${currentHeader.header.previousHash}`
          );
          return false;
        }

        // Validate timestamp is reasonable
        if (currentHeader.header.timestamp <= prevHeader.header.timestamp) {
          Logger.warn(
            `Invalid timestamp at height ${currentHeader.header.height}`
          );
          return false;
        }
      }

      return true;
    } catch (error) {
      Logger.error("Header validation failed:", error);
      return false;
    }
  }

  private async requestBlockWithRetry(
    peer: Peer,
    height: number
  ): Promise<Block> {
    for (let attempt = 0; attempt < BlockchainSync.MAX_RETRIES.BLOCK_REQUEST; attempt++) {
      try {
        const response = await Promise.race([
          peer.request(PeerMessageType.GET_BLOCK, { height }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), BlockchainSync.SYNC_TIMEOUTS.BLOCK_REQUEST))
        ]);
        return response.block as Block;
      } catch (error) {
        if (attempt === BlockchainSync.MAX_RETRIES.BLOCK_REQUEST - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    throw new Error("Max retries exceeded");
  }

  public async getVerificationProgress(): Promise<number> {
    if (this.state !== SyncState.SYNCING) return 1;
    const currentHeight = this.blockchain.getCurrentHeight();
    const targetHeight = (await this.syncingPeer.getInfo()).height || currentHeight;
    return targetHeight ? currentHeight / targetHeight : 1;
  }

  public isInitialBlockDownload(): boolean {
    return this.state === SyncState.SYNCING;
  }
}
