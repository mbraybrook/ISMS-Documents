<!-- b271b0aa-f5a8-41f3-b99d-3b4938b9205c b728baef-ff92-4881-871f-83eb05f2697c -->
# Staff Document Review and Acknowledgment Experience

## Overview

Enhance the ISMS application to provide a focused, read-only experience for STAFF users, with clear visibility into documents requiring acknowledgment, recently updated documents, and ISMS review status.

## Implementation Plan

### 1. Role-Aware Routing and Post-Login Redirect

**Files to modify:**

- `frontend/src/pages/LoginPage.tsx` - Update redirect logic based on user role
- `frontend/src/contexts/AuthContext.tsx` - Add role-based redirect after login
- `frontend/src/App.tsx` - Add new staff routes

**Changes:**

- After successful login, check user role and redirect:
- STAFF → `/staff`
- ADMIN/EDITOR → `/` (existing admin dashboard)
- Update `LoginPage` to use `useNavigate` with role check after `syncUser()`

### 2. Backend: Document Update Logic Enhancement

**Files to modify:**

- `backend/src/routes/documents.ts` - Ensure version change logic is correct

**Changes:**

- Verify that when an APPROVED document's version changes:
- Status remains APPROVED (not reverted to DRAFT)
- `lastChangedDate` is set to current timestamp
- `requiresAcknowledgement` is auto-set to `true` for POLICY type
- This logic appears to already exist (lines 388-405), but verify it's working correctly

### 3. Backend: Staff-Safe Document Endpoint

**Files to modify:**

- `backend/src/routes/documents.ts` - Add role-based filtering

**Changes:**

- Modify `GET /api/documents` to filter by role:
- STAFF: Only return documents where `status = 'APPROVED'`
- ADMIN/EDITOR: Return all documents (existing behavior)
- Add computed fields to response:
- `isOverdueReview`: `nextReviewDate < today && status in ['APPROVED', 'IN_REVIEW']`
- `isUpcomingReview`: `nextReviewDate >= today && nextReviewDate <= today + 30 days && status in ['APPROVED', 'IN_REVIEW']`
- Include `requiresAcknowledgement`, `lastChangedDate`, `lastReviewDate`, `nextReviewDate` in all responses

### 4. Backend: Staff Dashboard Endpoint

**Files to create/modify:**

- `backend/src/routes/dashboard.ts` - Add `GET /api/dashboard/staff` endpoint

**New endpoint: `GET /api/dashboard/staff`**

- Returns staff-specific aggregated data:
- `pendingAcknowledgmentsCount`: Count from existing `/api/acknowledgments/pending` logic
- `recentlyUpdatedDocuments`: List of APPROVED documents sorted by `lastChangedDate DESC`, limit 10
- Include whether user has acknowledged current version
- Include `requiresAcknowledgement` flag
- `reviewStatus`: 
- `overdueCount`: Documents where `nextReviewDate < today && status in ['APPROVED', 'IN_REVIEW']`
- `upcomingCount`: Documents where `nextReviewDate >= today && nextReviewDate <= today + 30 days && status in ['APPROVED', 'IN_REVIEW']`

### 5. Frontend: Staff Home Dashboard

**Files to create:**

- `frontend/src/pages/StaffHomePage.tsx` - New staff-focused dashboard

**Components:**

- "Your required actions" card:
- Display pending acknowledgments count
- Button linking to `/staff/acknowledgments`
- "Recently updated documents" section:
- List of APPROVED documents (from dashboard endpoint)
- Show title, type, version
- Badge: "Acknowledged" (green) or "Pending acknowledgment" (blue)
- Link to open document (SharePoint/Confluence)
- "ISMS review status" section (read-only):
- Card: "Documents overdue for review: N"
- Card: "Documents with reviews due in next 30 days: M"
- No edit actions

### 6. Frontend: Staff Acknowledgment Page

**Files to modify:**

- `frontend/src/pages/AcknowledgmentPage.tsx` - Enhance for STAFF users OR create new `StaffAcknowledgmentPage.tsx`

**Changes:**

- Route: `/staff/acknowledgments` (keep existing `/documents/acknowledgments` for admin/editor)
- Header: "Documents requiring your acknowledgment"
- Empty state: "You have no documents requiring acknowledgment. You are up to date."
- Table columns:
- Title (link to document if URL available)
- Type
- Current version
- Owner
- Storage location (with icon: SharePoint/Confluence)
- "Changed / Pending since" (derived from `lastChangedDate`, e.g., "Changed 12 days ago")
- Badges:
- "Requires acknowledgment" (blue)
- Optionally "Overdue acknowledgment" if `lastChangedDate` older than configurable threshold (e.g., 30 days)
- Actions:
- "Open" button per row (opens SharePoint/Confluence in new tab)
- Global "Acknowledge All" button (calls `POST /api/acknowledgments/bulk`)
- After acknowledgment, refresh list and show empty state if none remain

### 7. Frontend: Staff Documents Page

**Files to create:**

- `frontend/src/pages/StaffDocumentsPage.tsx` - Read-only documents list for STAFF

**Features:**

- Route: `/staff/documents`
- Table columns: Title, Type, Version, Owner, Storage Location
- Badges:
- "Requires acknowledgment" (blue) if `requiresAcknowledgement = true`
- "Overdue for review" (red) if `isOverdueReview = true`
- "Review upcoming" (yellow) if `isUpcomingReview = true`
- "Open" button to launch SharePoint/Confluence URL
- Filters:
- Document type
- Owner
- Review status (All / Overdue review / Upcoming review)
- Acknowledgment requirement (All / Requires acknowledgment)
- No create/edit/delete actions

