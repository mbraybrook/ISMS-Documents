#!/bin/bash
# CloudWatch Monitoring Setup Script for ISMS Application
# This script installs and configures CloudWatch agent for log collection and metrics
#
# Usage: sudo ./setup-monitoring.sh [options]
# Options:
#   --region        AWS region (default: eu-west-2)
#   --log-group     CloudWatch log group prefix (default: /ecs/isms-ec2)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
AWS_REGION="${AWS_REGION:-eu-west-2}"
LOG_GROUP_PREFIX="/ecs/isms-ec2"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --region)
            AWS_REGION="$2"
            shift 2
            ;;
        --log-group)
            LOG_GROUP_PREFIX="$2"
            shift 2
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

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root or with sudo"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    print_error "Cannot detect OS"
    exit 1
fi

print_step "Setting up CloudWatch monitoring"
echo "Region: $AWS_REGION"
echo "Log group prefix: $LOG_GROUP_PREFIX"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please run setup-ec2.sh first."
    exit 1
fi

# Download and install CloudWatch agent
print_step "Installing CloudWatch agent..."
if [ "$OS" = "ubuntu" ]; then
    ARCH="amd64"
    if [ ! -f /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl ]; then
        wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/${ARCH}/latest/amazon-cloudwatch-agent.deb -O /tmp/amazon-cloudwatch-agent.deb
        dpkg -i -E /tmp/amazon-cloudwatch-agent.deb
        rm /tmp/amazon-cloudwatch-agent.deb
        print_success "CloudWatch agent installed"
    else
        print_warning "CloudWatch agent already installed"
    fi
elif [ "$OS" = "amzn" ] || [ "$OS" = "amazon" ]; then
    if [ ! -f /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl ]; then
        yum install -y -q amazon-cloudwatch-agent
        print_success "CloudWatch agent installed"
    else
        print_warning "CloudWatch agent already installed"
    fi
else
    print_error "Unsupported OS: $OS"
    exit 1
fi

# Create CloudWatch agent configuration
print_step "Creating CloudWatch agent configuration..."
CONFIG_FILE="/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json"

# Create log groups
print_step "Creating CloudWatch log groups..."
LOG_GROUPS=(
    "${LOG_GROUP_PREFIX}-backend"
    "${LOG_GROUP_PREFIX}-frontend"
    "${LOG_GROUP_PREFIX}-document-service"
    "${LOG_GROUP_PREFIX}-ai-service"
    "${LOG_GROUP_PREFIX}-postgres"
    "${LOG_GROUP_PREFIX}-nginx"
)

for LOG_GROUP in "${LOG_GROUPS[@]}"; do
    if ! aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --region "$AWS_REGION" --query "logGroups[?logGroupName=='$LOG_GROUP'].logGroupName" --output text | grep -q "$LOG_GROUP"; then
        aws logs create-log-group --log-group-name "$LOG_GROUP" --region "$AWS_REGION" 2>/dev/null || true
        # Set retention to 7 days
        aws logs put-retention-policy --log-group-name "$LOG_GROUP" --retention-in-days 7 --region "$AWS_REGION" 2>/dev/null || true
        print_success "Log group created: $LOG_GROUP"
    else
        print_warning "Log group already exists: $LOG_GROUP"
    fi
done

# Create CloudWatch agent configuration file
cat > "$CONFIG_FILE" <<EOF
{
    "agent": {
        "metrics_collection_interval": 60,
        "run_as_user": "root"
    },
    "logs": {
        "logs_collected": {
            "files": {
                "collect_list": [
                    {
                        "file_path": "/var/lib/docker/containers/*/*-json.log",
                        "log_group_name": "${LOG_GROUP_PREFIX}-backend",
                        "log_stream_name": "{instance_id}-backend",
                        "timezone": "UTC",
                        "multi_line_start_pattern": "^\\\\{",
                        "encoding": "utf-8"
                    },
                    {
                        "file_path": "/var/lib/docker/containers/*/*-json.log",
                        "log_group_name": "${LOG_GROUP_PREFIX}-frontend",
                        "log_stream_name": "{instance_id}-frontend",
                        "timezone": "UTC",
                        "multi_line_start_pattern": "^\\\\{",
                        "encoding": "utf-8"
                    },
                    {
                        "file_path": "/var/lib/docker/containers/*/*-json.log",
                        "log_group_name": "${LOG_GROUP_PREFIX}-document-service",
                        "log_stream_name": "{instance_id}-document-service",
                        "timezone": "UTC",
                        "multi_line_start_pattern": "^\\\\{",
                        "encoding": "utf-8"
                    },
                    {
                        "file_path": "/var/lib/docker/containers/*/*-json.log",
                        "log_group_name": "${LOG_GROUP_PREFIX}-ai-service",
                        "log_stream_name": "{instance_id}-ai-service",
                        "timezone": "UTC",
                        "multi_line_start_pattern": "^\\\\{",
                        "encoding": "utf-8"
                    },
                    {
                        "file_path": "/var/log/nginx/access.log",
                        "log_group_name": "${LOG_GROUP_PREFIX}-nginx",
                        "log_stream_name": "{instance_id}-nginx-access",
                        "timezone": "UTC"
                    },
                    {
                        "file_path": "/var/log/nginx/error.log",
                        "log_group_name": "${LOG_GROUP_PREFIX}-nginx",
                        "log_stream_name": "{instance_id}-nginx-error",
                        "timezone": "UTC"
                    }
                ]
            }
        }
    },
    "metrics": {
        "namespace": "ISMS/EC2",
        "metrics_collected": {
            "cpu": {
                "measurement": [
                    "cpu_usage_idle",
                    "cpu_usage_iowait",
                    "cpu_usage_user",
                    "cpu_usage_system"
                ],
                "totalcpu": false
            },
            "disk": {
                "measurement": [
                    "used_percent"
                ],
                "resources": [
                    "*"
                ]
            },
            "diskio": {
                "measurement": [
                    "io_time"
                ],
                "resources": [
                    "*"
                ]
            },
            "mem": {
                "measurement": [
                    "mem_used_percent"
                ]
            },
            "netstat": {
                "measurement": [
                    "tcp_established",
                    "tcp_time_wait"
                ]
            },
            "processes": {
                "measurement": [
                    "running",
                    "sleeping",
                    "dead"
                ]
            }
        }
    }
}
EOF

print_success "CloudWatch agent configuration created"

# Start CloudWatch agent
print_step "Starting CloudWatch agent..."
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -c file:$CONFIG_FILE \
    -s

if systemctl is-active --quiet amazon-cloudwatch-agent; then
    print_success "CloudWatch agent is running"
else
    print_error "Failed to start CloudWatch agent"
    exit 1
fi

# Create CloudWatch alarms (optional - requires SNS topic)
print_step "CloudWatch alarms setup..."
print_warning "CloudWatch alarms require SNS topic configuration"
print_warning "To set up alarms, configure SNS topic and use AWS Console or CLI"

echo ""
print_success "CloudWatch monitoring setup completed!"
echo ""
echo "Log groups created:"
for LOG_GROUP in "${LOG_GROUPS[@]}"; do
    echo "  - $LOG_GROUP"
done
echo ""
echo "View logs in CloudWatch Console:"
echo "  https://console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#logsV2:log-groups"
echo ""
echo "CloudWatch agent status:"
echo "  sudo systemctl status amazon-cloudwatch-agent"
echo ""
echo "View agent logs:"
echo "  sudo tail -f /opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log"



