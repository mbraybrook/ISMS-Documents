# GitHub Actions Setup Guide

This guide walks you through setting up GitHub Actions to deploy to AWS ECS using OIDC (OpenID Connect) authentication.

## Overview

GitHub Actions will:
1. Authenticate to AWS using OIDC (no long-lived credentials needed)
2. Build Docker images (ARM64 for Graviton2)
3. Push images to ECR
4. Create new ECS task definitions
5. Trigger CodeDeploy blue/green deployments

## Prerequisites

- AWS CLI configured with `pt-sandbox` profile
- All CloudFormation stacks deployed (VPC, Secrets, Security Groups, Aurora, IAM, ECR, ALB, ECS, CodeDeploy)
- GitHub repository access
- `jq` installed (for JSON parsing)

## Step 1: Set Up OIDC Provider

The OIDC provider allows GitHub Actions to assume an IAM role without storing AWS credentials. It only needs to be created once per AWS account.

**Important**: The OIDC provider URL differs between GitHub.com and GitHub Enterprise:
- **GitHub.com**: `https://token.actions.githubusercontent.com`
- **GitHub Enterprise**: `https://token.actions.YOUR-ENTERPRISE-DOMAIN` (e.g., `https://token.actions.paythru.ghe.com`)

The setup script will automatically detect which type you're using based on your git remote URL.

### Option A: Automatic (Recommended)

The setup script (`scripts/setup-github-actions.sh`) will detect if the OIDC provider exists and offer to create it if it doesn't. The OIDC provider is an account-level resource that only needs to be created once per AWS account.

### Option B: Manual Setup

If you prefer to create it manually:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --profile pt-sandbox \
  --region eu-west-2
```

**Note**: The thumbprint may change. If you get an error, get the current thumbprint:

```bash
# Get GitHub's OIDC thumbprint
THUMBPRINT=$(echo | openssl s_client -servername token.actions.githubusercontent.com -showcerts -connect token.actions.githubusercontent.com:443 2>/dev/null | openssl x509 -fingerprint -noout | sed 's/SHA256 Fingerprint=//' | tr -d ':')
echo "Thumbprint: $THUMBPRINT"
```

## Step 2: Deploy/Update IAM Roles with GitHub Configuration

The IAM roles stack needs to know your GitHub organization and repository name to create the GitHub Actions role.

### Get Your GitHub Repository Info

```bash
cd /home/developer/dev/ISMS-Documentation
git remote get-url pt-origin
# Example output: paythru@paythru.ghe.com:Paythru/ISMS-Register.git
# Org: Paythru, Repo: ISMS-Register
```

### Deploy IAM Roles Stack

```bash
cd infrastructure

# Get your GitHub org and repo from the git remote (use pt-origin for GitHub Enterprise)
GITHUB_REPO=$(git -C .. remote get-url pt-origin 2>/dev/null | sed -E 's|.*[:/]([^/]+)/([^/]+)(\.git)?$|\1/\2|' || git -C .. remote get-url origin | sed -E 's|.*[:/]([^/]+)/([^/]+)(\.git)?$|\1/\2|')
GITHUB_ORG=$(echo "$GITHUB_REPO" | cut -d'/' -f1)
GITHUB_REPO_NAME=$(echo "$GITHUB_REPO" | cut -d'/' -f2 | sed 's/\.git$//')

echo "GitHub Org: $GITHUB_ORG"
echo "GitHub Repo: $GITHUB_REPO_NAME"

# Detect GitHub Enterprise vs GitHub.com (for OIDC domain)
GITHUB_REMOTE_URL=$(git -C .. remote get-url pt-origin 2>/dev/null || git -C .. remote get-url origin)
if echo "$GITHUB_REMOTE_URL" | grep -q "\.ghe\.com"; then
    GITHUB_ENTERPRISE_DOMAIN=$(echo "$GITHUB_REMOTE_URL" | sed -E 's|.*@([^:]+):.*|\1|' | sed 's|\.ghe\.com||')
    GITHUB_OIDC_DOMAIN="token.actions.${GITHUB_ENTERPRISE_DOMAIN}.ghe.com"
    echo "Detected GitHub Enterprise: $GITHUB_OIDC_DOMAIN"
else
    GITHUB_OIDC_DOMAIN="token.actions.githubusercontent.com"
    echo "Detected GitHub.com: $GITHUB_OIDC_DOMAIN"
fi

