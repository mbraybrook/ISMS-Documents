# ISMS Document Management and Compliance Application – AI Build Specification

This document is a complete specification for an AI coding agent to implement a Node.js/React application that provides a “single pane of glass” over an organisation’s ISMS documentation stored primarily in Microsoft SharePoint, with links to selected Confluence content.

The AI must generate production‑quality code and documentation, and clearly separate human‑performed configuration steps (e.g. Entra ID setup).

***

## 1. Project Overview

### 1.1 Purpose

Build a web application that:

- Centralises visibility and control of ISMS documents (policies, procedures, records) stored in SharePoint, with optional references to specific “living” Confluence pages.
- Manages document lifecycle metadata (version, owner, review dates, status).
- Tracks staff acknowledgments of updated documents.
- Manages review schedules and provides dashboards for upcoming and overdue reviews.
- Links risks to controls and documents, and generates a Statement of Applicability (SoA) spreadsheet based on risk/control mappings (Phase 1: basic structure, logic may be refined later).

The application will initially be used by a single ISMS owner plus all staff in the organisation; later, 1–2 additional admins/editors may be added.

### 1.2 Scope

In scope (Phase 1):

- Document inventory, storage of metadata, and linking to SharePoint and Confluence locations.
- Role‑based access (Admin, Editor, Staff) with Entra ID sign‑in.
- Staff “read and understood” acknowledgment workflow with “Acknowledge All” support.
- Review scheduling and dashboards for due/overdue reviews.
- Basic risk and Annex A control entities, with ability to parse and store mappings such as “A.8.3, A.5.9, A.8.24” from a risk.
- SoA export to Excel (with optional PDF export if feasible via a library).
- Minimal risk heatmap or summary (nice‑to‑have but design for extension).

Out of scope (for now, but design for extensibility):

- Non‑ISMS documents (training records, audit reports, non‑conformance management, etc.).
- Quizzes or e‑signature‑grade acknowledgments.
- Email/calendar reminders.
- Deep Jira integration (schedule for future phase).

***

## 2. Architecture

### 2.1 High‑Level Architecture

- Frontend:
  - React SPA, TypeScript, using a standard routing library (e.g. React Router).
  - Component‑based UI with a simple, clean layout (no heavy design system required, but using a lightweight UI library such as MUI/Chakra is acceptable).
  - Authentication via Entra ID / Microsoft identity platform using MSAL in the browser.
- Backend:
  - Node.js (use current LTS) with TypeScript.
  - Framework: Express (or NestJS – choose one and keep structure idiomatic).
  - REST API with JSON responses.
  - Responsible for:
    - Persisting metadata (documents, risks, controls, acknowledgments, reviews, users/roles).
    - Integrating with Microsoft Graph APIs to interact with SharePoint.
    - Integrating with Confluence REST API (for links / metadata only, not content storage).
    - Generating SoA Excel files.
- Data storage:
  - Use a relational database (SQLite for local/dev; allow easy swap to Postgres/MySQL in future).
  - Use a migration tool (e.g. Prisma, TypeORM, or similar) with schema definitions in code.
- Deployment:
  - Local/dev: single repo with backend and frontend; easily run via `docker-compose` or simple scripts.
  - Production target: containerised backend + static frontend that can be deployed to a small cloud instance or managed container service.
  - Do not hard‑wire any cloud provider specifics; provide configuration via environment variables.


### 2.2 Security and Authentication

- Use Entra ID (Microsoft identity platform) OAuth2/OIDC for authentication.
- Use MSAL in the frontend to obtain ID token and (if needed) access tokens for Microsoft Graph calls.
- Backend validates tokens and extracts user identity (subject ID, UPN/email).
- Implement role model inside the app (Admin, Editor, Staff) based on local DB mapping between user identity and role.
- Ensure all API endpoints validate authentication; enforce authorization by role.

***

## 3. Data Model

