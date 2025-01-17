import { execSync } from "child_process";

const regions =
  process.env.AWS_REGIONS?.split(",").map((region) => region.trim()).filter(Boolean) || [];
const account = process.env.CDK_DEFAULT_ACCOUNT?.trim();

if (!account) {
  console.error("[Bootstrap] CDK_DEFAULT_ACCOUNT environment variable is required");
  process.exit(1);
}

if (regions.length === 0) {
  console.error("[Bootstrap] AWS_REGIONS environment variable is required and must contain valid regions");
  process.exit(1);
}

const AWS_REGION_REGEX = /^[a-z]{2}-[a-z]+-\d{1}$/;
const invalidRegions = regions.filter(region => !AWS_REGION_REGEX.test(region));
if (invalidRegions.length > 0) {
  console.error(`[Bootstrap] Invalid AWS regions detected: ${invalidRegions.join(', ')}`);
  process.exit(1);
}

console.log('[Bootstrap] Starting CDK bootstrap process...');
let successCount = 0;

regions.forEach((region: string) => {
  console.log(`[Bootstrap] Bootstrapping region: ${region}`);
  try {
    execSync(`cdk bootstrap aws://${account}/${region}`, { 
      stdio: "inherit",
      timeout: 300000,
      env: {
        ...process.env,
        AWS_REGION: region
      }
    });
    successCount++;
  } catch (error) {
    console.error(
      `[Bootstrap] Failed to bootstrap ${region}:`,
      error instanceof Error ? error.message : error
    );
  }
});

const failedCount = regions.length - successCount;
console.log(`[Bootstrap] Bootstrap process completed.`);
console.log(`[Bootstrap] Successfully bootstrapped: ${successCount} regions`);
if (failedCount > 0) {
  console.log(`[Bootstrap] Failed to bootstrap: ${failedCount} regions`);
  process.exit(1);
}

process.exit(0);
