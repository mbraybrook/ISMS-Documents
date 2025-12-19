# Deployment Guide

## Overview

This guide provides complete instructions for deploying the ISMS application to AWS ECS. The deployment process includes:

- **Automatic database migrations**: Migrations run automatically when backend containers start
- **Blue/Green deployments**: Zero-downtime deployments via CodeDeploy
- **Infrastructure as Code**: All infrastructure defined in CloudFormation templates

## Prerequisites

- AWS CLI configured with appropriate credentials
- Docker installed and configured for multi-platform builds (ARM64)
- `jq` installed for JSON parsing
- Domain name configured (e.g., `trust.demo.paythru.com`)

## Important Notes

### Database Migrations

Database migrations run **automatically** when backend containers start. The `backend/scripts/start.sh` script:
1. Validates prerequisites (DATABASE_URL, Prisma CLI)
2. Runs `npx prisma migrate deploy` (idempotent - only applies pending migrations)
3. Optionally seeds data if `SEED_SCOPE` is set
4. Starts the application

Migration failures are fatal - the container will exit and prevent the application from starting with an inconsistent schema.

### Frontend API URL Configuration

**IMPORTANT**: `VITE_API_URL` should **NOT** include `/api` since the frontend code already adds it to API paths.

- ✅ Correct: `VITE_API_URL=https://trust.demo.paythru.com`
- ❌ Wrong: `VITE_API_URL=https://trust.demo.paythru.com/api`

### Frontend Build-Time Variables

**CRITICAL**: Frontend environment variables (`VITE_AUTH_TENANT_ID`, `VITE_AUTH_CLIENT_ID`, `VITE_AUTH_REDIRECT_URI`) are **baked into the JavaScript bundle at build time**. They cannot be changed at runtime.

- These values must be provided as Docker build arguments when building the frontend image
- If you see placeholder values like `your-tenant-id` in production, the image was built with placeholder values
- To fix: Rebuild the frontend image with correct values from Secrets Manager using `./scripts/deploy-utils.sh rebuild-frontend`

**Rebuilding Frontend Image with Correct Auth Values:**

```bash
cd /home/developer/dev/ISMS-Documentation/infrastructure
export AWS_PROFILE=pt-sandbox
./scripts/deploy-utils.sh rebuild-frontend
./deploy-frontend.sh
```

The `rebuild-frontend` command:
1. Retrieves `AUTH_TENANT_ID`, `AUTH_CLIENT_ID`, and `AUTH_REDIRECT_URI` from Secrets Manager
2. Rebuilds the frontend image with these values
3. Pushes the image to ECR

For more deployment utilities, see `./scripts/deploy-utils.sh --help`

### Prisma Binary Targets

The Prisma schema must include the correct binary targets for ARM64 Alpine Linux:
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-arm64-openssl-3.0.x"]
}
```

The production Dockerfile must include OpenSSL libraries for Prisma to work correctly.

## Quick Start

### Step 1: Prepare Templates

Templates can be deployed in two ways:

#### Option A: Separate Stack Deployment (Recommended for First-Time Setup)

Deploy each stack separately, passing outputs as parameters:

```bash
# 1. VPC
aws cloudformation deploy \
  --template-file templates/vpc.yaml \
  --stack-name isms-staging-vpc \
  --parameter-overrides Environment=staging \
  --region eu-west-2 \
  --profile pt-sandbox

# Get VPC ID
VPC_ID=$(aws cloudformation describe-stacks --stack-name isms-staging-vpc --query 'Stacks[0].Outputs[?OutputKey==`VpcId`].OutputValue' --output text --profile pt-sandbox)

# 2. Secrets Manager
aws cloudformation deploy \
  --template-file templates/secrets-manager.yaml \
  --stack-name isms-staging-secrets \
  --parameter-overrides Environment=staging \
  --region eu-west-2 \
  --profile pt-sandbox

# Get secret ARNs
DB_SECRET_ARN=$(aws cloudformation describe-stacks --stack-name isms-staging-secrets --query 'Stacks[0].Outputs[?OutputKey==`DatabaseCredentialsSecretArn`].OutputValue' --output text --profile pt-sandbox)
APP_SECRET_ARN=$(aws cloudformation describe-stacks --stack-name isms-staging-secrets --query 'Stacks[0].Outputs[?OutputKey==`ApplicationSecretsArn`].OutputValue' --output text --profile pt-sandbox)

