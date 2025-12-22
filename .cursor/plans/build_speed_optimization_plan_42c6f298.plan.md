---
name: Build Speed Optimization Plan
overview: Comprehensive plan to optimize build and deployment times through microservices separation, Docker build optimizations, and deployment process improvements.
todos:
  - id: docker-buildkit-optimizations
    content: Add BuildKit cache mounts to backend and frontend Dockerfiles to cache npm dependencies and Prisma Client generation
    status: completed
  - id: dockerignore-files
    content: Create .dockerignore files for backend and frontend to exclude unnecessary files from build context
    status: completed
  - id: npm-ci-migration
    content: Update Dockerfiles to use npm ci instead of npm install for reproducible builds
    status: completed
  - id: document-service-structure
    content: Create document-service structure (package.json, tsconfig.json, src/index.ts, middleware/authInternal.ts, routes/documentRoutes.ts)
    status: completed
    dependencies:
      - docker-buildkit-optimizations
  - id: document-service-services
    content: Copy and adapt documentConversionService.ts, watermarkService.ts, pdfCacheService.ts to document-service (remove DB dependencies)
    status: completed
    dependencies:
      - document-service-structure
  - id: document-service-dockerfile
    content: Create Dockerfile for document-service with multi-stage build, LibreOffice, and BuildKit cache mounts
    status: completed
    dependencies:
      - document-service-services
  - id: ai-service-structure
    content: Create ai-service structure (package.json, tsconfig.json, src/index.ts, middleware/authInternal.ts, routes/aiRoutes.ts)
    status: completed
    dependencies:
      - docker-buildkit-optimizations
  - id: ai-service-services
    content: Copy and adapt llmService.ts to ai-service (remove DB dependencies, keep core LLM functions)
    status: completed
    dependencies:
      - ai-service-structure
  - id: ai-service-dockerfile
    content: Create Dockerfile for ai-service with multi-stage build and BuildKit cache mounts (no LibreOffice)
    status: completed
    dependencies:
      - ai-service-services
  - id: backend-config-clients
    content: Add documentService and aiService config to backend/src/config.ts, create documentServiceClient.ts and aiServiceClient.ts with retry logic
    status: completed
    dependencies:
      - document-service-services
      - ai-service-services
  - id: backend-route-updates
    content: Update backend routes (trust/index.ts, documents.ts, risks.ts, embeddingService.ts) to use HTTP clients instead of direct service imports
    status: completed
    dependencies:
      - backend-config-clients
  - id: infrastructure-templates
    content: Create CloudFormation templates (document-service-ecs.yaml, ai-service-ecs.yaml) with ECS task definitions, service discovery, and EFS volumes
    status: completed
    dependencies:
      - document-service-dockerfile
      - ai-service-dockerfile
  - id: backend-env-updates
    content: Update backend ECS task definition to include DOCUMENT_SERVICE_URL, AI_SERVICE_URL, INTERNAL_SERVICE_TOKEN environment variables
    status: completed
    dependencies:
      - infrastructure-templates
  - id: deployment-scripts
    content: Update deployment scripts to support parallel builds, selective service deployment, and build time tracking
    status: completed
    dependencies:
      - infrastructure-templates
  - id: health-checks-monitoring
    content: Ensure all services expose /health endpoints, wire ECS health checks, add service-level metrics/logging
    status: completed
    dependencies:
      - infrastructure-templates
---

# Build Speed Optimization Plan

## Current Bottlenecks Analysis

### Backend Build Issues

1. **LibreOffice Installation** (~200MB+, slow): Required for document conversion
2. **Font Packages**: Multiple large font packages (ttf-dejavu, ttf-liberation, font-noto, etc.)
3. **Dependency Installation**: Full npm install including dev dependencies in builder stage
4. **Prisma Client Generation**: Runs on every build
5. **TypeScript Compilation**: Compiles entire codebase even for small changes

### Frontend Build Issues

1. **Dependency Installation**: npm ci installs all dependencies
2. **TypeScript Compilation**: Full type checking
3. **Vite Build**: Bundles entire application

## Strategy 1: Microservices Separation (Highest Impact)

### 1.1 Document Processing Service

**Extract**: Document conversion, watermarking, PDF generation, PDF caching**Rationale**:

- LibreOffice is the heaviest dependency (~200MB+)
- Document processing is infrequently used compared to core API
- Can scale independently
- Reduces main backend image size significantly

**Implementation Structure**:**Folder**: `services/document-service/`**Files to Create**:

