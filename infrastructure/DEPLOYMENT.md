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
3. **Always seeds system data** (Controls, Classifications, Asset Categories, Legislation, Interested Parties) if missing
4. Optionally seeds additional data if `SEED_SCOPE` is set (for test/demo data)
5. Starts the application

Migration failures are fatal - the container will exit and prevent the application from starting with an inconsistent schema.

### System Data Seeding

**System data** (Controls, Classifications, Asset Categories, Legislation, Interested Parties) is **automatically seeded** on first deployment to any environment. The startup script checks if Controls exist, and if not, seeds all essential system data.

- **Automatic**: No configuration needed - system data seeds automatically if missing
- **Idempotent**: Safe to run multiple times - only seeds if data doesn't exist
- **Environment-agnostic**: Works for staging, production, and any new environment

This ensures that essential functional data (like ISO 27002 Controls) is always present, even if `SEED_SCOPE` is not set.

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
# RECOMMENDED: Use deploy-utils.sh to build and push all images:
cd /home/developer/dev/ISMS-Documentation/infrastructure
export AWS_PROFILE=pt-sandbox
export ENVIRONMENT=staging
./scripts/deploy-utils.sh build-all-images
#
# This will build and push backend, frontend, document-service, and ai-service images.
# It handles ECR login correctly and uses secrets from Secrets Manager for frontend.
#
# ALTERNATIVE: Manual build and push (if you need more control):
#
# Get repository URIs (if not already set)
BACKEND_REPO=$(aws cloudformation describe-stacks --stack-name isms-staging-ecr --query 'Stacks[0].Outputs[?OutputKey==`BackendRepositoryUri`].OutputValue' --output text --profile pt-sandbox)
FRONTEND_REPO=$(aws cloudformation describe-stacks --stack-name isms-staging-ecr --query 'Stacks[0].Outputs[?OutputKey==`FrontendRepositoryUri`].OutputValue' --output text --profile pt-sandbox)
DOCUMENT_SERVICE_REPO=$(aws cloudformation describe-stacks --stack-name isms-staging-ecr --query 'Stacks[0].Outputs[?OutputKey==`DocumentServiceRepositoryUri`].OutputValue' --output text --profile pt-sandbox)

# Login to ECR (extract registry domain from repository URI)
# IMPORTANT: docker login needs just the registry domain, not the full repository URI
REGISTRY_DOMAIN=$(echo $BACKEND_REPO | cut -d'/' -f1)
aws ecr get-login-password --region eu-west-2 --profile pt-sandbox | docker login --username AWS --password-stdin $REGISTRY_DOMAIN

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

# Build and push document-service image (REQUIRED for Trust Center document downloads)
# The document service handles PDF conversion and watermarking
docker buildx build --platform linux/arm64 \
  -f ./services/document-service/Dockerfile \
  -t $DOCUMENT_SERVICE_REPO:staging \
  ./services/document-service \
  --push

# Build and push ai-service image (REQUIRED for risk similarity and embeddings)
# The AI service handles embedding generation and similarity calculations
AI_SERVICE_REPO=$(aws cloudformation describe-stacks --stack-name isms-staging-ecr --query 'Stacks[0].Outputs[?OutputKey==`AIServiceRepositoryUri`].OutputValue' --output text --profile pt-sandbox)

docker buildx build --platform linux/arm64 \
  -f ./services/ai-service/Dockerfile \
  -t $AI_SERVICE_REPO:staging \
  ./services/ai-service \
  --push

# 8.6. Verify ECS Service-Linked Role exists
# Check if the ECS service-linked role exists (required for cluster creation):
# RECOMMENDED: Use deploy-utils.sh:
cd /home/developer/dev/ISMS-Documentation/infrastructure
export AWS_PROFILE=pt-sandbox
./scripts/deploy-utils.sh verify-ecs-role
#
# ALTERNATIVE: Manual check:
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

# 9.5. Deploy Document Service (REQUIRED for Trust Center document downloads)
# The document service handles PDF conversion, watermarking, and caching
# It must be deployed before the backend can download documents from the Trust Center
#
# NOTE: After initial deployment, GitHub Actions will automatically build and deploy
#       document service updates on each push to main. However, the initial CloudFormation
#       stack deployment must be done manually (this step).
#
DOCUMENT_SERVICE_REPO=$(aws cloudformation describe-stacks --stack-name isms-staging-ecr --query 'Stacks[0].Outputs[?OutputKey==`DocumentServiceRepositoryUri`].OutputValue' --output text --profile pt-sandbox)

