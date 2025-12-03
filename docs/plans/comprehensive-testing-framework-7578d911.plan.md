<!-- 7578d911-ee73-4b69-a667-9f1aebfcf8cb ddc3d880-849c-447b-b3a7-7dc2e06be9a4 -->
# Comprehensive Testing Framework Implementation Plan

## Current State Assessment

### Existing Tests

- **Backend**: Jest configured with 5 test files, but many are incomplete/placeholders
- `documents.test.ts` - Basic CRUD tests (incomplete)
- `acknowledgments.test.ts` - Basic acknowledgment tests (incomplete)
- `authorize.test.ts` - Placeholder only
- `soaService.test.ts` - Basic SoA generation tests
- `riskService.test.ts` - Risk calculation utilities (complete)
- **Frontend**: Vitest configured but **NO test files exist**
- **E2E**: Playwright configured with 3 placeholder test files (all commented out)

### Issues Identified

1. No frontend component/unit tests
2. E2E tests are placeholders without authentication mocking
3. Backend tests lack comprehensive coverage
4. No test coverage reporting
5. No CI/CD pipeline configuration
6. Authentication mocking not set up for E2E tests

## Critical Behaviors to Test

### 1. Authentication & Authorization

- MSAL token validation and user sync
- Role-based access control (ADMIN, EDITOR, STAFF, CONTRIBUTOR)
- Department-based filtering for Contributors
- Email domain restrictions
- Token expiration handling

### 2. Document Management

- CRUD operations with role-based permissions
- Document status transitions (DRAFT → IN_REVIEW → APPROVED)
- Version management
- SharePoint/Confluence integration
- Document filtering and pagination

### 3. Acknowledgment Workflow

- Pending documents retrieval
- Bulk acknowledgment
- Version tracking for acknowledgments
- Staff-only access enforcement

### 4. Review Management

- Review task creation and scheduling
- Review completion workflow
- Dashboard calculations (overdue, due soon)
- Review history tracking

### 5. Risk Management

- Risk creation with wizard data
- Risk score calculations (CIA + likelihood)
- Status transitions (DRAFT → PROPOSED → ACTIVE)
- Department-based access for Contributors
- Control code parsing and associations
- Similar risk detection

### 6. Control Management

- Control CRUD operations
- Applicability determination (AUTO_FROM_RISK, MANUAL)
- Risk-control associations
- Document-control associations

### 7. SoA Export

- SoA data generation
- Excel export functionality
- Control applicability logic
- Linked risks and documents counting

### 8. Trust Center

- External user registration and approval
- NDA acceptance workflow
- Document visibility based on authentication
- Public vs. authenticated document access

## Implementation Plan

### Phase 1: Test Infrastructure Setup

#### 1.1 Backend Test Infrastructure

- **File**: `backend/jest.config.js` (enhance existing)
- Add coverage reporting configuration
- Configure test database setup/teardown
- Add test environment variables
- **File**: `backend/src/lib/test-helpers.ts` (new)
- Database test utilities (setup/cleanup)
- Mock user factories
- Authentication mock helpers
- **File**: `backend/src/lib/test-db.ts` (new)
- Test database connection management
- Transaction rollback for isolation

#### 1.2 Frontend Test Infrastructure

- **File**: `frontend/vitest.config.ts` (new)
- Configure Vitest with React Testing Library
- Setup MSW (Mock Service Worker) for API mocking
- Configure test environment (jsdom)
- Add coverage reporting
- **File**: `frontend/src/test/setup.ts` (new)
- Test utilities and helpers
- MSW handlers for API mocking
- Mock MSAL authentication
- Chakra UI test providers
- **File**: `frontend/src/test/mocks/` (new directory)
- MSAL mocks
- API response mocks
- User data factories

#### 1.3 E2E Test Infrastructure

- **File**: `playwright.config.ts` (enhance existing)
- Add authentication state management
- Configure test database seeding
- Add API mocking capabilities
- **File**: `e2e/helpers/auth.ts` (new)
- MSAL authentication mocking
- Test user creation utilities
- **File**: `e2e/helpers/db.ts` (new)
- Database seeding for E2E tests
- Test data factories

### Phase 2: Backend Unit & Integration Tests

#### 2.1 Authentication & Authorization Tests

- **File**: `backend/src/middleware/__tests__/auth.test.ts` (new)
- Token validation (valid, expired, invalid)
- Email domain validation
- Token issuer validation
- User extraction from token
- **File**: `backend/src/middleware/__tests__/authorize.test.ts` (enhance existing)
- Role-based access control
- Department-based filtering
- User not found scenarios
- Permission denied scenarios

#### 2.2 Document Route Tests