# 3. Security Groups
aws cloudformation deploy \
  --template-file templates/security-groups.yaml \
  --stack-name isms-staging-sg \
  --parameter-overrides Environment=staging VpcId=$VPC_ID \
  --region eu-west-2 \
  --profile pt-sandbox

# Get security group IDs
ALB_SG_ID=$(aws cloudformation describe-stacks --stack-name isms-staging-sg --query 'Stacks[0].Outputs[?OutputKey==`ALBSecurityGroupId`].OutputValue' --output text --profile pt-sandbox)
ECS_SG_ID=$(aws cloudformation describe-stacks --stack-name isms-staging-sg --query 'Stacks[0].Outputs[?OutputKey==`ECSSecurityGroupId`].OutputValue' --output text --profile pt-sandbox)
AURORA_SG_ID=$(aws cloudformation describe-stacks --stack-name isms-staging-sg --query 'Stacks[0].Outputs[?OutputKey==`AuroraSecurityGroupId`].OutputValue' --output text --profile pt-sandbox)

# 4. Get subnet IDs
PUB_SUBNET_1=$(aws cloudformation describe-stacks --stack-name isms-staging-vpc --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnet1Id`].OutputValue' --output text --profile pt-sandbox)
PUB_SUBNET_2=$(aws cloudformation describe-stacks --stack-name isms-staging-vpc --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnet2Id`].OutputValue' --output text --profile pt-sandbox)
PRIV_SUBNET_1=$(aws cloudformation describe-stacks --stack-name isms-staging-vpc --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnet1Id`].OutputValue' --output text --profile pt-sandbox)
PRIV_SUBNET_2=$(aws cloudformation describe-stacks --stack-name isms-staging-vpc --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnet2Id`].OutputValue' --output text --profile pt-sandbox)

# 5. Aurora
aws cloudformation deploy \
  --template-file templates/aurora.yaml \
  --stack-name isms-staging-aurora \
  --parameter-overrides \
    Environment=staging \
    VpcId=$VPC_ID \
    PrivateSubnet1Id=$PRIV_SUBNET_1 \
    PrivateSubnet2Id=$PRIV_SUBNET_2 \
    AuroraSecurityGroupId=$AURORA_SG_ID \
    AuroraMinCapacity=0.5 \
    AuroraMaxCapacity=16 \
  --capabilities CAPABILITY_IAM \
  --region eu-west-2 \
  --profile pt-sandbox

# Wait for Aurora stack to complete, then verify:
# - The cluster uses port 5432 (PostgreSQL default)
# - The DATABASE_URL secret is automatically updated by the Lambda function
aws rds describe-db-clusters \
  --db-cluster-identifier isms-staging-cluster \
  --profile pt-sandbox \
  --region eu-west-2 \
  --query 'DBClusters[0].{Engine:Engine,Port:Port,Status:Status,Endpoint:Endpoint}' \
  --output json | jq '.'

# Verify DATABASE_URL in Secrets Manager (should include port 5432)
aws secretsmanager get-secret-value \
  --secret-id isms-staging-db-credentials \
  --query 'SecretString' \
  --output text \
  --profile pt-sandbox \
  --region eu-west-2 | jq -r '.DATABASE_URL'

# 6. IAM Roles
aws cloudformation deploy \
  --template-file templates/iam-roles.yaml \
  --stack-name isms-staging-iam \
  --parameter-overrides Environment=staging \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region eu-west-2 \
  --profile pt-sandbox

# Get role ARNs
TASK_EXEC_ROLE=$(aws cloudformation describe-stacks --stack-name isms-staging-iam --query 'Stacks[0].Outputs[?OutputKey==`ECSTaskExecutionRoleArn`].OutputValue' --output text --profile pt-sandbox)
TASK_ROLE=$(aws cloudformation describe-stacks --stack-name isms-staging-iam --query 'Stacks[0].Outputs[?OutputKey==`ECSTaskRoleArn`].OutputValue' --output text --profile pt-sandbox)
CODEDEPLOY_ROLE=$(aws cloudformation describe-stacks --stack-name isms-staging-iam --query 'Stacks[0].Outputs[?OutputKey==`CodeDeployRoleArn`].OutputValue' --output text --profile pt-sandbox)

