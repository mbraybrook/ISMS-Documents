---
name: AWS ECS Deployment Infrastructure
overview: Deploy the ISMS application to AWS using ECR, ECS, Aurora Serverless v2, and supporting infrastructure. Create CloudFormation templates for VPC, subnets, ALB, security groups, Secrets Manager, IAM roles, and ECS services with Blue/Green deployments. Set up GitHub Actions workflows for automated CI/CD with staging and production environments. Includes cost optimizations and detailed operational guidance.
todos: []
---

# AWS ECS Deployment Infrastructure

## Architecture Overview

The application will be deployed to AWS using:

- **ECR**: Container image registry for backend and frontend (with lifecycle policies)
- **ECS Fargate**: Container orchestration with Spot capacity providers and Graviton2 support
- **Aurora Serverless v2 PostgreSQL**: Auto-scaling database (0.5-128 ACUs)
- **Application Load Balancer**: Routes traffic to ECS services
- **AWS CodeDeploy**: Blue/Green deployments for zero-downtime updates
- **VPC**: Isolated network with public and private subnets
- **Secrets Manager**: Secure storage for sensitive configuration
- **ACM**: SSL/TLS certificates for HTTPS

### Environment Structure

- **Staging**: `trust.demo.paythru.com` (initial deployment target)
- **Production**: `trust.paythru.com` (future deployment target)
- Both environments share the same infrastructure template with parameterized values

## Operational Controls

### 1. AWS Account Selection

#### Primary: OIDC via GitHub Actions (all automated deployments)

GitHub Actions assumes an IAM role in AWS using OIDC; no long‑lived credentials. Required secrets: AWS_ROLE_ARN, AWS_REGION. All automated deployments (staging and production) use this.​

#### Fallback: AWS CLI profiles for manual runs

For rare manual CloudFormation deployments, configure an AWS CLI profile (e.g. isms-staging) and use the aws cloudformation deploy example. Do not use environment‑variable credentials.

#### Infrastructure pattern

Always one stack per environment (isms-staging, isms-production), selected via workflow environment input or CLI example.

### 2. Build Selection (Which Image Gets Deployed)

Docker images are tagged with multiple identifiers for flexible deployment:

#### Image Tagging Strategy

- **Commit SHA**: `isms-backend:<commit-sha>` (immutable, traceable)
- **Environment tag**: `isms-backend:staging` or `isms-backend:production` (latest for that environment)
- **Latest tag**: `isms-backend:latest` (moving pointer to the most recent build)
- Same pattern for frontend (`isms-frontend`).

Operational selection uses the commit SHA (via image_tag input, with SHA as default), **not latest**.**Via GitHub Actions Workflow Input**

```yaml
on:
  workflow_dispatch:
    inputs:
      image_tag:
        description: 'Docker image tag to deploy (commit SHA or version)'
        required: false
        default: ''
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options:
                    - staging
                    - production
```

**Recommended Approach**:

- GitHub Actions automatically tags images with commit SHA
- Workflow uses commit SHA as primary tag, updates `staging`/`production` tags
- For rollbacks or specific builds, update task definition with commit SHA tag

### 3. Deployment Target Selection (Where It Gets Deployed)

One stack per environment. In CI, a workflow environment input (staging / production) sets STACK_NAME and PARAMS_FILE. For manual use, run the equivalent CLI commands shown below.

#### Manual example: staging / production

```bash
# Staging deployment
aws cloudformation deploy \
  --profile isms-staging \
  --stack-name isms-staging \
  --template-file infrastructure/templates/main.yaml \
  --parameter-overrides file://infrastructure/parameters/staging-params.json \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region eu-west-2

# Production deployment
aws cloudformation deploy \
  --profile isms-production \
  --stack-name isms-production \
  --template-file infrastructure/templates/main.yaml \
  --parameter-overrides file://infrastructure/parameters/production-params.json \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region eu-west-2
```



