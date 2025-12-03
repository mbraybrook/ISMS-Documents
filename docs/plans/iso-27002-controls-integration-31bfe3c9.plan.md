<!-- 31bfe3c9-b845-45a0-b72f-14cda656ef40 ce6a0367-b439-41b0-8fca-ec5f445103a6 -->
# ISO 27002 Controls Integration Plan

## Overview

Populate the system with all ISO 27002:2022 controls as a static reference list. Each control will include its full text from the standard (Control, Purpose, Guidance, Other information). Controls are read-only and can be "selected" (marked as applicable) based on risk assessment.

## Database Schema Changes

### Update Control Model

- Add fields to store full ISO 27002 control text:
- `controlText` (String?) - The "Control" section text
- `purpose` (String?) - The "Purpose" section text  
- `guidance` (String?) - The "Guidance" section text
- `otherInformation` (String?) - The "Other information" section text
- `category` (String) - Control category: ORGANIZATIONAL, PEOPLE, PHYSICAL, TECHNOLOGICAL
- `isStandardControl` (Boolean @default(false)) - Flag to mark ISO 27002 controls as read-only
- Keep existing fields: `code`, `title`, `description`, `isApplicable`, `applicabilitySource`, `justification`

### Migration

- Create migration to add new fields to Control table
- Set `isStandardControl = true` for all ISO 27002 controls

## Control Extraction & Seeding

### Parse ISO 27002 Document

- Create script: `backend/scripts/parse-iso27002-controls.ts`
- Parse markdown file to extract all controls from sections 5, 6, 7, 8
- Extract for each control:
- Code (e.g., "5.1", "6.3", "7.14", "8.34")
- Title (from heading)
- Control text (from "##### Control" section)
- Purpose (from "##### Purpose" section)
- Guidance (from "##### Guidance" section)
- Other information (from "##### Other information" section)
- Category (based on section: 5=ORGANIZATIONAL, 6=PEOPLE, 7=PHYSICAL, 8=TECHNOLOGICAL)

### Seed Script

- Create: `backend/scripts/seed-iso27002-controls.ts`
- Use parsed data to create/update Control records
- Handle existing controls gracefully (update if code matches, don't duplicate)
- Set `isStandardControl = true` for all seeded controls
- Set `code` format: "5.1", "5.2", etc. (matching ISO 27002 numbering)

## API Updates

### Controls Routes (`backend/src/routes/controls.ts`)

- Modify POST `/api/controls` to prevent creating controls with ISO 27002 codes if `isStandardControl` exists
- Modify PUT `/api/controls/:id` to prevent editing standard controls:
- Allow updating only: `isApplicable`, `applicabilitySource`, `justification`
- Block editing: `code`, `title`, `controlText`, `purpose`, `guidance`, `otherInformation`, `category`
- Add validation to check `isStandardControl` flag before allowing edits

### Response Enhancement

- Include full control text fields in GET responses
- Add `category` and `isStandardControl` to response

## Frontend Updates

### Controls Page (`frontend/src/pages/ControlsPage.tsx`)

- Display control category (Organizational, People, Physical, Technological)
- Show full control text in detail view/modal:
- Control (what it is)
- Purpose (why implement)
- Guidance (how to implement)
- Other information (additional context)
- Add filter by category
- Indicate which controls are standard (read-only) vs custom
- Disable editing of standard controls (only allow changing applicability/justification)

### Control Form Modal (`frontend/src/components/ControlFormModal.tsx`)

- Conditionally disable fields for standard controls
- Only show editable fields for standard controls: `isApplicable`, `justification`
- Show read-only display of full control text for standard controls

## Risk-Control Association

### Existing Logic (No Changes Needed)

- Current `updateRiskControls()` function already handles control selection
- `updateControlApplicability()` already sets `isApplicable` based on risk associations
- Risk can reference controls by code (e.g., "5.1, 5.9, 8.24")
- When risks are linked to controls, controls are automatically marked as applicable

## Statement of Applicability

### SoA Export (`backend/src/services/soaService.ts`)

- No changes needed - already uses `isApplicable` flag
- Will automatically include all selected ISO 27002 controls
- Control codes and titles will be properly formatted

## Implementation Steps

1. **Database Migration**

- Add new fields to Control model in Prisma schema
- Generate and run migration

2. **Control Parser**

- Create parser script to extract controls from ISO 27002 markdown
- Test parser with sample controls

3. **Seed Script**

- Create seed script using parsed data
- Run seed to populate all 93 ISO 27002 controls

4. **API Protection**

- Add validation to prevent editing standard control fields
- Update error messages

5. **Frontend Enhancement**

- Update ControlsPage to show full control text
- Update ControlFormModal for read-only standard controls
- Add category filtering

6. **Testing**

- Verify all controls are seeded correctly
- Test that standard controls cannot be edited
- Test risk-control associations work with standard controls
- Test SoA export includes selected controls

## Files to Create/Modify

### New Files

- `backend/scripts/parse-iso27002-controls.ts` - Parser for ISO 27002 markdown
- `backend/scripts/seed-iso27002-controls.ts` - Seed script
- `backend/prisma/migrations/XXXX_add_iso27002_control_fields/migration.sql` - Database migration

### Modified Files

- `backend/prisma/schema.prisma` - Add new Control fields
- `backend/src/routes/controls.ts` - Add validation for standard controls
- `frontend/src/pages/ControlsPage.tsx` - Display full control text and categories
- `frontend/src/components/ControlFormModal.tsx` - Handle read-only standard controls

## Notes

- Total controls: 37 (Organizational) + 8 (People) + 14 (Physical) + 34 (Technological) = 93 controls
- Control codes match ISO 27002:2022 numbering (5.1-5.37, 6.1-6.8, 7.1-7.14, 8.1-8.34)
- Existing custom controls (if any) will remain editable
- Selection logic based on risk associations remains unchanged