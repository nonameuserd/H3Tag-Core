"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeedServer = void 0;
const undici_1 = require("undici");
const client_cloudwatch_1 = require("@aws-sdk/client-cloudwatch");
const client_route_53_1 = require("@aws-sdk/client-route-53");
const shared_1 = require("@h3tag-blockchain/shared");
const merkle_1 = require("../../utils/merkle");
class SeedServer {
    constructor(port = 8333) {
        this.knownNodes = new Map();
        this.port = port;
        this.regions = [process.env.AWS_REGION];
        // Initialize AWS Services
        const config = {
            region: process.env.AWS_REGION || "us-east-1",
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        };
        this.cloudWatch = new client_cloudwatch_1.CloudWatch(config);
        this.route53 = new client_route_53_1.Route53(config);
        this.merkleTree = new merkle_1.MerkleTree();
        this.setupIntervals();
    }
    async publishMetrics(node) {
        try {
            await this.cloudWatch.putMetricData({
                Namespace: "H3Tag/SeedNodes",
                MetricData: [
                    {
                        MetricName: "NodeStatus",
                        Value: node.status === "active" ? 1 : 0,
                        Unit: "Count",
                        Dimensions: [
                            {
                                Name: "Region",
                                Value: node.region,
                            },
                            {
                                Name: "Currency",
                                Value: "TAG",
                            },
                        ],
                    },
                ],
            });
        }
        catch (error) {
            shared_1.Logger.error("Failed to publish CloudWatch metrics:", error);
        }
    }
    async updateHealthCheck(node) {
        try {
            await this.route53.updateHealthCheck({
                HealthCheckId: `${node.region}-health-check`,
                FailureThreshold: 3,
                FullyQualifiedDomainName: node.address,
                Port: this.port,
                ResourcePath: "/health",
            });
        }
        catch (error) {
            shared_1.Logger.error("Failed to update Route53 health check:", error);
        }
    }
    async checkNodeHealth(address, region) {
        const agent = new undici_1.Agent({
            connect: {
                rejectUnauthorized: process.env.NODE_ENV === "production",
            },
        });
        try {
            const timeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Request timeout")), 5000);
            });
            const fetchPromise = (0, undici_1.fetch)(`https://${address}/version`, {
                dispatcher: agent,
            });
            const response = (await Promise.race([
                fetchPromise,
                timeout,
            ]));
            const data = await response.json();
            const isHealthy = response.ok && data.version;
            // Update CloudWatch metrics
            await this.publishMetrics({
                address,
                lastSeen: Date.now(),
                version: data.version,
                services: ["full_node"],
                status: isHealthy ? "active" : "inactive",
                region,
            });
            return isHealthy;
        }
        catch (error) {
            shared_1.Logger.debug(`Health check failed for ${address}:`, error);
            return false;
        }
        finally {
            agent.close();
        }
    }
    async updateNodeList() {
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
                        const isValid = await this.merkleTree.verifyProof(proof, node.address, merkleRoot);
                        if (isValid) {
                            await this.updateHealthCheck(node);
                        }
                        else {
                            shared_1.Logger.warn(`Invalid Merkle proof for node ${node.address}`);
                        }
                    }
                }
            }
            shared_1.Logger.info(`Updated node list: ${this.knownNodes.size} total nodes, Merkle root: ${merkleRoot}`);
        }
        catch (error) {
            shared_1.Logger.error("Failed to update node list:", error);
        }
    }
    setupIntervals() {
        // Update node list every 2 minutes
        this.healthCheckInterval = setInterval(() => this.updateNodeList(), 2 * 60 * 1000);
    }
    async start() {
        try {
            await this.updateNodeList();
            shared_1.Logger.info(`H3Tag seed server started on port ${this.port}`);
        }
        catch (error) {
            shared_1.Logger.error("Failed to start seed server:", error);
            throw error;
        }
    }
    async shutdown() {
        clearInterval(this.healthCheckInterval);
        this.knownNodes.clear();
        shared_1.Logger.info("Seed server shut down successfully");
    }
}
exports.SeedServer = SeedServer;
// Start the server if this file is run directly
if (require.main === module) {
    const PORT = process.env.SEED_PORT ? parseInt(process.env.SEED_PORT) : 8333;
    async function main() {
        try {
            if (!process.env.AWS_REGION) {
                throw new Error("AWS_REGION environment variable is required");
            }
            if (!process.env.AWS_ACCESS_KEY_ID) {
                throw new Error("AWS_ACCESS_KEY_ID environment variable is required");
            }
            if (!process.env.AWS_SECRET_ACCESS_KEY) {
                throw new Error("AWS_SECRET_ACCESS_KEY environment variable is required");
            }
            const seedServer = new SeedServer(PORT);
            await seedServer.start();
            // Handle shutdown gracefully
            process.on("SIGTERM", async () => {
                shared_1.Logger.info("SIGTERM received. Starting graceful shutdown...");
                await seedServer.shutdown();
                process.exit(0);
            });
            process.on("SIGINT", async () => {
                shared_1.Logger.info("SIGINT received. Starting graceful shutdown...");
                await seedServer.shutdown();
                process.exit(0);
            });
        }
        catch (error) {
            shared_1.Logger.error("Failed to start seed server:", error);
            process.exit(1);
        }
    }
    main();
}
//# sourceMappingURL=seedServer.js.map