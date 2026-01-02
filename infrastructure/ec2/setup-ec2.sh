#!/bin/bash
# EC2 Setup Script for ISMS Application
# This script installs and configures all required software on a fresh EC2 instance
#
# Usage: sudo ./setup-ec2.sh
#
# Prerequisites:
# - Run as root or with sudo
# - Ubuntu 22.04 LTS or Amazon Linux 2023
# - Internet connectivity

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    OS_VERSION=$VERSION_ID
else
    echo -e "${RED}Error: Cannot detect OS${NC}"
    exit 1
fi

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

print_step "Starting EC2 setup for ISMS Application"
echo ""

# Update system packages
print_step "Updating system packages..."
if [ "$OS" = "ubuntu" ]; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get upgrade -y -qq
    apt-get install -y -qq curl wget git jq unzip
elif [ "$OS" = "amzn" ] || [ "$OS" = "amazon" ]; then
    yum update -y -q
    # Amazon Linux 2023 has curl-minimal by default which provides curl command
    # Check which packages are already installed and only install missing ones
    PACKAGES_TO_INSTALL=""
    if ! command -v curl &> /dev/null && ! rpm -q curl-minimal &>/dev/null; then
        PACKAGES_TO_INSTALL="$PACKAGES_TO_INSTALL curl"
    fi
    if ! command -v wget &> /dev/null; then
        PACKAGES_TO_INSTALL="$PACKAGES_TO_INSTALL wget"
    fi
    if ! command -v git &> /dev/null; then
        PACKAGES_TO_INSTALL="$PACKAGES_TO_INSTALL git"
    fi
    if ! command -v jq &> /dev/null; then
        PACKAGES_TO_INSTALL="$PACKAGES_TO_INSTALL jq"
    fi
    if ! command -v unzip &> /dev/null; then
        PACKAGES_TO_INSTALL="$PACKAGES_TO_INSTALL unzip"
    fi
    if [ -n "$PACKAGES_TO_INSTALL" ]; then
        yum install -y -q $PACKAGES_TO_INSTALL
    fi
else
    print_error "Unsupported OS: $OS"
    exit 1
fi
print_success "System packages updated"

# Install Docker
print_step "Installing Docker..."
if ! command -v docker &> /dev/null; then
    if [ "$OS" = "ubuntu" ]; then
        # Remove old versions
        apt-get remove -y -qq docker docker-engine docker.io containerd runc 2>/dev/null || true
        
        # Install Docker
        curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
        sh /tmp/get-docker.sh
        rm /tmp/get-docker.sh
    elif [ "$OS" = "amzn" ] || [ "$OS" = "amazon" ]; then
        yum install -y -q docker
        systemctl enable docker
        systemctl start docker
    fi
    print_success "Docker installed"
else
    print_warning "Docker already installed"
fi

# Install Docker Compose
print_step "Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    if [ "$OS" = "ubuntu" ]; then
        apt-get install -y -qq docker-compose-plugin
    elif [ "$OS" = "amzn" ] || [ "$OS" = "amazon" ]; then
        # Install Docker Compose v2 plugin
        mkdir -p /usr/local/lib/docker/cli-plugins
        curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
        chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    fi
    print_success "Docker Compose installed"
else
    print_warning "Docker Compose already installed"
fi

# Install/Update Docker Buildx (required for Docker Compose builds)
print_step "Installing Docker Buildx..."
if ! docker buildx version &> /dev/null; then
    if [ "$OS" = "ubuntu" ]; then
        apt-get install -y -qq docker-buildx-plugin
    elif [ "$OS" = "amzn" ] || [ "$OS" = "amazon" ]; then
        # Install buildx plugin (Amazon Linux 2023 uses /usr/libexec/docker/cli-plugins/)
        mkdir -p /usr/libexec/docker/cli-plugins
        BUILDX_VERSION="v0.17.1"
        curl -SL "https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}/buildx-${BUILDX_VERSION}.linux-amd64" -o /usr/libexec/docker/cli-plugins/docker-buildx
        chmod +x /usr/libexec/docker/cli-plugins/docker-buildx
        # Restart Docker to pick up the plugin
        systemctl restart docker
        sleep 2
        # Create buildx builder instance
        docker buildx create --name builder 2>/dev/null || true
        docker buildx use builder 2>/dev/null || true
        docker buildx inspect --bootstrap builder 2>/dev/null || true
    fi
    print_success "Docker Buildx installed"
else
    # Check if builder exists, create if not
    if ! docker buildx ls 2>/dev/null | grep -q builder; then
        docker buildx create --name builder 2>/dev/null || true
        docker buildx use builder 2>/dev/null || true
        docker buildx inspect --bootstrap builder 2>/dev/null || true
    fi
    print_warning "Docker Buildx already installed"
fi

# Install Nginx
print_step "Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    if [ "$OS" = "ubuntu" ]; then
        apt-get install -y -qq nginx
    elif [ "$OS" = "amzn" ] || [ "$OS" = "amazon" ]; then
        # Amazon Linux 2023 uses dnf/yum directly (no amazon-linux-extras)
        # Check if we're on AL2023 (dnf available) or AL2 (amazon-linux-extras)
        if command -v dnf &> /dev/null; then
            dnf install -y -q nginx
        elif command -v amazon-linux-extras &> /dev/null; then
            amazon-linux-extras install -y -q nginx1
        else
            yum install -y -q nginx
        fi
    fi
    systemctl enable nginx
    print_success "Nginx installed"
else
    print_warning "Nginx already installed"
fi

