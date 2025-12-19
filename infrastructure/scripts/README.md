# Infrastructure Scripts

This directory contains reusable scripts for deploying and managing the ISMS infrastructure.

## Main Utility Script

### `deploy-utils.sh`

A comprehensive multi-purpose utility script for common deployment and troubleshooting tasks.

**Quick Start:**

```bash
cd infrastructure
./scripts/deploy-utils.sh --help
```

**Common Commands:**

- **Rebuild frontend with secrets**: 
  ```bash
  ./scripts/deploy-utils.sh rebuild-frontend
  ```

- **Build and push images**: 
  ```bash
  ./scripts/deploy-utils.sh build-frontend --image-tag v1.2.3
  ./scripts/deploy-utils.sh build-backend --image-tag v1.2.3
  ```

- **Deploy services (CodeDeploy)**:
  ```bash
  ./scripts/deploy-utils.sh deploy-frontend
  ./scripts/deploy-utils.sh deploy-backend
  ```

- **Update service directly (fallback)**:
  ```bash
  ./scripts/deploy-utils.sh update-service --service frontend
  ```

- **Check health**:
  ```bash
  ./scripts/deploy-utils.sh check-health --service frontend
  ```

- **View logs**:
  ```bash
  ./scripts/deploy-utils.sh view-logs --service backend
  ```

- **Monitor deployment**:
  ```bash
  ./scripts/deploy-utils.sh monitor-deployment --deployment-id d-1234567890
  ```

**Options:**

- `--environment, -e`: Environment name (default: staging)
- `--profile, -p`: AWS profile (default: pt-sandbox)
- `--region, -r`: AWS region (default: eu-west-2)
- `--image-tag, -t`: Docker image tag (default: staging)
- `--service, -s`: Service type (frontend or backend)
- `--deployment-id, -d`: CodeDeploy deployment ID
- `--help, -h`: Show help message

## Other Scripts

### `deploy.sh`

Deploys CloudFormation stacks using nested templates.

```bash
./scripts/deploy.sh <environment> [profile]
```

### `validate-templates.sh`

Validates CloudFormation templates.

### `create-codedeploy-deployment.sh`

Creates CodeDeploy deployments (used internally by deploy-utils.sh).

## Deployment Scripts

The main deployment scripts (`deploy-frontend.sh` and `deploy-backend.sh`) are located in the `infrastructure/` directory and use CodeDeploy for blue/green deployments.

