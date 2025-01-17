import { MerkleProof } from "../utils/merkle";
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
export declare class ValidatorSet {
    private merkleTree;
    private validators;
    constructor();
    addValidator(validator: Validator): Promise<void>;
    verifyValidator(validator: Validator, merkleRoot?: string): Promise<boolean>;
    cleanup(): Promise<void>;
}