- **File**: `backend/src/routes/__tests__/documents.test.ts` (enhance existing)
- GET /api/documents - filtering, pagination, role-based visibility
- POST /api/documents - creation with validation
- PUT /api/documents/:id - updates and status transitions
- DELETE /api/documents/:id - soft delete
- Authorization checks for each endpoint

#### 2.3 Acknowledgment Route Tests

- **File**: `backend/src/routes/__tests__/acknowledgments.test.ts` (enhance existing)
- GET /api/acknowledgments/pending - pending documents retrieval
- POST /api/acknowledgments/bulk - bulk acknowledgment
- POST /api/acknowledgments - single acknowledgment
- Version tracking validation

#### 2.4 Risk Route Tests

- **File**: `backend/src/routes/__tests__/risks.test.ts` (new)
- Risk creation with wizard data
- Risk score calculations
- Status transition validation
- Department filtering for Contributors
- Control code parsing and associations
- Risk filtering and pagination

#### 2.5 Service Layer Tests

- **File**: `backend/src/services/__tests__/riskService.test.ts` (enhance existing)
- Risk score calculations (complete)
- Control code parsing (complete)
- Status transition validation
- CIA score calculations from wizard
- **File**: `backend/src/services/__tests__/soaService.test.ts` (enhance existing)
- SoA data generation
- Applicability logic
- Linked counts calculation
- **File**: `backend/src/services/__tests__/sharePointService.test.ts` (new)
- SharePoint item retrieval
- URL generation
- Error handling
- **File**: `backend/src/services/__tests__/confluenceService.test.ts` (new)
- Confluence page retrieval
- URL generation
- Error handling

### Phase 3: Frontend Component & Unit Tests

#### 3.1 Authentication Components

- **File**: `frontend/src/components/__tests__/ProtectedRoute.test.tsx` (new)
- Route protection based on roles
- Redirect behavior for unauthorized users
- Authentication state handling
- **File**: `frontend/src/contexts/__tests__/AuthContext.test.tsx` (new)
- Login/logout flow
- User sync functionality
- Role override functionality
- Token management

#### 3.2 Document Components

- **File**: `frontend/src/components/__tests__/DocumentFormModal.test.tsx` (new)
- Form validation
- Submit handling
- Error display
- **File**: `frontend/src/pages/__tests__/DocumentsPage.test.tsx` (new)
- Document list rendering
- Filtering and pagination
- Create/edit document flows
- Role-based UI elements

#### 3.3 Acknowledgment Components

- **File**: `frontend/src/pages/__tests__/AcknowledgmentPage.test.tsx` (new)
- Pending documents display
- Bulk acknowledgment flow
- Success/error handling

#### 3.4 Risk Components

- **File**: `frontend/src/components/__tests__/RiskFormModal.test.tsx` (new)
- Risk creation form
- Wizard data handling
- Score calculations display
- **File**: `frontend/src/pages/__tests__/RisksPage.test.tsx` (new)
- Risk list rendering
- Filtering and sorting
- Department filtering for Contributors

#### 3.5 Service Tests

- **File**: `frontend/src/services/__tests__/authService.test.ts` (new)
- MSAL login/logout
- Token retrieval
- Error handling
- **File**: `frontend/src/services/__tests__/api.test.ts` (new)
- API interceptors
- Token injection
- 401 error handling

### Phase 4: E2E Tests

#### 4.1 Authentication E2E

- **File**: `e2e/auth.spec.ts` (new)
- Login flow
- Role-based redirects
- Unauthorized access handling
- Token expiration handling

#### 4.2 Document Management E2E

- **File**: `e2e/document-management.spec.ts` (enhance existing)
- Admin creates document
- Admin edits document
- Admin deletes document
- Staff views approved documents only
- Document status transitions

#### 4.3 Acknowledgment E2E

- **File**: `e2e/acknowledgment.spec.ts` (enhance existing)
- Staff views pending documents
- Staff acknowledges single document
- Staff bulk acknowledges documents
- Acknowledgment tracking

#### 4.4 Risk Management E2E

- **File**: `e2e/risk-management.spec.ts` (new)
- Admin creates risk
- Contributor creates risk (department filtering)
- Risk status transitions
- Control associations

#### 4.5 SoA Export E2E

- **File**: `e2e/soa-export.spec.ts` (enhance existing)
- Admin generates SoA export
- Excel file download verification
- Export data validation

### Phase 5: CI/CD Integration

#### 5.1 GitHub Actions / CI Configuration

- **File**: `.github/workflows/test.yml` (new)
- Backend unit tests
- Frontend unit/component tests
- E2E tests (with test database)
- Coverage reporting
- Test result artifacts