# 7. ECR
aws cloudformation deploy \
  --template-file templates/ecr.yaml \
  --stack-name isms-staging-ecr \
  --parameter-overrides Environment=staging \
  --region eu-west-2 \
  --profile pt-sandbox

# Get repository URIs
BACKEND_REPO=$(aws cloudformation describe-stacks --stack-name isms-staging-ecr --query 'Stacks[0].Outputs[?OutputKey==`BackendRepositoryUri`].OutputValue' --output text --profile pt-sandbox)
FRONTEND_REPO=$(aws cloudformation describe-stacks --stack-name isms-staging-ecr --query 'Stacks[0].Outputs[?OutputKey==`FrontendRepositoryUri`].OutputValue' --output text --profile pt-sandbox)

# 8. ALB
# Note: If CertificateArn is not provided, an HTTP listener will forward traffic
# You can add CertificateArn parameter later to enable HTTPS
aws cloudformation deploy \
  --template-file templates/alb.yaml \
  --stack-name isms-staging-alb \
  --parameter-overrides \
    Environment=staging \
    VpcId=$VPC_ID \
    PublicSubnet1Id=$PUB_SUBNET_1 \
    PublicSubnet2Id=$PUB_SUBNET_2 \
    ALBSecurityGroupId=$ALB_SG_ID \
    DomainName=trust.demo.paythru.com \
    CertificateArn="" \
  --region eu-west-2 \
  --profile pt-sandbox

# Get target group ARNs
BACKEND_TG_BLUE=$(aws cloudformation describe-stacks --stack-name isms-staging-alb --query 'Stacks[0].Outputs[?OutputKey==`BackendTargetGroupBlueArn`].OutputValue' --output text --profile pt-sandbox)
BACKEND_TG_GREEN=$(aws cloudformation describe-stacks --stack-name isms-staging-alb --query 'Stacks[0].Outputs[?OutputKey==`BackendTargetGroupGreenArn`].OutputValue' --output text --profile pt-sandbox)
FRONTEND_TG_BLUE=$(aws cloudformation describe-stacks --stack-name isms-staging-alb --query 'Stacks[0].Outputs[?OutputKey==`FrontendTargetGroupBlueArn`].OutputValue' --output text --profile pt-sandbox)
FRONTEND_TG_GREEN=$(aws cloudformation describe-stacks --stack-name isms-staging-alb --query 'Stacks[0].Outputs[?OutputKey==`FrontendTargetGroupGreenArn`].OutputValue' --output text --profile pt-sandbox)

# 8.5. Push Docker Images (REQUIRED before ECS deployment)
# ECS services will fail to start if images don't exist in ECR
# 
# IMPORTANT: 
# - Backend Dockerfile.prod includes automatic database migration on startup
# - Migrations run automatically when containers start via backend/scripts/start.sh
# - Backend image must include OpenSSL libraries for Prisma to work
# - Prisma schema must specify correct binary targets (linux-musl-arm64-openssl-3.0.x)
#
# Get repository URIs (if not already set)
BACKEND_REPO=$(aws cloudformation describe-stacks --stack-name isms-staging-ecr --query 'Stacks[0].Outputs[?OutputKey==`BackendRepositoryUri`].OutputValue' --output text --profile pt-sandbox)
FRONTEND_REPO=$(aws cloudformation describe-stacks --stack-name isms-staging-ecr --query 'Stacks[0].Outputs[?OutputKey==`FrontendRepositoryUri`].OutputValue' --output text --profile pt-sandbox)

# Login to ECR
aws ecr get-login-password --region eu-west-2 --profile pt-sandbox | docker login --username AWS --password-stdin $BACKEND_REPO

# Build and push backend image
# Uses Dockerfile.prod which includes:
# - Prisma CLI for migrations
# - Migration files
# - Startup script (start.sh) that runs migrations automatically
# - OpenSSL libraries for Prisma
docker buildx build --platform linux/arm64 \
  -f ./backend/Dockerfile.prod \
  -t $BACKEND_REPO:staging \
  ./backend \
  --push

