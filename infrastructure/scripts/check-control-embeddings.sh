#!/bin/bash
# Check control embedding status in staging/production database

set -euo pipefail

ENVIRONMENT="${1:-staging}"
AWS_PROFILE="${AWS_PROFILE:-pt-sandbox}"
AWS_REGION="${AWS_REGION:-eu-west-2}"

echo "🔍 Checking control embedding status..."
echo "Environment: $ENVIRONMENT"
echo ""

# Get database credentials from Secrets Manager
DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "isms-${ENVIRONMENT}-db-credentials" \
  --query 'SecretString' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION")

DATABASE_URL=$(echo "$DB_SECRET" | jq -r '.DATABASE_URL')

if [ -z "$DATABASE_URL" ] || [ "$DATABASE_URL" == "null" ]; then
  echo "❌ Could not get DATABASE_URL from Secrets Manager"
  exit 1
fi

echo "✅ Connected to database"
echo ""

# Run the check script via a backend task or direct database query
# Option 1: Use a backend task (if available)
CLUSTER_NAME=$(aws cloudformation describe-stacks \
  --stack-name "isms-${ENVIRONMENT}-ecs" \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterName`].OutputValue' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" 2>/dev/null || echo "")

if [ -n "$CLUSTER_NAME" ]; then
  echo "📋 Checking via backend task..."
  
  # Get backend task
  BACKEND_TASK=$(aws ecs list-tasks \
    --cluster "$CLUSTER_NAME" \
    --service-name "isms-${ENVIRONMENT}-backend" \
    --query 'taskArns[0]' \
    --output text \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" 2>/dev/null || echo "")
  
  if [ -n "$BACKEND_TASK" ] && [ "$BACKEND_TASK" != "None" ]; then
    echo "✅ Found backend task: $BACKEND_TASK"
    echo ""
    echo "Running embedding check..."
    aws ecs execute-command \
      --cluster "$CLUSTER_NAME" \
      --task "$BACKEND_TASK" \
      --container backend \
      --command "cd /app && npm run check-control-embeddings" \
      --interactive \
      --profile "$AWS_PROFILE" \
      --region "$AWS_REGION" || echo "⚠️  ECS Exec not available, using direct database query instead"
  fi
fi

# Option 2: Direct database query (fallback)
echo ""
echo "📊 Querying database directly..."

# Extract connection details from DATABASE_URL
# Format: postgresql://user:password@host:port/database
DB_INFO=$(echo "$DATABASE_URL" | sed -n 's|postgresql://\([^:]*\):\([^@]*\)@\([^:]*\):\([^/]*\)/\(.*\)|\1 \2 \3 \4 \5|p')
read -r DB_USER DB_PASS DB_HOST DB_PORT DB_NAME <<< "$DB_INFO"

# Use psql if available, otherwise provide instructions
if command -v psql &> /dev/null; then
  export PGPASSWORD="$DB_PASS"
  
  echo "Total controls:"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -c "SELECT COUNT(*) as total FROM \"Control\";" \
    -t
  
  echo ""
  echo "Controls WITH embeddings:"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -c "SELECT COUNT(*) as count FROM \"Control\" WHERE embedding IS NOT NULL;" \
    -t
  
  echo ""
  echo "Controls WITHOUT embeddings:"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -c "SELECT COUNT(*) as count FROM \"Control\" WHERE embedding IS NULL;" \
    -t
  
  echo ""
  echo "Standard controls (ISO 27002) without embeddings:"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -c "SELECT COUNT(*) as count FROM \"Control\" WHERE \"isStandardControl\" = true AND embedding IS NULL;" \
    -t
else
  echo "⚠️  psql not available. Install PostgreSQL client or use ECS Exec method above."
  echo ""
  echo "Or run this SQL query manually:"
  echo ""
  echo "SELECT"
  echo "  COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embeddings,"
  echo "  COUNT(*) FILTER (WHERE embedding IS NULL) as without_embeddings,"
  echo "  COUNT(*) FILTER (WHERE \"isStandardControl\" = true AND embedding IS NULL) as standard_without_embeddings"
  echo "FROM \"Control\";"
fi

echo ""
echo "💡 To backfill embeddings, run:"
echo "   ./scripts/backfill-control-embeddings.sh $ENVIRONMENT"
