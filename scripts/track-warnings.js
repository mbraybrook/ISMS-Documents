#!/usr/bin/env node
/**
 * Warning Tracking Script (Project-wide)
 * 
 * This script tracks ESLint warning counts over time for both frontend and backend
 * to monitor progress in reducing technical debt across the entire project.
 * 
 * Usage:
 *   node scripts/track-warnings.js          # Record current warning count
 *   node scripts/track-warnings.js --report # Show trend report
 *   node scripts/track-warnings.js --reset  # Reset tracking data
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TRACKING_FILE = join(__dirname, '..', '.warning-tracker.json');

function getWarningCounts() {
  const results = {
    frontend: { errors: 0, warnings: 0, total: 0 },
    backend: { errors: 0, warnings: 0, total: 0 },
    timestamp: new Date().toISOString()
  };

  // Get frontend warnings
  try {
    const frontendOutput = execSync('npm run lint:check --workspace=frontend 2>&1', { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..'),
      stdio: 'pipe'
    });
    
    const frontendMatch = frontendOutput.match(/(\d+)\s+problems?\s+\((\d+)\s+errors?,\s+(\d+)\s+warnings?\)/);
    if (frontendMatch) {
      results.frontend = {
        total: parseInt(frontendMatch[1], 10),
        errors: parseInt(frontendMatch[2], 10),
        warnings: parseInt(frontendMatch[3], 10)
      };
    } else {
      // Try alternative format (just warnings)
      const altMatch = frontendOutput.match(/(\d+)\s+warnings?/);
      if (altMatch) {
        results.frontend.warnings = parseInt(altMatch[1], 10);
        results.frontend.total = results.frontend.warnings;
      }
    }
  } catch (error) {
    // ESLint exits with non-zero if warnings exceed max, but we can still parse output
    const output = error.stdout?.toString() || error.stderr?.toString() || '';
    const match = output.match(/(\d+)\s+problems?\s+\((\d+)\s+errors?,\s+(\d+)\s+warnings?\)/);
    if (match) {
      results.frontend = {
        total: parseInt(match[1], 10),
        errors: parseInt(match[2], 10),
        warnings: parseInt(match[3], 10)
      };
    }
  }

  // Get backend warnings
  try {
    const backendOutput = execSync('npm run lint --workspace=backend 2>&1', { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..'),
      stdio: 'pipe'
    });
    
    const backendMatch = backendOutput.match(/(\d+)\s+problems?\s+\((\d+)\s+errors?,\s+(\d+)\s+warnings?\)/);
    if (backendMatch) {
      results.backend = {
        total: parseInt(backendMatch[1], 10),
        errors: parseInt(backendMatch[2], 10),
        warnings: parseInt(backendMatch[3], 10)
      };
    } else {
      // Try alternative format (just warnings)
      const altMatch = backendOutput.match(/(\d+)\s+warnings?/);
      if (altMatch) {
        results.backend.warnings = parseInt(altMatch[1], 10);
        results.backend.total = results.backend.warnings;
      }
    }
  } catch (error) {
    // ESLint exits with non-zero if warnings exceed max, but we can still parse output
    const output = error.stdout?.toString() || error.stderr?.toString() || '';
    const match = output.match(/(\d+)\s+problems?\s+\((\d+)\s+errors?,\s+(\d+)\s+warnings?\)/);
    if (match) {
      results.backend = {
        total: parseInt(match[1], 10),
        errors: parseInt(match[2], 10),
        warnings: parseInt(match[3], 10)
      };
    }
  }

  // Calculate totals
  results.total = {
    errors: results.frontend.errors + results.backend.errors,
    warnings: results.frontend.warnings + results.backend.warnings,
    total: results.frontend.total + results.backend.total
  };

  return results;
}

function loadTrackingData() {
  if (!existsSync(TRACKING_FILE)) {
    return { entries: [], baseline: null };
  }
  
  try {
    const content = readFileSync(TRACKING_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading tracking file:', error.message);
    return { entries: [], baseline: null };
  }
}

function saveTrackingData(data) {
  writeFileSync(TRACKING_FILE, JSON.stringify(data, null, 2) + '\n');
}

function recordWarningCount() {
  const counts = getWarningCounts();
  
  if (counts.total.warnings === 0 && counts.total.errors === 0) {
    console.error('Could not determine warning/error counts from ESLint output');
    process.exit(1);
  }
  
  const data = loadTrackingData();
  
  // Set baseline if this is the first entry
  if (!data.baseline) {
    data.baseline = {
      ...counts,
      date: new Date().toISOString().split('T')[0]
    };
  }
  
  // Add new entry
  const entry = {
    ...counts,
    date: new Date().toISOString().split('T')[0]
  };
  data.entries.push(entry);
  
  // Keep only last 100 entries to prevent file from growing too large
  if (data.entries.length > 100) {
    data.entries = data.entries.slice(-100);
  }
  
  saveTrackingData(data);
  
  const baseline = data.baseline;
  const change = counts.total.warnings - baseline.total.warnings;
  const changePercent = baseline.total.warnings > 0 
    ? ((change / baseline.total.warnings) * 100).toFixed(1)
    : '0.0';
  
  console.log('\n📊 Warning Count Recorded (Project-wide)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Frontend: ${counts.frontend.warnings} warnings, ${counts.frontend.errors} errors`);
  console.log(`Backend:  ${counts.backend.warnings} warnings, ${counts.backend.errors} errors`);
  console.log(`Total:    ${counts.total.warnings} warnings, ${counts.total.errors} errors`);
  console.log('');
  console.log(`Baseline: ${baseline.total.warnings} warnings (${baseline.date})`);
  
  if (change !== 0) {
    const sign = change > 0 ? '+' : '';
    const emoji = change < 0 ? '📉' : '📈';
    console.log(`Change:   ${sign}${change} (${sign}${changePercent}%) ${emoji}`);
  } else {
    console.log(`Change:   No change`);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

function generateReport() {
  const data = loadTrackingData();
  
  if (data.entries.length === 0) {
    console.log('No tracking data found. Run the script first to record a warning count.');
    return;
  }
  
  const baseline = data.baseline;
  const latest = data.entries[data.entries.length - 1];
  const oldest = data.entries[0];
  
  console.log('\n📈 Warning Reduction Progress Report (Project-wide)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Baseline Date: ${baseline.date}`);
  console.log(`Baseline Count: ${baseline.total.warnings} warnings (Frontend: ${baseline.frontend.warnings}, Backend: ${baseline.backend.warnings})`);
  console.log(`Latest Count:   ${latest.total.warnings} warnings (Frontend: ${latest.frontend.warnings}, Backend: ${latest.backend.warnings})`);
  console.log(`Total Reduction: ${baseline.total.warnings - latest.total.warnings} warnings`);
  
  if (baseline.total.warnings > 0) {
    const reductionPercent = (((baseline.total.warnings - latest.total.warnings) / baseline.total.warnings) * 100).toFixed(1);
    console.log(`Reduction:      ${reductionPercent}%`);
  }
  
  console.log('\nRecent Trend (last 10 entries):');
  console.log('Date       | Frontend | Backend | Total   | Change');
  console.log('───────────┼──────────┼─────────┼─────────┼─────────');
  
  const recentEntries = data.entries.slice(-10);
  for (let i = 0; i < recentEntries.length; i++) {
    const entry = recentEntries[i];
    const prevEntry = i > 0 ? recentEntries[i - 1] : null;
    const change = prevEntry ? entry.total.warnings - prevEntry.total.warnings : 0;
    const changeStr = change === 0 ? '  —' : change > 0 ? `+${change}` : `${change}`;
    
    console.log(`${entry.date} | ${String(entry.frontend.warnings).padStart(8)} | ${String(entry.backend.warnings).padStart(7)} | ${String(entry.total.warnings).padStart(7)} | ${changeStr.padStart(7)}`);
  }
  
  // Calculate average reduction rate
  if (recentEntries.length >= 2) {
    const first = recentEntries[0];
    const last = recentEntries[recentEntries.length - 1];
    const daysDiff = Math.max(1, Math.ceil(
      (new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24)
    ));
    const warningsDiff = first.total.warnings - last.total.warnings;
    const avgPerDay = (warningsDiff / daysDiff).toFixed(1);
    
    console.log(`\nAverage reduction: ${avgPerDay} warnings/day`);
    
    if (warningsDiff > 0 && avgPerDay > 0) {
      const daysToZero = Math.ceil(last.total.warnings / (warningsDiff / daysDiff));
      console.log(`At current rate, zero warnings in: ~${daysToZero} days`);
    }
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

function resetTracking() {
  if (existsSync(TRACKING_FILE)) {
    writeFileSync(TRACKING_FILE, JSON.stringify({ entries: [], baseline: null }, null, 2) + '\n');
    console.log('✓ Tracking data reset');
  } else {
    console.log('No tracking data to reset');
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.includes('--report')) {
  generateReport();
} else if (args.includes('--reset')) {
  resetTracking();
} else {
  recordWarningCount();
}


