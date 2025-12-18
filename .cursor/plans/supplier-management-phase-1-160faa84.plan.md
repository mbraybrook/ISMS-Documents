---
name: Supplier Management Phase 3 Implementation Plan
overview: ""
todos:
  - id: e6d062a6-a1fb-4d2e-8afd-b55e5d504d2d
    content: Add Supplier model to Prisma schema with all required fields, enums, indexes, and User relations
    status: pending
  - id: 1da3186e-35e0-48d5-bacf-ab77ca258903
    content: Create Prisma migration and generate client
    status: pending
  - id: 56884f5c-a2c4-4066-9c8a-a5da74593d16
    content: Add Supplier enum types to backend/src/types/enums.ts
    status: pending
  - id: 19806e46-7715-40ee-bf2f-fb2ed511fe1d
    content: Implement GET /api/suppliers with filtering and search
    status: pending
  - id: ac579c0b-4c1d-4825-93d9-ed5acefaac96
    content: Implement GET /api/suppliers/:id endpoint
    status: pending
  - id: c523ac35-a522-4fd3-8869-3ce7a618106f
    content: Implement POST /api/suppliers with validation
    status: pending
  - id: 039f86b8-8f13-408e-9a27-7b5427e500d6
    content: Implement PUT /api/suppliers/:id with validation
    status: pending
  - id: 422ff629-80be-437d-9146-7caad44f8f67
    content: Implement PATCH /api/suppliers/:id/archive endpoint
    status: pending
  - id: a8df9e9c-6843-4668-8feb-2839565b0849
    content: Register suppliers router in backend/src/index.ts
    status: pending
  - id: 93bb5372-7206-41aa-8ceb-8df4254e846e
    content: Create frontend TypeScript types for Supplier in frontend/src/types/supplier.ts
    status: pending
  - id: d7072eee-8033-47b0-991e-4f37504cf957
    content: Create supplier API service methods
    status: pending
  - id: efa5b614-9d4a-4821-a1a1-c286da513de3
    content: Implement SuppliersPage list view with table, filters, and search
    status: pending
  - id: c4d6a900-641c-4a25-9263-276e0de3235e
    content: Implement SupplierDetailPage with Summary tab
    status: pending
  - id: 0a5b3bc3-b952-4f94-9489-c1b66c1aaf46
    content: Implement SupplierDetailPage Risk & Criticality tab
    status: pending
  - id: df09ddbf-3514-4d09-9f9e-db239d8901aa
    content: Implement SupplierDetailPage Compliance tab
    status: pending
  - id: 58ef1fef-1934-4f91-ab13-dfb3e9618d78
    content: Implement SupplierDetailPage Contracts & Contacts tab
    status: pending
  - id: e8bb80ad-2b3d-4097-b09c-ef81f745f249
    content: Implement SupplierDetailPage Notes/History tab
    status: pending
  - id: 2f4f680a-12a3-4e14-b462-e55e05087b4d
    content: Add Suppliers menu item to Layout navigation
    status: pending
  - id: 715c3603-b75a-45ab-9570-ccc384236cb4
    content: Add supplier routes to App.tsx
    status: pending
  - id: d0a256de-157a-4383-a03b-14a9e1cb7c4a
    content: Add SupplierRiskAssessment and SupplierCriticalityAssessment models to Prisma schema with all fields, indexes, and relations
    status: pending
  - id: 5a259bf9-7d1b-4023-8587-bed43241ede4
    content: Add lifecycleState, cisoExemptionGranted, and current assessment ID fields to Supplier model
    status: pending
  - id: 78498a82-af7a-412f-8063-3969015124a8
    content: Add assessment relations to User model
    status: pending
  - id: dfd2fb03-04c1-48b7-ade4-27bcca4277ac
    content: Create and apply Prisma migration for assessment models and lifecycle fields
    status: pending
  - id: 0a881491-600a-430f-bd3f-b30a7c634d3c
    content: Add AssessmentStatus and SupplierLifecycleState types to backend enums
    status: pending
  - id: 4cf0b6aa-c411-4f11-8dfe-aa317dd28e3b
    content: Implement supplierLifecycleService with state transition validation and auto-determination logic
    status: pending
  - id: d71df981-167b-491a-b7e8-e79d9113d94a
    content: Implement supplierApprovalService with policy-driven approval rules (CISO requirements, PCI validation)
    status: pending
  - id: 6e22111b-8e8b-4cbb-8740-6d0cdcdbe11b
    content: Create supplierAssessments.ts routes with CRUD, submit, approve, reject endpoints for both assessment types
    status: pending
  - id: 10da1260-7c3b-40b8-841c-f7c0c0db2799
    content: Update suppliers.ts routes to handle lifecycle state, include assessments in responses, add start-review endpoint
    status: pending
  - id: cc6d0416-b933-43be-8fcc-65e615532968
    content: Register assessment routes in backend index.ts
    status: pending
  - id: c3727787-351e-4dcc-bf6d-d14a316e5e4c
    content: Add assessment interfaces and lifecycle types to frontend supplier types
    status: pending
  - id: 916dc12c-500c-4066-8c72-8be5a4975c70
    content: Add assessment API methods to supplierApi service
    status: pending
  - id: 2c4b0d5e-855d-4ab8-a168-0089d0f09e4b
    content: Create SupplierOnboardingWizard component with 5 steps (Profile, Risk, Criticality, Compliance, Review)
    status: pending
  - id: 1e8f1338-28d0-46e2-bc49-3edd65e06034
    content: Create SupplierAssessmentTimeline component to display chronological assessment history
    status: pending
  - id: 8ed012af-27ab-41e6-891a-2ebda81c8275
    content: Create SupplierApprovalPanel component for approving/rejecting pending assessments
    status: pending
  - id: e5649eb7-7ad0-4f30-aa51-e8a96e4091b7
    content: Update SupplierDetailPage to show lifecycle state, latest assessments, timeline, and approval UI
    status: pending
  - id: e5eea4d7-bcdb-426d-8467-f2053711c402
    content: Update SuppliersPage to show lifecycle state column and filter, integrate wizard
    status: pending
  - id: e26ddaed-4ff0-43cd-9e3c-c44ea9ab1c80
    content: Update App.tsx routing if needed for wizard flow
    status: pending
  - id: 6549090e-8910-4966-b269-375544565b03
    content: Add Supplier model to Prisma schema with all required fields, enums, indexes, and User relations
    status: pending
  - id: c98e733d-c320-4c78-a512-19a5566bf79f
    content: Create Prisma migration and generate client
    status: pending
  - id: dfa7a747-a494-4e3e-83f4-30d62fa09a3d
    content: Add Supplier enum types to backend/src/types/enums.ts
    status: pending
  - id: 42b53e19-ad34-4613-8349-da0f8ee83247
    content: Implement GET /api/suppliers with filtering and search
    status: pending
  - id: 3699e931-dedb-4394-92dd-fef2646d3083
    content: Implement GET /api/suppliers/:id endpoint
    status: pending
  - id: 14c28449-669d-4b0f-8414-b0d16af6082a
    content: Implement POST /api/suppliers with validation
    status: pending
  - id: aaa64424-27c4-44a2-afe4-ff606f4575b2
    content: Implement PUT /api/suppliers/:id with validation
    status: pending
  - id: ff455caf-9a86-409d-aeb6-9664b7d81298
    content: Implement PATCH /api/suppliers/:id/archive endpoint
    status: pending
  - id: 06830fd0-0673-4312-9295-c90ae414b571
    content: Register suppliers router in backend/src/index.ts
    status: pending
  - id: 00f67706-bf98-4ace-b4da-0f046c1276db
    content: Create frontend TypeScript types for Supplier in frontend/src/types/supplier.ts
    status: pending
  - id: 7bdd6281-9311-45ea-8944-24483927cc0b
    content: Create supplier API service methods
    status: pending
  - id: eaa0eb09-e18d-4357-803e-c702c07d4fb4
    content: Implement SuppliersPage list view with table, filters, and search
    status: pending
  - id: d6363514-27c9-47e1-9e57-28d05f17b80a
    content: Implement SupplierDetailPage with Summary tab
    status: pending
  - id: c7a77ed1-4d68-4465-9fe4-518254289b16
    content: Implement SupplierDetailPage Risk & Criticality tab
    status: pending
  - id: b70c3a10-842b-40ad-a5ac-25210368dc99
    content: Implement SupplierDetailPage Compliance tab
    status: pending
  - id: d7098c78-0391-4e41-8e95-17a3805e54b0
    content: Implement SupplierDetailPage Contracts & Contacts tab
    status: pending
  - id: b93a5f90-baa4-4862-9936-82758074b704
    content: Implement SupplierDetailPage Notes/History tab
    status: pending
  - id: dfad11d6-95c4-4ca7-a79a-fd75082ee0d8
    content: Add Suppliers menu item to Layout navigation
    status: pending
  - id: 25ae98f2-10bd-4901-8b89-e94b26a34a83
    content: Add supplier routes to App.tsx
    status: pending
