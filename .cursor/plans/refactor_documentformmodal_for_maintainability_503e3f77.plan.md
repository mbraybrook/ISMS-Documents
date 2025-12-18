---
name: Refactor DocumentFormModal for Maintainability
overview: Break down the 1659-line DocumentFormModal component into smaller, testable pieces by extracting custom hooks, sub-components, and utility functions. This will improve maintainability, reduce test flakiness, and make the codebase more stable.
todos:
  - id: extract-error-utils
    content: Move getErrorMessage and getErrorDetails to frontend/src/utils/errorHandling.ts
    status: completed
  - id: create-use-document-form
    content: Create useDocumentForm hook to manage form state, initialization, and submission
    status: completed
    dependencies:
      - extract-error-utils
  - id: create-use-sharepoint
    content: Create useSharePointIntegration hook for SharePoint URL parsing and file selection
    status: completed
    dependencies:
      - extract-error-utils
  - id: create-use-control-linking
    content: Create useControlLinking hook for control search, suggestions, and linking operations
    status: completed
  - id: create-use-document-users
    content: Create useDocumentUsers hook for fetching and filtering users for owner selection
    status: completed
  - id: create-use-document-modals
    content: Create useDocumentModals hook to manage all modal states (version, control, confirm)
    status: completed
  - id: create-document-form-fields
    content: Create DocumentFormFields component for basic form fields (title, type, version, status)
    status: completed
    dependencies:
      - create-use-document-form
  - id: create-sharepoint-section
    content: Create SharePointDocumentSection component for SharePoint URL and file browser UI
    status: completed
    dependencies:
      - create-use-sharepoint
  - id: create-confluence-section
    content: Create ConfluenceDocumentSection component for Confluence fields
    status: completed
    dependencies:
      - create-use-document-form
  - id: create-review-dates
    content: Create DocumentReviewDates component for review date display/editing
    status: completed
    dependencies:
      - create-use-document-form
  - id: create-control-linking
    content: Create DocumentControlLinking component for control linking UI
    status: completed
    dependencies:
      - create-use-control-linking
  - id: create-owner-selection
    content: Create DocumentOwnerSelection component for owner dropdown
    status: completed
    dependencies:
      - create-use-document-users
  - id: refactor-main-component
    content: Refactor DocumentFormModal to use all hooks and sub-components, reduce to ~200-300 lines
    status: completed
    dependencies:
      - create-document-form-fields
      - create-sharepoint-section
      - create-confluence-section
      - create-review-dates
      - create-control-linking
      - create-owner-selection
  - id: create-hook-tests
    content: Create unit tests for each custom hook (useDocumentForm, useSharePointIntegration, etc.)
    status: completed
    dependencies:
      - create-use-document-form
      - create-use-sharepoint
      - create-use-control-linking
      - create-use-document-users
      - create-use-document-modals
  - id: create-component-tests
    content: Create unit tests for each sub-component (DocumentFormFields, SharePointDocumentSection, etc.)
    status: completed
    dependencies:
      - create-document-form-fields
      - create-sharepoint-section
      - create-confluence-section
      - create-review-dates
      - create-control-linking
      - create-owner-selection
  - id: simplify-main-tests
    content: Simplify DocumentFormModal.test.tsx to focus on integration, reduce from ~1254 to ~400-500 lines
    status: completed
    dependencies:
      - refactor-main-component
      - create-hook-tests
      - create-component-tests
---

# Refactor DocumentFormModal for Maintainability

## Problem Analysis

The `DocumentFormModal.tsx` component (1659 lines) has multiple issues:

- **Too many responsibilities**: Form management, SharePoint operations, control linking, user fetching, version management
- **Excessive state**: 15+ useState hooks managing different concerns
- **Complex effects**: 7 useEffect hooks with intricate dependencies causing cascading updates
- **Large render**: 800+ lines of JSX with deeply nested conditional rendering
- **Test flakiness**: Complex async operations, debounced effects, and timing-dependent tests

