# Docker Compose Architecture

This document describes the local Docker Compose setup, which mirrors the ECS production deployment architecture for testing purposes.

## Architecture Overview

The docker-compose setup replicates the production ECS microservices architecture:

```
┌─────────────┐
│  Frontend   │ (nginx, port 3000 → 80)
│  (React)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Backend   │ (Express, port 4000)
│   (Main API)│
└──────┬──────┘
       │
       ├──────────────┬──────────────┐
       │              │              │
       ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  Document   │ │    AI       │ │  PostgreSQL │
│   Service   │ │  Service    │ │  (Database) │
│  (port 4001)│ │ (port 4002) │ │  (port 5432)│
└─────────────┘ └──────┬──────┘ └─────────────┘
                       │
                       ▼
                 ┌─────────────┐
                 │   Ollama    │
                 │  (LLM API)  │
                 │  (port 11434)│
                 └─────────────┘
```

## Services

### Backend (`backend`)
- **Image**: Built from `backend/Dockerfile.prod`
- **Port**: 4000
- **Health Check**: `GET /api/health`
- **Environment Variables**:
  - `DOCUMENT_SERVICE_URL=http://document-service.local:4001`
  - `AI_SERVICE_URL=http://ai-service.local:4002`
  - `INTERNAL_SERVICE_TOKEN` (shared secret for inter-service auth)
- **Dependencies**: postgres, document-service, ai-service

### Frontend (`frontend`)
- **Image**: Built from `frontend/Dockerfile.prod`
- **Port**: 3000 (mapped from container port 80)
- **Health Check**: `GET /health`
- **Build Args**: VITE_* variables (baked into build)
- **Dependencies**: backend

### Document Service (`document-service`)
- **Image**: Built from `services/document-service/Dockerfile`
- **Port**: 4001
- **Health Check**: `GET /health`
- **Environment Variables**:
  - `PORT=4001`
  - `INTERNAL_SERVICE_TOKEN`
  - `CACHE_DIR=/cache`
- **Volumes**: `document_cache:/cache` (persistent cache storage)
- **Network Alias**: `document-service.local` (matches ECS service discovery)

### AI Service (`ai-service`)
- **Image**: Built from `services/ai-service/Dockerfile`
- **Port**: 4002
- **Health Check**: `GET /health` (includes Ollama connection status)
- **Environment Variables**:
  - `PORT=4002`
  - `INTERNAL_SERVICE_TOKEN`
  - `OLLAMA_ENDPOINT=http://ollama:11434`
  - `OLLAMA_MODEL=nomic-embed-text`
- **Dependencies**: ollama
- **Network Alias**: `ai-service.local` (matches ECS service discovery)

### PostgreSQL (`postgres`)
- **Image**: `postgres:15-alpine`
- **Port**: 5432
- **Health Check**: `pg_isready`
- **Volumes**: `postgres_data:/var/lib/postgresql/data`

### Ollama (`ollama`)
- **Image**: `ollama/ollama:latest`
- **Port**: 11434
- **Health Check**: `GET /api/tags`
- **Volumes**: `ollama_data:/root/.ollama`

## Service Discovery

The docker-compose setup uses Docker network aliases to replicate ECS Cloud Map service discovery:

- `document-service.local` → document-service container
- `ai-service.local` → ai-service container

This allows the backend to use the same service URLs as production:
- `http://document-service.local:4001`
- `http://ai-service.local:4002`

## Internal Service Authentication

All microservices use a shared `INTERNAL_SERVICE_TOKEN` for authentication:

1. Backend includes `X-Internal-Service-Token` header in requests to microservices
2. Microservices validate the token via `authInternal` middleware
3. Token is set via environment variable: `INTERNAL_SERVICE_TOKEN`

**Local Development**: Set in `.env` file:
```bash
INTERNAL_SERVICE_TOKEN=dev-token-change-me-in-production
```

## Health Checks

All services include health checks matching the ECS configuration:

| Service | Health Check | Interval | Timeout | Retries | Start Period |
|---------|-------------|----------|---------|---------|--------------|
| Backend | `GET /api/health` | 30s | 10s | 5 | 120s |
| Frontend | `GET /health` | 30s | 10s | 5 | 60s |
| Document Service | `GET /health` | 30s | 5s | 3 | 60s |
| AI Service | `GET /health` | 30s | 5s | 3 | 60s |
| PostgreSQL | `pg_isready` | 5s | 5s | 5 | - |
| Ollama | `GET /api/tags` | 10s | 5s | 3 | 30s |

## Volumes

- `postgres_data`: PostgreSQL database files
- `ollama_data`: Ollama models and data
- `document_cache`: Document service PDF cache (EFS equivalent)

## Production Parity

This docker-compose setup matches the ECS deployment in:

✅ **Service Architecture**: Same microservices structure  
✅ **Service Discovery**: Same DNS names (`*.local`)  
✅ **Health Checks**: Same endpoints and intervals  
✅ **Environment Variables**: Same configuration  
✅ **Docker Images**: Uses production Dockerfiles  
✅ **Internal Auth**: Same token-based authentication  
✅ **Port Mappings**: Same container ports  
✅ **Dependencies**: Same service dependencies  

## Differences from ECS

While the architecture matches, there are some differences:

- **Networking**: Docker bridge network vs. AWS VPC
- **Load Balancing**: No ALB (direct port access)
- **Scaling**: Single instance per service (no auto-scaling)
- **Storage**: Docker volumes vs. EFS
- **Logging**: Docker logs vs. CloudWatch
- **Secrets**: Environment variables vs. Secrets Manager

## Usage

### Start All Services
```bash
docker compose up
```

### Start in Background
```bash
docker compose up -d
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f document-service
docker compose logs -f ai-service
```

### Rebuild After Code Changes
```bash
# Rebuild specific service
docker compose build backend
docker compose up -d backend

# Rebuild all
docker compose build
docker compose up -d
```

### Stop Services
```bash
docker compose down
```

### Clean Up (Remove Volumes)
```bash
docker compose down -v
```

## Troubleshooting

### Services Not Starting
1. Check health check status: `docker compose ps`
2. View logs: `docker compose logs <service-name>`
3. Verify environment variables are set
4. Check port conflicts: `netstat -an | grep <port>`

### Backend Can't Connect to Microservices
1. Verify network aliases are set: `docker network inspect isms-documentation_default`
2. Check service URLs match: `http://document-service.local:4001`, `http://ai-service.local:4002`
3. Verify `INTERNAL_SERVICE_TOKEN` is set in all services
4. Test connectivity: `docker compose exec backend curl http://document-service.local:4001/health`

### Health Check Failures
1. Verify services are running: `docker compose ps`
2. Check health check endpoints manually:
   - Backend: `curl http://localhost:4000/api/health`
   - Document Service: `curl http://localhost:4001/health`
   - AI Service: `curl http://localhost:4002/health`
3. Check service logs for errors

### Build Failures
1. Clear Docker build cache: `docker builder prune`
2. Rebuild without cache: `docker compose build --no-cache`
3. Check Dockerfile syntax and dependencies


