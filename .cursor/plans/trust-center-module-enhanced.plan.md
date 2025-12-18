# Trust Center Module - Enhanced Implementation Plan

## Overview

This plan implements a Trust Center module that exposes specific documents to external users via a public-facing route (`/trust`). External users authenticate with email/password (separate from Entra ID), while internal staff manage document visibility and approve access requests.

**This enhanced version addresses all critical gaps and recommendations identified in the review.**

## Database Schema Changes

### 1. Update Prisma Schema (`backend/prisma/schema.prisma`)

Add four new models:

**ExternalUser Model:**

- `id` (String, @id)
- `email` (String, @unique)
- `passwordHash` (String)
- `companyName` (String)
- `isApproved` (Boolean, default: false)
- `passwordResetToken` (String?) - For password reset functionality
- `passwordResetExpires` (DateTime?) - Token expiry
- `tokenVersion` (Int, default: 0) - For JWT invalidation on password change
- `termsAcceptedAt` (DateTime?) - NDA/terms acceptance timestamp
- `createdAt` (DateTime, @default(now()))
- `updatedAt` (DateTime)
- `TrustDownload` relation (one-to-many)
- `TrustAuditLog` relation (one-to-many, for actions performed by this user)

**TrustDocSetting Model:**

- `id` (String, @id)
- `documentId` (String, @unique) - Foreign key to Document
- `visibilityLevel` (String) - Enum: 'public' | 'private'
- `category` (String) - Enum: 'certification' | 'policy' | 'report'
- `sharePointUrl` (String?) - Direct SharePoint URL for the document
- `sharePointSiteId` (String?) - **Cached site ID from URL parsing**
- `sharePointDriveId` (String?) - **Cached drive ID from URL parsing**
- `sharePointItemId` (String?) - **Cached item ID from URL parsing**
- `publicDescription` (String?) - User-friendly description for Trust Center
- `displayOrder` (Int?) - Control document ordering within categories
- `requiresNda` (Boolean, default: false) - Require NDA acceptance before download
- `maxFileSizeMB` (Int?) - Override default file size limit (default: 50MB)
- `createdAt` (DateTime, @default(now()))
- `updatedAt` (DateTime)
- `Document` relation (one-to-one)
- `TrustDownload` relation (one-to-many)
- Index on `visibilityLevel`, `category`, and `displayOrder`

**TrustDownload Model:**

- `id` (String, @id)
- `externalUserId` (String) - Foreign key to ExternalUser
- `docId` (String) - Foreign key to TrustDocSetting (or Document)
- `downloadToken` (String?) - One-time download token (if used)
- `termsAccepted` (Boolean, default: false) - Whether NDA was accepted
- `timestamp` (DateTime, @default(now()))
- `ExternalUser` relation
- Index on `externalUserId`, `docId`, and `timestamp`

**TrustAuditLog Model (NEW):**

- `id` (String, @id)
- `action` (String) - Enum: 'USER_APPROVED', 'USER_DENIED', 'DOC_VISIBILITY_CHANGED', 'DOC_CATEGORY_CHANGED', 'PASSWORD_RESET', 'LOGIN_FAILED', 'DOWNLOAD', etc.
- `performedByUserId` (String?) - Internal user ID (if action by staff)
- `performedByExternalUserId` (String?) - External user ID (if action by external user)
- `targetUserId` (String?) - Target external user (for user actions)
- `targetDocumentId` (String?) - Target document (for document actions)
- `details` (String?) - JSON string with additional context
- `ipAddress` (String?) - IP address of requester
- `timestamp` (DateTime, @default(now()))
- Index on `action`, `timestamp`, `performedByUserId`, `targetDocumentId`

### 2. Create Migration

- Generate Prisma migration: `npm run db:migrate -- --name add_trust_center_tables`
- Update TypeScript types after migration

## Backend Dependencies

### 3. Install Required Packages (`backend/package.json`)

Add to dependencies:

- `bcrypt` (^5.1.1) - Password hashing
- `@types/bcrypt` (^5.0.2) - TypeScript types
- `@azure/identity` (^4.0.0) - Azure app-only authentication (includes token caching)
- `pdf-lib` (^1.17.1) - PDF manipulation (replaces pypdf)
- `pdfkit` (^0.14.0) - PDF generation for watermarks (replaces reportlab)
- `@types/pdfkit` (^0.13.0) - TypeScript types
- `express-rate-limit` (^7.1.5) - Rate limiting middleware
- `crypto` (built-in) - For generating secure tokens
- `nodemailer` (^6.9.8) - Email service (optional, for notifications)
- `@types/nodemailer` (^6.4.14) - TypeScript types

Note: Using Node.js PDF libraries (`pdf-lib`, `pdfkit`) instead of Python libraries (`pypdf`, `reportlab`) since the backend is Node.js/TypeScript.

## Backend Implementation

### 4. Update Configuration (`backend/src/config.ts`)

Add Trust Center and Azure app-only auth configuration:

- `trustCenter.jwtSecret` - Secret for external user JWT tokens (min 32 chars)
- `trustCenter.jwtExpiry` - Token expiry (e.g., '24h' - shorter for security)
- `trustCenter.maxFileSizeMB` - Maximum file size for watermarking (default: 50)
- `trustCenter.downloadTokenExpiry` - Download token expiry (e.g., '1h')
- `azure.appClientId` - Azure AD App Registration Client ID for app-only auth
- `azure.appClientSecret` - Azure AD App Registration Client Secret
- `azure.tenantId` - Azure AD Tenant ID
- `cors.trustCenterOrigins` - Array of allowed origins for Trust Center subdomain
- `email` (optional) - Email service configuration (SMTP settings for notifications)

### 5. Create Rate Limiting Middleware (`backend/src/middleware/rateLimit.ts`)

- Create rate limiters using `express-rate-limit`:
  - **Login limiter**: 5 attempts per 15 minutes per IP
  - **Register limiter**: 3 attempts per hour per IP
  - **Download limiter**: 20 downloads per hour per user
- Store rate limit data in memory (or Redis for production)
- Return appropriate error messages when limit exceeded

### 6. Create External User Authentication (`backend/src/routes/trust/auth.ts`)

**POST /api/trust/register**

- Protected by register rate limiter
- Accepts: `email`, `password`, `companyName`
- Validates email format and password strength (min 8 chars, complexity)
- Checks if email already exists
- Hashes password with bcrypt (10 rounds)
- Creates ExternalUser with `isApproved=false`
- Logs registration in TrustAuditLog
- Sends registration confirmation email (optional)
- Returns: `{ id, email, companyName, isApproved, message: 'Registration successful. Awaiting approval.' }`

**POST /api/trust/login**

- Protected by login rate limiter
- Accepts: `email`, `password`
- Validates credentials (bcrypt compare)
- Checks `isApproved=true`
- Checks `tokenVersion` matches (for invalidation)
- Returns JWT token (includes `userId`, `tokenVersion`, `exp`) if valid
- Returns 403 if user not approved
- Returns 401 if credentials invalid
- Logs failed login attempts in TrustAuditLog

**POST /api/trust/logout**

- Protected route (requires external user JWT)
- Invalidates token by incrementing `tokenVersion` in database
- Returns success message

**POST /api/trust/forgot-password**

