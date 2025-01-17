import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { PeerService } from "../services/peer.service";
import {
  CreatePeerDto,
  PeerResponseDto,
  SetBanDto,
  BanInfoDto,
  NetworkInfoDto,
  PeerDetailedInfoDto,
} from "../dtos/peer.dto";

@ApiTags("Peers")
@Controller("peers")
export class PeerController {
  constructor(private readonly peerService: PeerService) {}

  @Post()
  @ApiOperation({ summary: "Add a new peer" })
  @ApiResponse({
    status: 201,
    description: "Peer added successfully",
    type: PeerResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid peer data",
  })
  async addPeer(
    @Body() createPeerDto: CreatePeerDto
  ): Promise<PeerResponseDto> {
    try {
      return await this.peerService.addPeer(createPeerDto);
    } catch (error) {
      throw new HttpException(
        `Failed to add peer: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get()
  @ApiOperation({ summary: "Get all peers" })
  @ApiResponse({
    status: 200,
    description: "List of all peers",
    type: [PeerResponseDto],
  })
  async getPeers(): Promise<PeerResponseDto[]> {
    try {
      return await this.peerService.getPeers();
    } catch (error) {
      throw new HttpException(
        `Failed to get peers: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(":peerId")
  @ApiOperation({ summary: "Remove a peer" })
  @ApiParam({
    name: "peerId",
    description: "Peer identifier",
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: "Peer removed successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Peer not found",
  })
  async removePeer(@Param("peerId") peerId: string): Promise<void> {
    try {
      await this.peerService.removePeer(peerId);
    } catch (error) {
      throw new HttpException(
        `Failed to remove peer: ${error.message}`,
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Post(":peerId/ban")
  @ApiOperation({ summary: "Ban a peer" })
  @ApiParam({
    name: "peerId",
    description: "Peer identifier",
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: "Peer banned successfully",
    type: PeerResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Peer not found",
  })
  async banPeer(@Param("peerId") peerId: string): Promise<PeerResponseDto> {
    try {
      return await this.peerService.banPeer(peerId);
    } catch (error) {
      throw new HttpException(
        `Failed to ban peer: ${error.message}`,
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Post("ban")
  @ApiOperation({ summary: "Set ban status for a peer" })
  @ApiResponse({
    status: 200,
    description: "Ban status set successfully",
  })
  async setBan(@Body() setBanDto: SetBanDto): Promise<void> {
    try {
      await this.peerService.setBan(setBanDto);
    } catch (error) {
      Logger.error("Failed to set ban status:", error);
      throw new HttpException(
        `Failed to set ban status: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get("bans")
  @ApiOperation({ summary: "List all banned peers" })
  @ApiResponse({
    status: 200,
    description: "List of banned peers",
    type: [BanInfoDto],
  })
  async listBans(): Promise<BanInfoDto[]> {
    try {
      return await this.peerService.listBans();
    } catch (error) {
      Logger.error("Failed to list bans:", error);
      throw new HttpException(
        `Failed to list bans: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("ban/:ip")
  @ApiOperation({ summary: "Get ban information for a specific IP" })
  @ApiResponse({
    status: 200,
    description: "Ban information retrieved successfully",
    type: BanInfoDto,
  })
  async getBanInfo(@Param("ip") ip: string): Promise<BanInfoDto> {
    try {
      return await this.peerService.getBanInfo(ip);
    } catch (error) {
      Logger.error("Failed to get ban info:", error);
      throw new HttpException(
        `Failed to get ban info: ${error.message}`,
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Delete("bans")
  @ApiOperation({ summary: "Clear all bans" })
  @ApiResponse({
    status: 200,
    description: "All bans cleared successfully",
  })
  async clearBans(): Promise<void> {
    try {
      await this.peerService.clearBans();
    } catch (error) {
      Logger.error("Failed to clear bans:", error);
      throw new HttpException(
        `Failed to clear bans: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("network")
  @ApiOperation({ summary: "Get network information" })
  @ApiResponse({
    status: 200,
    description: "Network information retrieved successfully",
    type: NetworkInfoDto,
  })
  async getNetworkInfo(): Promise<NetworkInfoDto> {
    try {
      return await this.peerService.getNetworkInfo();
    } catch (error) {
      Logger.error("Failed to get network info:", error);
      throw new HttpException(
        `Failed to get network info: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(":peerId/info")
  @ApiOperation({ summary: "Get detailed peer information" })
  @ApiResponse({
    status: 200,
    description: "Peer information retrieved successfully",
    type: PeerDetailedInfoDto,
  })
  @ApiResponse({
    status: 404,
    description: "Peer not found",
  })
  async getPeerInfo(
    @Param("peerId") peerId: string
  ): Promise<PeerDetailedInfoDto> {
    try {
      return await this.peerService.getPeerInfo(peerId);
    } catch (error) {
      Logger.error("Failed to get peer info:", error);
      throw new HttpException(
        `Peer not found: ${error.message}`,
        HttpStatus.NOT_FOUND
      );
    }
  }
}