---

# Supplier Management Phase 3 Implementation Plan

## Overview

Phase 3 integrates suppliers into the existing risk and control framework, implements automated review scheduling based on supplier criticality, creates compliance review tracking, and adds automated task creation for reviews and certificate expiries.

## Database Schema Changes

### 1. Supplier-Risk and Supplier-Control Link Tables

Add to [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma):

```prisma
model SupplierRiskLink {
  supplierId String
  riskId     String
  supplier   Supplier @relation(fields: [supplierId], references: [id], onDelete: Cascade)
  risk       Risk     @relation(fields: [riskId], references: [id], onDelete: Cascade)

  @@id([supplierId, riskId])
  @@index([riskId])
  @@index([supplierId])
}

model SupplierControlLink {
  supplierId String
  controlId  String
  supplier   Supplier @relation(fields: [supplierId], references: [id], onDelete: Cascade)
  control    Control  @relation(fields: [controlId], references: [id], onDelete: Cascade)

  @@id([supplierId, controlId])
  @@index([controlId])
  @@index([supplierId])
}
```

### 2. Update Supplier Model

Add to `Supplier` model:

```prisma
model Supplier {
  // ... existing fields ...
  nextReviewAt              DateTime?
  lastReviewAt              DateTime?
  supplierRisks             SupplierRiskLink[]
  supplierControls          SupplierControlLink[]
  complianceReviews         SupplierComplianceReview[]
  certificates              SupplierCertificate[]
}
```