1. **`services/document-service/package.json`**

- Name: `@app/document-service`
- Scripts: `start`, `dev`, `build`
- Dependencies: express, axios, pdf-lib, libreoffice-convert, etc.

2. **`services/document-service/tsconfig.json`**

- Standard Node/Express TS config
- `outDir: "dist"`, `rootDir: "src"`

3. **`services/document-service/src/index.ts`**

- Express bootstrap
- Reads env: `PORT` (default 4001), `INTERNAL_SERVICE_TOKEN`, `CACHE_DIR` (e.g. /cache)
- Registers JSON body parsing and `authInternal` middleware for `/v1/*`
- Mounts `documentRoutes`
- Adds `GET /health` → `{ status: 'ok', service: 'document-service' }`

4. **`services/document-service/src/middleware/authInternal.ts`**

- Reads `X-Internal-Service-Token` header
- Compares to `process.env.INTERNAL_SERVICE_TOKEN`
- Returns 401 with `{ error: 'unauthorized', code: 'INTERNAL_TOKEN_INVALID' }` on mismatch

5. **`services/document-service/src/routes/documentRoutes.ts`**

- `POST /v1/convert` - Convert document to PDF
- `POST /v1/watermark` - Add watermark to PDF
- `GET /v1/cache/:cacheKey` - Get cached PDF
- `POST /v1/cache` - Store cached PDF
- `DELETE /v1/cache/:documentId` - Invalidate cache
- All handlers accept/return base64-encoded buffers in JSON
- All errors normalized to `{ error, code?, details? }`

6. **`services/document-service/src/services/documentConversionService.ts`**

- Copy from `backend/src/services/documentConversionService.ts`
- Remove any DB dependencies
- Export: `convertToPdf(buffer, mimeType, filename)` → `Buffer`

7. **`services/document-service/src/services/watermarkService.ts`**

- Copy from `backend/src/services/watermarkService.ts`
- Remove DB access for trustCenterSettings
- Accept `watermarkPrefix` as argument instead
- Export: `addWatermarkToPdf(pdfBuffer, options)` where options includes `watermarkPrefix`, `userEmail`, `date`, etc.

8. **`services/document-service/src/services/pdfCacheService.ts`**

- Copy from `backend/src/services/pdfCacheService.ts`
- Implement filesystem/EFS-based cache using `CACHE_DIR` environment variable
- Functions:
    - `getCachedPdf(cacheKey)` → `{ buffer, originalFilename } | null`
    - `setCachedPdf(cacheKey, pdfBuffer, metadata)` → `{ success: true }`
    - `invalidateCache(documentId)` → `{ invalidated: number }`

**Environment Variables**:

- `PORT=4001`
- `INTERNAL_SERVICE_TOKEN=<shared-secret>`
- `CACHE_DIR=/cache` (backed by shared EFS mount)

**Files to Extract**:

- `backend/src/services/documentConversionService.ts`
- `backend/src/services/watermarkService.ts`
- `backend/src/services/pdfCacheService.ts`

**Estimated Build Time Reduction**: 40-50% for backend

### 1.2 AI/LLM Service

**Extract**: Ollama integration, embeddings, similarity calculations**Rationale**:

- AI features are optional (app works without them)
- Heavy dependencies (Ollama client, embedding models)
- Can be scaled separately based on AI workload
- Reduces main backend complexity

**Implementation Structure**:**Folder**: `services/ai-service/`**Files to Create**:

1. **`services/ai-service/package.json`**

- Name: `@app/ai-service`
- Scripts: `start`, `dev`, `build`
- Dependencies: express, axios, etc.

2. **`services/ai-service/tsconfig.json`**

- Similar to Document Service TS config
- `outDir: "dist"`, `rootDir: "src"`

3. **`services/ai-service/src/index.ts`**

- Express bootstrap
- Env: `PORT` (default 4002), `INTERNAL_SERVICE_TOKEN`, `OLLAMA_ENDPOINT`, `OLLAMA_MODEL`
- Registers JSON parsing, `authInternal`, mounts `aiRoutes`
- `GET /health` → `{ status: 'ok', service: 'ai-service', ollama: 'connected' | 'disconnected' }`

4. **`services/ai-service/src/middleware/authInternal.ts`**

- Same pattern as document-service (can be shared later)

5. **`services/ai-service/src/routes/aiRoutes.ts`**

