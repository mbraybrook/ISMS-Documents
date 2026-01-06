#!/bin/bash
# Deployment Script for ISMS Application on EC2
# This script can run in two modes:
#   1. Local mode: Copies files to EC2 and triggers remote deployment
#   2. Remote mode: Deploys application on EC2 instance
#
# Usage (Local):
#   EC2_HOST=18.171.58.205 EC2_USER=ec2-user EC2_SSH_KEY=~/.ssh/mark.braybrook-sandbox.pem ./deploy.sh [options]
#   Or: ./deploy.sh --ec2-host 18.171.58.205 --ec2-user ec2-user --ec2-ssh-key ~/.ssh/mark.braybrook-sandbox.pem [options]
#
# Usage (Remote - on EC2):
#   ./deploy.sh [options]
#
# Options:
#   --skip-backup    Skip database backup
#   --skip-migrate   Skip database migrations
#   --pull           Attempt to pull latest code from Git (only works if Git is configured; automatically uses --no-cache)
#   --no-build       Skip building images (use existing images)
#   --no-cache       Force rebuild without using Docker cache (ensures fresh builds)
#   --ec2-host IP    EC2 instance IP or hostname (for local mode)
#   --ec2-user USER  EC2 SSH user (default: ec2-user, for local mode)
#   --ec2-ssh-key KEY Path to SSH private key (for local mode)
#   --cf-stack NAME  CloudFormation stack name (default: isms-ec2-production)
#   --cf-region REGION AWS region (default: eu-west-2)
#   --cf-profile PROFILE AWS CLI profile (default: pt-sandbox)
#   --remote-only    Force remote mode (skip local detection)
#   --no-prompt      Skip prompt and don't trigger remote deployment (local mode only)
#   --cf-stack-name NAME CloudFormation stack name (default: isms-ec2-production)
#   --cf-region REGION AWS region (default: eu-west-2)
#   --cf-profile PROFILE AWS CLI profile (default: pt-sandbox)
#   --skip-ip-update Skip automatic IP address update in CloudFormation stack

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
SKIP_BACKUP=false
SKIP_MIGRATE=false
PULL_CODE=false
NO_BUILD=false
NO_CACHE=false
REMOTE_ONLY=false
NO_PROMPT=false
SKIP_IP_UPDATE=false

# EC2 connection settings (can be set via environment variables or arguments)
EC2_HOST="${EC2_HOST:-}"
EC2_USER="${EC2_USER:-ec2-user}"
EC2_SSH_KEY="${EC2_SSH_KEY:-}"

# CloudFormation settings for IP management
CF_STACK_NAME="${CF_STACK_NAME:-isms-ec2-production}"
CF_REGION="${CF_REGION:-eu-west-2}"
CF_PROFILE="${CF_PROFILE:-pt-sandbox}"
CF_TEMPLATE_PATH="${CF_TEMPLATE_PATH:-infrastructure/templates/ec2-single-instance.yaml}"
IP_CACHE_FILE="infrastructure/ec2/LOCAL_IP_ADDRESS"

# CloudFormation settings for IP management
CF_STACK_NAME="${CF_STACK_NAME:-isms-ec2-production}"
CF_REGION="${CF_REGION:-eu-west-2}"
CF_PROFILE="${CF_PROFILE:-pt-sandbox}"
CF_TEMPLATE_PATH="${CF_TEMPLATE_PATH:-infrastructure/templates/ec2-single-instance.yaml}"
IP_CACHE_FILE="infrastructure/ec2/LOCAL_IP_ADDRESS"
IP_SERVICE="${IP_SERVICE:-https://api.ipify.org}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --skip-migrate)
            SKIP_MIGRATE=true
            shift
            ;;
        --pull)
            PULL_CODE=true
            NO_CACHE=true  # Force rebuild when pulling new code
            shift
            ;;
        --no-build)
            NO_BUILD=true
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --ec2-host)
            EC2_HOST="$2"
            shift 2
            ;;
        --ec2-user)
            EC2_USER="$2"
            shift 2
            ;;
        --ec2-ssh-key)
            EC2_SSH_KEY="$2"
            shift 2
            ;;
        --remote-only)
            REMOTE_ONLY=true
            shift
            ;;
        --no-prompt)
            NO_PROMPT=true
            shift
            ;;
        --cf-stack-name)
            CF_STACK_NAME="$2"
            shift 2
            ;;
        --cf-region)
            CF_REGION="$2"
            shift 2
            ;;
        --cf-profile)
            CF_PROFILE="$2"
            shift 2
            ;;
        --skip-ip-update)
            SKIP_IP_UPDATE=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Detect if we're running locally or on EC2
is_ec2_instance() {
    if [ "$REMOTE_ONLY" = true ]; then
        return 0  # Force remote mode
    fi
    
    # Check if /opt/isms exists (EC2 deployment directory)
    if [ -d "/opt/isms" ]; then
        return 0
    fi
    
    # Check if we're on an EC2 instance (check metadata service)
    if curl -s --max-time 1 http://169.254.169.254/latest/meta-data/instance-id > /dev/null 2>&1; then
        return 0
    fi
    
    return 1
}

# Get current public IP address
get_current_ip() {
    local ip_service="${1:-https://api.ipify.org}"
    local current_ip
    
    if ! current_ip=$(curl -s --max-time 10 "$ip_service" | tr -d '[:space:]'); then
        print_warning "Failed to fetch IP from $ip_service, trying alternative..."
        if ! current_ip=$(curl -s --max-time 10 "https://checkip.amazonaws.com" | tr -d '[:space:]'); then
            print_error "Failed to fetch IP address from alternative service"
            return 1
        fi
    fi
    
    if [ -z "$current_ip" ]; then
        print_error "Received empty IP address"
        return 1
    fi
    
    echo "$current_ip"
}