### 3. Update Risk Model

Add optional `isSupplierRisk` field and relation:

```prisma
model Risk {
  // ... existing fields ...
  isSupplierRisk            Boolean  @default(false)
  supplierRisks             SupplierRiskLink[]
}
```

### 4. Supplier Compliance Review Model

Add to [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma):

```prisma
model SupplierComplianceReview {
  id                    String   @id @default(uuid())
  supplierId            String
  reviewType            String   // SCHEDULED, TRIGGERED_BY_INCIDENT, TRIGGERED_BY_CHANGE
  plannedAt             DateTime
  completedAt           DateTime?
  reviewedByUserId      String?
  checksPerformed        String?  // Text or structured JSON
  outcome                String?  // PASS, ISSUES_FOUND, FAIL
  updatedPerformanceRating String? // GOOD, CAUTION, BAD
  notes                 String?
  evidenceLinks         Json?    // Array of strings (URLs)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  supplier              Supplier  @relation(fields: [supplierId], references: [id], onDelete: Cascade)
  reviewedBy            User?     @relation("SupplierComplianceReviewReviewedBy", fields: [reviewedByUserId], references: [id])

  @@index([supplierId])
  @@index([reviewType])
  @@index([plannedAt])
  @@index([completedAt])
  @@index([outcome])
}
```

### 5. Supplier Certificate Model

Add to [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma):

```prisma
model SupplierCertificate {
  id                String   @id @default(uuid())
  supplierId        String
  certificateType   String   // PCI, ISO27001, ISO22301, ISO9001, GDPR, OTHER
  certificateNumber String?
  issuer            String?
  issueDate         DateTime?
  expiryDate        DateTime
  evidenceLink      String?  // URL to certificate
  notes             String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  supplier          Supplier  @relation(fields: [supplierId], references: [id], onDelete: Cascade)

  @@index([supplierId])
  @@index([certificateType])
  @@index([expiryDate])
}
```

### 6. Update ReviewTask Model

Extend to support suppliers:

```prisma
model ReviewTask {
  // ... existing fields ...
  documentId     String?
  supplierId     String?
  document       Document? @relation(fields: [documentId], references: [id], onDelete: Cascade)
  supplier       Supplier? @relation(fields: [supplierId], references: [id], onDelete: Cascade)
  
  // Make documentId optional, add constraint that one must be set
  // Note: Prisma doesn't support CHECK constraints directly, so validation in application layer
}
```

### 7. Update User Model

Add compliance review relation:

```prisma
model User {
  // ... existing fields ...
  supplierComplianceReviewsReviewedBy SupplierComplianceReview[] @relation("SupplierComplianceReviewReviewedBy")
}
```

