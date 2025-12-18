---
name: SharePoint Integration for Supplier Evidence and Certificates
overview: ""
todos:
  - id: 089b54be-edb9-471a-82f6-bdab7571b2ac
    content: Create SupplierReviewModal component with comprehensive form for all supplier fields
    status: completed
  - id: 21fffb54-5da5-4b81-87b2-0b2451d90702
    content: Replace TODO in SupplierDetailPage with working review creation using the modal
    status: completed
  - id: 44266f47-3989-41cd-8b09-db77c5b9c44d
    content: Enhance completeComplianceReview endpoint to accept and update all supplier fields
    status: completed
  - id: bf530dd4-d634-4272-a410-659c03652bae
    content: Add assessment status management UI (edit DRAFT, submit, approve/reject)
    status: completed
  - id: 43b594cb-aeb2-4899-b7e9-82033cb92a50
    content: Display current assessment rationale in Risk & Criticality tab
    status: completed
  - id: 777f27a8-579a-4588-8be2-7ad6e0b0a03d
    content: Add clarifying tooltips and help text explaining Reviews vs Assessments
    status: completed
  - id: 05a67fe8-6445-476c-bb7a-1f806718e6ec
    content: Verify assessment status management API endpoints work correctly
    status: completed
---

# SharePoint Integration for Supplier Evidence and Certificates

## Problem

Currently, supplier evidence links and certificate evidence links require users to manually enter URLs. For SharePoint files, this is error-prone and doesn't leverage the existing SharePoint file browser functionality. However, evidence links may also be public website URLs (e.g., external certificate pages, public documentation), so the solution must support both SharePoint file selection and manual URL entry.

## Solution

Add "Browse SharePoint" buttons to evidence link fields, reusing the existing `SharePointFileBrowser` component to allow users to select files from SharePoint. Users can still manually enter URLs for public websites or other sources. This provides flexibility while improving the experience for SharePoint-hosted evidence.

## Implementation Plan

### 1. Update Supplier Compliance Evidence Links UI

**File**: `frontend/src/pages/SupplierDetailPage.tsx` (line ~1062-1089)

- Add "Browse SharePoint" button next to each evidence link input
- Integrate `SharePointFileBrowser` component
- When a file is selected, populate the input with the SharePoint webUrl
- Store the webUrl in the `complianceEvidenceLinks` array
- Optionally store SharePoint IDs (siteId, driveId, itemId) for future reference

**Changes**:

- Import `SharePointFileBrowser` component
- Add state for browser modal: `const { isOpen: isEvidenceBrowserOpen, onOpen: onEvidenceBrowserOpen, onClose: onEvidenceBrowserClose } = useDisclosure()`
- Add state to track which evidence link index is being edited: `const [editingEvidenceIndex, setEditingEvidenceIndex] = useState<number | null>(null)`
- Add "Browse SharePoint" button next to each evidence link input
- On file selection, update the specific evidence link with the SharePoint webUrl

### 2. Update Supplier Review Modal Evidence Links

**File**: `frontend/src/components/SupplierReviewModal.tsx` (line ~525-546)

- Add same "Browse SharePoint" functionality to compliance evidence links in the review modal
- Reuse the same pattern as SupplierDetailPage

### 3. Update Certificate Evidence Links

**File**: `frontend/src/pages/SupplierDetailPage.tsx` (certificate section)

- Find where certificates are displayed/edited
- Add "Browse SharePoint" button for certificate `evidenceLink` field
- Integrate `SharePointFileBrowser` component
- When file is selected, populate the `evidenceLink` field with SharePoint webUrl

### 4. Optional: Store SharePoint Metadata

**Consideration**: Store SharePoint IDs alongside URLs for better integration

- Could add optional fields to store `sharePointSiteId`, `sharePointDriveId`, `sharePointItemId`
- This would require schema changes, so may be deferred to future enhancement
- For now, just store the webUrl (which is sufficient for linking)

## Files to Modify

### Frontend

- `frontend/src/pages/SupplierDetailPage.tsx` - Add Browse SharePoint to compliance evidence links and certificate evidence links
- `frontend/src/components/SupplierReviewModal.tsx` - Add Browse SharePoint to compliance evidence links

## Technical Details

### SharePoint File Browser Integration

- Reuse existing `SharePointFileBrowser` component
- Component already supports:
- Folder navigation
- File selection
- Returns `SharePointItem` with `webUrl`, `id`, `siteId`, `driveId`
- Use `webUrl` as the evidence link value
- Pass Graph access token via `x-graph-token` header (handled by component)

### UI Pattern

- Add button next to each evidence link input: "Browse SharePoint"
- When clicked, open `SharePointFileBrowser` modal
- On file selection, populate the input field with the selected file's `webUrl`
- User can still manually enter/edit URLs for:
- Public website links (e.g., https://example.com/certificate.pdf)
- Other external URLs
- SharePoint URLs if they prefer to paste them directly
- Both SharePoint files and web URLs are stored as strings in the same field

### Data Storage

- Continue storing evidence links as URLs (strings) in existing fields:
- `complianceEvidenceLinks` (JSON array of strings) on Supplier
- `evidenceLink` (string) on SupplierCertificate
- `evidenceLinks` (JSON array) on SupplierComplianceReview
- No schema changes required

## Testing Considerations

- Test browsing and selecting SharePoint files for compliance evidence
- Test browsing and selecting SharePoint files for certificates
- Verify URLs are correctly stored and displayed
- Test that manual URL entry still works
- Verify SharePoint browser works with proper authentication