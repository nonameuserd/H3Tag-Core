import { fetch, Agent } from 'undici';
import { CloudWatch } from '@aws-sdk/client-cloudwatch';
import { Route53 } from '@aws-sdk/client-route-53';
import { Logger } from '@h3tag-blockchain/shared';
import { MerkleTree } from '../../utils/merkle';

interface NodeInfo {
  address: string;
  lastSeen: number;
  version: string;
  services: string[];
  status: 'active' | 'inactive';
  region: string;
}

interface VersionResponse {
  version: string;
}

async function main() {
  const PORT = process.env.SEED_PORT ? parseInt(process.env.SEED_PORT) : 8333;

  try {
    if (!process.env.AWS_REGION) {
      throw new Error('AWS_REGION environment variable is required');
    }
    if (!process.env.AWS_ACCESS_KEY_ID) {
      throw new Error('AWS_ACCESS_KEY_ID environment variable is required');
    }
    if (!process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS_SECRET_ACCESS_KEY environment variable is required');
    }

    const seedServer = new SeedServer(PORT);
    await seedServer.start();

    // Handle shutdown gracefully
    process.on('SIGTERM', async () => {
      Logger.info('SIGTERM received. Starting graceful shutdown...');
      await seedServer.shutdown();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      Logger.info('SIGINT received. Starting graceful shutdown...');
      await seedServer.shutdown();
      process.exit(0);
    });
  } catch (error) {
    Logger.error('Failed to start seed server:', error);
    process.exit(1);
  }
}

export class SeedServer {
  private knownNodes: Map<string, NodeInfo> = new Map();
  private readonly port: number;
  private readonly regions: string[];
  private healthCheckInterval: NodeJS.Timeout | undefined;
  private cloudWatch: CloudWatch;
  private route53: Route53;
  private readonly merkleTree: MerkleTree;
  private isShuttingDown: boolean = false;

  constructor(port: number = 8333) {
    if (port <= 0 || port > 65535) {
      throw new Error('Invalid port number');
    }

    this.port = port;
    this.regions = process.env.AWS_REGIONS
      ? process.env.AWS_REGIONS.split(',')
      : [process.env.AWS_REGION || 'us-east-1'];

    const requiredEnvVars = [
      'AWS_REGION',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'NODE_ENV',
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    this.cloudWatch = new CloudWatch({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      maxAttempts: 3,
      retryMode: 'adaptive',
    });

    this.route53 = new Route53({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      maxAttempts: 3,
      retryMode: 'adaptive',
    });

    this.merkleTree = new MerkleTree();
    this.setupIntervals();
  }

  private async publishMetrics(node: NodeInfo) {
    try {
      await this.cloudWatch.putMetricData({
        Namespace: 'H3Tag/SeedNodes',
        MetricData: [
          {
            MetricName: 'NodeStatus',
            Value: node.status === 'active' ? 1 : 0,
            Unit: 'Count',
            Dimensions: [
              { Name: 'Region', Value: node.region },
              { Name: 'Currency', Value: 'TAG' },
              {
                Name: 'Environment',
                Value: process.env.NODE_ENV || 'development',
              },
            ],
          },
        ],
      });
    } catch (error) {
      Logger.error('Failed to publish CloudWatch metrics:', error);
    }
  }

  private async updateHealthCheck(node: NodeInfo) {
    try {
      const healthCheckId =
        process.env.HEALTH_CHECK_ID || `${node.region}-health-check`;
      await this.route53.updateHealthCheck({
        HealthCheckId: healthCheckId,
        FailureThreshold: 3,
        FullyQualifiedDomainName: node.address,
        Port: this.port,
        ResourcePath: '/health',
      });
    } catch (error) {
      Logger.error('Failed to update Route53 health check:', error);
    }
  }

  private async checkNodeHealth(
    address: string,
    region: string,
  ): Promise<boolean> {
    if (this.isShuttingDown) return false;

    const agent = new Agent({
      connect: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
        timeout: 5000,
        keepAlive: true,
        keepAliveInitialDelay: 1000,
      },
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`https://${address}/version`, {
        dispatcher: agent,
        signal: controller.signal,
        headers: {
          'User-Agent': 'H3Tag-Seed-Server/1.0',
          Accept: 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as VersionResponse;

      if (!data.version || typeof data.version !== 'string') {
        throw new Error('Invalid version format');
      }

      await this.publishMetrics({
        address,
        lastSeen: Date.now(),
        version: data.version,
        services: ['full_node'],
        status: 'active',
        region,
      });

      return true;
    } catch (error) {
      Logger.error(`Health check failed for ${address}:`, error);

      await this.publishMetrics({
        address,
        lastSeen: Date.now(),
        version: 'unknown',
        services: ['full_node'],
        status: 'inactive',
        region,
      });

      return false;
    } finally {
      agent.close();
    }
  }

  private async updateNodeList() {
    try {
      const nodes = Array.from(this.knownNodes.values());

      if (nodes.length === 0) {
        Logger.warn('No nodes found in knownNodes. Skipping update.');
        return;
      }

      const nodeAddresses = nodes.map((node) => node.address);
      const merkleRoot = await this.merkleTree.createRoot(nodeAddresses);

      for (const region of this.regions) {
        const regionNodes = nodes.filter((node) => node.region === region);

        for (const node of regionNodes) {
          const isHealthy = await this.checkNodeHealth(node.address, region);

          if (isHealthy) {
            const nodeIndex = nodeAddresses.indexOf(node.address);
            const proof = await this.merkleTree.generateProof(nodeIndex);
            const isValid = await this.merkleTree.verifyProof(
              proof,
              node.address,
              merkleRoot,
            );

            if (isValid) {
              await this.updateHealthCheck(node);
            } else {
              Logger.warn(`Invalid Merkle proof for node ${node.address}`);
            }
          }
        }
      }

      Logger.info(
        `Updated node list: ${this.knownNodes.size} total nodes, Merkle root: ${merkleRoot}`,
      );
    } catch (error) {
      Logger.error('Failed to update node list:', error);
    }
  }

  private setupIntervals() {
    this.healthCheckInterval = setInterval(
      () => this.updateNodeList(),
      2 * 60 * 1000,
    );
  }

  public async start(): Promise<void> {
    try {
      await this.updateNodeList();
      Logger.info(`H3Tag seed server started on port ${this.port}`);
    } catch (error) {
      Logger.error('Failed to start seed server:', error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    try {
      await Promise.all([this.cloudWatch.destroy(), this.route53.destroy()]);
    } catch (err) {
      Logger.warn('Error while destroying AWS SDK clients', err);
    }

    this.knownNodes.clear();
    Logger.info('Seed server shut down successfully');
  }
}

if (require.main === module) {
  main();
}
