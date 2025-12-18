<!-- 717a28c8-18ca-47e3-8fca-c09f609c638f 4a70b4f4-fbbd-476f-b163-455c7f7fa9d2 -->
# Routing Restructure for Trust Domain Deployment

## Overview

Restructure the application routing to support deployment at `https://trust.<domain.com>/` where:

- `/` serves the public Trust Center
- `/admin/*` contains all ISMS document management and admin functionality
- Trust Center routes are simplified (remove `/trust` prefix)

## Current vs. Target Structure

### Current Routes

- `/` → HomePage (ISMS dashboard, protected)
- `/login` → LoginPage (ISMS login)
- `/trust` → TrustCenterPage (public)
- `/trust/login` → TrustCenterLoginPage
- `/trust/private` → TrustCenterPrivatePage
- `/trust/admin` → TrustCenterAdminPage
- `/documents/*`, `/risks/*`, `/assets/*`, `/staff/*`, etc. → ISMS features

### Target Routes

- `/` → TrustCenterPage (public)
- `/login` → TrustCenterLoginPage
- `/private` → TrustCenterPrivatePage
- `/admin` → HomePage (ISMS dashboard, protected)
- `/admin/login` → LoginPage (ISMS login)
- `/admin/documents/*` → Document management routes
- `/admin/risks/*` → Risk management routes
- `/admin/assets/*` → Asset management routes
- `/admin/staff/*` → Staff routes
- `/admin/users` → User management
- `/admin/profile` → Profile
- `/admin/soa` → SoA Export
- `/admin/trust` → TrustCenterAdminPage (trust center document management)

## Implementation Steps

### 1. Update Main Routing (`frontend/src/App.tsx`)

- Move Trust Center routes to root level (remove `/trust` prefix)
- Move all ISMS routes under `/admin` prefix
- Add redirect from `/admin` to `/admin/dashboard` or keep as dashboard
- Consider adding redirects from old routes to new ones for backwards compatibility

### 2. Update Navigation Links (`frontend/src/components/Layout.tsx`)

- Update all navigation links to use `/admin/*` prefix
- Update home link to point to `/admin` for ISMS users
- Update trust center admin link to `/admin/trust`

### 3. Update Route References in Components

Update hardcoded route references in:

- `frontend/src/pages/HomePage.tsx` - Update all `navigate()` calls
- `frontend/src/pages/DocumentsPage.tsx` - Update navigation
- `frontend/src/pages/MassImportPage.tsx` - Update navigation
- `frontend/src/pages/StaffHomePage.tsx` - Update navigation
- `frontend/src/pages/InterestedPartiesPage.tsx` - Update links
- `frontend/src/pages/LegislationPage.tsx` - Update links
- `frontend/src/components/RoleSwitcher.tsx` - Update navigation
- `frontend/src/pages/UnauthorizedPage.tsx` - Update redirect
- `frontend/src/pages/ProfilePage.tsx` - Update redirect
- `frontend/src/pages/LoginPage.tsx` - Update redirect
- `frontend/src/components/ProtectedRoute.tsx` - Update redirect to `/admin/login`
- `frontend/src/components/StaffOnlyRoute.tsx` - Update redirect to `/admin/login`

### 4. Update Trust Center Components

- `frontend/src/pages/TrustCenterPage.tsx` - Update `/trust/login` → `/login`
- `frontend/src/pages/TrustCenterLoginPage.tsx` - Update `/trust/private` → `/private`, `/trust` → `/`
- `frontend/src/pages/TrustCenterPrivatePage.tsx` - Update `/trust/login` → `/login`, `/trust` → `/`
- `frontend/src/services/trustApi.ts` - Update redirect logic from `/trust/login` → `/login`

### 5. Update Authentication Redirects

- Ensure ISMS auth redirects to `/admin/login` instead of `/login`
- Ensure Trust Center auth redirects to `/login` (root level)
- Update any auth context redirects

### 6. Testing Considerations

- Test public access to `/` (Trust Center)
- Test ISMS admin access at `/admin/*`
- Test authentication flows for both systems
- Test navigation between trust center and admin sections
- Verify all internal links work correctly

## Files to Modify

### Core Routing

- `frontend/src/App.tsx` - Main routing configuration

### Navigation & Layout

- `frontend/src/components/Layout.tsx` - Navigation links

### Page Components (Route References)

- `frontend/src/pages/HomePage.tsx`
- `frontend/src/pages/DocumentsPage.tsx`
- `frontend/src/pages/MassImportPage.tsx`
- `frontend/src/pages/StaffHomePage.tsx`
- `frontend/src/pages/InterestedPartiesPage.tsx`
- `frontend/src/pages/LegislationPage.tsx`
- `frontend/src/pages/ProfilePage.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/UnauthorizedPage.tsx`

### Trust Center Components

- `frontend/src/pages/TrustCenterPage.tsx`
- `frontend/src/pages/TrustCenterLoginPage.tsx`
- `frontend/src/pages/TrustCenterPrivatePage.tsx`
- `frontend/src/services/trustApi.ts`

### Route Protection Components

- `frontend/src/components/ProtectedRoute.tsx`
- `frontend/src/components/StaffOnlyRoute.tsx`
- `frontend/src/components/RoleSwitcher.tsx`

## Notes

- Backend API routes remain unchanged (they use `/api/*` prefix)
- Consider adding route redirects for old paths during transition period
- The Layout component should conditionally show navigation based on whether user is in admin section
- Trust Center pages should not use the ISMS Layout component

### To-dos

- [ ] Update App.tsx to restructure routes: move Trust Center to root (/), move all ISMS routes under /admin
- [ ] Update Layout.tsx navigation links to use /admin/* prefix for all ISMS routes
- [ ] Update all hardcoded route references in page components (HomePage, DocumentsPage, etc.) to use /admin/* prefix
- [ ] Update Trust Center components to use simplified routes (remove /trust prefix)
- [ ] Update authentication redirects in ProtectedRoute, StaffOnlyRoute, and auth contexts to use correct login paths
- [ ] Update trustApi.ts service to use new /login route instead of /trust/login