#### 5.2 Test Scripts Enhancement

- **File**: `package.json` (update)
- Add `test:coverage` script
- Add `test:watch` scripts
- Add `test:ci` script for CI environments
- **File**: `backend/package.json` (update)
- Add coverage reporting
- Add test database setup script
- **File**: `frontend/package.json` (update)
- Add Vitest coverage configuration
- Add test watch mode

#### 5.3 Coverage Reporting

- Configure coverage thresholds
- Add coverage badges to README
- Set up coverage reporting service (Codecov, Coveralls, or similar)

## Testing Best Practices

1. **Test Isolation**: Each test should be independent and not rely on other tests
2. **Mock External Services**: Mock SharePoint, Confluence, and MSAL in tests
3. **Test Data Management**: Use factories for consistent test data
4. **Coverage Goals**: Aim for 80%+ coverage on critical paths
5. **E2E Test Stability**: Use proper waits and selectors, avoid flaky tests
6. **CI/CD Integration**: All tests must pass before deployment

## Files to Create/Modify

### New Files (30+)

- Backend test infrastructure: 3 files
- Frontend test infrastructure: 4 files
- E2E test infrastructure: 2 files
- Backend test files: 8 files
- Frontend test files: 10+ files
- E2E test files: 4 files
- CI/CD configuration: 1 file

### Modified Files

- `backend/jest.config.js` - Add coverage and test DB config
- `playwright.config.ts` - Add auth and DB setup
- `package.json` - Add test scripts
- `backend/package.json` - Add test dependencies
- `frontend/package.json` - Add test dependencies
- Existing test files - Complete placeholder tests

## Dependencies to Add

### Backend

- `@types/jest` (already present)
- `jest` (already present)
- Consider adding: `@faker-js/faker` for test data generation

### Frontend

- `@testing-library/react` - React component testing
- `@testing-library/jest-dom` - DOM matchers
- `@testing-library/user-event` - User interaction simulation
- `msw` - API mocking
- `vitest` (already present)
- `@vitest/ui` - Test UI (optional)

### E2E

- `@playwright/test` (already present)
- Consider: `@faker-js/faker` for test data

## Success Criteria

1. ✅ 80%+ code coverage on critical paths (auth, documents, risks, acknowledgments)
2. ✅ All critical user flows have E2E tests
3. ✅ Tests run in CI/CD pipeline
4. ✅ Tests are fast and reliable (no flaky tests)
5. ✅ Test documentation in place
6. ✅ Easy to add new tests following established patterns

### To-dos

- [ ] Document current testing state: review existing tests, identify gaps, and assess test infrastructure
- [ ] Set up backend test infrastructure: enhance Jest config, create test helpers, database utilities, and mock factories
- [ ] Set up frontend test infrastructure: create Vitest config, MSW setup, test utilities, and MSAL mocks
- [ ] Set up E2E test infrastructure: enhance Playwright config, create auth helpers, and database seeding utilities
- [ ] Write comprehensive backend authentication and authorization tests (auth middleware, role-based access, department filtering)
- [ ] Complete and enhance backend document route tests (CRUD, filtering, role-based access, status transitions)
- [ ] Complete and enhance backend acknowledgment route tests (pending retrieval, bulk acknowledgment, version tracking)
- [ ] Write comprehensive backend risk route and service tests (creation, scoring, status transitions, department filtering)
- [ ] Write backend service layer tests (SoA service, SharePoint service, Confluence service, risk service enhancements)
- [ ] Write frontend authentication component and context tests (ProtectedRoute, AuthContext, login/logout flows)
- [ ] Write frontend document component and page tests (DocumentFormModal, DocumentsPage, CRUD flows)
- [ ] Write frontend acknowledgment page tests (pending documents, bulk acknowledgment UI)
- [ ] Write frontend risk component and page tests (RiskFormModal, RisksPage, wizard flows)
- [ ] Write frontend service tests (authService, API interceptors, error handling)
- [ ] Write E2E authentication tests (login flow, role-based redirects, unauthorized access)
- [ ] Complete E2E document management tests (create, edit, delete, role-based access)
- [ ] Complete E2E acknowledgment workflow tests (pending documents, single/bulk acknowledgment)
- [ ] Write E2E risk management tests (risk creation, status transitions, department filtering)
- [ ] Complete E2E SoA export tests (export generation, file download verification)
- [ ] Set up CI/CD pipeline configuration (GitHub Actions workflow, test scripts, coverage reporting)
- [ ] Configure test coverage reporting (thresholds, badges, reporting service integration)
- [ ] Create testing documentation (test structure, how to write tests, running tests, CI/CD integration)