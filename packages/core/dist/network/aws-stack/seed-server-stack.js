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
exports.SeedServerStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const backup = __importStar(require("aws-cdk-lib/aws-backup"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const os = __importStar(require("os"));
const constants_1 = require("../../blockchain/utils/constants");
const node_initializer_1 = require("./script/node-initializer");
const shared_1 = require("@h3tag-blockchain/shared");
const merkle_1 = require("../../utils/merkle");
const crypto_1 = require("@h3tag-blockchain/crypto");
class SeedServerStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        this.merkleTree = new merkle_1.MerkleTree();
        this.config = {
            networkType: shared_1.NetworkType.MAINNET
        };
        this.initialize(props);
    }
    initialize(props) {
        // VPC
        const vpc = new ec2.Vpc(this, 'SeedServerVPC', {
            maxAzs: 2,
            natGateways: 1,
            subnetConfiguration: [
                {
                    name: 'Public',
                    subnetType: ec2.SubnetType.PUBLIC,
                    cidrMask: 24,
                },
                {
                    name: 'Private',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidrMask: 24,
                }
            ]
        });
        // IAM Role for EC2
        const role = new iam.Role(this, 'SeedServerRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy')
            ]
        });
        // Enhanced Security Group with complete outbound rules
        const securityGroup = new ec2.SecurityGroup(this, 'SeedServerSG', {
            vpc,
            description: 'Security group for H3TAG seed servers',
            allowAllOutbound: false,
        });
        // Inbound rules
        securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8333), 'Allow HDC protocol');
        securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH access');
        // Complete outbound rules
        securityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS outbound');
        securityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP outbound');
        securityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(53), 'Allow DNS outbound');
        securityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(123), 'Allow NTP outbound');
        // Update security group rules
        securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8333), 'Allow blockchain network traffic');
        // Production EC2 Instance
        const instance = new ec2.Instance(this, 'SeedServer', {
            vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, // Use private subnet
            },
            securityGroup,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
            machineImage: ec2.MachineImage.lookup({
                name: process.env.UBUNTU_AMI_PATTERN,
                owners: [process.env.CANONICAL_OWNER_ID],
            }),
            role,
            blockDevices: [{
                    deviceName: '/dev/xvda',
                    volume: ec2.BlockDeviceVolume.ebs(30, {
                        volumeType: ec2.EbsDeviceVolumeType.GP3,
                        encrypted: true,
                        deleteOnTermination: true,
                    }),
                }],
            detailedMonitoring: true, // Enables detailed CloudWatch monitoring
        });
        // Add blockchain and database configuration
        const blockchainConfig = {
            network: {
                type: shared_1.NetworkType.MAINNET,
                port: 8333,
                host: "h3tag.net",
                seedDomains: [
                    "seed1.h3tag.net",
                    "seed2.h3tag.net",
                    "seed3.h3tag.net",
                    "seed4.h3tag.net" // Asia
                ]
            },
            votingConstants: {
                votingPeriodBlocks: 210240,
                votingPeriodMs: 690 * 24 * 60 * 60 * 1000,
                minPowWork: 1000,
                cooldownBlocks: 1000,
                maxVotesPerPeriod: 1000,
                minAccountAge: 1000,
                minPeerCount: 1000,
                voteEncryptionVersion: "1.0",
                maxVoteSizeBytes: 1000,
                votingWeight: 1000,
                minVotesForValidity: 1000,
                votePowerDecay: 1000,
            },
            wallet: {
                address: '',
                publicKey: async () => {
                    const keyPair = await crypto_1.KeyManager.generateKeyPair();
                    return typeof keyPair.publicKey === 'function'
                        ? await keyPair.publicKey()
                        : keyPair.publicKey;
                },
                privateKey: async () => {
                    const keyPair = await crypto_1.KeyManager.generateKeyPair();
                    return typeof keyPair.privateKey === 'function'
                        ? await keyPair.privateKey()
                        : keyPair.privateKey;
                }
            },
            consensus: {
                powWeight: 0.6,
                voteWeight: 0.4,
                minPowHashrate: 1000000,
                minVoterCount: 1000,
                minPeriodLength: 1000,
                votingPeriod: 210240,
                minParticipation: 0.1,
                votePowerCap: 0.05,
                votingDayPeriod: 690 * 24 * 60 * 60 * 1000,
                consensusTimeout: 30 * 60 * 1000,
                emergencyTimeout: 60 * 60 * 1000, // 1 hour
            },
            mining: {
                blocksPerYear: 52560,
                initialReward: 50n,
                halvingInterval: 210000,
                maxHalvings: 69,
                blockTime: 600,
                maxDifficulty: 1000000,
                targetTimePerBlock: 60000,
                difficulty: 7,
                minHashthreshold: 1000000,
                minPowNodes: 3,
                maxForkDepth: 100,
                emergencyPowThreshold: 0.85,
                minPowScore: 0.51,
                forkResolutionTimeout: 600000,
                difficultyAdjustmentInterval: 2016,
                initialDifficulty: 1,
                hashBatchSize: 10000,
                minDifficulty: 3,
                chainDecisionThreshold: 0.67,
                orphanWindow: 100,
                propagationWindow: 50,
                maxPropagationTime: 30000,
                targetTimespan: 14 * 24 * 60 * 60,
                targetBlockTime: 600,
                maxTarget: BigInt("0x00000000ffff0000000000000000000000000000000000000000000000000000"),
            },
            currency: {
                name: 'H3TAG',
                symbol: 'TAG',
                decimals: 18,
                initialSupply: 21000000,
                maxSupply: 69690000,
                units: {
                    MACRO: 1n,
                    MICRO: 1000000n,
                    MILLI: 1000000000n,
                    TAG: 1000000000000n,
                },
            },
            util: {
                retryAttempts: 3,
                retryDelayMs: 1000,
                cacheTtlHours: 24,
                validationTimeoutMs: 30000,
                initialRetryDelay: 1000,
                maxRetryDelay: 30000,
                backoffFactor: 2,
                maxRetries: 1000,
                cacheTtl: 60000,
                pruneThreshold: 0.8,
            }
        };
        const userData = ec2.UserData.forLinux();
        userData.addCommands('set -e', 'exec 1> >(logger -s -t $(basename $0)) 2>&1', 
        // Create config directory and file
        'mkdir -p /opt/blockchain/config', `echo '${JSON.stringify(blockchainConfig)}' > /opt/blockchain/config/blockchain-config.json`, 
        // System updates and installation
        'apt-get update || { echo "Failed to update package list"; exit 1; }', 'DEBIAN_FRONTEND=noninteractive apt-get upgrade -y || { echo "Failed to upgrade packages"; exit 1; }', 'DEBIAN_FRONTEND=noninteractive apt-get install -y curl git build-essential || { echo "Failed to install dependencies"; exit 1; }', 
        // Create initialization script
        'cat > /opt/blockchain/init.js << EOL\n' +
            node_initializer_1.NodeInitializer.getInitializationScript(blockchainConfig) +
            '\nEOL', 
        // Execute initialization script
        'node /opt/blockchain/init.js || { echo "Failed to initialize node"; exit 1; }', 
        // Add network configuration
        `echo 'export NETWORK_TYPE=${this.config.networkType}' >> /etc/environment`, `echo 'export PORT=${constants_1.BLOCKCHAIN_CONSTANTS.CURRENCY.NETWORK.port.MAINNET}' >> /etc/environment`, `echo 'export MAX_PEERS=125' >> /etc/environment`, `echo 'export MIN_PEERS=8' >> /etc/environment`, `echo 'export CONNECTION_TIMEOUT=${constants_1.BLOCKCHAIN_CONSTANTS.UTIL.VALIDATION_TIMEOUT_MS}' >> /etc/environment`, 
        // Configure worker pool
        `echo 'export MAX_WORKERS=${os.cpus().length}' >> /etc/environment`, `echo 'export WORKER_IDLE_TIMEOUT=60000' >> /etc/environment`, `echo 'export WORKER_HEALTH_CHECK_INTERVAL=30000' >> /etc/environment`);
        instance.addUserData(userData.render());
        // Updated DNS configuration with error handling
        try {
            const zone = route53.HostedZone.fromLookup(this, 'HostedZone', {
                domainName: props.domainName
            });
            new route53.ARecord(this, 'SeedServerDNS', {
                zone,
                recordName: `seed.${props.domainName}`,
                target: route53.RecordTarget.fromIpAddresses(instance.instancePrivateIp),
                ttl: cdk.Duration.minutes(5),
                comment: 'DNS record for H3TAG seed server',
            });
        }
        catch (error) {
            throw new Error(`Failed to configure DNS: ${error.message}`);
        }
        // Health Check
        new route53.CfnHealthCheck(this, 'SeedHealthCheck', {
            healthCheckConfig: {
                port: 8333,
                type: 'TCP',
                resourcePath: '/health',
                fullyQualifiedDomainName: `${process.env.SEED_RECORD_NAME || 'seed1'}.${process.env.DOMAIN_NAME || 'h3tag.network'}`,
                requestInterval: 30,
                failureThreshold: 3,
            }
        });
        // Enable backup
        new backup.BackupPlan(this, 'SeedServerBackup', {
            backupPlanRules: [
                backup.BackupPlanRule.daily(),
                backup.BackupPlanRule.weekly(),
                // Add monthly backup for long-term retention
                new backup.BackupPlanRule({
                    ruleName: 'Monthly',
                    scheduleExpression: events.Schedule.expression('cron(0 0 1 * ? *)'),
                    deleteAfter: cdk.Duration.days(365),
                })
            ]
        }).addSelection('Selection', {
            resources: [
                backup.BackupResource.fromEc2Instance(instance)
            ]
        });
        // CloudWatch Dashboard
        new cloudwatch.Dashboard(this, 'SeedServerDashboard', {
            dashboardName: 'H3Tag-Seeds',
            widgets: [
                [
                    new cloudwatch.GraphWidget({
                        title: 'Node Status',
                        width: 24,
                        left: [
                            new cloudwatch.Metric({
                                namespace: 'H3Tag/SeedNodes',
                                metricName: 'NodeStatus',
                                dimensionsMap: {
                                    Region: this.region,
                                },
                                statistic: 'Average',
                                period: cdk.Duration.minutes(5),
                            }),
                            new cloudwatch.Metric({
                                namespace: 'H3Tag/SeedNodes',
                                metricName: 'PeerCount',
                                statistic: 'Average',
                                period: cdk.Duration.minutes(5),
                            }),
                            new cloudwatch.Metric({
                                namespace: 'H3Tag/SeedNodes',
                                metricName: 'WorkerUtilization',
                                statistic: 'Average',
                                period: cdk.Duration.minutes(5),
                            }),
                            new cloudwatch.Metric({
                                namespace: 'H3Tag/SeedNodes',
                                metricName: 'NetworkBandwidth',
                                statistic: 'Average',
                                period: cdk.Duration.minutes(5),
                            }),
                        ],
                    }),
                ],
            ],
        });
    }
}
exports.SeedServerStack = SeedServerStack;
//# sourceMappingURL=seed-server-stack.js.map