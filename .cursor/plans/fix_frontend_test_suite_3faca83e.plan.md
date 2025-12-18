---
name: Fix Frontend Test Suite
overview: Fix failing frontend tests, reduce console log noise, standardize mocking patterns, and update test documentation to prevent future issues.
todos:
  - id: suppress-console-logs
    content: Add console log suppression to test/setup.ts to reduce noise in test output
    status: completed
  - id: fix-authcontext-mocks
    content: Fix AuthContext mocking pattern in 7 test files to preserve AuthProvider export
    status: completed
  - id: fix-mock-conflicts
    content: Resolve mock conflicts in authService.test.ts by using global mocks
    status: completed
  - id: standardize-test-utils
    content: Update ProtectedRoute.test.tsx to use standardized render from test/utils
    status: completed
  - id: fix-failing-tests
    content: Fix specific test failures in ConfluenceDocumentSection and ControlFormModal tests
    status: completed
    dependencies:
      - fix-authcontext-mocks
  - id: update-test-docs
    content: Update testing.mdc with console suppression, improved mocking patterns, and troubleshooting
    status: completed
    dependencies:
      - suppress-console-logs
      - fix-authcontext-mocks
---

# Fix Frontend Test Suite

## Problem Analysis

The frontend test suite has several critical issues:

- **73 tests failing** out of 426 total tests
- **Hundreds of console log messages** creating noise in test output (171 console.log/warn/error statements across 45 files)
- **AuthContext mocking inconsistency**: 7 test files mock AuthContext without preserving the `AuthProvider` export, causing failures when `test/utils.tsx` tries to use it
- **Mock conflicts**: Global mocks in `test/setup.ts` conflict with test-specific mocks (e.g., `authService.test.ts` has its own MSAL mock)
- **Inconsistent test patterns**: Some tests use custom render functions instead of the standardized one from `test/utils`

## Solution Overview

1. **Suppress console logs in test environment** - Add console suppression to `test/setup.ts` to reduce noise
2. **Fix AuthContext mocking pattern** - Update all 7 test files to use `importOriginal` pattern that preserves `AuthProvider` export
3. **Fix mock conflicts** - Resolve conflicts between global mocks and test-specific mocks
4. **Standardize test utilities** - Ensure all tests use `render` from `test/utils` instead of custom render functions
5. **Fix failing tests** - Address specific test failures after fixing mocking issues
6. **Update test documentation** - Enhance `.cursor/rules/testing.mdc` with better patterns and troubleshooting

## Implementation Steps

### Step 1: Suppress Console Logs in Tests

**File**: `frontend/src/test/setup.ts`

- Add console suppression for `console.log`, `console.warn`, and `console.error` in test environment
- Allow console.error for actual test failures (use `console.error.mockImplementation` with filtering)
- Keep console suppression scoped to test environment only

### Step 2: Fix AuthContext Mocking Pattern

**Files to update** (7 files):

- `frontend/src/components/__tests__/DepartmentRiskTable.test.tsx`
- `frontend/src/components/__tests__/ProtectedRoute.test.tsx`
- `frontend/src/components/__tests__/LayoutNavigation.test.tsx`
- `frontend/src/components/__tests__/NDAAcceptanceModal.test.tsx`
- `frontend/src/__tests__/App.test.tsx`
- `frontend/src/hooks/__tests__/useDocumentForm.test.ts`

**Pattern to apply**:

```typescript
vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext');
  return {
    ...actual, // Preserves AuthProvider export
    useAuth: vi.fn(),
  };
});
```

### Step 3: Fix Mock Conflicts

**File**: `frontend/src/services/__tests__/authService.test.ts`

- Remove duplicate MSAL mock (already mocked globally in `test/mocks/msal.ts`)
- Use the global mock instance instead of creating a new one
- Fix test expectations to work with the global mock setup

### Step 4: Standardize Test Utilities

**File**: `frontend/src/components/__tests__/ProtectedRoute.test.tsx`

- Replace custom `renderWithRouter` function with `render` from `test/utils`
- Remove duplicate ChakraProvider and MemoryRouter setup (already in `test/utils`)
- Update all test cases to use the standardized render

### Step 5: Fix Test-Specific Issues

**Files with specific failures**:

- `frontend/src/components/__tests__/ConfluenceDocumentSection.test.tsx` - Fix onChange handler tests
- `frontend/src/components/__tests__/ControlFormModal.test.tsx` - Fix delete and linking tests
- `frontend/src/components/__tests__/DepartmentRiskTable.test.tsx` - Fix all 23 failing tests after AuthContext fix

### Step 6: Update Test Documentation

**File**: `.cursor/rules/testing.mdc`

- Add section on **Console Log Suppression** - Explain why and how console logs are suppressed in tests
- Enhance **Mocking Strategy** section with:
  - Clear pattern for mocking context providers (AuthContext example)
  - Warning about mock conflicts between global and test-specific mocks
  - Best practice: Use global mocks when possible, override only when necessary
- Add **Troubleshooting** section with:
  - "AuthProvider export not found" error solution
  - Console log noise reduction
  - Mock conflict resolution
- Add **Test Output Quality** section:
  - Importance of clean test output
  - How to identify and fix noisy tests
  - When console logs are acceptable in tests

## Files to Modify

1. `frontend/src/test/setup.ts` - Add console suppression
2. `frontend/src/components/__tests__/DepartmentRiskTable.test.tsx` - Fix AuthContext mock
3. `frontend/src/components/__tests__/ProtectedRoute.test.tsx` - Fix AuthContext mock and use standardized render
4. `frontend/src/components/__tests__/LayoutNavigation.test.tsx` - Fix AuthContext mock
5. `frontend/src/components/__tests__/NDAAcceptanceModal.test.tsx` - Fix AuthContext mock
6. `frontend/src/__tests__/App.test.tsx` - Fix AuthContext mock
7. `frontend/src/hooks/__tests__/useDocumentForm.test.ts` - Fix AuthContext mock
8. `frontend/src/services/__tests__/authService.test.ts` - Fix mock conflicts
9. `frontend/src/components/__tests__/ConfluenceDocumentSection.test.tsx` - Fix failing tests
10. `frontend/src/components/__tests__/ControlFormModal.test.tsx` - Fix failing tests
11. `.cursor/rules/testing.mdc` - Update documentation

## Expected Outcomes

- All 426 tests passing
- Clean test output with minimal console noise
- Consistent mocking patterns across all tests
- Updated documentation to prevent future issues
- Faster test execution (reduced console overhead)

## Testing Strategy

1. Run test suite after each major change to verify fixes
2. Check test output for console log noise reduction
3. Verify all AuthContext-related errors are resolved
4. Ensure no new test failures are introduced
5. Validate test documentation is clear and actionable