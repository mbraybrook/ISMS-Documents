# ISMS Document Management and Compliance Application

A comprehensive Information Security Management System (ISMS) platform that centralizes document management, risk and control tracking, asset inventory, supplier management, and compliance workflows. The application provides a unified interface for managing all aspects of an organization's ISMS, with optional integrations to Microsoft SharePoint for document storage and Confluence for living documentation.

## Architecture

- **Frontend**: React + TypeScript + Vite + Chakra UI + React Router
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: 
  - Internal users: Entra ID / Microsoft Identity Platform (MSAL)
  - External users (Trust Center): JWT-based email/password authentication
- **AI/LLM Integration**: Ollama for semantic embeddings and similarity analysis
- **External Integrations**: 
  - Microsoft SharePoint (document storage and retrieval)
  - Confluence (living documentation links)
- **Document Processing**: PDF generation, watermarking, and conversion (LibreOffice)
- **Testing**: Jest (backend), Vitest (frontend), Playwright (E2E)

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
   - `AUTH_TENANT_ID`: Azure AD Tenant ID
   - `AUTH_CLIENT_ID`: Azure AD Application (Client) ID
   - `AUTH_CLIENT_SECRET`: Azure AD Client Secret (for backend API calls)
   - `AUTH_REDIRECT_URI`: OAuth redirect URI (e.g., `http://localhost:3000`)
   - `AUTH_ALLOWED_EMAIL_DOMAIN`: Allowed email domain for user registration (default: `paythru.com`)
   
   **Optional environment variables:**
   - `SHAREPOINT_SITE_ID`: SharePoint site ID for document integration
   - `SHAREPOINT_DRIVE_ID`: SharePoint drive/document library ID
   - `CONFLUENCE_BASE_URL`: Confluence base URL (e.g., `https://your-domain.atlassian.net`)
   - `CONFLUENCE_USERNAME`: Confluence API username
   - `CONFLUENCE_API_TOKEN`: Confluence API token
   - `LLM_PROVIDER`: LLM provider (default: `ollama`)
   - `LLM_BASE_URL`: Ollama base URL (default: `http://localhost:11434`)
   - `LLM_EMBEDDING_MODEL`: Embedding model name (default: `nomic-embed-text`)
   - `LLM_CHAT_MODEL`: Chat model name (default: `llama2`)
   - `LLM_SIMILARITY_THRESHOLD`: Similarity threshold for AI suggestions (default: `70`)
   - `TRUST_CENTER_JWT_SECRET`: JWT secret for Trust Center authentication (generate with `openssl rand -base64 32`)
   - `CORS_TRUST_CENTER_ORIGINS`: Comma-separated list of allowed Trust Center origins (supports wildcards)
   - `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASS`, `EMAIL_FROM`: Email service configuration
   
   Example for local development:
   ```bash
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/isms_db?schema=public
   SEED_SCOPE=full
   AUTH_TENANT_ID=your-tenant-id
   AUTH_CLIENT_ID=your-client-id
   AUTH_CLIENT_SECRET=your-client-secret
   AUTH_REDIRECT_URI=http://localhost:3000
   LLM_BASE_URL=http://localhost:11434
   TRUST_CENTER_JWT_SECRET=your-jwt-secret-here
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
   - `AUTH_ALLOWED_EMAIL_DOMAIN`: Allowed email domain for user registration
   - `CORS_TRUST_CENTER_ORIGINS`: Comma-separated origins or wildcard pattern
     - Example: `https://trust.paythru.com,https://trust.*.paythru.com`
     - Wildcard support: `https://trust.*.paythru.com` matches all subdomains
   - `TRUST_CENTER_JWT_SECRET`: Strong random secret (minimum 32 characters)
     - Generate: `openssl rand -base64 32`
   - `LLM_BASE_URL`: Ollama server URL (if using AI features)
   - `LLM_EMBEDDING_MODEL`: Embedding model name
   - `SHAREPOINT_SITE_ID`, `SHAREPOINT_DRIVE_ID`: SharePoint integration (if used)
   - `CONFLUENCE_BASE_URL`, `CONFLUENCE_USERNAME`, `CONFLUENCE_API_TOKEN`: Confluence integration (if used)

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

**AI/Embedding features not working**:
- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check `LLM_BASE_URL` matches your Ollama instance
- Ensure embedding model is pulled: `ollama pull nomic-embed-text`
- Check backend logs for embedding generation errors
- Run embedding backfill scripts if embeddings are missing

