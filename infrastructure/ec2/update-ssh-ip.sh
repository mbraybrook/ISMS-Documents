#!/bin/bash
# Update SSH IP Address in CloudFormation Stack
# This script automatically detects your current public IP address and updates
# the AllowedSSHCIDR parameter in the CloudFormation stack's security group.
#
# Usage: ./update-ssh-ip.sh [options]
# Options:
#   --stack-name NAME     CloudFormation stack name (default: isms-ec2-production)
#   --region REGION       AWS region (default: eu-west-2)
#   --profile PROFILE     AWS CLI profile (default: pt-sandbox)
#   --ip-service URL      IP detection service URL (default: https://api.ipify.org)
#   --template PATH       Path to CloudFormation template (default: infrastructure/templates/ec2-single-instance.yaml)
#   --dry-run             Show what would be updated without making changes
#   --help                Show this help message

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
STACK_NAME="isms-ec2-production"
REGION="eu-west-2"
PROFILE="pt-sandbox"
IP_SERVICE="https://api.ipify.org"
TEMPLATE_PATH="infrastructure/templates/ec2-single-instance.yaml"
DRY_RUN=false

# Helper functions
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

show_help() {
    cat << EOF
Update SSH IP Address in CloudFormation Stack

This script automatically detects your current public IP address and updates
the AllowedSSHCIDR parameter in the CloudFormation stack's security group.

Usage: $0 [options]

Options:
  --stack-name NAME     CloudFormation stack name (default: isms-ec2-production)
  --region REGION       AWS region (default: eu-west-2)
  --profile PROFILE     AWS CLI profile (default: pt-sandbox)
  --ip-service URL      IP detection service URL (default: https://api.ipify.org)
  --template PATH       Path to CloudFormation template (default: infrastructure/templates/ec2-single-instance.yaml)
  --dry-run             Show what would be updated without making changes
  --help                Show this help message

Examples:
  # Update with defaults
  $0

  # Update specific stack
  $0 --stack-name isms-ec2-staging --region us-east-1

  # Dry run to see what would change
  $0 --dry-run

  # Use alternative IP service
  $0 --ip-service https://checkip.amazonaws.com

EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --profile)
            PROFILE="$2"
            shift 2
            ;;
        --ip-service)
            IP_SERVICE="$2"
            shift 2
            ;;
        --template)
            TEMPLATE_PATH="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
done

# Validate template file exists
if [ ! -f "$TEMPLATE_PATH" ]; then
    print_error "Template file not found: $TEMPLATE_PATH"
    exit 1
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if stack exists
print_step "Checking if stack exists..."
if ! aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --profile "$PROFILE" \
    &> /dev/null; then
    print_error "Stack '$STACK_NAME' not found in region '$REGION'"
    exit 1
fi
print_success "Stack found: $STACK_NAME"

# Get current parameters from stack
print_step "Retrieving current stack parameters..."
CURRENT_PARAMS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query 'Stacks[0].Parameters' \
    --output json)

# Extract current IP from parameters
CURRENT_IP=$(echo "$CURRENT_PARAMS" | \
    jq -r '.[] | select(.ParameterKey == "AllowedSSHCIDR") | .ParameterValue' | \
    sed 's/\/32$//')

if [ -z "$CURRENT_IP" ]; then
    print_warning "Could not find current AllowedSSHCIDR parameter in stack"
    CURRENT_IP="unknown"
else
    print_info "Current allowed IP: $CURRENT_IP"
fi

# Fetch current public IP
print_step "Detecting your current public IP address..."
if ! CURRENT_PUBLIC_IP=$(curl -s --max-time 10 "$IP_SERVICE"); then
    print_error "Failed to fetch IP address from $IP_SERVICE"
    print_info "Trying alternative service: https://checkip.amazonaws.com"
    if ! CURRENT_PUBLIC_IP=$(curl -s --max-time 10 "https://checkip.amazonaws.com" | tr -d '[:space:]'); then
        print_error "Failed to fetch IP address from alternative service"
        exit 1
    fi
fi

if [ -z "$CURRENT_PUBLIC_IP" ]; then
    print_error "Received empty IP address"
    exit 1
fi

print_success "Your current public IP: $CURRENT_PUBLIC_IP"

# Check if IP has changed
if [ "$CURRENT_IP" = "$CURRENT_PUBLIC_IP" ]; then
    print_info "IP address has not changed. No update needed."
    exit 0
fi

# Build parameters array
print_step "Preparing stack update parameters..."

# Get all current parameters and update AllowedSSHCIDR
PARAMETERS=$(echo "$CURRENT_PARAMS" | jq -c 'map(
    if .ParameterKey == "AllowedSSHCIDR" then
        .ParameterValue = "'"$CURRENT_PUBLIC_IP"'/32"
    else
        .
    end
)')

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

# Show what will be updated
echo ""
print_info "Stack update summary:"
echo "  Stack Name: $STACK_NAME"
echo "  Region: $REGION"
echo "  Profile: $PROFILE"
echo "  Old IP: $CURRENT_IP"
echo "  New IP: $CURRENT_PUBLIC_IP"
echo ""

if [ "$DRY_RUN" = true ]; then
    print_warning "DRY RUN MODE - No changes will be made"
    echo ""
    echo "Command that would be executed:"
    echo "aws cloudformation update-stack \\"
    echo "  --stack-name $STACK_NAME \\"
    echo "  --template-body file://$TEMPLATE_PATH \\"
    echo "  --parameters $PARAM_STRING \\"
    echo "  --capabilities CAPABILITY_NAMED_IAM \\"
    echo "  --region $REGION \\"
    echo "  --profile $PROFILE"
    exit 0
fi

# Confirm update
read -p "Do you want to update the stack? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Update cancelled"
    exit 0
fi

# Update the stack
print_step "Updating CloudFormation stack..."
if aws cloudformation update-stack \
    --stack-name "$STACK_NAME" \
    --template-body "file://$TEMPLATE_PATH" \
    --parameters $PARAM_STRING \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$REGION" \
    --profile "$PROFILE" \
    &> /tmp/cf-update-output.txt; then
    print_success "Stack update initiated successfully"
    echo ""
    print_info "Waiting for stack update to complete..."
    aws cloudformation wait stack-update-complete \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --profile "$PROFILE"
    print_success "Stack update completed successfully!"
    print_info "SSH access is now allowed from: $CURRENT_PUBLIC_IP/32"
else
    ERROR_MSG=$(cat /tmp/cf-update-output.txt)
    if echo "$ERROR_MSG" | grep -q "No updates are to be performed"; then
        print_warning "No updates needed - stack is already in the desired state"
    else
        print_error "Failed to update stack:"
        echo "$ERROR_MSG"
        exit 1
    fi
fi

