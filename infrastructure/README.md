# ISMS Infrastructure as Code

This directory contains CloudFormation templates and deployment scripts for the ISMS application on AWS.

## Architecture

The infrastructure includes:
- **VPC**: Isolated network with public and private subnets
- **Aurora Serverless v2**: Auto-scaling PostgreSQL database
- **ECS Fargate**: Container orchestration with Spot capacity providers
- **Application Load Balancer**: Routes traffic to ECS services
- **CodeDeploy**: Blue/Green deployments for zero-downtime updates
- **ECR**: Container image registry with lifecycle policies
- **Secrets Manager**: Secure storage for sensitive configuration

## Prerequisites

- AWS CLI configured with appropriate credentials
- AWS Account ID for the target environment
- ACM certificate ARN (or create manually)
- GitHub repository configured with OIDC (for CI/CD)

## Directory Structure

```
infrastructure/
├── templates/          # CloudFormation templates
│   ├── vpc.yaml
│   ├── security-groups.yaml
│   ├── aurora.yaml
│   ├── secrets-manager.yaml
│   ├── iam-roles.yaml
│   ├── ecr.yaml
│   ├── ecs-cluster.yaml
│   ├── codedeploy.yaml
│   ├── alb.yaml
│   └── main.yaml
├── parameters/         # Environment-specific parameters
│   ├── staging-params.json
│   └── production-params.json
├── appspecs/          # CodeDeploy AppSpec files
│   ├── backend-appspec.yaml
│   └── frontend-appspec.yaml
└── scripts/           # Deployment helper scripts
    ├── deploy-utils.sh          # Main deployment utility (use this for all deployments)
    ├── validate-templates.sh   # CloudFormation template validation
    ├── seed-system-data.sh      # Seed system data to existing environments
    ├── setup-github-actions.sh  # GitHub Actions setup helper
    ├── check-embeddings-simple.sh      # Check control embedding status
    ├── check-control-embeddings.sh     # Check control embeddings
    ├── backfill-control-embeddings.sh  # Backfill control embeddings
    ├── backfill-embeddings-onetime-task.sh  # Alternative backfill method
    └── pull-ollama-model.sh     # Pull Ollama embedding model
```

## Deployment

For complete deployment instructions, see **[DEPLOYMENT.md](./DEPLOYMENT.md)**. This is the primary guide for deploying and managing the ISMS infrastructure.

### Quick Reference

**Main Deployment Utility:**
```bash
cd infrastructure
./scripts/deploy-utils.sh --help
```

**Common Commands:**
- Build and push images: `./scripts/deploy-utils.sh build-all-images`
- Deploy services: `./scripts/deploy-utils.sh deploy-frontend` or `deploy-backend`
- View logs: `./scripts/deploy-utils.sh view-logs --service backend`
- Monitor deployments: `./scripts/deploy-utils.sh monitor-deployment --service backend`

**Template Validation:**
```bash
./scripts/validate-templates.sh
```

**GitHub Actions Setup:**
See [GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md) for detailed GitHub Actions configuration.

## Environment Configuration

### Staging (`trust.demo.paythru.com`)
- Account: `956880242582` (Paythru Pre-Production)
- Aurora: 0.5-16 ACU
- ECS Tasks: 1-4 tasks (70% Spot)
- Deployment: Canary (10% → 50% → 100%)

### Production (`trust.paythru.com`)
- Account: `641918319442` (Paythru Apps)
- Aurora: 2-128 ACU
- ECS Tasks: 2-10 tasks (50% Spot)
- Deployment: Linear (25% → 50% → 75% → 100%)

## Cost Optimizations

1. **Fargate Spot**: 30-50% cost savings on compute
2. **Graviton2 (ARM64)**: 20% cost savings vs x86_64
3. **Aurora Serverless v2**: Pay only for what you use (40-60% savings for variable workloads)
4. **ECR Lifecycle Policies**: Automatic cleanup of old images (60-80% storage savings)

## Troubleshooting

For troubleshooting guidance, see the **Troubleshooting** section in [DEPLOYMENT.md](./DEPLOYMENT.md).

## Maintenance

For maintenance procedures, see [DEPLOYMENT.md](./DEPLOYMENT.md) sections on:
- Updating deployments
- Configuring secrets
- Scaling services
- Monitoring deployments

## Security

- All secrets stored in AWS Secrets Manager (never in code)
- ECS tasks run in private subnets (no direct internet access)
- Security groups follow least-privilege principle
- HTTPS enforced via ALB
- OIDC for GitHub Actions (no long-lived credentials)

## References

- [AWS CloudFormation Documentation](https://docs.aws.amazon.com/cloudformation/)
- [ECS Blue/Green Deployments](https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-steps-ecs.html)
- [Aurora Serverless v2](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html)