- Protected by rate limiter (3 requests per hour per email)
- Accepts: `email`
- Generates secure reset token (crypto.randomBytes)
- Sets `passwordResetToken` and `passwordResetExpires` (1 hour expiry)
- Sends password reset email with reset link
- Returns: `{ message: 'If email exists, reset link sent' }` (don't reveal if email exists)

**POST /api/trust/reset-password**

- Accepts: `token`, `newPassword`
- Validates reset token and expiry
- Updates password hash
- Increments `tokenVersion` (invalidates all existing tokens)
- Clears `passwordResetToken` and `passwordResetExpires`
- Logs password reset in TrustAuditLog
- Returns success message

**GET /api/trust/me**

- Protected route (requires external user JWT)
- Validates token version matches user's `tokenVersion`
- Returns current external user profile (excluding password hash)

### 7. Create External User JWT Middleware (`backend/src/middleware/trustAuth.ts`)

- Similar to `authenticateToken` but validates external user JWT tokens
- Extracts `externalUserId` and `tokenVersion` from token
- Validates token version matches user's `tokenVersion` in database
- Attaches `externalUser` to `req.externalUser`
- Returns 401 if token invalid, expired, or user not approved

### 8. Update SharePoint Service (`backend/src/services/sharePointService.ts`)

Add app-only authentication support with token caching:

**New function: `getAppOnlyAccessToken()`**

- Uses `@azure/identity` ClientSecretCredential with token caching
- Caches token in memory with expiry check
- Authenticates with Azure Client ID/Secret
- Returns access token for Microsoft Graph API
- Scopes: `['https://graph.microsoft.com/.default']`
- Automatically refreshes token when near expiration (within 5 minutes)
- Returns cached token if still valid

**New function: `parseSharePointUrlToIds(url: string, accessToken?: string): Promise<{siteId, driveId, itemId} | null>`**

- Parses SharePoint URL (e.g., `https://tenant.sharepoint.com/sites/SiteName/Shared%20Documents/file.pdf`)
- Uses Microsoft Graph API `/shares` endpoint or direct path resolution
- Extracts `siteId`, `driveId`, `itemId` from URL
- Falls back to parsing URL structure if API fails
- Returns null if URL cannot be parsed
- Caches parsed IDs to avoid repeated API calls

**New function: `downloadSharePointFile(accessToken, siteId, driveId, itemId, maxSizeMB?: number)`**

- Downloads file content as stream/buffer
- Works with both delegated (user) and app-only tokens
- Checks file size before download (throws error if exceeds `maxSizeMB`)
- Handles 404 errors (file not found) with clear error messages
- Handles 403 errors (permission denied) with clear error messages
- Implements retry logic for transient failures (3 retries with exponential backoff)
- Returns file buffer and metadata (mimeType, name, size)
- Throws specific errors: `FileNotFoundError`, `FileTooLargeError`, `PermissionDeniedError`

**New function: `verifySharePointFileAccess(accessToken, siteId, driveId, itemId): Promise<boolean>`**

- Checks if file exists and is accessible
- Returns true if accessible, false otherwise
- Used for pre-flight checks before download

### 9. Create Watermark Service (`backend/src/services/watermarkService.ts`)

**Function: `addWatermarkToPdf(pdfBuffer: Buffer, userEmail: string, date: Date, maxSizeMB?: number): Promise<Buffer>`**

- Checks PDF size before processing (throws error if exceeds `maxSizeMB`, default: 50MB)
- Uses `pdf-lib` to load PDF
- Handles encrypted PDFs (attempts to decrypt, falls back if fails)
- Handles form-fillable PDFs (preserves form fields)
- Uses `pdfkit` to create watermark text: "Confidential - Prepared for {userEmail} - {date}"
- Adds document hash to watermark for verification: "Document Hash: {sha256}"
- Overlays watermark on each page (semi-transparent, diagonal)
- Handles PDFs with complex structures (images, annotations) gracefully
- Returns watermarked PDF buffer
- **Fallback behavior**: If watermarking fails (encrypted, corrupted, etc.):
  - Logs error with details
  - Returns original PDF with warning (or blocks download based on config)
  - Optionally adds disclaimer text to first page if possible

**Function: `validatePdfForWatermarking(pdfBuffer: Buffer): {valid: boolean, reason?: string}`**

- Pre-validates PDF before watermarking
- Checks for encryption, corruption, unsupported features
- Returns validation result

### 10. Create Audit Logging Service (`backend/src/services/trustAuditService.ts`)

**Function: `logTrustAction(action, performedBy, target, details, ipAddress)`**

- Creates TrustAuditLog entry
- Records action type, performer (internal or external user), target, details (JSON), IP address
- Used throughout Trust Center routes for compliance tracking

### 11. Create Trust Center Routes (`backend/src/routes/trust/index.ts`)

**GET /api/trust/documents**

- Public endpoint (no auth required)
- Returns documents where `visibilityLevel='public'` AND TrustDocSetting exists
- Includes `publicDescription`, `displayOrder`, `category`
- Groups by `category` (certification, policy, report)
- Sorted by `displayOrder` within each category
- Returns: `{ category: string, documents: TrustDocument[] }[]`

**GET /api/trust/documents/private**

- Protected (requires external user JWT via `trustAuth` middleware)
- Returns documents where `visibilityLevel='private'` AND user is approved
- Checks `termsAcceptedAt` if document `requiresNda=true`
- Same grouping and sorting structure as public endpoint

**GET /api/trust/download/:docId**

- Public for public docs, protected for private docs
- **Optional query param**: `token` (download token for additional security)
- Validates download token if provided (one-time use, expires after 1 hour)
- Checks document visibility:
  - If `public`: Stream file directly (no watermark)
  - If `private`: Requires authenticated and approved external user
- **NDA Check**: If `requiresNda=true`, checks `termsAcceptedAt` on user
  - If not accepted, returns 403 with message to accept terms first
  - Records acceptance in download log
- **File Size Check**: Validates file size against `maxFileSizeMB` (default: 50MB)
- **SharePoint Access**:
  - Uses cached `sharePointSiteId`, `driveId`, `itemId` from TrustDocSetting
  - If not cached, parses `sharePointUrl` using `parseSharePointUrlToIds()`
  - Caches parsed IDs back to TrustDocSetting for future use
  - Uses app-only auth for external users, delegated auth for internal
- **Error Handling**:
  - 404 if file not found in SharePoint
  - 403 if permission denied
  - 413 if file too large
  - 500 with retry suggestion if SharePoint temporarily unavailable
- **Watermarking**:
  - For private documents, applies watermark using `addWatermarkToPdf()`
  - Falls back to original PDF if watermarking fails (with logged warning)
  - Skips watermarking for non-PDF files
- Records download in `TrustDownload` table (with `termsAccepted` flag, `downloadToken`)
- Logs download in TrustAuditLog
- Returns file stream with appropriate headers (Content-Type, Content-Disposition, CSP headers)

**POST /api/trust/accept-terms**

- Protected (requires external user JWT)
- Accepts optional `documentId` (if accepting for specific document)
- Sets `termsAcceptedAt` on ExternalUser
- Records acceptance in TrustAuditLog
- Returns success message

**GET /api/trust/admin/pending-requests**

- Protected (requires internal staff auth - `authenticateToken` + `requireRole('ADMIN', 'EDITOR')`)
- Returns list of ExternalUsers where `isApproved=false`
- Includes `createdAt`, `companyName`
- Returns: `{ id, email, companyName, createdAt }[]`

**POST /api/trust/admin/approve-user/:userId**

- Protected (requires internal staff auth)
- Sets `isApproved=true` for specified external user
- Logs action in TrustAuditLog (action: 'USER_APPROVED', performedBy: req.user.id, targetUserId: userId)
- Sends approval notification email (optional)
- Returns updated user object

**POST /api/trust/admin/deny-user/:userId**

- Protected (requires internal staff auth)
- Accepts optional `reason` in request body
- Soft delete or mark user as denied (or hard delete if preferred)
- Logs action in TrustAuditLog (action: 'USER_DENIED', performedBy: req.user.id, targetUserId: userId, details: reason)
- Sends denial notification email with reason (optional)
- Returns success message

**GET /api/trust/admin/documents**

- Protected (requires internal staff auth)
- Returns all documents with their Trust Center settings
- Includes documents without Trust Center settings (for management UI)
- Returns: `{ document: Document, trustSetting: TrustDocSetting | null }[]`

**PUT /api/trust/admin/documents/:docId/settings**

- Protected (requires internal staff auth)
- Creates or updates `TrustDocSetting` for a document
- Accepts: `{ visibilityLevel, category, sharePointUrl?, publicDescription?, displayOrder?, requiresNda? }`
- **SharePoint URL Parsing**:
  - If `sharePointUrl` provided, parses it using `parseSharePointUrlToIds()`
  - Caches `sharePointSiteId`, `driveId`, `itemId` in TrustDocSetting
  - Validates that file exists and is accessible
- If `sharePointUrl` not provided, uses existing document's SharePoint metadata
- Logs action in TrustAuditLog (action: 'DOC_VISIBILITY_CHANGED' or 'DOC_CATEGORY_CHANGED', performedBy: req.user.id, targetDocumentId: docId)
- Returns updated TrustDocSetting

**GET /api/trust/admin/audit-log**

- Protected (requires internal staff auth)
- Returns TrustAuditLog entries with filtering
- Query params: `action?`, `startDate?`, `endDate?`, `limit?`
- Returns paginated audit log entries

### 12. Update CORS Configuration (`backend/src/index.ts`)

- Update CORS middleware to allow Trust Center subdomain
- Add `trustCenterOrigins` from config to allowed origins
- Configure credentials if needed for cross-subdomain cookies
- Example: `origin: function (origin, callback) { if (allowedOrigins.includes(origin) || !origin) callback(null, true); else callback(new Error('Not allowed by CORS')); }`

### 13. Register Trust Center Routes (`backend/src/index.ts`)

- Import trust router: `import { trustRouter } from './routes/trust'`
- Mount at `/api/trust`: `app.use('/api/trust', trustRouter)`
- Add CSP headers middleware for PDF downloads (Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';)

## Frontend Implementation

### 14. Create Trust Center Types (`frontend/src/types/trust.ts`)

Define TypeScript interfaces:

- `ExternalUser`
- `TrustDocSetting`
- `TrustDownload`
- `TrustDocument` (extends Document with trust settings)
- `TrustCategory` enum
- `TrustAuditLog` (for admin audit log view)

### 15. Create Trust Center API Service (`frontend/src/services/trustApi.ts`)

API client functions:

- `register(email, password, companyName)` - Returns user object
- `login(email, password)` - Returns JWT token, store in localStorage with expiry
- `logout()` - Clears token from localStorage
- `forgotPassword(email)` - Request password reset
- `resetPassword(token, newPassword)` - Reset password with token
- `getMe()` - Get current external user
- `getPublicDocuments()` - Fetch public documents (grouped by category)
- `getPrivateDocuments()` - Fetch private documents (requires auth)
- `downloadDocument(docId, token?)` - Download document (with optional download token)
- `acceptTerms(documentId?)` - Accept NDA/terms (for specific document or general)
- `getPendingRequests()` - Admin: Get pending user requests
- `approveUser(userId)` - Admin: Approve user
- `denyUser(userId, reason?)` - Admin: Deny user with optional reason
- `getDocumentSettings()` - Admin: Get all document settings
- `updateDocumentSettings(docId, settings)` - Admin: Update document settings
- `getAuditLog(filters?)` - Admin: Get audit log with filters

### 16. Create Trust Center Auth Context (`frontend/src/contexts/TrustAuthContext.tsx`)

- Manages external user authentication state
- Stores JWT token in localStorage with expiry check
- Validates token expiry before considering user authenticated
- Provides `login()`, `logout()`, `isAuthenticated`, `user`, `hasAcceptedTerms` state
- Separate from main `AuthContext` (internal users)
- Auto-logout if token expired
- Checks `tokenVersion` on token refresh (handles invalidation)

### 17. Create Trust Center Pages

**Public Trust Center Page (`frontend/src/pages/TrustCenterPage.tsx`)**

- Lists public documents grouped by category
- Shows login/register buttons if not authenticated
- Shows "Private Documents" link if authenticated
- Displays `publicDescription` for each document
- Simple, clean UI suitable for external users

**Trust Center Login Page (`frontend/src/pages/TrustCenterLoginPage.tsx`)**

- Login form (email, password)
- Register form (email, password, company name)
- Forgot password link
- Toggle between login/register
- Shows message if registration successful but pending approval
- Shows rate limit warnings if applicable

**Trust Center Private Documents Page (`frontend/src/pages/TrustCenterPrivatePage.tsx`)**

- Protected route (requires external user auth)
- Lists private documents grouped by category
- Shows NDA acceptance prompt if `termsAcceptedAt` is null and document `requiresNda=true`
- Download buttons for each document
- Shows download confirmation if document requires NDA

**Trust Center Admin Page (`frontend/src/pages/TrustCenterAdminPage.tsx`)**

- Protected route (requires internal staff auth)
- Three sections:

  1. **Pending Access Requests**: Table with Approve/Deny buttons, reason field for denial
  2. **Trust Center Management**: Table of all documents with:

     - Toggle: "Show in Trust Center" (creates/removes TrustDocSetting)
     - Dropdown: "Access Level" (public/private)
     - Dropdown: "Category" (certification/policy/report)
     - Text field: "Public Description" (user-friendly description)
     - Number field: "Display Order" (for sorting within category)
     - Toggle: "Requires NDA" (requires terms acceptance)
     - SharePoint URL field (optional, pre-filled from document metadata, validates on save)
     - Status indicator: Shows if SharePoint file is accessible

  1. **Audit Log**: Table showing recent Trust Center actions (filterable by action type, date range)

### 18. Update App Routes (`frontend/src/App.tsx`)

Add new routes:

- `/trust` - Public Trust Center page
- `/trust/login` - Trust Center login/register
- `/trust/private` - Private documents (protected)
- `/trust/admin` - Admin management (protected, internal staff only)

### 19. Create Trust Center Components

**TrustDocumentCard (`frontend/src/components/TrustDocumentCard.tsx`)**

- Displays document card with title, category, `publicDescription`, download button
- Used in both public and private views
- Shows NDA requirement badge if applicable

**TrustCategorySection (`frontend/src/components/TrustCategorySection.tsx`)**

- Groups documents by category
- Renders category header and list of documents
- Sorts by `displayOrder`

**PendingRequestRow (`frontend/src/components/PendingRequestRow.tsx`)**

- Table row for pending user requests
- Approve/Deny buttons with confirmation
- Reason field for denial

**DocumentTrustSettingsRow (`frontend/src/components/DocumentTrustSettingsRow.tsx`)**

- Table row for document trust settings management
- Toggle, dropdowns, text fields, and save button
- Validates SharePoint URL before saving
- Shows file accessibility status

**NDAAcceptanceModal (`frontend/src/components/NDAAcceptanceModal.tsx`)**

- Modal for accepting NDA/terms before downloading private documents
- Shows terms text
- Records acceptance on submit

**AuditLogTable (`frontend/src/components/AuditLogTable.tsx`)**

- Displays audit log entries
- Filterable by action type, date range
- Paginated

## Azure Configuration

### 20. Azure AD App Registration Requirements

**You can reuse your existing Azure App Registration!** No need to create a new one.

**Required Action: Add API Permissions to Existing App Registration**

1. Go to Azure Portal > App registrations > Your existing app (Client ID: `AUTH_CLIENT_ID`)
2. Navigate to **API permissions**
3. Click **Add a permission** → **Microsoft Graph** → **Application permissions**
4. Add the following permissions:

   - `Files.Read.All` (app-only) - **REQUIRED**
   - `Sites.Read.All` (app-only) - **REQUIRED**

5. Click **Grant admin consent** for your organization (required for app-only permissions)
6. Verify both permissions show "Granted for [Your Organization]"

**Note:** These are **Application permissions** (not Delegated), which allow the app to access SharePoint files on behalf of the application itself, not a specific user. This is required for the Trust Center to download files for external users who don't have their own Microsoft accounts.

**Environment Variables:**

The code is configured to reuse your existing Azure App Registration credentials. You can either:

**Option 1: Use existing variables (recommended)**

- The code will automatically use `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, and `AUTH_TENANT_ID` if `AZURE_APP_*` variables are not set
- No additional environment variables needed!

**Option 2: Use separate variables (if you prefer)**

```
# Azure App-Only Authentication (for Trust Center SharePoint access)
# Optional - if not set, will use AUTH_* variables instead
AZURE_APP_CLIENT_ID=<your-client-id>
AZURE_APP_CLIENT_SECRET=<your-client-secret>
AZURE_TENANT_ID=<your-tenant-id>

# Trust Center Configuration
TRUST_CENTER_JWT_SECRET=<random-secret-for-jwt-min-32-chars>
TRUST_CENTER_JWT_EXPIRY=24h
TRUST_CENTER_MAX_FILE_SIZE_MB=50
TRUST_CENTER_DOWNLOAD_TOKEN_EXPIRY=1h

# CORS Configuration
CORS_TRUST_CENTER_ORIGINS=https://trust.yourdomain.com,https://trust.paythru.com

# Email Service (Optional - for notifications)
EMAIL_SMTP_HOST=smtp.sendgrid.net
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=apikey
EMAIL_SMTP_PASS=<sendgrid-api-key>
EMAIL_FROM=noreply@yourdomain.com
```

## Testing Considerations

### 21. Test Scenarios

**Authentication & Authorization:**

- External user registration creates unapproved user
- Unapproved user cannot login
- Rate limiting prevents brute force attacks
- Admin can approve/deny users
- Approved user can login and access private documents
- Token invalidation works on password change
- Password reset flow works end-to-end
- Logout invalidates token

**Document Access:**

- Public documents visible without authentication
- Private documents require authentication and watermarking
- NDA acceptance required for documents with `requiresNda=true`
- Download tracking records correctly
- Download tokens work (one-time use, expiry)
- File size limits enforced
- Non-PDF files handled gracefully (no watermarking)

**SharePoint Integration:**

- SharePoint URL parsing extracts correct siteId, driveId, itemId
- Cached IDs work correctly
- App-only authentication token caching and refresh works
- 404 errors handled gracefully (file not found)
- 403 errors handled gracefully (permission denied)
- Large files (>50MB) rejected with clear error
- Retry logic works for transient failures

**Watermarking:**

- Watermarking works for standard PDF files
- Watermarking handles encrypted PDFs (with fallback)
- Watermarking handles form-fillable PDFs (preserves forms)
- Watermarking handles complex PDFs (images, annotations)
- Fallback behavior works when watermarking fails
- Document hash included in watermark

**Admin Functions:**

- Admin can toggle document visibility
- Admin can set document category, description, display order
- Admin can set NDA requirement
- SharePoint URL validation works
- Audit logging records all admin actions
- Pending requests list shows correct users

**Error Handling:**

- Rate limiting returns appropriate errors
- File not found returns 404
- Permission denied returns 403
- File too large returns 413
- Invalid tokens return 401
- Network errors handled with retry logic

**Security:**

- CORS configured correctly for Trust Center subdomain
- CSP headers set for PDF downloads
- JWT tokens expire correctly
- Password hashing uses bcrypt correctly
- Download tokens are one-time use
- Audit logs capture IP addresses

## Migration Notes

- Existing documents will NOT have Trust Center settings (defaults to not visible)
- Documents must be explicitly enabled via admin interface
- No automatic migration of existing documents to Trust Center
- External users table starts empty
- TrustAuditLog table starts empty
- SharePoint IDs will be parsed and cached on first access (if sharePointUrl provided)

## Implementation Priority

### Must Fix Before Launch:

1. **SharePoint Item ID Resolution (#1)** - Critical for file downloads
2. **CORS Configuration (#14)** - Required for subdomain access
3. **Error Handling for SharePoint (#2)** - Prevents crashes
4. **Rate Limiting (#5)** - Security requirement
5. **SharePoint Token Refresh (#8)** - Prevents auth failures

### Should Fix Soon:

6. **File Size Limitations (#3)** - Prevents memory issues
7. **Audit Trail (#6)** - Compliance requirement
8. **Document Metadata (#7)** - Better UX
9. **Password Reset (#4)** - User support requirement

### Nice to Have:

10. **NDA/Terms Acceptance (#10)** - Enhanced security
11. **Email Notifications (#12)** - Better UX
12. **Download Link Security (#11)** - Additional security layer
13. **Session Management (#9)** - Enhanced security (partially implemented)
14. **Watermark Quality Testing (#13)** - Quality assurance
15. **Content Security Policy (#15)** - Security best practice