## Solution Strategy

Break down the monolithic component into:

1. **Custom hooks** - Extract related state and logic
2. **Sub-components** - Extract UI sections
3. **Utility functions** - Extract reusable logic
4. **Improved testability** - Test hooks and components independently

## Implementation Plan

### Phase 1: Extract Custom Hooks

#### 1.1 Create `useDocumentForm` Hook

**File**: `frontend/src/hooks/useDocumentForm.ts`

- Manages form state (`formData`, `setFormData`)
- Handles form initialization from document prop
- Handles form reset on modal close
- Manages form submission logic
- **State extracted**: `formData`, `loading`, `_pendingSubmit`

#### 1.2 Create `useSharePointIntegration` Hook

**File**: `frontend/src/hooks/useSharePointIntegration.ts`

- Manages SharePoint URL parsing (`handleParseUrl`)
- Manages document URL loading (`loadDocumentUrl`)
- Manages file browser state
- Handles file selection
- **State extracted**: `sharePointUrl`, `parsingUrl`, `urlError`, `browserOpen`, `showReplaceOptions`, `documentUrl`, `loadingUrl`

#### 1.3 Create `useControlLinking` Hook

**File**: `frontend/src/hooks/useControlLinking.ts`

- Manages linked controls fetching
- Handles control search and suggestions
- Manages control linking/unlinking operations
- Handles debounced suggestion fetching
- **State extracted**: `linkedControls`, `controlSearchTerm`, `availableControls`, `suggestedControls`, `searchingControls`, `_linkingControl`, `loadingControls`, `loadingSuggestedControls`

#### 1.4 Create `useDocumentUsers` Hook

**File**: `frontend/src/hooks/useDocumentUsers.ts`

- Fetches users for owner selection
- Filters users by role (Admin/Editor)
- Handles edge case of including current owner
- **State extracted**: `users`, `loadingUsers`

#### 1.5 Create `useDocumentModals` Hook

**File**: `frontend/src/hooks/useDocumentModals.ts`

- Manages all modal states (version update, control form, confirm dialog)
- Provides handlers for opening/closing modals
- **State extracted**: `isVersionUpdateOpen`, `isControlModalOpen`, `isConfirmOpen`, `selectedControl`, `cancelRef`

### Phase 2: Extract Sub-Components

#### 2.1 Create `DocumentFormFields` Component

**File**: `frontend/src/components/DocumentFormFields.tsx`

- Renders basic form fields (title, type, storage location, version, status)
- Handles version update button
- **Props**: `formData`, `onChange`, `readOnly`, `onVersionUpdateClick`, `document`

#### 2.2 Create `SharePointDocumentSection` Component

**File**: `frontend/src/components/SharePointDocumentSection.tsx`

- Renders SharePoint URL input and file browser
- Handles create vs edit mode differences
- Shows document link or replace options
- **Props**: `formData`, `onChange`, `readOnly`, `document`, `onFileSelect`, `onUrlParse`, `sharePointUrl`, `parsingUrl`, `urlError`, `documentUrl`, `loadingUrl`, `showReplaceOptions`, `onToggleReplace`

#### 2.3 Create `ConfluenceDocumentSection` Component

**File**: `frontend/src/components/ConfluenceDocumentSection.tsx`

- Renders Confluence space key and page ID inputs
- **Props**: `formData`, `onChange`, `readOnly`

#### 2.4 Create `DocumentReviewDates` Component

**File**: `frontend/src/components/DocumentReviewDates.tsx`

- Renders review dates (as text for existing docs, inputs for new docs)
- Handles review context logic
- **Props**: `formData`, `onChange`, `readOnly`, `document`, `isReviewContext`

#### 2.5 Create `DocumentControlLinking` Component

**File**: `frontend/src/components/DocumentControlLinking.tsx`

- Renders linked controls list
- Renders control search and suggestions
- Handles control linking/unlinking UI
- **Props**: All control linking state and handlers from `useControlLinking` hook

