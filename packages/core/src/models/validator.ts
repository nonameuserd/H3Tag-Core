import { MerkleTree, MerkleProof } from "../utils/merkle";
import { Logger } from "@h3tag-blockchain/shared";

export interface Validator {
  id: string;
  publicKey: string;
  lastActive: number;
  powHashRate?: number;
  reputation: number;
  merkleProof?: MerkleProof;
  signature?: string;
  address: string;
  isActive: boolean;
  isSuspended: boolean;
  isAbsent: boolean;
  uptime: number;
  metrics: {
    uptime: number;
    voteParticipation: number;
    blockProduction: number;
  };
  validationData: string;
}

export class ValidatorSet {
  private merkleTree: MerkleTree;
  private validators: Map<string, Validator>;

  constructor() {
    this.merkleTree = new MerkleTree();
    this.validators = new Map();
  }

  async addValidator(validator: Validator): Promise<void> {
    if (!validator?.id || !validator?.publicKey) {
      throw new Error("Invalid validator data");
    }

    const validatorData = `${validator.id}:${validator.publicKey}:${validator.lastActive}:${validator.reputation}`;
    const validators = Array.from(this.validators.values()).map(
      (v) => `${v.id}:${v.publicKey}:${v.lastActive}:${v.reputation}`
    );
    validators.push(validatorData);

    const merkleRoot = await this.merkleTree.createRoot(validators);
    const proof = await this.merkleTree.generateProof(validators.length - 1);

    this.validators.set(validator.id, {
      ...validator,
      merkleProof: proof,
    });
  }

  async verifyValidator(
    validator: Validator,
    merkleRoot?: string
  ): Promise<boolean> {
    if (!validator?.merkleProof || !merkleRoot) return false;

    try {
      const validatorData = `${validator.id}:${validator.publicKey}:${validator.lastActive}:${validator.reputation}`;
      return await this.merkleTree.verifyProof(
        validator.merkleProof,
        validatorData,
        merkleRoot
      );
    } catch (error) {
      Logger.error("Validator verification failed:", error);
      return false;
    }
  }

  async cleanup(): Promise<void> {
    try {
      this.merkleTree?.clearCache();
      this.validators.clear();
    } catch (error) {
      Logger.error("ValidatorSet cleanup failed:", error);
    }
  }
}
