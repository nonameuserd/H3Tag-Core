import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
interface SeedServerStackProps extends cdk.StackProps {
    domainName: string;
    environment: string;
    deploymentScriptPath: string;
}
export declare class SeedServerStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: SeedServerStackProps);
    private initialize;
    private setupInstanceConfiguration;
}
export {};
