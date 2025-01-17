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
// Add error handling for missing environment variables
if (!process.env.AWS_REGIONS) {
    throw new Error("AWS_REGIONS environment variable is required");
}
if (!process.env.DOMAIN_NAME) {
    throw new Error("DOMAIN_NAME environment variable is required");
}
const app = new cdk.App();
// Deploy to multiple regions
const regions = process.env.AWS_REGIONS.split(",").map((region) => region.trim()); // Trim whitespace
const scriptPath = path.resolve(__dirname, "./script/node-initializer.ts");
// Validate regions
if (regions.length === 0) {
    throw new Error("At least one AWS region must be specified");
}
regions.forEach((region) => {
    if (!region) {
        throw new Error("Empty region found in AWS_REGIONS");
    }
    new seed_server_stack_1.SeedServerStack(app, `SeedServerStack-${region}`, {
        env: {
            region,
            account: process.env.CDK_DEFAULT_ACCOUNT,
        },
        domainName: process.env.DOMAIN_NAME,
        environment: process.env.NODE_ENV || "production",
        crossRegionReferences: true,
        deploymentScriptPath: scriptPath,
    });
});
app.synth();
//# sourceMappingURL=deploy.js.map