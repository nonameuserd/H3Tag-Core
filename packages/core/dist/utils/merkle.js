"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerkleTree = void 0;
const crypto_1 = require("@h3tag-blockchain/crypto");
const shared_1 = require("@h3tag-blockchain/shared");
class MerkleTree {
    constructor() {
        this.leaves = [];
        this.layers = [];
        this.hashCache = new Map();
        this.maxCacheSize = 10000;
    }
    /**
     * Creates a Merkle root from an array of data
     * @param data Array of strings to create merkle tree from
     * @returns Root hash of the merkle tree
     */
    async createRoot(data) {
        try {
            if (!Array.isArray(data) || !data.length) {
                throw new Error('Invalid input: data must be non-empty array');
            }
            // Clear previous state
            this.clearState();
            // Initialize leaves with hashed data
            this.leaves = await Promise.all(data.map(item => this.hashData(item)));
            this.layers = [this.leaves];
            // Build tree layers until we reach the root
            while (this.layers[0].length > 1) {
                this.layers.unshift(await this.createLayer(this.layers[0]));
            }
            // Add cleanup after root creation
            this.cleanupLayers();
            return this.layers[0][0];
        }
        catch (error) {
            shared_1.Logger.error('Failed to create merkle root:', error);
            throw error;
        }
    }
    /**
     * Verifies if data belongs to the merkle tree with given root
     * @param root Merkle root to verify against
     * @param data Array of data to verify
     * @returns Boolean indicating if verification passed
     */
    async verify(root, data) {
        try {
            const computedRoot = await this.createRoot(data);
            return computedRoot === root;
        }
        catch (error) {
            shared_1.Logger.error('Merkle verification failed:', error);
            return false;
        }
    }
    /**
     * Generates a merkle proof for a specific leaf
     * @param index Index of the leaf to generate proof for
     * @returns MerkleProof object containing proof data
     */
    async generateProof(index) {
        try {
            if (index < 0 || index >= this.leaves.length) {
                throw new Error('Invalid leaf index');
            }
            const proof = {
                index,
                hash: this.leaves[index],
                siblings: []
            };
            let currentIndex = index;
            for (let i = this.layers.length - 1; i > 0; i--) {
                const layer = this.layers[i];
                const isRight = currentIndex % 2 === 1;
                const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
                if (siblingIndex < layer.length) {
                    proof.siblings.push(layer[siblingIndex]);
                }
                currentIndex = Math.floor(currentIndex / 2);
            }
            return proof;
        }
        catch (error) {
            shared_1.Logger.error('Failed to generate merkle proof:', error);
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
    async verifyProof(proof, data, root) {
        try {
            if (!proof || !root || !Array.isArray(proof.siblings) || proof.siblings.length === 0) {
                return false;
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
        }
        catch (error) {
            shared_1.Logger.error('Merkle proof verification failed:', error);
            return false;
        }
    }
    /**
     * Creates a new layer in the merkle tree
     * @param nodes Array of node hashes
     * @returns Array of parent node hashes
     */
    async createLayer(nodes) {
        const layer = [];
        for (let i = 0; i < nodes.length; i += 2) {
            const left = nodes[i];
            const right = i + 1 < nodes.length ? nodes[i + 1] : left;
            layer.push(await this.hashPair(left, right));
        }
        return layer;
    }
    /**
     * Hashes a pair of nodes together
     * @param left Left node hash
     * @param right Right node hash
     * @returns Combined hash of both nodes
     */
    async hashPair(left, right) {
        if (!left || !right || typeof left !== 'string' || typeof right !== 'string') {
            throw new Error('Invalid hash pair inputs');
        }
        const key = `${left}:${right}`;
        if (this.hashCache.has(key)) {
            return this.hashCache.get(key);
        }
        const combined = `${left}${right}`;
        const hash = await crypto_1.HybridCrypto.hash(combined);
        // Only cache if we haven't exceeded the limit
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
    async hashData(data) {
        if (this.hashCache.has(data)) {
            return this.hashCache.get(data);
        }
        const hash = await crypto_1.HybridCrypto.hash(data);
        this.hashCache.set(data, hash);
        return hash;
    }
    /**
     * Clears the hash cache
     */
    clearCache() {
        this.hashCache.clear();
    }
    /**
     * Gets the current tree depth
     * @returns Number of layers in the tree
     */
    getDepth() {
        return this.layers.length;
    }
    /**
     * Gets the number of leaves in the tree
     * @returns Number of leaves
     */
    getLeafCount() {
        return this.leaves.length;
    }
    clearState() {
        this.leaves = [];
        this.layers = [];
        this.hashCache.clear();
    }
    cleanupLayers() {
        // Keep only the leaves and root if memory optimization is needed
        if (this.layers.length > 2) {
            const root = this.layers[0];
            const leaves = this.layers[this.layers.length - 1];
            this.layers = [root, leaves];
        }
    }
    removeHash(hash) {
        // Remove hash from cache
        this.hashCache.delete(hash);
        const index = this.leaves.indexOf(hash);
        if (index > -1) {
            this.leaves.splice(index, 1);
        }
    }
}
exports.MerkleTree = MerkleTree;
//# sourceMappingURL=merkle.js.map