# Linting Scripts

This directory contains scripts for managing ESLint warnings and tracking progress.

## Pre-commit Hook

The pre-commit hook (`lint-staged.sh`) automatically runs ESLint on staged TypeScript/TSX files before each commit. It prevents introducing new warnings or errors.

### How it works:
- Only checks files that are staged for commit
- Uses strict mode (`--max-warnings 0`) to prevent new warnings
- Blocks the commit if linting fails
- Provides helpful error messages

### Usage:
The hook runs automatically on `git commit`. No manual action needed.

### Bypassing (if needed):
```bash
git commit --no-verify  # Not recommended, but available in emergencies
```

## Warning Tracking Script

The `track-warnings.js` script monitors ESLint warning counts over time to track progress in reducing technical debt.

### Commands:

#### Record current warning count:
```bash
npm run lint:track
```

This will:
- Run ESLint and count warnings
- Store the count with a timestamp
- Set a baseline on first run
- Show comparison to baseline

#### View progress report:
```bash
npm run lint:report
```

This shows:
- Baseline vs current warning count
- Total reduction achieved
- Recent trend (last 10 entries)
- Average reduction rate
- Projected timeline to zero warnings

#### Reset tracking data:
```bash
node scripts/track-warnings.js --reset
```

### Example Output:

**Recording:**
```
📊 Warning Count Recorded
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current:  312 warnings
Baseline: 350 warnings (2025-12-01)
Change:   -38 (-10.9%) 📉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Report:**
```
📈 Warning Reduction Progress Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Baseline Date: 2025-12-01
Baseline Count: 350 warnings
Latest Count:   312 warnings
Total Reduction: 38 warnings
Reduction:      10.9%

Recent Trend (last 10 entries):
Date       | Warnings | Change
───────────┼──────────┼─────────
2025-12-01 |      350 |      —
2025-12-02 |      345 |      -5
2025-12-03 |      340 |      -5
...

Average reduction: 3.8 warnings/day
At current rate, zero warnings in: ~82 days
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Best Practices:

1. **Run tracking regularly**: Add `npm run lint:track` to your daily workflow or CI/CD pipeline
2. **Set goals**: Use the report to set monthly reduction targets (e.g., "reduce by 50 warnings this month")
3. **Celebrate progress**: Share reports with the team to show improvement
4. **Focus on modified files**: The pre-commit hook ensures new code doesn't add warnings

### Integration with CI/CD:

Add to your CI pipeline:
```yaml
# Example GitHub Actions
- name: Track warning count
  run: |
    cd frontend
    npm run lint:track
    npm run lint:report
```

This will track warnings over time and help you monitor progress automatically.