#### 2.6 Create `DocumentOwnerSelection` Component

**File**: `frontend/src/components/DocumentOwnerSelection.tsx`

- Renders owner selection dropdown
- Only shows for Admin/Editor users
- **Props**: `formData`, `onChange`, `readOnly`, `users`, `loadingUsers`

### Phase 3: Extract Utility Functions

#### 3.1 Move Error Helpers to Utilities

**File**: `frontend/src/utils/errorHandling.ts`

- Move `getErrorMessage` and `getErrorDetails` functions
- Make them reusable across the codebase

#### 3.2 Create Form Utilities

**File**: `frontend/src/utils/documentForm.ts`

- Extract form initialization logic
- Extract date calculation helpers
- Extract form validation helpers

### Phase 4: Refactor Main Component

#### 4.1 Simplify `DocumentFormModal` Component

**File**: `frontend/src/components/DocumentFormModal.tsx`

- Use all extracted hooks
- Render sub-components instead of inline JSX
- Reduce from ~1659 lines to ~200-300 lines
- Keep only modal wrapper and orchestration logic

### Phase 5: Update Tests

#### 5.1 Create Hook Tests

- Test each custom hook independently
- Mock dependencies at hook level
- Test state transitions and side effects

#### 5.2 Create Component Tests

- Test each sub-component independently
- Test with mocked props
- Reduce complexity of main component tests

#### 5.3 Simplify Main Component Tests

**File**: `frontend/src/components/__tests__/DocumentFormModal.test.tsx`

- Focus on integration and orchestration
- Test modal open/close behavior
- Test form submission flow
- Reduce from ~1254 lines to ~400-500 lines

## File Structure After Refactoring

```
frontend/src/
├── components/
│   ├── DocumentFormModal.tsx (200-300 lines - main orchestrator)
│   ├── DocumentFormFields.tsx (new)
│   ├── SharePointDocumentSection.tsx (new)
│   ├── ConfluenceDocumentSection.tsx (new)
│   ├── DocumentReviewDates.tsx (new)
│   ├── DocumentControlLinking.tsx (new)
│   └── DocumentOwnerSelection.tsx (new)
├── hooks/
│   ├── useDocumentForm.ts (new)
│   ├── useSharePointIntegration.ts (new)
│   ├── useControlLinking.ts (new)
│   ├── useDocumentUsers.ts (new)
│   └── useDocumentModals.ts (new)
├── utils/
│   ├── errorHandling.ts (new - move from component)
│   └── documentForm.ts (new)
└── components/__tests__/
    ├── DocumentFormModal.test.tsx (simplified)
    ├── useDocumentForm.test.ts (new)
    ├── useSharePointIntegration.test.ts (new)
    ├── useControlLinking.test.ts (new)
    └── [component tests for sub-components]
```

## Benefits

1. **Maintainability**: Each piece has a single responsibility
2. **Testability**: Hooks and components can be tested independently
3. **Reusability**: Hooks and components can be reused elsewhere
4. **Reduced Complexity**: Main component becomes a simple orchestrator
5. **Better Performance**: Smaller components can be optimized individually
6. **Easier Debugging**: Issues isolated to specific hooks/components

## Migration Strategy

1. Create hooks and sub-components alongside existing code
2. Gradually migrate functionality piece by piece
3. Update tests as each piece is migrated
4. Keep existing tests passing throughout migration
5. Remove old code only after all tests pass

## Risk Mitigation

- **Backward Compatibility**: Maintain same props interface for `DocumentFormModal`
- **Incremental Migration**: Migrate one hook/component at a time
- **Test Coverage**: Ensure test coverage doesn't decrease
- **Code Review**: Review each extracted piece carefully

## Success Criteria

- Main component reduced to < 300 lines
- Each hook/component < 200 lines
- All existing tests pass
- Test execution time reduced
- No test flakiness
- Code coverage maintained or improved