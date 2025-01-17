import { Transaction } from "./transaction.model";
import { Logger } from "@h3tag-blockchain/shared";
import { MerkleTree } from "../utils/merkle";
import { Vote } from "./vote.model";
import { Validator } from "./validator";
import { Mutex } from "async-mutex";
import { AuditEventType, AuditSeverity, AuditManager } from "../security/audit";
import { HybridCrypto, HybridKeyPair } from "@h3tag-blockchain/crypto";

export class BlockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockError";
  }
}

export interface BlockHeader {
  version: number;
  height: number;
  previousHash: string;
  timestamp: number;
  merkleRoot: string;
  difficulty: number;
  nonce: number;
  miner: string;
  validatorMerkleRoot: string;
  totalTAG: number;
  blockReward: number;
  fees: number;
  target: string;
  consensusData: {
    powScore: number;
    votingScore: number;
    participationRate: number;
    periodId: number;
  };
  signature?: { address: string };
  publicKey: string;
  hash: string;
  minerAddress: string;
}

export interface Block {
  hash: string;
  header: BlockHeader;
  transactions: Transaction[];
  metadata?: {
    receivedTimestamp: number;
    consensusMetrics?: {
      powWeight: number;
      votingWeight: number;
      participationRate: number;
    };
  };
  votes: Vote[];
  validators: Validator[];
  timestamp: number;
  verifyHash(): Promise<boolean>;
  verifySignature(): Promise<boolean>;
  getHeaderBase(): string;
  isComplete(): boolean;
}

export class BlockBuilder {
  private static readonly CURRENT_VERSION = 1;
  private static readonly MAX_TRANSACTIONS = 2000;
  private static readonly MIN_DIFFICULTY = 1;
  private readonly maxTransactionAge: number = 72 * 60 * 60 * 1000; // 72 hours
  public header: Block["header"];
  private transactions: Transaction[] = [];
  private votes: Vote[] = [];
  private validators: Validator[] = [];
  private readonly merkleTree: MerkleTree;
  private readonly mutex = new Mutex();
  private readonly auditManager: AuditManager;
  private hash: string = "";

  constructor(
    previousHash: string,
    difficulty: number,
    auditManager: AuditManager
  ) {
    if (difficulty < BlockBuilder.MIN_DIFFICULTY) {
      throw new BlockError("Invalid difficulty");
    }

    this.auditManager = auditManager;
    this.merkleTree = new MerkleTree();
    this.header = {
      version: BlockBuilder.CURRENT_VERSION,
      height: 0,
      previousHash,
      timestamp: Date.now(),
      merkleRoot: "",
      difficulty,
      nonce: 0,
      miner: "",
      validatorMerkleRoot: "",
      totalTAG: 0,
      blockReward: 0,
      fees: 0,
      target: "",
      consensusData: {
        powScore: 0,
        votingScore: 0,
        participationRate: 0,
        periodId: 0,
      },
      minerAddress: "",
      signature: undefined,
      publicKey: "",
      hash: "",
    };
  }

  private async calculateMerkleRoot(): Promise<string> {
    const release = await this.mutex.acquire();
    try {
      // Performance tracking
      const startTime = Date.now();

      // Input validation
      if (!this.transactions || !Array.isArray(this.transactions)) {
        throw new BlockError("Invalid transaction array");
      }

      // Handle empty transaction list
      if (this.transactions.length === 0) {
        Logger.debug("Calculating merkle root for empty transaction list");
        return await this.merkleTree.createRoot([""]); // Empty tree
      }

      // Validate each transaction has an ID
      for (const tx of this.transactions) {
        if (!tx.id) {
          throw new BlockError(`Transaction missing ID: ${JSON.stringify(tx)}`);
        }
      }

      // Map transactions to their hashes
      const txHashes = this.transactions.map((tx) => {
        if (typeof tx.id !== "string") {
          throw new BlockError(`Invalid transaction ID format: ${tx.id}`);
        }
        return tx.id;
      });

      // Calculate merkle root
      const merkleRoot = await this.merkleTree.createRoot(txHashes);

      // Validate merkle root
      if (
        !merkleRoot ||
        typeof merkleRoot !== "string" ||
        merkleRoot.length === 0
      ) {
        throw new BlockError("Invalid merkle root generated");
      }

      // Log performance metrics
      const duration = Date.now() - startTime;
      Logger.debug(
        `Merkle root calculation completed in ${duration}ms for ${txHashes.length} transactions`
      );

      // Audit log for significant transaction counts
      if (txHashes.length > 1000) {
        await this.auditManager?.log(AuditEventType.LARGE_MERKLE_TREE, {
          transactionCount: txHashes.length,
          calculationTime: duration,
          merkleRoot,
          severity: AuditSeverity.INFO,
        });
      }

      return merkleRoot;
    } catch (error) {
      Logger.error("Merkle root calculation failed:", error);
      throw new BlockError(
        error instanceof BlockError
          ? error.message
          : "Failed to calculate merkle root"
      );
    } finally {
      release();
    }
  }