#### CI/CD implementation of the same pattern

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options:
                    - staging
                    - production
          
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
            - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: eu-west-2
          
            - name: Deploy to ${{ inputs.environment }}
        run: |
          STACK_NAME="isms-${{ inputs.environment }}"
          PARAMS_FILE="infrastructure/parameters/${{ inputs.environment }}-params.json"
          aws cloudformation deploy \
            --stack-name $STACK_NAME \
            --template-file infrastructure/templates/main.yaml \
            --parameter-overrides file://$PARAMS_FILE \
            --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM
```

**Recommended Approach**:

- Use separate CloudFormation stacks per environment (`isms-staging`, `isms-production`)
- Store environment-specific configuration in parameter files (`staging-params.json`, `production-params.json`)
- GitHub Actions workflows select target via workflow input or branch-based logic
- ECS cluster and service names include environment identifier

## CloudFormation Template Structure

### Core Infrastructure Templates

1. **`infrastructure/templates/vpc.yaml`** - VPC, subnets, internet gateway, NAT gateway, route tables

- VPC with CIDR 10.0.0.0/16
- 2 public subnets (for ALB)
- 2 private subnets (for ECS tasks)
- NAT gateway for outbound internet access from private subnets
- Route tables and associations

2. **`infrastructure/templates/security-groups.yaml`** - Security groups for ALB, ECS, and Aurora

- ALB security group: Allow HTTPS (443) from internet
- ECS security group: Allow traffic from ALB on port 4000 (backend) and 80 (frontend)
- Aurora security group: Allow PostgreSQL (5432) from ECS security group only

3. **`infrastructure/templates/aurora.yaml`** - Aurora Serverless v2 PostgreSQL cluster

- Aurora PostgreSQL Serverless v2 cluster
- Min capacity: 0.5 ACU (configurable via parameter)
- Max capacity: 128 ACU (configurable via parameter)
- Multi-AZ deployment for high availability
- Automated backups enabled
- Parameter group for PostgreSQL 15
- Subnet group using private subnets
- Database credentials stored in Secrets Manager
- Auto-scaling based on CPU, connections, and memory

4. **`infrastructure/templates/secrets-manager.yaml`** - Secrets Manager secrets

- Database credentials (auto-generated by Aurora)
- Application secrets (JWT secrets, API keys, etc.)
- Separate secrets per environment

5. **`infrastructure/templates/iam-roles.yaml`** - IAM roles and policies

- ECS Task Execution Role (pull images from ECR, access Secrets Manager, CloudWatch Logs)
- ECS Task Role (application permissions)
- GitHub Actions OIDC role (for CI/CD deployments)
- CodeDeploy role (for Blue/Green deployments)

6. **`infrastructure/templates/ecr.yaml`** - ECR repositories with lifecycle policies

- Repository for backend image
- Repository for frontend image
- Lifecycle policies:
        - Keep last 10 images tagged with `staging` or `production`
        - Keep last 5 images tagged with commit SHA (for rollback)
        - Expire untagged images after 7 days
        - Expire images older than 30 days (except tagged)

7. **`infrastructure/templates/ecs-cluster.yaml`** - ECS cluster and services with Blue/Green deployments

- Fargate cluster with capacity providers:
        - FARGATE (on-demand)
        - FARGATE_SPOT (for cost savings on non-critical workloads)
- Capacity provider strategy:
        - 70% FARGATE_SPOT (for cost optimization)
        - 30% FARGATE (for guaranteed capacity)
- Backend service definition with:
        - DeploymentController: CODE_DEPLOY (for Blue/Green)
        - Platform: ARM64 (Graviton2) for cost savings (20% reduction)
        - Task definition with ARM64 architecture
- Frontend service definition with:
        - DeploymentController: CODE_DEPLOY (for Blue/Green)
        - Platform: ARM64 (Graviton2) for cost savings
        - Task definition with ARM64 architecture
- Service discovery (optional, for internal communication)
- Auto-scaling configuration
- CodeDeploy application and deployment groups

8. **`infrastructure/templates/codedeploy.yaml`** - CodeDeploy configuration

- CodeDeploy application for backend
- CodeDeploy application for frontend
- Deployment groups with Blue/Green configuration:
        - Staging uses canary strategy; production uses linear strategy, both configured via CloudFormation parameters and not per‑deployment.
        - Deployment configuration: CodeDeployDefault.ECSAllAtOnce (or custom)
        - Target groups for Blue/Green traffic shifting
- AppSpec files for ECS deployments

9. **`infrastructure/templates/alb.yaml`** - Application Load Balancer

- Internet-facing ALB
- Target groups for backend (Blue and Green)
- Target groups for frontend (Blue and Green)
- HTTPS listener with ACM certificate
- HTTP to HTTPS redirect
- Health checks
- Listener rules for traffic shifting during Blue/Green deployments

10. **`infrastructure/templates/main.yaml`** - Master template that orchestrates all resources

        - Transform: `AWS::CodeDeployBlueGreen` (enables Blue/Green deployments)
        - Parameters for environment configuration
        - Stack outputs (ALB DNS name, Aurora endpoint, CodeDeploy application names, etc.)

### Environment-Specific Configuration

- **`infrastructure/parameters/staging-params.json`** - Staging environment parameters
  ```json
          {
            "Environment": "staging",
            "DomainName": "trust.demo.paythru.com",
            "AwsAccountId": "956880242582",
            "BackendImageTag": "staging",
            "FrontendImageTag": "staging",
            "AuroraMinCapacity": "0.5",
            "AuroraMaxCapacity": "16",
            "MinTaskCount": "1",
            "MaxTaskCount": "4",
            "UseFargateSpot": "true",
            "SpotPercentage": "70",
            "UseGraviton2": "true",
            "DeploymentType": "canary",
            "TrafficShiftPercentage": "10"
          }
  ```




- **`infrastructure/parameters/production-params.json`** - Production environment parameters
  ```json
          {
            "Environment": "production",
            "DomainName": "trust.paythru.com",
            "AwsAccountId": "641918319442",
            "BackendImageTag": "production",
            "FrontendImageTag": "production",
            "AuroraMinCapacity": "2",
            "AuroraMaxCapacity": "128",
            "MinTaskCount": "2",
            "MaxTaskCount": "10",
            "UseFargateSpot": "true",
            "SpotPercentage": "50",
            "UseGraviton2": "true",
            "DeploymentType": "linear",
            "TrafficShiftPercentage": "25"
          }
  ```




## GitHub Actions Workflow

### Workflow Structure

1. **`.github/workflows/deploy-staging.yml`** - Staging deployment workflow

- Triggers: Push to `main` branch, manual workflow dispatch
- Steps:
        - Configure AWS credentials (OIDC)
        - Build backend Docker image (ARM64 for Graviton2)
        - Build frontend Docker image (ARM64 for Graviton2)
        - Push images to ECR with tags (commit SHA, `staging`, `latest`)
        - Create new ECS task definition with new image tags
        - Create CodeDeploy deployment
        - Monitor deployment progress
        - Run database migrations (if needed, after green environment is healthy)
        - Health check verification
        - Complete deployment (shift 100% traffic to green)

2. **`.github/workflows/deploy-production.yml`** - Production deployment workflow

- Triggers: Manual workflow dispatch only (for safety)
- Inputs:
        - `image_tag`: Specific image tag to deploy (default: latest commit SHA)
        - `skip_staging`: Skip staging deployment (default: false)
- Steps:
        - Deploy to staging first (unless skipped)
        - Wait for staging health check
        - Build backend Docker image (ARM64)
        - Build frontend Docker image (ARM64)
        - Push images to ECR with tags (commit SHA, `production`, `latest`)
        - Create new ECS task definition with new image tags
        - Create CodeDeploy deployment (Blue/Green) - create a CodeDeploy deployment for the new task definition.
        - Monitor deployment progress
        - Run database migrations (if needed)
        - Health check verification
        - Complete deployment (shift 100% traffic to green)

3. **`.github/workflows/build-and-test.yml`** - CI workflow (optional, for testing)

- Runs on pull requests
- Linting, testing, building images (without pushing)
- Multi-platform build test (AMD64 and ARM64)

### GitHub Actions Configuration

**Required GitHub Secrets**:

- `AWS_ROLE_ARN`: ARN of IAM role for GitHub Actions (format: `arn:aws:iam::ACCOUNT_ID:role/github-actions-role`)
- `AWS_REGION`: `eu-west-2`
- `ECR_REGISTRY`: ECR repository URL (e.g., `956880242582.dkr.ecr.eu-west-2.amazonaws.com`)
- `STAGING_CLUSTER_NAME`: `isms-staging`
- `PRODUCTION_CLUSTER_NAME`: `isms-production`
- `STAGING_BACKEND_SERVICE`: `isms-backend-staging`
- `STAGING_FRONTEND_SERVICE`: `isms-frontend-staging`
- `PRODUCTION_BACKEND_SERVICE`: `isms-backend-production`
- `PRODUCTION_FRONTEND_SERVICE`: `isms-frontend-production`
- `STAGING_BACKEND_CODEDEPLOY_APP`: `isms-backend-staging-app`
- `STAGING_FRONTEND_CODEDEPLOY_APP`: `isms-frontend-staging-app`
- `PRODUCTION_BACKEND_CODEDEPLOY_APP`: `isms-backend-production-app`
- `PRODUCTION_FRONTEND_CODEDEPLOY_APP`: `isms-frontend-production-app`

**Workflow Example with CodeDeploy**:Backend example, frontend similar.

```yaml
name: Deploy to Staging

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      image_tag:
        description: 'Image tag (commit SHA or version)'
        required: false
        default: ''

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
            - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ secrets.AWS_REGION }}
          
            - name: Set image tag
        id: set-tag
        run: |
          if [ -z "${{ inputs.image_tag }}" ]; then
            echo "tag=${{ github.sha }}" >> $GITHUB_OUTPUT
          else
            echo "tag=${{ inputs.image_tag }}" >> $GITHUB_OUTPUT
          fi
          
            - name: Build and push backend (ARM64)
        run: |
          docker buildx build --platform linux/arm64 \
            -t $ECR_REGISTRY/isms-backend:${{ steps.set-tag.outputs.tag }} \
            -t $ECR_REGISTRY/isms-backend:staging \
            ./backend --push
          
            - name: Register new task definition
        run: |
          # Update task definition with new image tag
          aws ecs describe-task-definition \
            --task-definition isms-backend-staging \
            --query taskDefinition > task-def.json
          # Modify image reference in task-def.json
          aws ecs register-task-definition --cli-input-json file://task-def.json
          
            - name: Create CodeDeploy deployment
        run: |
          aws deploy create-deployment \
            --application-name ${{ secrets.STAGING_BACKEND_CODEDEPLOY_APP }} \
            --deployment-group-name isms-backend-staging-dg \
            --revision revisionType=AppSpecContent,appSpecContent='{
              "version": 0.0,
              "Resources": [{
                "TargetService": {
                  "Type": "AWS::ECS::Service",
                  "Properties": {
                    "TaskDefinition": "isms-backend-staging:<NEW_REVISION>",
                    "LoadBalancerInfo": {
                      "ContainerName": "backend",
                      "ContainerPort": 4000
                    }
                  }
                }
              }],
              "Hooks": []
            }'
