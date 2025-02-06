import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { NodeService } from '../services/node.service';
import {
  CreateNodeDto,
  NodeResponseDto,
  NodeStatusDto,
  PeerDiscoveryResponseDto,
  ConnectPeerDto,
  PeerConnectionResponseDto,
  NetworkType,
} from '../dtos/node.dto';

@ApiTags('Nodes')
@Controller('nodes')
export class NodeController {
  constructor(private readonly nodeService: NodeService) {}

  @Post('testnet')
  @ApiOperation({ summary: 'Create a new TESTNET node' })
  @ApiResponse({
    status: 201,
    description: 'Node created successfully',
    type: NodeResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to create node',
    schema: {
      properties: {
        message: { type: 'string' },
        statusCode: { type: 'number' },
      },
    },
  })
  async createTestnetNode(
    @Body() createNodeDto: CreateNodeDto,
  ): Promise<NodeResponseDto> {
    try {
      return await this.nodeService.createNode({
        ...createNodeDto,
        networkType: NetworkType.TESTNET,
        port: createNodeDto.port || 4000,
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new HttpException(
          `Failed to create TESTNET node: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        'Failed to create TESTNET node',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('mainnet')
  @ApiOperation({ summary: 'Create a new MAINNET node' })
  @ApiResponse({
    status: 201,
    description: 'Node created successfully',
    type: NodeResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to create node',
    schema: {
      properties: {
        message: { type: 'string' },
        statusCode: { type: 'number' },
      },
    },
  })
  async createMainnetNode(
    @Body() createNodeDto: CreateNodeDto,
  ): Promise<NodeResponseDto> {
    try {
      return await this.nodeService.createNode({
        ...createNodeDto,
        networkType: NetworkType.MAINNET,
        port: createNodeDto.port || 3000,
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new HttpException(
          `Failed to create MAINNET node: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        'Failed to create MAINNET node',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':nodeId/status')
  @ApiOperation({ summary: 'Get node status' })
  @ApiParam({
    name: 'nodeId',
    description: 'Node identifier',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Node status retrieved successfully',
    type: NodeStatusDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Node not found',
  })
  async getNodeStatus(
    @Param('nodeId') nodeId: string,
  ): Promise<NodeStatusDto> {
    try {
      return await this.nodeService.getNodeStatus(nodeId);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new HttpException(
          `Node not found: ${error.message}`,
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        `Failed to get node status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':nodeId/stop')
  @ApiOperation({ summary: 'Stop a running node' })
  @ApiParam({
    name: 'nodeId',
    description: 'Node identifier',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Node stopped successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'stopped' },
        nodeId: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Node not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to stop node',
  })
  async stopNode(
    @Param('nodeId') nodeId: string,
  ): Promise<{ status: string; nodeId: string }> {
    try {
      const success = await this.nodeService.stopNode(nodeId);
      if (success) {
        return { status: 'stopped', nodeId };
      }
      throw new Error('Node not found');
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new HttpException(
          `Node not found: ${error.message}`,
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        `Failed to stop node: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':nodeId/validators')
  @ApiOperation({ summary: 'Get active validators for a node' })
  @ApiParam({
    name: 'nodeId',
    description: 'Node identifier',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Active validators retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Node not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to get validators',
  })
  async getActiveValidators(@Param('nodeId') nodeId: string) {
    try {
      return await this.nodeService.getActiveValidators(nodeId);
    } catch (error: unknown) {
      throw new HttpException(
        `Failed to get validators: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':nodeId/discover-peers')
  @ApiOperation({ summary: 'Trigger peer discovery for a node' })
  @ApiParam({
    name: 'nodeId',
    description: 'Node identifier',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Peer discovery completed successfully',
    type: PeerDiscoveryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Node not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to discover peers',
  })
  async discoverPeers(
    @Param('nodeId') nodeId: string,
  ): Promise<PeerDiscoveryResponseDto> {
    try {
      return await this.nodeService.discoverPeers(nodeId);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new HttpException('Node not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        `Failed to discover peers: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':nodeId/connect-peer')
  @ApiOperation({ summary: 'Connect to a specific peer' })
  @ApiParam({
    name: 'nodeId',
    description: 'Node identifier',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully connected to peer',
    type: PeerConnectionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Node not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid peer address or connection failed',
  })
  async connectToPeer(
    @Param('nodeId') nodeId: string,
    @Body() connectPeerDto: ConnectPeerDto,
  ): Promise<PeerConnectionResponseDto> {
    try {
      return await this.nodeService.connectToPeer(nodeId, connectPeerDto.address);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          throw new HttpException('Node not found', HttpStatus.NOT_FOUND);
        }
        throw new HttpException(
          `Failed to connect to peer: ${error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException('Failed to connect to peer', HttpStatus.BAD_REQUEST);
    }
  }
}
