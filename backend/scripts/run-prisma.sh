#!/bin/bash
# Wrapper script for Prisma commands that ensures correct DATABASE_URL resolution
# This prevents the nested prisma/prisma/dev.db issue

# Get the absolute path to the backend directory (where this script's parent is)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to backend directory - CRITICAL: Prisma resolves relative paths from CWD
cd "$BACKEND_DIR" || exit 1

# Only set SQLite DATABASE_URL if:
# 1. DATABASE_URL is not already set, OR
# 2. DATABASE_URL is a file: URL (SQLite)
# Otherwise, use the existing DATABASE_URL (e.g., PostgreSQL)
if [ -z "$DATABASE_URL" ] || [[ "$DATABASE_URL" == file:* ]]; then
  # Resolve the database path to an absolute path
  # Use realpath to normalize the path and resolve any symlinks
  if command -v realpath >/dev/null 2>&1; then
    DB_PATH="$(realpath -m "$BACKEND_DIR/prisma/dev.db")"
  else
    # Fallback if realpath is not available
    DB_PATH="$BACKEND_DIR/prisma/dev.db"
    # Normalize path manually (remove double slashes, resolve . and ..)
    DB_PATH="$(cd "$(dirname "$DB_PATH")" && pwd)/$(basename "$DB_PATH")"
  fi

  # Convert Windows-style path separators if needed (for WSL compatibility)
  DB_PATH="${DB_PATH//\\//}"

  # Use absolute path in DATABASE_URL - this is critical!
  DB_URL="file:${DB_PATH}"

  # Export the resolved DATABASE_URL (this overrides any .env file values)
  # This ensures Prisma always uses the correct absolute path regardless of CWD
  export DATABASE_URL="$DB_URL"
fi

# Debug output in development
if [ "${NODE_ENV:-development}" = "development" ]; then
  echo "[PRISMA] Running from: $(pwd)" >&2
  echo "[PRISMA] Database URL: $DATABASE_URL" >&2
fi

# Run the Prisma command with all passed arguments
# Always run from backend directory to ensure schema.prisma is found correctly
exec npx prisma "$@"

