---
name: Fix Control Duplication Issue
overview: Fix the root cause of duplicate control creation during risk imports by normalizing control code lookups to handle both "8.25" and "A.8.25" formats, and create a data migration script to fix existing duplicates by relinking risks to standard controls.
todos:
  - id: "1"
    content: Add normalizeControlCode and findControlByCode helper functions to riskService.ts
    status: completed
  - id: "2"
    content: Update updateRiskControls function to use normalized code lookup and prefer standard controls
    status: completed
    dependencies:
      - "1"
  - id: "3"
    content: Enhance control creation route validation to check normalized codes
    status: completed
    dependencies:
      - "1"
  - id: "4"
    content: Create fix-duplicate-controls.ts migration script to relink risks and remove duplicates
    status: completed
  - id: "5"
    content: Update unit tests for riskService to test normalization and lookup logic
    status: completed
    dependencies:
      - "1"
      - "2"
  - id: "6"
    content: Update integration tests for riskImportService to verify no duplicates are created
    status: completed
    dependencies:
      - "1"
      - "2"
---

# Fix Control Duplication Issue

## Problem Analysis

The issue occurs in `updateRiskControls` function in `backend/src/services/riskService.ts`. When importing risks:

1. CSV files contain control codes in various formats (e.g., "8.25", "A.8.25")
2. Standard controls are stored with codes like "8.25" (from ISO 27002 seed script)
3. The lookup uses exact match: `findUnique({ where: { code } })`
4. When codes don't match exactly (e.g., CSV has "A.8.25" but standard is "8.25"), it creates a duplicate custom control
5. Risks get linked to the incorrect custom control instead of the standard control

## Solution Overview

1. **Fix Code Lookup Logic**: Normalize control codes to handle both "8.25" and "A.8.25" formats
2. **Prefer Standard Controls**: When multiple controls match (by normalized code), prefer standard controls
3. **Prevent Future Duplicates**: Add validation to prevent creating custom controls that match standard controls
4. **Data Migration**: Create script to fix existing duplicates by relinking risks and removing duplicates

## Implementation Plan

### 1. Fix Control Code Lookup in `updateRiskControls`

**File**: `backend/src/services/riskService.ts`

- Create a helper function `normalizeControlCode(code: string): string` that:
  - Removes "A." prefix if present (e.g., "A.8.25" → "8.25")
  - Handles edge cases (whitespace, case)
- Create a helper function `findControlByCode(code: string)` that:
  - Normalizes the input code
  - Searches for controls matching the normalized code (exact match or with "A." prefix)
  - Prefers standard controls over custom controls when multiple matches exist
  - Returns the best match or null
- Update `updateRiskControls` to use the new lookup function instead of `findUnique`

**Key Changes**:

```typescript
// New helper functions
function normalizeControlCode(code: string): string {
  // Remove "A." prefix and normalize
  return code.trim().replace(/^A\./i, '');
}

async function findControlByCode(code: string) {
  const normalized = normalizeControlCode(code);
  // Try exact match first
  let control = await prisma.control.findUnique({ where: { code: normalized } });
  if (control) return control;
  
  // Try with "A." prefix
  control = await prisma.control.findUnique({ where: { code: `A.${normalized}` } });
  if (control) return control;
  
  // If still not found, try finding by normalized code (handles both formats)
  const controls = await prisma.control.findMany({
    where: {
      OR: [
        { code: normalized },
        { code: `A.${normalized}` },
      ],
    },
  });
  
  // Prefer standard control if multiple exist
  const standardControl = controls.find(c => c.isStandardControl);
  return standardControl || controls[0] || null;
}
```

### 2. Add Validation to Prevent Duplicate Creation

**File**: `backend/src/services/riskService.ts`

- In `updateRiskControls`, before creating a new control:
  - Check if a standard control exists with the normalized code
  - If found, use the standard control instead of creating a new one
  - Only create custom controls if no matching standard control exists

**Key Changes**:

```typescript
// In updateRiskControls, replace the create logic:
if (!control) {
  // Check if standard control exists with normalized code
  const normalizedCode = normalizeControlCode(code);
  const standardControl = await findControlByCode(normalizedCode);
  
  if (standardControl?.isStandardControl) {
    // Use existing standard control instead of creating duplicate
    control = standardControl;
  } else {
    // Only create if truly no matching control exists
    control = await prisma.control.create({ ... });
  }
}
```

### 3. Update Control Creation Route Validation

**File**: `backend/src/routes/controls.ts`

- Enhance the existing validation in the POST route to also check normalized codes
- Prevent creating custom controls that match standard controls (even with different formatting)

**Key Changes**:

```typescript
// In POST /api/controls route, enhance validation:
const code = req.body.code as string;
const normalizedCode = normalizeControlCode(code);

// Check both exact code and normalized code
const existingStandard = await prisma.control.findFirst({
  where: {
    isStandardControl: true,
    OR: [
      { code: code },
      { code: normalizedCode },
      { code: `A.${normalizedCode}` },
    ],
  },
});

if (existingStandard) {
  return res.status(409).json({ 
    error: 'A standard ISO 27002 control with this code already exists. Standard controls cannot be recreated.' 
  });
}
```

### 4. Create Data Migration Script

**New File**: `backend/scripts/fix-duplicate-controls.ts`

- Find all custom controls that have matching standard controls (by normalized code)
- For each duplicate:
  - Find all risks linked to the custom control
  - Relink those risks to the standard control
  - Delete the custom control
- Provide detailed logging and summary report

**Script Structure**:

```typescript
async function fixDuplicateControls() {
  // 1. Find all custom controls
  // 2. For each custom control, normalize its code and find matching standard control
  // 3. If match found:
  //    - Get all RiskControl links for the custom control
  //    - Create new RiskControl links to standard control (skip if already exists)
  //    - Delete old RiskControl links
  //    - Delete the custom control
  // 4. Report summary
}
```

### 5. Add Helper Function Export

**File**: `backend/src/services/riskService.ts`

- Export `normalizeControlCode` function for use in other modules (e.g., routes)

## Testing Strategy

1. **Unit Tests**: Update existing tests in `backend/src/services/__tests__/riskService.test.ts`

   - Test `normalizeControlCode` with various formats
   - Test `findControlByCode` with exact matches, prefix variations, and standard vs custom preference
   - Test `updateRiskControls` with codes in different formats

2. **Integration Tests**: Update `backend/src/services/__tests__/riskImportService.test.ts`

   - Test risk import with control codes in "8.25" format
   - Test risk import with control codes in "A.8.25" format
   - Verify no duplicates are created

3. **Manual Testing**:

   - Import a risk CSV with control codes in "A.8.25" format
   - Verify risks link to standard controls, not custom duplicates
   - Run migration script on test database
   - Verify existing duplicates are fixed

## Files to Modify

1. `backend/src/services/riskService.ts` - Fix lookup logic and add normalization
2. `backend/src/routes/controls.ts` - Enhance validation
3. `backend/scripts/fix-duplicate-controls.ts` - New migration script
4. `backend/src/services/__tests__/riskService.test.ts` - Update tests
5. `backend/src/services/__tests__/riskImportService.test.ts` - Update tests

## Migration Script Usage

After implementing the fixes, run the migration script to fix existing data:

```bash
cd backend
npm run ts-node scripts/fix-duplicate-controls.ts
```

The script will:

- Identify all duplicate custom controls
- Relink risks to standard controls
- Delete duplicate custom controls
- Provide a detailed report of changes