- `POST /v1/embeddings/generate` → `{ embedding: number[] }`
- `POST /v1/similarity/calculate` → `{ score: number, matchedFields: string[] }`
- `POST /v1/similarity/search` → `{ results: Array<{ id, score, matchedFields }> }`
- Normalized error format

6. **`services/ai-service/src/services/llmService.ts`**

- Move from `backend/src/services/llmService.ts`
- Remove DB writes/reads
- Keep: `generateEmbedding(text)`, `cosineSimilarity(e1, e2)`, `mapToScore(cosine)`, `calculateSimilarityScore(...)`, `findSimilarRisks(...)`
- Use env-based configuration for Ollama endpoints

**Environment Variables**:

- `PORT=4002`
- `INTERNAL_SERVICE_TOKEN=<shared-secret>`
- `OLLAMA_ENDPOINT=<url>`
- `OLLAMA_MODEL=<model-name>`

**Files to Extract**:

- `backend/src/services/llmService.ts`
- `backend/src/services/embeddingService.ts` (will use AI service client)
- `backend/src/services/similarityService.ts` (will use AI service client)

**Estimated Build Time Reduction**: 15-20% for backend

### 1.3 Integration Services (Optional, Lower Priority)

**Extract**: SharePoint, Confluence integrations**Rationale**:

- External integrations are infrequently used
- Can be separate services if needed later
- Lower priority than document/AI services

## Strategy 2: Docker Build Optimizations

### 2.1 Backend Dockerfile Improvements

**Current Issues**:

- No BuildKit cache mounts
- Dependencies installed every time
- Prisma Client regenerated unnecessarily

**Optimizations**:

```dockerfile
# Use BuildKit cache mounts for npm dependencies
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Cache Prisma Client generation
RUN --mount=type=cache,target=/app/node_modules/.prisma \
    npm run db:generate
```

**Files to Modify**:

- `backend/Dockerfile.prod`

**Estimated Build Time Reduction**: 30-40% for unchanged dependencies

### 2.2 Document Service Dockerfile

**File**: `services/document-service/Dockerfile`**Multi-stage Node + LibreOffice image**:

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
RUN apk add --no-cache openssl xvfb \
    ttf-dejavu ttf-liberation font-noto font-noto-extra ttf-opensans libreoffice

WORKDIR /app
RUN npm install -g pnpm

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-doc,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM node:20-alpine AS runtime
RUN apk add --no-cache xvfb libreoffice \
    ttf-dejavu ttf-liberation font-noto font-noto-extra ttf-opensans
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

**Note**: Ensure `CACHE_DIR` is mapped to an EFS volume in ECS task definition.

### 2.3 AI Service Dockerfile

**File**: `services/ai-service/Dockerfile`**Multi-stage build without LibreOffice**:

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-ai,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

**Use BuildKit cache mounts and pnpm for faster builds**.

### 2.2 Frontend Dockerfile Improvements

**Optimizations**:

- Use BuildKit cache mounts for npm
- Cache Vite build output
- Use `.dockerignore` to exclude unnecessary files

**Files to Modify**:

- `frontend/Dockerfile.prod`
- Create `frontend/.dockerignore`

**Estimated Build Time Reduction**: 40-50% for unchanged dependencies

### 2.5 Multi-Stage Build Optimization

**Strategy**: Create base images with common dependencies

- Base image: Node.js + common system packages
- Builder image: Base + dev dependencies
- Runtime image: Base + production dependencies

**Files to Create**:

- `backend/docker/base.Dockerfile`
- `backend/docker/builder.Dockerfile`

## Strategy 3: Build Process Optimizations

### 3.1 Dependency Caching

- Use `package-lock.json` consistently
- Cache `node_modules` between builds using BuildKit
- Use npm ci instead of npm install for reproducibility

### 3.2 Incremental Builds

- Only rebuild changed services
- Use build scripts to detect changes
- Skip builds if only unrelated files changed

### 3.3 Parallel Builds

- Build frontend and backend in parallel
- Build microservices in parallel
- Use GitHub Actions matrix strategy

**Files to Modify**:

- `infrastructure/scripts/deploy-utils.sh` (add parallel build support)
- GitHub Actions workflows (if applicable)

## Strategy 4: Deployment Optimizations

### 4.1 ECS & Service Discovery

**Task Definitions**:**File**: `infrastructure/templates/document-service-ecs.yaml`**File**: `infrastructure/templates/ai-service-ecs.yaml`Each should:

1. Define ECS task definition with:

