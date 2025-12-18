<!-- d49517f1-fa98-4539-82f2-5eb48c3f64d9 12116fa9-c72b-40c6-b573-b6b6fc1ced31 -->
# Departmental Risk Contribution Module Implementation Plan

## Overview

This plan implements a distributed risk contribution model where Department Heads (Contributors) can submit risks via a simplified wizard, subject to Editor approval through a review workflow.

## Database Schema Changes

### 1. Update User Model (`backend/prisma/schema.prisma`)

- Add `department` field (String, nullable): Choice field with options: IT, HR, Finance, Sales, Operations, Legal, Executive
- Update `role` field to include 'CONTRIBUTOR' option (currently: ADMIN, EDITOR, STAFF)
- Add index on `department` for filtering

### 2. Update Risk Model (`backend/prisma/schema.prisma`)

- Add `department` field (String, nullable): Matches User department options
- Add `status` field (String, default: 'DRAFT'): New states - Draft, Proposed, Active, Rejected, Archived
- Add `wizardData` field (String, nullable): JSON string storing qualitative wizard answers
- Add `rejectionReason` field (String, nullable): Stores feedback when status -> REJECTED
- Add `mergedIntoRiskId` field (String, nullable): Stores ID of parent risk if merged
- Note: `owner` relation already exists via `ownerUserId` field (captured automatically from req.user on creation)
- Add index on `department` and `status` for filtering

### 3. Create Migration

- Generate Prisma migration for schema changes
- Update TypeScript types in `backend/src/types/enums.ts` to include new role and status values

## Backend Implementation

### 4. Update Type Definitions (`backend/src/types/enums.ts`)

- Add `'CONTRIBUTOR'` to `UserRole` type
- Create new `RiskStatus` type: `'DRAFT' | 'PROPOSED' | 'ACTIVE' | 'REJECTED' | 'ARCHIVED'`
- Create `Department` type: `'IT' | 'HR' | 'FINANCE' | 'SALES' | 'OPERATIONS' | 'LEGAL' | 'EXECUTIVE'`

### 5. Update Authorization Middleware (`backend/src/middleware/authorize.ts`)

- Update `requireRole` to accept 'CONTRIBUTOR' role
- Create new middleware `requireDepartmentAccess` for Contributors to filter by department

### 6. Update Risk Routes (`backend/src/routes/risks.ts`)

#### 6.1 GET /api/risks

- Modify to support `?view=department` query parameter
- If user role is CONTRIBUTOR, enforce server-side filter: `department === user.department AND status != 'ARCHIVED'`
- Add `?view=inbox` for Editors/Admins to show `status === 'PROPOSED'` risks
- Update query validation to include new filters

#### 6.2 POST /api/risks

- Update middleware to allow CONTRIBUTOR role (currently only ADMIN/EDITOR)
- Add logic: If Contributor, force `department = user.department` and `status = 'DRAFT'` or `'PROPOSED'`
- Automatically set `ownerUserId = req.user.id` from authenticated user
- If `wizardData` is provided, calculate CIA scores from qualitative inputs:
- Impact level (1-5) maps to same value for C, I, A (simplified CIA)
- Likelihood (1-5) from wizard
- Calculate `calculatedScore = (C + I + A) * L`
- Store `wizardData` as JSON string

#### 6.3 PUT /api/risks/:id

- Add permission checks:
- Contributors can only edit risks where `department === user.department` AND `status IN ('DRAFT', 'PROPOSED')`
- Contributors cannot change status to 'ACTIVE'
- Editors/Admins can edit any risk and change status

#### 6.4 PATCH /api/risks/:id/status (New Endpoint)

- Create new endpoint for status transitions
- Validation:
- Contributors: Only allow `DRAFT -> PROPOSED`
- Editors/Admins: Allow `PROPOSED -> ACTIVE` or `PROPOSED -> REJECTED`
- Accept optional `rejectionReason` in request body
- Store rejectionReason if status becomes REJECTED

