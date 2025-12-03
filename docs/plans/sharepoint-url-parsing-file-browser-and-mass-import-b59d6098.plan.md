<!-- b59d6098-805f-42fe-b5de-3b305cc88649 112e025c-317b-481c-ba24-d64588a389ab -->
# SharePoint Document Creation Improvements

## Overview

Enhance the document creation workflow by adding URL parsing, file browser, and mass import capabilities to eliminate manual entry of SharePoint IDs.

## Implementation Plan

### 1. SharePoint URL Parsing

**Backend Changes:**

- Add `POST /api/sharepoint/parse-url` endpoint in `backend/src/routes/sharepoint.ts`
- Accepts a SharePoint web URL (e.g., `https://contoso.sharepoint.com/sites/SiteName/Shared%20Documents/file.docx`)
- Uses Microsoft Graph API to resolve the URL and extract Site ID, Drive ID, and Item ID
- Returns extracted IDs and file metadata (name, webUrl, etc.)
- Uses Graph API endpoint: `/sites/{hostname}:/{server-relative-path}:/driveItem` or `/shares/{encoded-sharing-url}`

**Frontend Changes:**

- Update `frontend/src/components/DocumentFormModal.tsx`
- Add a "Paste SharePoint Link" button/input field above the SharePoint ID fields
- When URL is pasted, call the parse endpoint
- Auto-populate Site ID, Drive ID, Item ID, and title fields
- Show loading state and error handling

### 2. SharePoint File Browser

**Backend Changes:**

- Enhance `GET /api/sharepoint/items` in `backend/src/routes/sharepoint.ts`
- Support folder navigation (already partially implemented)
- Return folder structure with type indicators (file vs folder)
- Add pagination support for large directories
- Use configured `SHAREPOINT_SITE_ID` and `SHAREPOINT_DRIVE_ID` from env if not provided

**Frontend Changes:**

- Create new component `frontend/src/components/SharePointFileBrowser.tsx`
- Modal/drawer component with folder navigation
- Display files and folders in a tree/list view
- Allow selecting files (single selection mode)
- Show file metadata (name, size, modified date)
- Integrate with MSAL to get Graph access token
- Pass token via `x-graph-token` header to backend

- Update `frontend/src/components/DocumentFormModal.tsx`
- Add "Browse SharePoint" button next to SharePoint ID fields
- Open file browser modal when clicked
- On file selection, populate Site ID, Drive ID, Item ID, and title

### 3. Mass Import Functionality

**Backend Changes:**

- Add `POST /api/documents/bulk-import` endpoint in `backend/src/routes/documents.ts`
- Accepts array of SharePoint item IDs
- For each item:
- Fetch metadata from SharePoint using Graph API
- Auto-populate: title (from name), sharePointSiteId, sharePointDriveId, sharePointItemId
- Use defaults: type='OTHER', version='1.0', status='DRAFT', ownerUserId=current user
- Create document records
- Return created documents and any errors
- Support transaction rollback on critical errors (optional)

- Enhance `GET /api/sharepoint/items` to support listing all files recursively or with filters

**Frontend Changes:**

- Create new page `frontend/src/pages/MassImportPage.tsx`
- Accessible from Documents page (Admin/Editor only)
- Uses SharePointFileBrowser component in "multi-select" mode
- Shows selected files list with preview of auto-populated metadata
- Allows bulk editing of defaults (type, status, version) before import
- Shows import progress and results
- Displays errors for failed imports

- Update `frontend/src/pages/DocumentsPage.tsx`
- Add "Mass Import" button (Admin/Editor only)
- Navigate to MassImportPage

## Technical Details

### SharePoint URL Parsing

- SharePoint web URLs can be parsed using Graph API's `/shares` endpoint with encoded URL
- Alternative: Use `/sites/{hostname}:/{server-relative-path}` to get drive item
- Need to handle various URL formats (direct links, sharing links, etc.)

### File Browser

- Use existing `listSharePointItems` service function
- Enhance to support folder navigation and file type detection
- Frontend needs Graph access token from MSAL context

### Mass Import

- Use batch operations where possible for performance
- Handle partial failures gracefully (some succeed, some fail)
- Consider rate limiting for large imports

## Files to Modify

1. `backend/src/routes/sharepoint.ts` - Add parse-url endpoint, enhance items endpoint
2. `backend/src/services/sharePointService.ts` - Add URL parsing function, enhance listing
3. `backend/src/routes/documents.ts` - Add bulk-import endpoint
4. `frontend/src/components/DocumentFormModal.tsx` - Add URL parsing and file browser integration
5. `frontend/src/components/SharePointFileBrowser.tsx` - New component
6. `frontend/src/pages/MassImportPage.tsx` - New page
7. `frontend/src/pages/DocumentsPage.tsx` - Add mass import button
8. `frontend/src/services/api.ts` - Add new API methods (if needed)

## Dependencies

- Microsoft Graph API access (already configured)
- MSAL for frontend token acquisition (already configured)
- Existing SharePoint service infrastructure

### To-dos

- [ ] Implement SharePoint URL parsing endpoint in backend (POST /api/sharepoint/parse-url)
- [ ] Add URL parsing function to sharePointService.ts to extract IDs from web URLs
- [ ] Add URL paste functionality to DocumentFormModal with auto-population of IDs
- [ ] Enhance SharePoint items endpoint to support folder navigation and use default site/drive from config
- [ ] Create SharePointFileBrowser component with folder navigation and file selection
- [ ] Integrate file browser into DocumentFormModal
- [ ] Implement bulk document import endpoint with auto-populated metadata
- [ ] Create MassImportPage with file selection and bulk editing capabilities
- [ ] Add Mass Import button to DocumentsPage and wire up navigation