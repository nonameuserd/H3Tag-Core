import { ApiProperty } from '@nestjs/swagger';

export class CreateNodeDto {
  @ApiProperty({
    enum: ['MAINNET', 'TESTNET'],
    description: 'Network type for the node',
  })
  networkType: 'MAINNET' | 'TESTNET' | undefined;

  @ApiProperty({ required: false })
  region?: string;

  @ApiProperty({
    enum: ['full', 'light', 'archive'],
    required: false,
  })
  nodeType?: 'full' | 'light' | 'archive';

  @ApiProperty({ required: false, default: 3000 })
  port?: number;

  @ApiProperty({ required: false, default: 'localhost' })
  host?: string;
}

export class NodeResponseDto {
  @ApiProperty()
  nodeId: string | undefined;

  @ApiProperty({ enum: ['running', 'stopped'] })
  status: 'running' | 'stopped' | undefined;

  @ApiProperty()
  endpoint: string | undefined;

  @ApiProperty()
  networkType: string | undefined;

  @ApiProperty()
  peerCount: number | undefined;

  @ApiProperty({ required: false })
  region?: string;
}

export class NodeStatusDto {
  @ApiProperty()
  nodeId: string | undefined;

  @ApiProperty({ enum: ['running', 'stopped'] })
  status: 'running' | 'stopped' | undefined;

  @ApiProperty()
  peerCount: number | undefined;

  @ApiProperty({ type: [String] })
  bannedPeers: string[] | undefined;

  @ApiProperty()
  address: string | undefined;
}

export class PeerDiscoveryResponseDto {
  @ApiProperty({
    description: 'Number of new peers discovered',
    example: 5,
  })
  discoveredPeers: number | undefined;

  @ApiProperty({
    description: 'Total number of connected peers',
    example: 12,
  })
  totalPeers: number | undefined;

  @ApiProperty({
    description: 'Current peer count vs minimum required peers',
    example: {
      current: 12,
      minimum: 8,
    },
  })
  peerMetrics:
    | {
        current: number | undefined;
        minimum: number | undefined;
      }
    | undefined;
}

export class ConnectPeerDto {
  @ApiProperty({
    description: 'Peer address to connect to',
    example: '127.0.0.1:8333',
  })
  address: string | undefined;
}

export class PeerConnectionResponseDto {
  @ApiProperty({
    description: 'Connection status',
    example: 'connected',
  })
  status: string | undefined;

  @ApiProperty({
    description: 'Connected peer address',
    example: '127.0.0.1:8333',
  })
  address: string | undefined;

  @ApiProperty({
    description: 'Peer version',
    example: '1.0.0',
  })
  version: string | undefined;

  @ApiProperty({
    description: 'Peer height',
    example: 780000,
  })
  height: number | undefined;

  @ApiProperty({
    description: 'Connection timestamp',
    example: '2024-03-21T15:30:00Z',
  })
  connectedAt: string | undefined;
}
