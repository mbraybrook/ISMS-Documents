---
name: iso27001-risk-dashboard
overview: Review current risk handling/dashboard and outline ISO 27001-aligned reporting plus required data-model changes, then implement new metrics, APIs, and UI with tests.
todos:
  - id: model-extensions
    content: Define schema changes for acceptance + treatment actions + snapshots
    status: completed
  - id: backend-metrics
    content: Implement dashboard aggregations and API filters
    status: completed
    dependencies:
      - model-extensions
  - id: frontend-dashboard
    content: Update dashboard UI with new metrics and drilldowns
    status: completed
    dependencies:
      - backend-metrics
  - id: tests
    content: Add backend + frontend tests for new metrics/UI
    status: completed
    dependencies:
      - backend-metrics
      - frontend-dashboard
---

# ISO 27001 Risk Dashboard Enhancements

## Current State (Key Files)

- Risk data model and scoring are in [`backend/prisma/schema.prisma`](/home/developer/dev/ISMS-Documentation/backend/prisma/schema.prisma) and [`backend/src/services/riskService.ts`](/home/developer/dev/ISMS-Documentation/backend/src/services/riskService.ts).
- Dashboard risk metrics are computed in [`backend/src/routes/dashboard.ts`](/home/developer/dev/ISMS-Documentation/backend/src/routes/dashboard.ts) and [`backend/src/services/riskDashboardService.ts`](/home/developer/dev/ISMS-Documentation/backend/src/services/riskDashboardService.ts).
- Frontend risk dashboard widgets are in [`frontend/src/components/RiskDashboardSection.tsx`](/home/developer/dev/ISMS-Documentation/frontend/src/components/RiskDashboardSection.tsx) and [`frontend/src/pages/HomePage.tsx`](/home/developer/dev/ISMS-Documentation/frontend/src/pages/HomePage.tsx) using [`frontend/src/types/riskDashboard.ts`](/home/developer/dev/ISMS-Documentation/frontend/src/types/riskDashboard.ts).

## Proposed Changes

1. **Data Model Extensions (Reporting+)**

- Add ISO 27001-aligned fields and entities to support inherent vs residual, acceptance, and treatment progress:
- `Risk.acceptedAt`, `Risk.acceptedByUserId`, `Risk.acceptanceRationale`, `Risk.appetiteThreshold` (or link to org-level appetite settings).
- `Risk.reviewCadenceDays` and `Risk.nextReviewDate` enforcement (already exists but not driven by cadence).
- New `RiskTreatmentAction` table: `riskId`, `title`, `ownerUserId`, `dueDate`, `status`, `effectiveness`, `completedAt`.
- Optional `RiskMetricSnapshot` table for time-series dashboards without recompute over historical data.
- Update Prisma schema and add a migration.

2. **Backend Aggregations and APIs**

- Extend `/api/dashboard` and `/api/dashboard/risk-dashboard/summary` to include ISO 27001 dashboard metrics:
- Inherent vs residual by level and by department/category.
- Treatment progress: open/overdue actions, completion rate, effectiveness distribution.
- Risk acceptance: count of accepted residual risks above appetite, acceptance aging.
- Review discipline: overdue reviews, upcoming reviews by owner/department.
- Nonconformance signals: existing `policyNonConformance` + missing mitigations.
- Add filters for department/category/owner/status to make charts interactive.

3. **Frontend Dashboard UX**

- Extend types in [`frontend/src/types/riskDashboard.ts`](/home/developer/dev/ISMS-Documentation/frontend/src/types/riskDashboard.ts) and consume new APIs.
- Update [`frontend/src/components/RiskDashboardSection.tsx`](/home/developer/dev/ISMS-Documentation/frontend/src/components/RiskDashboardSection.tsx) to show:
- Risk heatmap (Likelihood vs Impact).
- Inherent vs residual comparison.
- Treatment actions KPI tile + overdue list.
- Risk acceptance and appetite breaches.
- Drill-through interactions to [`frontend/src/pages/RisksPage.tsx`](/home/developer/dev/ISMS-Documentation/frontend/src/pages/RisksPage.tsx) with pre-filled filters.
- Align HomePage summary tiles to these metrics where relevant.

4. **Testing**

- Add/extend backend tests in [`backend/src/routes/__tests__/dashboard.test.ts`](/home/developer/dev/ISMS-Documentation/backend/src/routes/__tests__/dashboard.test.ts) for new aggregates.
- Update frontend tests in [`frontend/src/components/__tests__/RiskDashboardSection.test.tsx`](/home/developer/dev/ISMS-Documentation/frontend/src/components/__tests__/RiskDashboardSection.test.tsx) for new UI states and filters.

## Assumptions

- ISO 27001 alignment focuses on risk assessment, treatment planning, and SoA-type control coverage reporting.
- We will keep existing risk scoring (CIA × likelihood) and add fields to compute/record residual and treatment progress rather than replace it.