# Build and push frontend image
# IMPORTANT: Use Dockerfile.prod, not Dockerfile
# NOTE: VITE_API_URL should NOT include /api since frontend code already adds it to paths
docker buildx build --platform linux/arm64 \
  -f ./frontend/Dockerfile.prod \
  --build-arg VITE_API_URL=https://trust.demo.paythru.com \
  --build-arg VITE_AUTH_TENANT_ID=your-tenant-id \
  --build-arg VITE_AUTH_CLIENT_ID=your-client-id \
  --build-arg VITE_AUTH_REDIRECT_URI=https://trust.demo.paythru.com \
  -t $FRONTEND_REPO:staging \
  ./frontend \
  --push

# 8.6. Verify ECS Service-Linked Role exists
# Check if the ECS service-linked role exists (required for cluster creation):
if ! aws iam get-role --role-name AWSServiceRoleForECS --profile pt-sandbox &>/dev/null; then
  echo "Creating ECS service-linked role..."
  aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com --profile pt-sandbox
else
  echo "ECS service-linked role already exists, continuing..."
fi

# 9. ECS Cluster
aws cloudformation deploy \
  --template-file templates/ecs-cluster.yaml \
  --stack-name isms-staging-ecs \
  --parameter-overrides \
    Environment=staging \
    VpcId=$VPC_ID \
    PrivateSubnet1Id=$PRIV_SUBNET_1 \
    PrivateSubnet2Id=$PRIV_SUBNET_2 \
    ECSSecurityGroupId=$ECS_SG_ID \
    ECSTaskExecutionRoleArn=$TASK_EXEC_ROLE \
    ECSTaskRoleArn=$TASK_ROLE \
    BackendRepositoryUri=$BACKEND_REPO \
    FrontendRepositoryUri=$FRONTEND_REPO \
    BackendImageTag=staging \
    FrontendImageTag=staging \
    BackendTargetGroupBlueArn=$BACKEND_TG_BLUE \
    FrontendTargetGroupBlueArn=$FRONTEND_TG_BLUE \
    DatabaseCredentialsSecretArn=$DB_SECRET_ARN \
    ApplicationSecretsArn=$APP_SECRET_ARN \
    MinTaskCount=1 \
    MaxTaskCount=4 \
    UseFargateSpot=true \
    SpotPercentage=70 \
    OnDemandPercentage=30 \
    UseGraviton2=true \
  --capabilities CAPABILITY_IAM \
  --region eu-west-2 \
  --profile pt-sandbox

# Get cluster and service names
CLUSTER_NAME=$(aws cloudformation describe-stacks --stack-name isms-staging-ecs --query 'Stacks[0].Outputs[?OutputKey==`ClusterName`].OutputValue' --output text --profile pt-sandbox)
BACKEND_SERVICE=$(aws cloudformation describe-stacks --stack-name isms-staging-ecs --query 'Stacks[0].Outputs[?OutputKey==`BackendServiceName`].OutputValue' --output text --profile pt-sandbox)
FRONTEND_SERVICE=$(aws cloudformation describe-stacks --stack-name isms-staging-ecs --query 'Stacks[0].Outputs[?OutputKey==`FrontendServiceName`].OutputValue' --output text --profile pt-sandbox)