Define TypeScript interfaces / ORM models for these core entities.

### 3.1 User

- `id` (UUID, primary key).
- `displayName` (string).
- `email` (string, unique).
- `entraObjectId` (string, unique) – ID from Entra ID.
- `role` (enum: `ADMIN`, `EDITOR`, `STAFF`).
- `createdAt`, `updatedAt` (timestamps).


### 3.2 Document

Represents an ISMS document (policy, procedure, manual, record, etc.), regardless of whether it physically resides in SharePoint (primary) or is a Confluence “living” page.

- `id` (UUID).
- `title` (string).
- `type` (enum: `POLICY`, `PROCEDURE`, `MANUAL`, `RECORD`, `TEMPLATE`, `OTHER`).
- `storageLocation` (enum: `SHAREPOINT`, `CONFLUENCE`).
- `sharePointSiteId` (string | null).
- `sharePointDriveId` (string | null).
- `sharePointItemId` (string | null).
- `confluenceSpaceKey` (string | null).
- `confluencePageId` (string | null).
- `version` (string) – human version number, e.g. “1.2”.
- `status` (enum: `DRAFT`, `IN_REVIEW`, `APPROVED`, `SUPERSEDED`).
- `ownerUserId` (UUID, FK → User).
- `lastReviewDate` (date | null).
- `nextReviewDate` (date | null).
- `createdAt`, `updatedAt` (timestamps).

Allow `Document` to have optional links to risks and controls via relation tables (see below).

### 3.3 Risk

- `id` (UUID).
- `externalId` (string) – ID used in the existing Excel sheet.
- `title` (string).
- `description` (text).
- `confidentialityScore` (integer 1–5).
- `integrityScore` (integer 1–5).
- `availabilityScore` (integer 1–5).
- `likelihood` (integer 1–5).
- `calculatedScore` (integer) – computed as `(C + I + A) * likelihood`.
- `annexAControlsRaw` (string) – raw string from spreadsheet, e.g. “A.8.3, A.5.9, A.8.24”.
- `createdAt`, `updatedAt`.


### 3.4 Control (Annex A Control)

- `id` (UUID).
- `code` (string) – e.g. “A.8.3”.
- `title` (string).
- `description` (text, brief).
- `isApplicable` (boolean).
- `applicabilitySource` (enum: `AUTO_FROM_RISK`, `MANUAL_OVERRIDE`).
- `justification` (text) – reasoning for applicability or non‑applicability.
- `createdAt`, `updatedAt`.


### 3.5 Relations

- `RiskControl` (many‑to‑many):
  - `riskId` (FK → Risk).
  - `controlId` (FK → Control).
- `DocumentControl` (many‑to‑many):
  - `documentId` (FK → Document).
  - `controlId` (FK → Control).
- `DocumentRisk` (optional many‑to‑many if required):
  - `documentId` (FK → Document).
  - `riskId` (FK → Risk).


### 3.6 ReviewTask

Represents a scheduled or completed review of a document.

- `id` (UUID).
- `documentId` (FK → Document).
- `reviewerUserId` (FK → User).
- `dueDate` (date).
- `completedDate` (date | null).
- `changeNotes` (text | null).
- `status` (enum: `PENDING`, `COMPLETED`, `OVERDUE`) – `OVERDUE` can be derived but may also be stored for query optimisation.
- `createdAt`, `updatedAt`.


### 3.7 Acknowledgment

Represents “read and understood” acknowledgments by staff.

- `id` (UUID).
- `userId` (FK → User).
- `documentId` (FK → Document).
- `documentVersion` (string) – snapshot of `Document.version` at acknowledgment time.
- `acknowledgedAt` (timestamp).


### 3.8 SoAExport

Optional entity tracking generated SoA files (for auditability):

- `id` (UUID).
- `generatedByUserId` (FK → User).
- `generatedAt` (timestamp).
- `exportFormat` (enum: `EXCEL`, `PDF`).
- `filePath` or `storageKey` if stored by the system.

