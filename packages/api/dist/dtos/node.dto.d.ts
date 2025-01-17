import { NetworkType } from "@h3tag-blockchain/shared";
export declare class CreateNodeDto {
    networkType: NetworkType;
    region?: string;
    nodeType?: "full" | "light" | "archive";
    port?: number;
    host?: string;
}
export declare class NodeResponseDto {
    nodeId: string;
    status: "running" | "stopped";
    endpoint: string;
    networkType: string;
    peerCount: number;
    region?: string;
}
export declare class NodeStatusDto {
    nodeId: string;
    status: "running" | "stopped";
    peerCount: number;
    bannedPeers: string[];
    address: string;
}
export declare class PeerDiscoveryResponseDto {
    discoveredPeers: number;
    totalPeers: number;
    peerMetrics: {
        current: number;
        minimum: number;
    };
}
export declare class ConnectPeerDto {
    address: string;
}
export declare class PeerConnectionResponseDto {
    status: string;
    address: string;
    version: string;
    height: number;
    connectedAt: string;
}
