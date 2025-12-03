<!-- 321c7419-c383-4c86-991b-453979750790 03082454-b9b9-420e-b775-2a4cfe344164 -->
# Asset Management and Risk Linking Implementation

## Overview

Create a complete asset management system that allows linking risks to specific assets or asset categories. Implement classification system for Paythru Classification values. Import existing Assets.csv data.

## Database Schema Changes

### 1. Create Classification Model

- **File**: `backend/prisma/schema.prisma`
- Add `Classification` model with:
- `id` (UUID, primary key)
- `name` (String, unique) - e.g., "Public", "Paythru Sensitive", etc.
- `description` (String, optional) - for future use
- `createdAt`, `updatedAt` (timestamps)
- Seed initial classifications: Public, Paythru Sensitive, Paythru Confidential, Paythru Proprietary

### 2. Create AssetCategory Model

- **File**: `backend/prisma/schema.prisma`
- Add `AssetCategory` model with:
- `id` (UUID, primary key)
- `name` (String, unique) - e.g., "Hardware", "Hosted Infrastructure"
- `description` (String, optional)
- `createdAt`, `updatedAt` (timestamps)
- Relation: `assets Asset[]`

### 3. Create Asset Model

- **File**: `backend/prisma/schema.prisma`
- Add `Asset` model with all fields from CSV:
- `id` (UUID, primary key)
- `date` (DateTime)
- `assetCategoryId` (String, FK to AssetCategory)
- `assetSubCategory` (String, optional)
- `owner` (String) - e.g., "CISO", "DSO", "COO", "CPO"
- `primaryUser` (String, optional)
- `location` (String, optional)
- `manufacturer` (String, optional)
- `model` (String, optional)
- `nameSerialNo` (String, optional)
- `cdeImpacting` (Boolean, default false)
- `classificationId` (String, FK to Classification)
- `purpose` (String, optional)
- `notes` (String, optional)
- `cost` (String, optional) - stored as string to preserve currency format
- `createdAt`, `updatedAt` (timestamps)
- Relations: `category AssetCategory`, `classification Classification`, `riskAssets RiskAsset[]`

### 4. Update Risk Model

