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
    ├── deploy.sh
    ├── validate-templates.sh
    └── create-codedeploy-deployment.sh
```

## Deployment

### Prerequisites

1. **Upload templates to S3** (required for nested stacks):
   ```bash
   # Create S3 bucket for templates (one-time)
   aws s3 mb s3://isms-cloudformation-templates-$(aws sts get-caller-identity --query Account --output text) --region eu-west-2
   
   # Upload templates
   aws s3 sync infrastructure/templates/ s3://isms-cloudformation-templates-$(aws sts get-caller-identity --query Account --output text)/templates/ --region eu-west-2
   ```

   **Note**: Update `main.yaml` TemplateURL paths to use your S3 bucket, or deploy stacks separately (see below).

### Initial Setup

1. **Validate templates**:
   ```bash
   cd infrastructure
   ./scripts/validate-templates.sh
   ```

2. **Create ACM certificate** (if not already created):
   ```bash
   aws acm request-certificate \
     --domain-name trust.demo.paythru.com \
     --validation-method DNS \
     --region eu-west-2
   ```
   Note the certificate ARN and add it to the parameter file.

3. **Deploy stacks** (choose one approach):

   **Option A: Deploy stacks separately** (recommended for initial setup):
   ```bash
   # Deploy in order
   aws cloudformation deploy --template-file templates/vpc.yaml --stack-name isms-staging-vpc --parameter-overrides file://parameters/staging-params.json --capabilities CAPABILITY_IAM --region eu-west-2
   aws cloudformation deploy --template-file templates/secrets-manager.yaml --stack-name isms-staging-secrets --parameter-overrides file://parameters/staging-params.json --capabilities CAPABILITY_IAM --region eu-west-2
   aws cloudformation deploy --template-file templates/security-groups.yaml --stack-name isms-staging-sg --parameter-overrides Environment=staging VpcId=<vpc-id> --capabilities CAPABILITY_IAM --region eu-west-2
   # ... continue with other stacks, referencing outputs from previous stacks
   ```

   **Option B: Use main template with S3** (after uploading templates):
   ```bash
   ./scripts/deploy.sh staging [aws-profile]
   ```

4. **Configure Secrets Manager**:
   After initial deployment, update the application secrets in AWS Secrets Manager:
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id isms-staging-app-secrets \
     --secret-string '{
       "AUTH_TENANT_ID": "your-tenant-id",
       "AUTH_CLIENT_ID": "your-client-id",
       "AUTH_CLIENT_SECRET": "your-client-secret",
       "AUTH_REDIRECT_URI": "https://trust.demo.paythru.com",
       "TRUST_CENTER_JWT_SECRET": "your-jwt-secret"
     }'
   ```

5. **Set up DNS**:
   Point `trust.demo.paythru.com` to the ALB DNS name (from stack outputs).

### Manual Deployment

Deploy using the helper script:
```bash
./scripts/deploy.sh <environment> [aws-profile]
```

Or use AWS CLI directly:
```bash
aws cloudformation deploy \
  --template-file infrastructure/templates/main.yaml \
  --stack-name isms-staging \
  --parameter-overrides file://infrastructure/parameters/staging-params.json \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region eu-west-2
```

### CI/CD Deployment

Deployments are automated via GitHub Actions:
- **Staging**: Automatically deploys on push to `main` branch
- **Production**: Manual workflow dispatch (deploys to staging first, then production)

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

### Stack deployment fails
- Check CloudFormation events: `aws cloudformation describe-stack-events --stack-name isms-staging`
- Validate templates: `./scripts/validate-templates.sh`
- Check IAM permissions

### ECS tasks not starting
- Check task logs: `aws logs tail /ecs/isms-staging-backend --follow`
- Verify Secrets Manager secrets are configured
- Check security group rules

### CodeDeploy deployment fails
- Check deployment status: `aws deploy get-deployment --deployment-id <id>`
- Verify target groups are healthy
- Check ECS service events

### Database connection issues
- Verify Aurora security group allows traffic from ECS security group
- Check database credentials in Secrets Manager
- Verify DATABASE_URL format in task definition

## Maintenance

### Update application secrets
```bash
aws secretsmanager put-secret-value \
  --secret-id isms-staging-app-secrets \
  --secret-string file://secrets.json
```

### Scale Aurora manually
Update `AuroraMinCapacity` and `AuroraMaxCapacity` in parameter file and redeploy.

### Rollback deployment
Use CodeDeploy to rollback:
```bash
aws deploy create-deployment \
  --application-name isms-staging-backend-app \
  --deployment-group-name isms-staging-backend-dg \
  --revision revisionType=AppSpecContent,appSpecContent='...' \
  --deployment-config-name CodeDeployDefault.ECSAllAtOnce
```

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

