# ISMS Document Management and Compliance Application

A web application that provides a "single pane of glass" over an organisation's ISMS documentation stored primarily in Microsoft SharePoint, with links to selected Confluence content.

## Architecture

- **Frontend**: React + TypeScript + Vite + Chakra UI
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Entra ID / Microsoft Identity Platform (MSAL)

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn
- Docker and Docker Compose (for containerized development)

## Quick Start

### Local Development (without Docker)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your configuration
   ```
   
   **Required environment variables:**
   - `DATABASE_URL`: PostgreSQL connection string (format: `postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public`)
   - `SEED_SCOPE`: Controls seed data (`"full"` for local dev, `"reference"` for staging, `"none"` for production)
   
   Example for local development:
   ```bash
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/isms_db?schema=public
   SEED_SCOPE=full
   ```

3. **Set up database:**
   
   **Option A: Using Docker Compose (Recommended)**
   ```bash
   # From root directory
   docker compose up -d postgres
   ```
   
   **Option B: Using local PostgreSQL**
   - Install PostgreSQL locally
   - Create database: `createdb isms_db`
   - Update `DATABASE_URL` in `.env` to point to your local instance
   
   **Run migrations:**
   ```bash
   cd backend
   npm run db:generate
   npm run db:migrate:deploy
   ```
   
   **Seed database (optional):**
   ```bash
   npm run db:seed
   ```
   
   Note: For development, you can also use:
   ```bash
   npm run db:migrate -- --name descriptive-migration-name
   ```

4. **Start development servers:**
   ```bash
   # From root directory
   npm run dev
   ```

   This will start:
   - Backend API on http://localhost:4000
   - Frontend on http://localhost:3000

### Docker Development

1. **Build and start services:**
   ```bash
   docker compose up
   ```
   
   To run in detached mode (background):
   ```bash
   docker compose up -d
   ```

2. **Stop services:**
   ```bash
   docker compose down
   ```

3. **View logs:**
   ```bash
   docker compose logs -f
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000

**Note**: Use `docker compose` (without hyphen) for Docker Compose V2. For older installations, you may need `docker-compose` (with hyphen).

## Project Structure

```
.
├── backend/          # Express backend
│   ├── src/
│   │   ├── config.ts
│   │   ├── index.ts
│   │   ├── routes/
│   │   └── middleware/
│   └── prisma/       # Prisma schema and migrations
├── frontend/         # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.tsx
│   └── vite.config.ts
├── docs/             # Documentation
└── docker-compose.yml
```

## Available Scripts

### Root Level
- `npm run dev` - Start both backend and frontend in development mode
- `npm run build` - Build both backend and frontend for production
- `npm run test` - Run tests for both backend and frontend
- `npm run test:e2e` - Run E2E tests with Playwright
- `npm run test:e2e:ui` - Run E2E tests with Playwright UI mode
- `npm run lint` - Lint both backend and frontend

### Backend
- `npm run dev --workspace=backend` - Start backend dev server
- `npm run build --workspace=backend` - Build backend
- `npm run db:migrate --workspace=backend` - Run database migrations (development)
- `npm run db:migrate:deploy --workspace=backend` - Deploy migrations (production/staging)
- `npm run db:generate --workspace=backend` - Generate Prisma client
- `npm run db:seed --workspace=backend` - Seed database with initial data
- `npm run db:studio --workspace=backend` - Open Prisma Studio

### Frontend
- `npm run dev --workspace=frontend` - Start frontend dev server
- `npm run build --workspace=frontend` - Build frontend
- `npm run preview --workspace=frontend` - Preview production build

## Manual Configuration Tasks

### 1. Entra ID / App Registration

**Note**: These steps must be performed manually in the Azure Portal.

1. Create an app registration in Entra ID (Azure Portal)
2. **Configure Authentication Platform:**
   - Go to **Authentication** in the left menu
   - Click **Add a platform**
   - Select **Single-page application**
   - Add redirect URI: `http://localhost:3000` (for local development)
   - Click **Configure**
   - **Important**: The platform type must be "Single-page application" (SPA), not "Web", for MSAL popup/redirect flows to work
3. Assign required Graph permissions:
   - Go to **API permissions**
   - Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
   - Add the following:
     - `Sites.Read.All` or `Sites.ReadWrite.All`
     - `Files.Read.All` or `Files.ReadWrite.All`
     - `User.Read`
   - Click **Add permissions**
