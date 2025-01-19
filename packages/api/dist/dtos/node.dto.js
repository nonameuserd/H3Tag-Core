"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeerConnectionResponseDto = exports.ConnectPeerDto = exports.PeerDiscoveryResponseDto = exports.NodeStatusDto = exports.NodeResponseDto = exports.CreateNodeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class CreateNodeDto {
}
exports.CreateNodeDto = CreateNodeDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ["MAINNET", "TESTNET"],
        description: "Network type for the node",
    })
], CreateNodeDto.prototype, "networkType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false })
], CreateNodeDto.prototype, "region", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ["full", "light", "archive"],
        required: false,
    })
], CreateNodeDto.prototype, "nodeType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, default: 3000 })
], CreateNodeDto.prototype, "port", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, default: "localhost" })
], CreateNodeDto.prototype, "host", void 0);
class NodeResponseDto {
}
exports.NodeResponseDto = NodeResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)()
], NodeResponseDto.prototype, "nodeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ["running", "stopped"] })
], NodeResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], NodeResponseDto.prototype, "endpoint", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], NodeResponseDto.prototype, "networkType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], NodeResponseDto.prototype, "peerCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false })
], NodeResponseDto.prototype, "region", void 0);
class NodeStatusDto {
}
exports.NodeStatusDto = NodeStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)()
], NodeStatusDto.prototype, "nodeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ["running", "stopped"] })
], NodeStatusDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], NodeStatusDto.prototype, "peerCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String] })
], NodeStatusDto.prototype, "bannedPeers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)()
], NodeStatusDto.prototype, "address", void 0);
class PeerDiscoveryResponseDto {
}
exports.PeerDiscoveryResponseDto = PeerDiscoveryResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Number of new peers discovered",
        example: 5,
    })
], PeerDiscoveryResponseDto.prototype, "discoveredPeers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Total number of connected peers",
        example: 12,
    })
], PeerDiscoveryResponseDto.prototype, "totalPeers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Current peer count vs minimum required peers",
        example: {
            current: 12,
            minimum: 8,
        },
    })
], PeerDiscoveryResponseDto.prototype, "peerMetrics", void 0);
class ConnectPeerDto {
}
exports.ConnectPeerDto = ConnectPeerDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Peer address to connect to",
        example: "127.0.0.1:8333",
    })
], ConnectPeerDto.prototype, "address", void 0);
class PeerConnectionResponseDto {
}
exports.PeerConnectionResponseDto = PeerConnectionResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Connection status",
        example: "connected",
    })
], PeerConnectionResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Connected peer address",
        example: "127.0.0.1:8333",
    })
], PeerConnectionResponseDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Peer version",
        example: "1.0.0",
    })
], PeerConnectionResponseDto.prototype, "version", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Peer height",
        example: 780000,
    })
], PeerConnectionResponseDto.prototype, "height", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Connection timestamp",
        example: "2024-03-21T15:30:00Z",
    })
], PeerConnectionResponseDto.prototype, "connectedAt", void 0);
