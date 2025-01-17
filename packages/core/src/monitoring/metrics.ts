import { Logger } from "@h3tag-blockchain/shared";
import { Mutex } from "async-mutex";

export class MiningMetrics {
  public totalBlocks: number = 0;
  public successfulBlocks: number = 0;
  public lastMiningTime: number = 0;
  public averageHashRate: number = 0;
  public totalTAGMined: number = 0;
  public currentBlockReward: number = 0;
  public tagTransactionsCount: number = 0;
  public timestamp: bigint = BigInt(0);
  public blockHeight: number = 0;
  public hashRate: number = 0;
  public difficulty: number = 0;
  public blockTime: number = 0;
  public tagVolume: number = 0;
  public tagFees: number = 0;
  public lastBlockTime: number = Date.now();
  public syncedHeaders: number = 0;
  public syncedBlocks: number = 0;
  public whitelistedPeers: number = 0;
  public blacklistedPeers: number = 0;
  private static instance: MiningMetrics;
  private metrics: {
    hashRate: number[];
    difficulty: number[];
    blockTimes: number[];
    timestamp: bigint[];
    tagVolume: number[];
    tagFees: number[];
  };
  private readonly mutex = new Mutex();

  private constructor() {
    this.metrics = {
      hashRate: [],
      difficulty: [],
      blockTimes: [],
      timestamp: [],
      tagVolume: [],
      tagFees: [],
    };
  }

  public static getInstance(): MiningMetrics {
    if (!MiningMetrics.instance) {
      MiningMetrics.instance = new MiningMetrics();
    }
    return MiningMetrics.instance;
  }

  public async updateMetrics(data: {
    hashRate?: number;
    difficulty?: number;
    blockTime?: number;
    tagVolume?: number;
    tagFees?: number;
  }): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      const now = Date.now();
      if (data.hashRate) {
        this.metrics.hashRate.push(data.hashRate);
        this.metrics.timestamp.push(BigInt(now));
      }
      if (data.difficulty) this.metrics.difficulty.push(data.difficulty);
      if (data.blockTime) {
        this.lastBlockTime = Date.now();
        this.metrics.blockTimes.push(data.blockTime);
      }
      if (data.tagVolume) this.metrics.tagVolume.push(data.tagVolume);
      if (data.tagFees) this.metrics.tagFees.push(data.tagFees);

