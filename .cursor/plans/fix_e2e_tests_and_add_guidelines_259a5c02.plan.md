---
name: Fix E2E Tests and Add Guidelines
overview: Fix all 9 failing e2e tests by implementing proper authentication mocking, fixing test issues, and creating comprehensive e2e test maintenance guidelines.
todos:
  - id: fix-auth-mocking
    content: Fix authentication mocking in e2e tests - update auth.ts helper to properly mock MSAL and set sessionStorage tokens
    status: completed
  - id: add-backend-test-mode
    content: Add test mode to backend auth middleware to accept test tokens when E2E_TEST_MODE=true
    status: completed
  - id: fix-document-management-tests
    content: Fix document-management.spec.ts - add missing logout import and fix test logic
    status: completed
    dependencies:
      - fix-auth-mocking
  - id: fix-acknowledgment-tests
    content: Fix acknowledgment.spec.ts - replace waitForTimeout with proper waitFor patterns and fix assertions
    status: completed
    dependencies:
      - fix-auth-mocking
  - id: fix-auth-tests
    content: Fix auth.spec.ts - ensure proper redirect waits and URL assertions
    status: in_progress
    dependencies:
      - fix-auth-mocking
  - id: fix-soa-export-tests
    content: Fix soa-export.spec.ts - fix download detection and page load waits
    status: completed
    dependencies:
      - fix-auth-mocking
  - id: update-playwright-config
    content: Update playwright.config.ts to set E2E_TEST_MODE environment variable
    status: completed
    dependencies:
      - add-backend-test-mode
  - id: create-e2e-guidelines
    content: Create docs/e2e-testing-guidelines.md with comprehensive e2e test maintenance guidelines
    status: completed
  - id: verify-all-tests-pass
    content: Run npm run test:e2e and verify all 9 previously failing tests now pass
    status: in_progress
    dependencies:
      - fix-document-management-tests
      - fix-acknowledgment-tests
      - fix-auth-tests
      - fix-soa-export-tests
      - update-playwright-config
---

# Fix E2E Tests and Add Maintenance Guidelines

## Overview

The e2e tests are failing because:

1. **Authentication mocking is incorrect** - Tests use localStorage tokens, but frontend uses MSAL with sessionStorage and backend validates tokens via JWKS
2. **Missing imports** - `document-management.spec.ts` uses `logout` without importing it
3. **Flaky test patterns** - Using `waitForTimeout` and conditional logic that may not execute
4. **Route/page loading issues** - Tests don't wait for proper page loads or check correct elements

## Implementation Plan

### 1. Fix Authentication for E2E Tests

**Problem**: Current mock authentication sets localStorage tokens, but:

- Frontend uses MSAL which stores tokens in sessionStorage
- Backend validates tokens using JWKS from Microsoft (won't accept mock tokens)
- Frontend makes API calls to `/api/auth/me` which requires valid backend auth

**Solution**: Create a test authentication mode that bypasses MSAL and JWKS validation.

**Files to modify:**

- `e2e/helpers/auth.ts` - Update to properly mock MSAL and set sessionStorage tokens
- `backend/src/middleware/auth.ts` - Add test mode that accepts test tokens when `E2E_TEST_MODE=true`
- `frontend/src/services/authService.ts` - Add test mode detection to bypass MSAL initialization

**Approach:**

1. Set environment variable `E2E_TEST_MODE=true` in playwright config
2. In test mode, backend accepts tokens with a special test signature
3. Frontend detects test mode and uses sessionStorage tokens instead of MSAL
4. Update `loginAs()` helper to set proper sessionStorage tokens and mock MSAL account

### 2. Fix Test Issues

**File: `e2e/document-management.spec.ts`**

- Add missing `logout` import from `./helpers/auth`
- Fix test that calls `logout` without importing it

**File: `e2e/acknowledgment.spec.ts`**

- Replace `waitForTimeout` with proper `waitFor` patterns
- Add proper assertions instead of conditional logic
- Wait for page to load before checking elements

**File: `e2e/auth.spec.ts`**

- Ensure redirects are properly waited for
- Add proper URL assertions with timeouts

**File: `e2e/soa-export.spec.ts`**

- Fix download detection logic
- Add proper page load waits

**File: `e2e/document-management.spec.ts`**

- Fix staff document viewing test
- Ensure proper authentication state between tests

### 3. Improve Test Stability

**Replace flaky patterns:**

- Replace `waitForTimeout()` with `waitFor()` and proper selectors
- Remove conditional logic (`if (await element.isVisible())`) - use assertions instead
- Add proper page load waits using `page.waitForLoadState()`
- Use data-testid attributes where possible for more stable selectors

**Add proper error handling:**

- Use Playwright's built-in retry mechanisms
- Add meaningful error messages in assertions
- Use `expect().toBeVisible()` with timeouts instead of conditional checks

### 4. Create E2E Test Guidelines

**Files to create:**

- `.cursor/rules/e2e-testing.mdc` - For Cursor AI to pick up (with `alwaysApply: true` frontmatter)
- `docs/e2e-testing-guidelines.md` - Human-readable version (same content, for other dev environments)

Guidelines should cover:

- **Authentication**: How to use `loginAs()` helper, test user setup, test mode configuration
- **Test data**: How to use `createTestDocument()`, `cleanupTestData()`, test data lifecycle
- **Best practices**: 
- Always wait for page loads using `page.waitForLoadState()`
- Use `waitFor()` instead of `waitForTimeout()`
- Use data-testid for stable selectors
- Avoid conditional logic in tests - use assertions instead
- Clean up test data in `beforeEach` or `afterEach`
- Use proper selectors (prefer role-based, then data-testid, then text)
- **Common patterns**: Page navigation, form filling, file downloads, API mocking
- **Debugging**: How to run tests in UI mode (`npm run test:e2e:ui`), view traces, screenshots
- **Maintenance**: When to update tests, how to add new tests, test organization
- **Test stability**: Avoiding flaky tests, proper timeout configuration, retry strategies

### 5. Update Playwright Configuration

**File: `playwright.config.ts`**

- Add `E2E_TEST_MODE=true` to test environment
- Ensure proper baseURL configuration
- Add retry configuration for flaky tests
- Configure proper timeouts

## Files to Modify

1. `e2e/helpers/auth.ts` - Fix authentication mocking
2. `backend/src/middleware/auth.ts` - Add test mode token validation
3. `frontend/src/services/authService.ts` - Add test mode detection (if needed)
4. `e2e/document-management.spec.ts` - Fix missing import and test logic
5. `e2e/acknowledgment.spec.ts` - Fix flaky patterns
6. `e2e/auth.spec.ts` - Fix redirect tests
7. `e2e/soa-export.spec.ts` - Fix download tests
8. `playwright.config.ts` - Add test mode environment variable
9. `.cursor/rules/e2e-testing.mdc` - Create Cursor-readable guidelines file
10. `docs/e2e-testing-guidelines.md` - Create human-readable guidelines file (duplicate content)

## Testing Strategy

1. Run tests locally to verify fixes
2. Ensure all 9 failing tests pass
3. Verify no regressions in passing tests
4. Test authentication flow end-to-end
5. Verify test stability (run multiple times)

## Success Criteria

- All 9 failing tests pass
- Tests are stable (no flaky failures)
- Authentication works correctly in test mode
- Guidelines document is comprehensive and useful
- Tests follow best practices (no `waitForTimeout`, proper assertions)