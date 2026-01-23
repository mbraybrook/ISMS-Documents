---
name: Mobile Compatibility Improvements
overview: Add basic mobile device support to ensure the application is functional on mobile browsers while keeping desktop interfaces largely unchanged. Focus on responsive navigation, modal sizing, touch targets, and viewport fixes.
todos:
  - id: responsive-navigation
    content: Add responsive navigation with hamburger menu for mobile in Layout.tsx
    status: completed
  - id: responsive-modals
    content: Make modals responsive (full-screen on mobile, progressively larger on desktop)
    status: completed
  - id: touch-targets
    content: Ensure buttons and interactive elements meet 44x44px minimum touch target size
    status: completed
  - id: risks-page-viewport
    content: Fix RisksPage viewport width issues for mobile compatibility
    status: completed
  - id: responsive-spacing
    content: Add responsive padding and spacing throughout the application
    status: completed
  - id: table-mobile-handling
    content: Ensure tables handle mobile scrolling properly and filters wrap on small screens
    status: completed
  - id: form-mobile-layouts
    content: Make form layouts stack vertically on mobile where appropriate
    status: completed
  - id: mobile-testing
    content: Test key user flows on mobile devices or browser dev tools
    status: completed
isProject: false
---

# Mobile Compatibility Improvements Plan

## Current State Analysis

The application is built with Chakra UI and has a proper viewport meta tag, but lacks mobile-specific optimizations:

- **Navigation**: Horizontal menu with multiple dropdowns will overflow on mobile
- **Modals**: Many use `size="6xl"` which is too large for mobile screens
- **Tables**: Horizontal scrolling works but may not be ideal UX
- **Touch Targets**: Many buttons use `size="sm"` which may be too small
- **Fixed Layouts**: RisksPage uses viewport width tricks that may break on mobile
- **No Responsive Breakpoints**: No use of Chakra's responsive utilities

## Approach

Keep desktop interfaces unchanged while adding mobile-friendly alternatives that activate only on small screens. Use Chakra UI's responsive system (`base`, `md`, `lg` breakpoints) to conditionally render or style components.

## Implementation Tasks

### 1. Responsive Navigation Menu

**File**: `frontend/src/components/Layout.tsx`

- Add hamburger menu button that shows on mobile (`display={{ base: 'block', md: 'none' }}`)
- Hide horizontal navigation on mobile (`display={{ base: 'none', md: 'flex' }}`)
- Create mobile drawer/sidebar with navigation items
- Use Chakra's `Drawer` component for mobile menu
- Ensure menu items are touch-friendly (adequate padding)

**Changes**:

- Import `Drawer`, `DrawerBody`, `DrawerHeader`, `DrawerOverlay`, `DrawerContent`, `DrawerCloseButton` from Chakra UI
- Add `useDisclosure` hook for drawer state
- Conditionally render hamburger icon button on mobile
- Render navigation items in drawer on mobile, horizontal menu on desktop

### 2. Responsive Modal Sizing

**Files**:

- `frontend/src/components/RiskFormModal.tsx`
- `frontend/src/components/ControlFormModal.tsx`
- `frontend/src/pages/LegislationPage.tsx`
- Other modals using `size="6xl"`

- Change modal sizes to be responsive: `size={{ base: 'full', md: 'xl', lg: '6xl' }}`
- Ensure modals are full-screen on mobile, progressively larger on tablets/desktop
- Test that modal content scrolls properly on mobile

**Specific Changes**:

- `RiskFormModal.tsx` line 1105: Change `size="6xl"` to responsive size
- `ControlFormModal.tsx` line 460: Change `size="6xl"` to responsive size
- `LegislationPage.tsx` line 741: Change `size="6xl"` to responsive size
- Check other modals for large sizes

### 3. Touch Target Improvements

**Files**: All components with buttons, especially:

- `frontend/src/components/DataTable.tsx`
- `frontend/src/pages/RisksPage.tsx`
- `frontend/src/components/Layout.tsx`

