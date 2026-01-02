#!/bin/bash
# Deployment Script for ISMS Application on EC2
# This script handles building, backing up, migrating, and deploying the application
#
# Usage: ./deploy.sh [options]
# Options:
#   --skip-backup    Skip database backup
#   --skip-migrate   Skip database migrations
#   --pull           Pull latest code from Git before building
#   --no-build       Skip building images (use existing images)

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
            shift
            ;;
        --no-build)
            NO_BUILD=true
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

# Determine application directory and user
# Always use /opt/isms for production deployment
APP_DIR="/opt/isms"
APP_USER=$(whoami)

# If running as root, switch to isms user for operations
if [ "$EUID" -eq 0 ]; then
    APP_USER="isms"
fi

# Determine Docker Compose command (prefer standalone, fallback to plugin)
# Standalone docker-compose doesn't require buildx
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
    print_info "Using standalone docker-compose"
elif docker compose version &> /dev/null; then
    # Check if buildx is available (required for docker compose plugin)
    if docker buildx version &> /dev/null 2>&1; then
        DOCKER_COMPOSE="docker compose"
        print_info "Using docker compose plugin"
    else
        print_error "Docker Compose plugin requires buildx, but buildx is not available"
        print_error "Please install buildx or use standalone docker-compose"
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

print_step "Starting deployment for ISMS Application"
echo ""

# Pull latest code if requested
if [ "$PULL_CODE" = true ]; then
    print_step "Pulling latest code from Git..."
    if [ -d ".git" ]; then
        git pull
        print_success "Code updated"
    else
        print_warning "Not a Git repository, skipping pull"
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
    
    # Get database credentials from .env
    source .env
    DB_USER="${POSTGRES_USER:-postgres}"
    DB_NAME="${POSTGRES_DB:-isms_db}"
    
    # Create backup filename with timestamp
    BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sql.gz"
    
    # Check if postgres container is running
    if docker ps | grep -q "isms-postgres-ec2"; then
        # Backup using docker exec
        docker exec isms-postgres-ec2 pg_dump -U "$DB_USER" -Fc "$DB_NAME" | gzip > "$BACKUP_FILE"
        print_success "Database backed up to $BACKUP_FILE"
        
        # Keep only last 7 backups
        ls -t "$BACKUP_DIR"/backup-*.sql.gz | tail -n +8 | xargs -r rm
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
    
    # Docker Compose v5 requires buildx - check if it's available
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
    
    # Ensure builder instance exists
    if ! docker buildx ls 2>/dev/null | grep -q builder; then
        print_step "Creating buildx builder instance..."
        docker buildx create --name builder 2>/dev/null || true
        docker buildx use builder 2>/dev/null || true
        docker buildx inspect --bootstrap builder 2>/dev/null || true
    fi
    
    $DOCKER_COMPOSE -f docker-compose.ec2.yml build
    print_success "Docker images built"
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
    
    # Start postgres first
    $DOCKER_COMPOSE -f docker-compose.ec2.yml up -d postgres
    
    # Wait for postgres to be ready
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
    
    # Run migrations using backend container
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
if systemctl is-active --quiet nginx; then
    print_step "Reloading Nginx..."
    sudo systemctl reload nginx
    print_success "Nginx reloaded"
fi

echo ""
print_success "Deployment completed successfully!"
echo ""
echo "Services status:"
$DOCKER_COMPOSE -f docker-compose.ec2.yml ps
echo ""
echo "To view logs:"
echo "  $DOCKER_COMPOSE -f docker-compose.ec2.yml logs -f"



