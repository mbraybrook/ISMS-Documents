---
name: Backend Routes Test Coverage
overview: Create comprehensive test coverage for all backend route files to achieve 80%+ coverage, prioritizing critical routes first and following established test patterns.
todos:
  - id: test-health-route
    content: Create test suite for health.ts route (simplest, good starting point)
    status: completed
  - id: test-auth-route
    content: Create comprehensive test suite for auth.ts route covering user sync, email validation, and role assignment
    status: completed
  - id: test-users-route
    content: Create test suite for users.ts route covering list and update operations with role-based access
    status: completed
  - id: test-dashboard-route
    content: Create comprehensive test suite for dashboard.ts route covering all statistics calculations
    status: in_progress
  - id: test-controls-route
    content: Create comprehensive test suite for controls.ts route covering CRUD operations, filtering, and embedding computation
    status: pending
  - id: test-reviews-route
    content: Create test suite for reviews.ts route covering dashboard data, task management, and review completion
    status: pending
  - id: test-soa-route
    content: Create test suite for soa.ts route covering export generation and export history
    status: pending
  - id: test-suppliers-route
    content: Create comprehensive test suite for suppliers.ts route covering CRUD and lifecycle operations
    status: pending
  - id: test-assets-route
    content: Create test suite for assets.ts route covering CRUD operations and category associations
    status: pending
  - id: test-interested-parties-route
    content: Create test suite for interestedParties.ts route covering CRUD operations
    status: pending
  - id: test-legislation-route
    content: Create test suite for legislation.ts route covering CRUD operations
    status: pending
  - id: test-supporting-routes
    content: Create test suites for remaining supporting routes (assetCategories, classifications, sharepoint, confluence, supplierExitPlans, supplierLinks, trust routes)
    status: pending
  - id: enhance-acknowledgments-tests
    content: Enhance existing acknowledgments.test.ts to reach 80%+ coverage by adding tests for uncovered lines
    status: pending
  - id: enhance-documents-tests
    content: Enhance existing documents.test.ts to reach 80%+ coverage by adding tests for versioning, file operations, and complex scenarios
    status: pending
  - id: enhance-risks-tests
    content: Enhance existing risks.test.ts to reach 80%+ coverage by adding tests for import, similarity, embeddings, and complex filtering
    status: pending
---

# Backend Routes Test Coverage Plan

## Current State

**Coverage Summary:**

- **Total routes**: 21 files, ~131 route handlers
- **Routes with tests**: 3 (acknowledgments, documents, risks)
- **Current coverage**: 15.94% overall
  - `acknowledgments.ts`: 66.33% (needs enhancement)
  - `documents.ts`: 39% (needs enhancement)
  - `risks.ts`: 38.16% (needs enhancement)
  - All other routes: 0% coverage

## Testing Strategy

### Test Patterns (Following Existing Tests)

All route tests should follow the established pattern:

- Use `supertest` for HTTP testing
- Mock authentication/authorization middleware
- Mock Prisma database operations
- Mock external services (SharePoint, Confluence, etc.)
- Test CRUD operations, validation, role-based access, error handling

### What to Test for Each Route

#### Core Test Categories:

1. **Authentication & Authorization**

   - Unauthenticated requests → 401
   - Unauthorized role access → 403
   - Role-based filtering (CONTRIBUTOR department filtering)
   - Permission checks

2. **CRUD Operations**

   - Create (POST) with valid/invalid data
   - Read (GET) single item and list
   - Update (PUT/PATCH) with valid/invalid data
   - Delete (DELETE) with authorization checks

3. **Validation**

   - Request body validation (express-validator)
   - Query parameter validation
   - Path parameter validation (UUIDs, etc.)
   - Invalid data handling

4. **Filtering & Pagination**

   - Query filters (status, type, date ranges, etc.)
   - Pagination (page, limit)
   - Sorting/ordering
   - Role-based filtering (STAFF/CONTRIBUTOR restrictions)

5. **Business Logic**

   - Status transitions
   - Workflow logic
   - Calculations (scores, counts, etc.)
   - Relationships (linking entities)

6. **Error Handling**

   - Database errors → 500
   - Not found → 404
   - Validation errors → 400
   - Service errors → appropriate status codes

## Route Prioritization

### Phase 1: Critical Routes (Priority 1)

**Target: 80%+ coverage**

