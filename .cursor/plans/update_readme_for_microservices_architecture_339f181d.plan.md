---
name: Update README for Microservices Architecture
overview: Update the main README.md to accurately reflect the microservices architecture, including document-service and ai-service, deployment scripts, and infrastructure documentation references.
todos:
  - id: update-architecture-section
    content: Update Architecture section to include document-service and ai-service microservices
    status: completed
  - id: update-docker-dev-section
    content: Update Docker Development section to reflect microservices architecture and service discovery
    status: completed
  - id: update-env-vars
    content: Add microservice environment variables (DOCUMENT_SERVICE_URL, AI_SERVICE_URL, INTERNAL_SERVICE_TOKEN, etc.)
    status: completed
  - id: update-production-deployment
    content: Update Production Deployment section to reference infrastructure/DEPLOYMENT.md and mention microservices
    status: completed
  - id: update-project-structure
    content: Add services/ directory to Project Structure section
    status: completed
  - id: update-quick-start
    content: Update Quick Start Docker section to mention microservices and reference DOCKER_COMPOSE_ARCHITECTURE.md
    status: completed
  - id: add-scripts-reference
    content: Add reference to infrastructure/scripts deployment utilities in appropriate sections
    status: completed
---

# Update RE

ADME.md for Microservices Architecture

## Overview

Update the main README.md to accurately reflect the current microservices architecture, deployment infrastructure, and project state.

## Changes Required

### 1. Architecture Section (Lines 5-18)

Update to include microservices:

- Add **Document Service**: Microservice for PDF conversion and watermarking (port 4001)
- Add **AI Service**: Microservice for embeddings and similarity calculations (port 4002)
- Update service communication to show backend → microservices architecture
- Reference internal service authentication

### 2. Docker Development Section (Lines 118-199)

Update to reflect microservices:

- Add document-service and ai-service to the architecture description
- Update service discovery section to mention `document-service.local` and `ai-service.local`
- Add `INTERNAL_SERVICE_TOKEN` to environment variables
- Update health check endpoints to include microservices
- Reference `DOCKER_COMPOSE_ARCHITECTURE.md` for detailed architecture

### 3. Environment Variables Section (Lines 35-76)

Add microservice-related environment variables:

- `DOCUMENT_SERVICE_URL`: URL for document service (default: `http://document-service.local:4001`)
- `AI_SERVICE_URL`: URL for AI service (default: `http://ai-service.local:4002`)
- `INTERNAL_SERVICE_TOKEN`: Shared secret for inter-service authentication
- `DOCUMENT_SERVICE_TIMEOUT`: Timeout for document service requests (default: 30000ms)
- `AI_SERVICE_TIMEOUT`: Timeout for AI service requests (default: 10000ms)

### 4. Production Deployment Section (Lines 201-223)

Update to reference infrastructure documentation:

- Point to `infrastructure/DEPLOYMENT.md` as the primary deployment guide
- Mention microservices deployment (document-service, ai-service, ollama)
- Reference deployment scripts in `infrastructure/scripts/`
- Update GitHub Actions section to mention microservices

### 5. Project Structure Section (Lines 602-637)

Add services directory:

- Add `services/` directory with `document-service/` and `ai-service/` subdirectories
- Update to show microservices structure

### 6. Quick Start - Docker Development (Lines 118-199)

Clarify microservices:

- Mention that docker-compose includes all microservices
- Note that services use service discovery (`*.local` DNS names)
- Reference `DOCKER_COMPOSE_ARCHITECTURE.md` for architecture details

### 7. Available Scripts Section

Add reference to infrastructure scripts:

- Mention `infrastructure/scripts/deploy-utils.sh` for deployment utilities
- Reference other helper scripts (backfill-embeddings, check-embeddings, etc.)

### 8. Production Deployment - Docker Compose Section (Lines 225-415)

Update to mention microservices:

- Note that production docker-compose should include document-service and ai-service
- Update environment variables section
- Add microservice health check endpoints

## Files to Update

- `README.md`: Main project README

## References

- `infrastructure/DEPLOYMENT.md`: Comprehensive deployment guide
- `infrastructure/README.md`: Infrastructure overview
- `DOCKER_COMPOSE_ARCHITECTURE.md`: Docker Compose architecture details
- `docker-compose.yml`: Current microservices setup
- `infrastructure/scripts/deploy-utils.sh`: Deployment utilities

## Implementation Notes

- Keep existing content structure where possible
- Add new sections for microservices without removing important existing information