#### 6.5 POST /api/risks/:id/merge (New Endpoint)

- Create new endpoint for merging duplicate risks
- Input: `targetRiskId` in request body
- Logic:
- Set current risk `status = 'REJECTED'` (or 'ARCHIVED')
- Set `rejectionReason = 'Merged as duplicate'`
- Set `mergedIntoRiskId = targetRiskId`
- Validation: Only Editors/Admins can merge risks
- Validation: Target risk must exist and be ACTIVE

### 7. Update Risk Service (`backend/src/services/riskService.ts`)

- Add function `calculateCIAFromWizard(impactLevel: number)` returning `{c: number, i: number, a: number}` (all same value)
- Add function `validateStatusTransition(currentStatus: string, newStatus: string, userRole: string)` for state machine validation

## Frontend Implementation

### 8. Update Type Definitions (`frontend/src/types/risk.ts`)

- Add `department`, `status`, `wizardData`, `rejectionReason`, `mergedIntoRiskId` fields to `Risk` interface
- Add `RiskStatus` and `Department` types matching backend

### 9. Update Auth Context (`frontend/src/contexts/AuthContext.tsx`)

- Update `getEffectiveRole()` to return 'CONTRIBUTOR' if applicable
- Add `getUserDepartment()` helper function

### 10. Update ProtectedRoute (`frontend/src/components/ProtectedRoute.tsx`)

- Add 'CONTRIBUTOR' to allowed roles

### 11. Create Risk Wizard Component (`frontend/src/components/RiskWizardModal.tsx`)

Multi-step wizard modal with:

- **Step 1: Definition**
- Threat (TextArea): "What could go wrong?"
- Vulnerability (TextArea): "Why is this possible now?"
- Department (Read-only, auto-populated from user)
- **Step 2: Impact Assessment**
- Radio buttons with 5 options mapping to Impact 1-5
- Options: Minor glitch (1), Internal confusion (2), Customer complaint/<£1k (3), Service outage/Regulatory breach/>£10k (4), Business closure/Loss of license (5)
- **Step 3: Likelihood Assessment**
- Radio buttons with 5 options mapping to Likelihood 1-5
- Options: Almost impossible (1), Once in 5-10 years (2), Once a year (3), Once a month (4), Daily/Happening now (5)
- **Step 4: Review & Submit**
- Display calculated risk score (Impact × Likelihood, where Impact = C+I+A)
- Buttons: "Save as Draft" (sets status=DRAFT) and "Submit Proposal" (sets status=PROPOSED)
- Call POST /api/risks with wizardData JSON

### 12. Create Department Risk Table Component (`frontend/src/components/DepartmentRiskTable.tsx`)

- Simplified table view for Contributors
- Columns: Title, Status, Calculated Score (Low/Med/High badge), Actions (Edit)
- Filter: `department === user.department AND status != 'ARCHIVED'`
- Replace standard "Create Risk" button with "New Risk" that opens RiskWizardModal

### 13. Create Risk Review Queue Component (`frontend/src/components/RiskReviewQueue.tsx`)

- Table view for Editors/Admins showing `status === 'PROPOSED'` risks
- Columns: Title, Department, Submitted By, Calculated Score, Actions
- Actions:
- **Approve**: Opens `RiskApprovalModal` → Updates risk with adjusted scores and sets status = ACTIVE
- **Reject**: Modal with comment field → PATCH status to REJECTED with rejectionReason
- **Merge**: Modal to select existing Active risk → POST to /api/risks/:id/merge with targetRiskId

### 13a. Create Risk Approval Modal Component (`frontend/src/components/RiskApprovalModal.tsx`)

- Modal for Editors to approve proposed risks
- Pre-populate C/I/A scores from wizardData (Impact value - all same value for simplified CIA)
- Editable inputs for Confidentiality, Integrity, Availability (1-5 each) - Editor can adjust before finalizing
- Editable Likelihood input (1-5)
- Display calculated score preview: (C + I + A) × L
- Submit button: Updates risk with adjusted scores and sets status = ACTIVE via PUT /api/risks/:id