aws cloudformation deploy \
  --template-file templates/document-service-ecs.yaml \
  --stack-name isms-staging-document-service \
  --parameter-overrides \
    Environment=staging \
    ClusterName=$CLUSTER_NAME \
    VpcId=$VPC_ID \
    PrivateSubnet1Id=$PRIV_SUBNET_1 \
    PrivateSubnet2Id=$PRIV_SUBNET_2 \
    ECSSecurityGroupId=$ECS_SG_ID \
    ECSTaskExecutionRoleArn=$TASK_EXEC_ROLE \
    ECSTaskRoleArn=$TASK_ROLE \
    DocumentServiceRepositoryUri=$DOCUMENT_SERVICE_REPO \
    DocumentServiceImageTag=staging \
    ApplicationSecretsArn=$APP_SECRET_ARN \
    MinTaskCount=1 \
    MaxTaskCount=2 \
    CpuUnits=1024 \
    MemoryMB=2048 \
  --capabilities CAPABILITY_IAM \
  --region eu-west-2 \
  --profile pt-sandbox

# Verify document service is running
aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services isms-staging-document-service \
  --profile pt-sandbox \
  --region eu-west-2 \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}' \
  --output json | jq '.'

# 9.6. Deploy AI Service (REQUIRED for risk similarity and embeddings)
# The AI service handles embedding generation and similarity calculations
# It must be deployed before the backend can generate embeddings or calculate risk similarity
AI_SERVICE_REPO=$(aws cloudformation describe-stacks --stack-name isms-staging-ecr --query 'Stacks[0].Outputs[?OutputKey==`AIServiceRepositoryUri`].OutputValue' --output text --profile pt-sandbox)

aws cloudformation deploy \
  --template-file templates/ai-service-ecs.yaml \
  --stack-name isms-staging-ai-service \
  --parameter-overrides \
    Environment=staging \
    ClusterName=$CLUSTER_NAME \
    VpcId=$VPC_ID \
    PrivateSubnet1Id=$PRIV_SUBNET_1 \
    PrivateSubnet2Id=$PRIV_SUBNET_2 \
    ECSSecurityGroupId=$ECS_SG_ID \
    ECSTaskExecutionRoleArn=$TASK_EXEC_ROLE \
    ECSTaskRoleArn=$TASK_ROLE \
    AIServiceRepositoryUri=$AI_SERVICE_REPO \
    AIServiceImageTag=staging \
    ApplicationSecretsArn=$APP_SECRET_ARN \
    OllamaEndpoint=http://ollama.local:11434 \
    OllamaModel=nomic-embed-text \
    MinTaskCount=1 \
    MaxTaskCount=2 \
    CpuUnits=512 \
    MemoryMB=1024 \
  --capabilities CAPABILITY_IAM \
  --region eu-west-2 \
  --profile pt-sandbox

# Verify AI service is running
aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services isms-staging-ai-service \
  --profile pt-sandbox \
  --region eu-west-2 \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}' \
  --output json | jq '.'

# NOTE: After deploying AI service and Ollama, you may need to backfill control embeddings
# if controls were seeded before these services were available. See troubleshooting section
# for instructions on checking and backfilling embeddings.

# 9.7. Deploy Ollama (REQUIRED for AI Service embeddings)
# Ollama provides the embedding model (nomic-embed-text) that the AI service uses
# to generate embeddings for risk similarity and control suggestions
#
# NOTE: Ollama requires significant resources (4 vCPU, 8GB RAM)
# After deployment, you must pull the embedding model (see below)
#
# Get Service Discovery Namespace ID (created by document-service stack)
# The namespace is named 'local' and is shared across all microservices
NAMESPACE_ID=$(aws servicediscovery list-namespaces \
  --query 'Namespaces[?Name==`local`].Id' \
  --output text \
  --profile pt-sandbox \
  --region eu-west-2)

if [ -z "$NAMESPACE_ID" ] || [ "$NAMESPACE_ID" == "None" ]; then
  echo "❌ Error: Service Discovery namespace 'local' not found."
  echo "   Make sure document-service stack (section 9.5) is deployed first."
  exit 1
fi

