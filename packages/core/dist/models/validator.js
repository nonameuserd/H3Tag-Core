"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidatorSet = void 0;
const merkle_1 = require("../utils/merkle");
const shared_1 = require("@h3tag-blockchain/shared");
class ValidatorSet {
    constructor() {
        this.merkleTree = new merkle_1.MerkleTree();
        this.validators = new Map();
    }
    async addValidator(validator) {
        if (!validator?.id || !validator?.publicKey) {
            throw new Error("Invalid validator data");
        }
        const validatorData = `${validator.id}:${validator.publicKey}:${validator.lastActive}:${validator.reputation}`;
        const validators = Array.from(this.validators.values()).map((v) => `${v.id}:${v.publicKey}:${v.lastActive}:${v.reputation}`);
        validators.push(validatorData);
        const merkleRoot = await this.merkleTree.createRoot(validators);
        const proof = await this.merkleTree.generateProof(validators.length - 1);
        this.validators.set(validator.id, {
            ...validator,
            merkleProof: proof,
        });
    }
    async verifyValidator(validator, merkleRoot) {
        if (!validator?.merkleProof || !merkleRoot)
            return false;
        try {
            const validatorData = `${validator.id}:${validator.publicKey}:${validator.lastActive}:${validator.reputation}`;
            return await this.merkleTree.verifyProof(validator.merkleProof, validatorData, merkleRoot);
        }
        catch (error) {
            shared_1.Logger.error("Validator verification failed:", error);
            return false;
        }
    }
    async cleanup() {
        try {
            this.merkleTree?.clearCache();
            this.validators.clear();
        }
        catch (error) {
            shared_1.Logger.error("ValidatorSet cleanup failed:", error);
        }
    }
}
exports.ValidatorSet = ValidatorSet;
//# sourceMappingURL=validator.js.map