#### 1.1 auth.ts (0% coverage, 176 lines)

**File**: `backend/src/routes/__tests__/auth.test.ts`

**Test Cases:**

- ✅ POST `/api/auth/sync` - User synchronization
  - Create new user (first user becomes ADMIN)
  - Update existing user
  - Email domain validation
  - Entra ID lookup fallback
  - Error handling (database errors)

#### 1.2 users.ts (0% coverage, 124 lines)

**File**: `backend/src/routes/__tests__/users.test.ts`

**Test Cases:**

- ✅ GET `/api/users` - List users
  - Role filtering
  - Admin/Editor access only
  - Response format
- ✅ PUT `/api/users/:id` - Update user
  - Role updates (Admin only)
  - Department updates
  - User not found → 404
  - Validation errors

#### 1.3 dashboard.ts (0% coverage, 663 lines)

**File**: `backend/src/routes/__tests__/dashboard.test.ts`

**Test Cases:**

- ✅ GET `/api/dashboard` - Dashboard statistics
  - Document statistics (overdue, upcoming, missing review dates)
  - Review task statistics
  - Risk statistics (by level, by status)
  - Acknowledgment statistics (user-specific)
  - Control statistics
  - Error handling

#### 1.4 controls.ts (0% coverage, 874 lines)

**File**: `backend/src/routes/__tests__/controls.test.ts`

**Test Cases:**

- ✅ GET `/api/controls` - List controls
  - Pagination
  - Filtering (isApplicable, implemented, category, selectionReason)
  - Admin/Editor access only
- ✅ GET `/api/controls/:id` - Get single control
  - Include relationships
  - Not found → 404
- ✅ POST `/api/controls` - Create control
  - Validation
  - Embedding computation
  - Admin/Editor access only
- ✅ PUT `/api/controls/:id` - Update control
  - Validation
  - Embedding updates
  - Not found → 404
- ✅ DELETE `/api/controls/:id` - Delete control
  - Authorization checks
  - Cascade handling

### Phase 2: Important Business Routes (Priority 2)

**Target: 80%+ coverage**

#### 2.1 reviews.ts (0% coverage, 420 lines)

**File**: `backend/src/routes/__tests__/reviews.test.ts`

**Test Cases:**

- ✅ GET `/api/reviews/dashboard` - Review dashboard data
- ✅ GET `/api/reviews/tasks` - List review tasks
- ✅ POST `/api/reviews/tasks` - Create review task
- ✅ PUT `/api/reviews/tasks/:id` - Update review task
- ✅ POST `/api/reviews/tasks/:id/complete` - Complete review
- ✅ POST `/api/reviews/documents/:id/set-date` - Set review date

#### 2.2 soa.ts (0% coverage, 137 lines)

**File**: `backend/src/routes/__tests__/soa.test.ts`

**Test Cases:**

- ✅ POST `/api/soa/export` - Generate SoA export
  - Excel format generation
  - PDF format (not implemented → 501)
  - File download headers
  - Export record creation
  - Admin/Editor access only
- ✅ GET `/api/soa/exports` - List exports
  - Pagination
  - Admin/Editor access only

#### 2.3 suppliers.ts (0% coverage, 588 lines)

**File**: `backend/src/routes/__tests__/suppliers.test.ts`

**Test Cases:**

- ✅ GET `/api/suppliers` - List suppliers
  - Filtering, pagination
- ✅ GET `/api/suppliers/:id` - Get supplier
- ✅ POST `/api/suppliers` - Create supplier
- ✅ PUT `/api/suppliers/:id` - Update supplier
- ✅ DELETE `/api/suppliers/:id` - Delete supplier
- ✅ Supplier lifecycle operations
- ✅ Supplier risk/control associations

#### 2.4 assets.ts (0% coverage, 416 lines)

**File**: `backend/src/routes/__tests__/assets.test.ts`

**Test Cases:**

- ✅ GET `/api/assets` - List assets
- ✅ GET `/api/assets/:id` - Get asset
- ✅ POST `/api/assets` - Create asset
- ✅ PUT `/api/assets/:id` - Update asset
- ✅ DELETE `/api/assets/:id` - Delete asset
- ✅ Asset category associations

#### 2.5 interestedParties.ts (0% coverage, 275 lines)

**File**: `backend/src/routes/__tests__/interestedParties.test.ts`

