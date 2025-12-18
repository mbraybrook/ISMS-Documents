---
name: Controlled Document Versioning Flow
overview: Implement a controlled document versioning flow that makes the version field read-only on the main edit form, adds a version notes field, introduces a dedicated "Update version" modal, and displays version notes on the acknowledgement screens.
todos:
  - id: db-migration
    content: Create Prisma schema changes and migration for DocumentVersionHistory table with unique constraint on (documentId, version)
    status: completed
  - id: backend-version-notes-endpoint
    content: Create GET /api/documents/:id/version-notes endpoint to fetch version notes for a specific version (defaults to current)
    status: completed
  - id: backend-version-update-endpoint
    content: Create POST /api/documents/:id/version-updates endpoint with currentVersion validation, version update, and DocumentVersionHistory upsert
    status: completed
  - id: backend-update-document-endpoint
    content: Modify PUT /api/documents/:id to remove version from validation, add versionNotes handling, and upsert current version notes to DocumentVersionHistory
    status: completed
  - id: frontend-version-update-modal
    content: Create VersionUpdateModal component with current version display, new version input, notes textarea, validation, and API integration
    status: completed
  - id: frontend-update-document-form
    content: "Update DocumentFormModal: make version read-only, add version notes field, add Update version button, integrate VersionUpdateModal, load current version notes on document load"
    status: completed
  - id: frontend-update-acknowledgement-pages
    content: Update AcknowledgmentPage and StaffAcknowledgmentPage to fetch and display current version notes with Summary of changes section
    status: completed
---

# Controlled Document Versioning Flow Implementation

## Overview

This plan implements a controlled document versioning system where:

- Version field is read-only on the main document edit form
- Version notes field is editable for the current version
- Version updates require a dedicated "Update version" action with a modal
- Version notes are displayed on acknowledgement screens

## Database Changes

### 1. Create DocumentVersionHistory Table

**File**: `backend/prisma/schema.prisma`

Add new model:

```prisma
model DocumentVersionHistory {
  id                String   @id @default(uuid())
  documentId        String?  // Nullable to allow history retention after document deletion
  version           String
  notes             String?
  // Store SharePoint IDs to enable history restoration when document is re-added
  sharePointSiteId  String?
  sharePointDriveId String?
  sharePointItemId  String?
  createdAt         DateTime @default(now())
  createdBy         String
  updatedAt         DateTime @updatedAt
  updatedBy         String
  document          Document? @relation(fields: [documentId], references: [id], onDelete: SetNull)

  @@unique([documentId, version])
  @@index([documentId])
  @@index([version])
  @@index([sharePointSiteId, sharePointDriveId, sharePointItemId]) // For restoration lookup
}
```

Add relation to Document model:

```prisma
DocumentVersionHistory DocumentVersionHistory[]
```

**Migration**: Create Prisma migration file following the pattern in `backend/prisma/migrations/`

**Key Design Decisions**:

- `documentId` is nullable to allow version history to persist after document deletion
- SharePoint IDs are stored to enable matching and restoration when a document is re-added
- `onDelete: SetNull` ensures history is retained when document is deleted (documentId becomes null but record remains)

## Backend Changes

### 2. Update Document Update Endpoint

**File**: `backend/src/routes/documents.ts`

Modify `PUT /api/documents/:id` endpoint (around line 400):

- Remove `version` from the validation schema (line 409) - version can no longer be updated via this endpoint
- Add `versionNotes` to optional validation (new field for current version notes)
- After fetching existing document, check if `versionNotes` is provided in the request
- If `versionNotes` is provided:
  - Upsert into `DocumentVersionHistory` for the current document version:
    - If record exists for `(documentId, currentVersion)`, update `notes`, `updatedAt`, `updatedBy`
    - Otherwise, create new record with `notes`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`
- Remove version change logic (lines 476-488) - version changes will only happen through the new endpoint

### 3. Create Version Update Endpoint

**File**: `backend/src/routes/documents.ts`

Add new endpoint `POST /api/documents/:id/version-updates`:

- **Route**: After the existing PUT endpoint (around line 597)
- **Auth**: `authenticateToken`, `requireRole('ADMIN', 'EDITOR')`
- **Validation**:
  - `param('id').isUUID()`
  - `body('currentVersion').notEmpty().trim()`
  - `body('newVersion').notEmpty().trim()`
  - `body('notes').notEmpty().trim()` (or optional based on requirements)
- **Logic**:

  1. Fetch existing document by ID
  2. Validate `currentVersion` matches document's stored version
  3. If mismatch, return `409 Conflict` with error message
  4. Update document's `version` field to `newVersion`
  5. Set `lastChangedDate` to current date if document is APPROVED
  6. Upsert into `DocumentVersionHistory`:

     - If record exists for `(documentId, newVersion)`, update `notes`, `updatedAt`, `updatedBy`
     - Otherwise, create new record with `notes`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`

  1. Return updated document with owner relation

### 4. Create Version Notes Endpoint

**File**: `backend/src/routes/documents.ts`

Add new endpoint `GET /api/documents/:id/version-notes`:

- **Route**: After the version-updates endpoint
- **Auth**: `authenticateToken` (no role restriction - staff can view)
- **Validation**:
  - `param('id').isUUID()`
  - `query('version').optional().isString()` (defaults to 'current')
- **Logic**:

  1. Fetch document by ID
  2. Resolve version: if `version=current` or not provided, use document's current version
  3. Query `DocumentVersionHistory` for `(documentId, resolvedVersion)`
  4. Return:
     ```json
     {
       "documentId": "...",
       "version": "...",
       "notes": "..." | null
     }
     ```


