# Infrastructure Scripts

This directory contains reusable scripts for deploying and managing the ISMS infrastructure.

## Main Utility Script

### `deploy-utils.sh`

The primary utility script for all deployment and infrastructure management tasks. This is the **only script** you need for ongoing deployments.

**Quick Start:**

```bash
cd infrastructure
./scripts/deploy-utils.sh --help
```

**Common Commands:**

- **Build and push all images**: 
  ```bash
  ./scripts/deploy-utils.sh build-all-images
  ```

- **Rebuild frontend with secrets**: 
  ```bash
  ./scripts/deploy-utils.sh rebuild-frontend
  ```

- **Deploy services (CodeDeploy blue/green)**:
  ```bash
  ./scripts/deploy-utils.sh deploy-frontend
  ./scripts/deploy-utils.sh deploy-backend
  ```

- **Deploy microservices**:
  ```bash
  ./scripts/deploy-utils.sh deploy-document-service
  ./scripts/deploy-utils.sh deploy-ai-service
  ```

- **View logs**:
  ```bash
  ./scripts/deploy-utils.sh view-logs --service backend --follow
  ```

- **Monitor deployment**:
  ```bash
  ./scripts/deploy-utils.sh monitor-deployment --service backend
  ```

- **Check health**:
  ```bash
  ./scripts/deploy-utils.sh check-health --service frontend
  ```

**Options:**

- `--environment, -e`: Environment name (default: staging)
- `--profile, -p`: AWS profile (default: pt-sandbox)
- `--region, -r`: AWS region (default: eu-west-2)
- `--image-tag, -t`: Docker image tag (default: staging)
- `--service, -s`: Service type (frontend, backend, document-service, ai-service, or all)
- `--deployment-id, -d`: CodeDeploy deployment ID
- `--help, -h`: Show help message

For complete documentation, see [DEPLOYMENT.md](../DEPLOYMENT.md).

## Utility Scripts

### `validate-templates.sh`

Validates CloudFormation templates before deployment.

```bash
./scripts/validate-templates.sh
```

### `seed-system-data.sh`

Seeds system data (Controls, Classifications, etc.) to an existing environment. Useful for environments deployed before automatic seeding was implemented.

```bash
export AWS_PROFILE=pt-sandbox
export ENVIRONMENT=staging
./scripts/seed-system-data.sh
```

### `setup-github-actions.sh`

Helper script to gather all values needed for GitHub Actions secrets configuration.

```bash
./scripts/setup-github-actions.sh [profile] [environment]
```

## AI Service Scripts

### `check-embeddings-simple.sh`

Checks control embedding status in the database.

```bash
./scripts/check-embeddings-simple.sh staging
```

### `check-control-embeddings.sh`

Checks control embeddings with detailed output.

```bash
./scripts/check-control-embeddings.sh staging
```

### `backfill-control-embeddings.sh`

Backfills control embeddings using ECS Exec (requires ECS Exec enabled).

```bash
./scripts/backfill-control-embeddings.sh staging
```

### `backfill-embeddings-onetime-task.sh`

Alternative backfill method using a one-time ECS task (no ECS Exec required).

```bash
./scripts/backfill-embeddings-onetime-task.sh staging
```

### `pull-ollama-model.sh`

Pulls the Ollama embedding model after Ollama service deployment.

```bash
./scripts/pull-ollama-model.sh staging nomic-embed-text
```