echo "✅ Using Service Discovery namespace: $NAMESPACE_ID"

aws cloudformation deploy \
  --template-file templates/ollama-ecs.yaml \
  --stack-name isms-staging-ollama \
  --parameter-overrides \
    Environment=staging \
    ClusterName=$CLUSTER_NAME \
    VpcId=$VPC_ID \
    PrivateSubnet1Id=$PRIV_SUBNET_1 \
    PrivateSubnet2Id=$PRIV_SUBNET_2 \
    ECSSecurityGroupId=$ECS_SG_ID \
    ECSTaskExecutionRoleArn=$TASK_EXEC_ROLE \
    ECSTaskRoleArn=$TASK_ROLE \
    ServiceDiscoveryNamespaceId=$NAMESPACE_ID \
    EmbeddingModel=nomic-embed-text \
    MinTaskCount=1 \
    MaxTaskCount=1 \
    CpuUnits=4096 \
    MemoryMB=8192 \
  --capabilities CAPABILITY_IAM \
  --region eu-west-2 \
  --profile pt-sandbox

# Wait for Ollama service to start
echo "Waiting for Ollama service to start..."
sleep 60

# Verify Ollama service is running
aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services isms-staging-ollama \
  --profile pt-sandbox \
  --region eu-west-2 \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}' \
  --output json | jq '.'

# Pull the embedding model (REQUIRED - Ollama doesn't auto-download models)
# RECOMMENDED: Use the helper script
cd /home/developer/dev/ISMS-Documentation/infrastructure
./scripts/pull-ollama-model.sh staging nomic-embed-text

# ALTERNATIVE: Manual pull using ECS Exec
# TASK_ARN=$(aws ecs list-tasks --cluster $CLUSTER_NAME --service-name isms-staging-ollama --query 'taskArns[0]' --output text --profile pt-sandbox --region eu-west-2)
# aws ecs execute-command \
#   --cluster $CLUSTER_NAME \
#   --task $TASK_ARN \
#   --container ollama \
#   --command "ollama pull nomic-embed-text" \
#   --interactive \
#   --profile pt-sandbox \
#   --region eu-west-2

# Verify model is available
TASK_ARN=$(aws ecs list-tasks --cluster $CLUSTER_NAME --service-name isms-staging-ollama --query 'taskArns[0]' --output text --profile pt-sandbox --region eu-west-2)
aws ecs execute-command \
  --cluster $CLUSTER_NAME \
  --task $TASK_ARN \
  --container ollama \
  --command "ollama list" \
  --interactive \
  --profile pt-sandbox \
  --region eu-west-2

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
    "TRUST_CENTER_JWT_SECRET": "your-jwt-secret",
    "INTERNAL_SERVICE_TOKEN": "your-secure-token-here"
  }' \
  --region eu-west-2 \
  --profile pt-sandbox
```

**Important Notes:**
- `INTERNAL_SERVICE_TOKEN` is used for authentication between microservices (backend, document-service, ai-service)
- Generate a secure random token (e.g., using `openssl rand -hex 32`)
- If updating an existing secret, you must include ALL existing fields - `put-secret-value` replaces the entire secret
- To add/update a single field without replacing the entire secret, see the "Updating Individual Secrets" section below

#### Updating Individual Secrets

If you need to add or update a single secret value (like `INTERNAL_SERVICE_TOKEN`) without replacing all existing secrets:

```bash
# 1. Get current secret value
CURRENT_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id isms-staging-app-secrets \
  --query 'SecretString' \
  --output text \
  --region eu-west-2 \
  --profile pt-sandbox)

# 2. Generate a secure token (optional - only if adding INTERNAL_SERVICE_TOKEN)
NEW_TOKEN=$(openssl rand -hex 32)
echo "Generated token: $NEW_TOKEN"

# 3. Update secret with new value (merges with existing values)
aws secretsmanager put-secret-value \
  --secret-id isms-staging-app-secrets \
  --secret-string "$(echo "$CURRENT_SECRET" | jq --arg token "$NEW_TOKEN" '.INTERNAL_SERVICE_TOKEN = $token')" \
  --region eu-west-2 \
  --profile pt-sandbox
```

**To add `INTERNAL_SERVICE_TOKEN` to an existing secret:**
```bash
# Get current secret
CURRENT_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id isms-staging-app-secrets \
  --query 'SecretString' \
  --output text \
  --region eu-west-2 \
  --profile pt-sandbox)