# Read cached IP address
read_cached_ip() {
    if [ -f "$IP_CACHE_FILE" ]; then
        cat "$IP_CACHE_FILE" | tr -d '[:space:]'
    else
        echo ""
    fi
}

# Write cached IP address
write_cached_ip() {
    local ip="$1"
    mkdir -p "$(dirname "$IP_CACHE_FILE")"
    echo "$ip" > "$IP_CACHE_FILE"
    print_success "Cached IP address: $ip"
}

# Update CloudFormation stack with new IP address
update_stack_ip() {
    local new_ip="$1"
    local cidr="${new_ip}/32"
    
    print_step "Updating CloudFormation stack with new IP address..."
    
    # Check if AWS CLI is available
    if ! command -v aws &> /dev/null; then
        print_warning "AWS CLI not found. Skipping IP update."
        print_warning "You may need to manually update the security group if your IP changed."
        return 0
    fi
    
    # Check if jq is available (needed for parameter parsing)
    if ! command -v jq &> /dev/null; then
        print_warning "jq not found. Skipping IP update."
        print_warning "Install jq to enable automatic IP updates: sudo apt-get install jq"
        return 0
    fi
    
    # Check if stack exists
    if ! aws cloudformation describe-stacks \
        --stack-name "$CF_STACK_NAME" \
        --region "$CF_REGION" \
        --profile "$CF_PROFILE" \
        &> /dev/null; then
        print_warning "Stack '$CF_STACK_NAME' not found. Skipping IP update."
        return 0
    fi
    
    # Get current parameters
    print_info "Retrieving current stack parameters..."
    local current_params
    current_params=$(aws cloudformation describe-stacks \
        --stack-name "$CF_STACK_NAME" \
        --region "$CF_REGION" \
        --profile "$CF_PROFILE" \
        --query 'Stacks[0].Parameters' \
        --output json)
    
    # Extract current IP
    local current_ip
    current_ip=$(echo "$current_params" | \
        jq -r '.[] | select(.ParameterKey == "AllowedSSHCIDR") | .ParameterValue' | \
        sed 's/\/32$//')
    
    if [ "$current_ip" = "$new_ip" ]; then
        print_info "Stack already allows IP: $new_ip"
        return 0
    fi
    
    print_info "Updating AllowedSSHCIDR: ${current_ip:-not set} -> $new_ip"
    
    # Build parameters array
    local parameters
    parameters=$(echo "$current_params" | jq -c "map(
        if .ParameterKey == \"AllowedSSHCIDR\" then
            .ParameterValue = \"$cidr\"
        else
            .
        end
    )")
    
    # Convert to AWS CLI format
    local param_string=""
    while IFS= read -r param; do
        local key
        local value
        key=$(echo "$param" | jq -r '.ParameterKey')
        value=$(echo "$param" | jq -r '.ParameterValue')
        if [ -n "$param_string" ]; then
            param_string="$param_string "
        fi
        param_string="${param_string}ParameterKey=$key,ParameterValue=$value"
    done < <(echo "$parameters" | jq -c '.[]')
    
    # Update the stack
    print_info "Updating stack (this may take a minute)..."
    if aws cloudformation update-stack \
        --stack-name "$CF_STACK_NAME" \
        --template-body "file://$CF_TEMPLATE_PATH" \
        --parameters $param_string \
        --capabilities CAPABILITY_NAMED_IAM \
        --region "$CF_REGION" \
        --profile "$CF_PROFILE" \
        &> /tmp/cf-update-output.txt; then
        print_success "Stack update initiated"
        
        # Wait for update to complete
        print_info "Waiting for stack update to complete..."
        if aws cloudformation wait stack-update-complete \
            --stack-name "$CF_STACK_NAME" \
            --region "$CF_REGION" \
            --profile "$CF_PROFILE" 2>/dev/null; then
            print_success "Stack update completed"
        else
            print_warning "Stack update may still be in progress"
        fi
    else
        local error_msg
        error_msg=$(cat /tmp/cf-update-output.txt)
        if echo "$error_msg" | grep -q "No updates are to be performed"; then
            print_info "Stack already has the correct IP"
        else
            print_warning "Failed to update stack (non-critical):"
            echo "$error_msg" | head -5
            print_info "You may need to manually update the security group"
        fi
    fi
}

# Manage IP address and update CloudFormation if needed
manage_ip_address() {
    print_step "Managing IP address for EC2 access..."
    
    # Get current IP
    local current_ip
    if ! current_ip=$(get_current_ip); then
        print_warning "Could not determine current IP address"
        print_warning "Continuing with deployment, but SSH may fail if IP changed"
        return 0
    fi
    
    print_info "Current public IP: $current_ip"
    
    # Read cached IP
    local cached_ip
    cached_ip=$(read_cached_ip)
    
    if [ -z "$cached_ip" ]; then
        # No cached IP - first time, update stack and cache
        print_info "No cached IP found. This appears to be the first deployment."
        print_info "Updating CloudFormation stack to allow access from this IP..."
        
        if update_stack_ip "$current_ip"; then
            write_cached_ip "$current_ip"
            print_info "Waiting 10 seconds for security group changes to propagate..."
            sleep 10
        fi
    elif [ "$cached_ip" = "$current_ip" ]; then
        # IP hasn't changed
        print_info "IP address unchanged ($current_ip). No update needed."
    else
        # IP has changed - update stack and cache
        print_warning "IP address has changed: $cached_ip -> $current_ip"
        print_info "Updating CloudFormation stack..."
        
        if update_stack_ip "$current_ip"; then
            write_cached_ip "$current_ip"
            print_info "Waiting 15 seconds for security group changes to propagate..."
            sleep 15
        fi
    fi
    
    echo ""
}

