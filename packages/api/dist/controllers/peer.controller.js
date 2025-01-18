"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeerController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const peer_dto_1 = require("../dtos/peer.dto");
let PeerController = class PeerController {
    constructor(peerService) {
        this.peerService = peerService;
    }
    async addPeer(createPeerDto) {
        try {
            return await this.peerService.addPeer(createPeerDto);
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to add peer: ${error.message}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async getPeers() {
        try {
            return await this.peerService.getPeers();
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to get peers: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async removePeer(peerId) {
        try {
            await this.peerService.removePeer(peerId);
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to remove peer: ${error.message}`, common_1.HttpStatus.NOT_FOUND);
        }
    }
    async banPeer(peerId) {
        try {
            return await this.peerService.banPeer(peerId);
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to ban peer: ${error.message}`, common_1.HttpStatus.NOT_FOUND);
        }
    }
    async setBan(setBanDto) {
        try {
            await this.peerService.setBan(setBanDto);
        }
        catch (error) {
            common_1.Logger.error("Failed to set ban status:", error);
            throw new common_1.HttpException(`Failed to set ban status: ${error.message}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async listBans() {
        try {
            return await this.peerService.listBans();
        }
        catch (error) {
            common_1.Logger.error("Failed to list bans:", error);
            throw new common_1.HttpException(`Failed to list bans: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getBanInfo(ip) {
        try {
            return await this.peerService.getBanInfo(ip);
        }
        catch (error) {
            common_1.Logger.error("Failed to get ban info:", error);
            throw new common_1.HttpException(`Failed to get ban info: ${error.message}`, common_1.HttpStatus.NOT_FOUND);
        }
    }
    async clearBans() {
        try {
            await this.peerService.clearBans();
        }
        catch (error) {
            common_1.Logger.error("Failed to clear bans:", error);
            throw new common_1.HttpException(`Failed to clear bans: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getNetworkInfo() {
        try {
            return await this.peerService.getNetworkInfo();
        }
        catch (error) {
            common_1.Logger.error("Failed to get network info:", error);
            throw new common_1.HttpException(`Failed to get network info: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getPeerInfo(peerId) {
        try {
            return await this.peerService.getPeerInfo(peerId);
        }
        catch (error) {
            common_1.Logger.error("Failed to get peer info:", error);
            throw new common_1.HttpException(`Peer not found: ${error.message}`, common_1.HttpStatus.NOT_FOUND);
        }
    }
};
exports.PeerController = PeerController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: "Add a new peer" }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: "Peer added successfully",
        type: peer_dto_1.PeerResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: "Invalid peer data",
    }),
    __param(0, (0, common_1.Body)())
], PeerController.prototype, "addPeer", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: "Get all peers" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "List of all peers",
        type: [peer_dto_1.PeerResponseDto],
    })
], PeerController.prototype, "getPeers", null);
__decorate([
    (0, common_1.Delete)(":peerId"),
    (0, swagger_1.ApiOperation)({ summary: "Remove a peer" }),
    (0, swagger_1.ApiParam)({
        name: "peerId",
        description: "Peer identifier",
        required: true,
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Peer removed successfully",
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: "Peer not found",
    }),
    __param(0, (0, common_1.Param)("peerId"))
], PeerController.prototype, "removePeer", null);
__decorate([
    (0, common_1.Post)(":peerId/ban"),
    (0, swagger_1.ApiOperation)({ summary: "Ban a peer" }),
    (0, swagger_1.ApiParam)({
        name: "peerId",
        description: "Peer identifier",
        required: true,
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Peer banned successfully",
        type: peer_dto_1.PeerResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: "Peer not found",
    }),
    __param(0, (0, common_1.Param)("peerId"))
], PeerController.prototype, "banPeer", null);
__decorate([
    (0, common_1.Post)("ban"),
    (0, swagger_1.ApiOperation)({ summary: "Set ban status for a peer" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Ban status set successfully",
    }),
    __param(0, (0, common_1.Body)())
], PeerController.prototype, "setBan", null);
__decorate([
    (0, common_1.Get)("bans"),
    (0, swagger_1.ApiOperation)({ summary: "List all banned peers" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "List of banned peers",
        type: [peer_dto_1.BanInfoDto],
    })
], PeerController.prototype, "listBans", null);
__decorate([
    (0, common_1.Get)("ban/:ip"),
    (0, swagger_1.ApiOperation)({ summary: "Get ban information for a specific IP" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Ban information retrieved successfully",
        type: peer_dto_1.BanInfoDto,
    }),
    __param(0, (0, common_1.Param)("ip"))
], PeerController.prototype, "getBanInfo", null);
__decorate([
    (0, common_1.Delete)("bans"),
    (0, swagger_1.ApiOperation)({ summary: "Clear all bans" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "All bans cleared successfully",
    })
], PeerController.prototype, "clearBans", null);
__decorate([
    (0, common_1.Get)("network"),
    (0, swagger_1.ApiOperation)({ summary: "Get network information" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Network information retrieved successfully",
        type: peer_dto_1.NetworkInfoDto,
    })
], PeerController.prototype, "getNetworkInfo", null);
__decorate([
    (0, common_1.Get)(":peerId/info"),
    (0, swagger_1.ApiOperation)({ summary: "Get detailed peer information" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Peer information retrieved successfully",
        type: peer_dto_1.PeerDetailedInfoDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: "Peer not found",
    }),
    __param(0, (0, common_1.Param)("peerId"))
], PeerController.prototype, "getPeerInfo", null);
exports.PeerController = PeerController = __decorate([
    (0, swagger_1.ApiTags)("Peers"),
    (0, common_1.Controller)("peers")
], PeerController);
