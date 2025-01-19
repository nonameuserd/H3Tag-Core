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
exports.NodeController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const node_dto_1 = require("../dtos/node.dto");
let NodeController = class NodeController {
    constructor(nodeService) {
        this.nodeService = nodeService;
    }
    async createTestnetNode(createNodeDto) {
        try {
            return await this.nodeService.createNode({
                ...createNodeDto,
                networkType: "TESTNET",
                port: createNodeDto.port || 4000,
            });
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to create TESTNET node: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createMainnetNode(createNodeDto) {
        try {
            return await this.nodeService.createNode({
                ...createNodeDto,
                networkType: "MAINNET",
                port: createNodeDto.port || 3000,
            });
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to create MAINNET node: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getNodeStatus(nodeId) {
        try {
            return await this.nodeService.getNodeStatus(nodeId);
        }
        catch (error) {
            throw new common_1.HttpException(`Node not found: ${error.message}`, common_1.HttpStatus.NOT_FOUND);
        }
    }
    async stopNode(nodeId) {
        try {
            const success = await this.nodeService.stopNode(nodeId);
            if (success) {
                return { status: "stopped", nodeId };
            }
            throw new Error("Node not found");
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to stop node: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getActiveValidators(nodeId) {
        try {
            return await this.nodeService.getActiveValidators(nodeId);
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to get validators: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async discoverPeers(nodeId) {
        try {
            return await this.nodeService.discoverPeers(nodeId);
        }
        catch (error) {
            throw new common_1.HttpException(error.message.includes("not found")
                ? "Node not found"
                : `Failed to discover peers: ${error.message}`, error.message.includes("not found")
                ? common_1.HttpStatus.NOT_FOUND
                : common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async connectToPeer(nodeId, connectPeerDto) {
        try {
            return await this.nodeService.connectToPeer(nodeId, connectPeerDto.address);
        }
        catch (error) {
            if (error.message.includes("not found")) {
                throw new common_1.HttpException("Node not found", common_1.HttpStatus.NOT_FOUND);
            }
            throw new common_1.HttpException(`Failed to connect to peer: ${error.message}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
};
exports.NodeController = NodeController;
__decorate([
    (0, common_1.Post)("testnet"),
    (0, swagger_1.ApiOperation)({ summary: "Create a new TESTNET node" }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: "Node created successfully",
        type: node_dto_1.NodeResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 500,
        description: "Failed to create node",
        schema: {
            properties: {
                message: { type: "string" },
                statusCode: { type: "number" },
            },
        },
    }),
    __param(0, (0, common_1.Body)())
], NodeController.prototype, "createTestnetNode", null);
__decorate([
    (0, common_1.Post)("mainnet"),
    (0, swagger_1.ApiOperation)({ summary: "Create a new MAINNET node" }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: "Node created successfully",
        type: node_dto_1.NodeResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 500,
        description: "Failed to create node",
        schema: {
            properties: {
                message: { type: "string" },
                statusCode: { type: "number" },
            },
        },
    }),
    __param(0, (0, common_1.Body)())
], NodeController.prototype, "createMainnetNode", null);
__decorate([
    (0, common_1.Get)(":nodeId/status"),
    (0, swagger_1.ApiOperation)({ summary: "Get node status" }),
    (0, swagger_1.ApiParam)({
        name: "nodeId",
        description: "Node identifier",
        required: true,
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Node status retrieved successfully",
        type: node_dto_1.NodeStatusDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: "Node not found",
    }),
    __param(0, (0, common_1.Param)("nodeId"))
], NodeController.prototype, "getNodeStatus", null);
__decorate([
    (0, common_1.Post)(":nodeId/stop"),
    (0, swagger_1.ApiOperation)({ summary: "Stop a running node" }),
    (0, swagger_1.ApiParam)({
        name: "nodeId",
        description: "Node identifier",
        required: true,
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Node stopped successfully",
        schema: {
            type: "object",
            properties: {
                status: {
                    type: "string",
                    example: "stopped",
                },
                nodeId: {
                    type: "string",
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: "Node not found",
    }),
    (0, swagger_1.ApiResponse)({
        status: 500,
        description: "Failed to stop node",
    }),
    __param(0, (0, common_1.Param)("nodeId"))
], NodeController.prototype, "stopNode", null);
__decorate([
    (0, common_1.Get)(":nodeId/validators"),
    (0, swagger_1.ApiOperation)({ summary: "Get active validators for a node" }),
    (0, swagger_1.ApiParam)({
        name: "nodeId",
        description: "Node identifier",
        required: true,
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Active validators retrieved successfully",
        schema: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    address: {
                        type: "string",
                        description: "Validator address",
                    },
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: "Node not found",
    }),
    (0, swagger_1.ApiResponse)({
        status: 500,
        description: "Failed to get validators",
    }),
    __param(0, (0, common_1.Param)("nodeId"))
], NodeController.prototype, "getActiveValidators", null);
__decorate([
    (0, common_1.Post)(":nodeId/discover-peers"),
    (0, swagger_1.ApiOperation)({ summary: "Trigger peer discovery for a node" }),
    (0, swagger_1.ApiParam)({
        name: "nodeId",
        description: "Node identifier",
        required: true,
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Peer discovery completed successfully",
        type: node_dto_1.PeerDiscoveryResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: "Node not found",
    }),
    (0, swagger_1.ApiResponse)({
        status: 500,
        description: "Failed to discover peers",
    }),
    __param(0, (0, common_1.Param)("nodeId"))
], NodeController.prototype, "discoverPeers", null);
__decorate([
    (0, common_1.Post)(":nodeId/connect-peer"),
    (0, swagger_1.ApiOperation)({ summary: "Connect to a specific peer" }),
    (0, swagger_1.ApiParam)({
        name: "nodeId",
        description: "Node identifier",
        required: true,
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Successfully connected to peer",
        type: node_dto_1.PeerConnectionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: "Node not found",
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: "Invalid peer address or connection failed",
    }),
    __param(0, (0, common_1.Param)("nodeId")),
    __param(1, (0, common_1.Body)())
], NodeController.prototype, "connectToPeer", null);
exports.NodeController = NodeController = __decorate([
    (0, swagger_1.ApiTags)("Nodes"),
    (0, common_1.Controller)("nodes")
], NodeController);