# Generate secure token
NEW_TOKEN=$(openssl rand -hex 32)

# Add INTERNAL_SERVICE_TOKEN to existing secret
aws secretsmanager put-secret-value \
  --secret-id isms-staging-app-secrets \
  --secret-string "$(echo "$CURRENT_SECRET" | jq --arg token "$NEW_TOKEN" '. + {INTERNAL_SERVICE_TOKEN: $token}')" \
  --region eu-west-2 \
  --profile pt-sandbox

echo "✅ Added INTERNAL_SERVICE_TOKEN to secret"
echo "Token: $NEW_TOKEN"
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

- **Build and push all images**: `./scripts/deploy-utils.sh build-all-images` (builds backend, frontend, document-service, ai-service)
- **Rebuild frontend with secrets**: `./scripts/deploy-utils.sh rebuild-frontend` (retrieves secrets from Secrets Manager)
- **Build individual images**: `./scripts/deploy-utils.sh build-frontend`, `build-backend`, `build-document-service`, `build-ai-service`
- **Deploy services**: `./scripts/deploy-utils.sh deploy-frontend` or `deploy-backend` (uses CodeDeploy for blue/green)
- **Get deployment variables**: `eval $(./scripts/deploy-utils.sh get-deployment-vars)` (exports all stack outputs as variables)
- **Verify ECS role**: `./scripts/deploy-utils.sh verify-ecs-role` (creates service-linked role if missing)
- **Check health**: `./scripts/deploy-utils.sh check-health --service frontend`
- **View logs**: `./scripts/deploy-utils.sh view-logs --service backend`
- **Monitor deployment**: `./scripts/deploy-utils.sh monitor-deployment --deployment-id <id>` or `--service backend`
- **Seed system data**: `./scripts/seed-system-data.sh` (seeds Controls, Classifications, etc. if missing)

The utility script supports all common options (environment, profile, region, image-tag) and provides helpful output with error handling.

### Getting Deployment Variables

If you need to use CloudFormation stack outputs in manual scripts, you can easily export them:

```bash
cd /home/developer/dev/ISMS-Documentation/infrastructure
export AWS_PROFILE=pt-sandbox
export ENVIRONMENT=staging

# Export all deployment variables
eval $(./scripts/deploy-utils.sh get-deployment-vars)

# Now you can use variables like $VPC_ID, $BACKEND_REPO, $CLUSTER_NAME, etc.
echo "Backend repo: $BACKEND_REPO"
echo "Cluster name: $CLUSTER_NAME"
```

This is especially useful when following the manual deployment steps in Option A (Separate Stack Deployment).

### Seeding System Data to Existing Environments

If you need to seed system data (Controls, Classifications, etc.) to an existing environment that was deployed before this feature:

```bash
cd /home/developer/dev/ISMS-Documentation/infrastructure
export AWS_PROFILE=pt-sandbox
export ENVIRONMENT=staging  # or production
./scripts/seed-system-data.sh
```

This script:
1. Retrieves database credentials from Secrets Manager
2. Checks if system data exists (by counting Controls)
3. Seeds system data if missing
4. Works by either executing in a running ECS task or connecting directly to the database

**Note**: System data seeding is now automatic on all new deployments, so this script is only needed for environments deployed before this feature was added.

## Updating Deployments

### Using CodeDeploy (Recommended)

CodeDeploy provides blue/green deployments with zero downtime. The easiest way is to use the deployment scripts:

#### Quick Deploy Scripts

**Deploy Frontend:**
```bash
cd /home/developer/dev/ISMS-Documentation/infrastructure
export AWS_PROFILE=pt-sandbox
export ENVIRONMENT=staging
./scripts/deploy-utils.sh deploy-frontend
```

**Deploy Backend:**
```bash
cd /home/developer/dev/ISMS-Documentation/infrastructure
export AWS_PROFILE=pt-sandbox
export ENVIRONMENT=staging
./scripts/deploy-utils.sh deploy-backend
```

**Build and Push All Images Before Deployment:**
```bash
cd /home/developer/dev/ISMS-Documentation/infrastructure
export AWS_PROFILE=pt-sandbox
export ENVIRONMENT=staging
./scripts/deploy-utils.sh build-all-images
```

#### Manual Deployment Steps

If you prefer to deploy manually, here's the process:

**1. Build and Push New Image**

**RECOMMENDED: Use deploy-utils.sh:**
```bash
cd /home/developer/dev/ISMS-Documentation/infrastructure
export AWS_PROFILE=pt-sandbox
export ENVIRONMENT=staging
./scripts/deploy-utils.sh rebuild-frontend  # Uses secrets from Secrets Manager
```

**ALTERNATIVE: Manual build (if you need more control):**
```bash
# Get repository URI
FRONTEND_REPO=$(aws cloudformation describe-stacks --stack-name isms-staging-ecr --query 'Stacks[0].Outputs[?OutputKey==`FrontendRepositoryUri`].OutputValue' --output text --profile pt-sandbox)

# Login to ECR (extract registry domain from repository URI)
REGISTRY_DOMAIN=$(echo $FRONTEND_REPO | cut -d'/' -f1)
aws ecr get-login-password --region eu-west-2 --profile pt-sandbox | docker login --username AWS --password-stdin $REGISTRY_DOMAIN

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

### Common Deployment Issues

**Migrations Not Running:**
- Check container logs for migration execution messages
- Verify `DATABASE_URL` is set correctly in Secrets Manager
- Ensure Prisma CLI is installed in the Docker image
- Verify migration files are included in the Docker image
- Confirm OpenSSL libraries are installed (required for Prisma)

**Health Check Failures:**
- Verify security groups allow ECS → ALB traffic
- Check health check paths: Frontend uses `/health`, backend uses `/api/health`
- Verify ports: Frontend exposes port 80, backend exposes port 4000
- Check CloudWatch logs for application startup errors

**Database Connection Issues:**
- Verify Aurora cluster status and endpoint
- Ensure security groups allow ECS → Aurora traffic on port 5432
- Verify DATABASE_URL in Secrets Manager uses correct port (5432)
- Confirm ECS tasks have permission to read Secrets Manager

**Prisma Binary Target Errors:**
- Ensure `backend/prisma/schema.prisma` includes: `binaryTargets = ["native", "linux-musl-arm64-openssl-3.0.x"]`
- Rebuild the Docker image to regenerate Prisma Client
- Verify OpenSSL 3.0.x is installed in the Alpine image

**Frontend API URL Issues:**
- Verify `VITE_API_URL` does NOT include `/api` (frontend code adds it automatically)
- Rebuild frontend image with correct `VITE_API_URL`

### Microservice Issues

**Document Service:**
If Trust Center document downloads fail, verify:
- Document service is deployed (see section 9.5)
- Service is running: `aws ecs describe-services --cluster $CLUSTER_NAME --services isms-staging-document-service`
- Service discovery is working: `aws servicediscovery list-services`
- `INTERNAL_SERVICE_TOKEN` is set in Secrets Manager
- Check CloudWatch logs: `aws logs tail /ecs/isms-staging-document-service --follow`

**AI Service:**
If risk similarity calculations or embedding generation fail, verify:
- AI service is deployed (see section 9.6)
- Service is running: `aws ecs describe-services --cluster $CLUSTER_NAME --services isms-staging-ai-service`
- Ollama is deployed and running (see section 9.7)
- Service discovery is working: `aws servicediscovery list-services`
- `INTERNAL_SERVICE_TOKEN` is set in Secrets Manager
- Check CloudWatch logs: `aws logs tail /ecs/isms-staging-ai-service --follow`

**Check Backend Logs for AI Service Connection Errors:**

If "Get AI Suggestions" returns 500 errors, check backend logs:
```bash
aws logs tail /ecs/isms-staging-backend --follow --profile pt-sandbox --region eu-west-2 | grep -i "ai\|embedding\|ollama"
```

Common error patterns:
- `[AIServiceClient] Failed to generate embedding` - AI service not accessible or Ollama not available
- `ECONNREFUSED` or `ENOTFOUND` - Service discovery not working or AI service not deployed
- `401 Unauthorized` - INTERNAL_SERVICE_TOKEN mismatch

**Ollama Not Deployed:**

If you see errors about Ollama not being available, ensure Ollama is deployed as part of the main deployment process (see section 9.7). The AI service requires Ollama to generate embeddings for control suggestions and risk similarity calculations.

**Control Embeddings Missing (No AI Suggestions Returned):**

If "Get AI Suggestions" doesn't fail but returns no suggestions, controls likely don't have embeddings stored in the database. The AI suggestion endpoint only includes controls with pre-computed embeddings (`embedding: { not: Prisma.JsonNull }`).

**Symptoms:**
- API call succeeds (200 OK) but `suggestedControlIds` is empty
- `totalMatches` is 0
- No error messages in logs

**Check Embedding Status:**

Use the check script:
```bash
cd /home/developer/dev/ISMS-Documentation/infrastructure
export AWS_PROFILE=pt-sandbox
export ENVIRONMENT=staging
./scripts/check-embeddings-simple.sh staging
```

Alternatively, check via backend logs:
```bash
# Check if embedding computation is happening
aws logs tail /ecs/isms-staging-backend --since 1h --profile pt-sandbox --region eu-west-2 | grep -i "embedding\|backfill"
```

**Backfill Control Embeddings:**

If controls are missing embeddings, run the backfill script:

```bash
cd /home/developer/dev/ISMS-Documentation/infrastructure
export AWS_PROFILE=pt-sandbox
export ENVIRONMENT=staging