### 8. Migration

- Create Prisma migration: `npx prisma migrate dev --name add_supplier_integrations_and_reviews`
- Generate Prisma client

## Backend Implementation

### 9. Type Definitions

Add to [`backend/src/types/enums.ts`](backend/src/types/enums.ts):

```typescript
export type ReviewType = 'SCHEDULED' | 'TRIGGERED_BY_INCIDENT' | 'TRIGGERED_BY_CHANGE';
export type ReviewOutcome = 'PASS' | 'ISSUES_FOUND' | 'FAIL';
export type CertificateType = 'PCI' | 'ISO27001' | 'ISO22301' | 'ISO9001' | 'GDPR' | 'OTHER';
```

### 10. Review Scheduling Service

Create [`backend/src/services/supplierReviewScheduler.ts`](backend/src/services/supplierReviewScheduler.ts):

**Functions:**

- `calculateNextReviewDate(supplier)`: Calculates nextReviewAt based on criticality:
  - High: 1 year from now (or from lastReviewAt if exists)
  - Medium: 1 year from now
  - Low: null (optional/ad-hoc)
- `shouldCreateReviewTask(supplier)`: Checks if supplier needs a review task (nextReviewAt within threshold, no open task)
- `createReviewTaskForSupplier(supplier)`: Creates ReviewTask with appropriate assignee:
  - High criticality: Assign to CISO (ADMIN role) or relationshipOwner if no CISO
  - Medium/Low: Assign to relationshipOwnerUserId
- `recalculateReviewDateOnAssessmentApproval(supplier, assessment)`: Recalculates nextReviewAt when criticality changes

### 11. Certificate Expiry Service

Create [`backend/src/services/supplierCertificateService.ts`](backend/src/services/supplierCertificateService.ts):

**Functions:**

- `findCertificatesExpiringSoon(daysBeforeExpiry)`: Finds certificates expiring within X days
- `createCertificateExpiryTask(supplier, certificate)`: Creates ReviewTask for certificate expiry
- `parseCertificateFromEvidenceLinks(links)`: Helper to extract certificate info if stored in old format

### 12. Supplier-Risk-Control API Routes

Create [`backend/src/routes/supplierLinks.ts`](backend/src/routes/supplierLinks.ts):

**Endpoints:**

- `GET /api/suppliers/:id/risks` - List linked risks
- `POST /api/suppliers/:id/risks` - Link a risk to supplier
- `DELETE /api/suppliers/:id/risks/:riskId` - Unlink risk
- `GET /api/suppliers/:id/controls` - List linked controls
- `POST /api/suppliers/:id/controls` - Link a control to supplier
- `DELETE /api/suppliers/:id/controls/:controlId` - Unlink control
- `GET /api/risks/:id/suppliers` - List suppliers linked to risk
- `POST /api/risks/:id/suppliers` - Link supplier to risk
- `GET /api/controls/:id/suppliers` - List suppliers linked to control
- `POST /api/controls/:id/suppliers` - Link supplier to control

### 13. Compliance Review API Routes

Create [`backend/src/routes/supplierComplianceReviews.ts`](backend/src/routes/supplierComplianceReviews.ts):

**Endpoints:**

- `GET /api/suppliers/:id/compliance-reviews` - List all compliance reviews
- `GET /api/suppliers/:id/compliance-reviews/:reviewId` - Get review details
- `POST /api/suppliers/:id/compliance-reviews` - Create compliance review
- `PUT /api/suppliers/:id/compliance-reviews/:reviewId` - Update review
- `POST /api/suppliers/:id/compliance-reviews/:reviewId/complete` - Complete review (sets lastReviewAt, updates performanceRating, recalculates nextReviewAt)

### 14. Certificate Management API Routes

Create [`backend/src/routes/supplierCertificates.ts`](backend/src/routes/supplierCertificates.ts):

**Endpoints:**

- `GET /api/suppliers/:id/certificates` - List all certificates
- `POST /api/suppliers/:id/certificates` - Add certificate
- `PUT /api/suppliers/:id/certificates/:certificateId` - Update certificate
- `DELETE /api/suppliers/:id/certificates/:certificateId` - Delete certificate
- `GET /api/suppliers/certificates/expiring` - List certificates expiring soon (with daysBeforeExpiry query param)

### 15. Scheduled Task Endpoint

Create [`backend/src/routes/supplierScheduler.ts`](backend/src/routes/supplierScheduler.ts):

