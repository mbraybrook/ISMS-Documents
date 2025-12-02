# ISMS Document Management and Compliance Application

[![Tests](https://github.com/mbraybrook/ISMS-Documentation/workflows/Tests/badge.svg)](https://github.com/mbraybrook/ISMS-Documentation/actions)
[![Coverage](https://codecov.io/gh/mbraybrook/ISMS-Documentation/branch/main/graph/badge.svg)](https://codecov.io/gh/mbraybrook/ISMS-Documentation)

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

## Production Deployment

### Prerequisites

- Node.js 18+ (LTS recommended) for build tools
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL 15+ database (managed service or self-hosted)
- Azure App Registration configured with production redirect URIs
- Domain configured with SSL/TLS certificates
- Reverse proxy (nginx, traefik, or cloud load balancer) recommended

### Infrastructure Requirements

1. **Database**: PostgreSQL 15+ with:
   - Persistent storage
   - Backup strategy configured
   - Connection pooling enabled (recommended: 10-20 connections)

2. **Application Servers**: 
   - Backend: Node.js 18+ runtime
   - Frontend: Static file serving (nginx or CDN)

3. **Network**:
   - Backend API accessible from frontend
   - Database accessible from backend
   - HTTPS/SSL termination (reverse proxy or load balancer)

### Step 1: Environment Configuration

1. **Backend Environment Variables**:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with production values
   ```

   **Required variables for production**:
   - `DATABASE_URL`: PostgreSQL connection string
   - `NODE_ENV=production`
   - `SEED_SCOPE=reference` (for first-run) or `none` (subsequent deployments)
   - `AUTH_TENANT_ID`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`
   - `AUTH_REDIRECT_URI`: Production URL (e.g., `https://trust.paythru.com`)
   - `CORS_TRUST_CENTER_ORIGINS`: Comma-separated origins or wildcard pattern
     - Example: `https://trust.paythru.com,https://trust.*.paythru.com`
     - Wildcard support: `https://trust.*.paythru.com` matches all subdomains
   - `TRUST_CENTER_JWT_SECRET`: Strong random secret (minimum 32 characters)
     - Generate: `openssl rand -base64 32`

   See `backend/.env.example` for complete list of variables.

2. **Frontend Environment Variables**:
   ```bash
   cd frontend
   cp .env.example .env
   # Edit .env with production values
   ```

   **Required variables**:
   - `VITE_API_URL`: Backend API URL (e.g., `https://api.trust.paythru.com`)
   - `VITE_AUTH_TENANT_ID`: Must match backend `AUTH_TENANT_ID`
   - `VITE_AUTH_CLIENT_ID`: Must match backend `AUTH_CLIENT_ID`
   - `VITE_AUTH_REDIRECT_URI`: Production URL (e.g., `https://trust.paythru.com`)

   **Important**: Frontend environment variables are baked into the build at build time. They cannot be changed after the build without rebuilding.

### Step 2: Database Setup

1. **Create Database**:
   ```sql
   CREATE DATABASE isms_production;
   ```

2. **Run Migrations**:
   ```bash
   cd backend
   npm install
   npm run db:generate
   npm run db:migrate:deploy
   ```

3. **Seed Reference Data (First Run Only)**:
   ```bash
   # Seed catalog/reference data (classifications, controls, legislation, etc.)
   SEED_SCOPE=reference npm run db:seed
   ```

   **Note**: 
   - Use `SEED_SCOPE=reference` for first-run production to populate catalog data
   - Use `SEED_SCOPE=none` for subsequent deployments (default in production)

### Step 3: Build Production Images

#### Option A: Using Docker Compose (Recommended)

```bash
# Build production images
docker compose -f docker-compose.prod.yml build

# Or build specific service
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml build frontend
```

#### Option B: Manual Docker Build

**Backend**:
```bash
cd backend
docker build -f Dockerfile.prod -t isms-backend:latest .
```

**Frontend**:
```bash
cd frontend
docker build -f Dockerfile.prod \
  --build-arg VITE_API_URL=https://api.trust.paythru.com \
  --build-arg VITE_AUTH_TENANT_ID=your-tenant-id \
  --build-arg VITE_AUTH_CLIENT_ID=your-client-id \
  --build-arg VITE_AUTH_REDIRECT_URI=https://trust.paythru.com \
  -t isms-frontend:latest .
```

### Step 4: Deploy with Docker Compose

1. **Ensure environment variables are set** in `backend/.env` and `frontend/.env`

2. **Start services**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

3. **Check logs**:
   ```bash
   docker compose -f docker-compose.prod.yml logs -f
   ```

4. **Verify health**:
   ```bash
   # Backend health check
   curl http://localhost:4000/api/health
   
   # Frontend health check
   curl http://localhost:3000/health
   ```

### Step 5: Configure Reverse Proxy

The application expects a reverse proxy (nginx, traefik, or cloud load balancer) for:
- SSL/TLS termination
- Routing `/api/*` to backend
- Routing all other requests to frontend
- Security headers

**Example nginx configuration**:
```nginx
server {
    listen 443 ssl http2;
    server_name trust.paythru.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Backend API
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Step 6: Azure App Registration Configuration

1. **Add Production Redirect URIs**:
   - Go to Azure Portal → App Registrations → Your App
   - Authentication → Add platform → Single-page application
   - Add redirect URI: `https://trust.paythru.com` (or your production domain)
   - Add any subdomain redirect URIs if needed

2. **Verify API Permissions**:
   - Microsoft Graph → Delegated permissions:
     - `Sites.Read.All` or `Sites.ReadWrite.All`
     - `Files.Read.All` or `Files.ReadWrite.All`
     - `User.Read`
   - Ensure admin consent is granted

3. **Client Secret**:
   - Ensure client secret is valid and not expired
   - Update `AUTH_CLIENT_SECRET` in backend `.env` if rotated

### Step 7: Domain Configuration

The application supports wildcard CORS patterns. Configure `CORS_TRUST_CENTER_ORIGINS` in `backend/.env`:

**Option 1: Explicit domains**:
```
CORS_TRUST_CENTER_ORIGINS=https://trust.paythru.com,https://trust.staging.paythru.com
```

**Option 2: Wildcard pattern**:
```
CORS_TRUST_CENTER_ORIGINS=https://trust.*.paythru.com
```

This will allow all subdomains matching `trust.*.paythru.com` (e.g., `trust.staging.paythru.com`, `trust.dev.paythru.com`).

### Production Build Process

#### Backend Build

The backend uses a multi-stage Docker build:

1. **Builder stage**:
   - Installs all dependencies (including dev dependencies)
   - Generates Prisma Client
   - Compiles TypeScript to JavaScript

2. **Production stage**:
   - Installs only production dependencies
   - Copies built files and Prisma Client
   - Runs as non-root user for security
   - Starts with `npm start` (runs `node dist/index.js`)

**Build command**:
```bash
cd backend
docker build -f Dockerfile.prod -t isms-backend:latest .
```

#### Frontend Build

The frontend uses a multi-stage Docker build:

1. **Builder stage**:
   - Installs dependencies
   - Builds with Vite (environment variables baked in)
   - Outputs optimized static files

2. **Production stage**:
   - Uses nginx to serve static files
   - Includes security headers
   - Enables gzip compression
   - Configures caching for static assets

**Build command**:
```bash
cd frontend
docker build -f Dockerfile.prod \
  --build-arg VITE_API_URL=https://api.trust.paythru.com \
  --build-arg VITE_AUTH_TENANT_ID=your-tenant-id \
  --build-arg VITE_AUTH_CLIENT_ID=your-client-id \
  --build-arg VITE_AUTH_REDIRECT_URI=https://trust.paythru.com \
  -t isms-frontend:latest .
```

**Important**: Frontend environment variables must be provided at build time. They cannot be changed after the build.

### Deployment Checklist

Before deploying to production:

- [ ] Database created and accessible
- [ ] Database migrations run successfully
- [ ] Reference data seeded (first-run only)
- [ ] Backend `.env` configured with all required variables
- [ ] Frontend `.env` configured with all required variables
- [ ] `TRUST_CENTER_JWT_SECRET` is strong and secure (32+ characters)
- [ ] `CORS_TRUST_CENTER_ORIGINS` configured for production domains
- [ ] Azure App Registration has production redirect URIs
- [ ] Azure App Registration permissions granted and consented
- [ ] Client secret is valid and not expired
- [ ] SSL/TLS certificates configured
- [ ] Reverse proxy configured
- [ ] Health check endpoints accessible
- [ ] Logging and monitoring configured
- [ ] Backup strategy in place

### Post-Deployment Verification

1. **Health Checks**:
   ```bash
   # Backend
   curl https://trust.paythru.com/api/health
   
   # Frontend
   curl https://trust.paythru.com/health
   ```

2. **Authentication**:
   - Verify login flow works
   - Check user sync from Azure AD
   - Verify role assignment

3. **API Endpoints**:
   - Test key endpoints (documents, risks, controls)
   - Verify permissions and authorization

4. **Database**:
   - Verify connection pooling
   - Check query performance
   - Monitor connection count

### Troubleshooting

**Backend won't start**:
- Check database connectivity
- Verify `DATABASE_URL` format
- Check Prisma Client generation
- Review logs: `docker compose -f docker-compose.prod.yml logs backend`

**Frontend shows API errors**:
- Verify `VITE_API_URL` matches backend URL
- Check CORS configuration
- Verify reverse proxy routing

**CORS errors**:
- Verify `CORS_TRUST_CENTER_ORIGINS` includes exact origin
- Check wildcard pattern syntax
- Ensure origin includes protocol (https://)

**Database connection errors**:
- Verify `DATABASE_URL` format: `postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public`
- Check network connectivity
- Verify database credentials
- Check firewall rules

### Rollback Procedure

1. **Stop current deployment**:
   ```bash
   docker compose -f docker-compose.prod.yml down
   ```

2. **Restore previous images** (if using image tags):
   ```bash
   docker compose -f docker-compose.prod.yml pull
   docker compose -f docker-compose.prod.yml up -d
   ```

3. **Database rollback** (if needed):
   - Restore from backup
   - Or revert specific migrations (not recommended in production)

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