# Check disk space and warn if low
check_disk_space() {
    print_step "Checking disk space..."
    
    # Get disk usage percentage
    local usage
    usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ -z "$usage" ]; then
        print_warning "Could not determine disk usage"
        return 0
    fi
    
    print_info "Disk usage: ${usage}%"
    
    if [ "$usage" -ge 90 ]; then
        print_error "Disk usage is ${usage}% - critically low!"
        print_warning "Deployment may fail. Consider cleaning up first."
        print_info "Run: docker system prune -a --volumes"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    elif [ "$usage" -ge 80 ]; then
        print_warning "Disk usage is ${usage}% - running cleanup..."
        cleanup_docker
    else
        print_success "Disk space is adequate (${usage}% used)"
    fi
    
    echo ""
}

# Clean up Docker resources
cleanup_docker() {
    print_step "Cleaning up Docker resources..."
    
    # Remove stopped containers
    print_info "Removing stopped containers..."
    docker container prune -f > /dev/null 2>&1 || true
    
    # Remove unused images (keep last 2 versions of each)
    print_info "Removing unused Docker images..."
    # Get list of image tags, keep only the 2 most recent for each base image
    docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "(isms|node|postgres|nginx|ollama)" | \
        sort -V | head -n -10 | xargs -r docker rmi -f > /dev/null 2>&1 || true
    
    # Remove dangling images
    docker image prune -f > /dev/null 2>&1 || true
    
    # Remove unused build cache (this can free up significant space)
    print_info "Removing unused build cache..."
    docker builder prune -f > /dev/null 2>&1 || true
    
    # Remove unused volumes (be careful - only unused ones)
    print_info "Removing unused volumes..."
    docker volume prune -f > /dev/null 2>&1 || true
    
    print_success "Docker cleanup completed"
}

# Clean up before deployment
cleanup_before_deployment() {
    print_step "Running pre-deployment cleanup..."
    
    # Clean up old backups (keep last 5 instead of 7)
    if [ -d "$APP_DIR/backups" ]; then
        print_info "Cleaning old backups (keeping last 5)..."
        ls -t "$APP_DIR/backups"/backup-*.sql.gz 2>/dev/null | tail -n +6 | xargs -r rm -f || true
    fi
    
    # Clean up /tmp/isms-deploy if it exists (only if we have permission)
    if [ -d "/tmp/isms-deploy" ]; then
        print_info "Cleaning up /tmp/isms-deploy..."
        # Try without sudo first (if files are owned by current user)
        rm -rf /tmp/isms-deploy 2>/dev/null || {
            # If that fails, try with sudo (but don't prompt for password)
            sudo -n rm -rf /tmp/isms-deploy 2>/dev/null || {
                print_warning "Could not remove /tmp/isms-deploy (may require manual cleanup)"
            }
        }
    fi
    
    # Clean up Docker build cache if disk usage is high
    local usage
    usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//' 2>/dev/null || echo "0")
    if [ "$usage" -ge 75 ]; then
        cleanup_docker
    fi
    
    # Clean up old logs
    if [ -d "$APP_DIR/logs" ]; then
        print_info "Cleaning old log files..."
        find "$APP_DIR/logs" -name "*.log" -mtime +7 -delete 2>/dev/null || true
    fi
    
    print_success "Pre-deployment cleanup completed"
    echo ""
}

