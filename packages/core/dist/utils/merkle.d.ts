export interface MerkleProof {
    index: number;
    hash: string;
    siblings: string[];
}
export declare class MerkleTree {
    private leaves;
    private layers;
    private readonly hashCache;
    private readonly maxCacheSize;
    /**
     * Creates a Merkle root from an array of data
     * @param data Array of strings to create merkle tree from
     * @returns Root hash of the merkle tree
     */
    createRoot(data: string[]): Promise<string>;
    /**
     * Verifies if data belongs to the merkle tree with given root
     * @param root Merkle root to verify against
     * @param data Array of data to verify
     * @returns Boolean indicating if verification passed
     */
    verify(root: string, data: string[]): Promise<boolean>;
    /**
     * Generates a merkle proof for a specific leaf
     * @param index Index of the leaf to generate proof for
     * @returns MerkleProof object containing proof data
     */
    generateProof(index: number): Promise<MerkleProof>;
    /**
     * Verifies a merkle proof
     * @param proof MerkleProof object containing proof data
     * @param data Array of data to verify
     * @param root Merkle root to verify against
     * @returns Boolean indicating if proof is valid
     */
    verifyProof(proof: MerkleProof, data: string, root: string): Promise<boolean>;
    /**
     * Creates a new layer in the merkle tree
     * @param nodes Array of node hashes
     * @returns Array of parent node hashes
     */
    private createLayer;
    /**
     * Hashes a pair of nodes together
     * @param left Left node hash
     * @param right Right node hash
     * @returns Combined hash of both nodes
     */
    private hashPair;
    /**
     * Hashes individual data items
     * @param data Data to hash
     * @returns Hash of the data
     */
    private hashData;
    /**
     * Clears the hash cache
     */
    clearCache(): void;
    /**
     * Gets the current tree depth
     * @returns Number of layers in the tree
     */
    getDepth(): number;
    /**
     * Gets the number of leaves in the tree
     * @returns Number of leaves
     */
    getLeafCount(): number;
    clearState(): void;
    private cleanupLayers;
    removeHash(hash: string): void;
}