# Deploy IAM roles stack
aws cloudformation deploy \
  --template-file templates/iam-roles.yaml \
  --stack-name isms-staging-iam \
  --parameter-overrides \
    Environment=staging \
    GitHubOrg=$GITHUB_ORG \
    GitHubRepo=$GITHUB_REPO_NAME \
    GitHubOIDCDomain=$GITHUB_OIDC_DOMAIN \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region eu-west-2 \
  --profile pt-sandbox
```

**Important**: The `GitHubOrg` and `GitHubRepo` parameters are required to create the GitHub Actions role. If these are not provided, the role won't be created.

### Verify Role Creation

```bash
# Get the role ARN
aws cloudformation describe-stacks \
  --stack-name isms-staging-iam \
  --query 'Stacks[0].Outputs[?OutputKey==`GitHubActionsRoleArn`].OutputValue' \
  --output text \
  --profile pt-sandbox \
  --region eu-west-2
```

You should see an ARN like: `arn:aws:iam::ACCOUNT_ID:role/isms-staging-github-actions-role`

## Step 3: Gather Required Values

Use the setup script to gather all values needed for GitHub Secrets:

```bash
cd infrastructure/scripts
chmod +x setup-github-actions.sh
./setup-github-actions.sh pt-sandbox staging
```

This script will:
- Get AWS account ID and region
- Detect GitHub repository from git remote
- Check OIDC provider status
- Get IAM role ARN
- Get ECR registry URL
- Get ECS service names
- Get CodeDeploy application and deployment group names
- Get frontend build variables from Secrets Manager
- Generate a summary of all GitHub Secrets needed

**Alternative**: If the script doesn't work, you can gather values manually using the commands in the script.

## Step 4: Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add each secret from the script output:

### Required Secrets

| Secret Name | Description | Example |
|------------|-------------|---------|
| `AWS_ROLE_ARN` | ARN of GitHub Actions IAM role | `arn:aws:iam::123456789012:role/isms-staging-github-actions-role` |
| `AWS_REGION` | AWS region | `eu-west-2` |
| `ECR_REGISTRY` | ECR registry URL (without repository name) | `123456789012.dkr.ecr.eu-west-2.amazonaws.com` |
| `STAGING_CLUSTER_NAME` | ECS cluster name | `isms-staging` |
| `STAGING_BACKEND_SERVICE` | ECS backend service name | `isms-staging-backend` |
| `STAGING_FRONTEND_SERVICE` | ECS frontend service name | `isms-staging-frontend` |
| `STAGING_BACKEND_CODEDEPLOY_APP` | CodeDeploy backend application name | `isms-staging-backend-app` |
| `STAGING_FRONTEND_CODEDEPLOY_APP` | CodeDeploy frontend application name | `isms-staging-frontend-app` |
| `STAGING_BACKEND_DEPLOYMENT_GROUP` | CodeDeploy backend deployment group | `isms-staging-backend-dg` |
| `STAGING_FRONTEND_DEPLOYMENT_GROUP` | CodeDeploy frontend deployment group | `isms-staging-frontend-dg` |

### Frontend Build Variables

| Secret Name | Description | Example |
|------------|-------------|---------|
| `VITE_AUTH_TENANT_ID` | Azure AD Tenant ID | `12345678-1234-1234-1234-123456789012` |
| `VITE_AUTH_CLIENT_ID` | Azure AD Client ID | `87654321-4321-4321-4321-210987654321` |
| `STAGING_VITE_API_URL` | Backend API URL (without /api) | `https://trust.demo.paythru.com` |
| `STAGING_VITE_AUTH_REDIRECT_URI` | Redirect URI for staging | `https://trust.demo.paythru.com` |

**Important**: 
- `STAGING_VITE_API_URL` should **NOT** include `/api` - the frontend code adds it automatically
- These values are baked into the frontend Docker image at build time

## Step 5: Test the Workflow

### Option A: Push to Main Branch

The workflow triggers automatically on push to `main`:

```bash
git checkout main
git pull origin main
# Make a small change (e.g., update README)
git add .
git commit -m "test: trigger GitHub Actions deployment"
git push origin main
```

### Option B: Manual Workflow Dispatch

1. Go to **Actions** tab in GitHub
2. Select **Deploy to Staging** workflow
3. Click **Run workflow**
4. Optionally specify an image tag (defaults to commit SHA)
5. Click **Run workflow**

## Step 6: Monitor Deployment

### In GitHub Actions

1. Go to **Actions** tab
2. Click on the running workflow
3. Watch the logs for each step

### In AWS Console