      // Cleanup old metrics
      this.cleanupOldMetrics(now);
    } finally {
      release();
    }
  }

  private cleanupOldMetrics(now: number): void {
    const cutoff = now - 24 * 60 * 60 * 1000; // 24 hours
    const startIdx = this.metrics.timestamp.findIndex((t) => t > cutoff);

    if (startIdx > 0) {
      this.metrics.hashRate = this.metrics.hashRate.slice(startIdx);
      this.metrics.difficulty = this.metrics.difficulty.slice(startIdx);
      this.metrics.blockTimes = this.metrics.blockTimes.slice(startIdx);
      this.metrics.timestamp = this.metrics.timestamp.slice(startIdx);
      this.metrics.tagVolume = this.metrics.tagVolume.slice(startIdx);
      this.metrics.tagFees = this.metrics.tagFees.slice(startIdx);
    }
  }

  public getAverageHashRate(timeWindow: number = 3600000): number {
    if (!this.metrics.hashRate.length || !this.metrics.timestamp.length) {
      return 0;
    }

    const cutoff = Date.now() - timeWindow;
    const startIdx = this.metrics.timestamp.findIndex((t) => t > cutoff);
    if (startIdx === -1) return 0;

    const recentHashes = this.metrics.hashRate.slice(startIdx);
    return recentHashes.reduce((a, b) => a + b, 0) / recentHashes.length || 0;
  }

  /**
   * Get average TAG volume over specified time window
   * @param timeWindow Time window in milliseconds (default: 1 hour)
   * @returns Average TAG volume or 0 if no data
   */
  getAverageTAGVolume(timeWindow: number = 3600000): number {
    try {
      const cutoff = Date.now() - timeWindow;

      // Early return if no data
      if (!this.metrics.tagVolume.length || !this.metrics.timestamp.length) {
        Logger.debug("No TAG volume data available for averaging");
        return 0;
      }

      // Find starting index for optimization
      const startIdx = this.metrics.timestamp.findIndex((t) => t > cutoff);
      if (startIdx === -1) {
        Logger.debug("No TAG volume data within specified timeWindow");
        return 0;
      }

      // Calculate sum and count for average
      let sum = 0;
      let count = 0;

      for (let i = startIdx; i < this.metrics.tagVolume.length; i++) {
        const volume = this.metrics.tagVolume[i];
        if (typeof volume === "number" && !isNaN(volume)) {
          sum += volume;
          count++;
        }
      }

      // Calculate and round to 8 decimal places (TAG precision)
      const average = count > 0 ? Number((sum / count).toFixed(8)) : 0;

      Logger.debug(
        `Calculated average TAG volume: ${average} over ${timeWindow}ms`
      );
      return average;
    } catch (error) {
      Logger.error("Error calculating average TAG volume:", error);
      return 0;
    }
  }

  /**
   * Get average TAG transaction fees over specified time window
   * @param timeWindow Time window in milliseconds (default: 1 hour)
   * @returns Average TAG fees or 0 if no data
   */
  getAverageTAGFees(timeWindow: number = 3600000): number {
    try {
      const cutoff = Date.now() - timeWindow;

      // Early return if no data
      if (!this.metrics.tagFees.length || !this.metrics.timestamp.length) {
        Logger.debug("No TAG fee data available for averaging");
        return 0;
      }

      // Find starting index for optimization
      const startIdx = this.metrics.timestamp.findIndex((t) => t > cutoff);
      if (startIdx === -1) {
        Logger.debug("No TAG fee data within specified timeWindow");
        return 0;
      }

      // Calculate sum and count for average
      let sum = 0;
      let count = 0;

      for (let i = startIdx; i < this.metrics.tagFees.length; i++) {
        const fee = this.metrics.tagFees[i];
        if (typeof fee === "number" && !isNaN(fee)) {
          sum += fee;
          count++;
        }
      }

      // Calculate and round to 8 decimal places (TAG precision)
      const average = count > 0 ? Number((sum / count).toFixed(8)) : 0;

      Logger.debug(
        `Calculated average TAG fees: ${average} over ${timeWindow}ms`
      );
      return average;
    } catch (error) {
      Logger.error("Error calculating average TAG fees:", error);
      return 0;
    }
  }

  public recordError(context: string): void {
    Logger.error(`Mining error in ${context}`);
    this.updateMetrics({
      hashRate: 0,
      difficulty: this.difficulty,
      blockTime: 0,
    });
  }

  public gauge(name: string, value: number): void {
    switch (name) {
      case "blocks_in_flight":
        // Track number of blocks being processed
        this.blockHeight = value;
        break;
      case "synced_headers":
        // Track header sync progress
        this.syncedHeaders = value;
        break;
      case "synced_blocks":
        // Track block sync progress
        this.syncedBlocks = value;
        break;
      case "whitelisted":
        // Track whitelisted peers count
        this.whitelistedPeers = value;
        break;
      case "blacklisted":
        // Track blacklisted peers count
        this.blacklistedPeers = value;
        break;
      case "hash_rate":
        // Track current hash rate
        this.hashRate = value;
        break;
      case "difficulty":
        // Track current mining difficulty
        this.difficulty = value;
        break;
      default:
        Logger.warn(`Unknown metric gauge: ${name}`);
    }
  }

  public recordFailedMine(reason: string): void {
    this.totalBlocks++;
    this.lastMiningTime = Date.now() - this.lastBlockTime;
    this.hashRate = 0; // Reset hash rate on failure
    Logger.warn(`Mining failed: ${reason}`);
  }

  public recordSuccessfulMine(): void {
    this.totalBlocks++;
    this.successfulBlocks++;
    this.lastBlockTime = Date.now();
  }
}