4. Grant admin consent for the permissions (click **Grant admin consent for [Your Organization]**)
5. Create a client secret (if required for backend):
   - Go to **Certificates & secrets**
   - Click **New client secret**
   - Add description and expiration
   - Copy the secret value immediately (it won't be shown again)
6. Copy the following values to your `.env` file:
   - **Tenant ID**: Found in **Overview** → Directory (tenant) ID
   - **Client ID**: Found in **Overview** → Application (client) ID
   - **Client Secret**: The value you copied in step 5 (if created)
   - **Redirect URI**: `http://localhost:3000`

### 2. SharePoint Setup

1. Identify or create the SharePoint site and library that will host ISMS documents
2. Obtain the following IDs:
   - Site ID
   - Drive ID (document library ID)
3. Configure read permissions:
   - All staff: read-only
   - Admins/Editors: as needed
4. Add the following to your `.env` file:
   ```
   SHAREPOINT_SITE_ID=your-site-id
   SHAREPOINT_DRIVE_ID=your-drive-id
   ```

### 3. Confluence Setup

1. Decide which spaces/pages will be used for "living" ISMS records
2. Create an API token:
   - Go to Account Settings → Security → API tokens
   - Create a new API token
3. Add the following to your `.env` file:
   ```
   CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
   CONFLUENCE_USERNAME=your-username
   CONFLUENCE_API_TOKEN=your-api-token
   ```

## Development Phases

This project is being built in phases:

- **Phase 1**: Foundation & Project Setup ✅
- **Phase 2**: Authentication & User Management ✅
- **Phase 3**: Core Data Models & Database Schema ✅
- **Phase 4**: Document Management - Core CRUD ✅
- **Phase 5**: Acknowledgment Workflow ✅
- **Phase 6**: Review Scheduling & Dashboards ✅
- **Phase 7**: Risk & Control Management ✅
- **Phase 8**: Statement of Applicability (SoA) Export ✅
- **Phase 9**: External Integrations (SharePoint, Confluence) ✅
- **Phase 10**: Testing, Documentation & Polish ✅

## API Endpoints

### Health Check
- `GET /api/health` - Health check endpoint

### Authentication
- `POST /api/auth/sync` - Sync/create user from token
- `GET /api/auth/me` - Get current user profile

### Documents
- `GET /api/documents` - List documents with filtering
- `POST /api/documents` - Create document (Admin/Editor only)
- `GET /api/documents/:id` - Get document details
- `PUT /api/documents/:id` - Update document (Admin/Editor only)
- `DELETE /api/documents/:id` - Soft delete document (Admin/Editor only)

### Acknowledgments
- `GET /api/acknowledgments/pending` - Get pending documents for current user
- `POST /api/acknowledgments/bulk` - Bulk acknowledge documents
- `POST /api/acknowledgments` - Single document acknowledgment
- `GET /api/acknowledgments/stats` - Acknowledgment statistics (Admin/Editor only)

### Reviews
- `GET /api/reviews/dashboard` - Review dashboard data
- `POST /api/reviews` - Create review task (Admin/Editor only)
- `PUT /api/reviews/:id/complete` - Complete review (Admin/Editor only)
- `GET /api/reviews/document/:documentId` - Review history for document

### Risks
- `GET /api/risks` - List risks
- `POST /api/risks` - Create risk (Admin/Editor only)
- `GET /api/risks/:id` - Get risk details
- `PUT /api/risks/:id` - Update risk (Admin/Editor only)
- `POST /api/risks/:id/controls` - Set risk-control associations (Admin/Editor only)

### Controls
- `GET /api/controls` - List controls
- `POST /api/controls` - Create control (Admin/Editor only)
- `GET /api/controls/:id` - Get control details
- `PUT /api/controls/:id` - Update control (Admin/Editor only)
- `GET /api/controls/:id/links` - Get linked risks and documents

### SoA Export
- `POST /api/soa/export` - Generate SoA Excel export (Admin/Editor only)
- `GET /api/soa/exports` - List previous exports (Admin/Editor only)

### SharePoint Integration
- `GET /api/sharepoint/items` - List SharePoint items (Admin/Editor only)
- `GET /api/sharepoint/items/:itemId` - Get SharePoint item metadata
- `GET /api/sharepoint/url` - Generate SharePoint URL

### Confluence Integration
- `GET /api/confluence/pages` - List Confluence pages (Admin/Editor only)
- `GET /api/confluence/pages/:pageId` - Get Confluence page metadata
- `GET /api/confluence/url` - Generate Confluence URL

## License

Private - Internal Use Only

