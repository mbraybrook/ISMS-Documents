---
name: Trust Center User Management Implementation Plan
overview: ""
todos:
  - id: schema_changes
    content: Add isActive field to ExternalUser model and create migration
    status: completed
  - id: auth_updates
    content: Update login and JWT validation to check isActive flag
    status: completed
    dependencies:
      - schema_changes
  - id: backend_endpoints
    content: Create user management API endpoints (list, details, revoke, restore)
    status: completed
    dependencies:
      - schema_changes
  - id: audit_logging
    content: Add audit logging for access revocation/restoration and login success
    status: completed
    dependencies:
      - schema_changes
  - id: frontend_types
    content: Update frontend type definitions to include isActive and UserDetails
    status: completed
  - id: frontend_api
    content: Add user management methods to trustApi service
    status: completed
    dependencies:
      - frontend_types
  - id: frontend_ui
    content: Add User Management tab to TrustCenterAdminPage with list, filters, and details modal
    status: completed
    dependencies:
      - frontend_api
  - id: backend_tests
    content: Write backend tests for user management endpoints
    status: completed
    dependencies:
      - backend_endpoints
  - id: frontend_tests
    content: Update frontend tests for TrustCenterAdminPage with user management
    status: completed
    dependencies:
      - frontend_ui
---

# Trust Center User Management Implementation Plan

## Overview

This plan adds basic user management functionality to the Trust Center, allowing administrators to monitor, view details, and revoke access for external user accounts. The implementation includes database schema changes, backend API endpoints, and frontend UI components.

## Database Schema Changes

### 1. Update ExternalUser Model (`backend/prisma/schema.prisma`)

Add `isActive` field to the `ExternalUser` model:

- `isActive` (Boolean, default: true) - Controls whether the account can log in (separate from `isApproved`)
- Add index on `isActive` for filtering queries

This allows administrators to:

- Keep approval history (`isApproved` remains true)
- Temporarily disable accounts without deleting them
- Re-enable accounts without re-approval

### 2. Create Migration

Generate Prisma migration: `npm run db:migrate -- --name add_external_user_is_active`

## Backend Implementation

### 3. Update Authentication Logic (`backend/src/routes/trust/auth.ts`)

**Update login endpoint** to check both `isApproved` and `isActive`:

- If `isApproved` is false: return "Account pending approval"
- If `isActive` is false: return "Account access has been revoked. Please contact support."
- Only allow login if both are true

**Update JWT validation middleware** (`backend/src/middleware/trustAuth.ts`):

- When validating JWT tokens, check that the user's `isActive` flag is still true
- If `isActive` is false, invalidate the token and return 403

### 4. Create User Management Endpoints (`backend/src/routes/trust/index.ts`)

**GET /api/trust/admin/users**

- Protected: requires `authenticateToken` + `requireRole('ADMIN', 'EDITOR')`
- Query parameters:
  - `status`: Filter by approval status ('pending', 'approved', 'all') - default: 'all'
  - `active`: Filter by active status (true/false) - optional
  - `search`: Search by email or company name - optional
  - `limit`: Pagination limit - optional
  - `offset`: Pagination offset - optional
- Returns: Array of external users with basic info:
  ```typescript
  {
    id: string;
    email: string;
    companyName: string;
    isApproved: boolean;
    isActive: boolean;
    createdAt: string;
  }[]
  ```


**GET /api/trust/admin/users/:userId**

- Protected: requires `authenticateToken` + `requireRole('ADMIN', 'EDITOR')`
- Returns user details with activity summary:
  ```typescript
  {
    id: string;
    email: string;
    companyName: string;
    isApproved: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    termsAcceptedAt: string | null;
    // Activity stats
    lastLoginDate: string | null; // From audit logs (LOGIN_SUCCESS action)
    totalDownloads: number; // Count from TrustDownload table
    approvalDate: string | null; // From audit logs (USER_APPROVED action)
    approvedBy: string | null; // Internal user email from audit log
  }
  ```


**PUT /api/trust/admin/users/:userId/revoke**

- Protected: requires `authenticateToken` + `requireRole('ADMIN', 'EDITOR')`
- Sets `isActive = false` for the user
- Increments `tokenVersion` to invalidate existing JWT tokens
- Logs action in `TrustAuditLog` (action: 'USER_ACCESS_REVOKED')
- Returns updated user object

**PUT /api/trust/admin/users/:userId/restore**

- Protected: requires `authenticateToken` + `requireRole('ADMIN', 'EDITOR')`
- Sets `isActive = true` for the user
- Logs action in `TrustAuditLog` (action: 'USER_ACCESS_RESTORED')
- Returns updated user object

### 5. Update Audit Logging

Update `logTrustAction` calls to include new actions:

- `USER_ACCESS_REVOKED` - When admin revokes access
- `USER_ACCESS_RESTORED` - When admin restores access
- `LOGIN_SUCCESS` - When external user successfully logs in (for tracking last login)

**Update login endpoint** to log successful logins:

- After successful login, log `LOGIN_SUCCESS` action with `performedByExternalUserId`

