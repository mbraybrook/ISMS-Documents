#!/bin/bash
# This script sets up the environment for Prisma commands
# It can be sourced to set DATABASE_URL correctly before running npx prisma

# Get the absolute path to the backend directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Resolve the database path to an absolute path
if command -v realpath >/dev/null 2>&1; then
  DB_PATH="$(realpath -m "$BACKEND_DIR/prisma/dev.db")"
else
  DB_PATH="$BACKEND_DIR/prisma/dev.db"
  DB_PATH="$(cd "$(dirname "$DB_PATH")" && pwd)/$(basename "$DB_PATH")"
fi

# Convert Windows-style path separators if needed (for WSL compatibility)
DB_PATH="${DB_PATH//\\//}"

# Export the resolved DATABASE_URL
export DATABASE_URL="file:${DB_PATH}"

# Change to backend directory
cd "$BACKEND_DIR" || exit 1

