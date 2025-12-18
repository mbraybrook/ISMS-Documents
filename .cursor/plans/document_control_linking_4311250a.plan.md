---
name: Document Control Linking
overview: Add the ability to create and manage loose linkages between documents and Controls. Users can link documents to controls (and vice versa) from both the DocumentFormModal and ControlFormModal using a search-based linking pattern similar to supplier-risk/control links.
todos: []
---

# Document-Control Linking Implementation Plan

## Overview

Add functionality to manage many-to-many relationships between documents and Controls. The database schema already includes the `DocumentControl` junction table, so this implementation focuses on adding API endpoints and UI components for managing these links.

## Database Schema

The `DocumentControl` junction table already exists in [backend/prisma/schema.prisma](backend/prisma/schema.prisma) (lines 143-152), so no schema changes are needed.

## Backend API Endpoints

### Document-Control Links (from Document side)

Add to [backend/src/routes/documents.ts](backend/src/routes/documents.ts):

1. **GET /api/documents/:id/controls** - Get all controls linked to a document

- Returns array of linked controls with basic info (id, code, title, category)
- Similar to existing GET /api/controls/:id/links endpoint

2. **POST /api/documents/:id/controls** - Link a control to a document

- Body: `{ controlId: string }`
- Validates document and control exist
- Checks for duplicate links
- Requires ADMIN or EDITOR role

3. **DELETE /api/documents/:id/controls/:controlId** - Unlink a control from a document

- Validates document and control exist
- Requires ADMIN or EDITOR role

### Control-Document Links (from Control side)

Add to [backend/src/routes/controls.ts](backend/src/routes/controls.ts):

1. **GET /api/controls/:id/documents** - Get all documents linked to a control

- Returns array of linked documents with basic info (id, title, version, type, status)
- Similar to existing GET /api/controls/:id/links endpoint

2. **POST /api/controls/:id/documents** - Link a document to a control

- Body: `{ documentId: string }`
- Validates control and document exist
- Checks for duplicate links
- Requires ADMIN or EDITOR role

3. **DELETE /api/controls/:id/documents/:documentId** - Unlink a document from a control

- Validates control and document exist
- Requires ADMIN or EDITOR role

## Frontend Changes

### DocumentFormModal Component

Update [frontend/src/components/DocumentFormModal.tsx](frontend/src/components/DocumentFormModal.tsx):

1. Add state management for:

- Linked controls list
- Control search term
- Available controls (search results)
- Loading states

2. Add UI section (similar to supplier-risk linking in SupplierRisksControlsTab):

- Display list of currently linked controls
- Search input for finding controls to link
- "Link Control" button/modal
- Unlink buttons for each linked control
- Show control code, title, and category

3. Add functions:

- `fetchLinkedControls()` - Load controls linked to current document
- `searchControls()` - Search for controls to link
- `handleLinkControl()` - Link a control to the document
- `handleUnlinkControl()` - Unlink a control from the document

### ControlFormModal Component

Update [frontend/src/components/ControlFormModal.tsx](frontend/src/components/ControlFormModal.tsx):

1. Add state management for:

- Linked documents list
- Document search term
- Available documents (search results)
- Loading states

2. Add UI section (similar to risk display but with linking capability):

- Display list of currently linked documents
- Search input for finding documents to link
- "Link Document" button/modal
- Unlink buttons for each linked document
- Show document title, version, type, and status

3. Add functions:

- `fetchLinkedDocuments()` - Load documents linked to current control
- `searchDocuments()` - Search for documents to link
- `handleLinkDocument()` - Link a document to the control
- `handleUnlinkDocument()` - Unlink a document from the control

### API Service Updates

Update [frontend/src/services/api.ts](frontend/src/services/api.ts) or create helper functions:

- Add methods for document-control linking endpoints
- Follow existing patterns for supplier-risk/control API calls

## Implementation Details

### Backend Validation

- Verify document/control exists before linking
- Prevent duplicate links (check existing DocumentControl records)
- Use Prisma transactions where appropriate
- Return appropriate error messages (404, 409 for duplicates, etc.)

### Frontend UX

- Show loading states during search and link operations
- Display toast notifications for success/error
- Refresh linked items list after link/unlink operations
- Filter out already-linked items from search results
- Use Chakra UI components consistent with existing patterns

### Error Handling

- Handle network errors gracefully
- Show user-friendly error messages
- Validate inputs before API calls
- Handle edge cases (e.g., document/control deleted while linking)

## Testing Considerations

- Test linking from both document and control sides
- Test duplicate link prevention
- Test unlinking
- Test with non-existent IDs
- Test authorization (ADMIN/EDITOR only)
- Verify cascade deletes work correctly (when document/control is deleted)

## Future Enhancements (Out of Scope)

- Relationship graph visualization
- Gap analysis reporting
- Bulk linking operations
- Link metadata (e.g., "primary", "secondary" relationships)