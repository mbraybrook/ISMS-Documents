---
name: Trust Center Design Redesign
overview: Redesign the public-facing Trust Center page to match the modern design from the reference website, including a header with navigation, hero section, stats cards, certifications showcase, and restructured documentation library.
todos:
  - id: create-header
    content: Create TrustCenterHeader component with navigation, logo area, and login/register buttons
    status: completed
  - id: create-hero
    content: Create TrustCenterHero component with badge, heading, description, and three feature cards
    status: completed
  - id: create-stats
    content: Create TrustCenterStats component with four stat cards and backend API support
    status: completed
  - id: create-certifications
    content: Create TrustCenterCertifications showcase component with backend API support
    status: completed
  - id: create-documentation
    content: Create TrustCenterDocumentation component with Policies and Certifications & Reports subsections
    status: completed
  - id: update-document-card
    content: Update TrustDocumentCard to match design with type badges and Request Access functionality
    status: completed
  - id: create-footer
    content: Create TrustCenterFooter component with branding, quick links, and contact info
    status: completed
  - id: restructure-page
    content: Restructure TrustCenterPage to use all new components and update layout
    status: completed
    dependencies:
      - create-header
      - create-hero
      - create-stats
      - create-certifications
      - create-documentation
      - create-footer
  - id: backend-stats-api
    content: Add backend API endpoint for configurable Trust Center stats
    status: completed
  - id: backend-certifications-api
    content: Add backend API endpoint for showcase certifications data
    status: completed
---

# Trust Center Public Page Design Redesign

## Overview

Redesign the public-facing Trust Center page (`frontend/src/pages/TrustCenterPage.tsx`) to match the modern design from the reference website. This includes adding a header with navigation, hero section, stats cards, certifications showcase, and restructuring the documentation library.

## Key Design Elements from Reference

1. **Header/Navigation Banner**: Logo, "Trust Center" branding, navigation links (Overview, Certifications, Documents), Login/Register buttons
2. **Hero Section**: "Security & Compliance" badge, "Your Trust is Our Priority" heading, description, three feature cards (Data Encryption, SOC 2 Type II, GDPR)
3. **Stats Section**: Four stat cards (Active Certifications, Policies & Procedures, Uptime SLA, Security Monitoring)
4. **Certifications & Compliance Section**: Showcase cards for major certifications (ISO 27001, SOC 2, GDPR, HIPAA, PCI DSS)
5. **Documentation Library**: Two subsections - "Policies" and "Certifications & Reports" with enhanced document cards
6. **Footer**: Enhanced footer with branding, quick links, and contact information

## Implementation Plan

### 1. Create Trust Center Header Component

**File**: `frontend/src/components/TrustCenterHeader.tsx`