***

## 4. External Systems and APIs

The AI must implement integration points but not hard‑code environment specifics. Use configuration through environment variables.

### 4.1 Microsoft Entra ID / Microsoft Identity

- Use OAuth2/OIDC for authentication.
- Frontend: MSAL to sign in and acquire tokens.
- Backend: Validate tokens (via JWKS) and map to local `User`.
- The spec expects the following configuration via environment variables (names can be adjusted but must be clearly documented):
  - `AUTH_TENANT_ID`
  - `AUTH_CLIENT_ID`
  - `AUTH_CLIENT_SECRET` (if backend uses confidential client flow).
  - `AUTH_REDIRECT_URI` (frontend).

The AI must generate clear documentation for manual configuration tasks (see Section 10).

### 4.2 Microsoft Graph / SharePoint

Use Microsoft Graph to read metadata and, if necessary, limited file information for documents stored in SharePoint:

- Retrieve list of ISMS documents from a specific SharePoint site and library (site URL, site ID, and library/drive ID should be configurable).
- Map SharePoint items to `Document` entities with stable IDs.
- Store SharePoint identifiers (`siteId`, `driveId`, `itemId`) in the `Document` record.
- Only minimal read/write operations are required at this stage:
  - Read document properties (title, path/url, possibly version).
  - Optionally set/update metadata fields in SharePoint if mapped.

Do NOT attempt to manage file content versioning yourself; rely on SharePoint for content versioning and keep application version as logical version metadata.

### 4.3 Confluence

- Use the Confluence REST API to fetch page metadata (title, URL) for designated “living” documents.
- Store only references (space key, page ID, URL) in `Document`.
- No need for content editing via this app in Phase 1.

***

## 5. User Roles and Permissions

Implement the following roles:

- `ADMIN`
  - Full access: manage configuration, documents, risks, controls, SoA exports, users, reviews, acknowledgments.
- `EDITOR`
  - Manage documents’ metadata, review tasks, risk/control mappings, and SoA generation.
  - Cannot manage users/roles.
- `STAFF`
  - Read‑only access to dashboards and document list.
  - Can open linked documents (SharePoint/Confluence) and perform acknowledgments.

Authorisation rules:

- Only Admin/Editor can create/update/delete `Document`, `Risk`, `Control`, `ReviewTask`.
- Only Admin can change user roles.
- Any authenticated user can create `Acknowledgment` for themselves.

***

## 6. Features

For each feature below, implement UI, API endpoints, and any necessary background logic.

### 6.1 Document Inventory and Metadata Management

Goal: Provide a central list of all ISMS documents with metadata and links to source locations.

Functional requirements:

- Admin/Editor can:
  - Create a new `Document` entry and point it to either a SharePoint item or Confluence page.
  - Edit document properties: title, type, version, owner, status, last/next review dates, links to controls/risks.
- System displays a table view with filters: by type, status, owner, next review date range.
- Each row shows: title, type, storage location, owner, version, status, last review date, next review date.

Endpoints (example):

- `GET /api/documents` – list with filtering and pagination.
- `POST /api/documents` – create.
- `GET /api/documents/:id` – details.
- `PUT /api/documents/:id` – update.
- `DELETE /api/documents/:id` – soft delete (mark as superseded).

Acceptance criteria:

- A new document can be created and appears in the list.
- Editing metadata persists correctly.
- Opening a document from the UI uses the correct SharePoint/Confluence URL.

### 6.2 Acknowledgment Workflow

Goal: Allow staff to see which documents have changed since their last acknowledgment and to record “read and understood” with minimal friction, ideally via an “Acknowledge All” action.

Functional requirements:

- On login, Staff users see a list of “Documents requiring acknowledgment”, derived from:
  - Approved documents with a version greater than the last version the user acknowledged (or never acknowledged).
