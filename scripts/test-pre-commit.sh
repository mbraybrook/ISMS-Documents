#!/bin/bash
# Pre-commit hook to run full test suite
# Ensures ALL tests pass before allowing commits
# Works for both frontend and backend

set -e

# Get the workspace root
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WORKSPACE_ROOT"

echo "Running test suite before commit..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

EXIT_CODE=0

# Run backend tests
echo ""
echo "Running backend tests..."
cd backend
if npm test -- --passWithNoTests 2>&1; then
  echo "✓ Backend tests passed"
else
  echo "✗ Backend tests failed"
  EXIT_CODE=1
fi
cd ..

# Run frontend tests
echo ""
echo "Running frontend tests..."
cd frontend
if npm test 2>&1; then
  echo "✓ Frontend tests passed"
else
  echo "✗ Frontend tests failed"
  EXIT_CODE=1
fi
cd ..

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✓ All tests passed"
  exit 0
else
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✗ Tests failed. Please fix failing tests before committing."
  echo ""
  echo "Tip: Run 'npm test' in backend/ or frontend/ to see detailed error messages."
  exit 1
fi




