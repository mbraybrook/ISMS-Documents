<!-- 27a32f81-b8ba-466b-a0a7-c28c7f5593c5 56519eeb-5d05-46c1-babf-bb5e84a1da8b -->
# Update Interested Parties to Match CSV Structure

## Overview

The current Interested Parties structure only has `name`, `group`, and `description`. The CSV file contains many more fields that need to be added to the database schema, API, and UI.

## Changes Required

### 1. Database Schema Updates

- **File**: `backend/prisma/schema.prisma`
- Add new fields to `InterestedParty` model:
- `dateAdded` (DateTime) - from CSV "Date Added"
- `requirements` (String?) - from CSV "Requirements"
- `addressedThroughISMS` (Boolean?) - from CSV "Will this be addressed through ISMS: Yes/No?"
- `howAddressedThroughISMS` (String?) - from CSV "How the Requirements will be addressed through the ISMS"
- `sourceLink` (String?) - from CSV "Source/Link to Supporting Information"
- `keyProductsServices` (String?) - from CSV "Key products / services"
- `ourObligations` (String?) - from CSV "Our obligations"
- `theirObligations` (String?) - from CSV "Their obligations"
- Note: "Risk links" is already handled via the `risks` relation

### 2. Database Migration

- Create a new Prisma migration to add the new fields
- Make all new fields optional (nullable) to maintain backward compatibility
- Set `dateAdded` default to `createdAt` for existing records

### 3. Backend API Updates

- **File**: `backend/src/routes/interestedParties.ts`
- Update POST endpoint to accept and save all new fields
- Update PUT endpoint to accept and update all new fields
- Update GET endpoints to return all new fields

### 4. Import Service Updates

- **File**: `backend/src/services/interestedPartyImportService.ts`
- Update `CSVRow` interface to include all CSV columns
- Update import logic to map all CSV fields to database fields
- Handle "Yes/No" conversion for `addressedThroughISMS` boolean field
- Update the unique party aggregation to preserve all field data (not just name and group)

### 5. Frontend Interface Updates

- **File**: `frontend/src/pages/InterestedPartiesPage.tsx`
- Update `InterestedParty` interface to include all new fields
- Update form state to handle all new fields
- Add form fields in the create/edit modal for all new fields
- Keep main table simple (Name, Group, Description, Risks)
- Add expandable detail view (using Chakra UI `Accordion` or expandable rows) to show all fields
- Update search to include new text fields

### 6. UI/UX Considerations

- Use expandable rows or a detail panel to show additional fields
- Format boolean field as Yes/No in display
- Make URLs clickable in the Source/Link field
- Use appropriate input types (Textarea for long text, URL input for links, Checkbox for boolean)
- Ensure the modal form is scrollable if needed

## Implementation Notes

- All new fields should be optional to maintain backward compatibility
- The `dateAdded` field can default to `createdAt` for existing records
- The import service should handle the "Yes/No" string conversion to boolean
- The detail view should be user-friendly and clearly organized

### To-dos

- [ ] Update Prisma schema to add all new fields to InterestedParty model
- [ ] Create and run Prisma migration to add new fields to database
- [ ] Update backend API routes to handle all new fields in POST/PUT/GET endpoints
- [ ] Update import service to parse and import all CSV fields including Yes/No to boolean conversion
- [ ] Update TypeScript interface and form state in InterestedPartiesPage to include all new fields
- [ ] Add all new form fields to the create/edit modal with appropriate input types
- [ ] Implement expandable detail view in table to show all additional fields
- [ ] Update search functionality to include new text fields in search