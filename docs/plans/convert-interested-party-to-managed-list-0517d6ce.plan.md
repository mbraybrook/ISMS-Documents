<!-- 0517d6ce-6ef9-4fde-8465-f08876cd7a6e 82cec1c5-8583-4c71-b0d7-ef8655dba900 -->
# Convert Interested Party to Managed List

## Overview

Convert the Risk "Interested Party" field from a free text (`String?`) to a managed list with foreign key relationships, similar to Assets. The field will be mandatory (unlike Assets which are optional).

## Database Changes

### 1. Create InterestedParty Model

- Add `InterestedParty` model to [backend/prisma/schema.prisma](backend/prisma/schema.prisma) similar to `AssetCategory`:
- `id` (UUID, primary key)
- `name` (String, unique) - from "Interested party" column in CSV
- `group` (String?) - from "Group" column (Suppliers, Clients, Internal, Regulatory Body)
- `description` (String?) - optional description
- `createdAt`, `updatedAt` timestamps
- Relation to `Risk[]`

### 2. Update Risk Model

- Change `interestedParty String?` to `interestedPartyId String?` (foreign key)
- Add relation: `interestedParty InterestedParty? @relation(fields: [interestedPartyId], references: [id], onDelete: SetNull)`
- Add index on `interestedPartyId`
- **Make field mandatory**: Change to `interestedPartyId String` (remove `?`) - this requires migration strategy to handle existing data

### 3. Create Migrations

- Migration 1: Create `InterestedParty` table
- Migration 2: 
- Add `interestedPartyId` column to `Risk` (nullable initially)
- Migrate existing `interestedParty` string values to create `InterestedParty` records and link them
- Make `interestedPartyId` NOT NULL after migration
- Drop old `interestedParty` string column

## Backend Changes

### 4. Create Interested Parties API Routes

- Create [backend/src/routes/interestedParties.ts](backend/src/routes/interestedParties.ts) with CRUD operations:
- `GET /api/interested-parties` - list all with risk counts
- `GET /api/interested-parties/:id` - get details with linked risks
- `POST /api/interested-parties` - create (ADMIN/EDITOR only)
- `PUT /api/interested-parties/:id` - update (ADMIN/EDITOR only)
- `DELETE /api/interested-parties/:id` - delete with validation (prevent if used by risks)
- Register route in [backend/src/index.ts](backend/src/index.ts)

### 5. Update Risk Routes

- Update [backend/src/routes/risks.ts](backend/src/routes/risks.ts):
- Change validation from `body('interestedParty').optional().isString()` to `body('interestedPartyId').isUUID()`
- Update POST/PUT handlers to use `interestedPartyId` instead of `interestedParty`
- Include `interestedParty` relation in GET queries with `select: { id: true, name: true, group: true }`

### 6. Create CSV Import Service

- Create [backend/src/services/interestedPartyImportService.ts](backend/src/services/interestedPartyImportService.ts):
- Parse CSV from `docs/Interested Parties.csv`
- Extract unique "Interested party" names from column 3
- Extract "Group" from column 2
- Create `InterestedParty` records (skip duplicates by name)
- Add import route: `POST /api/interested-parties/import` (ADMIN/EDITOR only, accepts CSV file upload)

## Frontend Changes

### 7. Create Interested Parties Management Page

- Create [frontend/src/pages/InterestedPartiesPage.tsx](frontend/src/pages/InterestedPartiesPage.tsx) similar to [frontend/src/pages/AssetCategoriesPage.tsx](frontend/src/pages/AssetCategoriesPage.tsx):
- List all interested parties with search/filter
- Show risk count for each (from `_count.risks`)
- Create/Edit/Delete modals (ADMIN/EDITOR only)
- Use DataTables component for list display
- Display group badge if available

### 8. Update Routing and Navigation

- Add route in [frontend/src/App.tsx](frontend/src/App.tsx): `/risks/interested-parties`
- Add menu item in [frontend/src/components/Layout.tsx](frontend/src/components/Layout.tsx) under "Risk Management" dropdown

### 9. Update Risk Form

- Update [frontend/src/components/RiskFormModal.tsx](frontend/src/components/RiskFormModal.tsx):
- Replace `Input` for `interestedParty` (line ~976) with `Select` dropdown
- Fetch interested parties list on component mount
- Make field **required** (`isRequired` prop)
- Update form state from `interestedParty: string` to `interestedPartyId: string`
- Update API calls to send `interestedPartyId` instead of `interestedParty`

### 10. Update Risks Page Display

- Update [frontend/src/pages/RisksPage.tsx](frontend/src/pages/RisksPage.tsx):
- Change `interestedParty: string | null` to `interestedParty: { id: string; name: string; group: string | null } | null` in Risk interface
- Update table column to display `risk.interestedParty?.name` instead of `risk.interestedParty`
- Include `interestedParty` relation in API query

### 11. Show Linkage in Interface

- In `InterestedPartiesPage`: Show count of linked risks (already included via `_count.risks`)
- In `RisksPage`: Display interested party name as clickable link/navigation (optional enhancement)
- In risk detail view: Show interested party information

## Data Migration Strategy

### 12. Handle Existing Data

- Migration script should:

1. Query all unique `interestedParty` string values from existing risks
2. Create `InterestedParty` records for each unique value
3. Update all risks to link to the appropriate `InterestedParty` record
4. Handle cases where `interestedParty` is null/empty (may need to create a default or make field nullable during transition)

## Testing Considerations

- Test creating/editing risks with interested party selection
- Test that interested party is required (validation)
- Test that deleting an interested party fails if it's used by risks
- Test CSV import functionality
- Verify existing risks are properly migrated

### To-dos

- [ ] Create InterestedParty model in Prisma schema with name, group, description fields and Risk relation
- [ ] Update Risk model to use interestedPartyId foreign key instead of interestedParty string, make it mandatory
- [ ] Create database migration to add InterestedParty table and migrate existing data
- [ ] Create backend API routes for Interested Parties CRUD operations (/api/interested-parties)
- [ ] Update Risk API routes to use interestedPartyId and include interestedParty relation in queries
- [ ] Create CSV import service and route for importing Interested Parties from CSV file
- [ ] Create InterestedPartiesPage frontend component for managing the list (similar to AssetCategoriesPage)
- [ ] Add Interested Parties route and navigation menu item in frontend
- [ ] Update RiskFormModal to use Select dropdown for interested party (mandatory field)
- [ ] Update RisksPage to display interested party name from relation instead of string