**Endpoints:**

- `POST /api/suppliers/scheduler/create-review-tasks` - Creates review tasks for suppliers due for review (callable by external cron)
  - Query params: `thresholdDays` (default 30), `dryRun` (default false)
  - Returns: `{ created: number, skipped: number, errors: [] }`
- `POST /api/suppliers/scheduler/create-certificate-tasks` - Creates tasks for expiring certificates
  - Query params: `daysBeforeExpiry` (default 30), `dryRun` (default false)
  - Returns: `{ created: number, skipped: number, errors: [] }`

### 16. Update Supplier Routes

Update [`backend/src/routes/suppliers.ts`](backend/src/routes/suppliers.ts):

- Include linked risks and controls in GET responses
- Auto-calculate `nextReviewAt` when assessment is approved or criticality changes
- Include compliance reviews and certificates in GET /:id response
- Add endpoint: `GET /api/suppliers/:id/review-status` - Returns review status, upcoming dates, open tasks

### 17. Update Risk Routes

Update [`backend/src/routes/risks.ts`](backend/src/routes/risks.ts):

- Add `isSupplierRisk` field to create/update endpoints
- Include linked suppliers in GET /:id response
- Add endpoint: `GET /api/risks/:id/suppliers` - List suppliers linked to this risk
- Add endpoint: `POST /api/risks/:id/suppliers` - Link supplier to risk

### 18. Update Control Routes

Update [`backend/src/routes/controls.ts`](backend/src/routes/controls.ts):

- Include linked suppliers in GET /:id response
- Add endpoint: `GET /api/controls/:id/suppliers` - List suppliers linked to this control
- Add endpoint: `POST /api/controls/:id/suppliers` - Link supplier to control

### 19. Update Review Routes

Update [`backend/src/routes/reviews.ts`](backend/src/routes/reviews.ts):

- Update ReviewTask creation to support supplierId (make documentId optional)
- Update dashboard endpoint to include supplier review tasks
- Update completion logic to handle supplier reviews (update lastReviewAt, recalculate nextReviewAt)

### 20. Register New Routes

Add to [`backend/src/index.ts`](backend/src/index.ts):

```typescript
import supplierLinksRouter from './routes/supplierLinks';
import supplierComplianceReviewsRouter from './routes/supplierComplianceReviews';
import supplierCertificatesRouter from './routes/supplierCertificates';
import supplierSchedulerRouter from './routes/supplierScheduler';
// ...
app.use('/api/suppliers', supplierLinksRouter);
app.use('/api/suppliers', supplierComplianceReviewsRouter);
app.use('/api/suppliers', supplierCertificatesRouter);
app.use('/api/suppliers', supplierSchedulerRouter);
```

## Frontend Implementation

### 21. Type Definitions

Update [`frontend/src/types/supplier.ts`](frontend/src/types/supplier.ts):

Add interfaces:

