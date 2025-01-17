import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { SeedServerStack } from "./seed-server-stack";
import * as path from "path";

// Add error handling for missing environment variables
if (!process.env.AWS_REGIONS) {
  throw new Error("AWS_REGIONS environment variable is required");
}
if (!process.env.DOMAIN_NAME) {
  throw new Error("DOMAIN_NAME environment variable is required");
}

const app = new cdk.App();

// Deploy to multiple regions
const regions = process.env.AWS_REGIONS.split(",").map((region) =>
  region.trim()
); // Trim whitespace
const scriptPath = path.resolve(__dirname, "./script/node-initializer.ts");

// Validate regions
if (regions.length === 0) {
  throw new Error("At least one AWS region must be specified");
}

regions.forEach((region) => {
  if (!region) {
    throw new Error("Empty region found in AWS_REGIONS");
  }

  new SeedServerStack(app, `SeedServerStack-${region}`, {
    env: {
      region,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
    domainName: process.env.DOMAIN_NAME,
    environment: process.env.NODE_ENV || "production", // Add NODE_ENV support
    crossRegionReferences: true,
    deploymentScriptPath: scriptPath,
  });
});

app.synth();
