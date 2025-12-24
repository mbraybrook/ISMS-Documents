#!/bin/bash
# ISMS Deployment Utilities
# Multi-purpose utility script for common deployment and troubleshooting tasks
#
# Usage: ./deploy-utils.sh <command> [options]
#
# Commands:
#   build-frontend          Build and push frontend image
#   build-backend           Build and push backend image
#   build-document-service  Build and push document-service image
#   build-ai-service        Build and push ai-service image
#   rebuild-frontend        Rebuild frontend with secrets from Secrets Manager
#   deploy-frontend          Deploy frontend using CodeDeploy
#   deploy-backend           Deploy backend using CodeDeploy
#   update-service           Update ECS service with new image (fallback, no CodeDeploy)
#   get-stack-outputs        Get CloudFormation stack outputs
#   monitor-deployment       Monitor CodeDeploy deployment status
#   check-health             Check target group health
#   view-logs                Tail CloudWatch logs
#
# Options:
#   --environment, -e       Environment (default: staging)
#   --profile, -p            AWS profile (default: pt-sandbox)
#   --region, -r             AWS region (default: eu-west-2)
#   --image-tag, -t          Docker image tag (default: staging)
#   --help, -h               Show this help message
#
# Examples:
#   ./deploy-utils.sh rebuild-frontend
#   ./deploy-utils.sh deploy-frontend --environment staging
#   ./deploy-utils.sh build-backend --image-tag v1.2.3
#   ./deploy-utils.sh monitor-deployment --deployment-id d-1234567890
#   ./deploy-utils.sh check-health --service frontend

set -euo pipefail

# Check if colors should be enabled
if [[ -t 1 ]] && [[ "${NO_COLOR:-}" == "" ]]; then
    USE_COLORS=true
else
    USE_COLORS=false
fi

# Colors for output
if [[ "$USE_COLORS" == "true" ]]; then
    readonly RED='\033[0;31m'
    readonly GREEN='\033[0;32m'
    readonly YELLOW='\033[1;33m'
    readonly BLUE='\033[0;34m'
    readonly MAGENTA='\033[0;35m'
    readonly CYAN='\033[0;36m'
    readonly BOLD='\033[1m'
    readonly NC='\033[0m' # No Color
else
    readonly RED=''
    readonly GREEN=''
    readonly YELLOW=''
    readonly BLUE=''
    readonly MAGENTA=''
    readonly CYAN=''
    readonly BOLD=''
    readonly NC=''
fi

# Default values (used if environment variables are not set)
# These defaults mean you don't need to export AWS_PROFILE/AWS_REGION before running the script
ENVIRONMENT="${ENVIRONMENT:-staging}"
# Default to pt-sandbox profile (can be overridden via --profile flag or AWS_PROFILE env var)
AWS_PROFILE="${AWS_PROFILE:-pt-sandbox}"
AWS_REGION="${AWS_REGION:-eu-west-2}"
IMAGE_TAG="${IMAGE_TAG:-staging}"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$INFRA_DIR/.." && pwd)"

# Helper functions
print_header() {
    echo ""
    echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}  $1${NC}"
    echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}" >&2
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_step() {
    echo -e "${MAGENTA}📋 $1${NC}"
}

# Parse command line arguments
parse_args() {
    # Check for help flag first
    for arg in "$@"; do
        if [[ "$arg" == "--help" ]] || [[ "$arg" == "-h" ]]; then
            show_help
            exit 0
        fi
    done
    
    COMMAND="${1:-}"
    shift || true
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment|-e)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --profile|-p)
                AWS_PROFILE="$2"
                shift 2
                ;;
            --region|-r)
                AWS_REGION="$2"
                shift 2
                ;;
            --image-tag|-t)
                IMAGE_TAG="$2"
                shift 2
                ;;
            --deployment-id|-d)
                DEPLOYMENT_ID="$2"
                shift 2
                ;;
            --service|-s)
                # Support multiple services by appending to array
                if [ -z "${SERVICE_TYPES:-}" ]; then
                    SERVICE_TYPES=()
                fi
                SERVICE_TYPES+=("$2")
                SERVICE_TYPE="$2"  # Keep for backward compatibility
                shift 2
                ;;
            --follow)
                FOLLOW_LOGS="true"
                shift
                ;;
            --no-follow)
                FOLLOW_LOGS="false"
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    printf '%b\n' \
        "${BOLD}${CYAN}ISMS Deployment Utilities${NC}" \
        "" \
        "${BOLD}Usage:${NC}" \
        "    ./deploy-utils.sh <command> [options]" \
        "" \
        "${BOLD}Commands:${NC}" \
        "    ${GREEN}build-frontend${NC}          Build and push frontend Docker image" \
        "    ${GREEN}build-backend${NC}           Build and push backend Docker image" \
        "    ${GREEN}build-document-service${NC}  Build and push document-service Docker image" \
        "    ${GREEN}build-ai-service${NC}        Build and push ai-service Docker image" \
        "    ${GREEN}build-all-images${NC}        Build and push all service images (backend, frontend, document-service, ai-service)" \
        "    ${GREEN}rebuild-frontend${NC}         Rebuild frontend with secrets from Secrets Manager" \
        "    ${GREEN}deploy-frontend${NC}          Deploy frontend using CodeDeploy (blue/green)" \
        "    ${GREEN}deploy-backend${NC}           Deploy backend using CodeDeploy (blue/green)" \
        "    ${GREEN}deploy-document-service${NC}  Deploy document-service (direct ECS update, auto-creates stack if needed)" \
        "    ${GREEN}deploy-ai-service${NC}       Deploy ai-service (direct ECS update, auto-creates stack if needed)" \
        "    ${GREEN}deploy-document-service-stack${NC}  Deploy document-service CloudFormation stack (initial setup)" \
        "    ${GREEN}deploy-ai-service-stack${NC} Deploy ai-service CloudFormation stack (initial setup)" \
        "    ${GREEN}update-service${NC}           Update ECS service directly (fallback, no CodeDeploy)" \
        "    ${GREEN}get-stack-outputs${NC}        Get CloudFormation stack outputs" \
        "    ${GREEN}get-deployment-vars${NC}      Get all deployment variables as export statements" \
        "    ${GREEN}verify-ecs-role${NC}         Verify/create ECS service-linked role" \
        "    ${GREEN}monitor-deployment${NC}       Monitor CodeDeploy deployment status" \
        "    ${GREEN}check-health${NC}             Check target group health" \
        "    ${GREEN}view-logs${NC}                Tail CloudWatch logs" \
        "" \
        "${BOLD}Options:${NC}" \
        "    ${YELLOW}--environment, -e${NC}       Environment name (default: staging)" \
        "    ${YELLOW}--profile, -p${NC}            AWS profile (default: pt-sandbox)" \
        "    ${YELLOW}--region, -r${NC}             AWS region (default: eu-west-2)" \
        "    ${YELLOW}--image-tag, -t${NC}          Docker image tag (default: staging)" \
        "" \
        "${BOLD}Note:${NC} Default values are automatically used if environment variables are not set." \
        "You don't need to export AWS_PROFILE or AWS_REGION before running the script." \
        "    ${YELLOW}--deployment-id, -d${NC}      CodeDeploy deployment ID (for monitor-deployment)" \
        "    ${YELLOW}--service, -s${NC}             Service type (can be used multiple times for view-logs):" \
        "                          frontend, backend, document-service, ai-service, or all" \
        "    ${YELLOW}--help, -h${NC}               Show this help message" \
        "" \
        "${BOLD}Examples:${NC}" \
        "    ${CYAN}# Rebuild frontend with secrets from Secrets Manager${NC}" \
        "    ./deploy-utils.sh rebuild-frontend" \
        "" \
        "    ${CYAN}# Build and push all images${NC}" \
        "    ./deploy-utils.sh build-all-images" \
        "" \
        "    ${CYAN}# Deploy frontend using CodeDeploy${NC}" \
        "    ./deploy-utils.sh deploy-frontend --environment staging" \
        "" \
        "    ${CYAN}# Deploy backend using CodeDeploy${NC}" \
        "    ./deploy-utils.sh deploy-backend --environment staging" \
        "" \
        "    ${CYAN}# Deploy microservices (auto-creates CloudFormation stack if needed)${NC}" \
        "    ./deploy-utils.sh deploy-document-service --image-tag staging" \
        "    ./deploy-utils.sh deploy-ai-service --image-tag staging" \
        "" \
        "    ${CYAN}# Deploy microservice CloudFormation stacks manually (if needed)${NC}" \
        "    ./deploy-utils.sh deploy-document-service-stack --image-tag staging" \
        "    ./deploy-utils.sh deploy-ai-service-stack --image-tag staging" \
        "" \
        "    ${CYAN}# Build backend with specific tag${NC}" \
        "    ./deploy-utils.sh build-backend --image-tag v1.2.3" \
        "" \
        "    ${CYAN}# Build microservices${NC}" \
        "    ./deploy-utils.sh build-document-service --image-tag staging" \
        "    ./deploy-utils.sh build-ai-service --image-tag staging" \
        "" \
        "    ${CYAN}# Get deployment variables${NC}" \
        "    eval \$(./deploy-utils.sh get-deployment-vars)" \
        "" \
        "    ${CYAN}# Verify ECS service-linked role${NC}" \
        "    ./deploy-utils.sh verify-ecs-role" \
        "" \
        "    ${CYAN}# Monitor a specific CodeDeploy deployment${NC}" \
        "    ./deploy-utils.sh monitor-deployment --deployment-id d-1234567890" \
        "" \
        "    ${CYAN}# Monitor active deployment for a service (auto-discovers)${NC}" \
        "    ./deploy-utils.sh monitor-deployment --service backend" \
        "" \
        "    ${CYAN}# Monitor any active deployment (auto-discovers)${NC}" \
        "    ./deploy-utils.sh monitor-deployment" \
        "" \
        "    ${CYAN}# Check target group health${NC}" \
        "    ./deploy-utils.sh check-health --service frontend" \
        "" \
        "    ${CYAN}# View logs for a single service${NC}" \
        "    ./deploy-utils.sh view-logs --service backend --follow" \
        "" \
        "    ${CYAN}# View logs for multiple services${NC}" \
        "    ./deploy-utils.sh view-logs --service backend --service frontend --follow" \
        "" \
        "    ${CYAN}# View logs for all services${NC}" \
        "    ./deploy-utils.sh view-logs --service all --follow"
}

