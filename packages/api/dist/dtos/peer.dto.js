"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeerDetailedInfoDto = exports.NetworkInfoDto = exports.BanInfoDto = exports.SetBanDto = exports.PeerResponseDto = exports.CreatePeerDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class CreatePeerDto {
}
exports.CreatePeerDto = CreatePeerDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Peer node address",
        example: "localhost:3000",
    })
], CreatePeerDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Peer node public key",
        example: "base64_encoded_public_key",
    })
], CreatePeerDto.prototype, "publicKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Network type of the peer",
        enum: ["MAINNET", "TESTNET"],
        example: "MAINNET",
    })
], CreatePeerDto.prototype, "networkType", void 0);
class PeerResponseDto {
}
exports.PeerResponseDto = PeerResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Unique peer ID",
        example: "peer_123",
    })
], PeerResponseDto.prototype, "peerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Peer node address",
        example: "localhost:3000",
    })
], PeerResponseDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Connection status",
        enum: ["connected", "disconnected", "banned"],
        example: "connected",
    })
], PeerResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Protocol version",
        example: "1.0.0",
    })
], PeerResponseDto.prototype, "version", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Last seen timestamp",
        example: "2024-03-20T10:30:00Z",
    })
], PeerResponseDto.prototype, "lastSeen", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Connection latency in milliseconds",
        example: 50,
    })
], PeerResponseDto.prototype, "latency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Current blockchain height",
        example: 1000000,
    })
], PeerResponseDto.prototype, "height", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Supported services bitmask",
        example: 1,
    })
], PeerResponseDto.prototype, "services", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Whether the peer is a miner",
        example: true,
    })
], PeerResponseDto.prototype, "isMiner", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Tag-related information",
        example: {
            minedBlocks: 100,
            votingPower: 1000,
            voteParticipation: 0.95,
        },
    })
], PeerResponseDto.prototype, "tagInfo", void 0);
class SetBanDto {
}
exports.SetBanDto = SetBanDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "IP address to ban",
        example: "192.168.1.1",
    })
], SetBanDto.prototype, "ip", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Ban command (add/remove)",
        example: "add",
        enum: ["add", "remove"],
    })
], SetBanDto.prototype, "command", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Ban duration in seconds",
        example: 86400,
        required: false,
    })
], SetBanDto.prototype, "banTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Reason for ban",
        example: "Malicious behavior",
        required: false,
    })
], SetBanDto.prototype, "reason", void 0);
class BanInfoDto {
}
exports.BanInfoDto = BanInfoDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "IP address",
        example: "192.168.1.1",
    })
], BanInfoDto.prototype, "ip", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Time until ban expires (seconds)",
        example: 3600,
    })
], BanInfoDto.prototype, "timeRemaining", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Reason for ban",
        example: "Malicious behavior",
    })
], BanInfoDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Time when ban was created",
        example: "2024-03-21T10:00:00Z",
    })
], BanInfoDto.prototype, "createdAt", void 0);
class NetworkInfoDto {
}
exports.NetworkInfoDto = NetworkInfoDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Version of the node",
        example: "1.0.0",
    })
], NetworkInfoDto.prototype, "version", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Protocol version",
        example: 70015,
    })
], NetworkInfoDto.prototype, "protocolVersion", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Total number of connections",
        example: 8,
    })
], NetworkInfoDto.prototype, "connections", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Number of inbound connections",
        example: 3,
    })
], NetworkInfoDto.prototype, "inbound", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Number of outbound connections",
        example: 5,
    })
], NetworkInfoDto.prototype, "outbound", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Whether the network is reachable",
        example: true,
    })
], NetworkInfoDto.prototype, "networkActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "List of local addresses",
        example: ["192.168.1.1:8333", "10.0.0.1:8333"],
    })
], NetworkInfoDto.prototype, "localAddresses", void 0);
class PeerDetailedInfoDto {
}
exports.PeerDetailedInfoDto = PeerDetailedInfoDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Peer ID" })
], PeerDetailedInfoDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Peer IP address" })
], PeerDetailedInfoDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Peer port number" })
], PeerDetailedInfoDto.prototype, "port", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Peer version" })
], PeerDetailedInfoDto.prototype, "version", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Peer connection state" })
], PeerDetailedInfoDto.prototype, "state", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Peer services" })
], PeerDetailedInfoDto.prototype, "services", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Last seen timestamp" })
], PeerDetailedInfoDto.prototype, "lastSeen", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Last send timestamp" })
], PeerDetailedInfoDto.prototype, "lastSend", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Number of synced blocks" })
], PeerDetailedInfoDto.prototype, "syncedBlocks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Blocks currently in flight" })
], PeerDetailedInfoDto.prototype, "inflight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Whether peer is whitelisted" })
], PeerDetailedInfoDto.prototype, "whitelisted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Whether peer is blacklisted" })
], PeerDetailedInfoDto.prototype, "blacklisted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Peer capabilities" })
], PeerDetailedInfoDto.prototype, "capabilities", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Peer user agent" })
], PeerDetailedInfoDto.prototype, "userAgent", void 0);
