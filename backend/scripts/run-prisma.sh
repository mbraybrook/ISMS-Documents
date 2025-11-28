#!/bin/bash
# Wrapper script for Prisma commands that ensures correct DATABASE_URL resolution
# This prevents the nested prisma/prisma/dev.db issue

# Get the absolute path to the backend directory (where this script's parent is)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to backend directory
cd "$BACKEND_DIR"

# Resolve the database path to an absolute path
DB_PATH="$BACKEND_DIR/prisma/dev.db"
DB_URL="file:$DB_PATH"

# Export the resolved DATABASE_URL (this overrides any .env file values)
export DATABASE_URL="$DB_URL"

# Run the Prisma command with all passed arguments
exec npx prisma "$@"