```bash
# Monitor ECS services
aws ecs describe-services \
  --cluster isms-staging \
  --services isms-staging-backend isms-staging-frontend \
  --profile pt-sandbox \
  --region eu-west-2 \
  --query 'services[*].{Name:serviceName,Status:status,Running:runningCount,Desired:desiredCount}' \
  --output table

# Monitor CodeDeploy deployments
aws deploy list-deployments \
  --application-name isms-staging-backend-app \
  --deployment-group-name isms-staging-backend-dg \
  --max-items 5 \
  --profile pt-sandbox \
  --region eu-west-2 \
  --output table
```

## Troubleshooting

### Error: "Input required and not supplied: aws-region"

**Cause**: GitHub Secret `AWS_REGION` is not set.

**Solution**: Add `AWS_REGION` secret with value `eu-west-2`.

### Error: "Role cannot be assumed" or Repeated "Assuming role with OIDC" Messages

**Cause**: OIDC provider not set up, IAM role trust policy incorrect, or repository name mismatch.

**Symptoms**:
- Repeated "Assuming role with OIDC" messages in workflow logs
- Action retries multiple times before failing
- Error: "Error: Could not assume role with OIDC"

**Solution**:
1. Verify OIDC provider exists:
   ```bash
   aws iam list-open-id-connect-providers --profile pt-sandbox
   ```
2. Verify IAM role trust policy includes your GitHub repo:
   ```bash
   aws iam get-role --role-name isms-staging-github-actions-role --profile pt-sandbox --query 'Role.AssumeRolePolicyDocument'
   ```
3. Ensure GitHub org/repo match exactly (case-sensitive). For GitHub Enterprise, the format should be `repo:OrgName/RepoName:*`
4. Check CloudTrail logs for detailed error messages:
   ```bash
   aws cloudtrail lookup-events \
     --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity \
     --max-results 10 \
     --profile pt-sandbox \
     --region eu-west-2
   ```
5. Verify the OIDC provider thumbprint is current (it may change):
   ```bash
   THUMBPRINT=$(echo | openssl s_client -servername token.actions.githubusercontent.com -showcerts -connect token.actions.githubusercontent.com:443 2>/dev/null | openssl x509 -fingerprint -noout | sed 's/SHA256 Fingerprint=//' | tr -d ':')
   echo "Current thumbprint: $THUMBPRINT"
   ```
6. For GitHub Enterprise, ensure the repository name in the trust policy matches exactly what GitHub sends in the OIDC token (check workflow logs for the actual repository context)

### Error: "ECR repository not found"

**Cause**: ECR repositories don't exist or ECR_REGISTRY secret is incorrect.

**Solution**:
1. Verify ECR repositories exist:
   ```bash
   aws ecr describe-repositories --profile pt-sandbox --region eu-west-2
   ```
2. Verify `ECR_REGISTRY` secret is correct (should be registry URL without repository name)

### Error: "ECS service not found"

**Cause**: ECS service names don't match or services don't exist.

**Solution**:
1. List ECS services:
   ```bash
   aws ecs list-services --cluster isms-staging --profile pt-sandbox --region eu-west-2
   ```
2. Verify service name secrets match exactly

### Error: "CodeDeploy application not found"

**Cause**: CodeDeploy application names don't match.

**Solution**:
1. List CodeDeploy applications:
   ```bash
   aws deploy list-applications --profile pt-sandbox --region eu-west-2
   ```
2. Verify application and deployment group names match exactly

### Workflow Runs But Deployment Fails

Check the workflow logs for specific errors:
- **Build failures**: Check Dockerfile syntax, dependencies
- **Push failures**: Check ECR permissions
- **Task definition failures**: Check task definition JSON structure
- **CodeDeploy failures**: Check AppSpec format, target groups, health checks

### Frontend Shows Placeholder Values

**Cause**: Frontend image was built with placeholder values instead of real secrets.

**Solution**: Rebuild frontend image with correct values:
```bash
cd infrastructure
./scripts/deploy-utils.sh rebuild-frontend
```

## Security Best Practices

1. **Use OIDC**: Never store AWS access keys in GitHub Secrets. OIDC is more secure and doesn't require credential rotation.

2. **Least Privilege**: The GitHub Actions role has permissions only for:
   - ECS/ECR operations
   - CodeDeploy operations
   - CloudFormation (read-only for most operations)
   - Secrets Manager (read-only for application secrets)

3. **Repository Restrictions**: The IAM role trust policy restricts access to your specific GitHub repository.

4. **Audit Logs**: All GitHub Actions runs are logged in CloudTrail when assuming the role.

## Additional Resources

- [GitHub Actions OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS IAM OIDC Provider Guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
- [Deployment Guide](./DEPLOYMENT.md)
- [Deployment Utilities](./scripts/deploy-utils.sh)