**Test Cases:**

- ✅ GET `/api/interested-parties` - List interested parties
- ✅ GET `/api/interested-parties/:id` - Get interested party
- ✅ POST `/api/interested-parties` - Create interested party
- ✅ PUT `/api/interested-parties/:id` - Update interested party
- ✅ DELETE `/api/interested-parties/:id` - Delete interested party

#### 2.6 legislation.ts (0% coverage, 397 lines)

**File**: `backend/src/routes/__tests__/legislation.test.ts`

**Test Cases:**

- ✅ GET `/api/legislation` - List legislation
- ✅ GET `/api/legislation/:id` - Get legislation
- ✅ POST `/api/legislation` - Create legislation
- ✅ PUT `/api/legislation/:id` - Update legislation
- ✅ DELETE `/api/legislation/:id` - Delete legislation

### Phase 3: Supporting Routes (Priority 3)

**Target: 80%+ coverage**

#### 3.1 health.ts (0% coverage, 26 lines)

**File**: `backend/src/routes/__tests__/health.test.ts`

**Test Cases:**

- ✅ GET `/api/health` - Health check
  - Database connection success
  - Database connection failure
  - Response format
  - Database URL masking

#### 3.2 assetCategories.ts (0% coverage, 218 lines)

**File**: `backend/src/routes/__tests__/assetCategories.test.ts`

**Test Cases:**

- ✅ CRUD operations for asset categories
- ✅ Validation and error handling

#### 3.3 classifications.ts (0% coverage, 173 lines)

**File**: `backend/src/routes/__tests__/classifications.test.ts`

**Test Cases:**

- ✅ CRUD operations for classifications
- ✅ Validation and error handling

#### 3.4 sharepoint.ts (0% coverage, 635 lines)

**File**: `backend/src/routes/__tests__/sharepoint.test.ts`

**Test Cases:**

- ✅ SharePoint file operations
- ✅ Authentication/authorization
- ✅ Error handling for SharePoint API failures

#### 3.5 confluence.ts (0% coverage, 108 lines)

**File**: `backend/src/routes/__tests__/confluence.test.ts`

**Test Cases:**

- ✅ Confluence page operations
- ✅ Authentication/authorization
- ✅ Error handling for Confluence API failures

#### 3.6 supplierExitPlans.ts (0% coverage, 194 lines)

**File**: `backend/src/routes/__tests__/supplierExitPlans.test.ts`

**Test Cases:**

- ✅ CRUD operations for exit plans
- ✅ Supplier associations

#### 3.7 supplierLinks.ts (0% coverage, 381 lines)

**File**: `backend/src/routes/__tests__/supplierLinks.test.ts`

**Test Cases:**

- ✅ CRUD operations for supplier links
- ✅ Relationship management

#### 3.8 trust/index.ts (0% coverage, ~1247 lines)

**File**: `backend/src/routes/__tests__/trust.test.ts`

**Test Cases:**

- ✅ Trust Center routes (document management, user management)
- ✅ Trust authentication
- ✅ File operations

#### 3.9 trust/auth.ts (0% coverage, ~349 lines)

**File**: `backend/src/routes/__tests__/trustAuth.test.ts`

**Test Cases:**

- ✅ Trust Center authentication routes
- ✅ Login/logout
- ✅ Token management

### Phase 4: Enhance Existing Tests

**Target: 80%+ coverage for existing test files**

#### 4.1 acknowledgments.test.ts (Current: 66.33%)

**Enhancement Areas:**

- Test uncovered lines: 14,23,79-80,96,127-129,138,181-182,198,206,220,224,253-254,265-329
- Add edge cases
- Add error scenarios
- Test bulk operations more thoroughly

#### 4.2 documents.test.ts (Current: 39%)

**Enhancement Areas:**

- Test uncovered lines: extensive gaps throughout
- Add tests for:
  - Document versioning
  - SharePoint/Confluence integration
  - File upload/download
  - Review date management
  - Status transitions
  - Complex filtering scenarios

#### 4.3 risks.test.ts (Current: 38.16%)

**Enhancement Areas:**

- Test uncovered lines: extensive gaps
- Add tests for:
  - Risk import (CSV)
  - Similarity checking
  - Embedding computation
  - Complex filtering
  - Risk-control associations
  - Status transitions
  - Wizard data handling

