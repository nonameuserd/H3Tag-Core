import { ApiProperty } from "@nestjs/swagger";

export class CreateNodeDto {
  @ApiProperty({
    enum: ["MAINNET", "TESTNET"],
    description: "Network type for the node",
  })
  networkType: "MAINNET" | "TESTNET";

  @ApiProperty({ required: false })
  region?: string;

  @ApiProperty({
    enum: ["full", "light", "archive"],
    required: false,
  })
  nodeType?: "full" | "light" | "archive";

  @ApiProperty({ required: false, default: 3000 })
  port?: number;

  @ApiProperty({ required: false, default: "localhost" })
  host?: string;
}

export class NodeResponseDto {
  @ApiProperty()
  nodeId: string;

  @ApiProperty({ enum: ["running", "stopped"] })
  status: "running" | "stopped";

  @ApiProperty()
  endpoint: string;

  @ApiProperty()
  networkType: string;

  @ApiProperty()
  peerCount: number;

  @ApiProperty({ required: false })
  region?: string;
}

export class NodeStatusDto {
  @ApiProperty()
  nodeId: string;

  @ApiProperty({ enum: ["running", "stopped"] })
  status: "running" | "stopped";

  @ApiProperty()
  peerCount: number;

  @ApiProperty({ type: [String] })
  bannedPeers: string[];

  @ApiProperty()
  address: string;
}

export class PeerDiscoveryResponseDto {
  @ApiProperty({
    description: "Number of new peers discovered",
    example: 5,
  })
  discoveredPeers: number;

  @ApiProperty({
    description: "Total number of connected peers",
    example: 12,
  })
  totalPeers: number;

  @ApiProperty({
    description: "Current peer count vs minimum required peers",
    example: {
      current: 12,
      minimum: 8,
    },
  })
  peerMetrics: {
    current: number;
    minimum: number;
  };
}

export class ConnectPeerDto {
  @ApiProperty({
    description: "Peer address to connect to",
    example: "127.0.0.1:8333",
  })
  address: string;
}

export class PeerConnectionResponseDto {
  @ApiProperty({
    description: "Connection status",
    example: "connected",
  })
  status: string;

  @ApiProperty({
    description: "Connected peer address",
    example: "127.0.0.1:8333",
  })
  address: string;

  @ApiProperty({
    description: "Peer version",
    example: "1.0.0",
  })
  version: string;

  @ApiProperty({
    description: "Peer height",
    example: 780000,
  })
  height: number;

  @ApiProperty({
    description: "Connection timestamp",
    example: "2024-03-21T15:30:00Z",
  })
  connectedAt: string;
}
