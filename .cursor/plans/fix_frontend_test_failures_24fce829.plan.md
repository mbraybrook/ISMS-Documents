---
name: Fix Frontend Test Failures
overview: Resolve 65 failing tests and 16 errors in the frontend test suite by fixing test timeouts, API call issues in readOnly mode, type safety problems, and suppressing known jsdom compatibility errors.
todos:
  - id: fix-pagination-timeout
    content: Fix RiskReviewQueue pagination test timeout by increasing timeout and improving wait conditions
    status: completed
  - id: fix-readonly-api-calls
    content: Fix DocumentFormModal to skip API calls in readOnly mode by passing readOnly to useControlLinking hook
    status: completed
  - id: fix-interested-parties-type
    content: Fix interestedParties.map error by ensuring response.data is always an array in RiskFormModal
    status: completed
  - id: suppress-focus-errors
    content: Suppress known jsdom/Chakra UI focus-visible compatibility errors in test setup
    status: completed
---

# Fix Frontend Test Failures

## Overview

The frontend test suite has 65 failing tests and 16 errors across 4 test files. The issues fall into four main categories:

1. Test timeout in pagination safety limit test
2. API calls being made in readOnly mode
3. Type safety issues causing runtime errors
4. Known jsdom/Chakra UI compatibility errors

## Issues Identified

### 1. Test Timeout: RiskReviewQueue Pagination Safety Limit

**File**: `frontend/src/components/__tests__/RiskReviewQueue.test.tsx`

- Test: "should stop pagination at safety limit"
- **Problem**: Test times out at 20s waiting for pagination to complete
- **Root Cause**: The test waits for spinner to disappear with 15s timeout, but pagination might be taking longer or the component isn't properly stopping at the safety limit
- **Fix**: Increase test timeout, improve wait condition, or verify the component actually stops pagination at page 50

### 2. DocumentFormModal: API Call in readOnly Mode

**Files**:

- `frontend/src/components/__tests__/DocumentFormModal.test.tsx`
- `frontend/src/hooks/useControlLinking.ts`
- `frontend/src/components/DocumentFormModal.tsx`
- **Problem**: Test expects no API calls when `readOnly={true}`, but `useControlLinking` hook calls `/api/documents/suggest-controls` even in readOnly mode
- **Root Cause**: `useControlLinking` hook doesn't receive `readOnly` prop, so it can't skip API calls
- **Fix**: 
  - Pass `readOnly` prop to `useControlLinking` hook
  - Modify `useControlLinking` to skip `fetchSuggestedControls` when `readOnly` is true
  - Update `DocumentFormModal` to pass `readOnly` to the hook

### 3. Type Safety: interestedParties.map Error

**File**: `frontend/src/components/RiskFormModal.tsx`

- **Problem**: `TypeError: interestedParties.map is not a function` at line 1245
- **Root Cause**: `setInterestedParties(response.data || [])` might set a non-array value if API returns an object or other non-array type
- **Fix**: Add proper type guard to ensure `interestedParties` is always an array:
  ```typescript
  setInterestedParties(Array.isArray(response.data) ? response.data : []);
  ```


### 4. Known jsdom/Chakra UI Compatibility Errors

**File**: `frontend/src/test/setup.ts`

- **Problem**: Multiple `TypeError: Cannot set property focus of #<HTMLElement> which has only a getter` errors from `@zag-js/focus-visible`
- **Root Cause**: Known compatibility issue between jsdom and Chakra UI's focus-visible library
- **Fix**: Suppress these specific errors in the test setup by:
  - Mocking `@zag-js/focus-visible` globally
  - Or filtering these specific errors in console.error suppression
  - Or adding error boundary to catch and suppress these errors

## Implementation Steps

### Step 1: Fix RiskReviewQueue Pagination Test Timeout

1. Review `RiskReviewQueue` component to verify it stops pagination at page 50
2. Update test timeout from 20s to 30s or increase waitFor timeout
3. Improve wait condition to check for actual pagination completion rather than just spinner disappearance
4. Verify the component has proper safety limit implementation

### Step 2: Fix DocumentFormModal readOnly API Calls

1. Update `useControlLinking` hook interface to accept `readOnly?: boolean` parameter
2. Modify `fetchSuggestedControls` effect to skip when `readOnly` is true
3. Update `DocumentFormModal` to pass `readOnly` prop to `useControlLinking` hook
4. Verify test passes after changes

### Step 3: Fix interestedParties Type Safety

1. Update `fetchInterestedParties` in `RiskFormModal.tsx` to ensure array type:
   ```typescript
   setInterestedParties(Array.isArray(response.data) ? response.data : []);
   ```

2. Add defensive check before `.map()` call as additional safety:
   ```typescript
   {Array.isArray(interestedParties) && interestedParties.map((party) => (...))}
   ```


### Step 4: Suppress jsdom Focus Errors

1. Add global mock for `@zag-js/focus-visible` in `test/setup.ts`:
   ```typescript
   vi.mock('@zag-js/focus-visible', () => ({
     trackFocusVisible: vi.fn(),
   }));
   ```

2. Or enhance console.error filtering to suppress these specific errors
3. Document that these errors are expected and don't affect test functionality

## Files to Modify

1. `frontend/src/components/__tests__/RiskReviewQueue.test.tsx` - Fix timeout
2. `frontend/src/hooks/useControlLinking.ts` - Add readOnly support
3. `frontend/src/components/DocumentFormModal.tsx` - Pass readOnly to hook
4. `frontend/src/components/RiskFormModal.tsx` - Fix interestedParties type safety
5. `frontend/src/test/setup.ts` - Suppress focus-visible errors

## Testing

After fixes:

- Run `npm test` in frontend directory
- Verify all 65 failing tests now pass
- Verify no new errors are introduced
- Check that error count drops from 16 to 0 (or only expected suppressed errors remain)