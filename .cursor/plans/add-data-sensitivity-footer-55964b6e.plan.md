<!-- 55964b6e-de73-4a51-aecc-bea947aff46b 5194eb9d-465f-4beb-a3ff-45c6723f8712 -->
# Add Data Sensitivity Footer to All Pages

## Overview

Add a small, subtle "Paythru Confidential" data sensitivity label footer that appears on every page of the site.

## Implementation Plan

### 1. Create DataSensitivityFooter Component

Create a new reusable footer component at `frontend/src/components/DataSensitivityFooter.tsx`:

- Small, subtle styling (gray text, small font size)
- Fixed or absolute positioning at the bottom of the viewport
- Text: "Paythru Confidential"
- Minimal visual impact (low opacity, small padding)

### 2. Add Footer to Layout Component

Modify `frontend/src/components/Layout.tsx`:

- Import the new `DataSensitivityFooter` component
- Add it at the end of the Layout component's JSX, after the Container with children
- Ensure it appears on all admin pages that use Layout

### 3. Add Footer to Trust Center Pages

Add the footer to pages that don't use Layout:

- `frontend/src/pages/TrustCenterPage.tsx` - Add footer after the Container
- `frontend/src/pages/TrustCenterLoginPage.tsx` - Add footer after the Container
- `frontend/src/pages/TrustCenterPrivatePage.tsx` - Add footer after the Container

### 4. Add Footer to Standalone Pages

Add the footer to standalone authentication/error pages:

- `frontend/src/pages/LoginPage.tsx` - Add footer within the Box container
- `frontend/src/pages/UnauthorizedPage.tsx` - Add footer within the Box container

## Technical Details

The footer component will use Chakra UI components (Box, Text) for consistent styling with the rest of the application. It should be positioned to appear at the bottom of each page without interfering with page content. The styling should be subtle (e.g., `color="gray.400"`, `fontSize="xs"`, `opacity={0.7}`) to meet the requirement of being "small and subtle".

### To-dos

- [ ] Create DataSensitivityFooter component with subtle styling
- [ ] Add footer to Layout component for all admin pages
- [ ] Add footer to TrustCenterPage, TrustCenterLoginPage, and TrustCenterPrivatePage
- [ ] Add footer to LoginPage and UnauthorizedPage