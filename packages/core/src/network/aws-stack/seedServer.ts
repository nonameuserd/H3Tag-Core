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

  constructor(port: number = 8333) {
    this.port = port;
    this.regions = [process.env.AWS_REGION || 'us-east-1'];

    // Initialize AWS Services
    const config = {
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    };

    this.cloudWatch = new CloudWatch(config);
    this.route53 = new Route53(config);
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
              {
                Name: 'Region',
                Value: node.region,
              },
              {
                Name: 'Currency',
                Value: 'TAG',
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
      await this.route53.updateHealthCheck({
        HealthCheckId: `${node.region}-health-check`,
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
    const agent = new Agent({
      connect: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    });

    try {
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 5000);
      });

      const fetchPromise = fetch(`https://${address}/version`, {
        dispatcher: agent,
      });

      const response = (await Promise.race([
        fetchPromise,
        timeout,
      ])) as Response;
      const data = await response.json();

      const isHealthy = response.ok && data.version;

      // Update CloudWatch metrics
      await this.publishMetrics({
        address,
        lastSeen: Date.now(),
        version: data.version,
        services: ['full_node'],
        status: isHealthy ? 'active' : 'inactive',
        region,
      });

      return isHealthy;
    } catch (error) {
      Logger.debug(`Health check failed for ${address}:`, error);
      return false;
    } finally {
      agent.close();
    }
  }

  private async updateNodeList() {
    try {
      const nodes = Array.from(this.knownNodes.values());

      // Create Merkle root from node addresses
      const nodeAddresses = nodes.map((node) => node.address);
      const merkleRoot = await this.merkleTree.createRoot(nodeAddresses);

      // Verify each node against the Merkle root
      for (const region of this.regions) {
        const regionNodes = nodes.filter((node) => node.region === region);

        for (const node of regionNodes) {
          const isHealthy = await this.checkNodeHealth(node.address, region);

          if (isHealthy) {
            // Generate and verify Merkle proof for this node
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
    // Update node list every 2 minutes
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
    clearInterval(this.healthCheckInterval);
    this.knownNodes.clear();
    Logger.info('Seed server shut down successfully');
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  main();
}
