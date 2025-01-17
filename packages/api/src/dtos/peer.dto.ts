import { ApiProperty } from "@nestjs/swagger";

export class CreatePeerDto {
  @ApiProperty({
    description: "Peer node address",
    example: "localhost:3000",
  })
  address: string;

  @ApiProperty({
    description: "Peer node public key",
    example: "base64_encoded_public_key",
  })
  publicKey: string;

  @ApiProperty({
    description: "Network type of the peer",
    enum: ["MAINNET", "TESTNET"],
    example: "MAINNET",
  })
  networkType: string;
}

export class PeerResponseDto {
  @ApiProperty({
    description: "Unique peer ID",
    example: "peer_123",
  })
  peerId: string;

  @ApiProperty({
    description: "Peer node address",
    example: "localhost:3000",
  })
  address: string;

  @ApiProperty({
    description: "Connection status",
    enum: ["connected", "disconnected", "banned"],
    example: "connected",
  })
  status: string;

  @ApiProperty({
    description: "Protocol version",
    example: "1.0.0",
  })
  version: string;

  @ApiProperty({
    description: "Last seen timestamp",
    example: "2024-03-20T10:30:00Z",
  })
  lastSeen: string;

  @ApiProperty({
    description: "Connection latency in milliseconds",
    example: 50,
  })
  latency: number;

  @ApiProperty({
    description: "Current blockchain height",
    example: 1000000,
  })
  height: number;

  @ApiProperty({
    description: "Supported services bitmask",
    example: 1,
  })
  services: number;

  @ApiProperty({
    description: "Whether the peer is a miner",
    example: true,
  })
  isMiner?: boolean;

  @ApiProperty({
    description: "Tag-related information",
    example: {
      minedBlocks: 100,
      votingPower: 1000,
      voteParticipation: 0.95,
    },
  })
  tagInfo?: {
    minedBlocks: number;
    votingPower: number;
    voteParticipation: number;
  };
}

export class SetBanDto {
  @ApiProperty({
    description: "IP address to ban",
    example: "192.168.1.1",
  })
  ip: string;

  @ApiProperty({
    description: "Ban command (add/remove)",
    example: "add",
    enum: ["add", "remove"],
  })
  command: "add" | "remove";

  @ApiProperty({
    description: "Ban duration in seconds",
    example: 86400,
    required: false,
  })
  banTime?: number;

  @ApiProperty({
    description: "Reason for ban",
    example: "Malicious behavior",
    required: false,
  })
  reason?: string;
}

export class BanInfoDto {
  @ApiProperty({
    description: "IP address",
    example: "192.168.1.1",
  })
  ip: string;

  @ApiProperty({
    description: "Time until ban expires (seconds)",
    example: 3600,
  })
  timeRemaining: number;

  @ApiProperty({
    description: "Reason for ban",
    example: "Malicious behavior",
  })
  reason: string;

  @ApiProperty({
    description: "Time when ban was created",
    example: "2024-03-21T10:00:00Z",
  })
  createdAt: string;
}

export class NetworkInfoDto {
  @ApiProperty({
    description: "Version of the node",
    example: "1.0.0",
  })
  version: string;

  @ApiProperty({
    description: "Protocol version",
    example: 70015,
  })
  protocolVersion: number;

  @ApiProperty({
    description: "Total number of connections",
    example: 8,
  })
  connections: number;

  @ApiProperty({
    description: "Number of inbound connections",
    example: 3,
  })
  inbound: number;

  @ApiProperty({
    description: "Number of outbound connections",
    example: 5,
  })
  outbound: number;

  @ApiProperty({
    description: "Whether the network is reachable",
    example: true,
  })
  networkActive: boolean;

  @ApiProperty({
    description: "List of local addresses",
    example: ["192.168.1.1:8333", "10.0.0.1:8333"],
  })
  localAddresses: string[];
}

export class PeerDetailedInfoDto {
  @ApiProperty({ description: "Peer ID" })
  id: string;

  @ApiProperty({ description: "Peer IP address" })
  address: string;

  @ApiProperty({ description: "Peer port number" })
  port: number;

  @ApiProperty({ description: "Peer version" })
  version: string;

  @ApiProperty({ description: "Peer connection state" })
  state: string;

  @ApiProperty({ description: "Peer services" })
  services: number;

  @ApiProperty({ description: "Last seen timestamp" })
  lastSeen: number;

  @ApiProperty({ description: "Last send timestamp" })
  lastSend: number;

  @ApiProperty({ description: "Number of synced blocks" })
  syncedBlocks: number;

  @ApiProperty({ description: "Blocks currently in flight" })
  inflight: number[];

  @ApiProperty({ description: "Whether peer is whitelisted" })
  whitelisted: boolean;

  @ApiProperty({ description: "Whether peer is blacklisted" })
  blacklisted: boolean;

  @ApiProperty({ description: "Peer capabilities" })
  capabilities: string[];

  @ApiProperty({ description: "Peer user agent" })
  userAgent: string;
}
