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
echo "[$(date -Iseconds)] Running database migrations..."
if ! npx prisma migrate deploy; then
  echo "ERROR: Database migration failed"
  echo "This is a fatal error. The application will not start without a properly migrated database."
  exit 1
fi
echo "[$(date -Iseconds)] Database migrations completed successfully"

# Optionally run seed (only if SEED_SCOPE is set and not 'none')
# Seed is also idempotent - it uses upsert operations
if [ -n "$SEED_SCOPE" ] && [ "$SEED_SCOPE" != "none" ]; then
  echo "[$(date -Iseconds)] Running database seed with scope: $SEED_SCOPE"
  if ! npm run db:seed; then
    echo "WARNING: Database seed failed, but continuing startup..."
    # Seed failures are non-fatal - the app can run without seed data
  else
    echo "[$(date -Iseconds)] Database seed completed successfully"
  fi
fi

# Start the application
echo "[$(date -Iseconds)] Starting application..."
exec npm start

