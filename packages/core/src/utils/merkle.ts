import { HybridCrypto } from '@h3tag-blockchain/crypto';
import { Logger } from '@h3tag-blockchain/shared';

export interface MerkleProof {
  index: number;
  hash: string;
  siblings: string[];
}

export class MerkleTree {
  private leaves: string[] = [];
  private layers: string[][] = [];
  private readonly hashCache: Map<string, string> = new Map();
  private readonly maxCacheSize = 10000;
  private readonly rootCache: Map<string, string> = new Map();

  /**
   * Creates a Merkle root from an array of data
   * @param data Array of strings to create merkle tree from
   * @param pruneLayers Boolean indicating whether to prune intermediate layers
   * @returns Root hash of the merkle tree
   */
  async createRoot(
    data: string[],
    pruneLayers = false,
  ): Promise<string> {
    try {
      if (!Array.isArray(data) || !data.length) {
        throw new Error('Invalid input: data must be non-empty array');
      }

      // Validate each data item
      for (const item of data) {
        if (typeof item !== 'string' || item.length === 0) {
          throw new Error(
            'Invalid input: all data items must be non-empty strings',
          );
        }
      }

      // Clear previous state
      this.clearState();

      // Build leaves with hashed data
      this.leaves = await Promise.all(data.map((item) => this.hashData(item)));
      this.layers = [this.leaves];

      // Build tree layers until we reach the root
      while (this.layers[0].length > 1) {
        this.layers.unshift(await this.createLayer(this.layers[0]));
      }

      // Optionally prune intermediate layers if proofs are not needed
      if (pruneLayers) {
        this.cleanupLayers();
      }

      return this.layers[0][0];
    } catch (error) {
      Logger.error('Failed to create merkle root:', error);
      throw error;
    }
  }

  /**
   * Verifies if data belongs to the merkle tree with given root
   * @param root Merkle root to verify against
   * @param data Array of data to verify
   * @returns Boolean indicating if verification passed
   */
  async verify(root: string, data: string[]): Promise<boolean> {
    try {
      const computedRoot = await this.createRoot(data);
      return computedRoot === root;
    } catch (error) {
      Logger.error('Merkle verification failed:', error);
      return false;
    }
  }

  /**
   * Generates a merkle proof for a specific leaf
   * @param index Index of the leaf to generate proof for
   * @returns MerkleProof object containing proof data
   */
  async generateProof(index: number): Promise<MerkleProof> {
    try {
      if (index < 0 || index >= this.leaves.length) {
        throw new Error(
          `Invalid leaf index: ${index}. Valid range: 0-${this.leaves.length - 1}`,
        );
      }

      // Add validation for empty tree
      if (this.leaves.length === 0) {
        throw new Error('Cannot generate proof from empty tree');
      }

      const proof: MerkleProof = {
        index,
        hash: this.leaves[index],
        siblings: [],
      };

      let currentIndex = index;
      for (let i = this.layers.length - 1; i > 0; i--) {
        const layer = this.layers[i];
        const isRight = currentIndex % 2 === 1;
        const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;

        if (siblingIndex < layer.length) {
          proof.siblings.push(layer[siblingIndex]);
        } else {
          // If no sibling is found (odd count), duplicate the current node
          proof.siblings.push(layer[currentIndex]);
        }
        
        currentIndex = Math.floor(currentIndex / 2);
      }

      return proof;
    } catch (error) {
      Logger.error('Failed to generate merkle proof:', error);
      throw error;
    }
  }

