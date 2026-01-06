#!/bin/bash
# Database Backup Script for ISMS Application
# This script backs up PostgreSQL database and uploads to S3 with retention policies
#
# Usage: ./backup.sh [options]
# Options:
#   --local-only    Only create local backup, don't upload to S3
#   --s3-bucket     S3 bucket name (required if uploading to S3)
#   --s3-prefix     S3 prefix/path (default: backups/)
#   --retention     Number of daily backups to keep locally (default: 7)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
LOCAL_ONLY=false
S3_BUCKET=""
S3_PREFIX="backups/"
RETENTION_DAYS=7

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --local-only)
            LOCAL_ONLY=true
            shift
            ;;
        --s3-bucket)
            S3_BUCKET="$2"
            shift 2
            ;;
        --s3-prefix)
            S3_PREFIX="$2"
            shift 2
            ;;
        --retention)
            RETENTION_DAYS="$2"
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

# Check if running as isms user or root
if [ "$EUID" -eq 0 ]; then
    APP_USER="isms"
    APP_DIR="/opt/isms"
else
    APP_USER=$(whoami)
    APP_DIR="${HOME}/isms"
fi

BACKUP_DIR="$APP_DIR/backups"
mkdir -p "$BACKUP_DIR"

# Load environment variables
if [ -f "$APP_DIR/.env" ]; then
    source "$APP_DIR/.env"
else
    print_error ".env file not found in $APP_DIR"
    exit 1
fi

# Get database credentials
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-isms_db}"
DB_PASSWORD="${POSTGRES_PASSWORD}"

if [ -z "$DB_PASSWORD" ]; then
    print_error "POSTGRES_PASSWORD not set in .env file"
    exit 1
fi

# Check if PostgreSQL container is running
if ! docker ps | grep -q "isms-postgres-ec2"; then
    print_error "PostgreSQL container is not running"
    exit 1
fi

# Create backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup-${TIMESTAMP}.sql.gz"

print_step "Starting database backup..."
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Backup file: $BACKUP_FILE"
echo ""

# Perform backup
print_step "Creating database backup..."
export PGPASSWORD="$DB_PASSWORD"
docker exec isms-postgres-ec2 pg_dump -U "$DB_USER" -Fc "$DB_NAME" | gzip > "$BACKUP_FILE"
unset PGPASSWORD

if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    print_success "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"
else
    print_error "Backup file is empty or not created"
    exit 1
fi

# Upload to S3 if configured
if [ "$LOCAL_ONLY" = false ] && [ -n "$S3_BUCKET" ]; then
    print_step "Uploading backup to S3..."
    
    # Check if AWS CLI is available
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed"
        exit 1
    fi
    
    # Upload to S3
    S3_PATH="s3://${S3_BUCKET}/${S3_PREFIX}backup-${TIMESTAMP}.sql.gz"
    aws s3 cp "$BACKUP_FILE" "$S3_PATH"
    
    if [ $? -eq 0 ]; then
        print_success "Backup uploaded to S3: $S3_PATH"
        
        # Apply S3 lifecycle policy (keep last 7 daily, 4 weekly, 12 monthly)
        # Note: This requires S3 bucket lifecycle policy to be configured
        print_warning "Ensure S3 bucket lifecycle policy is configured for automatic cleanup"
    else
        print_error "Failed to upload backup to S3"
        exit 1
    fi
elif [ "$LOCAL_ONLY" = false ] && [ -z "$S3_BUCKET" ]; then
    print_warning "S3 bucket not specified, skipping S3 upload"
    print_warning "Use --s3-bucket option or --local-only to suppress this warning"
fi

# Clean up old local backups
print_step "Cleaning up old local backups (keeping last $RETENTION_DAYS days)..."
OLD_BACKUPS=$(find "$BACKUP_DIR" -name "backup-*.sql.gz" -mtime +$RETENTION_DAYS)
if [ -n "$OLD_BACKUPS" ]; then
    echo "$OLD_BACKUPS" | xargs rm -f
    print_success "Old backups cleaned up"
else
    print_success "No old backups to clean up"
fi

# List remaining backups
REMAINING_BACKUPS=$(find "$BACKUP_DIR" -name "backup-*.sql.gz" | wc -l)
print_success "Local backups remaining: $REMAINING_BACKUPS"

echo ""
print_success "Backup completed successfully!"
echo ""
echo "Backup file: $BACKUP_FILE"
if [ "$LOCAL_ONLY" = false ] && [ -n "$S3_BUCKET" ]; then
    echo "S3 location: s3://${S3_BUCKET}/${S3_PREFIX}backup-${TIMESTAMP}.sql.gz"
fi

# Restore instructions
echo ""
echo "To restore this backup:"
echo "  1. Stop the application: docker-compose -f docker-compose.ec2.yml down"
echo "  2. Restore database:"
echo "     gunzip < $BACKUP_FILE | docker exec -i isms-postgres-ec2 pg_restore -U $DB_USER -d $DB_NAME -c"
echo "  3. Start the application: docker-compose -f docker-compose.ec2.yml up -d"