- Ensure interactive elements meet minimum 44x44px touch target size
- Increase button sizes on mobile where appropriate
- Add adequate spacing between clickable elements
- Use responsive button sizes: `size={{ base: 'md', md: 'sm' }}` for buttons that are currently `size="sm"`

**Changes**:

- Review IconButton components - ensure they're at least 44px on mobile
- Add responsive padding/spacing to action buttons
- Consider making table action buttons larger on mobile

### 4. Fix RisksPage Viewport Issues

**File**: `frontend/src/pages/RisksPage.tsx`

- Remove or make responsive the viewport width tricks (`w="100vw"`, `ml="calc(-50vw + 50%)"`)
- Ensure page doesn't overflow horizontally on mobile
- Make padding responsive: `px={{ base: 4, md: 8 }}`

**Changes**:

- Line 1583-1589: Make the full-width container responsive
- Adjust padding to be smaller on mobile
- Ensure content doesn't break on small screens

### 5. Responsive Container and Spacing

**Files**:

- `frontend/src/components/Layout.tsx`
- `frontend/src/components/DataTable.tsx`
- Various page components

- Make container padding responsive
- Ensure tables have proper mobile overflow handling
- Add responsive spacing to filter sections and action bars

**Changes**:

- `Layout.tsx`: Make header padding responsive
- `DataTable.tsx`: Ensure filter section wraps properly on mobile
- Add responsive padding to page headers and action buttons

### 6. Table Mobile Handling

**File**: `frontend/src/components/DataTable.tsx`

- Ensure horizontal scrolling works smoothly on mobile
- Add visual indicator for scrollable tables
- Ensure sticky columns work on mobile (may need to disable on very small screens)
- Make filter inputs stack vertically on mobile

**Changes**:

- Line 283: Make filter `HStack` wrap: `flexWrap="wrap"`
- Ensure table container has proper touch scrolling
- Consider disabling sticky columns on very small screens if they cause issues

### 7. Form Input Improvements

**Files**: All form modals and pages

- Ensure form inputs are properly sized for mobile
- Make form layouts stack vertically on mobile
- Ensure select dropdowns are touch-friendly

**Changes**:

- Review form layouts in modals
- Use responsive grid/flex layouts: `flexDirection={{ base: 'column', md: 'row' }}`
- Ensure inputs have adequate touch targets

### 8. Testing and Validation

- Test on actual mobile devices or browser dev tools mobile emulation
- Test key user flows:
  - Navigation and menu access
  - Creating/editing risks
  - Viewing tables
  - Form submissions
  - Modal interactions
- Verify touch targets are adequate
- Ensure no horizontal scrolling issues (except intentional table scrolling)

## Technical Details

### Chakra UI Breakpoints

- `base`: 0px (mobile)
- `sm`: 480px
- `md`: 768px (tablet)
- `lg`: 992px (desktop)
- `xl`: 1280px
- `2xl`: 1536px

### Responsive Pattern Examples

```typescript
// Responsive display
display={{ base: 'block', md: 'none' }}  // Show on mobile, hide on desktop
display={{ base: 'none', md: 'flex' }}   // Hide on mobile, show on desktop

// Responsive sizing
size={{ base: 'full', md: 'xl', lg: '6xl' }}  // Full on mobile, progressively larger

// Responsive spacing
px={{ base: 4, md: 8 }}  // Smaller padding on mobile
spacing={{ base: 2, md: 4 }}  // Tighter spacing on mobile

// Responsive layout
flexDirection={{ base: 'column', md: 'row' }}  // Stack on mobile, row on desktop
```

## Success Criteria

- Navigation is accessible on mobile via hamburger menu
- Modals fit properly on mobile screens without horizontal overflow
- Touch targets are at least 44x44px
- Tables scroll horizontally smoothly on mobile
- No unintended horizontal page scrolling
- Forms are usable on mobile devices
- Desktop experience remains unchanged

## Notes

- This is a "light usage" mobile support - not a full mobile redesign
- Desktop interfaces and interactions remain the same
- Focus is on making the app functional, not optimized for mobile-first workflows
- Complex tables may still require horizontal scrolling on mobile (acceptable for light usage)