- Navigation banner with logo/branding area
- Navigation links: Overview (#overview), Certifications (#certifications), Documents (#documents)
- Login/Register buttons (right-aligned)
- Responsive design for mobile
- Smooth scroll behavior for anchor links

### 2. Create Hero Section Component

**File**: `frontend/src/components/TrustCenterHero.tsx`

- "Security & Compliance" badge/tag
- Main heading: "Your Trust is Our Priority"
- Descriptive paragraph
- Three feature cards in a row:
- Data Encryption (AES-256 at rest)
- SOC 2 Type II (Certified)
- GDPR (Compliant)
- Each card with icon and description
- Responsive grid layout

### 3. Create Stats Section Component

**File**: `frontend/src/components/TrustCenterStats.tsx`

- Four stat cards in a grid:
- Active Certifications (with count)
- Policies & Procedures (with count)
- Uptime SLA (with percentage)
- Security Monitoring (24/7)
- Each card with icon, number, title, and description
- Fetch stats from backend API (configurable values)

**Backend Support Needed**:

- Add endpoint to fetch Trust Center stats (or use existing data to calculate)
- Consider adding a `TrustCenterStats` table for configurable values

### 4. Create Certifications Showcase Component

**File**: `frontend/src/components/TrustCenterCertifications.tsx`

- Section heading: "Certifications & Compliance"
- Description text
- Grid of certification cards:
- ISO 27001
- SOC 2 Type II
- GDPR
- HIPAA
- PCI DSS
- Each card shows: title, badge (Certified/Compliant), description, valid until date
- Fetch from backend API (separate configurable data, not tied to documents)

**Backend Support Needed**:

- Add `TrustCenterCertification` model/table for configurable certifications
- Add API endpoint to fetch certifications showcase data
- Fields: name, type (certified/compliant), description, validUntil, displayOrder

### 5. Restructure Documentation Library Section

**File**: `frontend/src/components/TrustCenterDocumentation.tsx`

- Section heading: "Documentation Library"
- Description text
- Two subsections:
- **Policies**: Shows documents with category='policy'
- **Certifications & Reports**: Shows documents with category='certification' OR category='report'
- Each subsection has icon and heading
- Enhanced document cards matching design:
- Title with document type badge (POLICY, REPORT, CERTIFICATION)
- Description
- Version and status (APPROVED, RESTRICTED)
- Download button or "Request Access" button (for restricted/private docs)

**Update**: `frontend/src/components/TrustDocumentCard.tsx`

- Match design style with type badges
- Show "Request Access" for restricted/private documents instead of download
- Enhanced styling to match reference design

### 6. Update Trust Center Page Layout

**File**: `frontend/src/pages/TrustCenterPage.tsx`

- Remove current simple header, replace with `TrustCenterHeader`
- Add hero section at top
- Add stats section
- Add certifications showcase section
- Restructure documents section to use new `TrustCenterDocumentation` component
- Move "Key Suppliers" section to bottom (less prominent)
- Add smooth scrolling for anchor links
- Update overall spacing and layout
- Remove or update `DataSensitivityFooter` to match design footer

### 7. Create Enhanced Footer Component

**File**: `frontend/src/components/TrustCenterFooter.tsx`

- Logo/branding area
- Description text
- Quick Links section (Overview, Certifications, Documentation)
- Contact Security Team section with email
- Copyright notice
- Replace or enhance `DataSensitivityFooter` usage

### 8. Backend API Endpoints

**Files**: `backend/src/routes/trust/index.ts`

Add new endpoints:

- `GET /api/trust/stats` - Returns configurable stats (certifications count, policies count, uptime SLA, monitoring status)
- `GET /api/trust/certifications` - Returns showcase certifications list

**Database Schema** (if needed):

Consider adding:

- `TrustCenterStats` table for configurable stats
- `TrustCenterCertification` table for showcase certifications

Or use existing data to calculate stats dynamically.

### 9. Styling and Theme Updates

- Update color scheme to match modern design
- Add appropriate spacing and padding
- Ensure responsive design for mobile/tablet
- Add hover effects and transitions
- Use Chakra UI components with custom styling

### 10. Icons and Assets

- Add icons for features (encryption, certifications, etc.)
- Consider logo/branding assets
- Use Chakra UI icons or add custom icon components

## File Changes Summary

**New Components**:

- `frontend/src/components/TrustCenterHeader.tsx`
- `frontend/src/components/TrustCenterHero.tsx`
- `frontend/src/components/TrustCenterStats.tsx`
- `frontend/src/components/TrustCenterCertifications.tsx`
- `frontend/src/components/TrustCenterDocumentation.tsx`
- `frontend/src/components/TrustCenterFooter.tsx`

**Updated Files**:

- `frontend/src/pages/TrustCenterPage.tsx` - Complete restructure
- `frontend/src/components/TrustDocumentCard.tsx` - Enhanced styling and functionality
- `frontend/src/components/TrustCategorySection.tsx` - May be replaced by new structure
- `backend/src/routes/trust/index.ts` - Add new API endpoints

**Backend Schema** (optional):

- Consider adding tables for configurable stats and certifications, or calculate from existing data

## Notes

- Keep existing functionality (authentication, document downloads, NDA acceptance)
- Maintain backward compatibility with existing API
- Stats and certifications can start as static/placeholder values and be made configurable later
- Key Suppliers section will be moved to bottom of page (less prominent)
- All anchor links should use smooth scrolling behavior