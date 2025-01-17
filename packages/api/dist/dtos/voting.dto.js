"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VotingMetricsDto = exports.VotingPeriodDto = exports.VoteDto = exports.ChainVoteDataDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const core_1 = require("@h3tag-blockchain/core");
class ChainVoteDataDto {
}
exports.ChainVoteDataDto = ChainVoteDataDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Amount to commit for voting',
        example: '1000'
    })
], ChainVoteDataDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Target chain ID',
        example: 'chain_1'
    })
], ChainVoteDataDto.prototype, "targetChainId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Fork height',
        example: 1000
    })
], ChainVoteDataDto.prototype, "forkHeight", void 0);
class VoteDto {
}
exports.VoteDto = VoteDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Vote identifier',
        example: 'vote_123'
    })
], VoteDto.prototype, "voteId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Period identifier',
        example: 'period_123'
    })
], VoteDto.prototype, "periodId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'The voter address',
        example: '0x1234...'
    })
], VoteDto.prototype, "voterAddress", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Vote signature',
        example: 'base64_encoded_signature'
    })
], VoteDto.prototype, "signature", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Vote timestamp',
        example: 1234567890
    })
], VoteDto.prototype, "timestamp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'The vote choice (true for yes, false for no)',
        example: true
    })
], VoteDto.prototype, "choice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Chain vote data'
    })
], VoteDto.prototype, "chainVoteData", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Transaction type',
        enum: core_1.TransactionType,
        example: core_1.TransactionType.QUADRATIC_VOTE
    })
], VoteDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Transaction status',
        enum: core_1.TransactionStatus,
        example: core_1.TransactionStatus.PENDING
    })
], VoteDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Voting power',
        example: '10'
    })
], VoteDto.prototype, "votingPower", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'The block height at which the vote is cast',
        example: 1000
    })
], VoteDto.prototype, "height", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'The balance of the voter',
        example: '1000'
    })
], VoteDto.prototype, "balance", void 0);
class VotingPeriodDto {
}
exports.VotingPeriodDto = VotingPeriodDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Period identifier',
        example: 'period_123'
    })
], VotingPeriodDto.prototype, "periodId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Start block height',
        example: 1000
    })
], VotingPeriodDto.prototype, "startHeight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'End block height',
        example: 2000
    })
], VotingPeriodDto.prototype, "endHeight", void 0);
class VotingMetricsDto {
}
exports.VotingMetricsDto = VotingMetricsDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Current voting period information'
    })
], VotingMetricsDto.prototype, "currentPeriod", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Total number of votes cast',
        example: 150
    })
], VotingMetricsDto.prototype, "totalVotes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Number of active voters',
        example: 75
    })
], VotingMetricsDto.prototype, "activeVoters", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Voter participation rate',
        example: 0.65
    })
], VotingMetricsDto.prototype, "participationRate", void 0);
//# sourceMappingURL=voting.dto.js.map