  /**
   * Verifies a merkle proof
   * @param proof MerkleProof object containing proof data
   * @param data Array of data to verify
   * @param root Merkle root to verify against
   * @returns Boolean indicating if proof is valid
   */
  async verifyProof(
    proof: MerkleProof,
    data: string,
    root: string,
  ): Promise<boolean> {
    try {
      if (!proof || !root || !Array.isArray(proof.siblings)) {
        return false;
      }

      // Validate data input
      if (typeof data !== 'string' || data.length === 0) {
        return false;
      }

      // Verify that the hashed data matches the provided proof hash
      const dataHash = await this.hashData(data);
      if (dataHash !== proof.hash) {
        return false;
      }

      // If no siblings are provided, assume a single-element tree and check directly
      if (proof.siblings.length === 0) {
        return proof.hash === root;
      }

      let hash = proof.hash;

      for (let i = 0; i < proof.siblings.length; i++) {
        const isRight = Math.floor(proof.index / Math.pow(2, i)) % 2 === 1;
        const sibling = proof.siblings[i];
        hash = isRight
          ? await this.hashPair(sibling, hash)
          : await this.hashPair(hash, sibling);
      }

      return hash === root;
    } catch (error) {
      Logger.error('Merkle proof verification failed:', error);
      return false;
    }
  }

  /**
   * Creates a new layer in the merkle tree
   * @param nodes Array of node hashes
   * @returns Array of parent node hashes
   */
  private async createLayer(nodes: string[]): Promise<string[]> {
    if (!Array.isArray(nodes) || nodes.length === 0) {
      throw new Error('Invalid nodes array');
    }

    const layer: string[] = [];
    const promises: Promise<string>[] = [];

    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = i + 1 < nodes.length ? nodes[i + 1] : left;
      promises.push(this.hashPair(left, right));
    }

    // Process all pairs concurrently
    const results = await Promise.all(promises);
    layer.push(...results);

    return layer;
  }

  /**
   * Hashes a pair of nodes together
   * @param left Left node hash
   * @param right Right node hash
   * @returns Combined hash of both nodes
   */
  private async hashPair(left: string, right: string): Promise<string> {
    if (
      !left ||
      !right ||
      typeof left !== 'string' ||
      typeof right !== 'string'
    ) {
      throw new Error('Invalid hash pair inputs');
    }

    const key = `${left}:${right}`;

    // Return cached hash if it exists regardless of cache size
    if (this.hashCache.has(key)) {
      return this.hashCache.get(key)!;
    }

    const combined = `${left}${right}`;
    const hash = await HybridCrypto.hash(combined);

    if (this.hashCache.size < this.maxCacheSize) {
      this.hashCache.set(key, hash);
    }

    return hash;
  }

  /**
   * Hashes individual data items
   * @param data Data to hash
   * @returns Hash of the data
   */
  private async hashData(data: string): Promise<string> {
    if (this.hashCache.has(data)) {
      return this.hashCache.get(data)!;
    }

    const hash = await HybridCrypto.hash(data);
    if (this.hashCache.size < this.maxCacheSize) {
      this.hashCache.set(data, hash);
    }
    return hash;
  }

  /**
   * Clears the hash cache
   */
  public clearCache(): void {
    this.hashCache.clear();
  }

  /**
   * Gets the current tree depth
   * @returns Number of layers in the tree
   */
  public getDepth(): number {
    return this.layers.length;
  }

  /**
   * Gets the number of leaves in the tree
   * @returns Number of leaves
   */
  public getLeafCount(): number {
    return this.leaves.length;
  }

  public clearState(): void {
    this.leaves = [];
    this.layers = [];
    this.hashCache.clear();
    this.rootCache.clear();
  }

  private cleanupLayers(): void {
    // Keep only the leaves and root if memory optimization is needed
    if (this.layers.length > 2) {
      const root = this.layers[0];
      const leaves = this.layers[this.layers.length - 1];
      this.layers = [root, leaves];
    }
  }

  public removeHash(hash: string): void {
    // Remove hash from cache
    this.hashCache.delete(hash);
    const index = this.leaves.indexOf(hash);
    if (index > -1) {
      this.leaves.splice(index, 1);
    }
  }

  public getCachedRoot(key: string): string | undefined {
    return this.rootCache.get(key);
  }

  public cacheRoot(key: string, root: string): void {
    if (this.rootCache.size < this.maxCacheSize) {
      this.rootCache.set(key, root);
    }
  }
}
