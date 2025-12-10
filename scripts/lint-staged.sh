#!/bin/bash
# Pre-commit hook to lint only staged files
# Prevents introducing new warnings on commit
# Works for both frontend and backend

set -e

# Get the workspace root
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WORKSPACE_ROOT"

# Get list of staged TypeScript/TSX/JS files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js)$' || true)

if [ -z "$STAGED_FILES" ]; then
  echo "No TypeScript/JavaScript files staged for commit."
  exit 0
fi

echo "Linting staged files..."
echo "$STAGED_FILES" | xargs -I {} echo "  - {}"

# Separate frontend and backend files
FRONTEND_FILES=$(echo "$STAGED_FILES" | grep -E '^frontend/' || true)
BACKEND_FILES=$(echo "$STAGED_FILES" | grep -E '^backend/' || true)

EXIT_CODE=0

# Lint frontend files
if [ -n "$FRONTEND_FILES" ]; then
  echo ""
  echo "Checking frontend files..."
  RELATIVE_FILES=$(echo "$FRONTEND_FILES" | sed 's|^frontend/||')
  cd frontend
  echo "$RELATIVE_FILES" | xargs npx eslint --ext ts,tsx --report-unused-disable-directives --max-warnings 0 || EXIT_CODE=1
  cd ..
fi

# Lint backend files
if [ -n "$BACKEND_FILES" ]; then
  echo ""
  echo "Checking backend files..."
  RELATIVE_FILES=$(echo "$BACKEND_FILES" | sed 's|^backend/||')
  cd backend
  # Backend lint command expects files relative to backend directory
  echo "$RELATIVE_FILES" | xargs npx eslint --ext ts --report-unused-disable-directives --max-warnings 0 || EXIT_CODE=1
  cd ..
fi

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo "✓ All staged files pass linting (no errors, no warnings)"
  exit 0
else
  echo ""
  echo "✗ Linting failed. Please fix the issues before committing."
  echo ""
  echo "Tip: Run 'npm run lint:fix --workspace=<frontend|backend>' to auto-fix some issues."
  exit 1
fi