### 5. Update Document GET Endpoint

**File**: `backend/src/routes/documents.ts`

Modify `GET /api/documents/:id` (around line 231) to include current version notes:

- In the `include` clause, add:
  ```typescript
  versionHistory: {
    where: { version: document.version },
    take: 1,
    orderBy: { updatedAt: 'desc' }
  }
  ```

- Or fetch separately and attach to response

## Frontend Changes

### 6. Update DocumentFormModal Component

**File**: `frontend/src/components/DocumentFormModal.tsx`

**Changes**:

1. **Add state for version notes** (around line 50):

   - Add `versionNotes: ''` to `formData` state
   - Add state for current version notes: `const [currentVersionNotes, setCurrentVersionNotes] = useState('')`

2. **Load version notes on document load** (in `useEffect` around line 134):

   - When `document` is loaded, fetch current version notes via `GET /api/documents/${document.id}/version-notes?version=current`
   - Set `currentVersionNotes` and `formData.versionNotes` to the fetched notes

3. **Make Version field read-only** (around line 567):

   - Change `Input` to have `isReadOnly={true}` or `isDisabled={true}` (even when not in readOnly mode)
   - Add an "Update version" button next to the Version field using `HStack` or similar

4. **Add Version Notes field** (after Version field, around line 574):

   - Add new `FormControl` with `FormLabel` "Version Notes"
   - Use `Textarea` component (already imported)
   - Bind to `formData.versionNotes`
   - Add helper text: "Briefly describe what changed in this version."
   - Make it editable (not read-only)

5. **Update handleSubmit** (around line 435):

   - Remove version from payload if document exists (version can't be changed here)
   - Include `versionNotes` in payload (will be handled by backend to upsert)

6. **Add version update modal state and handlers**:

   - Add `useDisclosure` for version update modal: `const { isOpen: isVersionUpdateOpen, onOpen: onVersionUpdateOpen, onClose: onVersionUpdateClose } = useDisclosure()`
   - Add state for version update form: `const [versionUpdateData, setVersionUpdateData] = useState({ newVersion: '', notes: '' })`
   - Add handler `handleVersionUpdate` that calls `POST /api/documents/${document.id}/version-updates`
   - On success: close modal, refresh document data, update form state
   - On 409 Conflict: show error toast with message to refresh page

### 7. Create VersionUpdateModal Component

**File**: `frontend/src/components/VersionUpdateModal.tsx` (new file)

Create a new modal component:

- **Props**: `isOpen`, `onClose`, `currentVersion`, `onSuccess` callback
- **State**: `newVersion`, `notes`, `loading`, `error`
- **UI**:
  - Modal with Chakra UI components
  - Current version (read-only label)
  - New version input (text, with suggested default like current + 1)
  - Version notes textarea (multi-line, 2-3 lines)
  - Helper text for notes field
  - Cancel button
  - "Save new version" button
- **Validation**:
  - New version: non-empty
  - Notes: non-empty (or optional based on requirements)
- **API Call**: `POST /api/documents/:id/version-updates` with `{ currentVersion, newVersion, notes }`
- **Error Handling**: Handle 409 Conflict with user-friendly message

### 8. Integrate VersionUpdateModal in DocumentFormModal

**File**: `frontend/src/components/DocumentFormModal.tsx`

- Import and render `VersionUpdateModal` component
- Pass props: `isOpen={isVersionUpdateOpen}`, `onClose={onVersionUpdateClose}`, `currentVersion={formData.version}`, `documentId={document?.id}`
- On success callback: refresh document data and update form state

### 9. Update Acknowledgement Pages

**Files**:

- `frontend/src/pages/AcknowledgmentPage.tsx`
- `frontend/src/pages/StaffAcknowledgmentPage.tsx`

**Changes**:

1. **Add version notes to Document interface** (around line 22):

   - Add `versionNotes?: string | null`

2. **Fetch version notes when loading documents** (in `fetchPendingDocuments` or `useEffect`):

   - After fetching documents, for each document, call `GET /api/documents/${doc.id}/version-notes?version=current`
   - Store version notes in state or attach to document objects

3. **Display version notes in UI**:

   - In the table or document display area, add a section showing:
     - Version label and date (already shown)
     - "Summary of changes in this version" heading
     - Version notes text (if available)
     - If no notes: hide section or show "No summary provided for this version"

4. **For StaffAcknowledgmentPage** (around line 400):

   - Add version notes column or expandable section
   - Show version notes below version number or in a tooltip/modal

### 10. Update API Service (Optional)

**File**: `frontend/src/services/api.ts`

Add document version API functions (optional, can use direct api calls):

```typescript
export const documentApi = {
  updateVersion: async (documentId: string, data: { currentVersion: string; newVersion: string; notes: string }) => {
    const response = await api.post(`/api/documents/${documentId}/version-updates`, data);
    return response.data;
  },
  getVersionNotes: async (documentId: string, version?: string) => {
    const params = version ? { version } : { version: 'current' };
    const response = await api.get(`/api/documents/${documentId}/version-notes`, { params });
    return response.data;
  },
};
```

## Implementation Order

1. Database migration (schema + migration file)
2. Backend endpoints (version-updates, version-notes, update document endpoint)
3. Frontend: VersionUpdateModal component
4. Frontend: Update DocumentFormModal
5. Frontend: Update acknowledgement pages
6. Testing and validation

## Notes

- Version notes are editable after creation (no strict immutability)
- Only latest version notes shown on acknowledgement screen
- SharePoint remains source of truth for file content
- Version field read-only prevents accidental version changes
- 409 Conflict handling ensures version updates are atomic