## Test File Structure

```
backend/src/routes/__tests__/
├── auth.test.ts                    (NEW)
├── users.test.ts                   (NEW)
├── dashboard.test.ts               (NEW)
├── controls.test.ts                (NEW)
├── reviews.test.ts                 (NEW)
├── soa.test.ts                     (NEW)
├── suppliers.test.ts               (NEW)
├── assets.test.ts                  (NEW)
├── interestedParties.test.ts        (NEW)
├── legislation.test.ts              (NEW)
├── health.test.ts                  (NEW)
├── assetCategories.test.ts          (NEW)
├── classifications.test.ts         (NEW)
├── sharepoint.test.ts              (NEW)
├── confluence.test.ts              (NEW)
├── supplierExitPlans.test.ts       (NEW)
├── supplierLinks.test.ts           (NEW)
├── trust.test.ts                   (NEW)
├── trustAuth.test.ts               (NEW)
├── acknowledgments.test.ts         (ENHANCE - existing)
├── documents.test.ts                (ENHANCE - existing)
└── risks.test.ts                   (ENHANCE - existing)
```

## Common Test Patterns

### Setup Pattern

```typescript
import request from 'supertest';
import express from 'express';
import { myRouter } from '../myRoute';
import { mockUsers } from '../../lib/test-helpers';

// Mock authentication
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { email: 'test@paythru.com', sub: 'test-sub', name: 'Test', oid: 'test-oid' };
    next();
  },
}));

// Mock authorization
jest.mock('../../middleware/authorize', () => ({
  requireRole: jest.fn(() => (req: any, res: any, next: any) => next()),
  requireDepartmentAccess: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: { /* model mocks */ },
}));

// Mock services
jest.mock('../../services/myService', () => ({
  myServiceFunction: jest.fn(),
}));
```

### Test Structure Pattern

```typescript
describe('MyRoute API', () => {
  let app: express.Application;
  let prisma: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/myroute', myRouter);
    prisma = require('../../lib/prisma').prisma;
    jest.clearAllMocks();
  });

  describe('GET /api/myroute', () => {
    it('should return list with pagination', async () => {
      // Arrange
      prisma.model.findMany.mockResolvedValue([...]);
      prisma.model.count.mockResolvedValue(10);

      // Act
      const response = await request(app)
        .get('/api/myroute?page=1&limit=10')
        .expect(200);

      // Assert
      expect(response.body.data).toHaveLength(10);
      expect(response.body.pagination).toBeDefined();
    });
  });
});
```

## Coverage Goals

- **Phase 1 (Critical)**: 80%+ coverage on auth, users, dashboard, controls
- **Phase 2 (Important)**: 80%+ coverage on reviews, soa, suppliers, assets, interestedParties, legislation
- **Phase 3 (Supporting)**: 80%+ coverage on all remaining routes
- **Phase 4 (Enhancement)**: Bring existing tests to 80%+ coverage

## Implementation Approach

### Step 1: Start with Simplest Routes

Begin with `health.ts` (26 lines) to establish patterns, then move to `users.ts` (124 lines).

### Step 2: Critical Routes

Focus on auth, users, dashboard, controls - these are most important for application functionality.

### Step 3: Business Routes

Add tests for reviews, soa, suppliers, assets, etc. - core business functionality.

### Step 4: Supporting Routes

Complete coverage for remaining routes.

### Step 5: Enhance Existing

Fill gaps in acknowledgments, documents, risks tests to reach 80%+.

## Testing Best Practices

1. **Test Isolation**: Each test should be independent
2. **Mock External Dependencies**: Prisma, services, external APIs
3. **Test Both Success and Failure**: Happy paths and error cases
4. **Role-Based Testing**: Test with different user roles (ADMIN, EDITOR, STAFF, CONTRIBUTOR)
5. **Validation Testing**: Test express-validator rules
6. **Edge Cases**: Empty results, pagination boundaries, invalid UUIDs
7. **Error Handling**: Database errors, service errors, validation errors

## Notes

- Some routes are very large (risks.ts: 1801 lines, documents.ts: 1570 lines) - focus on critical paths first
- External service routes (SharePoint, Confluence) require careful mocking
- Trust Center routes may have separate authentication flow
- File upload/download routes need special handling for binary data
- Complex routes may benefit from integration tests in addition to unit tests