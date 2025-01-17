"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const regions = process.env.AWS_REGIONS?.split(',').map(region => region.trim()) || [];
const account = process.env.CDK_DEFAULT_ACCOUNT;
if (!account) {
    console.error('CDK_DEFAULT_ACCOUNT environment variable is required');
    process.exit(1);
}
if (regions.length === 0) {
    console.error('AWS_REGIONS environment variable is required');
    process.exit(1);
}
regions.forEach((region) => {
    console.log(`Bootstrapping region: ${region}`);
    try {
        (0, child_process_1.execSync)(`cdk bootstrap aws://${account}/${region}`, { stdio: 'inherit' });
    }
    catch (error) {
        console.error(`Failed to bootstrap ${region}:`, error instanceof Error ? error.message : error);
    }
});
//# sourceMappingURL=bootstrap-regions.js.map