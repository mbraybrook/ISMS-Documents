<!-- 29f104c1-5f36-4b84-8dd2-db4fafb3530c 33e4f09b-0823-4a60-969c-ba0fc89a3326 -->
# Standardize Table Components with Reusable DataTable

## Overview

Create a reusable `DataTable` component that consolidates common table functionality (pagination, filtering, sorting, checkboxes, CSV export) to eliminate inconsistencies across Documents, Assets, Risks, and Controls pages.

## Implementation Plan

### 1. Create Reusable DataTable Component

**File**: `frontend/src/components/DataTable.tsx`

Create a configurable component with:

- **Props interface** for:
- Data array and column definitions
- Pagination config (client-side vs server-side)
- Filter definitions and state
- Sort configuration
- Checkbox selection support
- CSV export configuration
- Action button definitions
- Empty state handling
- Loading state

- **Features**:
- Standardized filter UI with "Filters" heading and active filter count badge
- Clear Filters button (conditional on active filters)
- Search input with consistent placeholder format
- Sortable headers with visual indicators (ChevronUpIcon/ChevronDownIcon)
- Row checkboxes with select-all support
- Pagination controls (Previous/Next, page info, page size selector)
- CSV export button
- Standardized action buttons (icon-based with tooltips)
- Consistent empty value display (gray text with "—")
- Standardized boolean display (Yes/No badges)
- Default page size: 20

### 2. Create Supporting Utilities

**File**: `frontend/src/utils/tableUtils.ts`

Helper functions for:

- CSV export generation
- Boolean formatting (Yes/No)
- Empty value formatting
- Default pagination values

### 3. Update DocumentsPage

**File**: `frontend/src/pages/DocumentsPage.tsx`

- Replace custom table implementation with DataTable
- Add pagination (currently missing)
- Add Export CSV functionality
- Standardize action buttons to use IconButton with tooltips
- Ensure "Filters" heading is present (already exists)
- Add page size selector
- Standardize empty value and boolean displays

### 4. Update AssetsPage

**File**: `frontend/src/pages/AssetsPage.tsx`

- Replace custom table implementation with DataTable
- Add row checkboxes
- Add Clear Filters button (currently missing explicit button)
- Add page size selector
- Standardize sort indicators (ensure consistent styling)
- Standardize action buttons (already uses IconButton, ensure consistency)

### 5. Update RisksPage

**File**: `frontend/src/pages/RisksPage.tsx`

- Replace custom table implementation with DataTable
- Add page size selector
- Standardize action buttons (convert from text Button to IconButton with tooltips)
- Add sort indicators to sortable columns
- Ensure Clear Filters functionality is explicit

### 6. Update ControlsPage

**File**: `frontend/src/pages/ControlsPage.tsx`

- Replace custom table implementation with DataTable
- Add "Filters" heading (currently missing)
- Add delete action button (for custom Controls only)
- Standardize action buttons (convert from text Button to IconButton)
- Ensure all standardizations are applied

## Standardization Details

### High Priority Fixes

1. **Pagination**: All tables will have pagination controls with page size selector
2. **Checkboxes**: Assets table will have row checkboxes
3. **Export CSV**: Documents table will have Export CSV button
4. **Clear Filters**: All tables will have explicit Clear Filters button
5. **Delete Action**: Controls table will have delete action (for custom controls only)

### Medium Priority Fixes

1. **Page Size Selector**: Add to Assets and Risks (Controls already has it)
2. **Filters Heading**: Add to Controls (others already have it)
3. **Action Buttons**: Standardize to IconButton with tooltips across all tables
4. **Sort Indicators**: Ensure all sortable columns show ChevronUpIcon/ChevronDownIcon

### Low Priority Fixes

1. **Empty Values**: Display as gray "—" text consistently
2. **Boolean Display**: Use Badge components with "Yes"/"No" consistently
3. **Search Placeholder**: Standardize format (e.g., "Search by...")
4. **Default Page Size**: Set to 20 consistently across all tables

## Technical Considerations

- Support both client-side and server-side pagination
- Maintain existing filter logic per page
- Preserve all current functionality while standardizing UI
- Use TypeScript interfaces for type safety
- Follow existing Chakra UI patterns
- Ensure accessibility (ARIA labels, keyboard navigation)

### To-dos

- [x] Create reusable DataTable component with configurable props for columns, pagination, filters, sorting, checkboxes, and actions
- [x] Create tableUtils.ts with helper functions for CSV export, boolean formatting, and empty value display
- [x] Refactor DocumentsPage to use DataTable component, add pagination, Export CSV, page size selector, and standardize action buttons
- [x] Refactor AssetsPage to use DataTable component, add checkboxes, explicit Clear Filters, page size selector, and standardize sort indicators
- [x] Refactor RisksPage to use DataTable component, add page size selector, standardize action buttons to IconButton, and add sort indicators
- [x] Refactor ControlsPage to use DataTable component, add Filters heading, delete action, and standardize action buttons