import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsNumber } from 'class-validator';

export enum NetworkType {
  MAINNET = 'MAINNET',
  TESTNET = 'TESTNET',
}

export enum NodeType {
  FULL = 'full',
  LIGHT = 'light',
  ARCHIVE = 'archive',
}

export class CreateNodeDto {
  @ApiProperty({
    enum: NetworkType,
    description: 'Network type for the node',
  })
  @IsEnum(NetworkType)
  networkType: NetworkType = NetworkType.MAINNET;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiProperty({
    enum: NodeType,
    required: false,
  })
  @IsOptional()
  @IsEnum(NodeType)
  nodeType?: NodeType;

  @ApiProperty({ required: false, default: 3000 })
  @IsOptional()
  @IsNumber()
  port?: number;

  @ApiProperty({ required: false, default: 'localhost' })
  @IsOptional()
  @IsString()
  host?: string;
}

export class NodeResponseDto {
  @ApiProperty()
  nodeId = '';

  @ApiProperty({ enum: ['running', 'stopped'] })
  status: 'running' | 'stopped' = 'running';

  @ApiProperty()
  endpoint = '';

  @ApiProperty()
  networkType = '';

  @ApiProperty()
  peerCount = 0;

  @ApiProperty({ required: false })
  region?: string;
}

export class NodeStatusDto {
  @ApiProperty()
  nodeId = '';

  @ApiProperty({ enum: ['running', 'stopped'] })
  status: 'running' | 'stopped' = 'running';

  @ApiProperty()
  peerCount = 0;

  @ApiProperty({ type: [String] })
  bannedPeers: string[] = [];

  @ApiProperty()
  address = '';
}

export class PeerDiscoveryResponseDto {
  @ApiProperty({
    description: 'Number of new peers discovered',
    example: 5,
  })
  discoveredPeers = 0;

  @ApiProperty({
    description: 'Total number of connected peers',
    example: 12,
  })
  totalPeers = 0;

  @ApiProperty({
    description: 'Current peer count vs minimum required peers',
    example: {
      current: 12,
      minimum: 8,
    },
  })
  peerMetrics: {
    current: number;
    minimum: number;
  } = {
    current: 0,
    minimum: 0,
  };
}

export class ConnectPeerDto {
  @ApiProperty({
    description: 'Peer address to connect to',
    example: '127.0.0.1:2333',
  })
  @IsString()
  address = '';
}

export class PeerConnectionResponseDto {
  @ApiProperty({
    description: 'Connection status',
    example: 'connected',
  })
  status = '';

  @ApiProperty({
    description: 'Connected peer address',
    example: '127.0.0.1:2333',
  })
  address = '';

  @ApiProperty({
    description: 'Peer version',
    example: '1.0.0',
  })
  version = '';

  @ApiProperty({
    description: 'Peer height',
    example: 780000,
  })
  height = 0;

  @ApiProperty({
    description: 'Connection timestamp',
    example: '2024-03-21T15:30:00Z',
  })
  connectedAt = '';
}