### 14. Update RisksPage (`frontend/src/pages/RisksPage.tsx`)

- Add conditional rendering based on user role:
- If CONTRIBUTOR: Show DepartmentRiskTable instead of full table
- If EDITOR/ADMIN: Show standard RisksPage with additional "Review Inbox" button/link
- Add badge count for proposed risks in navigation

### 15. Update Layout Navigation (`frontend/src/components/Layout.tsx`)

- For CONTRIBUTOR role: Add "Department Risks" menu item under Risk Management
- For EDITOR/ADMIN: Add "Review Inbox" menu item with badge showing count of proposed risks
- Update Risk Management menu structure

### 16. Update App Routes (`frontend/src/App.tsx`)

- Add route `/risks/department` for Contributors (DepartmentRiskTable)
- Add route `/risks/review` for Editors/Admins (RiskReviewQueue)
- Update `/risks/risks` route to conditionally show appropriate view

## Testing & Validation

### 17. Test Scenarios

- Contributor can create risk via wizard → saves as DRAFT
- Contributor can submit proposal → status becomes PROPOSED
- Contributor can only see/edit their department's risks
- Contributor cannot set status to ACTIVE
- Editor can see all proposed risks in Review Inbox
- Editor can approve/reject proposals with rejectionReason
- Editor can merge duplicate risks (sets mergedIntoRiskId and rejectionReason)
- Status transitions are enforced correctly
- Approval modal allows editing C/I/A scores before finalizing

## Migration Notes

- Existing risks will need default `status = 'ACTIVE'` (or handle null status)
- Existing users without department will need to be assigned
- WizardData will be null for existing risks (backward compatible)
- `rejectionReason` and `mergedIntoRiskId` will be null for existing risks (backward compatible)

## Important: Global Visibility for Editors/Admins

**CRITICAL REQUIREMENT**: While Contributors are restricted to their specific Department views, Editors and Admins MUST retain global visibility of ALL risks (including Drafts) via the main risk register to prevent orphaned data.

### Implementation Details:

- **Backend (GET /api/risks)**: 
- Contributors: Filtered by `department === user.department AND status != 'ARCHIVED'`
- Editors/Admins: NO department filter applied - show ALL risks globally (all statuses except ARCHIVED by default)

- **Frontend (RisksPage)**:
- Contributors: See DepartmentRiskTable (department-scoped)
- Editors/Admins: See full RisksPage with ALL risks from ALL departments, including Drafts
- Add status filter dropdown to allow filtering by specific status if needed
- Add department filter dropdown for cross-department analysis
- Default view shows all statuses (DRAFT, PROPOSED, ACTIVE, REJECTED) except ARCHIVED

This ensures no risks become orphaned and Editors/Admins can manage the complete risk register.

### To-dos

- [ ] Update Prisma schema: Add department and status fields to User and Risk models, create migration
- [ ] Update TypeScript types: Add CONTRIBUTOR role, RiskStatus, Department enums
- [ ] Update authorization middleware to support CONTRIBUTOR role and department filtering
- [ ] Update risk routes: Add department filtering, status transitions, wizard data handling
- [ ] Add wizard calculation functions: calculateCIAFromWizard, validateStatusTransition
- [ ] Update frontend Risk interface and add new type definitions
- [ ] Create RiskWizardModal component with 4-step wizard (Definition, Impact, Likelihood, Review)
- [ ] Create DepartmentRiskTable component for Contributors with simplified view
- [ ] Create RiskReviewQueue component for Editors with approve/reject/merge actions
- [ ] Update RisksPage to conditionally render based on user role (Contributor vs Editor/Admin)
- [ ] Update Layout navigation to show Department Risks for Contributors and Review Inbox for Editors
- [ ] Add new routes in App.tsx for /risks/department and /risks/review