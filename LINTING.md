# Linting Strategy & Tools

This document explains our linting approach and the tools we use to manage warnings.

## Overview

We maintain **strict linting** (`--max-warnings 0`) for CI/CD to ensure code quality, while using a **gradual improvement** strategy for existing technical debt.

## Current Status

- **Errors**: 0 ✅
- **Warnings**: ~666 total
  - Frontend: ~312 warnings
  - Backend: ~354 warnings
  - Mostly `@typescript-eslint/no-explicit-any`
- **Baseline**: Set on first tracking run

## Pre-commit Hook

### What it does:
- Automatically runs ESLint on **only staged files** before each commit
- **Prevents introducing new warnings** - commits are blocked if staged files have warnings
- Works for both frontend (`.ts`, `.tsx`) and backend (`.ts`, `.js`) files

### How it works:
1. When you run `git commit`, the hook automatically triggers
2. It identifies staged TypeScript/JavaScript files
3. Runs ESLint with strict mode (`--max-warnings 0`) on those files only
4. Blocks commit if any warnings or errors are found
5. Provides helpful error messages

### Example:
```bash
$ git add src/components/MyComponent.tsx
$ git commit -m "Add new component"
Running ESLint on staged frontend files...
✗ Linting failed. Please fix the issues before committing.
```

### Bypassing (emergency only):
```bash
git commit --no-verify  # Not recommended!
```

## Warning Tracking

### Purpose:
Track progress in reducing technical debt over time. This helps:
- Monitor improvement trends
- Set realistic goals
- Celebrate progress
- Identify when warning counts spike

### Usage:

#### Record current warning count:
```bash
npm run lint:track
```

This:
- Runs ESLint on both frontend and backend
- Counts warnings for each workspace
- Stores the counts with timestamp
- Compares to baseline
- Shows progress for both workspaces

#### View progress report:
```bash
npm run lint:report
```

Shows:
- Baseline vs current comparison
- Recent trend (last 10 entries)
- Average reduction rate
- Projected timeline to zero warnings

### Integration:

**Daily workflow:**
```bash
# After fixing some warnings
npm run lint:track --workspace=frontend
npm run lint:report --workspace=frontend
```

**CI/CD pipeline:**
```yaml
# Example: Track warnings in CI
- name: Track warning count
  run: |
    cd frontend
    npm run lint:track
    npm run lint:report
```

## Linting Scripts

### Available Commands:

| Command | Purpose |
|---------|---------|
| `npm run lint` | Strict linting (0 warnings allowed) - for CI/CD (both workspaces) |
| `npm run lint:check` | Lenient linting (allows current warning count) - frontend only |
| `npm run lint:fix` | Auto-fix linting issues where possible (both workspaces) |
| `npm run lint:track` | Record current warning count (project-wide) |
| `npm run lint:report` | Show progress report (project-wide) |

### When to use each:

- **`lint`**: CI/CD, pre-commit checks (automatic)
- **`lint:check`**: Local development when you want to see all issues
- **`lint:fix`**: Before committing to auto-fix simple issues
- **`lint:track`**: After fixing warnings to track progress
- **`lint:report`**: Weekly/monthly to review progress

## Strategy

### For New Code:
- ✅ **Zero tolerance**: All new code must pass strict linting
- ✅ Pre-commit hook enforces this automatically
- ✅ No exceptions for new files

### For Existing Code:
- 📈 **Gradual improvement**: Fix warnings when you touch a file
- 📈 Track progress over time
- 📈 Set monthly reduction goals (e.g., "reduce by 50 warnings")

### Best Practices:

1. **Fix warnings in files you modify**: When you edit a file, fix its warnings
2. **Run tracking regularly**: Track progress weekly or after significant fixes
3. **Set goals**: Use reports to set realistic reduction targets
4. **Don't disable rules**: Prefer fixing issues over disabling rules
5. **Use `unknown` instead of `any`**: When possible, use TypeScript's `unknown` type

## File Locations

- Pre-commit hook: `.git/hooks/pre-commit`
- Lint staged script: `scripts/lint-staged.sh` (project-wide)
- Warning tracker: `scripts/track-warnings.js` (project-wide)
- Tracking data: `.warning-tracker.json` (gitignored, project-wide)

## Troubleshooting

### Pre-commit hook not running:
```bash
chmod +x .git/hooks/pre-commit
```

### Want to skip hook temporarily:
```bash
git commit --no-verify  # Use sparingly!
```

### Tracking script fails:
- Ensure you're in the project root directory
- Check that `npm run lint` works for both workspaces
- Verify Node.js version (>=18.0.0)

## Project Structure

The linting system is **project-wide** and tracks both frontend and backend:
- Pre-commit hook checks staged files in both workspaces
- Warning tracker monitors warnings across the entire project
- Reports show breakdown by workspace (frontend/backend) and totals

This ensures consistent code quality across the entire codebase.

