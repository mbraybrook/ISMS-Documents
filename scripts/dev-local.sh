#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting local development environment...${NC}"

# Check if postgres and ollama are running, start them if not
if ! docker compose ps postgres 2>/dev/null | grep -q "Up"; then
  echo -e "${GREEN}📦 Starting PostgreSQL and Ollama via Docker Compose...${NC}"
  docker compose up -d postgres ollama
  echo -e "${GREEN}⏳ Waiting for services to be ready...${NC}"
  sleep 5
else
  echo -e "${GREEN}✅ PostgreSQL and Ollama already running${NC}"
fi

# Export environment variables for local development
# These override Docker DNS names with localhost URLs
export DOCUMENT_SERVICE_URL=http://localhost:4001
export AI_SERVICE_URL=http://localhost:4002
export INTERNAL_SERVICE_TOKEN=${INTERNAL_SERVICE_TOKEN:-dev-token-change-me-in-production}
export OLLAMA_ENDPOINT=http://localhost:11434

# Check if microservices have dependencies installed
if [ ! -d "services/document-service/node_modules" ]; then
  echo -e "${YELLOW}📦 Installing document-service dependencies...${NC}"
  cd services/document-service && npm install && cd ../..
fi

if [ ! -d "services/ai-service/node_modules" ]; then
  echo -e "${YELLOW}📦 Installing ai-service dependencies...${NC}"
  cd services/ai-service && npm install && cd ../..
fi

# Start all services concurrently
echo -e "${GREEN}🎯 Starting all services...${NC}"
echo -e "${BLUE}   Backend: http://localhost:4000${NC}"
echo -e "${BLUE}   Frontend: http://localhost:3000${NC}"
echo -e "${BLUE}   Document Service: http://localhost:4001${NC}"
echo -e "${BLUE}   AI Service: http://localhost:4002${NC}"
echo ""

# Use concurrently to run all services
# Using npx to ensure commands use local node_modules
npx concurrently \
  --names "backend,frontend,document-service,ai-service" \
  --prefix-colors "blue,green,yellow,magenta" \
  --kill-others-on-fail \
  "cd backend && npm run dev" \
  "cd frontend && npm run dev" \
  "cd services/document-service && npm run dev" \
  "cd services/ai-service && npm run dev"