# 10. CodeDeploy
# Get listener ARN from ALB stack
LISTENER_ARN=$(aws cloudformation describe-stacks --stack-name isms-staging-alb --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerListenerArn`].OutputValue' --output text --profile pt-sandbox)

aws cloudformation deploy \
  --template-file templates/codedeploy.yaml \
  --stack-name isms-staging-codedeploy \
  --parameter-overrides \
    Environment=staging \
    ClusterName=$CLUSTER_NAME \
    BackendServiceName=$BACKEND_SERVICE \
    FrontendServiceName=$FRONTEND_SERVICE \
    BackendTargetGroupBlueArn=$BACKEND_TG_BLUE \
    BackendTargetGroupGreenArn=$BACKEND_TG_GREEN \
    FrontendTargetGroupBlueArn=$FRONTEND_TG_BLUE \
    FrontendTargetGroupGreenArn=$FRONTEND_TG_GREEN \
    LoadBalancerListenerArn=$LISTENER_ARN \
    CodeDeployRoleArn=$CODEDEPLOY_ROLE \
    DeploymentType=canary \
    TrafficShiftPercentage=10 \
  --capabilities CAPABILITY_IAM \
  --region eu-west-2 \
  --profile pt-sandbox
```

#### Option B: Nested Stacks with S3

1. Upload templates to S3:
```bash
BUCKET_NAME="isms-cloudformation-templates-$(aws sts get-caller-identity --query Account --output text --profile pt-sandbox)"
aws s3 mb s3://$BUCKET_NAME --region eu-west-2 --profile pt-sandbox
aws s3 sync templates/ s3://$BUCKET_NAME/templates/ --region eu-west-2 --profile pt-sandbox
```

2. Update `main.yaml` TemplateURL to use S3 URLs:
```yaml
TemplateURL: https://s3.eu-west-2.amazonaws.com/$BUCKET_NAME/templates/vpc.yaml
```

3. Deploy main stack:
```bash
aws cloudformation deploy \
  --template-file templates/main.yaml \
  --stack-name isms-staging \
  --parameter-overrides file://parameters/staging-params.json \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region eu-west-2 \
  --profile pt-sandbox
```

### Step 2: Configure Secrets

After deployment, update Secrets Manager with application secrets:

```bash
aws secretsmanager put-secret-value \
  --secret-id isms-staging-app-secrets \
  --secret-string '{
    "AUTH_TENANT_ID": "your-tenant-id",
    "AUTH_CLIENT_ID": "your-client-id",
    "AUTH_CLIENT_SECRET": "your-client-secret",
    "AUTH_REDIRECT_URI": "https://trust.demo.paythru.com",
    "TRUST_CENTER_JWT_SECRET": "your-jwt-secret"
  }' \
  --region eu-west-2 \
  --profile pt-sandbox
```

### Step 3: Configure DNS

Point your domain to the ALB DNS name:

```bash
ALB_DNS=$(aws cloudformation describe-stacks --stack-name isms-staging-alb --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNSName`].OutputValue' --output text --profile pt-sandbox)
echo "Point trust.demo.paythru.com to: $ALB_DNS"
```

### Step 4: Monitor Initial Deployment

After deploying the ECS cluster, monitor the deployment:

```bash
# Get cluster and service names
CLUSTER_NAME=$(aws cloudformation describe-stacks --stack-name isms-staging-ecs --query 'Stacks[0].Outputs[?OutputKey==`ClusterName`].OutputValue' --output text --profile pt-sandbox)
BACKEND_SERVICE=$(aws cloudformation describe-stacks --stack-name isms-staging-ecs --query 'Stacks[0].Outputs[?OutputKey==`BackendServiceName`].OutputValue' --output text --profile pt-sandbox)
FRONTEND_SERVICE=$(aws cloudformation describe-stacks --stack-name isms-staging-ecs --query 'Stacks[0].Outputs[?OutputKey==`FrontendServiceName`].OutputValue' --output text --profile pt-sandbox)

# Check service status
aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services $BACKEND_SERVICE $FRONTEND_SERVICE \
  --profile pt-sandbox \
  --region eu-west-2 \
  --query 'services[*].{Name:serviceName,Status:status,Running:runningCount,Desired:desiredCount,Deployments:deployments[*].{Status:status,Running:runningCount}}' \
  --output json | jq '.'

# Monitor backend logs for migration execution
aws logs tail /ecs/isms-staging-backend --follow --profile pt-sandbox --region eu-west-2

# Check target group health
BACKEND_TG_BLUE=$(aws cloudformation describe-stacks --stack-name isms-staging-alb --query 'Stacks[0].Outputs[?OutputKey==`BackendTargetGroupBlueArn`].OutputValue' --output text --profile pt-sandbox)
FRONTEND_TG_BLUE=$(aws cloudformation describe-stacks --stack-name isms-staging-alb --query 'Stacks[0].Outputs[?OutputKey==`FrontendTargetGroupBlueArn`].OutputValue' --output text --profile pt-sandbox)