# Manage IP address in CloudFormation stack
manage_ip_address() {
    if [ "$SKIP_IP_UPDATE" = true ]; then
        print_info "Skipping IP address update (--skip-ip-update)"
        return 0
    fi
    
    print_step "Managing SSH IP address in CloudFormation stack"
    
    # Check if AWS CLI is available
    if ! command -v aws &> /dev/null; then
        print_warning "AWS CLI not found - skipping IP address update"
        print_info "You may need to manually update the security group if your IP has changed"
        return 0
    fi
    
    # Check if jq is available (needed for parsing JSON)
    if ! command -v jq &> /dev/null; then
        print_warning "jq not found - skipping IP address update"
        print_info "Install jq to enable automatic IP address management"
        return 0
    fi
    
    # Check if stack exists
    if ! aws cloudformation describe-stacks \
        --stack-name "$CF_STACK_NAME" \
        --region "$CF_REGION" \
        --profile "$CF_PROFILE" \
        &> /dev/null; then
        print_warning "CloudFormation stack '$CF_STACK_NAME' not found - skipping IP update"
        return 0
    fi
    
    # Get current public IP
    print_info "Detecting your current public IP address..."
    if ! CURRENT_IP=$(curl -s --max-time 10 "$IP_SERVICE" | tr -d '[:space:]'); then
        print_warning "Failed to fetch IP from $IP_SERVICE, trying alternative..."
        if ! CURRENT_IP=$(curl -s --max-time 10 "https://checkip.amazonaws.com" | tr -d '[:space:]'); then
            print_warning "Failed to fetch IP address - skipping IP update"
            return 0
        fi
    fi
    
    if [ -z "$CURRENT_IP" ]; then
        print_warning "Received empty IP address - skipping IP update"
        return 0
    fi
    
    print_info "Your current public IP: $CURRENT_IP"
    
    # Check cached IP
    CACHED_IP=""
    if [ -f "$IP_CACHE_FILE" ]; then
        CACHED_IP=$(cat "$IP_CACHE_FILE" | tr -d '[:space:]')
        print_info "Cached IP address: $CACHED_IP"
    else
        print_info "No cached IP address found"
    fi
    
    # Compare IPs
    if [ "$CACHED_IP" = "$CURRENT_IP" ]; then
        print_success "IP address unchanged - no update needed"
        return 0
    fi
    
    # IP has changed or no cache - update CloudFormation stack
    print_info "IP address has changed or not cached - updating CloudFormation stack..."
    
    # Get current stack parameters
    CURRENT_PARAMS=$(aws cloudformation describe-stacks \
        --stack-name "$CF_STACK_NAME" \
        --region "$CF_REGION" \
        --profile "$CF_PROFILE" \
        --query 'Stacks[0].Parameters' \
        --output json 2>/dev/null)
    
    if [ -z "$CURRENT_PARAMS" ]; then
        print_warning "Failed to retrieve stack parameters - skipping IP update"
        return 0
    fi
    
    # Build parameters array with updated IP
    PARAMETERS=$(echo "$CURRENT_PARAMS" | jq -c "map(
        if .ParameterKey == \"AllowedSSHCIDR\" then
            .ParameterValue = \"$CURRENT_IP/32\"
        else
            .
        end
    )" 2>/dev/null)
    
    if [ -z "$PARAMETERS" ]; then
        print_warning "Failed to build parameters - skipping IP update"
        return 0
    fi
    
    # Convert to AWS CLI format
    PARAM_STRING=""
    while IFS= read -r param; do
        KEY=$(echo "$param" | jq -r '.ParameterKey')
        VALUE=$(echo "$param" | jq -r '.ParameterValue')
        if [ -n "$PARAM_STRING" ]; then
            PARAM_STRING="$PARAM_STRING "
        fi
        PARAM_STRING="${PARAM_STRING}ParameterKey=$KEY,ParameterValue=$VALUE"
    done < <(echo "$PARAMETERS" | jq -c '.[]')
    
    # Validate template file exists
    if [ ! -f "$CF_TEMPLATE_PATH" ]; then
        print_warning "CloudFormation template not found: $CF_TEMPLATE_PATH - skipping IP update"
        return 0
    fi
    
    print_info "Updating stack: $CF_STACK_NAME"
    print_info "Old IP: ${CACHED_IP:-not set}"
    print_info "New IP: $CURRENT_IP"
    
    # Update the stack
    if aws cloudformation update-stack \
        --stack-name "$CF_STACK_NAME" \
        --template-body "file://$CF_TEMPLATE_PATH" \
        --parameters $PARAM_STRING \
        --capabilities CAPABILITY_NAMED_IAM \
        --region "$CF_REGION" \
        --profile "$CF_PROFILE" \
        &> /tmp/cf-update-output.txt; then
        print_success "Stack update initiated"
        
        print_info "Waiting for stack update to complete (this may take 30-60 seconds)..."
        if aws cloudformation wait stack-update-complete \
            --stack-name "$CF_STACK_NAME" \
            --region "$CF_REGION" \
            --profile "$CF_PROFILE" 2>/dev/null; then
            print_success "Stack update completed"
        else
            print_warning "Stack update may still be in progress"
        fi
        
        # Save IP to cache file
        mkdir -p "$(dirname "$IP_CACHE_FILE")"
        echo "$CURRENT_IP" > "$IP_CACHE_FILE"
        print_success "IP address cached to $IP_CACHE_FILE"
        
        # Wait a few seconds for security group changes to propagate
        if [ -n "$CACHED_IP" ] && [ "$CACHED_IP" != "$CURRENT_IP" ]; then
            # IP changed - wait longer for propagation
            print_info "IP address changed - waiting 15 seconds for security group changes to propagate..."
            sleep 15
        else
            # First time or no change - shorter wait
            print_info "Waiting 10 seconds for security group changes to propagate..."
            sleep 10
        fi
        
    else
        ERROR_MSG=$(cat /tmp/cf-update-output.txt 2>/dev/null || echo "Unknown error")
        if echo "$ERROR_MSG" | grep -q "No updates are to be performed"; then
            print_info "No updates needed - stack is already in the desired state"
            # Still update cache
            mkdir -p "$(dirname "$IP_CACHE_FILE")"
            echo "$CURRENT_IP" > "$IP_CACHE_FILE"
        else
            print_warning "Failed to update stack: $ERROR_MSG"
            print_info "You may need to manually update the security group"
        fi
    fi
    
    echo ""
}

