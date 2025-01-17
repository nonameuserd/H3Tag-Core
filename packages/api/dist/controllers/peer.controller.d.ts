import { PeerService } from "../services/peer.service";
import { CreatePeerDto, PeerResponseDto, SetBanDto, BanInfoDto, NetworkInfoDto, PeerDetailedInfoDto } from "../dtos/peer.dto";
export declare class PeerController {
    private readonly peerService;
    constructor(peerService: PeerService);
    addPeer(createPeerDto: CreatePeerDto): Promise<PeerResponseDto>;
    getPeers(): Promise<PeerResponseDto[]>;
    removePeer(peerId: string): Promise<void>;
    banPeer(peerId: string): Promise<PeerResponseDto>;
    setBan(setBanDto: SetBanDto): Promise<void>;
    listBans(): Promise<BanInfoDto[]>;
    getBanInfo(ip: string): Promise<BanInfoDto>;
    clearBans(): Promise<void>;
    getNetworkInfo(): Promise<NetworkInfoDto>;
    getPeerInfo(peerId: string): Promise<PeerDetailedInfoDto>;
}