aws elbv2 describe-target-health --target-group-arn $BACKEND_TG_BLUE --profile pt-sandbox --region eu-west-2 | jq '.TargetHealthDescriptions[] | {Target: .Target.Id, State: .TargetHealth.State, Reason: .TargetHealth.Reason}'
aws elbv2 describe-target-health --target-group-arn $FRONTEND_TG_BLUE --profile pt-sandbox --region eu-west-2 | jq '.TargetHealthDescriptions[] | {Target: .Target.Id, State: .TargetHealth.State, Reason: .TargetHealth.Reason}'
```

Look for log entries indicating successful migration:
- `[timestamp] Starting backend container...`
- `[timestamp] Running database migrations...`
- `[timestamp] Database migrations completed successfully`
- `[timestamp] Starting application...`

## Deployment Utilities

A comprehensive utility script is available for common deployment and troubleshooting tasks:

```bash
cd /home/developer/dev/ISMS-Documentation/infrastructure
./scripts/deploy-utils.sh --help
```

**Common Commands:**

- **Rebuild frontend with secrets**: `./scripts/deploy-utils.sh rebuild-frontend`
- **Build and push images**: `./scripts/deploy-utils.sh build-frontend` or `build-backend`
- **Deploy services**: `./scripts/deploy-utils.sh deploy-frontend` or `deploy-backend`
- **Check health**: `./scripts/deploy-utils.sh check-health --service frontend`
- **View logs**: `./scripts/deploy-utils.sh view-logs --service backend`
- **Monitor deployment**: `./scripts/deploy-utils.sh monitor-deployment --deployment-id <id>`

The utility script supports all common options (environment, profile, region, image-tag) and provides helpful output with error handling.

## Updating Deployments

### Using CodeDeploy (Recommended)

CodeDeploy provides blue/green deployments with zero downtime. The easiest way is to use the deployment scripts:

#### Quick Deploy Scripts

**Deploy Frontend:**
```bash
cd /home/developer/dev/ISMS-Documentation/infrastructure
export AWS_PROFILE=pt-sandbox
./deploy-frontend.sh
```

**Deploy Backend:**
```bash
cd /home/developer/dev/ISMS-Documentation/infrastructure
export AWS_PROFILE=pt-sandbox
./deploy-backend.sh  # (create this script similarly)
```

#### Manual Deployment Steps

If you prefer to deploy manually, here's the process:

**1. Build and Push New Image**

```bash
# Get repository URI
FRONTEND_REPO=$(aws cloudformation describe-stacks --stack-name isms-staging-ecr --query 'Stacks[0].Outputs[?OutputKey==`FrontendRepositoryUri`].OutputValue' --output text --profile pt-sandbox)

# Login to ECR
aws ecr get-login-password --region eu-west-2 --profile pt-sandbox | docker login --username AWS --password-stdin $FRONTEND_REPO

# Build and push (with corrected API URL - NO /api)
docker buildx build --platform linux/arm64 \
  -f ./frontend/Dockerfile.prod \
  --build-arg VITE_API_URL=https://trust.demo.paythru.com \
  --build-arg VITE_AUTH_TENANT_ID=your-tenant-id \
  --build-arg VITE_AUTH_CLIENT_ID=your-client-id \
  --build-arg VITE_AUTH_REDIRECT_URI=https://trust.demo.paythru.com \
  -t $FRONTEND_REPO:staging ./frontend --push
```

**2. Create New Task Definition Revision**

```bash
# Get cluster and service names
CLUSTER_NAME=$(aws cloudformation describe-stacks --stack-name isms-staging-ecs --query 'Stacks[0].Outputs[?OutputKey==`ClusterName`].OutputValue' --output text --profile pt-sandbox)
FRONTEND_SERVICE=$(aws cloudformation describe-stacks --stack-name isms-staging-ecs --query 'Stacks[0].Outputs[?OutputKey==`FrontendServiceName`].OutputValue' --output text --profile pt-sandbox)

# Get current task definition
CURRENT_TASK_DEF=$(aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services $FRONTEND_SERVICE \
  --query 'services[0].taskDefinition' \
  --output text \
  --profile pt-sandbox \
  --region eu-west-2)

# Get new image URI
NEW_IMAGE="${FRONTEND_REPO}:staging"

# Get task definition JSON and update image
TASK_DEF_JSON=$(aws ecs describe-task-definition \
  --task-definition $CURRENT_TASK_DEF \
  --query 'taskDefinition' \
  --profile pt-sandbox \
  --region eu-west-2)