  /**
   * Sets the transactions for the block
   * @param transactions Transactions to set
   * @returns Promise<this> This block builder instance
   */
  async setTransactions(transactions: Transaction[]): Promise<this> {
    const release = await this.mutex.acquire();
    try {
      // Validate input
      if (!Array.isArray(transactions)) {
        throw new BlockError("Invalid transactions array");
      }

      // Check transaction limit
      if (transactions.length > BlockBuilder.MAX_TRANSACTIONS) {
        throw new BlockError(
          `Too many transactions: ${transactions.length}/${BlockBuilder.MAX_TRANSACTIONS}`
        );
      }

      // Validate each transaction
      for (const tx of transactions) {
        if (!tx.id || !tx.sender || !tx.timestamp) {
          throw new BlockError(`Invalid transaction structure: ${tx.id}`);
        }

        // Check transaction age
        const txAge = Date.now() - tx.timestamp;
        if (txAge > this.maxTransactionAge) {
          throw new BlockError(`Transaction too old: ${tx.id}`);
        }
      }

      // Check for duplicate transactions
      const txIds = new Set<string>();
      for (const tx of transactions) {
        if (txIds.has(tx.id)) {
          throw new BlockError(`Duplicate transaction found: ${tx.id}`);
        }
        txIds.add(tx.id);
      }

      // Calculate total size and fees
      let totalSize = 0;
      let totalFees = BigInt(0);
      for (const tx of transactions) {
        totalSize += JSON.stringify(tx).length;
        totalFees += BigInt(tx.fee);
      }

      // Update block header and transaction list
      try {
        // Create new array to prevent external mutations
        this.transactions = [...transactions];

        // Update merkle root
        this.header.merkleRoot = await this.calculateMerkleRoot();

        // Update block metadata
        this.header.fees = Number(totalFees);

        // Log transaction addition
        Logger.info(
          `Added ${transactions.length} transactions to block. Total fees: ${totalFees}`
        );

        await this.auditManager?.log(AuditEventType.TRANSACTIONS_ADDED, {
          blockHeight: this.header.height,
          transactionCount: transactions.length,
          totalFees,
          merkleRoot: this.header.merkleRoot,
          severity: AuditSeverity.INFO,
        });

        return this;
      } catch (error) {
        Logger.error("Failed to update block with transactions:", error);
        throw new BlockError("Failed to update block with transactions");
      }
    } catch (error) {
      Logger.error("Transaction validation failed:", error);
      if (error instanceof BlockError) {
        throw error;
      }
      throw new BlockError(
        error instanceof Error ? error.message : "Failed to set transactions"
      );
    } finally {
      release();
    }
  }

  public async calculateHash(): Promise<string> {
    try {
      // Validate header fields before hashing
      if (
        !this.header ||
        !this.header.previousHash ||
        !this.header.merkleRoot
      ) {
        throw new BlockError("Invalid block header");
      }

      // Performance tracking
      const startTime = Date.now();

      // Create header string with ordered fields for consistent hashing
      const headerString = JSON.stringify({
        ...this.header,
        timestamp: this.header.timestamp,
        nonce: this.header.nonce,
      });

      // Use HybridCrypto for quantum-resistant hashing
      const hash = await HybridCrypto.hash(headerString);

      // Log performance metrics
      Logger.debug(`Block hash calculation took ${Date.now() - startTime}ms`);

      return hash;
    } catch (error) {
      Logger.error("Failed to calculate block hash:", error);
      throw new BlockError(
        error instanceof Error
          ? error.message
          : "Failed to calculate block hash"
      );
    }
  }

