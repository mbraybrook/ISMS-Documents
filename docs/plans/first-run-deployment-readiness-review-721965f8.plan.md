<!-- 721965f8-7c92-463b-87fa-a6920f5d3f87 6f6f4d4f-f7d3-4284-b6e2-93f898d63c4f -->
# First-Run Deployment Readiness Review

## Executive Summary

This review assesses the application's readiness for first-run deployment to a live environment. The application has a solid foundation with good seed data structure and database migration support, but several critical gaps exist for production deployment.

## Current State Assessment

### ✅ Strengths

1. **Seed Data Structure**: Well-organized seed data in `backend/prisma/seed-data/` with clear separation:

- Reference data (classifications, asset-categories, controls, legislation, interested-parties)
- Full data (assets, risks, documents, relationships)
- Three-tier scope system: `none`, `reference`, `full`

2. **Database Migration**: Robust Prisma-based migration system with `db:migrate:deploy` for production

3. **Health Check Endpoint**: `/api/health` endpoint exists for orchestration health checks

4. **Configuration Management**: Comprehensive config system in `backend/src/config.ts` with environment variable support

### ❌ Critical Gaps

1. **Missing `.env.example` File**: README references `backend/.env.example` but file doesn't exist
2. **No Production Dockerfiles**: Current Dockerfiles only run development mode (`npm run dev`)
3. **No Production docker-compose**: Only development docker-compose.yml exists
4. **Domain Configuration**: CORS doesn't support wildcard domains (`trust.*.paythru.com`)
5. **Incomplete Production Documentation**: README lacks production deployment section
6. **No Reverse Proxy Configuration**: No nginx/traefik config for production
7. **Frontend Build Configuration**: No production build optimization documented

## Detailed Findings

### 1. Setup Process Documentation

**Current State**: README has good Quick Start for development but no production deployment section.

**Issues**:

- No step-by-step production deployment guide
- Missing production environment setup instructions
- No infrastructure requirements documented
- No deployment checklist

**Required Actions**:

- Add "Production Deployment" section to README
- Document production build process
- Include infrastructure requirements (PostgreSQL, reverse proxy, etc.)
- Create deployment checklist

### 2. Environment Variables Documentation

**Current State**: README mentions `.env.example` but file doesn't exist. All variables are documented in `backend/src/config.ts` but not in a template file.

**Required Environment Variables** (from `backend/src/config.ts`):

- `DATABASE_URL` (required) - PostgreSQL connection string
- `SEED_SCOPE` - `none`|`reference`|`full` (defaults by NODE_ENV)
- `NODE_ENV` - `development`|`staging`|`production`
- `PORT` - Server port (default: 4000)
- `AUTH_TENANT_ID` - Azure AD tenant ID
- `AUTH_CLIENT_ID` - Azure AD client ID
- `AUTH_CLIENT_SECRET` - Azure AD client secret
- `AUTH_REDIRECT_URI` - OAuth redirect URI
- `AUTH_ALLOWED_EMAIL_DOMAIN` - Email domain restriction (default: paythru.com)
- `SHAREPOINT_SITE_ID` - SharePoint site ID
- `SHAREPOINT_DRIVE_ID` - SharePoint drive ID
- `CONFLUENCE_BASE_URL` - Confluence base URL
- `CONFLUENCE_USERNAME` - Confluence username
- `CONFLUENCE_API_TOKEN` - Confluence API token
- `CORS_TRUST_CENTER_ORIGINS` - Comma-separated list of allowed origins
- `TRUST_CENTER_JWT_SECRET` - JWT secret for Trust Centre (min 32 chars)
- `TRUST_CENTER_JWT_EXPIRY` - JWT expiry (default: 24h)
- `TRUST_CENTER_MAX_FILE_SIZE_MB` - Max file size (default: 50)
- `LLM_PROVIDER` - LLM provider (default: ollama)
- `LLM_BASE_URL` - LLM base URL
- `LLM_MODEL` - LLM model name
- `LLM_SIMILARITY_THRESHOLD` - Similarity threshold (default: 70)
- `EMAIL_SMTP_HOST` - SMTP host (optional)
- `EMAIL_SMTP_PORT` - SMTP port (default: 587)
- `EMAIL_SMTP_USER` - SMTP username
- `EMAIL_SMTP_PASS` - SMTP password
- `EMAIL_FROM` - From email address

**Required Actions**:

- Create `backend/.env.example` with all variables and descriptions
- Create `frontend/.env.example` for frontend variables:
- `VITE_API_URL` - Backend API URL
- `VITE_AUTH_TENANT_ID` - Azure AD tenant ID
- `VITE_AUTH_CLIENT_ID` - Azure AD client ID
- `VITE_AUTH_REDIRECT_URI` - OAuth redirect URI

### 3. Seed Data and Catalog Data

**Current State**: ✅ Well-defined and available

**Seed Data Files** (in `backend/prisma/seed-data/`):

- Reference data: `classifications.json`, `asset-categories.json`, `controls.json`, `legislation.json`, `interested-parties.json`
- Full data: `assets.json`, `risks.json`, `documents.json`, `risk-controls.json`, `document-risks.json`, `document-controls.json`, `legislation-risks.json`