- **File**: `backend/prisma/schema.prisma`
- Remove or deprecate `assetCategory` string field
- Add optional relations:
- `assetId` (String?, FK to Asset)
- `assetCategoryId` (String?, FK to AssetCategory)
- Add relation: `riskAssets RiskAsset[]` (for many-to-many if needed, but based on requirements it's one-to-one)
- Add constraint: ensure only one of `assetId` or `assetCategoryId` is set (enforced in application logic)

### 5. Create Migration

- Generate Prisma migration for schema changes

## Backend Implementation

### 6. Classification Routes

- **File**: `backend/src/routes/classifications.ts` (new)
- Endpoints:
- `GET /api/classifications` - List all classifications
- `GET /api/classifications/:id` - Get classification details
- `POST /api/classifications` - Create (Admin/Editor only)
- `PUT /api/classifications/:id` - Update (Admin/Editor only)
- `DELETE /api/classifications/:id` - Delete (Admin/Editor only)

### 7. Asset Category Routes

- **File**: `backend/src/routes/assetCategories.ts` (new)
- Endpoints:
- `GET /api/asset-categories` - List all categories with asset counts
- `GET /api/asset-categories/:id` - Get category details with assets
- `POST /api/asset-categories` - Create (Admin/Editor only)
- `PUT /api/asset-categories/:id` - Update (Admin/Editor only)
- `DELETE /api/asset-categories/:id` - Delete (Admin/Editor only, with validation)

### 8. Asset Routes

- **File**: `backend/src/routes/assets.ts` (new)
- Endpoints:
- `GET /api/assets` - List assets with filtering (category, classification, owner, search)
- `GET /api/assets/:id` - Get asset details with linked risks
- `POST /api/assets` - Create (Admin/Editor only)
- `PUT /api/assets/:id` - Update (Admin/Editor only)
- `DELETE /api/assets/:id` - Delete (Admin/Editor only, with validation)
- `POST /api/assets/import` - Bulk import from CSV (Admin/Editor only)

### 9. Update Risk Routes

- **File**: `backend/src/routes/risks.ts`
- Update create/update endpoints to:
- Accept `assetId` or `assetCategoryId` (mutually exclusive validation)
- Include asset/category in risk responses
- Update filtering to support asset/category filters

### 10. Asset Import Service

- **File**: `backend/src/services/assetImportService.ts` (new)
- Parse Assets.csv file
- Map CSV columns to Asset model fields
- Handle date parsing (DD/MM/YYYY format)
- Create/update AssetCategory records
- Create/update Classification records
- Create Asset records with proper relations
- Return import results with errors

### 11. Seed Classifications

- **File**: `backend/scripts/seed-classifications.ts` (new)
- Seed initial classification values
- Can be run as part of import or separately

### 12. Register Routes

- **File**: `backend/src/index.ts`
- Add routes for classifications, asset-categories, and assets

## Frontend Implementation

### 13. Classifications Page (Optional)

- **File**: `frontend/src/pages/ClassificationsPage.tsx` (new, optional)
- Basic CRUD interface if management is needed
- Or just use in dropdowns/selects in other forms

### 14. Asset Categories Page

- **File**: `frontend/src/pages/AssetCategoriesPage.tsx` (new)
- List asset categories with asset counts
- Create/Edit/Delete functionality (Admin/Editor only)
- Filtering and search
- Follow pattern from ControlsPage or DocumentsPage

### 15. Assets Page

- **File**: `frontend/src/pages/AssetsPage.tsx` (new)
- List assets with filtering (category, classification, owner, search)
- Create/Edit/View/Delete functionality (Admin/Editor only)
- Show linked risks count/badges
- CSV import functionality (similar to MassImportPage pattern)
- Column visibility controls
- Export to CSV
- Follow pattern from RisksPage or DocumentsPage

### 16. Update Risks Page

- **File**: `frontend/src/pages/RisksPage.tsx`
- Add "Asset" or "Asset Category" column to risk table
- Show asset/category name with link to asset detail
- Add asset/category filter
- Update risk form modal to include:
- Asset selector (dropdown/search)
- Asset Category selector (dropdown)
- Mutually exclusive selection (radio buttons or clear one when other is selected)
- Visual indicator showing which is selected

### 17. Asset Detail View

- Add modal or page to view asset details
- Show linked risks with links back to risk detail
- Visual linking indicators

### 18. Update Navigation

- **File**: `frontend/src/components/Layout.tsx` or navigation component
- Add "Assets" menu item
- Add "Asset Categories" menu item (if separate page)

### 19. Update App Routes

- **File**: `frontend/src/App.tsx`
- Add routes for `/assets` and `/asset-categories`

## Data Import

### 20. Import Assets CSV

- Create import script or use API endpoint
- Parse `docs/Assets.csv`
- Handle date format conversion (DD/MM/YYYY to ISO)
- Map all CSV columns to Asset fields
- Create AssetCategory records for unique categories
- Create/update Classification records
- Import all assets with proper relations
- Handle errors and report results

## Testing Considerations

- Test mutually exclusive asset/category selection in risk forms
- Test asset deletion with linked risks (should prevent or handle gracefully)
- Test category deletion with assets (should prevent or handle gracefully)
- Test CSV import with various data formats
- Test filtering and search functionality
- Test visual linking between risks and assets

## Files to Create/Modify

**New Files:**

- `backend/prisma/migrations/XXXXXX_add_assets_and_classifications/migration.sql`
- `backend/src/routes/classifications.ts`
- `backend/src/routes/assetCategories.ts`
- `backend/src/routes/assets.ts`
- `backend/src/services/assetImportService.ts`
- `backend/scripts/seed-classifications.ts`
- `frontend/src/pages/AssetCategoriesPage.tsx`
- `frontend/src/pages/AssetsPage.tsx`

**Modified Files:**

- `backend/prisma/schema.prisma`
- `backend/src/routes/risks.ts`
- `backend/src/index.ts`
- `frontend/src/pages/RisksPage.tsx`
- `frontend/src/App.tsx`
- `frontend/src/components/Layout.tsx` (or navigation component)

### To-dos

- [ ] Create Classification model in Prisma schema with name and description fields
- [ ] Create AssetCategory model in Prisma schema
- [ ] Create Asset model in Prisma schema with all CSV fields and relations
- [ ] Update Risk model to link to Asset or AssetCategory (mutually exclusive)
- [ ] Generate and apply Prisma migration for schema changes
- [ ] Create classification API routes with CRUD operations
- [ ] Create asset category API routes with CRUD operations
- [ ] Create asset API routes with CRUD operations and import endpoint
- [ ] Update risk routes to handle asset/category linkage with validation
- [ ] Create asset import service to parse and import Assets.csv
- [ ] Create script to seed initial classification values
- [ ] Register new routes in backend index.ts
- [ ] Create AssetCategoriesPage with listing and CRUD functionality
- [ ] Create AssetsPage with listing, CRUD, filtering, and CSV import
- [ ] Update RisksPage to show asset/category links and add selection in form
- [ ] Add Assets and Asset Categories to navigation menu
- [ ] Add routes for assets and asset categories in App.tsx
- [ ] Import existing Assets.csv data into database