# Local mode: Copy files to EC2 and trigger remote deployment
deploy_from_local() {
    print_step "Running in LOCAL mode - preparing files for EC2 deployment"
    echo ""
    
    # Manage IP address first
    manage_ip_address
    
    # Validate EC2 connection parameters
    if [ -z "$EC2_HOST" ]; then
        print_error "EC2_HOST not set. Provide via --ec2-host or EC2_HOST environment variable"
        exit 1
    fi
    
    if [ -z "$EC2_SSH_KEY" ]; then
        # Try default location
        if [ -f "$HOME/.ssh/mark.braybrook-sandbox.pem" ]; then
            EC2_SSH_KEY="$HOME/.ssh/mark.braybrook-sandbox.pem"
            print_info "Using default SSH key: $EC2_SSH_KEY"
        else
            print_error "EC2_SSH_KEY not set. Provide via --ec2-ssh-key or EC2_SSH_KEY environment variable"
            exit 1
        fi
    fi
    
    # Validate SSH key exists
    if [ ! -f "$EC2_SSH_KEY" ]; then
        print_error "SSH key not found: $EC2_SSH_KEY"
        exit 1
    fi
    
    # Set correct permissions on SSH key
    chmod 600 "$EC2_SSH_KEY" 2>/dev/null || true
    
    print_info "EC2 Host: $EC2_HOST"
    print_info "EC2 User: $EC2_USER"
    print_info "SSH Key: $EC2_SSH_KEY"
    echo ""
    
    # Determine script location
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
    
    # Files to copy
    print_step "Preparing files for transfer..."
    
    # Create temporary directory for files
    TEMP_DIR=$(mktemp -d)
    trap "rm -rf $TEMP_DIR" EXIT
    
    # Copy files to temp directory (excluding unnecessary files)
    print_info "Copying application files..."
    cd "$PROJECT_ROOT"
    
    # Copy docker-compose file
    cp docker-compose.ec2.yml "$TEMP_DIR/" 2>/dev/null || {
        print_error "docker-compose.ec2.yml not found in project root"
        exit 1
    }
    
    # Copy backend
    if [ -d "backend" ]; then
        print_info "Copying backend..."
        rsync -a --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude 'coverage' \
            backend/ "$TEMP_DIR/backend/"
    else
        print_error "backend directory not found"
        exit 1
    fi
    
    # Copy frontend
    if [ -d "frontend" ]; then
        print_info "Copying frontend..."
        rsync -a --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude 'coverage' \
            frontend/ "$TEMP_DIR/frontend/"
    else
        print_error "frontend directory not found"
        exit 1
    fi
    
    # Copy services
    if [ -d "services" ]; then
        print_info "Copying services..."
        rsync -a --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude 'coverage' \
            services/ "$TEMP_DIR/services/"
    else
        print_error "services directory not found"
        exit 1
    fi
    
    # Copy infrastructure/ec2 scripts
    if [ -d "infrastructure/ec2" ]; then
        print_info "Copying deployment scripts..."
        mkdir -p "$TEMP_DIR/infrastructure/ec2"
        cp infrastructure/ec2/*.sh "$TEMP_DIR/infrastructure/ec2/" 2>/dev/null || true
    fi
    
    print_success "Files prepared"
    echo ""
    
    # Transfer files to EC2
    print_step "Transferring files to EC2 instance..."
    print_info "This may take a few minutes..."
    
    ssh -i "$EC2_SSH_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" \
        "mkdir -p /tmp/isms-deploy" || {
        print_error "Failed to create temporary directory on EC2"
        exit 1
    }
    
    # Use rsync if available, otherwise scp
    if command -v rsync &> /dev/null; then
        print_info "Using rsync for efficient transfer..."
        rsync -avz --progress \
            -e "ssh -i $EC2_SSH_KEY -o StrictHostKeyChecking=no" \
            "$TEMP_DIR/" "$EC2_USER@$EC2_HOST:/tmp/isms-deploy/" || {
            print_error "Failed to transfer files via rsync"
            exit 1
        }
    else
        print_info "Using scp for transfer..."
        scp -i "$EC2_SSH_KEY" -o StrictHostKeyChecking=no -r "$TEMP_DIR"/* \
            "$EC2_USER@$EC2_HOST:/tmp/isms-deploy/" || {
            print_error "Failed to transfer files via scp"
            exit 1
        }
    fi
    
    print_success "Files transferred to EC2"
    echo ""
    
    # Copy files to final location on EC2
    print_step "Copying files to application directory on EC2..."
    
    COPY_CMD="sudo cp -r /tmp/isms-deploy/backend /tmp/isms-deploy/frontend /tmp/isms-deploy/services /tmp/isms-deploy/docker-compose.ec2.yml /opt/isms/ && "
    COPY_CMD+="sudo mkdir -p /opt/isms/infrastructure/ec2 && "
    COPY_CMD+="sudo cp -r /tmp/isms-deploy/infrastructure/ec2/*.sh /opt/isms/infrastructure/ec2/ 2>/dev/null || true && "
    COPY_CMD+="sudo chown -R isms:isms /opt/isms && "
    COPY_CMD+="sudo chmod +x /opt/isms/infrastructure/ec2/*.sh 2>/dev/null || true"
    
    ssh -i "$EC2_SSH_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "$COPY_CMD" || {
        print_error "Failed to copy files to application directory"
        exit 1
    }
    
    print_success "Files copied to /opt/isms on EC2"
    echo ""
    
    # Build deployment command for display
    DEPLOY_CMD="sudo -u isms ./infrastructure/ec2/deploy.sh"
    if [ "$SKIP_BACKUP" = true ]; then
        DEPLOY_CMD+=" --skip-backup"
    fi
    if [ "$SKIP_MIGRATE" = true ]; then
        DEPLOY_CMD+=" --skip-migrate"
    fi
    if [ "$NO_BUILD" = true ]; then
        DEPLOY_CMD+=" --no-build"
    fi
    if [ "$NO_CACHE" = true ]; then
        DEPLOY_CMD+=" --no-cache"
    fi
    
    # Optionally trigger remote deployment
    print_step "Files are ready for deployment on EC2"
    echo ""
    print_info "To complete deployment, SSH into EC2 and run:"
    echo ""
    echo "  ssh -i $EC2_SSH_KEY $EC2_USER@$EC2_HOST"
    echo "  cd /opt/isms"
    echo "  $DEPLOY_CMD"
    echo ""
    
    # Ask if user wants to trigger deployment now (unless --no-prompt)
    if [ "$NO_PROMPT" = false ]; then
        read -p "Do you want to trigger deployment now? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            TRIGGER_DEPLOY=true
        else
            TRIGGER_DEPLOY=false
        fi
    else
        TRIGGER_DEPLOY=false
        print_info "Skipping automatic deployment (--no-prompt). Run the command above when ready."
    fi
    
    if [ "$TRIGGER_DEPLOY" = true ]; then
        print_step "Executing deployment on EC2 instance..."
        echo ""
        
        # Build remote deployment command
        REMOTE_CMD="cd /opt/isms && "
        REMOTE_CMD+="sudo -u isms ./infrastructure/ec2/deploy.sh"
        
        # Add options to remote command
        if [ "$SKIP_BACKUP" = true ]; then
            REMOTE_CMD+=" --skip-backup"
        fi
        if [ "$SKIP_MIGRATE" = true ]; then
            REMOTE_CMD+=" --skip-migrate"
        fi
        if [ "$NO_BUILD" = true ]; then
            REMOTE_CMD+=" --no-build"
        fi
        if [ "$NO_CACHE" = true ]; then
            REMOTE_CMD+=" --no-cache"
        fi
        REMOTE_CMD+=" --remote-only"  # Force remote mode on EC2
        
        ssh -i "$EC2_SSH_KEY" -o StrictHostKeyChecking=no -t "$EC2_USER@$EC2_HOST" "$REMOTE_CMD" || {
            print_warning "Remote deployment failed or was interrupted"
            print_info "You can manually SSH and run the deployment command shown above"
            exit 1
        }
        
        print_success "Deployment completed!"
    else
        print_info "Skipping automatic deployment. Run the command above when ready."
    fi
}

# Remote mode: Deploy on EC2 instance
deploy_on_ec2() {
    print_step "Running in REMOTE mode - deploying on EC2 instance"
    echo ""
    
    # Determine application directory and user
    APP_DIR="/opt/isms"
    APP_USER=$(whoami)
    
    # If running as root, switch to isms user for operations
    if [ "$EUID" -eq 0 ]; then
        APP_USER="isms"
    fi
    
    # Check if files need to be copied from /tmp
    if [ -d "/tmp/isms-deploy" ] && [ ! -f "$APP_DIR/.deployed" ]; then
        print_step "Copying files from /tmp to application directory..."
        
        # Copy files to final location (use sudo -n to avoid password prompts)
        if sudo -n cp -r /tmp/isms-deploy/backend "$APP_DIR/" 2>/dev/null; then
            sudo -n cp -r /tmp/isms-deploy/frontend "$APP_DIR/" 2>/dev/null || true
            sudo -n cp -r /tmp/isms-deploy/services "$APP_DIR/" 2>/dev/null || true
            sudo -n cp /tmp/isms-deploy/docker-compose.ec2.yml "$APP_DIR/" 2>/dev/null || true
            
            # Copy deployment scripts
            if [ -d "/tmp/isms-deploy/infrastructure/ec2" ]; then
                sudo -n mkdir -p "$APP_DIR/infrastructure/ec2" 2>/dev/null || true
                sudo -n cp -r /tmp/isms-deploy/infrastructure/ec2/*.sh "$APP_DIR/infrastructure/ec2/" 2>/dev/null || true
            fi
            
            # Set ownership
            sudo -n chown -R isms:isms "$APP_DIR" 2>/dev/null || true
            
            # Mark as deployed
            sudo -n touch "$APP_DIR/.deployed" 2>/dev/null || true
            sudo -n chown isms:isms "$APP_DIR/.deployed" 2>/dev/null || true
        else
            print_error "Failed to copy files (requires passwordless sudo for file operations)"
            print_info "The isms user needs passwordless sudo for: cp, mkdir, chown, touch"
            print_info "Or run as root: sudo bash ./infrastructure/ec2/deploy.sh"
            exit 1
        fi
        
        print_success "Files copied to application directory"
        echo ""
    fi
    
    # Determine Docker Compose command
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
        print_info "Using standalone docker-compose"
    elif docker compose version &> /dev/null 2>&1; then
        if docker buildx version &> /dev/null 2>&1; then
            DOCKER_COMPOSE="docker compose"
            print_info "Using docker compose plugin"
        else
            print_error "Docker Compose plugin requires buildx, but buildx is not available"
            exit 1
        fi
    else
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    cd "$APP_DIR" || {
        print_error "Application directory not found: $APP_DIR"
        exit 1
    }
    
    # Check disk space before deployment
    check_disk_space
    
    # Clean up before deployment
    cleanup_before_deployment
    
    print_step "Starting deployment for ISMS Application"
    echo ""
    
    # Pull latest code if requested
    if [ "$PULL_CODE" = true ]; then
        print_step "Pulling latest code from Git..."
        if [ -d ".git" ] && command -v git &> /dev/null; then
            if ! git remote get-url origin &> /dev/null; then
                print_warning "Git repository found but no remote configured"
                print_warning "Cannot pull code. Use SCP/rsync to copy files instead."
                print_info "The --no-cache flag is still active for fresh builds"
            else
                CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
                CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
                print_info "Current branch: $CURRENT_BRANCH"
                print_info "Current commit: $CURRENT_COMMIT"
                
                if git pull 2>&1; then
                    NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
                    if [ "$CURRENT_COMMIT" != "$NEW_COMMIT" ] && [ "$CURRENT_COMMIT" != "unknown" ]; then
                        print_success "Code updated: $CURRENT_COMMIT -> $NEW_COMMIT"
                        print_info "Latest commit message: $(git log -1 --pretty=%B | head -n1)"
                    else
                        print_info "Already up to date at commit: $NEW_COMMIT"
                    fi
                else
                    print_error "Git pull failed (may not have network access or credentials)"
                    print_warning "Continuing with existing code."
                    print_info "The --no-cache flag is still active for fresh builds"
                fi
            fi
        else
            print_warning "Not a Git repository or Git not available"
            print_info "The --no-cache flag is still active for fresh builds"
        fi
    fi
    
    # Check for .env file
    if [ ! -f ".env" ]; then
        print_error ".env file not found in $APP_DIR"
        print_warning "Please create .env file from .env.template"
        exit 1
    fi
    
    # Backup database
    if [ "$SKIP_BACKUP" = false ]; then
        print_step "Backing up database..."
        BACKUP_DIR="$APP_DIR/backups"
        mkdir -p "$BACKUP_DIR"
        
        source .env
        DB_USER="${POSTGRES_USER:-postgres}"
        DB_NAME="${POSTGRES_DB:-isms_db}"
        
        BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sql.gz"
        
        if docker ps | grep -q "isms-postgres-ec2"; then
            docker exec isms-postgres-ec2 pg_dump -U "$DB_USER" -Fc "$DB_NAME" | gzip > "$BACKUP_FILE"
            print_success "Database backed up to $BACKUP_FILE"
            
            ls -t "$BACKUP_DIR"/backup-*.sql.gz | tail -n +8 | xargs -r rm 2>/dev/null || true
            print_success "Old backups cleaned up"
        else
            print_warning "PostgreSQL container not running, skipping backup"
        fi
    else
        print_warning "Skipping database backup (--skip-backup)"
    fi
    
    # Build Docker images
    if [ "$NO_BUILD" = false ]; then
        print_step "Building Docker images..."
        
        # Stop containers before building to ensure clean rebuild
        # This prevents Docker from reusing running containers
        if [ "$NO_CACHE" = true ]; then
            print_info "Stopping containers before rebuild to ensure clean build..."
            $DOCKER_COMPOSE -f docker-compose.ec2.yml stop frontend backend 2>/dev/null || true
        fi
        
        # Remove old images before building to free space and force rebuild
        if [ "$NO_CACHE" = true ]; then
            print_info "Removing old frontend image to force complete rebuild..."
            docker rmi isms-frontend-ec2:latest 2>/dev/null || true
            docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "isms-(backend|frontend|document-service|ai-service)" | \
                grep -v "latest" | xargs -r docker rmi -f > /dev/null 2>&1 || true
        else
            print_info "Removing old images for services being rebuilt..."
            docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "isms-(backend|frontend|document-service|ai-service)" | \
                grep -v "latest" | xargs -r docker rmi -f > /dev/null 2>&1 || true
        fi
        
        if ! docker buildx version &> /dev/null 2>&1; then
            print_warning "Buildx not found. Docker Compose v5 requires buildx."
            print_error "Please install buildx manually (requires root):"
            echo "  sudo mkdir -p /usr/libexec/docker/cli-plugins"
            echo "  sudo curl -SL https://github.com/docker/buildx/releases/download/v0.17.1/buildx-v0.17.1.linux-amd64 -o /usr/libexec/docker/cli-plugins/docker-buildx"
            echo "  sudo chmod +x /usr/libexec/docker/cli-plugins/docker-buildx"
            echo "  sudo systemctl restart docker"
            echo "  docker buildx create --name builder"
            echo "  docker buildx use builder"
            exit 1
        fi
        
        if ! docker buildx ls 2>/dev/null | grep -q builder; then
            print_step "Creating buildx builder instance..."
            docker buildx create --name builder 2>/dev/null || true
            docker buildx use builder 2>/dev/null || true
            docker buildx inspect --bootstrap builder 2>/dev/null || true
        fi
        
        # Read VERSION file and update .env if needed
        if [ -f "frontend/VERSION" ]; then
            FRONTEND_VERSION=$(cat frontend/VERSION | tr -d '[:space:]')
            if [ -n "$FRONTEND_VERSION" ] && [ "$FRONTEND_VERSION" != "dev" ]; then
                print_info "Frontend version from VERSION file: $FRONTEND_VERSION"
                if [ -f ".env" ]; then
                    CURRENT_ENV_VERSION=""
                    if grep -q "^VITE_APP_VERSION=" .env 2>/dev/null; then
                        CURRENT_ENV_VERSION=$(grep "^VITE_APP_VERSION=" .env | cut -d'=' -f2 | tr -d '[:space:]' | head -n1)
                    fi
                    
                    if [ "$CURRENT_ENV_VERSION" != "$FRONTEND_VERSION" ]; then
                        if [ -n "$CURRENT_ENV_VERSION" ]; then
                            sed -i '/^VITE_APP_VERSION=/d' .env
                        fi
                        echo "VITE_APP_VERSION=$FRONTEND_VERSION" >> .env
                        print_success "Updated VITE_APP_VERSION in .env: ${CURRENT_ENV_VERSION:-not set} -> $FRONTEND_VERSION"
                    else
                        print_info "VITE_APP_VERSION already set to $FRONTEND_VERSION in .env"
                    fi
                fi
            fi
        fi
        
        # Build with or without cache
        if [ "$NO_CACHE" = true ]; then
            print_info "Building without cache (forcing fresh build)..."
            print_info "This will take longer but ensures all code changes are included"
            
            # Build and capture output to check for errors
            if ! $DOCKER_COMPOSE -f docker-compose.ec2.yml build --no-cache --progress=plain 2>&1 | tee /tmp/docker-build.log; then
                print_error "Build failed! Check the output above for errors."
                print_info "Last 50 lines of build output:"
                tail -50 /tmp/docker-build.log
                exit 1
            fi
            
            # Verify frontend build actually created files
            print_info "Verifying frontend build output..."
            if docker images | grep -q "isms-frontend"; then
                # Create a temporary container to check build output
                TEMP_CONTAINER=$(docker create isms-frontend-ec2:latest 2>/dev/null || echo "")
                if [ -n "$TEMP_CONTAINER" ]; then
                    if docker cp "$TEMP_CONTAINER:/usr/share/nginx/html/index.html" /tmp/frontend-index.html 2>/dev/null; then
                        if [ -f /tmp/frontend-index.html ]; then
                            JS_FILES=$(grep -oE 'src="[^"]*\.js[^"]*"' /tmp/frontend-index.html | head -1 || echo "")
                            if [ -n "$JS_FILES" ]; then
                                print_success "Frontend build verified: JavaScript files found in build output"
                            else
                                print_warning "Frontend build may be incomplete: No JavaScript files referenced in index.html"
                            fi
                            rm -f /tmp/frontend-index.html
                        fi
                    fi
                    docker rm "$TEMP_CONTAINER" > /dev/null 2>&1 || true
                fi
            fi
            
            # Clean up build cache after no-cache build (frees space)
            print_info "Cleaning up build cache after no-cache build..."
            docker builder prune -f > /dev/null 2>&1 || true
        else
            print_info "Building with cache (faster, but may miss some changes)..."
            if ! $DOCKER_COMPOSE -f docker-compose.ec2.yml build 2>&1 | tee /tmp/docker-build.log; then
                print_error "Build failed! Check the output above for errors."
                print_info "Last 50 lines of build output:"
                tail -50 /tmp/docker-build.log
                exit 1
            fi
        fi
        print_success "Docker images built"
        
        # Clean up dangling images after build
        print_info "Cleaning up dangling images..."
        docker image prune -f > /dev/null 2>&1 || true
        
        if [ -f "frontend/VERSION" ]; then
            EXPECTED_VERSION=$(cat frontend/VERSION | tr -d '[:space:]')
            print_info "Expected version in VERSION file: $EXPECTED_VERSION"
        fi
    else
        print_warning "Skipping build (--no-build)"
    fi
    
    # Stop running services
    print_step "Stopping running services..."
    $DOCKER_COMPOSE -f docker-compose.ec2.yml down
    print_success "Services stopped"
    
    # Run database migrations
    if [ "$SKIP_MIGRATE" = false ]; then
        print_step "Running database migrations..."
        
        $DOCKER_COMPOSE -f docker-compose.ec2.yml up -d postgres
        
        echo "Waiting for PostgreSQL to be ready..."
        timeout=60
        counter=0
        while ! docker exec isms-postgres-ec2 pg_isready -U "${POSTGRES_USER:-postgres}" > /dev/null 2>&1; do
            sleep 2
            counter=$((counter + 2))
            if [ $counter -ge $timeout ]; then
                print_error "PostgreSQL did not become ready in time"
                exit 1
            fi
        done
        
        $DOCKER_COMPOSE -f docker-compose.ec2.yml run --rm backend npm run db:migrate:deploy
        print_success "Database migrations completed"
    else
        print_warning "Skipping migrations (--skip-migrate)"
    fi
    
    # Start all services
    print_step "Starting all services..."
    $DOCKER_COMPOSE -f docker-compose.ec2.yml up -d
    print_success "Services started"
    
    # Wait for services to be healthy
    print_step "Waiting for services to be healthy..."
    sleep 10
    
    # Check health of services
    print_step "Checking service health..."
    MAX_RETRIES=30
    RETRY_COUNT=0
    
    check_health() {
        local service=$1
        local url=$2
        
        if curl -f -s "$url" > /dev/null 2>&1; then
            return 0
        else
            return 1
        fi
    }
    
    # Check backend
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if check_health "backend" "http://localhost:4000/api/health"; then
            print_success "Backend is healthy"
            break
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        sleep 2
    done
    
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        print_error "Backend did not become healthy"
        $DOCKER_COMPOSE -f docker-compose.ec2.yml logs backend
        exit 1
    fi
    
    # Check frontend
    RETRY_COUNT=0
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if check_health "frontend" "http://localhost/health"; then
            print_success "Frontend is healthy"
            break
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        sleep 2
    done
    
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        print_warning "Frontend health check failed (may need Nginx configuration)"
    fi
    
    # Reload Nginx if running
    if systemctl is-active --quiet nginx 2>/dev/null || sudo systemctl is-active --quiet nginx 2>/dev/null; then
        print_step "Reloading Nginx..."
        if sudo systemctl reload nginx 2>/dev/null; then
            print_success "Nginx reloaded"
        else
            print_warning "Failed to reload Nginx (may require passwordless sudo configuration)"
            print_info "To fix: Run 'sudo visudo' and add: isms ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx"
            print_info "Or run manually: sudo systemctl reload nginx"
        fi
    fi
    
    echo ""
    print_success "Deployment completed successfully!"
    echo ""
    
    # Verify deployment - check if key files are in the built bundle
    print_step "Verifying deployment..."
    if docker ps | grep -q "isms-frontend-ec2"; then
        MAIN_JS=$(docker exec isms-frontend-ec2 ls -1 /usr/share/nginx/html/assets/*.js 2>/dev/null | head -1 || echo "")
        if [ -n "$MAIN_JS" ]; then
            if docker exec isms-frontend-ec2 grep -q "Version Notes\|versionNotes" "$MAIN_JS" 2>/dev/null; then
                print_success "Deployment verification: Feature code found in built bundle"
            else
                print_warning "Deployment verification: Feature code NOT found in built bundle"
                print_warning "This may indicate the build didn't include your changes"
                print_info "Run: ./infrastructure/ec2/verify-deployment.sh for detailed analysis"
            fi
        fi
    fi
    echo ""
    
    # Show final disk usage
    print_step "Final disk usage:"
    df -h / | awk 'NR==1 || NR==2'
    echo ""
    
    echo "Services status:"
    $DOCKER_COMPOSE -f docker-compose.ec2.yml ps
    echo ""
    echo "To view logs:"
    echo "  $DOCKER_COMPOSE -f docker-compose.ec2.yml logs -f"
    echo ""
    echo "To verify deployment (check if code is actually deployed):"
    echo "  ./infrastructure/ec2/verify-deployment.sh"
    echo ""
    echo "To check disk usage:"
    echo "  df -h"
    echo "  docker system df"
    echo ""
    echo "To clean up Docker (if needed):"
    echo "  docker system prune -a --volumes"
    echo ""
    print_warning "IMPORTANT: Browser Cache"
    echo "  If you don't see your changes in the browser:"
    echo "  1. Do a hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)"
    echo "  2. Clear browser cache completely"
    echo "  3. Try in an incognito/private window"
    echo "  4. Check DevTools Network tab to verify the correct JS file is loaded"
    echo ""
}

# Main execution
if is_ec2_instance; then
    deploy_on_ec2
else
    deploy_from_local
fi