```



## Cost Optimizations

### 1. ECR Lifecycle Policies

- **Keep last 10 images** tagged with environment (`staging`, `production`)
- **Keep last 5 images** tagged with commit SHA (for rollback capability)
- **Expire untagged images** after 7 days
- **Expire images older than 30 days** (except those with retention tags)
- Estimated savings: Reduces storage costs by ~60-80%

### 2. Fargate Spot Capacity Provider

- **70% Spot capacity** for staging (non-critical workloads)
- **50% Spot capacity** for production (balanced approach)
- **30-50% cost savings** compared to on-demand Fargate
- Automatic fallback to on-demand if Spot capacity unavailable
- Configured via `capacityProviderStrategy` in ECS service

### 3. Graviton2 (ARM64) Support

- **20% cost savings** compared to x86_64 instances
- Requires ARM64 Docker images (built with `--platform linux/arm64`)
- Compatible with Node.js 18+ (official ARM64 images available)
- Configured in ECS task definition: `runtimePlatform: { cpuArchitecture: ARM64 }`

### 4. Aurora Serverless v2 Auto-Scaling

- **Scales from 0.5 ACU to 128 ACU** based on demand
- **Pay only for what you use** (per-second billing)
- **No cold starts** (unlike Serverless v1)
- **Automatic scaling** based on CPU, connections, and memory
- Estimated savings: 40-60% compared to provisioned RDS for variable workloads

## Cursor Rules Configuration

### `.cursorrules` Updates

Add CloudFormation-specific rules:

- Maintain consistent naming conventions (PascalCase for resources, kebab-case for parameters)
- Use parameters and mappings instead of hardcoded values
- Include descriptions for all parameters and resources
- Use CloudFormation intrinsic functions (Ref, GetAtt, Sub, etc.)
- Validate template syntax before committing
- Document all outputs and their purposes
- Use conditions for environment-specific resources
- Follow AWS best practices for security groups and IAM policies
- Always specify AWS account ID in parameter files for validation
- Use stack names that include environment identifier
- Document image tagging strategy in task definitions
- Use Aurora Serverless v2 for database (not RDS)
- Configure CodeDeploy for Blue/Green deployments
- Enable Fargate Spot capacity providers for cost optimization
- Build ARM64 images for Graviton2 support
- Configure ECR lifecycle policies to manage image retention

## Implementation Details

### Environment Variables Management

- **Secrets Manager**: Store sensitive values (database passwords, JWT secrets, API keys)
- **ECS Task Definition**: Reference secrets from Secrets Manager using `secrets` parameter
- **Frontend Build Args**: Passed at build time via GitHub Actions (VITE_API_URL, etc.)

### Database Migrations

- Run migrations as part of deployment workflow
- Use Prisma migration commands: `npm run db:migrate:deploy`
- Execute migrations from a temporary ECS task (green environment) before traffic shift
- Consider using ECS Exec for manual migration runs if needed
- Migrations run on Aurora Serverless v2 (scales automatically during migration)

### Health Checks

- Backend: `/api/health` endpoint
- Frontend: `/health` endpoint (configured in nginx)
- ALB health checks configured for both target groups (Blue and Green)
- ECS service health checks aligned with ALB
- CodeDeploy uses ALB health checks to determine when to shift traffic

### Networking

- Frontend and backend run as separate ECS services
- ALB routes `/api/*` to backend service
- ALB routes all other traffic to frontend service
- Both services in private subnets (no direct internet access)
- NAT gateway enables outbound connections (for external API calls, etc.)
- Blue/Green deployments use separate target groups for traffic shifting

### Scaling

- **ECS Auto Scaling**: Based on CPU/memory utilization
- Target tracking: 70% CPU utilization
- Min/Max task counts configurable per environment
- Uses Fargate Spot capacity provider strategy
- **Aurora Serverless v2 Auto-Scaling**: 
- Scales automatically based on CPU, connections, and memory
- Min/Max ACU configurable per environment
- Scales within seconds (no cold starts)

### Blue/Green Deployment Flow

1. **Create Green Environment**: New ECS tasks with updated task definition
2. **Health Check**: Verify green environment is healthy
3. **Monitor**: Watch metrics and logs during traffic shift 

- Traffic shift behaviour (canary vs linear and percentages) is defined per environment via CloudFormation parameters (e.g. staging 10→50→100, production 25→50→75→100).

4. **Complete**: Shift 100% traffic to Green, terminate Blue tasks
5. **Rollback**: If issues detected, shift traffic back to Blue

## File Structure

```javascript
infrastructure/
├── templates/
│   ├── vpc.yaml
│   ├── security-groups.yaml
│   ├── aurora.yaml (Aurora Serverless v2)
│   ├── secrets-manager.yaml
│   ├── iam-roles.yaml
│   ├── ecr.yaml (with lifecycle policies)
│   ├── ecs-cluster.yaml (with CodeDeploy and Spot)
│   ├── codedeploy.yaml (Blue/Green configuration)
│   ├── alb.yaml (with Blue/Green target groups)
│   └── main.yaml (with CodeDeployBlueGreen transform)
├── parameters/
│   ├── staging-params.json
│   └── production-params.json
├── appspecs/
│   ├── backend-appspec.yaml
│   └── frontend-appspec.yaml
├── scripts/
│   ├── deploy.sh (deployment helper script with account/profile selection)
│   ├── validate-templates.sh (CloudFormation validation)
│   ├── update-service.sh (ECS service update helper)
│   └── create-codedeploy-deployment.sh (CodeDeploy deployment helper)
└── README.md (infrastructure documentation)

.github/
└── workflows/
    ├── deploy-staging.yml
    ├── deploy-production.yml
    └── build-and-test.yml
```



## Deployment Flow

1. **Initial Setup** (one-time):

- Deploy CloudFormation stack for staging environment
     ```bash
                         aws cloudformation deploy \
                           --stack-name isms-staging \
                           --template-file infrastructure/templates/main.yaml \
                           --parameter-overrides file://infrastructure/parameters/staging-params.json \
                           --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
                           --profile isms-staging \
                           --region eu-west-2
     ```




- Configure ACM certificate for `trust.demo.paythru.com`
- Set up DNS records pointing to ALB
- Store initial secrets in Secrets Manager
- Aurora Serverless v2 cluster will scale from 0.5 ACU as needed

2. **Staging Deployment** (automatic on push to main):

- Build Docker images (ARM64) with commit SHA tag
- Push to ECR with tags: `{commit-sha}`, `staging`, `latest`
- Register new ECS task definition with new image tag
- Create CodeDeploy Blue/Green deployment
- Monitor traffic shift (canary: 10% → 50% → 100%)
- Verify health checks
- Complete deployment (100% traffic to green)

3. **Production Deployment** (manual trigger):

- Optionally deploy to staging first (for validation)
- Build Docker images (ARM64) with commit SHA tag
- Push to ECR with tags: `{commit-sha}`, `production`, `latest`
- Register new ECS task definition with new image tag
- Create CodeDeploy Blue/Green deployment
- Monitor traffic shift (linear: 25% → 50% → 75% → 100%)
- Verify health checks
- Complete deployment (100% traffic to green)

## Security Considerations

- All secrets stored in AWS Secrets Manager (not in code or environment variables)
- ECS tasks run in private subnets (no direct internet access)
- Security groups follow least-privilege principle
- IAM roles use least-privilege policies
- HTTPS enforced via ALB (HTTP redirects to HTTPS)
- Database credentials auto-rotated by Aurora Secrets Manager integration
- OIDC for GitHub Actions (no long-lived credentials)
- Account ID validation in CloudFormation parameters
- Blue/Green deployments allow instant rollback if security issues detected

## Cost Estimation

### Staging Environment (Estimated Monthly)

- **Aurora Serverless v2**: ~£15-30/month (0.5-16 ACU, variable load)
- **ECS Fargate Spot**: ~£20-40/month (70% Spot, 1-4 tasks)
- **ALB**: ~£20/month
- **NAT Gateway**: ~£35/month
- **ECR Storage**: ~£2/month (with lifecycle policies)
- **Data Transfer**: ~£5/month
- **Total**: ~£97-132/month

### Production Environment (Estimated Monthly)

- **Aurora Serverless v2**: ~£60-200/month (2-128 ACU, variable load)
- **ECS Fargate Spot**: ~£80-200/month (50% Spot, 2-10 tasks)
- **ALB**: ~£20/month
- **NAT Gateway**: ~£35/month
- **ECR Storage**: ~£5/month (with lifecycle policies)
- **Data Transfer**: ~£20/month
- **Total**: ~£220-480/month

**Cost Savings**: