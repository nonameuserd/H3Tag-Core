import { ApiProperty } from '@nestjs/swagger';

export class CreatePeerDto {
  @ApiProperty({
    description: 'Peer node address',
    example: 'localhost:3000',
  })
  address: string = '';

  @ApiProperty({
    description: 'Peer node public key',
    example: 'base64_encoded_public_key',
    required: false,
  })
  publicKey?: string;

  @ApiProperty({
    description: 'Network type of the peer',
    enum: ['MAINNET', 'TESTNET'],
    example: 'MAINNET',
    required: false,
  })
  networkType?: string;
}

export class PeerResponseDto {
  @ApiProperty({
    description: 'Unique peer ID',
    example: 'peer_123',
  })
  peerId: string | undefined;

  @ApiProperty({
    description: 'Peer node address',
    example: 'localhost:3000',
  })
  address: string | undefined;

  @ApiProperty({
    description: 'Connection status',
    enum: ['connected', 'disconnected', 'banned'],
    example: 'connected',
  })
  status: string | undefined;

  @ApiProperty({
    description: 'Protocol version',
    example: '1.0.0',
  })
  version: string | undefined;

  @ApiProperty({
    description: 'Last seen timestamp',
    example: '2024-03-20T10:30:00Z',
  })
  lastSeen: string | undefined;

  @ApiProperty({
    description: 'Connection latency in milliseconds',
    example: 50,
  })
  latency: number | undefined;

  @ApiProperty({
    description: 'Current blockchain height',
    example: 1000000,
  })
  height: number | undefined;

  @ApiProperty({
    description: 'Supported services bitmask',
    example: 1,
  })
  services: number | undefined;

  @ApiProperty({
    description: 'Whether the peer is a miner',
    example: true,
  })
  isMiner?: boolean | undefined;

  @ApiProperty({
    description: 'Tag-related information',
    example: {
      minedBlocks: 100,
      votingPower: 1000,
      voteParticipation: 0.95,
    },
  })
  tagInfo?:
    | {
        minedBlocks: number | undefined;
        votingPower: number | undefined;
        voteParticipation: number | undefined;
      }
    | undefined;
}

export class SetBanDto {
  @ApiProperty({
    description: 'IP address to ban',
    example: '192.168.1.1',
  })
  ip: string | undefined;

  @ApiProperty({
    description: 'Ban command (add/remove)',
    example: 'add',
    enum: ['add', 'remove'],
  })
  command: 'add' | 'remove' | undefined;

  @ApiProperty({
    description: 'Ban duration in seconds',
    example: 86400,
    required: false,
  })
  banTime?: number | undefined;

  @ApiProperty({
    description: 'Reason for ban',
    example: 'Malicious behavior',
    required: false,
  })
  reason?: string | undefined;
}

export class BanInfoDto {
  @ApiProperty({
    description: 'IP address',
    example: '192.168.1.1',
  })
  ip: string | undefined;

  @ApiProperty({
    description: 'Time until ban expires (seconds)',
    example: 3600,
  })
  timeRemaining: number | undefined;

  @ApiProperty({
    description: 'Reason for ban',
    example: 'Malicious behavior',
  })
  reason: string | undefined;

  @ApiProperty({
    description: 'Time when ban was created',
    example: '2024-03-21T10:00:00Z',
  })
  createdAt: string | undefined;
}

export class NetworkInfoDto {
  @ApiProperty({
    description: 'Version of the node',
    example: '1.0.0',
  })
  version: string | undefined;

  @ApiProperty({
    description: 'Protocol version',
    example: 70015,
  })
  protocolVersion: number | undefined;

  @ApiProperty({
    description: 'Total number of connections',
    example: 8,
  })
  connections: number | undefined;

  @ApiProperty({
    description: 'Number of inbound connections',
    example: 3,
  })
  inbound: number | undefined;

  @ApiProperty({
    description: 'Number of outbound connections',
    example: 5,
  })
  outbound: number | undefined;

  @ApiProperty({
    description: 'Whether the network is reachable',
    example: true,
  })
  networkActive: boolean | undefined;

  @ApiProperty({
    description: 'List of local addresses',
    example: ['192.168.1.1:2333', '10.0.0.1:2333'],
  })
  localAddresses: string[] | undefined;
}

export class PeerDetailedInfoDto {
  @ApiProperty({ description: 'Peer ID' })
  id: string | undefined;

  @ApiProperty({ description: 'Peer IP address' })
  address: string | undefined;

  @ApiProperty({ description: 'Peer port number' })
  port: number | undefined;

  @ApiProperty({ description: 'Peer version' })
  version: string | undefined;

  @ApiProperty({ description: 'Peer connection state' })
  state: string | undefined;

  @ApiProperty({ description: 'Peer services' })
  services: number | undefined;

  @ApiProperty({ description: 'Last seen timestamp' })
  lastSeen: number | undefined;

  @ApiProperty({ description: 'Last send timestamp' })
  lastSend: number | undefined;

  @ApiProperty({ description: 'Number of synced blocks' })
  syncedBlocks: number | undefined;

  @ApiProperty({ description: 'Blocks currently in flight' })
  inflight: number[] | undefined;

  @ApiProperty({ description: 'Whether peer is whitelisted' })
  whitelisted: boolean | undefined;

  @ApiProperty({ description: 'Whether peer is blacklisted' })
  blacklisted: boolean | undefined;

  @ApiProperty({ description: 'Peer capabilities' })
  capabilities: string[] | undefined;

  @ApiProperty({ description: 'Peer user agent' })
  userAgent: string | undefined;
}
