#!/bin/bash
# Script to gather all values needed for GitHub Actions secrets
# Usage: ./setup-github-actions.sh [profile] [environment]

set -e

AWS_PROFILE="${1:-pt-sandbox}"
ENVIRONMENT="${2:-staging}"
AWS_REGION="${AWS_REGION:-eu-west-2}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_info() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Get AWS Account ID
print_header "Getting AWS Account Information"
ACCOUNT_ID=$(aws sts get-caller-identity \
    --profile "$AWS_PROFILE" \
    --query 'Account' \
    --output text)

print_info "AWS Account ID: $ACCOUNT_ID"
print_info "AWS Region: $AWS_REGION"
print_info "Environment: $ENVIRONMENT"
print_info "AWS Profile: $AWS_PROFILE"

# Get GitHub repository info
print_header "GitHub Repository Information"
# Try pt-origin first (for GitHub Enterprise), fall back to origin
GITHUB_REPO=$(git remote get-url pt-origin 2>/dev/null | sed -E 's|.*[:/]([^/]+)/([^/]+)(\.git)?$|\1/\2|' || git remote get-url origin 2>/dev/null | sed -E 's|.*[:/]([^/]+)/([^/]+)(\.git)?$|\1/\2|' || echo "")
if [ -z "$GITHUB_REPO" ]; then
    print_warning "Could not detect GitHub repo from git remote. Please provide manually."
    echo "Format: owner/repo-name"
    read -p "GitHub repository (owner/repo): " GITHUB_REPO
fi

GITHUB_ORG=$(echo "$GITHUB_REPO" | cut -d'/' -f1)
GITHUB_REPO_NAME=$(echo "$GITHUB_REPO" | cut -d'/' -f2 | sed 's/\.git$//')

print_info "GitHub Org: $GITHUB_ORG"
print_info "GitHub Repo: $GITHUB_REPO_NAME"

# Check if OIDC provider exists
print_header "Checking OIDC Provider"
OIDC_PROVIDER_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
OIDC_EXISTS=$(aws iam list-open-id-connect-providers \
    --profile "$AWS_PROFILE" \
    --query "OpenIDConnectProviderList[?Arn=='${OIDC_PROVIDER_ARN}'].Arn" \
    --output text 2>/dev/null || echo "")

if [ -z "$OIDC_EXISTS" ]; then
    print_warning "OIDC provider does not exist."
    print_info "OIDC Provider ARN: $OIDC_PROVIDER_ARN"
    echo ""
    echo "The OIDC provider must be created manually (it's an account-level resource)."
    echo "Create it with:"
    echo "  aws iam create-open-id-connect-provider \\"
    echo "    --url https://token.actions.githubusercontent.com \\"
    echo "    --client-id-list sts.amazonaws.com \\"
    echo "    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \\"
    echo "    --profile $AWS_PROFILE"
    echo ""
    read -p "Would you like to create it now? (y/n): " CREATE_OIDC
    if [ "$CREATE_OIDC" = "y" ] || [ "$CREATE_OIDC" = "Y" ]; then
        print_info "Creating OIDC provider..."
        aws iam create-open-id-connect-provider \
            --url https://token.actions.githubusercontent.com \
            --client-id-list sts.amazonaws.com \
            --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
            --profile "$AWS_PROFILE" 2>/dev/null && print_info "OIDC provider created successfully!" || print_error "Failed to create OIDC provider (it may already exist)."
    fi
else
    print_info "OIDC provider exists: $OIDC_PROVIDER_ARN"
fi