- Container image: `document-service:latest` / `ai-service:latest`
- Env vars: `PORT`, `INTERNAL_SERVICE_TOKEN`, relevant service config
- Health check: `CMD-SHELL "curl -f http://localhost:4001/health || exit 1"` (and similar for AI)
- EFS volume for Document Service cache if used

2. ECS service configuration:

- Network mode: `awsvpc`
- Service discovery via Cloud Map with names:
    - `document-service.local`
    - `ai-service.local`
- No public load balancer (internal-only)

**Backend Environment Updates**:Update ECS task for backend to set:

- `DOCUMENT_SERVICE_URL=http://document-service.local:4001`
- `AI_SERVICE_URL=http://ai-service.local:4002`
- `INTERNAL_SERVICE_TOKEN=<shared-secret>`
- Optional timeouts: `DOCUMENT_SERVICE_TIMEOUT`, `AI_SERVICE_TIMEOUT`

### 4.2 Selective Deployment

- Only deploy changed services
- Skip deployment if image hasn't changed
- Use image digests to detect changes

### 4.3 ECR Image Caching

- Leverage ECR image layer caching
- Use same base images across services
- Tag images with content hashes

### 4.4 Build Script Improvements

- Add `--skip-build` flag to deploy scripts
- Add `--service` flag to build only specific service
- Add build time tracking

**Files to Modify**:

- `infrastructure/scripts/deploy-utils.sh`
- `infrastructure/deploy-frontend.sh`
- Create `infrastructure/deploy-backend.sh`

## Implementation Priority

### Phase 1: Quick Wins (1-2 days)

1. ✅ Docker BuildKit optimizations (cache mounts)
2. ✅ Frontend `.dockerignore` file
3. ✅ Use `npm ci` instead of `npm install`
4. ✅ Add build time tracking

### Phase 2: Document Service Extraction (3-5 days)

1. Create document service structure
2. Extract document processing code
3. Create REST API endpoints
4. Update main backend to call document service
5. Deploy as separate ECS service
6. Update infrastructure templates

### Phase 3: AI Service Extraction (2-3 days)

1. Create AI service structure
2. Extract AI/LLM code
3. Create REST API endpoints
4. Update main backend to call AI service
5. Deploy as separate ECS service

### Phase 4: Advanced Optimizations (2-3 days)

1. Base image optimization
2. Parallel build support
3. Selective deployment logic
4. Build caching improvements

## Expected Results

### Build Time Improvements

- **Backend**: 60-70% reduction (from ~10-15 min to ~3-5 min)
- **Frontend**: 50-60% reduction (from ~5-8 min to ~2-3 min)
- **Document Service**: New service (~5-7 min, but rarely rebuilt)
- **AI Service**: New service (~3-4 min, but rarely rebuilt)

### Deployment Time Improvements

- **Selective Deployments**: Only deploy changed services
- **Parallel Deployments**: Deploy multiple services simultaneously
- **Overall**: 50-70% reduction in deployment time

## Architecture Diagram

```javascript
┌─────────────────┐
│   Frontend      │
│   (React/Vite)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Main Backend   │─────▶│ Document Service │      │   AI Service     │
│  (Core API)     │      │ (LibreOffice)    │      │  (Ollama/LLM)    │
│                 │      │                  │      │                  │
│ - Auth          │      │ - Conversion      │      │ - Embeddings     │
│ - CRUD          │      │ - Watermarking    │      │ - Similarity     │
│ - Business Logic│      │ - PDF Cache      │      │ - Suggestions    │
└─────────────────┘      └──────────────────┘      └──────────────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │
│   (Aurora)      │
└─────────────────┘
```



## Backend Code Changes

### 2.1 Config Additions

**File**: `backend/src/config.ts`Add:

```typescript
export const documentService = {
  baseUrl: process.env.DOCUMENT_SERVICE_URL || 'http://document-service:4001',
  internalToken: process.env.INTERNAL_SERVICE_TOKEN || '',
  timeout: parseInt(process.env.DOCUMENT_SERVICE_TIMEOUT || '30000', 10),
};

export const aiService = {
  baseUrl: process.env.AI_SERVICE_URL || 'http://ai-service:4002',
  internalToken: process.env.INTERNAL_SERVICE_TOKEN || '',
  timeout: parseInt(process.env.AI_SERVICE_TIMEOUT || '10000', 10),
};
```



### 2.2 HTTP Clients

**File**: `backend/src/clients/documentServiceClient.ts`Use Axios (already present):