  async build(minerKeyPair: HybridKeyPair): Promise<Block> {
    try {
      // Validate required block components
      if (!this.header.merkleRoot) {
        this.header.merkleRoot = await this.calculateMerkleRoot();
      }

      if (!this.header.validatorMerkleRoot && this.validators.length > 0) {
        const validatorHashes = this.validators.map((v) => v.address);
        this.header.validatorMerkleRoot = await this.merkleTree.createRoot(
          validatorHashes
        );
      }

      // Calculate final block hash
      const hash = await this.calculateHash();
      this.header.hash = hash;

      // Calculate total fees and rewards
      const totalFees = this.transactions.reduce(
        (sum, tx) => sum + Number(tx.fee),
        0
      );
      this.header.fees = totalFees;

      // Sign the block before finalizing
      const headerString = JSON.stringify(this.header);
      this.header.signature = await HybridCrypto.sign(
        headerString,
        minerKeyPair
      );

      // Build final block object with all components
      const block: Block = {
        header: {
          ...this.header,
          timestamp: this.header.timestamp || Date.now(), // Ensure timestamp exists
        },
        transactions: [...this.transactions], // new array to prevent mutations
        hash,
        votes: [...this.votes],
        validators: [...this.validators],
        metadata: {
          receivedTimestamp: Date.now(),
          consensusMetrics: {
            powWeight: this.header.consensusData.powScore,
            votingWeight: this.header.consensusData.votingScore,
            participationRate: this.header.consensusData.participationRate,
          },
        },
        timestamp: this.header.timestamp || Date.now(),
        verifyHash: async () => this.verifyHash(),
        verifySignature: async () => this.verifySignature(),
        getHeaderBase: () => this.getHeaderBase(),
        isComplete: () => this.isComplete(),
      };

      // Validate final block structure
      this.validateBlockStructure(block);

      return block;
    } catch (error) {
      Logger.error("Failed to build block:", error);
      throw new BlockError(
        error instanceof Error ? error.message : "Failed to build block"
      );
    }
  }

  // Helper method to validate block structure
  private validateBlockStructure(block: Block): void {
    if (!block.hash || !block.header || !Array.isArray(block.transactions)) {
      throw new BlockError("Invalid block structure");
    }

    // Validate header fields
    const requiredFields = [
      "version",
      "height",
      "previousHash",
      "timestamp",
      "merkleRoot",
      "difficulty",
      "nonce",
      "miner",
    ];

    for (const field of requiredFields) {
      if (!(field in block.header)) {
        throw new BlockError(`Missing required header field: ${field}`);
      }
    }

    // Validate consensus data
    if (
      block.header.consensusData.powScore < 0 ||
      block.header.consensusData.votingScore < 0 ||
      block.header.consensusData.participationRate < 0 ||
      block.header.consensusData.participationRate > 1
    ) {
      throw new BlockError("Invalid consensus data values");
    }
  }

  public setHeight(height: number): this {
    if (height < 0 || !Number.isInteger(height)) {
      throw new BlockError("Invalid block height");
    }
    this.header.height = height;
    return this;
  }

  public setPreviousHash(hash: string): this {
    this.header.previousHash = hash;
    return this;
  }

  public setTimestamp(timestamp: number): this {
    const now = Date.now();
    const oneHourInFuture = now + (60 * 60 * 1000);
    const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);

    // Validate timestamp is not in the future (with small tolerance)
    if (timestamp > oneHourInFuture) {
        throw new BlockError("Block timestamp cannot be in the future");
    }

    // Validate timestamp is not too old
    if (timestamp < oneYearAgo) {
        throw new BlockError("Block timestamp is too old");
    }

    // Validate timestamp is a valid number
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        throw new BlockError("Invalid timestamp value");
    }

    this.header.timestamp = timestamp;
    return this;
  }

  public async verifyHash(): Promise<boolean> {
    try {
      const calculatedHash = await this.calculateHash();
      return calculatedHash === this.hash;
    } catch (error) {
      Logger.error("Hash verification failed:", error);
      return false;
    }
  }

  public async verifySignature(): Promise<boolean> {
    return HybridCrypto.verify(this.header.hash, this.header.signature, {
      address: this.header.publicKey,
    });
  }

  public getHeaderBase(): string {
    return (
      this.header.version +
      this.header.previousHash +
      this.header.merkleRoot +
      this.header.timestamp +
      this.header.difficulty +
      this.header.nonce +
      this.header.miner
    );
  }

  public setVersion(version: number): this {
    this.header.version = version;
    return this;
  }

  public setMerkleRoot(merkleRoot: string): this {
    this.header.merkleRoot = merkleRoot;
    return this;
  }

  public setDifficulty(difficulty: number): this {
    this.header.difficulty = difficulty;
    return this;
  }

  public setNonce(nonce: number): this {
    this.header.nonce = nonce;
    return this;
  }

  public isComplete(): boolean {
    return !!(
      this.hash &&
      this.header &&
      this.transactions?.length >= 0 &&
      this.header.merkleRoot &&
      this.header.timestamp &&
      this.header.nonce
    );
  }

  public setHash(hash: string): this {
    this.hash = hash;
    return this;
  }
}
