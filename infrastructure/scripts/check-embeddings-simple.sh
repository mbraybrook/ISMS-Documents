#!/bin/bash
# Simple script to check control embeddings via direct database query

set -euo pipefail

ENVIRONMENT="${1:-staging}"
AWS_PROFILE="${AWS_PROFILE:-pt-sandbox}"
AWS_REGION="${AWS_REGION:-eu-west-2}"

echo "🔍 Checking control embedding status..."
echo "Environment: $ENVIRONMENT"
echo ""

# Get database credentials
DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "isms-${ENVIRONMENT}-db-credentials" \
  --query 'SecretString' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION")

DATABASE_URL=$(echo "$DB_SECRET" | jq -r '.DATABASE_URL')

if [ -z "$DATABASE_URL" ] || [ "$DATABASE_URL" == "null" ]; then
  echo "❌ Could not get DATABASE_URL"
  exit 1
fi

# Extract connection details
# Format: postgresql://user:password@host:port/database
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|postgresql://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|postgresql://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|postgresql://[^@]*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|postgresql://[^@]*@[^:]*:\([^/]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|postgresql://[^@]*@[^:]*:[^/]*/\(.*\)|\1|p' | sed 's/?.*//')

echo "📊 Querying database: $DB_HOST:$DB_PORT/$DB_NAME"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
  echo "⚠️  psql not found. Install PostgreSQL client:"
  echo "   Ubuntu/Debian: sudo apt-get install postgresql-client"
  echo "   macOS: brew install postgresql"
  echo ""
  echo "Or use AWS RDS Data API or connect via ECS task."
  exit 1
fi

export PGPASSWORD="$DB_PASS"

echo "=== Control Embedding Status ==="
echo ""

# Total controls
TOTAL=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -t -A -c "SELECT COUNT(*) FROM \"Control\";" 2>/dev/null || echo "0")

# Controls with embeddings
WITH_EMBEDDINGS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -t -A -c "SELECT COUNT(*) FROM \"Control\" WHERE embedding IS NOT NULL;" 2>/dev/null || echo "0")

# Controls without embeddings
WITHOUT_EMBEDDINGS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -t -A -c "SELECT COUNT(*) FROM \"Control\" WHERE embedding IS NULL;" 2>/dev/null || echo "0")

# Standard controls without embeddings (these are needed for AI suggestions)
STANDARD_WITHOUT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -t -A -c "SELECT COUNT(*) FROM \"Control\" WHERE \"isStandardControl\" = true AND embedding IS NULL;" 2>/dev/null || echo "0")

echo "Total Controls: $TOTAL"
echo "Controls WITH embeddings: $WITH_EMBEDDINGS"
echo "Controls WITHOUT embeddings: $WITHOUT_EMBEDDINGS"
echo "Standard Controls (ISO 27002) WITHOUT embeddings: $STANDARD_WITHOUT"
echo ""

if [ "$STANDARD_WITHOUT" -gt 0 ]; then
  echo "⚠️  $STANDARD_WITHOUT standard controls are missing embeddings!"
  echo "   AI suggestions will not work until embeddings are generated."
  echo ""
  echo "💡 To backfill embeddings, run:"
  echo "   ./scripts/backfill-control-embeddings.sh $ENVIRONMENT"
else
  echo "✅ All standard controls have embeddings!"
fi