**Seed Scope Behavior**:

- `none`: No seeding (production default)
- `reference`: Only reference/catalog data
- `full`: Reference + demo data (development default)

**Recommendation**: For first-run production, use `SEED_SCOPE=reference` to populate catalog data without demo content.

### 4. Domain Configuration

**Current State**: CORS configuration in `backend/src/index.ts` uses `CORS_TRUST_CENTER_ORIGINS` environment variable but doesn't support wildcard patterns.

**Issue**: The domains `https://trust.*.paythru.com` and `https://trust.paythru.com` need explicit configuration. Current implementation requires exact origin matches.

**Current CORS Logic** (from `backend/src/index.ts:30-54`):

- Checks if origin is in `config.cors.trustCenterOrigins` array
- Allows localhost in development
- No wildcard support

**Required Actions**:

- Update CORS logic to support wildcard patterns like `trust.*.paythru.com`
- Or document that all subdomains must be explicitly listed
- Update README with domain configuration instructions

### 5. Production Docker Configuration

**Current State**: Dockerfiles are development-only:

- `backend/Dockerfile`: Runs `npm run dev` (not production build)
- `frontend/Dockerfile`: Runs `npm run dev` (not production build)
- `docker-compose.yml`: Development configuration only

**Required Actions**:

- Create production Dockerfiles:
- Backend: Build TypeScript, run `npm start` (production mode)
- Frontend: Build with Vite, serve static files with nginx or similar
- Create `docker-compose.prod.yml` for production
- Document production build process

### 6. Frontend Production Build

**Current State**: Frontend has build script (`npm run build`) but:

- No production server configuration
- Vite dev server proxy won't work in production
- No static file serving strategy documented

**Required Actions**:

- Document frontend production build process
- Configure production API URL via `VITE_API_URL`
- Set up static file serving (nginx, CDN, etc.)

### 7. Additional Production Considerations

**Missing Components**:

1. **Reverse Proxy Configuration**: No nginx/traefik config for:

- SSL/TLS termination
- Routing frontend/backend
- Load balancing
- Security headers

2. **Database Backup/Restore**: No documentation for:

- Backup procedures
- Restore procedures
- Migration rollback

3. **Monitoring & Logging**: No documentation for:

- Application monitoring
- Error tracking
- Performance metrics
- Log aggregation

4. **Security Hardening**:

- SSL/TLS certificates
- Security headers (helmet is configured but may need tuning)
- Rate limiting (exists but may need production tuning)
- Secrets management

5. **Azure App Registration**: README has good manual steps but needs:

- Production redirect URIs documented
- Required permissions checklist
- Client secret rotation procedure

## Recommendations

### Immediate Actions (Before First Deployment)

1. **Create `.env.example` files** for both backend and frontend
2. **Add Production Deployment section** to README
3. **Update CORS configuration** to support wildcard domains or document explicit configuration
4. **Create production Dockerfiles** and docker-compose.prod.yml
5. **Document production build process** for both frontend and backend

### Short-term Actions (Post-First Deployment)

1. Create reverse proxy configuration (nginx/traefik)
2. Document database backup/restore procedures
3. Set up monitoring and logging
4. Create deployment runbook
5. Document rollback procedures

### Domain Configuration Questions

To fully answer domain support, need to know:

1. Will the application be accessed via `https://trust.paythru.com` only, or also subdomains like `https://trust.staging.paythru.com`?
2. Should CORS support wildcard matching for `trust.*.paythru.com`?
3. What is the production backend API URL? (needed for `VITE_API_URL`)

## Files to Review/Update

- `README.md` - Add production deployment section
- `backend/.env.example` - Create with all variables
- `frontend/.env.example` - Create with frontend variables
- `backend/Dockerfile` - Create production version
- `frontend/Dockerfile` - Create production version
- `docker-compose.prod.yml` - Create production compose file
- `backend/src/index.ts` - Update CORS for wildcard support
- `backend/src/config.ts` - Already comprehensive, may need validation

## Target Environment Questions

To provide complete deployment guidance, need:

1. **Infrastructure**: What platform? (AWS, Azure, on-prem, etc.)
2. **Database**: Managed PostgreSQL or self-hosted?
3. **Reverse Proxy**: nginx, traefik, Azure Application Gateway, etc.?
4. **Container Orchestration**: Docker Compose, Kubernetes, Azure Container Apps, etc.?
5. **Domain Setup**: DNS configuration, SSL certificate management
6. **CI/CD**: Deployment pipeline requirements
7. **Monitoring**: Preferred monitoring/logging solutions

### To-dos

- [ ] Create backend/.env.example and frontend/.env.example with all required variables and descriptions
- [ ] Add comprehensive Production Deployment section to README.md with step-by-step instructions
- [ ] Update CORS configuration in backend/src/index.ts to support wildcard domains (trust.*.paythru.com) or document explicit configuration requirement
- [ ] Create production Dockerfiles for backend and frontend that build and run in production mode
- [ ] Create docker-compose.prod.yml for production deployment with proper configuration
- [ ] Document production build process for both frontend and backend in README