### 6. Update Type Definitions

Update `backend/src/types/trust.ts` (if exists) or create type definitions for:

- User list response type
- User details response type
- User management request/response types

## Frontend Implementation

### 7. Update Trust API Service (`frontend/src/services/trustApi.ts`)

Add new methods:

```typescript
async getAllUsers(filters?: {
  status?: 'pending' | 'approved' | 'all';
  active?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ExternalUser[]>

async getUserDetails(userId: string): Promise<UserDetails>

async revokeUserAccess(userId: string): Promise<ExternalUser>

async restoreUserAccess(userId: string): Promise<ExternalUser>
```

### 8. Update Type Definitions (`frontend/src/types/trust.ts`)

Add `isActive` field to `ExternalUser` interface:

```typescript
export interface ExternalUser {
  // ... existing fields
  isActive?: boolean;
}
```

Add new `UserDetails` interface:

```typescript
export interface UserDetails extends ExternalUser {
  lastLoginDate: string | null;
  totalDownloads: number;
  approvalDate: string | null;
  approvedBy: string | null;
}
```

### 9. Update Trust Center Admin Page (`frontend/src/pages/TrustCenterAdminPage.tsx`)

**Add new "User Management" tab** (4th tab, after Settings):

- Tab name: "User Management"
- Content: User management interface

**User Management Tab Features:**

1. **User List Table**:

   - Columns: Email, Company, Status (Badge: Approved/Pending), Active (Badge: Active/Revoked), Registered Date, Actions
   - Status filter dropdown: All / Pending / Approved
   - Active filter dropdown: All / Active / Revoked
   - Search input: Filter by email or company name
   - Pagination controls (if needed)

2. **User Actions**:

   - "View Details" button - Opens modal with user summary
   - "Revoke Access" button (only if `isActive === true`) - Confirms then revokes
   - "Restore Access" button (only if `isActive === false`) - Confirms then restores
   - "Approve" button (only if `isApproved === false`) - Uses existing approve function
   - "Deny" button (only if `isApproved === false`) - Uses existing deny function

3. **User Details Modal**:

   - Basic Info: Email, Company, Registration Date, Approval Status, Active Status
   - Activity Summary:
     - Last Login: Date (or "Never" if null)
     - Total Downloads: Number
     - Approval Date: Date (or "Not approved" if null)
     - Approved By: Email (or "N/A" if null)
   - Close button

**State Management:**

- Add `users` state for all users list
- Add `selectedUser` state for details modal
- Add `userDetails` state for detailed user info
- Add filter states: `statusFilter`, `activeFilter`, `searchQuery`
- Add loading states for user operations

**Functions to Add:**

- `loadUsers()` - Fetch users with current filters
- `handleViewDetails(userId)` - Fetch and display user details
- `handleRevokeAccess(userId)` - Revoke user access
- `handleRestoreAccess(userId)` - Restore user access
- `handleFilterChange()` - Update filters and reload users

### 10. Update Existing Pending Requests Tab

The existing "Pending Requests" tab can remain as-is (shows only unapproved users). The new "User Management" tab will show all users with filtering options.

## Testing Requirements

### Backend Tests (`backend/src/routes/trust/__tests__/`)

Create test file: `userManagement.test.ts`

Test cases:

1. GET /api/trust/admin/users - Returns all users with filters
2. GET /api/trust/admin/users/:userId - Returns user details with activity stats
3. PUT /api/trust/admin/users/:userId/revoke - Revokes access and invalidates tokens
4. PUT /api/trust/admin/users/:userId/restore - Restores access
5. Login fails when isActive is false
6. JWT validation fails when isActive is false

### Frontend Tests (`frontend/src/pages/__tests__/`)

Update `TrustCenterAdminPage.test.tsx`:

1. Test user management tab renders
2. Test user list displays correctly
3. Test filtering works (status, active, search)
4. Test view details modal shows correct info
5. Test revoke/restore access actions
6. Test API calls are made correctly

## Implementation Order

1. Database schema changes (migration)
2. Backend authentication updates (login + JWT validation)
3. Backend API endpoints (user management routes)
4. Frontend type definitions
5. Frontend API service methods
6. Frontend UI components (user management tab)
7. Tests (backend + frontend)

## Files to Modify

**Backend:**

- `backend/prisma/schema.prisma` - Add `isActive` field
- `backend/src/routes/trust/auth.ts` - Update login logic
- `backend/src/middleware/trustAuth.ts` - Update JWT validation
- `backend/src/routes/trust/index.ts` - Add user management endpoints
- `backend/src/services/trustAuditService.ts` - Add new action types (if needed)

**Frontend:**

- `frontend/src/types/trust.ts` - Add `isActive` and `UserDetails` types
- `frontend/src/services/trustApi.ts` - Add user management methods
- `frontend/src/pages/TrustCenterAdminPage.tsx` - Add user management tab

**Tests:**

- `backend/src/routes/trust/__tests__/userManagement.test.ts` - New test file
- `frontend/src/pages/__tests__/TrustCenterAdminPage.test.tsx` - Update existing tests