# Get CloudFormation stack outputs
get_stack_output() {
    local stack_name="$1"
    local output_key="$2"
    
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query "Stacks[0].Outputs[?OutputKey==\`$output_key\`].OutputValue" \
        --output text \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" 2>/dev/null || echo ""
}

# Get ECR repository URI
get_ecr_repo() {
    local service="$1"
    local repo_key="${service^}RepositoryUri"  # Capitalize first letter
    
    get_stack_output "isms-${ENVIRONMENT}-ecr" "$repo_key"
}

# Extract registry domain from repository URI
get_registry_domain() {
    local repo_uri="$1"
    # Extract registry domain (everything before the first /)
    echo "$repo_uri" | cut -d'/' -f1
}

# Login to ECR
ecr_login() {
    local repo_uri="$1"
    local registry_domain=$(get_registry_domain "$repo_uri")
    
    if [ -z "$registry_domain" ]; then
        print_error "Could not extract registry domain from: $repo_uri"
        return 1
    fi
    
    print_step "Logging in to ECR registry: $registry_domain..."
    aws ecr get-login-password --region "$AWS_REGION" --profile "$AWS_PROFILE" | \
        docker login --username AWS --password-stdin "$registry_domain" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "ECR login successful"
    else
        print_error "ECR login failed"
        return 1
    fi
}

# Increment version number (semver patch version)
increment_version() {
    local version_file="$PROJECT_ROOT/frontend/VERSION"
    
    if [ ! -f "$version_file" ]; then
        print_error "VERSION file not found at $version_file"
        exit 1
    fi
    
    local current_version=$(cat "$version_file" | tr -d '[:space:]')
    
    # Parse semver (major.minor.patch)
    local major=$(echo "$current_version" | cut -d. -f1)
    local minor=$(echo "$current_version" | cut -d. -f2)
    local patch=$(echo "$current_version" | cut -d. -f3)
    
    # Increment patch version
    patch=$((patch + 1))
    
    local new_version="${major}.${minor}.${patch}"
    
    # Write new version back to file
    echo "$new_version" > "$version_file"
    
    print_success "Version incremented: $current_version -> $new_version"
    echo "$new_version"
}

# Get current version
get_version() {
    local version_file="$PROJECT_ROOT/frontend/VERSION"
    
    if [ ! -f "$version_file" ]; then
        print_warning "VERSION file not found, using 'dev'"
        echo "dev"
        return
    fi
    
    cat "$version_file" | tr -d '[:space:]'
}

# Build and push frontend image
build_frontend() {
    print_header "Building Frontend Image"
    
    local repo_uri=$(get_ecr_repo "frontend")
    if [ -z "$repo_uri" ] || [ "$repo_uri" == "None" ]; then
        print_error "Could not get frontend repository URI"
        echo ""
        print_info "Troubleshooting:"
        echo "  1. Ensure AWS credentials are configured:"
        echo "     export AWS_PROFILE=pt-sandbox"
        echo "     export AWS_REGION=eu-west-2"
        echo ""
        echo "  2. Verify the ECR CloudFormation stack exists:"
        echo "     aws cloudformation describe-stacks --stack-name isms-${ENVIRONMENT}-ecr --profile ${AWS_PROFILE} --region ${AWS_REGION}"
        echo ""
        echo "  3. If the stack doesn't exist, deploy it first (see DEPLOYMENT.md):"
        echo "     aws cloudformation deploy --template-file templates/ecr.yaml --stack-name isms-${ENVIRONMENT}-ecr --parameter-overrides Environment=${ENVIRONMENT} --region ${AWS_REGION} --profile ${AWS_PROFILE}"
        exit 1
    fi
    
    # Get version for build
    local app_version=$(get_version)
    
    print_info "Repository: $repo_uri"
    print_info "Tag: $IMAGE_TAG"
    print_info "Version: $app_version"
    print_info "Platform: linux/arm64"
    echo ""
    
    ecr_login "$repo_uri"
    
    print_step "Building frontend image..."
    cd "$PROJECT_ROOT"
    
    docker buildx build --platform linux/arm64 \
        -f ./frontend/Dockerfile.prod \
        --build-arg VITE_API_URL="https://trust.demo.paythru.com" \
        --build-arg VITE_AUTH_TENANT_ID="${VITE_AUTH_TENANT_ID:-your-tenant-id}" \
        --build-arg VITE_AUTH_CLIENT_ID="${VITE_AUTH_CLIENT_ID:-your-client-id}" \
        --build-arg VITE_AUTH_REDIRECT_URI="${VITE_AUTH_REDIRECT_URI:-https://trust.demo.paythru.com}" \
        --build-arg VITE_APP_VERSION="$app_version" \
        -t "${repo_uri}:${IMAGE_TAG}" \
        ./frontend \
        --push
    
    print_success "Frontend image built and pushed: ${repo_uri}:${IMAGE_TAG} (v${app_version})"
    return 0
}

# Build and push backend image
build_backend() {
    print_header "Building Backend Image"
    
    local repo_uri=$(get_ecr_repo "backend")
    if [ -z "$repo_uri" ] || [ "$repo_uri" == "None" ]; then
        print_error "Could not get backend repository URI"
        echo ""
        print_info "Troubleshooting:"
        echo "  1. Ensure AWS credentials are configured:"
        echo "     export AWS_PROFILE=pt-sandbox"
        echo "     export AWS_REGION=eu-west-2"
        echo ""
        echo "  2. Verify the ECR CloudFormation stack exists:"
        echo "     aws cloudformation describe-stacks --stack-name isms-${ENVIRONMENT}-ecr --profile ${AWS_PROFILE} --region ${AWS_REGION}"
        echo ""
        echo "  3. If the stack doesn't exist, deploy it first (see DEPLOYMENT.md):"
        echo "     aws cloudformation deploy --template-file templates/ecr.yaml --stack-name isms-${ENVIRONMENT}-ecr --parameter-overrides Environment=${ENVIRONMENT} --region ${AWS_REGION} --profile ${AWS_PROFILE}"
        exit 1
    fi
    
    print_info "Repository: $repo_uri"
    print_info "Tag: $IMAGE_TAG"
    print_info "Platform: linux/arm64"
    echo ""
    
    ecr_login "$repo_uri"
    
    print_step "Building backend image..."
    cd "$PROJECT_ROOT"
    
    docker buildx build --platform linux/arm64 \
        -f ./backend/Dockerfile.prod \
        -t "${repo_uri}:${IMAGE_TAG}" \
        ./backend \
        --push
    
    print_success "Backend image built and pushed: ${repo_uri}:${IMAGE_TAG}"
    return 0
}

