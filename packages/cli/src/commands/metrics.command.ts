import { Command } from "commander";
import { api } from "../services/api";

export const metricsCommand = new Command("metrics").description(
  "Get blockchain metrics and monitoring information"
);

// Get general metrics info command
metricsCommand
  .command("info")
  .description("Get general blockchain metrics")
  .option(
    "-t, --time-window <number>",
    "Time window in milliseconds (default: 1 hour)",
    "3600000"
  )
  .action(async (options) => {
    try {
      const response = await api.get("/metrics", {
        params: { timeWindow: parseInt(options.timeWindow) },
      });

      console.log("Blockchain Metrics:");
      console.log("------------------");
      console.log(`Average TAG Fees: ${response.data.averageTAGFees} TAG`);
      console.log(`Average TAG Volume: ${response.data.averageTAGVolume} TAG`);
      console.log(`Current Hash Rate: ${response.data.hashRate} H/s`);
      console.log(`Current Difficulty: ${response.data.difficulty}`);
      console.log(`Block Height: ${response.data.blockHeight}`);
      console.log(`Synced Headers: ${response.data.syncedHeaders}`);
      console.log(`Synced Blocks: ${response.data.syncedBlocks}`);
      console.log(`Whitelisted Peers: ${response.data.whitelistedPeers}`);
      console.log(`Blacklisted Peers: ${response.data.blacklistedPeers}`);
    } catch (error) {
      console.error(
        "Failed to get metrics:",
        error.response?.data?.error || error.message
      );
      process.exit(1);
    }
  });
// Get TAG fees metrics command
metricsCommand
  .command("fees")
  .description("Get TAG fee metrics")
  .option(
    "-t, --time-window <number>",
    "Time window in milliseconds (default: 1 hour)",
    "3600000"
  )
  .action(async (options) => {
    try {
      const response = await api.get("/metrics", {
        params: { timeWindow: parseInt(options.timeWindow) },
      });

      console.log("TAG Fee Metrics:");
      console.log("---------------");
      console.log(`Average TAG Fees: ${response.data.averageTAGFees} TAG`);
      console.log(`Time Window: ${options.timeWindow}ms`);
    } catch (error) {
      console.error(
        "Failed to get fee metrics:",
        error.response?.data?.error || error.message
      );
      process.exit(1);
    }
  });

// Get network metrics command
metricsCommand
  .command("network")
  .description("Get network metrics")
  .action(async () => {
    try {
      const response = await api.get("/metrics");

      console.log("Network Metrics:");
      console.log("----------------");
      console.log(`Hash Rate: ${response.data.hashRate} H/s`);
      console.log(`Difficulty: ${response.data.difficulty}`);
      console.log(`Whitelisted Peers: ${response.data.whitelistedPeers}`);
      console.log(`Blacklisted Peers: ${response.data.blacklistedPeers}`);
    } catch (error) {
      console.error(
        "Failed to get network metrics:",
        error.response?.data?.error || error.message
      );
      process.exit(1);
    }
  });

// Get sync status command
metricsCommand
  .command("sync")
  .description("Get blockchain sync status")
  .action(async () => {
    try {
      const response = await api.get("/metrics");

      console.log("Sync Status:");
      console.log("------------");
      console.log(`Block Height: ${response.data.blockHeight}`);
      console.log(`Synced Headers: ${response.data.syncedHeaders}`);
      console.log(`Synced Blocks: ${response.data.syncedBlocks}`);

      const syncProgress = (
        (response.data.syncedBlocks / response.data.syncedHeaders) *
        100
      ).toFixed(2);
      console.log(`Sync Progress: ${syncProgress}%`);
    } catch (error) {
      console.error(
        "Failed to get sync status:",
        error.response?.data?.error || error.message
      );
      process.exit(1);
    }
  });

// Get TAG volume metrics command
metricsCommand
  .command("volume")
  .description("Get TAG volume metrics")
  .option(
    "-t, --time-window <number>",
    "Time window in milliseconds (default: 1 hour)",
    "3600000"
  )
  .action(async (options) => {
    try {
      const response = await api.get("/metrics", {
        params: { timeWindow: parseInt(options.timeWindow) },
      });

      console.log("TAG Volume Metrics:");
      console.log("------------------");
      console.log(`Average TAG Volume: ${response.data.averageTAGVolume} TAG`);
      console.log(`Time Window: ${options.timeWindow}ms`);
    } catch (error) {
      console.error(
        "Failed to get volume metrics:",
        error.response?.data?.error || error.message
      );
      process.exit(1);
    }
  });
