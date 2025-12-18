<!-- 62cebf33-e65d-42f6-b37c-c027ec35995f 52389d56-13e7-499a-924c-71f8ac298619 -->
# Risk Register Enhancement Plan

## Overview

Enhance the existing Risk model and UI to fully support the risk register structure shown in the image, which includes four sections: basic risk information, existing controls assessment, additional controls assessment, and Annex A controls reference.

## Database Schema Changes

### Update Risk Model (`backend/prisma/schema.prisma`)

Add the following fields to the `Risk` model:

**Grey Section (Basic Risk Information):**

- `dateAdded` (DateTime) - Date when risk was added to register
- `riskType` (String) - Enum: INFORMATION_SECURITY, OPERATIONAL, FINANCIAL, COMPLIANCE, REPUTATIONAL, STRATEGIC, OTHER
- `ownerUserId` (String, FK → User) - Risk owner
- `assetCategory` (String?) - Asset/Asset Category
- `interestedParty` (String?) - Interested Party
- `threatDescription` (String?) - Threat Description (separate from risk description)

**Orange Section (Existing Controls - Initial Assessment):**

- `riskScore` (Int?) - The "R" score (overall risk score, may be same as calculatedScore or separate)
- `initialRiskTreatmentCategory` (String?) - Enum: RETAIN, MODIFY, SHARE, AVOID

**Green Section (Additional Controls - Mitigated Assessment):**

- `mitigatedConfidentialityScore` (Int?) - MC
- `mitigatedIntegrityScore` (Int?) - MI
- `mitigatedAvailabilityScore` (Int?) - MA
- `mitigatedRiskScore` (Int?) - MR
- `mitigatedLikelihood` (Int?) - ML
- `mitigatedScore` (Int?) - Calculated mitigated score
- `mitigationImplemented` (Boolean, default false) - Whether mitigation has been implemented
- `residualRiskTreatmentCategory` (String?) - Enum: RETAIN, MODIFY, SHARE, AVOID

**Notes:**

- Keep existing fields: `confidentialityScore`, `integrityScore`, `availabilityScore`, `likelihood`, `calculatedScore` for initial assessment
- Add indexes for new filterable fields: `riskType`, `ownerUserId`, `initialRiskTreatmentCategory`, `residualRiskTreatmentCategory`

## Backend Changes

### 1. Database Migration

- Create migration to add new fields to Risk model
- Add foreign key constraint for `ownerUserId` → User
- Add indexes for performance

### 2. Update Risk Service (`backend/src/services/riskService.ts`)

- Update `calculateRiskScore` to handle both initial and mitigated scores
- Add function `calculateMitigatedScore(mc, mi, ma, ml)` 
- Ensure score calculation matches framework: `(C + I + A) * L` for initial, same formula for mitigated

### 3. Update Risk Routes (`backend/src/routes/risks.ts`)

- Update validation rules for new fields:
- `riskType`: enum validation
- `ownerUserId`: UUID validation
- `initialRiskTreatmentCategory`, `residualRiskTreatmentCategory`: enum validation
- Mitigated scores: Int 1-5 validation
- Update POST/PUT endpoints to handle all new fields
- Update GET endpoints to include owner user information in responses
- Add filtering by: riskType, owner, treatment category, mitigation status

### 4. Risk Scoring Logic

- Ensure initial score calculation: `(confidentialityScore + integrityScore + availabilityScore) * likelihood`
- Mitigated score calculation: `(mitigatedConfidentialityScore + mitigatedIntegrityScore + mitigatedAvailabilityScore) * mitigatedLikelihood`
- Risk level categorization based on framework:
- Low: 3-14
- Medium: 15-35
- High: 36-75

## Frontend Changes

### 1. Update Risk Interface (`frontend/src/pages/RisksPage.tsx`)

- Extend Risk interface with all new fields
- Add owner user information to Risk type
- Update table columns to show key fields from all sections

### 2. Enhanced Risk Form (`frontend/src/components/RiskFormModal.tsx`)

Restructure form into sections matching the risk register:

**Section 1: Basic Risk Information**