### 8. Frontend: Route Updates

**Files to modify:**

- `frontend/src/App.tsx` - Add staff routes

**New routes:**

- `/staff` → `StaffHomePage` (STAFF only)
- `/staff/acknowledgments` → `StaffAcknowledgmentPage` or enhanced `AcknowledgmentPage` (STAFF only)
- `/staff/documents` → `StaffDocumentsPage` (STAFF only)

**Route protection:**

- Use `ProtectedRoute` with role check or create `StaffOnlyRoute` component

### 9. Frontend: Navigation Updates

**Files to modify:**

- `frontend/src/components/Layout.tsx` - Hide admin/editor features for STAFF

**Changes:**

- Conditionally hide menu items for STAFF:
- Hide "Document Management" menu (or show only "Acknowledgment" and "Documents")
- Hide "Risk Management" menu
- Hide "Asset Management" menu
- Hide "SoA Export" link
- Show simplified navigation for STAFF:
- "My ISMS" (link to `/staff`)
- "Acknowledgment" (link to `/staff/acknowledgments`)
- "Documents" (link to `/staff/documents`)

### 10. Backend: Authorization Guards

**Files to verify/modify:**

- `backend/src/routes/documents.ts` - Ensure STAFF cannot create/update/delete
- `backend/src/routes/reviews.ts` - Ensure STAFF cannot create/update reviews
- `backend/src/routes/risks.ts` - Ensure STAFF cannot access
- `backend/src/routes/controls.ts` - Ensure STAFF cannot access
- `backend/src/routes/users.ts` - Ensure STAFF cannot access

**Verification:**

- All POST/PUT/DELETE endpoints for documents, reviews, risks, controls, users should have `requireRole('ADMIN', 'EDITOR')` middleware
- GET endpoints should filter data based on role (STAFF sees only APPROVED documents)

### 11. UI Components: Badges and Tooltips

**Files to create/modify:**

- Create reusable badge components or use Chakra UI Badge with consistent styling

**Badge styles:**

- Red: "Overdue for review"
- Yellow: "Review upcoming"
- Blue: "Requires acknowledgment"

**Tooltips:**

- "Overdue for review": "Next review date has passed and the document has not been reviewed."
- "Review upcoming": "Document review is due within the next 30 days."
- "Requires acknowledgment": "You must read this document and acknowledge the current version."

### 12. Testing

**Files to create:**

- Backend tests:
- `backend/src/routes/__tests__/documents.staff.test.ts` - Test STAFF can only see APPROVED documents
- `backend/src/routes/__tests__/acknowledgments.staff.test.ts` - Test pending acknowledgment logic
- `backend/src/routes/__tests__/dashboard.staff.test.ts` - Test staff dashboard endpoint
- Frontend tests:
- `frontend/src/pages/__tests__/StaffHomePage.test.tsx`
- `frontend/src/pages/__tests__/StaffAcknowledgmentPage.test.tsx`
- `frontend/src/pages/__tests__/StaffDocumentsPage.test.tsx`

**Test scenarios:**

- STAFF login redirects to `/staff`
- STAFF cannot access admin endpoints (403 errors)
- STAFF sees only APPROVED documents
- Pending acknowledgments show correctly
- "Acknowledge All" creates acknowledgments and clears list
- Staff dashboard shows correct counts and recently updated documents

### 13. Documentation

**Files to create/modify:**

- `README.md` or `docs/STAFF_USER_GUIDE.md` - Document staff user journey

**Content:**

- Staff user journey: Login → Staff Home → Acknowledgment → Documents
- Configuration: Threshold for "overdue acknowledgment" (environment variable or config)
- Any new environment variables related to review/acknowledgment behavior

## Implementation Order

1. Backend: Document update logic verification and staff-safe filtering
2. Backend: Staff dashboard endpoint
3. Backend: Authorization guard verification
4. Frontend: Role-aware routing and post-login redirect
5. Frontend: Staff Home dashboard
6. Frontend: Staff Acknowledgment page (enhance existing or create new)
7. Frontend: Staff Documents page
8. Frontend: Navigation updates
9. Testing
10. Documentation

### To-dos

- [ ] Verify and enhance document update logic: ensure APPROVED documents with version changes keep status APPROVED and set lastChangedDate
- [ ] Add role-based filtering to GET /api/documents: STAFF sees only APPROVED documents, include computed fields (isOverdueReview, isUpcomingReview)
- [ ] Create GET /api/dashboard/staff endpoint with pendingAcknowledgmentsCount, recentlyUpdatedDocuments, and reviewStatus
- [ ] Verify all admin/editor endpoints have proper requireRole guards and STAFF cannot access them
- [ ] Implement role-aware post-login redirect: STAFF → /staff, ADMIN/EDITOR → /
- [ ] Create StaffHomePage component with required actions, recently updated documents, and ISMS review status sections
- [ ] Create/enhance StaffAcknowledgmentPage with improved UI, badges, and acknowledgment workflow
- [ ] Create StaffDocumentsPage with read-only document list, badges, filters, and open actions
- [ ] Update Layout component to hide admin/editor features for STAFF users and show simplified navigation
- [ ] Add staff routes (/staff, /staff/acknowledgments, /staff/documents) to App.tsx with proper protection
- [ ] Create reusable badge components and tooltips for review status and acknowledgment requirements
- [ ] Add unit and integration tests for staff endpoints, routing, and UI components
- [ ] Document staff user journey, configuration options, and any new environment variables