- For each such document, the UI must show: title, current version, storage location (SharePoint/Confluence), owner, and last updated/last review date.
- Users must be able to:
  - Open each document in a new tab via its SharePoint/Confluence URL.
  - Click an “Acknowledge All” button that:
    - Creates an `Acknowledgment` record per listed document, tying the user to the current document version.
- Future‑phase ready:
  - API design should allow for per‑document acknowledgment later (e.g. `POST /api/acknowledgments` per document) even if Phase 1 UI only exposes “Acknowledge All”.
- The system must log timestamp and user identity for each acknowledgment and prevent duplicate acknowledgments for the same user/document/version.

Suggested endpoints:

- `GET /api/acknowledgments/pending`
  - Returns list of documents needing acknowledgment for the current user.
- `POST /api/acknowledgments/bulk`
  - Request body: list of `documentId`s (or empty to acknowledge all currently pending).
  - Creates `Acknowledgment` rows (if not already present for that user/document/version).
- `GET /api/acknowledgments/stats`
  - Returns summary statistics for admins (e.g. per document, count/percentage of staff that have acknowledged latest version).

Acceptance criteria:

- When a document’s version is incremented, all staff see it as pending acknowledgment until they acknowledge.
- “Acknowledge All” creates one acknowledgment entry per pending document for that user.
- Re‑loading the pending list after acknowledgment shows an empty list (unless new updates have occurred).
- Admin can view acknowledgment percentages per document and confirm that data matches underlying records.

***

### 6.3 Review Scheduling and Dashboards

Goal: Ensure every document has a planned review cycle and make it easy for admins/editors to see upcoming and overdue reviews without relying on email/calendar reminders.

Functional requirements:

- Admin/Editor can assign a `ReviewTask` to a document with: reviewer, due date, and optional notes.
- A document can have multiple historical ReviewTasks; only the latest pending/completed one is relevant for the current cycle.
- When a review is completed, the reviewer records:
  - Completed date.
  - Change notes (summary of what changed or confirming “no changes required”).
- System should support a simple default rule (not enforced automatically in Phase 1 but supported by UI):
  - Typically annual review; some documents may have a longer cycle (e.g. 3‑year).
- Dashboards:
  - “Documents needing review in the next 30 days” – based on `nextReviewDate` or pending ReviewTasks with dueDate in next 30 days.
  - “Overdue reviews” – dueDate < today and status not `COMPLETED`.
  - “Reviews completed in the last X days” – filter by date range.

Suggested endpoints:

- `GET /api/reviews/dashboard` – returns structured data for:
  - `upcomingReviews`, `overdueReviews`, `recentlyCompletedReviews`.
- `POST /api/reviews` – create a ReviewTask for a document.
- `PUT /api/reviews/:id/complete` – mark as completed with `completedDate` and `changeNotes`.
- `GET /api/reviews/document/:documentId` – history of reviews for that document.

Acceptance criteria:

- An admin can see all documents with reviews due in next 30 days and all overdue reviews from a single dashboard view.
- Completing a review updates the ReviewTask and allows the admin/editor to update the document’s `lastReviewDate` and `nextReviewDate`.
- Overdue items appear correctly when dueDate passes.

***

### 6.4 Risk Management and Control Mapping

Goal: Represent the existing risk register (currently in Excel) inside the system, including CIA+likelihood scoring and mapping of each risk to Annex A controls, then link controls to documents.

Functional requirements:

- Ability to import or manually enter risks with fields defined in the `Risk` model, including raw Annex A control codes string.
- The backend must parse the `annexAControlsRaw` field into individual codes such as “A.8.3”, “A.5.9”, “A.8.24” and map them to `Control` entities via `RiskControl` relation.
- Provide a small CRUD UI for Admin/Editor to:
  - View list of risks with sortable columns including `calculatedScore`.
  - Edit a risk’s CIA scores and likelihood and see updated `calculatedScore`.
  - Modify the list of controls associated with a risk (add/remove controls).
