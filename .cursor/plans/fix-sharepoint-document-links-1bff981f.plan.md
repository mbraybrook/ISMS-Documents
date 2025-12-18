<!-- 1bff981f-f01a-4eb2-8a84-d1ab32ec27c2 54155208-d8a0-493c-bfba-eecf6c8849e0 -->
# Fix SharePoint Document Link Loading

## Problem Analysis

The SharePoint document link feature is implemented but not working because:

1. **Frontend Issue**: In `DocumentsPage.tsx`, the `getDocumentUrl` function doesn't pass the Graph access token to the `/api/sharepoint/url` endpoint in the fallback case (line 220-226), even when a token is available.

2. **Backend Issue**: The `generateSharePointUrl` function in `sharePointService.ts` (line 106-114) returns a Graph API URL (`https://graph.microsoft.com/v1.0/sites/...`) instead of a proper SharePoint web URL that can be opened in a browser.

3. **Backend Issue**: When `/api/sharepoint/url` doesn't receive an access token, it falls back to `generateSharePointUrl`, which produces an invalid browser URL.

## Solution

### 1. Fix Frontend Token Passing

**File**: `frontend/src/pages/DocumentsPage.tsx`

- Modify `getDocumentUrl` function (lines 200-242) to pass the Graph token to `/api/sharepoint/url` when available
- Ensure the token is retrieved once and reused for both API calls

### 2. Improve Backend URL Generation

**File**: `backend/src/services/sharePointService.ts`

- Update `generateSharePointUrl` to accept an optional access token
- When token is available, fetch the SharePoint site information to get the `webUrl`
- Construct a proper SharePoint web URL using the site's webUrl and item path
- If token is not available, return `null` or throw an error instead of returning a Graph API URL

### 3. Enhance Backend URL Endpoint

**File**: `backend/src/routes/sharepoint.ts`

- Update `/api/sharepoint/url` endpoint (lines 209-254) to better handle cases without access tokens
- Improve error messages when URL cannot be generated
- Ensure it always tries to get the webUrl from the item first, then from the site if needed

### 4. Fix Similar Issue in AcknowledgmentPage

**File**: `frontend/src/pages/AcknowledgmentPage.tsx`

- Apply the same fix to `getDocumentUrl` function (lines 118-143) to ensure consistency

## Implementation Details

- The Graph API item response includes a `webUrl` field that should be used when available
- When constructing URLs manually, use the site's `webUrl` from `getSharePointSite` and append the item path
- Ensure proper error handling and logging for debugging
- Maintain backward compatibility where possible