# Check status first
./scripts/check-embeddings-simple.sh staging

# Backfill embeddings (requires AI service and Ollama to be running)
./scripts/backfill-control-embeddings.sh staging
```

**Note:** The backfill script uses ECS Exec to run the embedding computation inside a backend task. This requires:
- ECS Exec enabled on the backend task definition (`EnableExecuteCommand: true`)
- AI service running and accessible
- Ollama service running with the embedding model (`nomic-embed-text`) pulled

**If ECS Exec is not enabled**, use the one-time task script instead:
```bash
cd /home/developer/dev/ISMS-Documentation/infrastructure
export AWS_PROFILE=pt-sandbox
export ENVIRONMENT=staging
./scripts/backfill-embeddings-onetime-task.sh staging
```

This script creates a temporary task definition with the backfill command and runs it as a one-time task (no ECS Exec required).

**Monitor Progress:**
```bash
# Watch backend logs for embedding computation progress
aws logs tail /ecs/isms-staging-backend --follow --profile pt-sandbox --region eu-west-2 | grep -i "backfill\|embedding"
```

**Expected Output:**
- `[Backfill] Starting control embedding backfill...`
- `[Backfill Progress] Processed: X, Succeeded: Y, Failed: Z`
- `[Backfill] Complete - Processed: X, Succeeded: Y, Failed: Z`

**After Backfill:**
- Verify embeddings were created: `./scripts/check-embeddings-simple.sh staging`
- Test AI suggestions again - should now return control suggestions
- If still no suggestions, check similarity scores in backend logs (threshold is 55%)

**Why Embeddings Might Be Missing:**
- Controls were seeded before AI service/Ollama was deployed
- Embedding computation failed during seed (non-fatal, seed continues)
- AI service was unavailable when controls were created
- Database was restored from a backup that didn't include embeddings

## GitHub Actions Setup

1. Configure GitHub Secrets:
   - `AWS_ROLE_ARN`: ARN of GitHub Actions IAM role
   - `AWS_REGION`: `eu-west-2`
   - `ECR_REGISTRY`: ECR registry URL
   - `STAGING_CLUSTER_NAME`: ECS cluster name (e.g., `isms-staging`)
   - `STAGING_BACKEND_SERVICE`: ECS service name
   - `STAGING_FRONTEND_SERVICE`: ECS service name
   - `STAGING_BACKEND_CODEDEPLOY_APP`: CodeDeploy application name
   - `STAGING_FRONTEND_CODEDEPLOY_APP`: CodeDeploy application name
   - `STAGING_BACKEND_DEPLOYMENT_GROUP`: CodeDeploy deployment group name
   - `STAGING_FRONTEND_DEPLOYMENT_GROUP`: CodeDeploy deployment group name
   - Frontend build args (VITE_* variables)

2. **Initial Deployment**: Deploy document service, AI service, and Ollama CloudFormation stacks manually (sections 9.5, 9.6, and 9.7) before first GitHub Actions deployment

3. Push to `main` branch to trigger staging deployment (will automatically build and deploy backend, frontend, document-service, and ai-service)

4. Use workflow dispatch for production deployments

**Note**: GitHub Actions workflows automatically build and deploy the document service and AI service on each push. These services are updated via ECS service update (not CodeDeploy, since they're not behind an ALB).

