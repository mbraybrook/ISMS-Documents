#!/bin/sh
# Startup script for backend container
# Runs database migrations before starting the application
# This script is idempotent and safe to run multiple times

set -e

echo "[$(date -Iseconds)] Starting backend container..."

# Verify required environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

# Start Xvfb for LibreOffice (if script exists)
if [ -f /usr/local/bin/start-xvfb.sh ]; then
  echo "[$(date -Iseconds)] Starting Xvfb for LibreOffice..."
  /usr/local/bin/start-xvfb.sh
fi

# Verify Prisma CLI is available
if ! command -v npx >/dev/null 2>&1; then
  echo "ERROR: npx is not available"
  exit 1
fi

# Run Prisma migrations
# migrate deploy is idempotent - it will only apply pending migrations
# Migrations are now idempotent (use IF NOT EXISTS) to handle cases where objects already exist
echo "[$(date -Iseconds)] Running database migrations..."
if ! npx prisma migrate deploy; then
  echo "ERROR: Database migration failed"
  echo ""
  echo "If the error mentions 'already exists' or 'relation already exists', this usually means:"
  echo "  1. The migration was applied manually or through a different process"
  echo "  2. The migration history is out of sync with the database state"
  echo ""
  echo "To resolve this, you can:"
  echo "  1. Mark the migration as applied: npx prisma migrate resolve --applied <migration_name>"
  echo "  2. Or use the helper script: ./scripts/resolve-migration-conflict.sh <migration_name> --applied"
  echo ""
  echo "This is a fatal error. The application will not start without a properly migrated database."
  exit 1
fi
echo "[$(date -Iseconds)] Database migrations completed successfully"

# Always seed system data (Controls, Classifications, etc.) if missing
# This ensures essential system data is present on first deployment
# System seed is idempotent - it checks if data exists before seeding
echo "[$(date -Iseconds)] Ensuring system data is seeded..."
if ! SEED_SCOPE=system npm run db:seed; then
  echo "WARNING: System data seed failed, but continuing startup..."
  # System seed failures are non-fatal - the app can run without seed data
else
  echo "[$(date -Iseconds)] System data check completed"
fi

# Optionally run additional seed (only if SEED_SCOPE is set and not 'none' or 'system')
# This allows seeding test/demo data via SEED_SCOPE=full or SEED_SCOPE=reference
if [ -n "$SEED_SCOPE" ] && [ "$SEED_SCOPE" != "none" ] && [ "$SEED_SCOPE" != "system" ]; then
  echo "[$(date -Iseconds)] Running additional database seed with scope: $SEED_SCOPE"
  if ! npm run db:seed; then
    echo "WARNING: Additional database seed failed, but continuing startup..."
    # Seed failures are non-fatal - the app can run without seed data
  else
    echo "[$(date -Iseconds)] Additional database seed completed successfully"
  fi
fi

# Start the application
echo "[$(date -Iseconds)] Starting application..."
if [ "$NODE_ENV" = "development" ]; then
  exec npm run dev
fi
exec npm start

