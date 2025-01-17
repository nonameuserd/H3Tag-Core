import { program } from "commander";
import { nodeCommand } from "./commands/node.command";
import { peerCommand } from "./commands/peer.command";
import { walletCommand } from "./commands/wallet.commands";
import { votingCommand } from "./commands/voting.command";
import { transactionCommand } from "./commands/transaction.command";
import { blockchainCommand } from "./commands/blockchain.command";
import { miningCommand } from "./commands/mining.command";
import { mempoolCommand } from "./commands/mempool.command";

program.version("1.0.0").description("H3TAG Blockchain CLI");

program.addCommand(nodeCommand);
program.addCommand(walletCommand);
program.addCommand(peerCommand);
program.addCommand(votingCommand);
program.addCommand(transactionCommand);
program.addCommand(blockchainCommand);
program.addCommand(miningCommand);
program.addCommand(mempoolCommand);

program.parse(process.argv);
