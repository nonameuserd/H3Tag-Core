import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SeedServerStack } from './seed-server-stack';
import * as path from 'path';

interface DeployConfig {
  regions: string[];
  domainName: string;
  account: string | undefined;
  environment: string;
}

function validateConfig(): DeployConfig {
  const regions = process.env.AWS_REGIONS?.split(',')
    .map((region) => region.trim())
    .filter(Boolean);
  const domainName = process.env.DOMAIN_NAME?.trim();
  const account = process.env.CDK_DEFAULT_ACCOUNT?.trim();
  const environment = process.env.NODE_ENV?.trim() || 'production';

  // Validate required fields
  if (!regions?.length) {
    throw new Error(
      'AWS_REGIONS environment variable is required and must contain valid regions',
    );
  }
  if (!domainName) {
    throw new Error('DOMAIN_NAME environment variable is required');
  }

  // Validate region format
  const AWS_REGION_REGEX = /^[a-z]{2}-[a-z]+-\d{1}$/;
  const invalidRegions = regions.filter(
    (region) => !AWS_REGION_REGEX.test(region),
  );
  if (invalidRegions.length > 0) {
    throw new Error(
      `Invalid AWS regions detected: ${invalidRegions.join(', ')}`,
    );
  }

  return { regions, domainName, account, environment };
}

try {
  const app = new cdk.App();
  const config = validateConfig();
  const scriptPath = path.resolve(__dirname, './script/node-initializer.ts');

  config.regions.forEach((region) => {
    const stackName = `SeedServerStack-${region}-${config.environment}`;
    const stack = new SeedServerStack(app, stackName, {
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
} catch (error) {
  console.error(
    'Deployment failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
}
