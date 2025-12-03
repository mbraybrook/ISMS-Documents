<!-- e82842b0-5e55-4348-b80b-7a78b9c3d74f 35c35644-34c5-475a-895f-152d0959f234 -->
# Document Review and Version Management Enhancement

## Overview

Enhance the document management system to support proper version tracking, type-based acknowledgment requirements, comprehensive review scheduling, and workflow for documents changed outside the platform.

## Key Requirements

1. **Type-based acknowledgment requirements**: POLICY documents automatically require staff acknowledgment on version changes
2. **Version change handling**: When version is updated on an APPROVED document, it remains APPROVED (since approval happened outside platform) but triggers acknowledgment if required
3. **Review management**: Enhanced dashboard showing overdue documents based on `nextReviewDate`, not just ReviewTasks
4. **Change tracking**: Track when documents are modified to support acknowledgment workflows

## Implementation Plan

### 1. Database Schema Changes

**File**: `backend/prisma/schema.prisma`

- Add `requiresAcknowledgement` boolean field to `Document` model (default: false)
- Add `lastChangedDate` DateTime field to `Document` model (nullable) to track when document was last modified
- Add migration to update existing documents:
- Set `requiresAcknowledgement = true` for all documents with `type = 'POLICY'`
- Set `lastChangedDate = updatedAt` for existing documents

### 2. Backend API Enhancements

**File**: `backend/src/routes/documents.ts`

- Update `PUT /api/documents/:id` endpoint:
- When version is changed on an APPROVED document, set `lastChangedDate = now()` and keep status as APPROVED
- Validate that version format is reasonable (optional: semantic versioning check)
- Add logic to automatically set `requiresAcknowledgement` based on document type:
- POLICY → requiresAcknowledgement = true
- Other types → requiresAcknowledgement = false (but allow manual override)

**File**: `backend/src/routes/acknowledgments.ts`

- Update `GET /api/acknowledgments/pending`:
- Only return documents where `requiresAcknowledgement = true`
- Filter by documents where version changed since last acknowledgment (existing logic)
- Only include APPROVED documents

**File**: `backend/src/routes/reviews.ts`

- Enhance `GET /api/reviews/dashboard`:
- Add `overdueDocuments` array: documents where `nextReviewDate < today` and status is APPROVED or IN_REVIEW
- Add `upcomingDocuments` array: documents where `nextReviewDate` is within next 30 days but no ReviewTask exists yet
- Include documents with missing `nextReviewDate` in a separate "needsReviewDate" array
- Sort overdue documents by how overdue they are (most overdue first)

### 3. Frontend Document Form Updates

**File**: `frontend/src/components/DocumentFormModal.tsx`

- Add checkbox for `requiresAcknowledgement` field (visible and editable)
- Auto-check the box when type is set to POLICY
- Show warning/info message explaining that POLICY documents require acknowledgment
- When editing an APPROVED document and changing version:
- Show confirmation dialog: "This document is approved. Updating the version will mark it as changed and may require staff acknowledgment."
- Automatically set `lastChangedDate` (handled by backend)

**File**: `frontend/src/pages/DocumentsPage.tsx`

- Add visual indicator (badge/icon) for documents that:
- Require acknowledgment and have pending acknowledgments
- Are overdue for review (nextReviewDate < today)
- Are upcoming for review (nextReviewDate within 30 days)
- Add filter option: "Requires Acknowledgment"
- Add column or tooltip showing `lastChangedDate` if available

### 4. Enhanced Review Dashboard

**File**: `frontend/src/pages/ReviewsPage.tsx`

- Add new tab: "Overdue Documents" (separate from "Overdue Reviews")
- Shows documents where `nextReviewDate < today` and no active ReviewTask exists
- Display: Document title, Owner, Next Review Date, Days Overdue, Action button to schedule review
- Enhance "Documents Needing Review" tab:
- Show both documents with upcoming `nextReviewDate` AND documents missing `nextReviewDate`
- Add visual indicators for overdue vs upcoming
- Add bulk action to schedule reviews for multiple documents
- Add summary cards at top showing:
- Count of overdue documents
- Count of upcoming reviews (next 30 days)
- Count of overdue ReviewTasks

**File**: `backend/src/routes/reviews.ts`

- Add endpoint `GET /api/reviews/overdue-documents`:
- Returns documents where `nextReviewDate < today` and status is APPROVED/IN_REVIEW
- Excludes documents that already have active ReviewTasks

### 5. Acknowledgment Page Updates

**File**: `frontend/src/pages/AcknowledgmentPage.tsx`

- Update page title/description to clarify it only shows documents requiring acknowledgment
- Add filter or info message: "Showing only documents that require staff acknowledgment (typically Policy documents)"
- Show `lastChangedDate` in the table if available
- Add visual indicator for how long document has been pending acknowledgment

### 6. Document Change Workflow

**New File**: `backend/src/services/documentVersionService.ts` (optional helper)

- Create service function to handle version updates:
- Check if version changed
- If APPROVED document version changed, set `lastChangedDate`
- Maintain APPROVED status (don't auto-change to DRAFT)
- Log change for audit purposes

### 7. Review Date Management

**Enhancement**: Add helper functions to calculate next review date

- When completing a review, suggest next review date based on:
- Document type (POLICY = 1 year, PROCEDURE = 2 years, etc.)
- Or allow manual entry
- Add validation: warn if `nextReviewDate` is more than 3 years in the future
- Add validation: require `nextReviewDate` for APPROVED documents (or allow "N/A" with justification)

### 8. UI/UX Improvements

- Add color-coded badges:
- Red: Overdue for review
- Yellow: Upcoming review (within 30 days)
- Blue: Requires acknowledgment
- Add tooltips explaining review cycles and acknowledgment requirements
- Add "Quick Actions" menu on Documents page:
- "Mark as Reviewed" (updates lastReviewDate and calculates nextReviewDate)
- "Schedule Review" (opens ReviewTask creation)

## Testing Considerations

- Test version update on APPROVED document maintains status
- Test acknowledgment only shows for documents with `requiresAcknowledgement = true`
- Test POLICY documents automatically require acknowledgment
- Test review dashboard shows overdue documents correctly
- Test that documents without `nextReviewDate` appear in appropriate lists

## Migration Strategy

1. Run Prisma migration to add new fields
2. Backfill `requiresAcknowledgement` for existing POLICY documents
3. Backfill `lastChangedDate` from `updatedAt` for existing documents
4. Update API endpoints
5. Update frontend components
6. Test with existing data

### To-dos

- [ ] Update Prisma schema: add requiresAcknowledgement and lastChangedDate fields to Document model
- [ ] Create and run database migration with backfill logic for existing documents
- [ ] Update PUT /api/documents/:id to handle version changes on APPROVED documents (set lastChangedDate, maintain APPROVED status)
- [ ] Update GET /api/acknowledgments/pending to only return documents with requiresAcknowledgement=true
- [ ] Enhance GET /api/reviews/dashboard to include overdueDocuments array based on nextReviewDate
- [ ] Update DocumentFormModal to include requiresAcknowledgement checkbox with auto-check for POLICY type
- [ ] Add visual indicators to DocumentsPage for overdue reviews and pending acknowledgments
- [ ] Add Overdue Documents tab to ReviewsPage showing documents with overdue nextReviewDate
- [ ] Update AcknowledgmentPage to clarify it only shows acknowledgment-required documents