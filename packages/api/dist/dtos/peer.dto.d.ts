export declare class CreatePeerDto {
    address: string;
    publicKey: string;
    networkType: string;
}
export declare class PeerResponseDto {
    peerId: string;
    address: string;
    status: string;
    version: string;
    lastSeen: string;
    latency: number;
    height: number;
    services: number;
    isMiner?: boolean;
    tagInfo?: {
        minedBlocks: number;
        votingPower: number;
        voteParticipation: number;
    };
}
export declare class SetBanDto {
    ip: string;
    command: "add" | "remove";
    banTime?: number;
    reason?: string;
}
export declare class BanInfoDto {
    ip: string;
    timeRemaining: number;
    reason: string;
    createdAt: string;
}
export declare class NetworkInfoDto {
    version: string;
    protocolVersion: number;
    connections: number;
    inbound: number;
    outbound: number;
    networkActive: boolean;
    localAddresses: string[];
}
export declare class PeerDetailedInfoDto {
    id: string;
    address: string;
    port: number;
    version: string;
    state: string;
    services: number;
    lastSeen: number;
    lastSend: number;
    syncedBlocks: number;
    inflight: number[];
    whitelisted: boolean;
    blacklisted: boolean;
    capabilities: string[];
    userAgent: string;
}