# Build and push document-service image
build_document_service() {
    print_header "Building Document Service Image"
    
    local repo_uri=$(get_stack_output "isms-${ENVIRONMENT}-ecr" "DocumentServiceRepositoryUri")
    if [ -z "$repo_uri" ] || [ "$repo_uri" == "None" ]; then
        print_error "Could not get document-service repository URI"
        echo ""
        print_info "Troubleshooting:"
        echo "  1. Ensure AWS credentials are configured:"
        echo "     export AWS_PROFILE=pt-sandbox"
        echo "     export AWS_REGION=eu-west-2"
        echo ""
        echo "  2. Verify the ECR CloudFormation stack exists:"
        echo "     aws cloudformation describe-stacks --stack-name isms-${ENVIRONMENT}-ecr --profile ${AWS_PROFILE} --region ${AWS_REGION}"
        echo ""
        echo "  3. If the stack doesn't exist, deploy it first (see DEPLOYMENT.md):"
        echo "     aws cloudformation deploy --template-file templates/ecr.yaml --stack-name isms-${ENVIRONMENT}-ecr --parameter-overrides Environment=${ENVIRONMENT} --region ${AWS_REGION} --profile ${AWS_PROFILE}"
        exit 1
    fi
    
    print_info "Repository: $repo_uri"
    print_info "Tag: $IMAGE_TAG"
    print_info "Platform: linux/arm64"
    echo ""
    
    ecr_login "$repo_uri"
    
    print_step "Building document-service image..."
    cd "$PROJECT_ROOT"
    
    docker buildx build --platform linux/arm64 \
        -f ./services/document-service/Dockerfile \
        -t "${repo_uri}:${IMAGE_TAG}" \
        ./services/document-service \
        --push
    
    print_success "Document service image built and pushed: ${repo_uri}:${IMAGE_TAG}"
    return 0
}

# Build and push ai-service image
build_ai_service() {
    print_header "Building AI Service Image"
    
    local repo_uri=$(get_stack_output "isms-${ENVIRONMENT}-ecr" "AIServiceRepositoryUri")
    if [ -z "$repo_uri" ] || [ "$repo_uri" == "None" ]; then
        print_error "Could not get ai-service repository URI"
        echo ""
        print_info "Troubleshooting:"
        echo "  1. Ensure AWS credentials are configured:"
        echo "     export AWS_PROFILE=pt-sandbox"
        echo "     export AWS_REGION=eu-west-2"
        echo ""
        echo "  2. Verify the ECR CloudFormation stack exists:"
        echo "     aws cloudformation describe-stacks --stack-name isms-${ENVIRONMENT}-ecr --profile ${AWS_PROFILE} --region ${AWS_REGION}"
        echo ""
        echo "  3. If the stack doesn't exist, deploy it first (see DEPLOYMENT.md):"
        echo "     aws cloudformation deploy --template-file templates/ecr.yaml --stack-name isms-${ENVIRONMENT}-ecr --parameter-overrides Environment=${ENVIRONMENT} --region ${AWS_REGION} --profile ${AWS_PROFILE}"
        exit 1
    fi
    
    print_info "Repository: $repo_uri"
    print_info "Tag: $IMAGE_TAG"
    print_info "Platform: linux/arm64"
    echo ""
    
    ecr_login "$repo_uri"
    
    print_step "Building ai-service image..."
    cd "$PROJECT_ROOT"
    
    docker buildx build --platform linux/arm64 \
        -f ./services/ai-service/Dockerfile \
        -t "${repo_uri}:${IMAGE_TAG}" \
        ./services/ai-service \
        --push
    
    print_success "AI service image built and pushed: ${repo_uri}:${IMAGE_TAG}"
    return 0
}

# Rebuild frontend with secrets from Secrets Manager
rebuild_frontend() {
    print_header "Rebuilding Frontend with Secrets"
    
    print_step "Retrieving auth secrets from Secrets Manager..."
    local secrets_json=$(aws secretsmanager get-secret-value \
        --secret-id "isms-${ENVIRONMENT}-app-secrets" \
        --query 'SecretString' \
        --output text \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" 2>/dev/null)
    
    if [ -z "$secrets_json" ]; then
        print_error "Could not retrieve secrets from Secrets Manager"
        exit 1
    fi
    
    export VITE_AUTH_TENANT_ID=$(echo "$secrets_json" | jq -r '.AUTH_TENANT_ID // empty')
    export VITE_AUTH_CLIENT_ID=$(echo "$secrets_json" | jq -r '.AUTH_CLIENT_ID // empty')
    export VITE_AUTH_REDIRECT_URI=$(echo "$secrets_json" | jq -r '.AUTH_REDIRECT_URI // "https://trust.demo.paythru.com"')
    
    if [ -z "$VITE_AUTH_TENANT_ID" ] || [ -z "$VITE_AUTH_CLIENT_ID" ]; then
        print_error "AUTH_TENANT_ID or AUTH_CLIENT_ID not found in secrets"
        exit 1
    fi
    
    print_success "Retrieved auth secrets"
    print_info "Tenant ID: $VITE_AUTH_TENANT_ID"
    print_info "Client ID: $VITE_AUTH_CLIENT_ID"
    print_info "Redirect URI: $VITE_AUTH_REDIRECT_URI"
    echo ""
    
    # Increment version before building
    print_step "Incrementing version..."
    increment_version
    
    build_frontend
}

# Create CodeDeploy deployment
create_codedeploy_deployment() {
    local service="$1"  # frontend or backend
    local task_def_arn="$2"
    
    local app_name="isms-${ENVIRONMENT}-${service}-app"
    local dg_name="isms-${ENVIRONMENT}-${service}-dg"
    local container_name="$service"
    local container_port
    
    if [ "$service" == "frontend" ]; then
        container_port=80
    else
        container_port=4000
    fi
    
    print_step "Creating CodeDeploy deployment..." >&2
    
    # Create AppSpec JSON file (more reliable than command-line argument)
    local appspec_file=$(mktemp)
    jq -n \
        --arg task_def "$task_def_arn" \
        --arg container_name "$container_name" \
        --argjson container_port "$container_port" \
        '{
            "version": 0.0,
            "Resources": [{
                "TargetService": {
                    "Type": "AWS::ECS::Service",
                    "Properties": {
                        "TaskDefinition": $task_def,
                        "LoadBalancerInfo": {
                            "ContainerName": $container_name,
                            "ContainerPort": $container_port
                        }
                    }
                }
            }]
        }' > "$appspec_file"
    
    # Create deployment input JSON with AppSpec content as a JSON string
    # The content field needs the AppSpec JSON as a string (not an object)
    local deployment_input_file=$(mktemp)
    local appspec_compact=$(jq -c '.' "$appspec_file")
    jq -n \
        --arg appName "$app_name" \
        --arg dgName "$dg_name" \
        --arg appSpecContent "$appspec_compact" \
        '{
            "applicationName": $appName,
            "deploymentGroupName": $dgName,
            "revision": {
                "revisionType": "AppSpecContent",
                "appSpecContent": {
                    "content": $appSpecContent
                }
            }
        }' > "$deployment_input_file"
    
    # Clean up AppSpec file
    rm "$appspec_file"
    
    # Create deployment using file input
    print_info "Creating deployment for application: $app_name, deployment group: $dg_name" >&2
    
    local deployment_output
    deployment_output=$(aws deploy create-deployment \
        --cli-input-json file://"$deployment_input_file" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'deploymentId' \
        --output text 2>&1)
    local deploy_exit_code=$?
    
    # Debug: show what we got
    print_info "AWS CLI exit code: $deploy_exit_code" >&2
    print_info "AWS CLI output: '$deployment_output'" >&2
    
    # Clean up deployment input file
    rm "$deployment_input_file"
    
    if [ $deploy_exit_code -ne 0 ]; then
        print_error "Failed to create CodeDeploy deployment (exit code: $deploy_exit_code)" >&2
        print_info "AWS CLI error output:" >&2
        echo "$deployment_output" | head -20 >&2
        print_info "Make sure CodeDeploy is configured. You can use update-service as a fallback." >&2
        return 1
    fi
    
    if [ -z "$deployment_output" ] || [ "$deployment_output" == "None" ]; then
        print_error "Deployment creation returned empty result" >&2
        print_info "AWS CLI output: $deployment_output" >&2
        print_info "Make sure CodeDeploy is configured. You can use update-service as a fallback." >&2
        return 1
    fi
    
    local deployment_id="$deployment_output"
    
    # Print success message to stderr (so it's visible even when called with command substitution)
    print_success "CodeDeploy deployment created: $deployment_id" >&2
    echo "" >&2
    print_info "Monitor deployment:" >&2
    echo "  ./deploy-utils.sh monitor-deployment --deployment-id $deployment_id" >&2
    
    # Only output deployment ID to stdout (for command substitution)
    echo "$deployment_id"
}

