"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VotingService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@h3tag-blockchain/shared");
const core_1 = require("@h3tag-blockchain/core");
let VotingService = class VotingService {
    constructor(directVoting) {
        this.directVoting = directVoting;
        this.transactionBuilder = new core_1.TransactionBuilder();
    }
    async submitVote(voteDto) {
        try {
            // Configure the transaction builder
            this.transactionBuilder
                .setFee(BigInt(0))
                .setSender(voteDto.voterAddress)
                .setSignature({ address: voteDto.signature });
            const vote = {
                voteId: crypto.randomUUID(),
                periodId: this.directVoting.getCurrentPeriod().periodId,
                voterAddress: voteDto.voterAddress,
                voter: voteDto.voterAddress,
                signature: { address: voteDto.signature },
                timestamp: Date.now(),
                blockHash: "",
                approve: voteDto.choice,
                chainVoteData: {
                    amount: voteDto.chainVoteData?.amount || BigInt(0),
                    targetChainId: voteDto.chainVoteData?.targetChainId || "",
                    forkHeight: voteDto.chainVoteData?.forkHeight || 0,
                },
                votingPower: BigInt(Math.floor(Math.sqrt(Number(voteDto.chainVoteData?.amount || 0)))),
                publicKey: { address: voteDto.voterAddress },
                encrypted: false,
                height: voteDto.height,
                balance: voteDto.balance,
            };
            const validators = await this.directVoting.getValidators();
            await this.directVoting.validateVote(vote, validators);
            const success = await this.directVoting.submitVote(vote);
            if (!success)
                throw new Error("Vote submission failed");
            return vote.voteId;
        }
        catch (error) {
            shared_1.Logger.error("Vote submission failed:", error);
            throw error;
        }
    }
    async getVotingMetrics() {
        try {
            const metrics = this.directVoting.getVotingMetrics();
            return {
                totalVotes: await metrics.totalVotes,
                participationRate: await metrics.participationRate,
                activeVoters: Number(await metrics.activeVoters),
                currentPeriod: {
                    periodId: (await metrics.currentPeriod.periodId).toString(),
                    startHeight: Number(await metrics.currentPeriod.startHeight),
                    endHeight: Number(await metrics.currentPeriod.endHeight),
                },
            };
        }
        catch (error) {
            shared_1.Logger.error("Failed to get voting metrics:", error);
            throw error;
        }
    }
    async getCurrentPeriod() {
        try {
            return this.directVoting.getCurrentPeriod();
        }
        catch (error) {
            shared_1.Logger.error("Failed to get current period:", error);
            throw error;
        }
    }
    async getVotesByAddress(address) {
        try {
            return this.directVoting.getVotesByAddress(address);
        }
        catch (error) {
            shared_1.Logger.error("Failed to get votes by address:", error);
            throw error;
        }
    }
};
exports.VotingService = VotingService;
exports.VotingService = VotingService = __decorate([
    (0, common_1.Injectable)()
], VotingService);
//# sourceMappingURL=voting.service.js.map