# Install Certbot (for Let's Encrypt)
print_step "Installing Certbot..."
if ! command -v certbot &> /dev/null; then
    if [ "$OS" = "ubuntu" ]; then
        apt-get install -y -qq certbot python3-certbot-nginx
    elif [ "$OS" = "amzn" ] || [ "$OS" = "amazon" ]; then
        yum install -y -qq certbot python3-certbot-nginx
    fi
    print_success "Certbot installed"
else
    print_warning "Certbot already installed"
fi

# Install AWS CLI (if not present)
print_step "Installing AWS CLI..."
if ! command -v aws &> /dev/null; then
    if [ "$OS" = "ubuntu" ]; then
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
        unzip -q /tmp/awscliv2.zip -d /tmp
        /tmp/aws/install
        rm -rf /tmp/aws /tmp/awscliv2.zip
    elif [ "$OS" = "amzn" ] || [ "$OS" = "amazon" ]; then
        yum install -y -q aws-cli
    fi
    print_success "AWS CLI installed"
else
    print_warning "AWS CLI already installed"
fi

# Create application user
print_step "Creating application user..."
if ! id -u isms &> /dev/null; then
    useradd -m -s /bin/bash isms
    usermod -aG docker isms
    print_success "Application user 'isms' created"
else
    print_warning "User 'isms' already exists"
fi

# Create application directories
print_step "Creating application directories..."
APP_DIR="/opt/isms"
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/data/postgres"
mkdir -p "$APP_DIR/data/ollama"
mkdir -p "$APP_DIR/data/document-cache"
mkdir -p "$APP_DIR/logs"
mkdir -p "$APP_DIR/backups"
chown -R isms:isms "$APP_DIR"
print_success "Application directories created"

# Configure firewall (UFW for Ubuntu, firewalld for Amazon Linux)
print_step "Configuring firewall..."
if [ "$OS" = "ubuntu" ]; then
    if command -v ufw &> /dev/null; then
        ufw --force enable
        ufw allow 22/tcp   # SSH
        ufw allow 80/tcp    # HTTP
        ufw allow 443/tcp  # HTTPS
        print_success "UFW firewall configured"
    fi
elif [ "$OS" = "amzn" ] || [ "$OS" = "amazon" ]; then
    if systemctl is-active --quiet firewalld; then
        firewall-cmd --permanent --add-service=ssh
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --reload
        print_success "Firewalld configured"
    fi
fi

# Configure automatic security updates
print_step "Configuring automatic security updates..."
if [ "$OS" = "ubuntu" ]; then
    apt-get install -y -qq unattended-upgrades
    echo 'Unattended-Upgrade::Automatic-Reboot "false";' >> /etc/apt/apt.conf.d/50unattended-upgrades
    systemctl enable unattended-upgrades
    print_success "Automatic security updates configured"
elif [ "$OS" = "amzn" ] || [ "$OS" = "amazon" ]; then
    # Amazon Linux 2023 uses dnf-automatic, AL2 uses yum-cron
    if command -v dnf &> /dev/null; then
        # Amazon Linux 2023
        dnf install -y -q dnf-automatic
        # Configure dnf-automatic to apply updates
        sed -i 's/apply_updates = no/apply_updates = yes/' /etc/dnf/automatic.conf
        sed -i 's/upgrade_type = default/upgrade_type = security/' /etc/dnf/automatic.conf
        systemctl enable --now dnf-automatic.timer
        print_success "Automatic security updates configured (dnf-automatic)"
    else
        # Amazon Linux 2
        yum install -y -q yum-cron
        sed -i 's/apply_updates = no/apply_updates = yes/' /etc/yum/yum-cron.conf
        systemctl enable yum-cron
        systemctl start yum-cron
        print_success "Automatic security updates configured (yum-cron)"
    fi
fi

# Generate DH parameters for SSL (if not exists)
print_step "Generating DH parameters for SSL..."
if [ ! -f /etc/nginx/dhparam.pem ]; then
    openssl dhparam -out /etc/nginx/dhparam.pem 2048
    print_success "DH parameters generated"
else
    print_warning "DH parameters already exist"
fi

# Create systemd service for Docker Compose
print_step "Creating systemd service for Docker Compose..."
# Determine which docker-compose command to use
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="/usr/local/bin/docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="/usr/bin/docker compose"
else
    DOCKER_COMPOSE_CMD="/usr/local/bin/docker-compose"
fi

cat > /etc/systemd/system/isms.service <<EOF
[Unit]
Description=ISMS Application Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/isms
ExecStart=${DOCKER_COMPOSE_CMD} -f docker-compose.ec2.yml up -d
ExecStop=${DOCKER_COMPOSE_CMD} -f docker-compose.ec2.yml down
TimeoutStartSec=0
User=isms
Group=isms

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
print_success "Systemd service created (not enabled - enable after deployment)"

# Configure log rotation
print_step "Configuring log rotation..."
cat > /etc/logrotate.d/isms <<'EOF'
/opt/isms/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    missingok
    create 0644 isms isms
}
EOF
print_success "Log rotation configured"

# Install CloudWatch agent (optional - can be done separately)
print_step "CloudWatch agent installation..."
print_warning "CloudWatch agent installation skipped (use setup-monitoring.sh to install)"

echo ""
print_success "EC2 setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Copy application files to /opt/isms"
echo "2. Copy .env file to /opt/isms"
echo "3. Copy nginx configuration to /etc/nginx/conf.d/"
echo "4. Run setup-ssl.sh to configure SSL certificates"
echo "5. Run deploy.sh to deploy the application"
echo "6. Enable the service: sudo systemctl enable isms"

