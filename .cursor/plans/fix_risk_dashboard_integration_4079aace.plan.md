---
name: Fix Risk Dashboard Integration
overview: Fix the "No data available" issue and merge the new Risk Dashboard functionality into the existing Risk Statistics section, replacing duplicate metrics while preserving unique elements like risk distributions and alerts.
todos: []
---

# Fix Risk Dashboard Integration

## Issues Identified

1. **"No data available" error**: The RiskDashboardSection component shows "No data available" when:

- API call fails (error handling sets data to null)
- Quarterly series is empty (no risks with dateAdded, or all risks are in same quarter but calculation fails)
- Need to handle edge cases and show current snapshot even without quarterly history

2. **Risk Statistics section unchanged**: The existing Risk Statistics section uses current totals from `/api/dashboard`, while new dashboard uses quarterly aggregation. Need to merge intelligently.

## Solution Plan

### 1. Fix Backend Service - Handle Edge Cases

- **File**: `backend/src/services/riskDashboardService.ts`
- Add fallback: If no quarterly data exists, calculate current snapshot from all risks (similar to existing dashboard logic)
- Handle risks with null/undefined dateAdded by using current date or createdAt
- Ensure service always returns valid data structure even with zero risks

### 2. Fix Frontend Component - Better Error Handling

- **File**: `frontend/src/components/RiskDashboardSection.tsx`
- Improve error handling: Don't set data to null on error, show error message instead
- Handle empty quarterly_series gracefully: Show latest_snapshot even if no history
- Add better loading/error states

### 3. Merge Dashboards - Update Risk Statistics Section

- **File**: `frontend/src/pages/HomePage.tsx`
- Replace the 4 KPI tiles in Risk Statistics section with data from Risk Dashboard (latest_snapshot)
- Add breakdown chart (donut) to Risk Statistics section
- Add quarterly trend chart to Risk Statistics section
- Keep Risk Distribution sections (Total and Mitigated) - these are unique
- Keep alerts (Mitigations Not Implemented, Policy Non-Conformance) - these are unique
- Remove the separate RiskDashboardSection component call (merge into Risk Statistics)

### 4. Update Backend - Provide Current Snapshot Fallback

- **File**: `backend/src/services/riskDashboardService.ts`
- If quarterly_series is empty, calculate latest_snapshot from all current risks (not just by quarter)
- This ensures there's always meaningful data to display

## Implementation Details

### Backend Changes

- Modify `getRiskDashboardSummary()` to:
- Handle risks with missing dateAdded (use createdAt or current date)
- If no quarterly data, calculate snapshot from all current risks
- Always return valid data structure

### Frontend Changes

- Update RiskDashboardSection to:
- Show latest_snapshot even if quarterly_series is empty
- Display helpful message if no quarterly history but show current metrics
- Better error messages

- Update HomePage Risk Statistics section to:
- Use `riskDashboardApi.getSummary()` instead of `dashboardData.risks.*`
- Replace 4 KPI tiles with latest_snapshot data
- Add charts below KPI tiles
- Keep existing Risk Distribution and Alert sections