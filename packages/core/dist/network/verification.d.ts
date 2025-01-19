export interface NodeInfo {
    version: string;
    height: number;
    peers: number;
    isMiner: boolean;
    publicKey: string;
    signature: string;
    timestamp: number;
    address: string;
    tagInfo: {
        minedBlocks: number;
        voteParticipation: number;
        lastVoteHeight: number;
        currency: string;
        votingPower?: number;
    };
}
export declare class VerificationError extends Error {
    constructor(message: string);
}
export declare class NodeVerifier {
    private static readonly MIN_VERSION;
    private static readonly MAX_TIMESTAMP_DRIFT;
    private static readonly MIN_VOTING_POWER;
    private static readonly MIN_PARTICIPATION_RATE;
    private static readonly MIN_POW_BLOCKS;
    private static readonly VERIFICATION_TIMEOUT;
    static verifyNode(nodeInfo: NodeInfo): Promise<boolean>;
    private static verifyNodeWithTimeout;
    private static verifyRequirements;
    private static validateSignature;
    private static isValidNodeInfo;
    private static validateVersion;
    private static validateTimestamp;
    /**
     * Validates a node's network address format and security requirements
     * @param {string} address - The node address to validate
     * @throws {VerificationError} If the address is invalid
     */
    static validateNodeAddress(address: string): void;
}
