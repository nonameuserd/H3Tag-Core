import { NodeService } from "../services/node.service";
import { CreateNodeDto, NodeResponseDto, NodeStatusDto, PeerDiscoveryResponseDto, ConnectPeerDto, PeerConnectionResponseDto } from "../dtos/node.dto";
export declare class NodeController {
    private readonly nodeService;
    constructor(nodeService: NodeService);
    createTestnetNode(createNodeDto: CreateNodeDto): Promise<NodeResponseDto>;
    createMainnetNode(createNodeDto: CreateNodeDto): Promise<NodeResponseDto>;
    getNodeStatus(nodeId: string): Promise<NodeStatusDto>;
    stopNode(nodeId: string): Promise<{
        status: string;
        nodeId: string;
    }>;
    getActiveValidators(nodeId: string): Promise<{
        address: string;
    }[]>;
    discoverPeers(nodeId: string): Promise<PeerDiscoveryResponseDto>;
    connectToPeer(nodeId: string, connectPeerDto: ConnectPeerDto): Promise<PeerConnectionResponseDto>;
}
