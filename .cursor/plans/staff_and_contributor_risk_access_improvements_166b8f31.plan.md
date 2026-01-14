---
name: Staff and Contributor Risk Access Improvements
overview: Enhance risk access controls to allow Staff read-only access to all risks and Contributors to view all risks while only editing their department's risks. Fix the department filter removal bug.
todos:
  - id: backend-staff-role
    content: Add STAFF role to GET /api/risks endpoint and update filtering logic to allow Staff to view all risks
    status: completed
  - id: backend-staff-permissions
    content: Add permission checks to prevent Staff from creating (POST) or editing (PUT) risks
    status: completed
  - id: backend-contributor-filtering
    content: Update Contributor filtering to allow viewing all risks while maintaining edit restrictions
    status: completed
  - id: backend-department-protection
    content: Add explicit validation to prevent Contributors from changing department field
    status: completed
  - id: frontend-staff-table
    content: Create StaffRiskTable component with read-only risk view
    status: completed
  - id: frontend-fix-filter-bug
    content: Fix department filter removal bug in DepartmentRiskTable component
    status: completed
  - id: frontend-contributor-updates
    content: Update DepartmentRiskTable to show all risks and restrict editing to department risks only
    status: completed
    dependencies:
      - frontend-fix-filter-bug
  - id: frontend-risks-page-routing
    content: Update RisksPage to show appropriate component based on user role (Staff/Contributor/Admin/Editor)
    status: completed
    dependencies:
      - frontend-staff-table
      - frontend-contributor-updates
  - id: frontend-navigation
    content: Update navigation menu and routes to support Staff access to risks
    status: completed
  - id: backend-tests
    content: Add tests for Staff role permissions and update Contributor tests
    status: completed
    dependencies:
      - backend-staff-role
      - backend-staff-permissions
      - backend-contributor-filtering
  - id: frontend-tests
    content: Add tests for StaffRiskTable and update DepartmentRiskTable tests
    status: completed
    dependencies:
      - frontend-staff-table
      - frontend-fix-filter-bug
---

# Staff and Contributor Risk Access Improvements

## Overview

This plan implements improved risk access controls:

- **Staff**: Read-only access to all risks with simplified view
- **Contributors**: Can view all risks but only edit risks from their department
- Fixes the department filter removal bug in the Contributor view

## Current State Analysis

### Backend (`backend/src/routes/risks.ts`)

- GET `/api/risks` currently only allows `ADMIN`, `EDITOR`, `CONTRIBUTOR` roles
- Contributors are restricted to only seeing their department's risks (lines 118-137)
- PUT `/api/risks/:id` prevents Contributors from editing non-department risks (lines 846-879)
- Contributors cannot change department field (line 878)

### Frontend

- `DepartmentRiskTable` component is used for Contributors
- Department filter is pre-set and doesn't reliably clear (line 449 in `DepartmentRiskTable.tsx`)
- `RisksPage` shows `DepartmentRiskTable` for Contributors (line 1453)
- Staff role is not currently included in risks access

## Implementation Plan

### 1. Backend: Update Risk List Endpoint (`backend/src/routes/risks.ts`)

#### 1.1 Add STAFF Role to GET `/api/risks`

- Update `requireRole` middleware to include `'STAFF'` (line 41)
- Modify permission-based filtering logic (lines 117-153):
- **Staff**: Can see all risks (no department filter), cannot see archived risks by default
- **Contributors**: Can see all risks (remove department restriction), cannot see archived risks
- **Admin/Editor**: Keep existing behavior (global visibility with optional department filter)

#### 1.2 Add Permission Check for POST `/api/risks`

- Add check to prevent Staff from creating risks (around line 500)
- Return 403 error if Staff attempts to create a risk

#### 1.3 Update PUT `/api/risks/:id` Permission Checks

- Add check to prevent Staff from editing risks (around line 814)
- Ensure Contributors cannot modify the `department` field (already enforced at line 878, but add explicit validation)
- Contributors can edit all other fields for their department's risks

### 2. Frontend: Create Staff Read-Only Risk View

#### 2.1 Create `StaffRiskTable` Component (`frontend/src/components/StaffRiskTable.tsx`)

