#!/bin/bash
# Wrapper script for Prisma commands
# Ensures Prisma runs from the backend directory where schema.prisma is located

# Get the absolute path to the backend directory (where this script's parent is)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to backend directory - CRITICAL: Prisma resolves schema.prisma and .env from CWD
cd "$BACKEND_DIR" || exit 1

# Load .env file and explicitly export DATABASE_URL to work around Prisma WASM validation bug
if [ -f "$BACKEND_DIR/.env" ]; then
  # Use a simple parser to extract DATABASE_URL from .env
  while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    # Remove leading/trailing whitespace
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)
    # Remove quotes if present
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    # Export DATABASE_URL explicitly
    if [ "$key" = "DATABASE_URL" ]; then
      export DATABASE_URL="$value"
    fi
  done < "$BACKEND_DIR/.env"
fi

# Run the Prisma command with all passed arguments
exec npx prisma "$@"