**Trust Center authentication errors**:
- Verify `TRUST_CENTER_JWT_SECRET` is set and at least 32 characters
- Check JWT token expiry configuration
- Verify CORS origins include Trust Center domain
- Check external user approval status in admin panel

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
├── backend/              # Express backend
│   ├── src/
│   │   ├── config.ts     # Configuration and environment variables
│   │   ├── index.ts      # Express app entry point
│   │   ├── routes/       # API route handlers
│   │   ├── middleware/   # Express middleware (auth, rate limiting, etc.)
│   │   ├── services/     # Business logic services
│   │   ├── lib/          # Utilities and helpers
│   │   └── types/        # TypeScript type definitions
│   ├── prisma/           # Prisma schema and migrations
│   └── scripts/          # Utility scripts (embeddings, imports, etc.)
├── frontend/             # React frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── contexts/    # React contexts (auth, etc.)
│   │   ├── services/     # API client services
│   │   ├── hooks/        # Custom React hooks
│   │   ├── utils/        # Utility functions
│   │   └── App.tsx       # Main app component
│   └── vite.config.ts    # Vite configuration
├── docs/                  # Documentation and plans
├── e2e/                   # End-to-end tests (Playwright)
├── docker-compose.yml     # Docker Compose for development
└── docker-compose.prod.yml # Docker Compose for production
```

## Code Quality & Linting

### Linting Standards

This project enforces strict code quality standards through ESLint. All code must pass linting checks before being committed.

**Key Rules**:
- **No `any` types**: Use proper TypeScript types or `unknown`
- **No unused variables**: Prefix unused variables/parameters with `_`
- **React Hooks**: All dependencies must be included in `useEffect`, `useCallback`, and `useMemo`
- **Prefer `const`**: Use `const` instead of `let` when variables aren't reassigned
- **Remove unused imports**: Keep imports clean

### Running Linting

```bash
# Strict linting (0 warnings allowed) - for CI/CD
npm run lint

# Check with warnings allowed - for local development
npm run lint:check

# Auto-fix linting issues
npm run lint:fix

