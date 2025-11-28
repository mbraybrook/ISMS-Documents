#!/bin/bash
# Wrapper script to ensure Prisma commands use the correct database path
# This script ensures DATABASE_URL is resolved relative to the backend directory

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to backend directory to ensure relative paths work correctly
cd "$BACKEND_DIR"

# Resolve the database path relative to backend directory
DB_PATH="$BACKEND_DIR/prisma/dev.db"
DB_URL="file:$DB_PATH"

# Export the resolved DATABASE_URL
export DATABASE_URL="$DB_URL"

# Run the Prisma command with all passed arguments
npx prisma "$@"