# Get IAM role ARN
print_header "Getting IAM Role Information"
IAM_STACK_NAME="isms-${ENVIRONMENT}-iam"
ROLE_EXISTS=$(aws cloudformation describe-stacks \
    --stack-name "$IAM_STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo "")

if [ "$ROLE_EXISTS" != "CREATE_COMPLETE" ] && [ "$ROLE_EXISTS" != "UPDATE_COMPLETE" ]; then
    print_error "IAM stack '$IAM_STACK_NAME' not found or not complete."
    print_info "You need to deploy the IAM roles stack with GitHub org/repo parameters."
    echo ""
    echo "Deploy with:"
    echo "  aws cloudformation deploy \\"
    echo "    --template-file templates/iam-roles.yaml \\"
    echo "    --stack-name $IAM_STACK_NAME \\"
    echo "    --parameter-overrides \\"
    echo "      Environment=$ENVIRONMENT \\"
    echo "      GitHubOrg=$GITHUB_ORG \\"
    echo "      GitHubRepo=$GITHUB_REPO_NAME \\"
    echo "    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \\"
    echo "    --region $AWS_REGION \\"
    echo "    --profile $AWS_PROFILE"
    echo ""
    exit 1
fi

GITHUB_ROLE_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$IAM_STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`GitHubActionsRoleArn`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$GITHUB_ROLE_ARN" ]; then
    print_error "GitHub Actions role not found in stack outputs."
    print_info "The IAM stack may not have been deployed with GitHubOrg parameter."
    print_info "Role name should be: isms-${ENVIRONMENT}-github-actions-role"
    exit 1
fi

print_info "GitHub Actions Role ARN: $GITHUB_ROLE_ARN"

# Get ECR registry
print_header "Getting ECR Registry Information"
ECR_STACK_NAME="isms-${ENVIRONMENT}-ecr"
ECR_REGISTRY=$(aws cloudformation describe-stacks \
    --stack-name "$ECR_STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`BackendRepositoryUri`].OutputValue' \
    --output text 2>/dev/null | sed 's|/isms-backend$||' || echo "")

if [ -z "$ECR_REGISTRY" ]; then
    print_error "ECR registry not found. Is the ECR stack deployed?"
    exit 1
fi

print_info "ECR Registry: $ECR_REGISTRY"

# Get ECS service names
print_header "Getting ECS Service Information"
ECS_STACK_NAME="isms-${ENVIRONMENT}-ecs"
CLUSTER_NAME=$(aws cloudformation describe-stacks \
    --stack-name "$ECS_STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ClusterName`].OutputValue' \
    --output text 2>/dev/null || echo "")

BACKEND_SERVICE=$(aws cloudformation describe-stacks \
    --stack-name "$ECS_STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`BackendServiceName`].OutputValue' \
    --output text 2>/dev/null || echo "")

FRONTEND_SERVICE=$(aws cloudformation describe-stacks \
    --stack-name "$ECS_STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendServiceName`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$CLUSTER_NAME" ] || [ -z "$BACKEND_SERVICE" ] || [ -z "$FRONTEND_SERVICE" ]; then
    print_error "ECS cluster or services not found. Is the ECS stack deployed?"
    exit 1
fi

print_info "Cluster Name: $CLUSTER_NAME"
print_info "Backend Service: $BACKEND_SERVICE"
print_info "Frontend Service: $FRONTEND_SERVICE"

# Get CodeDeploy application names
print_header "Getting CodeDeploy Information"
CODEDEPLOY_STACK_NAME="isms-${ENVIRONMENT}-codedeploy"
BACKEND_CODEDEPLOY_APP=$(aws cloudformation describe-stacks \
    --stack-name "$CODEDEPLOY_STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`BackendCodeDeployApplicationName`].OutputValue' \
    --output text 2>/dev/null || echo "")

FRONTEND_CODEDEPLOY_APP=$(aws cloudformation describe-stacks \
    --stack-name "$CODEDEPLOY_STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendCodeDeployApplicationName`].OutputValue' \
    --output text 2>/dev/null || echo "")

BACKEND_DEPLOYMENT_GROUP=$(aws cloudformation describe-stacks \
    --stack-name "$CODEDEPLOY_STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`BackendDeploymentGroupName`].OutputValue' \
    --output text 2>/dev/null || echo "")

FRONTEND_DEPLOYMENT_GROUP=$(aws cloudformation describe-stacks \
    --stack-name "$CODEDEPLOY_STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendDeploymentGroupName`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$BACKEND_CODEDEPLOY_APP" ] || [ -z "$FRONTEND_CODEDEPLOY_APP" ]; then
    print_warning "CodeDeploy applications not found in stack outputs."
    print_info "Using default naming convention..."
    BACKEND_CODEDEPLOY_APP="isms-${ENVIRONMENT}-backend-app"
    FRONTEND_CODEDEPLOY_APP="isms-${ENVIRONMENT}-frontend-app"
    BACKEND_DEPLOYMENT_GROUP="isms-${ENVIRONMENT}-backend-dg"
    FRONTEND_DEPLOYMENT_GROUP="isms-${ENVIRONMENT}-frontend-dg"
fi

print_info "Backend CodeDeploy App: $BACKEND_CODEDEPLOY_APP"
print_info "Backend Deployment Group: $BACKEND_DEPLOYMENT_GROUP"
print_info "Frontend CodeDeploy App: $FRONTEND_CODEDEPLOY_APP"
print_info "Frontend Deployment Group: $FRONTEND_DEPLOYMENT_GROUP"

# Get frontend build variables from Secrets Manager
print_header "Getting Frontend Build Variables"
APP_SECRETS_ARN=$(aws cloudformation describe-stacks \
    --stack-name "isms-${ENVIRONMENT}-secrets" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApplicationSecretsArn`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -n "$APP_SECRETS_ARN" ]; then
    SECRETS_JSON=$(aws secretsmanager get-secret-value \
        --secret-id "$APP_SECRETS_ARN" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        --query 'SecretString' \
        --output text 2>/dev/null || echo "{}")
    
    AUTH_TENANT_ID=$(echo "$SECRETS_JSON" | jq -r '.AUTH_TENANT_ID // empty' 2>/dev/null || echo "")
    AUTH_CLIENT_ID=$(echo "$SECRETS_JSON" | jq -r '.AUTH_CLIENT_ID // empty' 2>/dev/null || echo "")
    AUTH_REDIRECT_URI=$(echo "$SECRETS_JSON" | jq -r '.AUTH_REDIRECT_URI // empty' 2>/dev/null || echo "")
    
    if [ -n "$AUTH_TENANT_ID" ]; then
        print_info "AUTH_TENANT_ID found in secrets"
    else
        print_warning "AUTH_TENANT_ID not found in secrets"
    fi
    
    if [ -n "$AUTH_CLIENT_ID" ]; then
        print_info "AUTH_CLIENT_ID found in secrets"
    else
        print_warning "AUTH_CLIENT_ID not found in secrets"
    fi
    
    if [ -n "$AUTH_REDIRECT_URI" ]; then
        print_info "AUTH_REDIRECT_URI found in secrets"
    else
        print_warning "AUTH_REDIRECT_URI not found in secrets"
    fi
else
    print_warning "Application secrets not found. Frontend build variables will need to be set manually."
    AUTH_TENANT_ID=""
    AUTH_CLIENT_ID=""
    AUTH_REDIRECT_URI=""
fi

# Get API URL (from ALB)
print_header "Getting API URL"
ALB_STACK_NAME="isms-${ENVIRONMENT}-alb"
API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$ALB_STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNSName`].OutputValue' \
    --output text 2>/dev/null | sed 's|^|https://|' || echo "")

if [ -z "$API_URL" ]; then
    print_warning "Could not get ALB DNS name. You may need to set this manually."
    print_info "Format: https://your-domain.com (without /api)"
else
    print_info "API URL: $API_URL"
fi

# Generate summary
print_header "GitHub Secrets Summary"
echo ""
echo "Copy these values to GitHub Secrets (Settings > Secrets and variables > Actions):"
echo ""
echo -e "${YELLOW}Required Secrets:${NC}"
echo ""
echo "AWS_ROLE_ARN=$GITHUB_ROLE_ARN"
echo "AWS_REGION=$AWS_REGION"
echo "ECR_REGISTRY=$ECR_REGISTRY"
echo "STAGING_CLUSTER_NAME=$CLUSTER_NAME"
echo "STAGING_BACKEND_SERVICE=$BACKEND_SERVICE"
echo "STAGING_FRONTEND_SERVICE=$FRONTEND_SERVICE"
echo "STAGING_BACKEND_CODEDEPLOY_APP=$BACKEND_CODEDEPLOY_APP"
echo "STAGING_FRONTEND_CODEDEPLOY_APP=$FRONTEND_CODEDEPLOY_APP"
echo "STAGING_BACKEND_DEPLOYMENT_GROUP=$BACKEND_DEPLOYMENT_GROUP"
echo "STAGING_FRONTEND_DEPLOYMENT_GROUP=$FRONTEND_DEPLOYMENT_GROUP"
echo ""

if [ -n "$AUTH_TENANT_ID" ]; then
    echo -e "${YELLOW}Frontend Build Variables:${NC}"
    echo ""
    echo "VITE_AUTH_TENANT_ID=$AUTH_TENANT_ID"
    echo "VITE_AUTH_CLIENT_ID=$AUTH_CLIENT_ID"
    echo "STAGING_VITE_API_URL=$API_URL"
    echo "STAGING_VITE_AUTH_REDIRECT_URI=$AUTH_REDIRECT_URI"
    echo ""
fi

echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "1. Ensure OIDC provider is set up (will be created automatically when deploying IAM roles)"
echo "2. Deploy/update IAM roles stack with GitHub org/repo:"
echo "   aws cloudformation deploy \\"
echo "     --template-file infrastructure/templates/iam-roles.yaml \\"
echo "     --stack-name $IAM_STACK_NAME \\"
echo "     --parameter-overrides \\"
echo "       Environment=$ENVIRONMENT \\"
echo "       GitHubOrg=$GITHUB_ORG \\"
echo "       GitHubRepo=$GITHUB_REPO_NAME \\"
echo "     --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \\"
echo "     --region $AWS_REGION \\"
echo "     --profile $AWS_PROFILE"
echo ""
echo "3. Add the secrets above to GitHub (Settings > Secrets and variables > Actions)"
echo "4. Test the workflow by pushing to main branch or using workflow_dispatch"
echo ""

