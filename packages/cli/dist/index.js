"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const node_command_1 = require("./commands/node.command");
const peer_command_1 = require("./commands/peer.command");
const wallet_commands_1 = require("./commands/wallet.commands");
const voting_command_1 = require("./commands/voting.command");
const transaction_command_1 = require("./commands/transaction.command");
const blockchain_command_1 = require("./commands/blockchain.command");
const mining_command_1 = require("./commands/mining.command");
const mempool_command_1 = require("./commands/mempool.command");
commander_1.program
    .version('1.0.0')
    .description('H3TAG Blockchain CLI');
commander_1.program.addCommand(node_command_1.nodeCommand);
commander_1.program.addCommand(wallet_commands_1.walletCommand);
commander_1.program.addCommand(peer_command_1.peerCommand);
commander_1.program.addCommand(voting_command_1.votingCommand);
commander_1.program.addCommand(transaction_command_1.transactionCommand);
commander_1.program.addCommand(blockchain_command_1.blockchainCommand);
commander_1.program.addCommand(mining_command_1.miningCommand);
commander_1.program.addCommand(mempool_command_1.mempoolCommand);
commander_1.program.parse(process.argv);
//# sourceMappingURL=index.js.map