---
name: Build Speed Optimization Plan
overview: Comprehensive plan to optimize build and deployment times through microservices separation, Docker build optimizations, and deployment process improvements.
todos:
  - id: docker-buildkit-optimizations
    content: Add BuildKit cache mounts to backend and frontend Dockerfiles to cache npm dependencies and Prisma Client generation
    status: pending
  - id: dockerignore-files
    content: Create .dockerignore files for backend and frontend to exclude unnecessary files from build context
    status: pending
  - id: npm-ci-migration
    content: Update Dockerfiles to use npm ci instead of npm install for reproducible builds
    status: pending
  - id: document-service-extraction
    content: Extract document processing (LibreOffice, watermarking, PDF) into separate microservice with REST API
    status: pending
    dependencies:
      - docker-buildkit-optimizations
  - id: ai-service-extraction
    content: Extract AI/LLM functionality (Ollama, embeddings, similarity) into separate microservice with REST API
    status: pending
    dependencies:
      - docker-buildkit-optimizations
  - id: update-main-backend
    content: Update main backend to call document and AI services via HTTP instead of direct imports
    status: pending
    dependencies:
      - document-service-extraction
      - ai-service-extraction
  - id: infrastructure-templates
    content: Create CloudFormation templates for document-service and ai-service ECS deployments
    status: pending
    dependencies:
      - document-service-extraction
      - ai-service-extraction
  - id: deployment-scripts
    content: Update deployment scripts to support parallel builds and selective service deployment
    status: pending
    dependencies:
      - infrastructure-templates
  - id: base-image-optimization
    content: Create optimized base Docker images with common dependencies to reduce build times
    status: pending
    dependencies:
      - docker-buildkit-optimizations
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

**Extract**: Document conversion, watermarking, PDF generation, PDF caching

**Rationale**:

- LibreOffice is the heaviest dependency (~200MB+)
- Document processing is infrequently used compared to core API
- Can scale independently
- Reduces main backend image size significantly

**Implementation**:

- Create `services/document-service/` directory
- Move `documentConversionService.ts`, `watermarkService.ts`, `pdfCacheService.ts`
- Create new Express service with minimal dependencies
- Expose REST API: `POST /convert`, `POST /watermark`, `GET /cache/:id`
- Main backend calls document service via HTTP
- Deploy as separate ECS service

**Files to Extract**:

- `backend/src/services/documentConversionService.ts`
- `backend/src/services/watermarkService.ts`
- `backend/src/services/pdfCacheService.ts`
- Related routes from `backend/src/routes/trust/index.ts` (document download endpoints)

**Estimated Build Time Reduction**: 40-50% for backend

### 1.2 AI/LLM Service

**Extract**: Ollama integration, embeddings, similarity calculations

**Rationale**:

- AI features are optional (app works without them)
- Heavy dependencies (Ollama client, embedding models)
- Can be scaled separately based on AI workload
- Reduces main backend complexity

**Implementation**:

- Create `services/ai-service/` directory
- Move `llmService.ts`, `embeddingService.ts`, `similarityService.ts`
- Create new Express service
- Expose REST API: `POST /embeddings`, `POST /similarity`, `POST /suggestions`
- Main backend calls AI service via HTTP
- Deploy as separate ECS service (can use spot instances)

**Files to Extract**:

- `backend/src/services/llmService.ts`
- `backend/src/services/embeddingService.ts`
- `backend/src/services/similarityService.ts`
- Related routes from `backend/src/routes/risks.ts` (similarity endpoints)
- Related routes from `backend/src/routes/controls.ts` (embedding endpoints)

**Estimated Build Time Reduction**: 15-20% for backend

### 1.3 Integration Services (Optional, Lower Priority)

**Extract**: SharePoint, Confluence integrations

**Rationale**:

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
    npm install

# Cache Prisma Client generation
RUN --mount=type=cache,target=/app/node_modules/.prisma \
    npm run db:generate

# Separate LibreOffice installation into its own stage
# This allows reusing base image without LibreOffice
FROM node:18-alpine AS libreoffice-base
RUN apk add --no-cache openssl openssl-dev libreoffice xvfb \
    ttf-dejavu ttf-liberation font-noto font-noto-extra ttf-opensans
```

**Files to Modify**:

- `backend/Dockerfile.prod`

**Estimated Build Time Reduction**: 30-40% for unchanged dependencies

### 2.2 Frontend Dockerfile Improvements

**Optimizations**:

- Use BuildKit cache mounts for npm
- Cache Vite build output
- Use `.dockerignore` to exclude unnecessary files

**Files to Modify**:

- `frontend/Dockerfile.prod`
- Create `frontend/.dockerignore`

**Estimated Build Time Reduction**: 40-50% for unchanged dependencies

### 2.3 Multi-Stage Build Optimization

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

### 4.1 Selective Deployment

- Only deploy changed services
- Skip deployment if image hasn't changed
- Use image digests to detect changes

### 4.2 ECR Image Caching

- Leverage ECR image layer caching
- Use same base images across services
- Tag images with content hashes

### 4.3 Build Script Improvements

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



## Risk Mitigation

1. **Service Communication**: Use HTTP with retries and circuit breakers
2. **Error Handling**: Graceful degradation if services unavailable
3. **Testing**: Comprehensive integration tests for service boundaries
4. **Monitoring**: Add service-level metrics and health checks
5. **Rollback**: Keep ability to rollback to monolith if needed

## Files to Create/Modify

### New Files

- `services/document-service/` (new microservice)
- `services/ai-service/` (new microservice)
- `backend/.dockerignore`
- `frontend/.dockerignore`
- `infrastructure/templates/document-service-ecs.yaml`
- `infrastructure/templates/ai-service-ecs.yaml`

### Modified Files

- `backend/Dockerfile.prod` (BuildKit optimizations)
- `frontend/Dockerfile.prod` (BuildKit optimizations)
- `backend/src/routes/trust/index.ts` (call document service)
- `backend/src/routes/risks.ts` (call AI service)
- `backend/src/routes/controls.ts` (call AI service)