```typescript
import axios from 'axios';
import { documentService } from '../config';

const client = axios.create({
  baseURL: documentService.baseUrl,
  timeout: documentService.timeout,
});

client.interceptors.request.use((config) => {
  config.headers = {
    ...(config.headers || {}),
    'X-Internal-Service-Token': documentService.internalToken,
  };
  return config;
});
```

Export functions:

- `convertToPdfRemote(params)` - POST /v1/convert with retry
- `watermarkPdfRemote(params)` - POST /v1/watermark with retry
- `getCachedPdfRemote(cacheKey)` - GET /v1/cache/:cacheKey, no retry
- `setCachedPdfRemote(payload)` - POST /v1/cache with retry
- `invalidateCacheRemote(documentId)` - DELETE /v1/cache/:documentId

Implement exponential backoff for retries on convert, watermark, setCache (max 3 attempts).**File**: `backend/src/clients/aiServiceClient.ts`Similar Axios client using `aiService` config.Export:

- `generateEmbeddingRemote(text)` - POST /v1/embeddings/generate with retry
- `calculateSimilarityRemote(input)` - POST /v1/similarity/calculate
- `similaritySearchRemote(input)` - POST /v1/similarity/search

### 2.3 Route Rewiring

**File**: `backend/src/routes/trust/index.ts`In `GET /api/trust/download/:docId` handler:

- Replace direct imports with calls to `documentServiceClient`
- Flow:

1. Compute cacheKey (same SHA256 hash)
2. Call `getCachedPdfRemote(cacheKey)`
3. If hit: return buffer
4. If miss:

    - Fetch source document (SharePoint, etc.)
    - `convertToPdfRemote({ bufferBase64, mimeType, filename })`
    - Get `watermarkPrefix` from DB (Trust Center settings)
    - `watermarkPdfRemote({ pdfBufferBase64, userEmail, date, maxSizeMB, issuedDate, watermarkPrefix })`
    - `setCachedPdfRemote({ cacheKey, pdfBufferBase64, metadata })`
    - Return watermarked buffer

**File**: `backend/src/routes/documents.ts`In `PUT /api/documents/:id`, `DELETE /api/documents/:id`, `PUT /api/reviews/:id/complete`:

- Replace `invalidateCache()` calls with `invalidateCacheRemote(documentId)`

**File**: `backend/src/routes/risks.ts`In `POST /api/risks/suggest-controls`:

- Replace calls to `llmService.generateEmbedding`, `cosineSimilarity`, `mapToScore` with `generateEmbeddingRemote` and `calculateSimilarityRemote` / `similaritySearchRemote`
- Keep business logic (ranking, thresholding, boosting, DB queries) unchanged

**File**: `backend/src/routes/documents.ts` (AI suggestion endpoint)In `POST /api/documents/suggest-controls`:

- Same pattern as risks route: use AI client functions for embeddings and similarity

**File**: `backend/src/services/embeddingService.ts`

- Replace `llmService.generateEmbedding()` with `generateEmbeddingRemote(text)`
- Keep DB write logic and transaction handling as-is

**Cleanup**:

- After migration, remove imports of `llmService` and document services from backend where no longer used
- Optionally leave legacy code behind a feature flag during rollout

## Health Checks & Monitoring

Ensure all three services (backend, document-service, ai-service) expose `/health` with JSON:

- Backend: `{ status: 'ok' }`
- Document Service: `{ status: 'ok', service: 'document-service' }`
- AI Service: `{ status: 'ok', service: 'ai-service', ollama: 'connected' | 'disconnected' }`

Wire ECS health checks to those endpoints.Optionally add simple metrics/log fields: `service`, `route`, `durationMs`, `statusCode` for observability.

## Risk Mitigation

1. **Service Communication**: Use HTTP with retries and circuit breakers
2. **Error Handling**: Graceful degradation if services unavailable
3. **Testing**: Comprehensive integration tests for service boundaries
4. **Monitoring**: Add service-level metrics and health checks
5. **Rollback**: Keep ability to rollback to monolith if needed
6. **Internal Authentication**: Use `X-Internal-Service-Token` header for service-to-service auth
7. **Retry Logic**: Exponential backoff for critical operations (convert, watermark, embeddings)

## Files to Create/Modify

### New Files

- `services/document-service/` (new microservice)
- `services/ai-service/` (new microservice)
- `backend/.dockerignore`
- `frontend/.dockerignore`
- `infrastructure/templates/document-service-ecs.yaml`
- `infrastructure/templates/ai-service-ecs.yaml`