- Copy structure from `DepartmentRiskTable.tsx`
- Remove all edit capabilities:
- Remove "New Risk" button
- Remove `onRowClick` handler that opens edit modal
- Remove `RiskWizardModal` and `RiskFormModal` imports/usage
- Make table rows non-clickable (or show read-only detail view)
- Allow viewing all risks (no department pre-filter)
- Include same filtering options as `DepartmentRiskTable` (search, category, nature, status, department, risk level)
- Display same columns: Date Added, Title, Department, Status, Score, Category, Owner

### 3. Frontend: Update Contributor Risk View

#### 3.1 Fix Department Filter Bug in `DepartmentRiskTable.tsx`

- **Issue**: `onClearFilters` resets department to `effectiveDepartment` (line 449), preventing filter removal
- **Fix**: Allow department filter to be cleared completely:
- Change line 449: `department: effectiveDepartment || ''` to `department: ''`
- Update `fetchRisks` logic (lines 131-140) to handle empty department filter:
- When `filters.department` is empty, don't send department param
- Only send `testDepartment` and `view=department` when department filter is explicitly set
- **Fix**: Update `useEffect` that auto-sets department (lines 104-109):
- Only auto-set department on initial load if user is Contributor
- Don't force department filter if user clears it

#### 3.2 Update `DepartmentRiskTable` for All-Risks View

- Remove department pre-filter requirement (line 74)
- Allow Contributors to view all risks by default
- Only restrict editing to department risks (handled by backend)
- Update component to show edit button/action only for department risks
- Add visual indicator (e.g., badge or disabled state) for non-department risks

### 4. Frontend: Update RisksPage Routing

#### 4.1 Update `RisksPage.tsx` Component Logic

- Modify role-based rendering (around line 1452):
- **Staff**: Show `StaffRiskTable` component
- **Contributor**: Show `DepartmentRiskTable` component (updated)
- **Admin/Editor**: Show existing full `RisksPage` view

### 5. Frontend: Update Navigation and Routing

#### 5.1 Update `App.tsx` Routes

- Ensure `/admin/risks/risks` route allows Staff access
- Update `ProtectedRoute` if needed to allow Staff role

#### 5.2 Update `Layout.tsx` Navigation

- Add "Risk Register" menu item for Staff users (read-only)
- Ensure Contributors see appropriate risk management menu items

### 6. Backend: Ensure Department Field Protection

#### 6.1 Add Explicit Department Field Validation

- In PUT `/api/risks/:id`, explicitly prevent Contributors from changing department:
- If `updateData.department` is provided and differs from existing risk's department, reject for Contributors
- Return clear error message: "Contributors cannot change the department of a risk"

## Testing Considerations

### Backend Tests (`backend/src/routes/__tests__/risks.test.ts`)

- Add tests for Staff role:
- Staff can GET all risks
- Staff cannot POST new risks (403)
- Staff cannot PUT/update risks (403)
- Update Contributor tests:
- Contributors can GET all risks (not just department)
- Contributors can PUT only their department's risks
- Contributors cannot change department field
- Contributors cannot set status to ACTIVE

### Frontend Tests

- Test `StaffRiskTable` component:
- Renders read-only view
- No edit buttons visible
- Filters work correctly
- Test `DepartmentRiskTable` updates:
- Department filter can be cleared
- All risks visible when filter cleared
- Edit only available for department risks

## Files to Modify

### Backend

- `backend/src/routes/risks.ts` - Update role checks and filtering logic
- `backend/src/routes/__tests__/risks.test.ts` - Add Staff role tests

### Frontend

- `frontend/src/components/StaffRiskTable.tsx` - **NEW** - Read-only risk table for Staff
- `frontend/src/components/DepartmentRiskTable.tsx` - Fix filter bug, allow all-risks view
- `frontend/src/pages/RisksPage.tsx` - Update role-based component rendering
- `frontend/src/App.tsx` - Verify route permissions
- `frontend/src/components/Layout.tsx` - Update navigation menu
- `frontend/src/components/__tests__/StaffRiskTable.test.tsx` - **NEW** - Component tests
- `frontend/src/components/__tests__/DepartmentRiskTable.test.tsx` - Update existing tests

## Risk Review System

The existing risk review/approval system remains unchanged:

- Contributors submit risks with status `DRAFT` or `PROPOSED`
- Editors/Admins review and approve via `RiskReviewQueue`
- Status transitions: `DRAFT` → `PROPOSED` → `ACTIVE` (or `REJECTED`)

## Migration Notes

- No database schema changes required
- Existing Contributor users will automatically gain ability to view all risks
- Staff users will gain read-only access to risks
- No data migration needed