- Provide a CRUD UI for controls:
  - List of Annex A controls with `code`, `title`, `description`, `isApplicable`, `applicabilitySource`, `justification`.
  - Display which risks and documents are linked to each control.
- Biz logic for applicability (Phase 1, simple rule):
  - A control is `isApplicable = true` if:
    - It is referenced by at least one risk (via `RiskControl`), OR
    - It has a manual override with `applicabilitySource = MANUAL_OVERRIDE`.
  - Non‑applicable controls can still be recorded with justification.

Optional nice‑to‑have (design but not mandatory):

- A basic “risk heatmap” or distribution view based on `calculatedScore` buckets (low/medium/high).

Suggested endpoints:

- `GET /api/risks` / `POST /api/risks` / `PUT /api/risks/:id` / `GET /api/risks/:id`.
- `GET /api/controls` / `POST /api/controls` / `PUT /api/controls/:id`.
- `POST /api/risks/:id/controls` – set list of control IDs for a given risk.
- `GET /api/controls/:id/links` – get linked risks and documents.

Acceptance criteria:

- Import or manual creation of a risk with `annexAControlsRaw = "A.8.3, A.5.9, A.8.24"` results in associated `RiskControl` entries referencing controls `A.8.3`, `A.5.9`, `A.8.24` (assuming those controls exist).
- Editing CIA or likelihood correctly updates `calculatedScore`.
- Controls show accurate associations to risks and documents.

***

### 6.5 Statement of Applicability (SoA) Export

Goal: Automatically generate a SoA Excel (and optionally PDF) file summarising each Annex A control, its applicability, justification, and linked evidence.

Functional requirements:

- Provide a UI action (Admin/Editor) “Generate SoA” that:
  - Reads all `Control` records and their links to Risks and Documents.
  - Builds an in‑memory representation of SoA rows with at least:
    - Control code.
    - Control title.
    - Applicable (Yes/No).
    - Applicability source (derived from risks or manual override).
    - Justification.
    - Linked risk IDs or count.
    - Linked document titles or count.
  - Writes these rows to an Excel file with a clearly defined column layout.
  - Optionally, converts to PDF (if using a library; otherwise this may be manual for now).
- Store the generated file in a configurable location or return it as a downloadable response.
- Optionally create a `SoAExport` record to log generation events.

Suggested endpoint:

- `POST /api/soa/export`
  - Response: triggers download of Excel file, and optionally records metadata in DB.

Acceptance criteria:

- Generated Excel file matches defined column structure and includes all Annex A controls.
- At least one control with `isApplicable = true` appears with “Yes” (or equivalent) in the applicability column and includes justification.
- Controls not referenced by any risk and without manual override appear as non‑applicable with recorded justification (which may be blank in Phase 1, to be filled manually).

***

## 7. Non‑Functional Requirements

### 7.1 Security

- All API endpoints require valid authentication tokens.
- Enforce role‑based access control as defined in Section 5.
- Never store raw OAuth tokens in the backend; store only what is necessary (e.g. user identity).
- Protect secrets and configuration via environment variables (no hard‑coded secrets).


### 7.2 Logging and Auditability

- Log at least:
  - Authentication events (user sign‑in, failures – without sensitive details).
  - CRUD operations on Documents, Risks, Controls, ReviewTasks.
  - Acknowledgments creation.
  - SoA export events.
- Prefer structured logging (JSON) to aid future aggregation.
- Ensure logs do not include sensitive personal data beyond what is necessary.


### 7.3 Performance and Scalability

- Design assuming a few dozen to a few hundred documents and risks (no need for heavy optimisation).
- Paginate lists in the UI and API.
- Use database indexes on common query fields (e.g. `nextReviewDate`, `status`, `calculatedScore`, foreign keys).

***

## 8. Configuration and Environment Variables

The AI must define a single configuration module that loads all required settings from environment variables, including (names are indicative):