# Register new revision
NEW_TASK_DEF_ARN=$(echo "$TASK_DEF_JSON" | jq --arg IMAGE "$NEW_IMAGE" '
  .containerDefinitions[0].image = $IMAGE |
  del(.taskDefinitionArn) |
  del(.revision) |
  del(.status) |
  del(.requiresAttributes) |
  del(.compatibilities) |
  del(.registeredAt) |
  del(.registeredBy)
' | aws ecs register-task-definition \
  --cli-input-json file:///dev/stdin \
  --profile pt-sandbox \
  --region eu-west-2 \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)
```

**3. Create CodeDeploy Deployment**

```bash
APP_NAME="isms-staging-frontend-app"
DG_NAME="isms-staging-frontend-dg"

# Create AppSpec (ContainerName and ContainerPort go here, not in CloudFormation)
APPSPEC=$(cat <<EOF
{
  "version": 0.0,
  "Resources": [{
    "TargetService": {
      "Type": "AWS::ECS::Service",
      "Properties": {
        "TaskDefinition": "${NEW_TASK_DEF_ARN}",
        "LoadBalancerInfo": {
          "ContainerName": "frontend",
          "ContainerPort": 80
        }
      }
    }
  }]
}
EOF
)

# Create deployment
DEPLOYMENT_ID=$(aws deploy create-deployment \
  --application-name "$APP_NAME" \
  --deployment-group-name "$DG_NAME" \
  --revision "revisionType=AppSpecContent,appSpecContent='${APPSPEC}'" \
  --region eu-west-2 \
  --profile pt-sandbox \
  --query 'deploymentId' \
  --output text)

# Monitor deployment
aws deploy get-deployment \
  --deployment-id $DEPLOYMENT_ID \
  --profile pt-sandbox \
  --region eu-west-2 \
  --query '{Status:deploymentInfo.status,CreateTime:deploymentInfo.createTime,CompleteTime:deploymentInfo.completeTime}'
```

**For Backend Deployment**, use the same process but with:
- `APP_NAME="isms-staging-backend-app"`
- `DG_NAME="isms-staging-backend-dg"`
- `ContainerName: "backend"`
- `ContainerPort: 4000`

### Force New Deployment (Alternative)

If CodeDeploy is not configured, you can force a new deployment:

```bash
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $BACKEND_SERVICE \
  --force-new-deployment \
  --profile pt-sandbox \
  --region eu-west-2
```

## Enabling HTTPS

The ALB is initially configured with HTTP only. To enable HTTPS:

### Step 1: Request or Import ACM Certificate

```bash
# Request a new certificate
CERT_ARN=$(aws acm request-certificate \
  --domain-name trust.demo.paythru.com \
  --validation-method DNS \
  --region eu-west-2 \
  --profile pt-sandbox \
  --query 'CertificateArn' \
  --output text)

# Get DNS validation records
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region eu-west-2 \
  --profile pt-sandbox \
  --query 'Certificate.DomainValidationOptions[*].ResourceRecord' \
  --output json | jq '.'
```

Add the DNS validation CNAME records to your domain provider, then wait for validation.

### Step 2: Update ALB Stack

```bash
# Get required parameters
VPC_ID=$(aws cloudformation describe-stacks --stack-name isms-staging-vpc --profile pt-sandbox --region eu-west-2 --query 'Stacks[0].Outputs[?OutputKey==`VpcId`].OutputValue' --output text)
PUB_SUBNET_1=$(aws cloudformation describe-stacks --stack-name isms-staging-vpc --profile pt-sandbox --region eu-west-2 --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnet1Id`].OutputValue' --output text)
PUB_SUBNET_2=$(aws cloudformation describe-stacks --stack-name isms-staging-vpc --profile pt-sandbox --region eu-west-2 --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnet2Id`].OutputValue' --output text)
ALB_SG_ID=$(aws cloudformation describe-stacks --stack-name isms-staging-sg --profile pt-sandbox --region eu-west-2 --query 'Stacks[0].Outputs[?OutputKey==`ALBSecurityGroupId`].OutputValue' --output text)

# Update ALB with certificate
aws cloudformation deploy \
  --template-file templates/alb.yaml \
  --stack-name isms-staging-alb \
  --parameter-overrides \
    Environment=staging \
    VpcId=$VPC_ID \
    PublicSubnet1Id=$PUB_SUBNET_1 \
    PublicSubnet2Id=$PUB_SUBNET_2 \
    ALBSecurityGroupId=$ALB_SG_ID \
    DomainName=trust.demo.paythru.com \
    CertificateArn=$CERT_ARN \
  --region eu-west-2 \
  --profile pt-sandbox
```

After updating, the ALB will:
- Create an HTTPS listener on port 443
- Redirect HTTP (port 80) to HTTPS (port 443)
- Terminate SSL/TLS at the ALB

**Note**: Certificate must be in the same region (eu-west-2) and validated before use.

## Troubleshooting

### Migrations Not Running

Check:
1. Container logs for migration execution messages
2. That `DATABASE_URL` is set correctly in Secrets Manager
3. That Prisma CLI is installed in the Docker image
4. That migration files are included in the Docker image
5. That OpenSSL libraries are installed (required for Prisma)

### Migration Failures

Check:
1. Database connectivity (security groups, VPC routing)
2. Database user permissions
3. Migration file syntax
4. Aurora cluster is using port 5432 (not 3306)
5. Prisma binary targets match the runtime platform

### Health Check Failures

Check target group health status:

```bash
TARGET_GROUP_ARN=$(aws cloudformation describe-stacks --stack-name isms-staging-alb --query 'Stacks[0].Outputs[?OutputKey==`BackendTargetGroupBlueArn`].OutputValue' --output text --profile pt-sandbox)

aws elbv2 describe-target-health --target-group-arn $TARGET_GROUP_ARN --profile pt-sandbox --region eu-west-2 | jq '.TargetHealthDescriptions[] | {State: .TargetHealth.State, Reason: .TargetHealth.Reason, Description: .TargetHealth.Description}'
```

Common issues:
- **Security groups**: ECS security group must allow inbound traffic from ALB security group
- **Health check path**: Frontend uses `/health`, backend uses `/api/health`
- **Port mismatch**: Frontend exposes port 80, backend exposes port 4000
- **Application errors**: Check CloudWatch logs for application startup errors

### Database Connection Issues

Verify:
1. Aurora cluster status and endpoint
2. Security groups allow ECS → Aurora traffic on port 5432
3. DATABASE_URL in Secrets Manager uses correct port (5432)
4. ECS tasks have permission to read Secrets Manager

```bash
# Check Aurora cluster
aws rds describe-db-clusters \
  --db-cluster-identifier isms-staging-cluster \
  --profile pt-sandbox \
  --region eu-west-2 \
  --query 'DBClusters[0].{Status:Status,Endpoint:Endpoint,Port:Port}'

# Check DATABASE_URL
aws secretsmanager get-secret-value \
  --secret-id isms-staging-db-credentials \
  --query 'SecretString' \
  --output text \
  --profile pt-sandbox \
  --region eu-west-2 | jq -r '.DATABASE_URL'
```

### Prisma Binary Target Errors

If you see errors about Prisma binary targets:
1. Ensure `backend/prisma/schema.prisma` includes: `binaryTargets = ["native", "linux-musl-arm64-openssl-3.0.x"]`
2. Rebuild the Docker image to regenerate Prisma Client
3. Verify OpenSSL 3.0.x is installed in the Alpine image

### Frontend API URL Issues

If API calls fail with 404 or double `/api`:
- Verify `VITE_API_URL` does NOT include `/api`
- Frontend code adds `/api` prefix automatically
- Rebuild frontend image with correct `VITE_API_URL`

## GitHub Actions Setup

1. Configure GitHub Secrets:
   - `AWS_ROLE_ARN`: ARN of GitHub Actions IAM role
   - `AWS_REGION`: `eu-west-2`
   - `ECR_REGISTRY`: ECR registry URL
   - `STAGING_BACKEND_SERVICE`: ECS service name
   - `STAGING_FRONTEND_SERVICE`: ECS service name
   - `STAGING_BACKEND_CODEDEPLOY_APP`: CodeDeploy application name
   - `STAGING_FRONTEND_CODEDEPLOY_APP`: CodeDeploy application name
   - `STAGING_BACKEND_DEPLOYMENT_GROUP`: CodeDeploy deployment group name
   - `STAGING_FRONTEND_DEPLOYMENT_GROUP`: CodeDeploy deployment group name
   - Frontend build args (VITE_* variables)

2. Push to `main` branch to trigger staging deployment

3. Use workflow dispatch for production deployments