# Deploy service using CodeDeploy
deploy_service() {
    local service="$1"  # frontend or backend
    
    print_header "Deploying ${service^} Service"
    
    # Get cluster and service names
    local cluster_name=$(get_stack_output "isms-${ENVIRONMENT}-ecs" "ClusterName")
    local service_name=$(get_stack_output "isms-${ENVIRONMENT}-ecs" "${service^}ServiceName")
    
    if [ -z "$cluster_name" ] || [ -z "$service_name" ]; then
        print_error "Could not get cluster or service name"
        exit 1
    fi
    
    print_info "Cluster: $cluster_name"
    print_info "Service: $service_name"
    echo ""
    
    # Get current task definition
    print_step "Getting current task definition..."
    local current_task_def=$(aws ecs describe-services \
        --cluster "$cluster_name" \
        --services "$service_name" \
        --query 'services[0].taskDefinition' \
        --output text \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION")
    
    print_info "Current task definition: $current_task_def"
    echo ""
    
    # Get repository URI
    local repo_uri=$(get_ecr_repo "$service")
    local new_image="${repo_uri}:${IMAGE_TAG}"
    
    print_info "New image: $new_image"
    echo ""
    
    # Create new task definition revision
    print_step "Creating new task definition revision..."
    
    # Get task definition JSON
    local task_def_json
    local aws_error
    task_def_json=$(aws ecs describe-task-definition \
        --task-definition "$current_task_def" \
        --query 'taskDefinition' \
        --output json \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" 2>&1)
    local aws_exit_code=$?
    
    if [ $aws_exit_code -ne 0 ]; then
        print_error "Failed to get task definition"
        print_info "AWS CLI error: $task_def_json"
        exit 1
    fi
    
    # Validate JSON before processing
    if ! echo "$task_def_json" | jq empty >/dev/null 2>&1; then
        print_error "Invalid JSON received from AWS CLI"
        print_info "Response preview: $(echo "$task_def_json" | head -c 200)"
        exit 1
    fi
    
    # Get ApplicationSecretsArn for INTERNAL_SERVICE_TOKEN secret
    local app_secret_arn=$(get_stack_output "isms-${ENVIRONMENT}-secrets" "ApplicationSecretsArn")
    
    # Update task definition with new image and ensure required environment variables and secrets are set
    local updated_task_def
    if ! updated_task_def=$(echo "$task_def_json" | jq --arg IMAGE "$new_image" \
        --arg DOC_SERVICE_URL "http://document-service.local:4001" \
        --arg AI_SERVICE_URL "http://ai-service.local:4002" \
        --arg DOC_TIMEOUT "30000" \
        --arg AI_TIMEOUT "10000" \
        --arg SECRET_ARN "${app_secret_arn}:INTERNAL_SERVICE_TOKEN::" '
        .containerDefinitions[0].image = $IMAGE |
        # Ensure environment variables exist (add if missing, update if present)
        .containerDefinitions[0].environment = (
          (.containerDefinitions[0].environment // []) |
          map(select(.name != "DOCUMENT_SERVICE_URL" and .name != "AI_SERVICE_URL" and .name != "DOCUMENT_SERVICE_TIMEOUT" and .name != "AI_SERVICE_TIMEOUT")) +
          [
            {name: "DOCUMENT_SERVICE_URL", value: $DOC_SERVICE_URL},
            {name: "AI_SERVICE_URL", value: $AI_SERVICE_URL},
            {name: "DOCUMENT_SERVICE_TIMEOUT", value: $DOC_TIMEOUT},
            {name: "AI_SERVICE_TIMEOUT", value: $AI_TIMEOUT}
          ]
        ) |
        # Ensure INTERNAL_SERVICE_TOKEN secret exists (add if missing, update if present)
        .containerDefinitions[0].secrets = (
          (.containerDefinitions[0].secrets // []) |
          map(select(.name != "INTERNAL_SERVICE_TOKEN")) +
          [
            {name: "INTERNAL_SERVICE_TOKEN", valueFrom: $SECRET_ARN}
          ]
        ) |
        del(.taskDefinitionArn) |
        del(.revision) |
        del(.status) |
        del(.requiresAttributes) |
        del(.compatibilities) |
        del(.registeredAt) |
        del(.registeredBy)
    '); then
        print_error "Failed to update task definition JSON with jq"
        exit 1
    fi
    
    # Validate updated task definition JSON before registering
    if ! echo "$updated_task_def" | jq empty >/dev/null 2>&1; then
        print_error "Invalid JSON in updated task definition"
        print_info "JSON preview: $(echo "$updated_task_def" | head -c 500)"
        exit 1
    fi
    
    if [ -z "$updated_task_def" ]; then
        print_error "Updated task definition is empty"
        exit 1
    fi
    
    # Register new task definition
    print_info "Registering new task definition..."
    
    # Temporarily disable exit on error to capture the result properly
    set +e
    local register_output
    local register_exit_code
    
    # Write task definition to temporary file for more reliable AWS CLI handling
    local task_def_file
    task_def_file=$(mktemp)
    trap "rm -f '$task_def_file'" EXIT  # Ensure cleanup on exit
    
    echo "$updated_task_def" > "$task_def_file"
    
    register_output=$(aws ecs register-task-definition \
        --cli-input-json "file://$task_def_file" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text 2>&1)
    register_exit_code=$?
    
    # Clean up temp file
    rm -f "$task_def_file"
    trap - EXIT  # Remove trap after successful cleanup
    
    set -e
    
    if [ $register_exit_code -ne 0 ]; then
        print_error "Failed to register task definition (exit code: $register_exit_code)"
        print_info "AWS CLI error output:"
        echo "$register_output" | head -50
        exit 1
    fi
    
    if [ -z "$register_output" ] || [ "$register_output" == "None" ]; then
        print_error "Task definition registration returned empty result"
        print_info "AWS CLI output: '$register_output'"
        exit 1
    fi
    
    new_task_def_arn="$register_output"
    
    print_success "New task definition created: $new_task_def_arn"
    echo ""
    
    # Create CodeDeploy deployment
    print_step "Creating CodeDeploy deployment..."
    
    # Use process substitution to separate stdout (deployment ID) from stderr (progress/errors)
    # This allows progress messages to be visible while capturing the deployment ID
    local deployment_id
    local deploy_exit_code
    
    # Create a temporary file for stderr
    local stderr_file=$(mktemp)
    
    # Temporarily disable exit on error to capture the result
    set +e
    # Run function, capture stdout to deployment_id, stderr to file
    deployment_id=$(create_codedeploy_deployment "$service" "$new_task_def_arn" 2>"$stderr_file")
    deploy_exit_code=$?
    set -e
    
    # Display stderr (progress messages and errors)
    if [ -s "$stderr_file" ]; then
        cat "$stderr_file" >&2
    fi
    rm "$stderr_file"
    
    if [ $deploy_exit_code -ne 0 ]; then
        print_error "CodeDeploy deployment failed (exit code: $deploy_exit_code)"
        echo ""
        print_info "Deployment ID received: '$deployment_id'"
        echo ""
        print_warning "Use update-service as a fallback:"
        echo "  ./deploy-utils.sh update-service --service $service"
        exit 1
    fi
    
    if [ -z "$deployment_id" ] || [ "$deployment_id" == "None" ] || ! echo "$deployment_id" | grep -q "^d-"; then
        print_error "CodeDeploy deployment returned invalid result"
        echo ""
        print_info "Deployment ID received: '$deployment_id'"
        echo ""
        print_warning "Use update-service as a fallback:"
        echo "  ./deploy-utils.sh update-service --service $service"
        exit 1
    fi
    
    echo ""
    print_success "Deployment started! CodeDeploy will perform a blue/green deployment."
    echo ""
    print_info "Deployment ID: ${BOLD}$deployment_id${NC}"
    echo ""
    print_info "Monitor this deployment with:"
    echo -e "  ${CYAN}./scripts/deploy-utils.sh monitor-deployment --deployment-id $deployment_id${NC}"
    echo ""
    print_info "Or monitor any active deployment:"
    echo -e "  ${CYAN}./scripts/deploy-utils.sh monitor-deployment --service $service${NC}"
}

# Update service directly (fallback, no CodeDeploy)
update_service() {
    local service="$1"  # frontend or backend
    
    print_header "Updating ${service^} Service (Direct Update)"
    
    print_warning "This uses ECS deployment controller (not CodeDeploy)"
    print_info "For blue/green deployments, use deploy-frontend or deploy-backend commands"
    echo ""
    
    # Get cluster and service names
    local cluster_name=$(get_stack_output "isms-${ENVIRONMENT}-ecs" "ClusterName")
    local service_name=$(get_stack_output "isms-${ENVIRONMENT}-ecs" "${service^}ServiceName")
    
    if [ -z "$cluster_name" ] || [ -z "$service_name" ]; then
        print_error "Could not get cluster or service name"
        exit 1
    fi
    
    # Get current task definition
    local current_task_def=$(aws ecs describe-services \
        --cluster "$cluster_name" \
        --services "$service_name" \
        --query 'services[0].taskDefinition' \
        --output text \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION")
    
    # Get repository URI
    local repo_uri=$(get_ecr_repo "$service")
    local new_image="${repo_uri}:${IMAGE_TAG}"
    
    print_step "Creating new task definition revision..."
    local task_def_json=$(aws ecs describe-task-definition \
        --task-definition "$current_task_def" \
        --query 'taskDefinition' \
        --output json \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" 2>&1)
    
    if [ $? -ne 0 ]; then
        print_error "Failed to get task definition: $task_def_json"
        exit 1
    fi
    
    # Validate JSON before processing
    if ! echo "$task_def_json" | jq empty 2>/dev/null; then
        print_error "Invalid JSON received from AWS CLI"
        print_info "Response: $task_def_json"
        exit 1
    fi
    
    local updated_task_def=$(echo "$task_def_json" | jq --arg IMAGE "$new_image" '
        .containerDefinitions[0].image = $IMAGE |
        del(.taskDefinitionArn) |
        del(.revision) |
        del(.status) |
        del(.requiresAttributes) |
        del(.compatibilities) |
        del(.registeredAt) |
        del(.registeredBy)
    ')
    
    if [ $? -ne 0 ]; then
        print_error "Failed to update task definition JSON"
        exit 1
    fi
    
    local new_task_def_arn=$(echo "$updated_task_def" | aws ecs register-task-definition \
        --cli-input-json file:///dev/stdin \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text 2>&1)
    
    if [ $? -ne 0 ] || [ -z "$new_task_def_arn" ] || [ "$new_task_def_arn" == "None" ]; then
        print_error "Failed to register task definition: $new_task_def_arn"
        exit 1
    fi
    
    print_step "Updating service..."
    aws ecs update-service \
        --cluster "$cluster_name" \
        --service "$service_name" \
        --task-definition "$new_task_def_arn" \
        --force-new-deployment \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" > /dev/null
    
    print_success "Service updated! New deployment started."
    print_info "Monitor: aws ecs describe-services --cluster $cluster_name --services $service_name --profile $AWS_PROFILE --region $AWS_REGION"
}

# Deploy microservice CloudFormation stack (initial setup)
deploy_microservice_stack() {
    local service="$1"  # document-service or ai-service
    
    print_header "Deploying ${service^} CloudFormation Stack"
    
    # Get required parameters
    print_step "Gathering required parameters..."
    
    local cluster_name=$(get_stack_output "isms-${ENVIRONMENT}-ecs" "ClusterName")
    local vpc_id=$(get_stack_output "isms-${ENVIRONMENT}-vpc" "VpcId")
    local priv_subnet_1=$(get_stack_output "isms-${ENVIRONMENT}-vpc" "PrivateSubnet1Id")
    local priv_subnet_2=$(get_stack_output "isms-${ENVIRONMENT}-vpc" "PrivateSubnet2Id")
    local ecs_sg_id=$(get_stack_output "isms-${ENVIRONMENT}-sg" "ECSSecurityGroupId")
    local task_exec_role=$(get_stack_output "isms-${ENVIRONMENT}-iam" "ECSTaskExecutionRoleArn")
    local task_role=$(get_stack_output "isms-${ENVIRONMENT}-iam" "ECSTaskRoleArn")
    local app_secret_arn=$(get_stack_output "isms-${ENVIRONMENT}-secrets" "ApplicationSecretsArn")
    
    # Get repository URI
    local repo_key
    if [ "$service" == "document-service" ]; then
        repo_key="DocumentServiceRepositoryUri"
    elif [ "$service" == "ai-service" ]; then
        repo_key="AIServiceRepositoryUri"
    else
        print_error "Unknown service: $service"
        exit 1
    fi
    
    local repo_uri=$(get_stack_output "isms-${ENVIRONMENT}-ecr" "$repo_key")
    
    if [ -z "$cluster_name" ] || [ -z "$vpc_id" ] || [ -z "$repo_uri" ] || [ "$repo_uri" == "None" ]; then
        print_error "Could not get required parameters"
        print_info "Ensure all prerequisite stacks are deployed:"
        echo "  - isms-${ENVIRONMENT}-ecs (cluster)"
        echo "  - isms-${ENVIRONMENT}-vpc (VPC and subnets)"
        echo "  - isms-${ENVIRONMENT}-sg (security groups)"
        echo "  - isms-${ENVIRONMENT}-iam (IAM roles)"
        echo "  - isms-${ENVIRONMENT}-secrets (secrets)"
        echo "  - isms-${ENVIRONMENT}-ecr (ECR repositories)"
        exit 1
    fi
    
    print_info "Cluster: $cluster_name"
    print_info "Repository: $repo_uri"
    echo ""
    
    print_step "Deploying CloudFormation stack..."
    cd "$INFRA_DIR"
    
    # Build parameter overrides array
    local param_args=(
        "Environment=${ENVIRONMENT}"
        "ClusterName=${cluster_name}"
        "VpcId=${vpc_id}"
        "PrivateSubnet1Id=${priv_subnet_1}"
        "PrivateSubnet2Id=${priv_subnet_2}"
        "ECSSecurityGroupId=${ecs_sg_id}"
        "ECSTaskExecutionRoleArn=${task_exec_role}"
        "ECSTaskRoleArn=${task_role}"
    )
    
    if [ "$service" == "document-service" ]; then
        param_args+=(
            "DocumentServiceRepositoryUri=${repo_uri}"
            "DocumentServiceImageTag=${IMAGE_TAG}"
            "ApplicationSecretsArn=${app_secret_arn}"
            "MinTaskCount=1"
            "MaxTaskCount=2"
            "CpuUnits=1024"
            "MemoryMB=2048"
        )
    elif [ "$service" == "ai-service" ]; then
        param_args+=(
            "AIServiceRepositoryUri=${repo_uri}"
            "AIServiceImageTag=${IMAGE_TAG}"
            "ApplicationSecretsArn=${app_secret_arn}"
            "OllamaEndpoint=http://ollama:11434"
            "OllamaModel=nomic-embed-text"
            "MinTaskCount=1"
            "MaxTaskCount=2"
            "CpuUnits=512"
            "MemoryMB=1024"
        )
    fi
    
    aws cloudformation deploy \
        --template-file "templates/${service}-ecs.yaml" \
        --stack-name "isms-${ENVIRONMENT}-${service}" \
        --parameter-overrides "${param_args[@]}" \
        --capabilities CAPABILITY_IAM \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" 2>&1 | tee /tmp/cf-deploy.log
    
    if grep -q "Successfully created/updated stack\|No changes to deploy" /tmp/cf-deploy.log; then
        print_success "CloudFormation stack deployed successfully"
        echo ""
        print_info "Service will start automatically. Monitor with:"
        echo "  aws ecs describe-services --cluster $cluster_name --services isms-${ENVIRONMENT}-${service} --profile $AWS_PROFILE --region $AWS_REGION"
    else
        print_error "CloudFormation deployment failed"
        print_info "Check the output above for details"
        exit 1
    fi
}

# Deploy microservice (document-service or ai-service) - uses direct ECS update (no CodeDeploy)
deploy_microservice() {
    local service="$1"  # document-service or ai-service
    
    print_header "Deploying ${service^} Service"
    
    print_info "Microservices use direct ECS updates (not CodeDeploy blue/green)"
    echo ""
    
    # Get cluster name
    local cluster_name=$(get_stack_output "isms-${ENVIRONMENT}-ecs" "ClusterName")
    local service_name="isms-${ENVIRONMENT}-${service}"
    
    if [ -z "$cluster_name" ]; then
        print_error "Could not get cluster name"
        exit 1
    fi
    
    print_info "Cluster: $cluster_name"
    print_info "Service: $service_name"
    echo ""
    
    # Check if service exists, if not, deploy the stack first
    print_step "Checking if service exists..."
    local service_exists=$(aws ecs describe-services \
        --cluster "$cluster_name" \
        --services "$service_name" \
        --query 'services[0].status' \
        --output text \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" 2>/dev/null || echo "MISSING")
    
    if [ "$service_exists" == "MISSING" ] || [ "$service_exists" == "None" ] || [ -z "$service_exists" ]; then
        print_warning "Service does not exist. Deploying CloudFormation stack first..."
        echo ""
        deploy_microservice_stack "$service"
        echo ""
        print_info "Waiting for service to be created..."
        sleep 5
    fi
    
    # Get current task definition
    print_step "Getting current task definition..."
    local current_task_def=$(aws ecs describe-services \
        --cluster "$cluster_name" \
        --services "$service_name" \
        --query 'services[0].taskDefinition' \
        --output text \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" 2>&1)
    
    if [ $? -ne 0 ] || [ -z "$current_task_def" ] || [ "$current_task_def" == "None" ]; then
        print_error "Could not get current task definition"
        print_info "Service may still be initializing. Try again in a few moments."
        exit 1
    fi
    
    print_info "Current task definition: $current_task_def"
    echo ""
    
    # Get repository URI
    local repo_key="${service^}RepositoryUri"
    # Handle camelCase conversion: document-service -> DocumentService, ai-service -> AIService
    if [ "$service" == "document-service" ]; then
        repo_key="DocumentServiceRepositoryUri"
    elif [ "$service" == "ai-service" ]; then
        repo_key="AIServiceRepositoryUri"
    fi
    
    local repo_uri=$(get_stack_output "isms-${ENVIRONMENT}-ecr" "$repo_key")
    local new_image="${repo_uri}:${IMAGE_TAG}"
    
    if [ -z "$repo_uri" ] || [ "$repo_uri" == "None" ]; then
        print_error "Could not get ${service} repository URI"
        exit 1
    fi
    
    print_info "New image: $new_image"
    echo ""
    
    # Create new task definition revision
    print_step "Creating new task definition revision..."
    
    local task_def_json=$(aws ecs describe-task-definition \
        --task-definition "$current_task_def" \
        --query 'taskDefinition' \
        --output json \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" 2>&1)
    
    if [ $? -ne 0 ]; then
        print_error "Failed to get task definition: $task_def_json"
        exit 1
    fi
    
    # Validate JSON before processing
    if ! echo "$task_def_json" | jq empty >/dev/null 2>&1; then
        print_error "Invalid JSON received from AWS CLI"
        print_info "Response preview: $(echo "$task_def_json" | head -c 200)"
        exit 1
    fi
    
    # Update task definition with new image
    local updated_task_def
    if ! updated_task_def=$(echo "$task_def_json" | jq --arg IMAGE "$new_image" '
        .containerDefinitions[0].image = $IMAGE |
        del(.taskDefinitionArn) |
        del(.revision) |
        del(.status) |
        del(.requiresAttributes) |
        del(.compatibilities) |
        del(.registeredAt) |
        del(.registeredBy)
    '); then
        print_error "Failed to update task definition JSON with jq"
        exit 1
    fi
    
    # Register new task definition
    print_info "Registering new task definition..."
    
    local task_def_file=$(mktemp)
    trap "rm -f '$task_def_file'" EXIT
    
    echo "$updated_task_def" > "$task_def_file"
    
    local new_task_def_arn=$(aws ecs register-task-definition \
        --cli-input-json "file://$task_def_file" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text 2>&1)
    
    rm -f "$task_def_file"
    trap - EXIT
    
    if [ $? -ne 0 ] || [ -z "$new_task_def_arn" ] || [ "$new_task_def_arn" == "None" ]; then
        print_error "Failed to register task definition: $new_task_def_arn"
        exit 1
    fi
    
    print_success "New task definition created: $new_task_def_arn"
    echo ""
    
    # Update service
    print_step "Updating service..."
    aws ecs update-service \
        --cluster "$cluster_name" \
        --service "$service_name" \
        --task-definition "$new_task_def_arn" \
        --force-new-deployment \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" > /dev/null
    
    if [ $? -eq 0 ]; then
        print_success "Service updated! New deployment started."
        echo ""
        print_info "Monitor deployment:"
        echo "  aws ecs describe-services --cluster $cluster_name --services $service_name --profile $AWS_PROFILE --region $AWS_REGION"
        echo ""
        print_info "View logs:"
        echo "  ./deploy-utils.sh view-logs --service ${service}"
    else
        print_error "Failed to update service"
        exit 1
    fi
}

# Find active CodeDeploy deployments
find_active_deployments() {
    local service="${SERVICE_TYPE:-}"
    
    if [ -z "$service" ]; then
        # Search all services for this environment
        local apps=("isms-${ENVIRONMENT}-backend-app" "isms-${ENVIRONMENT}-frontend-app")
    else
        local apps=("isms-${ENVIRONMENT}-${service}-app")
    fi
    
    local deployments=()
    
    for app_name in "${apps[@]}"; do
        # Print to stderr so it doesn't get captured in command substitution
        print_step "Checking deployments for $app_name..." >&2
        
        # Get deployment groups for this application
        local dg_names=$(aws deploy list-deployment-groups \
            --application-name "$app_name" \
            --profile "$AWS_PROFILE" \
            --region "$AWS_REGION" \
            --query 'deploymentGroups[]' \
            --output text 2>/dev/null || echo "")
        
        if [ -z "$dg_names" ]; then
            continue
        fi
        
        # Check each deployment group for active deployments
        for dg_name in $dg_names; do
            local active_deployments=$(aws deploy list-deployments \
                --application-name "$app_name" \
                --deployment-group-name "$dg_name" \
                --include-only-statuses Created Queued InProgress Ready \
                --profile "$AWS_PROFILE" \
                --region "$AWS_REGION" \
                --query 'deployments[]' \
                --output text 2>/dev/null || echo "")
            
            if [ -n "$active_deployments" ]; then
                for dep_id in $active_deployments; do
                    deployments+=("$dep_id")
                done
            fi
        done
    done
    
    # Return deployments (space-separated) to stdout only
    echo "${deployments[@]}"
}

# Monitor CodeDeploy deployment
monitor_deployment() {
    local deployment_id="${DEPLOYMENT_ID:-}"
    local service="${SERVICE_TYPE:-}"
    
    # If no deployment ID provided, try to find active deployments
    if [ -z "$deployment_id" ]; then
        print_info "No deployment ID provided. Searching for active deployments..."
        echo ""
        
        local active_deployments=($(find_active_deployments))
        
        if [ ${#active_deployments[@]} -eq 0 ]; then
            print_error "No active deployments found"
            echo ""
            print_info "Provide a deployment ID with --deployment-id, or specify a service with --service to search"
            exit 1
        elif [ ${#active_deployments[@]} -eq 1 ]; then
            deployment_id="${active_deployments[0]}"
            print_success "Found active deployment: $deployment_id"
            echo ""
        else
            print_warning "Found ${#active_deployments[@]} active deployments:"
            for i in "${!active_deployments[@]}"; do
                echo "  $((i+1)). ${active_deployments[$i]}"
            done
            echo ""
            print_info "Using most recent deployment: ${active_deployments[0]}"
            deployment_id="${active_deployments[0]}"
            echo ""
        fi
    fi
    
    print_header "Monitoring Deployment: $deployment_id"
    
    # Get deployment status
    local deployment_info=$(aws deploy get-deployment \
        --deployment-id "$deployment_id" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        --output json 2>&1)
    
    if [ $? -ne 0 ]; then
        print_error "Failed to get deployment information"
        print_info "AWS CLI error: $deployment_info"
        exit 1
    fi
    
    local status=$(echo "$deployment_info" | jq -r '.deploymentInfo.status // "UNKNOWN"')
    local create_time=$(echo "$deployment_info" | jq -r '.deploymentInfo.createTime // "N/A"')
    local complete_time=$(echo "$deployment_info" | jq -r '.deploymentInfo.completeTime // "N/A"')
    
    print_info "Status: $status"
    print_info "Created: $create_time"
    if [ "$complete_time" != "N/A" ] && [ "$complete_time" != "null" ]; then
        print_info "Completed: $complete_time"
    fi
    echo ""
    
    # Show deployment details
    echo "$deployment_info" | jq '{
        Status: .deploymentInfo.status,
        CreateTime: .deploymentInfo.createTime,
        CompleteTime: .deploymentInfo.completeTime,
        ApplicationName: .deploymentInfo.applicationName,
        DeploymentGroupName: .deploymentInfo.deploymentGroupName,
        DeploymentConfigName: .deploymentInfo.deploymentConfigName
    }'
    
    # If deployment is in progress, show progress
    if [ "$status" == "InProgress" ] || [ "$status" == "Ready" ]; then
        echo ""
        print_info "Deployment is in progress. Checking deployment instances..."
        echo ""
        
        local instances=$(aws deploy list-deployment-instances \
            --deployment-id "$deployment_id" \
            --profile "$AWS_PROFILE" \
            --region "$AWS_REGION" \
            --query 'instancesList[]' \
            --output json 2>/dev/null || echo "[]")
        
        if [ "$instances" != "[]" ] && [ -n "$instances" ]; then
            echo "$instances" | jq -r '.[] | "\(.instanceId // "N/A"): \(.instanceStatus // "N/A")"'
        fi
    fi
}

# Check target group health
check_health() {
    local service="${SERVICE_TYPE:-}"
    
    if [ -z "$service" ]; then
        print_error "Service type required. Use --service frontend or --service backend"
        exit 1
    fi
    
    print_header "Checking ${service^} Target Group Health"
    
    local tg_key="${service^}TargetGroupBlueArn"
    local tg_arn=$(get_stack_output "isms-${ENVIRONMENT}-alb" "$tg_key")
    
    if [ -z "$tg_arn" ] || [ "$tg_arn" == "None" ]; then
        print_error "Could not get target group ARN"
        exit 1
    fi
    
    print_info "Target Group: $tg_arn"
    echo ""
    
    aws elbv2 describe-target-health \
        --target-group-arn "$tg_arn" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        --query 'TargetHealthDescriptions[*].{Target:Target.Id,State:TargetHealth.State,Reason:TargetHealth.Reason,Description:TargetHealth.Description}' \
        --output json | jq '.'
}

# View logs
view_logs() {
    local follow="${FOLLOW_LOGS:-true}"
    local services=()
    
    # Determine which services to view
    if [ -n "${SERVICE_TYPES:-}" ] && [ ${#SERVICE_TYPES[@]} -gt 0 ]; then
        # Multiple services specified via --service flag
        services=("${SERVICE_TYPES[@]}")
    elif [ -n "${SERVICE_TYPE:-}" ]; then
        # Single service specified (backward compatibility)
        services=("$SERVICE_TYPE")
    else
        print_error "Service type required. Use --service frontend, --service backend, --service all, or multiple --service flags"
        exit 1
    fi
    
    # Handle "all" or "all-services" to view all available services
    if [ ${#services[@]} -eq 1 ] && [[ "${services[0]}" == "all" || "${services[0]}" == "all-services" ]]; then
        services=("backend" "frontend" "document-service" "ai-service")
        print_info "Viewing logs for all services: ${services[*]}"
        echo ""
    fi
    
    # Remove duplicates
    local unique_services=()
    for service in "${services[@]}"; do
        local is_duplicate=false
        for existing in "${unique_services[@]}"; do
            if [ "$service" == "$existing" ]; then
                is_duplicate=true
                break
            fi
        done
        if [ "$is_duplicate" == "false" ]; then
            unique_services+=("$service")
        fi
    done
    services=("${unique_services[@]}")
    
    # Build log groups
    local log_groups=()
    for service in "${services[@]}"; do
        log_groups+=("/ecs/isms-${ENVIRONMENT}-${service}")
    done
    
    if [ ${#log_groups[@]} -eq 0 ]; then
        print_error "No valid services specified"
        exit 1
    fi
    
    # Single service - use simple tail with formatting
    if [ ${#log_groups[@]} -eq 1 ]; then
        print_header "Viewing Logs: ${log_groups[0]}"
        if [ "$follow" == "true" ]; then
            print_info "Press Ctrl+C to stop"
        fi
        echo ""
        
        local service_name="${services[0]}"
        if [ "$follow" == "true" ]; then
            aws logs tail "${log_groups[0]}" \
                --follow \
                --profile "$AWS_PROFILE" \
                --region "$AWS_REGION" 2>/dev/null | \
                while IFS= read -r line; do
                    echo "$line" | awk -v service="$service_name" '
                    {
                        timestamp = $1
                        gsub(/.*T/, "", timestamp)
                        gsub(/\..*/, "", timestamp)
                        message = ""
                        for (i = 3; i <= NF; i++) {
                            if (message != "") message = message " "
                            message = message $i
                        }
                        printf "[%s] %s %s\n", service, timestamp, message
                    }'
                done
        else
            aws logs tail "${log_groups[0]}" \
                --profile "$AWS_PROFILE" \
                --region "$AWS_REGION" 2>/dev/null | \
                while IFS= read -r line; do
                    echo "$line" | awk -v service="$service_name" '
                    {
                        timestamp = $1
                        gsub(/.*T/, "", timestamp)
                        gsub(/\..*/, "", timestamp)
                        message = ""
                        for (i = 3; i <= NF; i++) {
                            if (message != "") message = message " "
                            message = message $i
                        }
                        printf "[%s] %s %s\n", service, timestamp, message
                    }'
                done
        fi
        return 0
    fi
    
    # Multiple services - use parallel tail with service name prefixes
    print_header "Viewing Logs: ${#log_groups[@]} Services"
    print_info "Services: ${services[*]}"
    if [ "$follow" == "true" ]; then
        print_info "Press Ctrl+C to stop"
    fi
    echo ""
    
    # Run tail commands
    if [ "$follow" == "true" ]; then
        # For follow mode, run all tails in background with prefixes
        local pids=()
        for i in "${!log_groups[@]}"; do
            (
                local service_name="${services[$i]}"
                aws logs tail "${log_groups[$i]}" \
                    --follow \
                    --profile "$AWS_PROFILE" \
                    --region "$AWS_REGION" 2>/dev/null | \
                    while IFS= read -r line; do
                        echo "$line" | awk -v service="$service_name" '
                        {
                            timestamp = $1
                            gsub(/.*T/, "", timestamp)
                            gsub(/\..*/, "", timestamp)
                            message = ""
                            for (i = 3; i <= NF; i++) {
                                if (message != "") message = message " "
                                message = message $i
                            }
                            printf "[%s] %s %s\n", service, timestamp, message
                        }'
                    done
            ) &
            pids+=($!)
        done
        
        # Set up trap to kill background processes on exit
        trap "kill ${pids[*]} 2>/dev/null; exit" INT TERM
        
        # Wait for all background processes
        wait "${pids[@]}"
        trap - INT TERM
    else
        # For non-follow mode, run sequentially with prefixes
        for i in "${!log_groups[@]}"; do
            print_info "=== ${services[$i]} ==="
            local service_name="${services[$i]}"
            # Suppress stderr for cleaner output (log group might not exist)
            aws logs tail "${log_groups[$i]}" \
                --profile "$AWS_PROFILE" \
                --region "$AWS_REGION" 2>/dev/null | \
                while IFS= read -r line; do
                    echo "$line" | awk -v service="$service_name" '
                    {
                        timestamp = $1
                        gsub(/.*T/, "", timestamp)
                        gsub(/\..*/, "", timestamp)
                        message = ""
                        for (i = 3; i <= NF; i++) {
                            if (message != "") message = message " "
                            message = message $i
                        }
                        printf "[%s] %s %s\n", service, timestamp, message
                    }'
                done
            echo ""
        done
    fi
}

# Get stack outputs
get_stack_outputs() {
    local stack_name="${1:-isms-${ENVIRONMENT}-ecs}"
    
    print_header "Stack Outputs: $stack_name"
    
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
        --output table
}

# Build and push all images (backend, frontend, document-service, ai-service)
build_all_images() {
    print_header "Building All Images"
    
    print_step "This will build and push all service images to ECR"
    echo ""
    
    # Build backend
    if ! build_backend; then
        print_error "Backend build failed"
        return 1
    fi
    echo ""
    
    # Build frontend (with secrets)
    if ! rebuild_frontend; then
        print_error "Frontend build failed"
        return 1
    fi
    echo ""
    
    # Build document-service
    if ! build_document_service; then
        print_error "Document service build failed"
        return 1
    fi
    echo ""
    
    # Build ai-service
    if ! build_ai_service; then
        print_error "AI service build failed"
        return 1
    fi
    echo ""
    
    print_success "All images built and pushed successfully!"
    return 0
}

# Verify ECS service-linked role exists
verify_ecs_service_role() {
    print_header "Verifying ECS Service-Linked Role"
    
    if aws iam get-role --role-name AWSServiceRoleForECS --profile "$AWS_PROFILE" &>/dev/null; then
        print_success "ECS service-linked role exists"
        return 0
    else
        print_warning "ECS service-linked role does not exist"
        print_step "Creating ECS service-linked role..."
        
        if aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com --profile "$AWS_PROFILE" 2>&1; then
            print_success "ECS service-linked role created"
            return 0
        else
            print_error "Failed to create ECS service-linked role"
            return 1
        fi
    fi
}

# Get all deployment variables (for use in scripts)
get_deployment_vars() {
    print_header "Deployment Variables for ${ENVIRONMENT}"
    echo ""
    echo "# Copy and paste these into your shell:"
    echo ""
    
    # VPC outputs
    local vpc_id=$(get_stack_output "isms-${ENVIRONMENT}-vpc" "VpcId")
    local pub_subnet_1=$(get_stack_output "isms-${ENVIRONMENT}-vpc" "PublicSubnet1Id")
    local pub_subnet_2=$(get_stack_output "isms-${ENVIRONMENT}-vpc" "PublicSubnet2Id")
    local priv_subnet_1=$(get_stack_output "isms-${ENVIRONMENT}-vpc" "PrivateSubnet1Id")
    local priv_subnet_2=$(get_stack_output "isms-${ENVIRONMENT}-vpc" "PrivateSubnet2Id")
    
    # Secrets outputs
    local db_secret_arn=$(get_stack_output "isms-${ENVIRONMENT}-secrets" "DatabaseCredentialsSecretArn")
    local app_secret_arn=$(get_stack_output "isms-${ENVIRONMENT}-secrets" "ApplicationSecretsArn")
    
    # Security groups
    local alb_sg_id=$(get_stack_output "isms-${ENVIRONMENT}-sg" "ALBSecurityGroupId")
    local ecs_sg_id=$(get_stack_output "isms-${ENVIRONMENT}-sg" "ECSSecurityGroupId")
    local aurora_sg_id=$(get_stack_output "isms-${ENVIRONMENT}-sg" "AuroraSecurityGroupId")
    
    # IAM roles
    local task_exec_role=$(get_stack_output "isms-${ENVIRONMENT}-iam" "ECSTaskExecutionRoleArn")
    local task_role=$(get_stack_output "isms-${ENVIRONMENT}-iam" "ECSTaskRoleArn")
    local codedeploy_role=$(get_stack_output "isms-${ENVIRONMENT}-iam" "CodeDeployRoleArn")
    
    # ECR repositories
    local backend_repo=$(get_stack_output "isms-${ENVIRONMENT}-ecr" "BackendRepositoryUri")
    local frontend_repo=$(get_stack_output "isms-${ENVIRONMENT}-ecr" "FrontendRepositoryUri")
    local doc_service_repo=$(get_stack_output "isms-${ENVIRONMENT}-ecr" "DocumentServiceRepositoryUri")
    local ai_service_repo=$(get_stack_output "isms-${ENVIRONMENT}-ecr" "AIServiceRepositoryUri")
    
    # ALB outputs
    local backend_tg_blue=$(get_stack_output "isms-${ENVIRONMENT}-alb" "BackendTargetGroupBlueArn")
    local backend_tg_green=$(get_stack_output "isms-${ENVIRONMENT}-alb" "BackendTargetGroupGreenArn")
    local frontend_tg_blue=$(get_stack_output "isms-${ENVIRONMENT}-alb" "FrontendTargetGroupBlueArn")
    local frontend_tg_green=$(get_stack_output "isms-${ENVIRONMENT}-alb" "FrontendTargetGroupGreenArn")
    local listener_arn=$(get_stack_output "isms-${ENVIRONMENT}-alb" "LoadBalancerListenerArn")
    
    # ECS outputs
    local cluster_name=$(get_stack_output "isms-${ENVIRONMENT}-ecs" "ClusterName")
    local backend_service=$(get_stack_output "isms-${ENVIRONMENT}-ecs" "BackendServiceName")
    local frontend_service=$(get_stack_output "isms-${ENVIRONMENT}-ecs" "FrontendServiceName")
    
    # Print export statements
    [ -n "$vpc_id" ] && echo "export VPC_ID=\"$vpc_id\""
    [ -n "$pub_subnet_1" ] && echo "export PUB_SUBNET_1=\"$pub_subnet_1\""
    [ -n "$pub_subnet_2" ] && echo "export PUB_SUBNET_2=\"$pub_subnet_2\""
    [ -n "$priv_subnet_1" ] && echo "export PRIV_SUBNET_1=\"$priv_subnet_1\""
    [ -n "$priv_subnet_2" ] && echo "export PRIV_SUBNET_2=\"$priv_subnet_2\""
    [ -n "$db_secret_arn" ] && echo "export DB_SECRET_ARN=\"$db_secret_arn\""
    [ -n "$app_secret_arn" ] && echo "export APP_SECRET_ARN=\"$app_secret_arn\""
    [ -n "$alb_sg_id" ] && echo "export ALB_SG_ID=\"$alb_sg_id\""
    [ -n "$ecs_sg_id" ] && echo "export ECS_SG_ID=\"$ecs_sg_id\""
    [ -n "$aurora_sg_id" ] && echo "export AURORA_SG_ID=\"$aurora_sg_id\""
    [ -n "$task_exec_role" ] && echo "export TASK_EXEC_ROLE=\"$task_exec_role\""
    [ -n "$task_role" ] && echo "export TASK_ROLE=\"$task_role\""
    [ -n "$codedeploy_role" ] && echo "export CODEDEPLOY_ROLE=\"$codedeploy_role\""
    [ -n "$backend_repo" ] && echo "export BACKEND_REPO=\"$backend_repo\""
    [ -n "$frontend_repo" ] && echo "export FRONTEND_REPO=\"$frontend_repo\""
    [ -n "$doc_service_repo" ] && echo "export DOCUMENT_SERVICE_REPO=\"$doc_service_repo\""
    [ -n "$ai_service_repo" ] && echo "export AI_SERVICE_REPO=\"$ai_service_repo\""
    [ -n "$backend_tg_blue" ] && echo "export BACKEND_TG_BLUE=\"$backend_tg_blue\""
    [ -n "$backend_tg_green" ] && echo "export BACKEND_TG_GREEN=\"$backend_tg_green\""
    [ -n "$frontend_tg_blue" ] && echo "export FRONTEND_TG_BLUE=\"$frontend_tg_blue\""
    [ -n "$frontend_tg_green" ] && echo "export FRONTEND_TG_GREEN=\"$frontend_tg_green\""
    [ -n "$listener_arn" ] && echo "export LISTENER_ARN=\"$listener_arn\""
    [ -n "$cluster_name" ] && echo "export CLUSTER_NAME=\"$cluster_name\""
    [ -n "$backend_service" ] && echo "export BACKEND_SERVICE=\"$backend_service\""
    [ -n "$frontend_service" ] && echo "export FRONTEND_SERVICE=\"$frontend_service\""
    
    echo ""
    print_info "To use these variables, run:"
    echo "  eval \$($0 get-deployment-vars)"
}

# Main
main() {
    if [ -z "$COMMAND" ]; then
        print_error "Command required"
        show_help
        exit 1
    fi
    
    case "$COMMAND" in
        build-frontend)
            # Clear SERVICE_TYPE for build commands (not needed)
            unset SERVICE_TYPE
            build_frontend
            exit $?
            ;;
        build-backend)
            # Clear SERVICE_TYPE for build commands (not needed)
            unset SERVICE_TYPE
            build_backend
            exit $?
            ;;
        build-document-service)
            unset SERVICE_TYPE
            build_document_service
            exit $?
            ;;
        build-ai-service)
            unset SERVICE_TYPE
            build_ai_service
            exit $?
            ;;
        build-all-images)
            unset SERVICE_TYPE
            build_all_images
            exit $?
            ;;
        rebuild-frontend)
            # Clear SERVICE_TYPE for build commands (not needed)
            unset SERVICE_TYPE
            rebuild_frontend
            exit $?
            ;;
        deploy-frontend)
            deploy_service "frontend"
            exit $?
            ;;
        deploy-backend)
            deploy_service "backend"
            exit $?
            ;;
        deploy-document-service)
            deploy_microservice "document-service"
            exit $?
            ;;
        deploy-ai-service)
            deploy_microservice "ai-service"
            exit $?
            ;;
        deploy-document-service-stack)
            deploy_microservice_stack "document-service"
            exit $?
            ;;
        deploy-ai-service-stack)
            deploy_microservice_stack "ai-service"
            exit $?
            ;;
        update-service)
            if [ -z "${SERVICE_TYPE:-}" ]; then
                print_error "Service type required. Use --service frontend or --service backend"
                exit 1
            fi
            update_service "$SERVICE_TYPE"
            exit $?
            ;;
        monitor-deployment)
            monitor_deployment
            exit $?
            ;;
        check-health)
            check_health
            exit $?
            ;;
        view-logs)
            view_logs
            exit $?
            ;;
        get-stack-outputs)
            get_stack_outputs
            exit $?
            ;;
        get-deployment-vars)
            get_deployment_vars
            exit $?
            ;;
        verify-ecs-role)
            verify_ecs_service_role
            exit $?
            ;;
        *)
            print_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Run main if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    parse_args "$@"
    main
fi