- `PORT` – backend server port.
- `DATABASE_URL` – connection string for DB.
- `AUTH_TENANT_ID`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `AUTH_REDIRECT_URI`.
- `SHAREPOINT_SITE_ID`, `SHAREPOINT_DRIVE_ID`, etc.
- `CONFLUENCE_BASE_URL`, `CONFLUENCE_API_TOKEN`, `CONFLUENCE_USERNAME` (or service account).
- Any other values needed for SoA export storage location.

Provide a `.env.example` file with all keys and comments.

***

## 9. Testing Strategy

- Unit tests for:
  - Parsing of `annexAControlsRaw` into control codes.
  - Calculation of `calculatedScore`.
  - Role‑based access control decisions.
- API tests for key endpoints (documents, acknowledgments, reviews, risks, controls, SoA export).
- Basic end‑to‑end tests (e.g. using Playwright or Cypress) for:
  - Staff login → view pending docs → Acknowledge All.
  - Admin login → create document → schedule review → complete review → see dashboard update.

Tests must be runnable via a single command, e.g. `npm test`.

***

## 10. Manual Configuration Tasks (Human‑Only)

The AI must not attempt to automate these; instead, it must generate clear setup instructions in the repo’s README.

### 10.1 Entra ID / App Registration

Document steps for the human operator to:

- Create an app registration in Entra ID.
- Configure redirect URI for the frontend.
- Assign required Graph permissions (e.g. `Sites.Read.All` / `Sites.ReadWrite.All`, `Files.Read.All` / `Files.ReadWrite.All`, `User.Read`).
- Grant admin consent.
- Create client secret (if required) and copy IDs/secrets into `.env`.


### 10.2 SharePoint Setup

- Identify or create the SharePoint site and library that will host ISMS documents.
- Obtain site ID, drive ID, and any list IDs needed.
- Configure read permissions (all staff read‑only; admins/editors as needed).
- Configure any SharePoint columns that will be used/mirrored in the app (if any).


### 10.3 Confluence Setup

- Decide which spaces/pages will be used for “living” ISMS records.
- Create an API token and service account (or use a suitable account).
- Configure base URL, username, and token in environment variables.

***

## 11. Deliverables

The AI coding agent must produce:

- Full backend codebase (Node.js/TypeScript) with REST API, DB migrations, and integration stubs for Graph and Confluence.
- Full frontend codebase (React/TypeScript) with implemented screens:
  - Login, document list, acknowledgment view, review dashboard, risk list, control list, SoA export.
- Database schema and migration scripts.
- Automated tests as outlined.
- README including:
  - Setup instructions.
  - Environment configuration.
  - Manual configuration tasks (Section 10).
  - How to run dev, tests, and build/deploy.



<span style="display:none">[^1][^10][^2][^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.softwareseni.com/specification-templates-for-ai-code-generation-from-first-draft-to-production/

[^2]: https://github.blog/ai-and-ml/generative-ai/spec-driven-development-using-markdown-as-a-programming-language-when-building-with-ai/

[^3]: https://blog.bismart.com/en/markdown-ai-training

[^4]: https://dev.to/simbo1905/augmented-intelligence-ai-coding-using-markdown-driven-development-pg5

[^5]: https://gist.github.com/zurawiki/ff47d1b07abebe84d49f9eb5131375f2

[^6]: https://joshuaberkowitz.us/blog/news-1/how-spec-driven-development-with-markdown-and-ai-is-transforming-app-creation-1359

[^7]: https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html

[^8]: https://www.linkedin.com/posts/jessicakerr_the-implementation-is-a-test-of-the-design-activity-7367649800193761281-LzCu

[^9]: https://llmtuts.com/tutorials/makdown-ai-dev-workflow/index.html

[^10]: https://www.reddit.com/r/AI_Agents/comments/1iix4k8/i_built_an_ai_agent_that_creates_readme_file_for/

