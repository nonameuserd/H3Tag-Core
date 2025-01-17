"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const seed_server_stack_1 = require("./seed-server-stack");
const path = __importStar(require("path"));
function validateConfig() {
    const regions = process.env.AWS_REGIONS?.split(",")
        .map((region) => region.trim())
        .filter(Boolean);
    const domainName = process.env.DOMAIN_NAME?.trim();
    const account = process.env.CDK_DEFAULT_ACCOUNT?.trim();
    const environment = process.env.NODE_ENV?.trim() || "production";
    // Validate required fields
    if (!regions?.length) {
        throw new Error("AWS_REGIONS environment variable is required and must contain valid regions");
    }
    if (!domainName) {
        throw new Error("DOMAIN_NAME environment variable is required");
    }
    // Validate region format
    const AWS_REGION_REGEX = /^[a-z]{2}-[a-z]+-\d{1}$/;
    const invalidRegions = regions.filter(region => !AWS_REGION_REGEX.test(region));
    if (invalidRegions.length > 0) {
        throw new Error(`Invalid AWS regions detected: ${invalidRegions.join(', ')}`);
    }
    return { regions, domainName, account, environment };
}
try {
    const app = new cdk.App();
    const config = validateConfig();
    const scriptPath = path.resolve(__dirname, "./script/node-initializer.ts");
    config.regions.forEach((region) => {
        const stackName = `SeedServerStack-${region}-${config.environment}`;
        const stack = new seed_server_stack_1.SeedServerStack(app, stackName, {
            env: {
                region,
                account: config.account,
            },
            domainName: config.domainName,
            environment: config.environment,
            crossRegionReferences: true,
            deploymentScriptPath: scriptPath,
        });
        // 4. Add stack tags for better resource management
        cdk.Tags.of(stack).add('Environment', config.environment);
        cdk.Tags.of(stack).add('Region', region);
        cdk.Tags.of(stack).add('Application', 'SeedServer');
    });
    app.synth();
}
catch (error) {
    console.error('Deployment failed:', error instanceof Error ? error.message : error);
    process.exit(1);
}
//# sourceMappingURL=deploy.js.map