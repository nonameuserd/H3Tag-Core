"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.votingCommand = void 0;
const commander_1 = require("commander");
const api_1 = require("../services/api");
exports.votingCommand = new commander_1.Command("voting").description("Manage voting operations");
// Submit vote command
exports.votingCommand
    .command("submit")
    .description("Submit a new vote")
    .requiredOption("-v, --voter <address>", "Voter address")
    .requiredOption("-c, --choice <choice>", "Vote choice")
    .requiredOption("-s, --signature <signature>", "Vote signature")
    .requiredOption("-a, --amount <amount>", "Amount to commit for quadratic voting")
    .action(async (options) => {
    try {
        const response = await api_1.api.post("/voting/vote", {
            voter: options.voter,
            choice: options.choice,
            signature: options.signature,
            chainVoteData: {
                amount: BigInt(options.amount),
            },
        });
        console.log("Vote submitted successfully");
        console.log("Vote ID:", response.data.voteId);
    }
    catch (error) {
        console.error("Failed to submit vote:", error.response?.data?.error || error.message);
    }
});
// Get voting metrics command
exports.votingCommand
    .command("metrics")
    .description("Get voting metrics")
    .action(async () => {
    try {
        const response = await api_1.api.get("/voting/metrics");
        console.log("Voting Metrics:");
        console.log("---------------");
        console.log(`Total Votes: ${response.data.totalVotes}`);
        console.log(`Active Voters: ${response.data.activeVoters}`);
        console.log(`Participation Rate: ${(response.data.participationRate * 100).toFixed(2)}%`);
        if (response.data.currentPeriod) {
            console.log("\nCurrent Period:");
            console.log(`ID: ${response.data.currentPeriod.periodId}`);
            console.log(`Status: ${response.data.currentPeriod.status}`);
            console.log(`Start Block: ${response.data.currentPeriod.startBlock}`);
            console.log(`End Block: ${response.data.currentPeriod.endBlock}`);
        }
    }
    catch (error) {
        console.error("Failed to get voting metrics:", error.response?.data?.error || error.message);
    }
});
// Get current period command
exports.votingCommand
    .command("period")
    .description("Get current voting period information")
    .action(async () => {
    try {
        const response = await api_1.api.get("/voting/period/current");
        console.log("Current Voting Period:");
        console.log("--------------------");
        console.log(`Period ID: ${response.data.periodId}`);
        console.log(`Status: ${response.data.status}`);
        console.log(`Type: ${response.data.type}`);
        console.log(`Start Block: ${response.data.startBlock}`);
        console.log(`End Block: ${response.data.endBlock}`);
        console.log(`Start Time: ${new Date(response.data.startTime).toLocaleString()}`);
        console.log(`End Time: ${new Date(response.data.endTime).toLocaleString()}`);
    }
    catch (error) {
        console.error("Failed to get current period:", error.response?.data?.error || error.message);
    }
});
// Get votes by address command
exports.votingCommand
    .command("votes")
    .description("Get votes by address")
    .argument("<address>", "Voter address")
    .action(async (address) => {
    try {
        const response = await api_1.api.get(`/voting/votes/${address}`);
        console.log("Votes for Address:", address);
        console.log("-------------------");
        if (response.data.length === 0) {
            console.log("No votes found");
            return;
        }
        console.table(response.data.map((vote) => ({
            "Vote ID": vote.voteId,
            Period: vote.periodId,
            Choice: vote.chainVoteData?.targetChainId || vote.choice,
            Power: vote.votingPower?.toString() || "N/A",
            Timestamp: new Date(vote.timestamp).toLocaleString(),
        })));
    }
    catch (error) {
        console.error("Failed to get votes:", error.response?.data?.error || error.message);
    }
});
// Check participation command
exports.votingCommand
    .command("check-participation")
    .description("Check if address has participated in current voting period")
    .argument("<address>", "Address to check")
    .action(async (address) => {
    try {
        const response = await api_1.api.get(`/voting/participation/${address}`);
        console.log("Participation Status:");
        console.log("-------------------");
        console.log(`Address: ${address}`);
        console.log(`Has Participated: ${response.data.hasParticipated ? "Yes" : "No"}`);
    }
    catch (error) {
        console.error("Failed to check participation:", error.response?.data?.error || error.message);
    }
});
// Get voting schedule command
exports.votingCommand
    .command("schedule")
    .description("Get voting schedule information")
    .action(async () => {
    try {
        const response = await api_1.api.get("/voting/schedule");
        console.log("Voting Schedule:");
        console.log("----------------");
        console.log(`Next Voting Height: ${response.data.nextVotingHeight}`);
        console.log(`Blocks Until Next Voting: ${response.data.blocksUntilNextVoting}`);
        if (response.data.currentPeriod) {
            console.log("\nCurrent Period:");
            console.log(`ID: ${response.data.currentPeriod.periodId}`);
            console.log(`Status: ${response.data.currentPeriod.status}`);
            console.log(`Start Block: ${response.data.currentPeriod.startBlock}`);
            console.log(`End Block: ${response.data.currentPeriod.endBlock}`);
            console.log(`Start Time: ${new Date(response.data.currentPeriod.startTime).toLocaleString()}`);
            console.log(`End Time: ${new Date(response.data.currentPeriod.endTime).toLocaleString()}`);
        }
        else {
            console.log("\nNo active voting period");
        }
    }
    catch (error) {
        console.error("Failed to get voting schedule:", error.response?.data?.error || error.message);
    }
});
// Get voting power command
exports.votingCommand
    .command("power")
    .description("Calculate voting power for an amount")
    .argument("<amount>", "Amount to calculate voting power for")
    .action(async (amount) => {
    try {
        const votingPower = Math.floor(Math.sqrt(Number(amount)));
        console.log("Voting Power Calculation:");
        console.log("----------------------");
        console.log(`Amount: ${amount}`);
        console.log(`Voting Power: ${votingPower}`);
        console.log("\nNote: Voting power is calculated using quadratic voting (square root of amount)");
    }
    catch (error) {
        console.error("Failed to calculate voting power:", error.message);
    }
});
//# sourceMappingURL=voting.command.js.map