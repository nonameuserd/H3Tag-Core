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
exports.VotingController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const voting_dto_1 = require("../dtos/voting.dto");
const shared_1 = require("@h3tag-blockchain/shared");
let VotingController = class VotingController {
    constructor(votingService) {
        this.votingService = votingService;
    }
    async submitVote(voteDto) {
        try {
            const result = await this.votingService.submitVote(voteDto);
            return { success: true, voteId: result };
        }
        catch (error) {
            shared_1.Logger.error("Failed to submit vote:", error);
            throw new common_1.HttpException(`Failed to submit vote: ${error.message}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async getMetrics() {
        try {
            return await this.votingService.getVotingMetrics();
        }
        catch (error) {
            shared_1.Logger.error("Failed to get voting metrics:", error);
            throw new common_1.HttpException(`Failed to get voting metrics: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getCurrentPeriod() {
        try {
            return await this.votingService.getCurrentPeriod();
        }
        catch (error) {
            shared_1.Logger.error("Failed to get current period:", error);
            throw new common_1.HttpException(`Failed to get current period: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getVotesByAddress(address) {
        try {
            return await this.votingService.getVotesByAddress(address);
        }
        catch (error) {
            shared_1.Logger.error("Failed to get votes:", error);
            throw new common_1.HttpException(`Failed to get votes: ${error.message}`, common_1.HttpStatus.NOT_FOUND);
        }
    }
};
exports.VotingController = VotingController;
__decorate([
    (0, common_1.Post)("vote"),
    (0, swagger_1.ApiOperation)({ summary: "Submit a vote" }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: "Vote submitted successfully",
        schema: {
            properties: {
                success: { type: "boolean" },
                voteId: { type: "string" },
            },
        },
    }),
    __param(0, (0, common_1.Body)())
], VotingController.prototype, "submitVote", null);
__decorate([
    (0, common_1.Get)("metrics"),
    (0, swagger_1.ApiOperation)({ summary: "Get voting metrics" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Voting metrics retrieved successfully",
        type: voting_dto_1.VotingMetricsDto,
    })
], VotingController.prototype, "getMetrics", null);
__decorate([
    (0, common_1.Get)("period/current"),
    (0, swagger_1.ApiOperation)({ summary: "Get current voting period" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Current voting period retrieved successfully",
    })
], VotingController.prototype, "getCurrentPeriod", null);
__decorate([
    (0, common_1.Get)("votes/:address"),
    (0, swagger_1.ApiOperation)({ summary: "Get votes by address" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Votes retrieved successfully",
        type: [voting_dto_1.VoteDto],
    }),
    __param(0, (0, common_1.Param)("address"))
], VotingController.prototype, "getVotesByAddress", null);
exports.VotingController = VotingController = __decorate([
    (0, swagger_1.ApiTags)("Voting"),
    (0, common_1.Controller)("voting")
], VotingController);
//# sourceMappingURL=voting.controller.js.map