- External ID (existing)
- Date Added (date picker)
- Risk Type (dropdown with enum values)
- Owner (user dropdown - Admin/Editor only)
- Asset/Asset Category (text input)
- Interested Party (text input)
- Threat Description (textarea)
- Risk Description (textarea - existing)

**Section 2: Existing Controls - Initial Assessment**

- Confidentiality Score (1-5) - existing
- Integrity Score (1-5) - existing
- Availability Score (1-5) - existing
- Risk Score (1-5) - new, or auto-calculated
- Likelihood (1-5) - existing
- Initial Score (calculated, read-only)
- Initial Risk Treatment Category (dropdown: Retain, Modify, Share, Avoid)

**Section 3: Additional Controls - Mitigated Assessment**

- Mitigated Confidentiality Score (1-5)
- Mitigated Integrity Score (1-5)
- Mitigated Availability Score (1-5)
- Mitigated Risk Score (1-5)
- Mitigated Likelihood (1-5)
- Mitigated Score (calculated, read-only)
- Mitigation Implemented (checkbox)
- Residual Risk Treatment Category (dropdown: Retain, Modify, Share, Avoid)

**Section 4: Annex A Controls**

- Annex A Controls (comma-separated) - existing

### 3. Enhanced Risk List View (`frontend/src/pages/RisksPage.tsx`)

- Add filters for: Risk Type, Owner, Treatment Category, Mitigation Status
- Add sortable columns for key fields
- Color-code rows by risk level (Low/Medium/High based on score)
- Show both initial and mitigated scores when available
- Display treatment categories with badges

### 4. User Selection Component

- Create or enhance user dropdown component for selecting risk owners
- Fetch users with Admin/Editor roles for owner selection
- Display user name and email in dropdown

## API Enhancements

### New Query Parameters for GET /api/risks

- `riskType` - filter by risk type
- `ownerId` - filter by owner
- `treatmentCategory` - filter by initial or residual treatment category
- `mitigationImplemented` - filter by mitigation status
- `riskLevel` - filter by Low/Medium/High

### Response Enhancements

- Include owner user object in risk responses
- Include calculated risk level (Low/Medium/High) in responses

## Data Migration Considerations

- Existing risks will have null values for new fields (acceptable)
- `dateAdded` can default to `createdAt` for existing records
- `riskScore` can default to `calculatedScore` if not provided separately

## Testing

- Unit tests for mitigated score calculation
- API tests for new fields validation
- Frontend tests for form sections and validation
- E2E test for creating risk with all sections filled

## Files to Modify

1. `backend/prisma/schema.prisma` - Add new Risk fields
2. `backend/prisma/migrations/` - Create new migration
3. `backend/src/services/riskService.ts` - Update scoring functions
4. `backend/src/routes/risks.ts` - Update validation and endpoints
5. `frontend/src/pages/RisksPage.tsx` - Update interface and list view
6. `frontend/src/components/RiskFormModal.tsx` - Restructure form with sections
7. `frontend/src/services/api.ts` - Update API calls if needed

## Implementation Order

1. Database schema changes and migration
2. Backend service and route updates
3. Frontend interface updates
4. Enhanced form with all sections
5. Enhanced list view with filters
6. Testing and validation

### To-dos

- [ ] Update Prisma schema to add all new Risk fields (dateAdded, riskType, ownerUserId, assetCategory, interestedParty, threatDescription, riskScore, initialRiskTreatmentCategory, mitigated scores, mitigationImplemented, residualRiskTreatmentCategory)
- [ ] Create and run database migration for new Risk fields
- [ ] Update riskService.ts to add calculateMitigatedScore function and update existing score calculation logic
- [ ] Update risks.ts routes to handle new fields with validation, filtering, and include owner user in responses
- [ ] Update Risk TypeScript interface in frontend to include all new fields and owner user information
- [ ] Restructure RiskFormModal into four sections matching the risk register template with all new form fields
- [ ] Enhance RisksPage with filters, sortable columns, color-coding by risk level, and display of both initial and mitigated scores
- [ ] Create or enhance user selection component for risk owner dropdown