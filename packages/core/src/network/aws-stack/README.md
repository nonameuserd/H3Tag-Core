## Infrastructure Components

- **VPC**: Isolated network with public and private subnets
- **EC2 Instances**: Seed nodes running Ubuntu with configured security groups
- **Route53**: DNS management for seed node discovery
- **CloudWatch**: Monitoring and logging
- **Backup**: Automated backup strategy with retention policies
- **Security Groups**: Firewall rules for network access
- **IAM Roles**: Least-privilege access control
- **S3**: Flow logs and configuration storage
- **KMS**: Encryption key management
- **SSM**: Parameter store for configuration

## Security Features

- Private subnets for EC2 instances
- Security group restrictions
- Encrypted volumes
- IAM role-based access
- VPC flow logs
- DDoS protection
- Regular security patches

## Monitoring & Maintenance

### Health Checks

- TCP health checks on port 2333
- HTTP health checks on `/health` endpoint
- CloudWatch metrics and alarms
- Route53 health checks for DNS failover

### Logs

CloudWatch Log Groups:

- `/aws/ec2/seed-server`
- VPC flow logs
- Application logs

### Metrics

Custom CloudWatch metrics:

- Node status
- Peer count
- Network performance
- Resource utilization

## Troubleshooting

1. **Deployment Failures**

   ```bash
   # Get deployment logs
   cdk doctor
   aws cloudformation describe-stack-events --stack-name SeedServerStack-{region}-{environment}
   ```

2. **Instance Access**

   ```bash
   # Connect via SSM
   aws ssm start-session --target i-1234567890abcdef0 --region {region}
   ```

3. **Common Issues**
   - Check IAM roles and permissions
   - Verify VPC endpoints
   - Confirm security group rules
   - Check Route53 DNS propagation

## License

[MIT](LICENSE)