```typescript
export type ReviewType = 'SCHEDULED' | 'TRIGGERED_BY_INCIDENT' | 'TRIGGERED_BY_CHANGE';
export type ReviewOutcome = 'PASS' | 'ISSUES_FOUND' | 'FAIL';
export type CertificateType = 'PCI' | 'ISO27001' | 'ISO22301' | 'ISO9001' | 'GDPR' | 'OTHER';

export interface SupplierComplianceReview {
  id: string;
  supplierId: string;
  reviewType: ReviewType;
  plannedAt: string;
  completedAt: string | null;
  reviewedByUserId: string | null;
  checksPerformed: string | null;
  outcome: ReviewOutcome | null;
  updatedPerformanceRating: PerformanceRating | null;
  notes: string | null;
  evidenceLinks: string[] | null;
  reviewedBy: User | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierCertificate {
  id: string;
  supplierId: string;
  certificateType: CertificateType;
  certificateNumber: string | null;
  issuer: string | null;
  issueDate: string | null;
  expiryDate: string;
  evidenceLink: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Update `Supplier` interface to include new fields and relations.

### 22. API Service Methods

Update [`frontend/src/services/api.ts`](frontend/src/services/api.ts):

Add to `supplierApi`:

- Link methods: `getSupplierRisks`, `linkSupplierRisk`, `unlinkSupplierRisk`, `getSupplierControls`, `linkSupplierControl`, `unlinkSupplierControl`
- Compliance review methods: `getComplianceReviews`, `getComplianceReview`, `createComplianceReview`, `updateComplianceReview`, `completeComplianceReview`
- Certificate methods: `getCertificates`, `addCertificate`, `updateCertificate`, `deleteCertificate`, `getExpiringCertificates`
- Review status: `getReviewStatus`

### 23. Risks & Controls Tab Component

Create [`frontend/src/components/SupplierRisksControlsTab.tsx`](frontend/src/components/SupplierRisksControlsTab.tsx):

**Features:**

- Display linked risks in a table (id, title, severity, status)
- Display linked controls in a table (id, title, effectiveness)
- "Link Risk" button with search/select dialog
- "Link Control" button with search/select dialog
- Remove link buttons for each item
- Show warning if no risks/controls linked for high-criticality suppliers

### 24. Compliance & Reviews Tab Component

Update [`frontend/src/pages/SupplierDetailPage.tsx`](frontend/src/pages/SupplierDetailPage.tsx):

**Add new "Compliance & Reviews" tab with:**

- Past reviews table (date, type, outcome, reviewer)
- Upcoming review date display
- Open review tasks list
- Warnings for:
  - `performanceRating = BAD` (red alert)
  - `pciStatus = FAIL` (red alert)
  - Expired or expiring certificates (yellow/red alerts)
- Links to corresponding risks and tasks
- "Create Review" button
- Certificate management section with add/edit/delete

### 25. Update Supplier Detail Page

Update [`frontend/src/pages/SupplierDetailPage.tsx`](frontend/src/pages/SupplierDetailPage.tsx):

- Add "Risks & Controls" tab using SupplierRisksControlsTab component
- Replace or enhance existing "Compliance" tab with new "Compliance & Reviews" tab
- Show nextReviewAt and lastReviewAt in Summary tab
- Display review status badge/warning in header

### 26. Update Risk Detail Page

Update [`frontend/src/pages/RiskDetailPage.tsx`](frontend/src/pages/RiskDetailPage.tsx) (if exists) or create:

- Add "Linked Suppliers" section
- Show `isSupplierRisk` checkbox/toggle
- "Link Supplier" button

### 27. Update Control Detail Page

Update [`frontend/src/pages/ControlDetailPage.tsx`](frontend/src/pages/ControlDetailPage.tsx) (if exists) or create:

- Add "Linked Suppliers" section
- "Link Supplier" button

## Testing Checklist

- [ ] Link risk to supplier, verify appears in both supplier and risk detail pages
- [ ] Link control to supplier, verify appears in both supplier and control detail pages
- [ ] Create compliance review, verify lastReviewAt and nextReviewAt update correctly
- [ ] Complete compliance review, verify performanceRating updates and nextReviewAt recalculates
- [ ] Verify review task creation for High criticality supplier (assigned to CISO/ADMIN)
- [ ] Verify review task creation for Medium criticality supplier (assigned to relationshipOwner)
- [ ] Test scheduler endpoint creates tasks for suppliers due within threshold
- [ ] Test scheduler endpoint creates tasks for expiring certificates
- [ ] Verify certificate expiry warnings display correctly
- [ ] Verify performance rating and PCI status warnings display correctly

## Files to Create/Modify

**Backend:**

- `backend/prisma/schema.prisma` (modify)
- `backend/src/types/enums.ts` (modify)
- `backend/src/services/supplierReviewScheduler.ts` (create)
- `backend/src/services/supplierCertificateService.ts` (create)
- `backend/src/routes/supplierLinks.ts` (create)
- `backend/src/routes/supplierComplianceReviews.ts` (create)
- `backend/src/routes/supplierCertificates.ts` (create)
- `backend/src/routes/supplierScheduler.ts` (create)
- `backend/src/routes/suppliers.ts` (modify)
- `backend/src/routes/risks.ts` (modify)
- `backend/src/routes/controls.ts` (modify)
- `backend/src/routes/reviews.ts` (modify)
- `backend/src/index.ts` (modify)

**Frontend:**

- `frontend/src/types/supplier.ts` (modify)
- `frontend/src/services/api.ts` (modify)
- `frontend/src/components/SupplierRisksControlsTab.tsx` (create)
- `frontend/src/pages/SupplierDetailPage.tsx` (modify)
- `frontend/src/pages/RiskDetailPage.tsx` (modify or create)
- `frontend/src/pages/ControlDetailPage.tsx` (modify or create)

**Database:**

- Migration file (auto-generated)