# Track warning count over time
npm run lint:track
npm run lint:report
```

### Pre-commit Hook

A pre-commit hook automatically runs ESLint on staged files before each commit:
- **Prevents introducing new warnings** - commits are blocked if staged files have warnings
- Only checks files you're committing (not the entire codebase)
- Works for both frontend and backend files

To bypass (emergency only):
```bash
git commit --no-verify  # Not recommended!
```

### Documentation

- **`.cursorrules`** - Configuration for AI coding tools (Cursor/Composer) to follow linting rules
- **`LINTING_STANDARDS.md`** - Comprehensive guide with examples and best practices
- **`LINTING.md`** - Linting strategy, tools, and warning tracking

### For AI Tools

If you're using AI coding assistants (like Cursor/Composer), they will automatically read `.cursorrules` to understand and follow our linting standards. This ensures generated code passes linting checks from the start.

## Available Scripts

### Root Level
- `npm run dev` - Start both backend and frontend in development mode
- `npm run build` - Build both backend and frontend for production
- `npm run test` - Run tests for both backend and frontend
- `npm run test:e2e` - Run E2E tests with Playwright
- `npm run test:e2e:ui` - Run E2E tests with Playwright UI mode
- `npm run lint` - Lint both backend and frontend (strict - 0 warnings)
- `npm run lint:check` - Lint with warnings allowed (for tracking)
- `npm run lint:fix` - Auto-fix linting issues
- `npm run lint:track` - Record current warning count
- `npm run lint:report` - Show warning reduction progress

### Backend
- `npm run dev --workspace=backend` - Start backend dev server
- `npm run build --workspace=backend` - Build backend
- `npm run db:migrate --workspace=backend` - Run database migrations (development)
- `npm run db:migrate:deploy --workspace=backend` - Deploy migrations (production/staging)
- `npm run db:generate --workspace=backend` - Generate Prisma client
- `npm run db:seed --workspace=backend` - Seed database with initial data
- `npm run db:studio --workspace=backend` - Open Prisma Studio
- `npm run backfill-embeddings --workspace=backend` - Backfill embeddings for risks
- `npm run backfill-control-embeddings --workspace=backend` - Backfill embeddings for controls
- `npm run check-control-embeddings --workspace=backend` - Check embedding status for controls

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

### 4. Ollama Setup (for AI Features)

The application uses Ollama for semantic embeddings and similarity analysis. This enables AI-powered control suggestions for risks and documents.

1. **Install Ollama**:
   - Visit https://ollama.ai and install Ollama for your platform
   - Or use Docker: `docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama`

2. **Pull the embedding model**:
   ```bash
   ollama pull nomic-embed-text
   ```

3. **Verify Ollama is running**:
   ```bash
   curl http://localhost:11434/api/tags
   ```

4. **Configure in `.env`** (optional, defaults shown):
   ```
   LLM_PROVIDER=ollama
   LLM_BASE_URL=http://localhost:11434
   LLM_EMBEDDING_MODEL=nomic-embed-text
   LLM_CHAT_MODEL=llama2
   LLM_SIMILARITY_THRESHOLD=70
   ```

5. **Backfill embeddings** (after initial setup):
   ```bash
   cd backend
   npm run backfill-control-embeddings
   npm run backfill-embeddings  # For risks
   ```

**Note**: AI features are optional. The application will work without Ollama, but control/risk suggestions will be disabled.

### 5. Trust Center Setup

The Trust Center module allows external users to access selected documents. It uses separate authentication from the main application.

1. **Generate JWT Secret**:
   ```bash
   openssl rand -base64 32
   ```

2. **Add to `.env`**:
   ```
   TRUST_CENTER_JWT_SECRET=your-generated-secret-here
   TRUST_CENTER_JWT_EXPIRY=24h
   TRUST_CENTER_MAX_FILE_SIZE_MB=50
   CORS_TRUST_CENTER_ORIGINS=http://localhost:3000,https://trust.paythru.com
   ```

3. **Configure document visibility**:
   - Use the Trust Center Admin page to configure which documents are public/private
   - Set document categories (certification, policy, report)
   - Configure NDA requirements per document

4. **User approval workflow**:
   - External users register via the Trust Center
   - Admins approve/deny users via the Trust Center Admin page
   - Approved users can access private documents after accepting terms

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
- **Phase 11**: Additional Entities (Assets, Asset Categories, Interested Parties, Legislation, Suppliers) ✅
- **Phase 12**: AI-Powered Features (Semantic Search, Control/Risk Suggestions) ✅
- **Phase 13**: Trust Center Module (Public Document Access) ✅
- **Phase 14**: Mass Import Functionality ✅

## Key Features

### Core Document Management
- Document CRUD operations with versioning
- Document classification and status tracking
- Review scheduling and workflow
- Acknowledgment tracking for staff
- Document linking to SharePoint and Confluence
- Bulk document import from SharePoint
- PDF generation, watermarking, and conversion

### Risk & Control Management
- Risk register with scoring and categorization
- ISO 27002:2022 control library
- Risk-control associations
- Control applicability and implementation tracking
- AI-powered control suggestions for risks and documents (semantic similarity)
- Risk import from CSV

### Additional Entities
- **Assets**: IT asset inventory with classifications
- **Asset Categories**: Categorization of assets
- **Interested Parties**: Stakeholder management with requirements tracking
- **Legislation**: Legal and regulatory requirements tracking
- **Suppliers**: Third-party supplier management with risk and control links
- **Supplier Exit Plans**: Exit strategy documentation
- **Classifications**: Data classification scheme

### AI/LLM Features
- **Semantic Search**: Vector embeddings for intelligent document and control matching
- **Control Suggestions**: AI-powered suggestions for linking controls to risks and documents
- **Risk Suggestions**: Semantic similarity matching for supplier-risk associations
- Uses Ollama for local LLM inference (embeddings and similarity analysis)
- Pre-computed embeddings for controls and risks for fast similarity queries

### Trust Center (Public-Facing Module)
- Public document portal for external users
- Email/password authentication (separate from internal Entra ID auth)
- Document visibility controls (public/private)
- NDA/terms acceptance workflow
- Document download with watermarking
- Audit logging for compliance
- Admin interface for user approval and document management
- Supplier information display

### Dashboards & Reporting
- Executive dashboard with key metrics
- Review dashboard for scheduled reviews
- Acknowledgment statistics
- Statement of Applicability (SoA) Excel export
- Risk and control analytics

### Mass Import
- Bulk import documents from SharePoint
- CSV import for risks, assets, interested parties, and legislation
- Progress tracking and error reporting
- Automatic embedding computation for imported risks

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
- `POST /api/documents/bulk-import` - Bulk import documents from SharePoint (Admin/Editor only)
- `POST /api/documents/:id/suggest-controls` - AI-powered control suggestions for document (Admin/Editor only)
- `GET /api/documents/:id/download` - Download document (with conversion/watermarking)

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
- `GET /api/risks` - List risks with filtering and search
- `POST /api/risks` - Create risk (Admin/Editor/Contributor)
- `GET /api/risks/:id` - Get risk details
- `PUT /api/risks/:id` - Update risk (Admin/Editor only)
- `DELETE /api/risks/:id` - Archive risk (Admin/Editor only)
- `POST /api/risks/:id/controls` - Set risk-control associations (Admin/Editor only)
- `POST /api/risks/suggest-controls` - AI-powered control suggestions for risk (Admin/Editor only)
- `POST /api/risks/import` - Import risks from CSV (Admin/Editor only)

### Controls
- `GET /api/controls` - List controls with filtering
- `POST /api/controls` - Create control (Admin/Editor only)
- `GET /api/controls/:id` - Get control details
- `PUT /api/controls/:id` - Update control (Admin/Editor only)
- `GET /api/controls/:id/links` - Get linked risks and documents

### Assets
- `GET /api/assets` - List assets with filtering and search
- `POST /api/assets` - Create asset (Admin/Editor only)
- `GET /api/assets/:id` - Get asset details
- `PUT /api/assets/:id` - Update asset (Admin/Editor only)
- `DELETE /api/assets/:id` - Delete asset (Admin/Editor only)
- `POST /api/assets/import` - Import assets from CSV (Admin/Editor only)

### Asset Categories
- `GET /api/asset-categories` - List asset categories
- `POST /api/asset-categories` - Create asset category (Admin/Editor only)
- `GET /api/asset-categories/:id` - Get asset category details
- `PUT /api/asset-categories/:id` - Update asset category (Admin/Editor only)
- `DELETE /api/asset-categories/:id` - Delete asset category (Admin/Editor only)

### Interested Parties
- `GET /api/interested-parties` - List interested parties
- `POST /api/interested-parties` - Create interested party (Admin/Editor only)
- `GET /api/interested-parties/:id` - Get interested party details
- `PUT /api/interested-parties/:id` - Update interested party (Admin/Editor only)
- `DELETE /api/interested-parties/:id` - Delete interested party (Admin/Editor only)
- `POST /api/interested-parties/import` - Import interested parties from CSV (Admin/Editor only)

### Legislation
- `GET /api/legislation` - List legislation
- `POST /api/legislation` - Create legislation (Admin/Editor only)
- `GET /api/legislation/:id` - Get legislation details
- `PUT /api/legislation/:id` - Update legislation (Admin/Editor only)
- `DELETE /api/legislation/:id` - Delete legislation (Admin/Editor only)
- `POST /api/legislation/import` - Import legislation from CSV (Admin/Editor only)

### Suppliers
- `GET /api/suppliers` - List suppliers with filtering and search
- `POST /api/suppliers` - Create supplier (Admin/Editor only)
- `GET /api/suppliers/:id` - Get supplier details
- `PUT /api/suppliers/:id` - Update supplier (Admin/Editor only)
- `DELETE /api/suppliers/:id` - Delete supplier (Admin/Editor only)
- `POST /api/suppliers/:id/risks` - Link risks to supplier (Admin/Editor only)
- `POST /api/suppliers/:id/controls` - Link controls to supplier (Admin/Editor only)
- `GET /api/suppliers/:id/suggest-risks` - AI-powered risk suggestions for supplier (Admin/Editor only)

### Supplier Exit Plans
- `GET /api/suppliers/:supplierId/exit-plans` - List exit plans for supplier
- `POST /api/suppliers/:supplierId/exit-plans` - Create exit plan (Admin/Editor only)
- `PUT /api/suppliers/:supplierId/exit-plans/:id` - Update exit plan (Admin/Editor only)
- `DELETE /api/suppliers/:supplierId/exit-plans/:id` - Delete exit plan (Admin/Editor only)

### Classifications
- `GET /api/classifications` - List data classifications
- `POST /api/classifications` - Create classification (Admin/Editor only)
- `PUT /api/classifications/:id` - Update classification (Admin/Editor only)
- `DELETE /api/classifications/:id` - Delete classification (Admin/Editor only)

### Users
- `GET /api/users` - List users (Admin only)
- `GET /api/users/:id` - Get user details (Admin only)
- `PUT /api/users/:id` - Update user (Admin only)
- `PUT /api/users/:id/role` - Update user role (Admin only)

### Dashboard
- `GET /api/dashboard` - Get executive dashboard data (Admin/Editor only)

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

### Trust Center (Public API)
- `POST /api/trust/auth/register` - Register external user
- `POST /api/trust/auth/login` - Login external user
- `POST /api/trust/auth/logout` - Logout external user
- `GET /api/trust/auth/me` - Get current external user
- `POST /api/trust/auth/forgot-password` - Request password reset
- `POST /api/trust/auth/reset-password` - Reset password with token
- `GET /api/trust/documents` - Get public/private documents (grouped by category)
- `GET /api/trust/documents/:id/download` - Download document (with watermarking)
- `POST /api/trust/documents/:id/accept-terms` - Accept NDA/terms for document
- `GET /api/trust/suppliers` - Get public supplier information

### Trust Center Admin (Internal API)
- `GET /api/trust/admin/users` - List external users (Admin only)
- `PUT /api/trust/admin/users/:id/approve` - Approve external user (Admin only)
- `PUT /api/trust/admin/users/:id/deny` - Deny external user (Admin only)
- `GET /api/trust/admin/document-settings` - Get all document settings (Admin only)
- `PUT /api/trust/admin/document-settings/:docId` - Update document settings (Admin only)
- `GET /api/trust/admin/audit-log` - Get audit log (Admin only)

## License

Private - Internal Use Only

