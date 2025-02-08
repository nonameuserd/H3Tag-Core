import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as backup from 'aws-cdk-lib/aws-backup';
import * as events from 'aws-cdk-lib/aws-events';
import * as os from 'os';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Logger } from '@h3tag-blockchain/shared';

interface SeedServerStackProps extends cdk.StackProps {
  domainName: string;
  environment: string;
  deploymentScriptPath: string;
}

export class SeedServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SeedServerStackProps) {
    super(scope, id, props);
    this.initialize(props);
  }

  private initialize(props: SeedServerStackProps): void {
    // Add input validation
    if (!props.domainName || !props.environment) {
      throw new Error(
        'Missing required properties: domainName and environment',
      );
    }

    const flowLogBucket = new s3.Bucket(this, 'FlowLogBucket', {
      bucketName: `h3tag-flow-logs-${this.account}-${this.region}-${props.environment}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: new kms.Key(this, 'FlowLogKey', {
        enableKeyRotation: true,
        description: 'KMS key for VPC flow logs',
      }),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          enabled: true,
          expiration: cdk.Duration.days(365),
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true, // Enable versioning
    });

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
        },
      ],
    });

    const role = new iam.Role(this, 'SeedServerRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'Role for H3TAG seed server',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AmazonSSMManagedInstanceCore',
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'CloudWatchAgentServerPolicy',
        ),
      ],
    });

    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: [
          `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/ec2/*`,
        ],
      }),
    );

    const securityGroup = new ec2.SecurityGroup(this, 'SeedServerSG', {
      vpc,
      description: 'Security group for H3TAG seed servers',
      allowAllOutbound: false,
    });

    vpc.addFlowLog('VpcFlowLogs', {
      destination: ec2.FlowLogDestination.toS3(flowLogBucket),
      trafficType: ec2.FlowLogTrafficType.ALL,
      maxAggregationInterval: ec2.FlowLogMaxAggregationInterval.ONE_MINUTE,
    });

    // Enhance security group rules
    securityGroup.addIngressRule(
      ec2.Peer.ipv4('0.0.0.0/0'),
      ec2.Port.tcp(2333),
      'Allow blockchain network traffic',
      true, // Enable connection tracking
    );

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'Allow SSH access',
    );

    // Essential outbound rules
    securityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS outbound',
    );
    securityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP outbound',
    );
    securityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(53),
      'Allow DNS outbound',
    );
    securityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(123),
      'Allow NTP outbound',
    );

    // Allow DNS resolution
    securityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.udp(53),
      'Allow DNS UDP outbound',
    );

    // Allow IPv6 support
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.tcp(2333),
      'Allow blockchain network traffic IPv6',
    );

    const instance = new ec2.Instance(this, 'SeedServer', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MEDIUM,
      ),
      machineImage: ec2.MachineImage.lookup({
        name:
          process.env.UBUNTU_AMI_PATTERN ||
          '*ubuntu-focal-20.04-amd64-server-*',
        owners: [process.env.CANONICAL_OWNER_ID || '0'],
      }),
      role,
      requireImdsv2: true,
      userData: ec2.UserData.forLinux(),
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(30, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
            deleteOnTermination: true,
            iops: 3000,
            throughput: 125,
          }),
        },
      ],
      detailedMonitoring: true,
    });

    try {
      const zone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: props.domainName,
        privateZone: false,
      });

      // Add health check before creating DNS record
      const healthCheck = new route53.HealthCheck(this, 'SeedHealthCheck', {
        port: 2333,
        type: route53.HealthCheckType.HTTP,
        resourcePath: '/health',
        requestInterval: cdk.Duration.seconds(30),
        failureThreshold: 3,
        enableSNI: true,
        regions: [this.region],
      });

      new route53.ARecord(this, 'SeedServerDNS', {
        zone,
        recordName: `seed.${props.domainName}`,
        target: route53.RecordTarget.fromIpAddresses(instance.instancePublicIp),
        ttl: cdk.Duration.minutes(5),
        comment: 'DNS record for H3TAG seed server',
        healthCheck,
      });
    } catch (error) {
      Logger.error('DNS configuration failed:', error);
      throw error;
    }

    // 9. Enhanced backup configuration
    const backupPlan = new backup.BackupPlan(this, 'SeedServerBackup', {
      backupPlanRules: [
        backup.BackupPlanRule.daily(),
        backup.BackupPlanRule.weekly(),
        new backup.BackupPlanRule({
          ruleName: 'Monthly',
          scheduleExpression: events.Schedule.expression('cron(0 0 1 * ? *)'),
          deleteAfter: cdk.Duration.days(365),
          moveToColdStorageAfter: cdk.Duration.days(90),
          copyActions: [
            {
              destinationBackupVault: new backup.BackupVault(
                this,
                'CrossRegionVault',
                {
                  encryptionKey: new kms.Key(this, 'BackupKeyCrossRegion', {
                    enableKeyRotation: true,
                    description: 'KMS key for backup encryption',
                  }),
                },
              ),
            },
          ],
          backupVault: new backup.BackupVault(this, 'EncryptedVault', {
            encryptionKey: new kms.Key(this, 'BackupKeyVault', {
              enableKeyRotation: true,
              description: 'KMS key for backup encryption',
            }),
          }),
        }),
      ],
    });

    backupPlan.addSelection('Selection', {
      resources: [backup.BackupResource.fromEc2Instance(instance)],
      allowRestores: true,
    });

    new cloudwatch.Dashboard(this, 'SeedServerDashboard', {
      dashboardName: `H3Tag-Seeds-${props.environment}`,
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
                  Environment: props.environment,
                },
                statistic: 'Average',
                period: cdk.Duration.minutes(5),
              }),
              new cloudwatch.Metric({
                namespace: 'H3Tag/SeedNodes',
                metricName: 'PeerCount',
                dimensionsMap: {
                  Region: this.region,
                  Environment: props.environment,
                },
                statistic: 'Average',
                period: cdk.Duration.minutes(5),
              }),
            ],
          }),
        ],
      ],
    });

    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('Application', 'H3TAG-SeedServer');
    cdk.Tags.of(this).add('Region', this.region);

    this.setupInstanceConfiguration(instance, props);
  }

  private setupInstanceConfiguration(
    instance: ec2.Instance,
    props: SeedServerStackProps,
  ): void {
    // secure SSM parameters for sensitive configurations

    const blockchainConfig = new ssm.StringParameter(this, 'BlockchainConfig', {
      parameterName: `/h3tag/${props.environment}/blockchain-config`,
      stringValue: JSON.stringify(
        {
          network: {
            type: 'MAINNET',
            port: {
              MAINNET: 2333,
              TESTNET: 10001,
              DEVNET: 10002,
            },
            host: {
              MAINNET: `mainnet.${props.domainName}`,
              TESTNET: `testnet.${props.domainName}`,
              DEVNET: `devnet.${props.domainName}`,
            },
            seedDomains: {
              MAINNET: [
                `seed1.${props.domainName}`,
                `seed2.${props.domainName}`,
                `seed3.${props.domainName}`,
                `seed4.${props.domainName}`,
                `seed5.${props.domainName}`,
                `seed6.${props.domainName}`,
              ],
              TESTNET: [
                `test-seed1.${props.domainName}`,
                `test-seed2.${props.domainName}`,
                `test-seed3.${props.domainName}`,
              ],
              DEVNET: [
                `dev-seed1.${props.domainName}`,
                `dev-seed2.${props.domainName}`,
              ],
            },
          },
          mining: {
            maxAttempts: 1000,
            currentVersion: 1,
            maxVersion: 2,
            minVersion: 1,
            batchSize: 10000,
            blocksPerYear: 52560,
            initialReward: BigInt(5000000000),
            minReward: BigInt(546),
            halvingInterval: 105000,
            maxHalvings: 69,
            blockTime: 300000,
            maxBlockTime: 300000,
            maxDifficulty: 1000000,
            targetTimePerBlock: 300000,
            difficulty: 7,
            minHashrate: 1000000,
            maxPropagationWindow: 10000,
            minPowNodes: 3,
            maxForkDepth: 100,
            emergencyPowThreshold: 0.85,
            minPowScore: 0.51,
            forkResolutionTimeoutMs: 600000,
            difficultyAdjustmentInterval: 2016,
            initialDifficulty: 0x1d0000ffff,
            hashBatchSize: 10000,
            maxTarget: BigInt(
              '0x0000000000ffff0000000000000000000000000000000000000000000000000000',
            ),
            minDifficulty: 2,
            nodeSelectionThreshold: 0.67,
            orphanWindow: 100,
            propagationWindow: 50,
            maxPropagationTime: 30000,
            targetTimespan: 1209600,
            targetBlockTime: 600,
            adjustmentInterval: 2016,
            maxAdjustmentFactor: 0.25,
            voteInfluence: 0.4,
            minVotesWeight: 0.1,
            maxChainLength: 10000000,
            forkResolutionTimeout: 600000,
            minRewardContribution: '2016',
            maxBlockSize: 1048576,
            minBlockSize: 1024,
            maxTransactions: 10000,
            minBlocksMined: 100,
            blockReward: BigInt(5000000000),
            maxTxSize: 1048576,
            minFeePerByte: 1n,
            autoMine: process.env.AUTO_MINE === 'true' || false,
            cacheTtl: 3600000,
            maxSupply: BigInt(50000000),
            safeConfirmationTime: 3600000,
          },
          consensus: {
            powWeight: 0.6,
            minPowHashRate: 1000000,
            minVoterCount: 1000,
            minPeriodLength: 1000,
            votingPeriod: 105120,
            minParticipation: 0.1,
            votePowerCap: 0.05,
            votingDayPeriod: 345 * 24 * 60 * 60 * 1000,
            consensusTimeout: 30 * 60 * 1000,
            emergencyTimeout: 60 * 60 * 1000,
            nodeSelectionTimeout: 5 * 60 * 1000,
            voteCollectionTimeout: 3 * 60 * 1000,
            initialReward: BigInt(546),
            baseReward: 100n * 10n ** 18n,
            minReward: 10n * 10n ** 18n,
            maxSafeReward: 1000000n * 10n ** 18n,
            halvingInterval: 105000,
            baseDifficulty: 1n,
            maxForkLength: 100,
            validatorWeight: 100,
          },
          votingConstants: {
            votingPeriodBlocks: 105120,
            votingPeriodMs: 63072000000,
            periodCheckInterval: 60000,
            minPowWork: 10000,
            cooldownBlocks: 100,
            maxVotesPerPeriod: 100000,
            maxVotesPerWindow: 5,
            minAccountAge: 10080,
            minPeerCount: 3,
            voteEncryptionVersion: '1.0',
            maxVoteSizeBytes: 1024 * 100,
            votingWeight: 0.4,
            minVotesForValidity: 0.1,
            votePowerDecay: 0.5,
            minVotingPower:  BigInt(100),
            maxVotingPower: BigInt(1000000),
            maxVoteAge: 86400000,
            maturityPeriod: 86400000,
            cacheDuration: 300000,
            minVoteAmount: 1,
            minPowContribution: 1000,
            reputationThreshold: 100,
            rateLimitWindow: 3600,
          },
          util: {
            retry: {
              maxAttempts: 1000,
              initialDelayMs: 1000,
              maxDelayMs: 30000,
              backoffFactor: 2,
            },
            cache: {
              ttlMs: 60000,
              ttlHours: 24,
              cleanupIntervalMs: 300000,
            },
            processingTimeoutMs: 30000,
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
            baseMaxSize: 1000000,
            absoluteMaxSize: 10000000,
            staleThreshold: 7 * 24 * 60 * 60 * 1000,
          },
          transaction: {
            minFee: BigInt(1),
            currentVersion: 1,
            maxInputs: 1000,
            maxOutputs: 1000,
            maxTimeDrift: 7200000,
            amountLimits: {
              min: BigInt(1),
              max: BigInt('5000000000000000'),
              decimals: 8,
            },
            mempool: {
              highCongestionThreshold: 50000,
              maxSize: 300000,
              maxMb: 300,
              minFeeRate: BigInt(1),
              feeRateMultiplier: 1.5,
              evictionInterval: 600000,
              cleanupInterval: 60000,
              maxMemoryUsage: 536870912,
              minSize: 1000,
            },
            processingTimeout: 30000,
            maxSize: 1000000,
            maxScriptSize: 1000000,
            maxTotalInput: BigInt('1000000000000000'),
            maxSignatureSize: 520,
            maxPubkeySize: 65,
            minInputAge: 3600000,
            minTxVersion: 1,
            maxTxVersion: 1,
            required: 6,
            maxMessageAge: 300000,
            maxBlockSize: 2097152,
            maxTxSize: 2097152,
          },
          validator: {
            minValidatorUptime: 0.97,
            minVoteParticipation: 0.99,
            minBlockProduction: 0.75,
          },
          backupValidatorConfig: {
            maxBackupAttempts: 3,
            backupSelectionTimeout: 30000,
            minBackupReputation: 70,
            minBackupUptime: 0.95,
          },
          message: {
            prefix: '\x18H3Tag Signed Message:\n',
            maxLength: 100000,
            minLength: 1,
          },
          version: 1,
          minSafeConfirmations: 6,
          maxSafeUtxoAmount: 1000000000000,
          coinbaseMaturity: 100,
          userAgent: '/H3Tag:1.0.0/',
          protocolVersion: 1,
          maxMempoolSize: 50000,
          minRelayTxFee: 0.00001,
          minPeers: 3,
        },
        (_, value) => (typeof value === 'bigint' ? value.toString() : value),
      ),
      tier: ssm.ParameterTier.STANDARD,
      description: 'H3TAG Blockchain configuration',
      allowedPattern: '^[{].*[}]$',
      dataType: ssm.ParameterDataType.TEXT,
    });

    const parameterKey = new kms.Key(this, 'BlockchainConfigKey', {
      enableKeyRotation: true,
      description: 'KMS key for blockchain configuration encryption',
      alias: `h3tag-${props.environment}-blockchain-config`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    blockchainConfig.grantRead(instance.role);

    (instance.role as iam.Role).addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [blockchainConfig.parameterArn],
        conditions: {
          StringEquals: {
            'aws:RequestedRegion': props.env?.region || 'us-east-1',
            'aws:PrincipalTag/Environment': props.environment,
          },
        },
      }),
    );

    parameterKey.grantDecrypt(instance.role);

    const initializationDocument = new ssm.CfnDocument(
      this,
      'NodeInitializationDocument',
      {
        content: {
          schemaVersion: '2.2',
          description: 'Initialize H3TAG seed node',
          parameters: {
            environment: {
              type: 'String',
              description: 'Deployment environment',
            },
          },
          mainSteps: [
            {
              action: 'aws:runShellScript',
              name: 'configureNode',
              inputs: {
                runCommand: [
                  'set -e',
                  'exec 1> >(logger -s -t $(basename $0)) 2>&1',

                  // Install dependencies
                  'apt-get update',
                  'DEBIAN_FRONTEND=noninteractive apt-get upgrade -y',
                  'DEBIAN_FRONTEND=noninteractive apt-get install -y curl git build-essential',

                  // Get configuration from SSM
                  'aws ssm get-parameter --name "/h3tag/{{ environment }}/blockchain-config" --query "Parameter.Value" --output text > /opt/blockchain/config/blockchain-config.json',

                  // Initialize node
                  'node /opt/blockchain/init.js',
                ],
              },
            },
          ],
        },
        documentType: 'Command',
        name: `H3TAG-Node-Init-${props.environment}`,
      },
    );

    // instance user data to bootstrap SSM agent
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'set -e',
      'exec 1> >(logger -s -t $(basename $0)) 2>&1',

      // Install and start SSM agent
      'snap install amazon-ssm-agent --classic',
      'systemctl enable amazon-ssm-agent',
      'systemctl start amazon-ssm-agent',

      // Set environment variables
      `echo 'export NODE_ENV=${props.environment}' >> /etc/environment`,
      `echo 'export MAX_WORKERS=${os.cpus().length}' >> /etc/environment`,
    );

    instance.addUserData(userData.render());

    // automation for node initialization
    new ssm.CfnAssociation(this, 'NodeInitializationAssociation', {
      name: initializationDocument.name!,
      targets: [
        {
          key: 'InstanceIds',
          values: [instance.instanceId],
        },
      ],
      parameters: {
        environment: [props.environment],
      },
    });

    // Policy for CloudWatch Logs actions with narrowed resource scope.
    instance.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'logs:DescribeLogStreams',
        ],
        resources: [
          `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/ec2/seed-server-*`,
        ],
      }),
    );

    // Policy for actions that do not support resource-level restrictions.
    instance.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData', 'ec2:DescribeTags'],
        resources: ['*'],
      }),
    );
  }
}
