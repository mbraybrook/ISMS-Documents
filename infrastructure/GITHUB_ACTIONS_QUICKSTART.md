# GitHub Actions Quick Start

Quick guide to get GitHub Actions deploying to AWS.

## Step 1: Run Setup Script

```bash
cd infrastructure/scripts
./setup-github-actions.sh pt-sandbox staging
```

This will:
- Check your AWS setup
- Gather all required values
- Display GitHub Secrets you need to configure

## Step 2: Deploy/Update IAM Roles

The IAM roles stack needs your GitHub org/repo to create the GitHub Actions role:

```bash
cd infrastructure

# Get GitHub org/repo from git remote (use pt-origin for GitHub Enterprise)
GITHUB_REPO=$(git -C .. remote get-url pt-origin 2>/dev/null | sed -E 's|.*[:/]([^/]+)/([^/]+)(\.git)?$|\1/\2|' || git -C .. remote get-url origin | sed -E 's|.*[:/]([^/]+)/([^/]+)(\.git)?$|\1/\2|')
GITHUB_ORG=$(echo "$GITHUB_REPO" | cut -d'/' -f1)
GITHUB_REPO_NAME=$(echo "$GITHUB_REPO" | cut -d'/' -f2 | sed 's/\.git$//')

# Deploy IAM roles with GitHub config
aws cloudformation deploy \
  --template-file templates/iam-roles.yaml \
  --stack-name isms-staging-iam \
  --parameter-overrides \
    Environment=staging \
    GitHubOrg=$GITHUB_ORG \
    GitHubRepo=$GITHUB_REPO_NAME \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region eu-west-2 \
  --profile pt-sandbox
```

## Step 3: Add GitHub Secrets

1. Go to your GitHub repo: **Settings** > **Secrets and variables** > **Actions**
2. Click **New repository secret**
3. Add each secret from the setup script output

**Minimum Required Secrets:**
- `AWS_ROLE_ARN` - From setup script output
- `AWS_REGION` - `eu-west-2`
- `ECR_REGISTRY` - From setup script output
- `STAGING_CLUSTER_NAME` - From setup script output
- `STAGING_BACKEND_SERVICE` - From setup script output
- `STAGING_FRONTEND_SERVICE` - From setup script output
- `STAGING_BACKEND_CODEDEPLOY_APP` - From setup script output
- `STAGING_FRONTEND_CODEDEPLOY_APP` - From setup script output
- `STAGING_BACKEND_DEPLOYMENT_GROUP` - From setup script output
- `STAGING_FRONTEND_DEPLOYMENT_GROUP` - From setup script output

**Frontend Build Variables** (if deploying frontend):
- `VITE_AUTH_TENANT_ID` - From Secrets Manager
- `VITE_AUTH_CLIENT_ID` - From Secrets Manager
- `STAGING_VITE_API_URL` - Your domain (e.g., `https://trust.demo.paythru.com`)
- `STAGING_VITE_AUTH_REDIRECT_URI` - Same as API URL

## Step 4: Test

Push to `main` branch or use **Actions** > **Deploy to Staging** > **Run workflow**

## Troubleshooting

**Error: "Input required and not supplied: aws-region"**
- Add `AWS_REGION` secret with value `eu-west-2`

**Error: "Role cannot be assumed"**
- Verify IAM roles stack was deployed with `GitHubOrg` and `GitHubRepo` parameters
- Check GitHub org/repo names match exactly (case-sensitive)

**Error: "ECR repository not found"**
- Verify ECR repositories exist: `aws ecr describe-repositories --profile pt-sandbox`
- Check `ECR_REGISTRY` secret is correct (registry URL without repo name)

See [GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md) for detailed troubleshooting.

