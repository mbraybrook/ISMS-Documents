#!/bin/bash
# Script to seed system data (Controls, Classifications, etc.) to an existing environment
# This ensures essential system data is present even if it wasn't seeded on first deployment

set -e

# Default values
ENVIRONMENT="${ENVIRONMENT:-staging}"
AWS_PROFILE="${AWS_PROFILE:-pt-sandbox}"
AWS_REGION="${AWS_REGION:-eu-west-2}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Seeding system data to ${ENVIRONMENT} environment${NC}"

# Get database credentials from Secrets Manager
echo "Retrieving database credentials from Secrets Manager..."
DB_SECRET_ARN=$(aws cloudformation describe-stacks \
  --stack-name "isms-${ENVIRONMENT}-secrets" \
  --query 'Stacks[0].Outputs[?OutputKey==`DatabaseCredentialsSecretArn`].OutputValue' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" 2>/dev/null || echo "")

if [ -z "$DB_SECRET_ARN" ]; then
  echo -e "${RED}ERROR: Could not find secrets stack for environment ${ENVIRONMENT}${NC}"
  echo "Make sure the secrets stack is deployed: isms-${ENVIRONMENT}-secrets"
  exit 1
fi

# Get DATABASE_URL from Secrets Manager
echo "Fetching DATABASE_URL from Secrets Manager..."
DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id "$DB_SECRET_ARN" \
  --query 'SecretString' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" | jq -r '.DATABASE_URL')

if [ -z "$DATABASE_URL" ] || [ "$DATABASE_URL" == "null" ]; then
  echo -e "${RED}ERROR: Could not retrieve DATABASE_URL from Secrets Manager${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Retrieved database connection string${NC}"

# Get cluster and service name
CLUSTER_NAME=$(aws cloudformation describe-stacks \
  --stack-name "isms-${ENVIRONMENT}-ecs" \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterName`].OutputValue' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" 2>/dev/null || echo "")

if [ -z "$CLUSTER_NAME" ]; then
  echo -e "${YELLOW}WARNING: Could not find ECS cluster. Will seed directly via database connection.${NC}"
  echo "Seeding system data directly..."
  
  # Run seed script directly with DATABASE_URL
  cd "$(dirname "$0")/../../backend" || exit 1
  export DATABASE_URL
  export SEED_SCOPE=system
  export NODE_ENV="$ENVIRONMENT"
  
  npm run db:seed
  
  echo -e "${GREEN}✓ System data seeded successfully${NC}"
  exit 0
fi

BACKEND_SERVICE=$(aws cloudformation describe-stacks \
  --stack-name "isms-${ENVIRONMENT}-ecs" \
  --query 'Stacks[0].Outputs[?OutputKey==`BackendServiceName`].OutputValue' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION")

if [ -z "$BACKEND_SERVICE" ]; then
  echo -e "${RED}ERROR: Could not find backend service name${NC}"
  exit 1
fi

echo "Found ECS cluster: $CLUSTER_NAME"
echo "Found backend service: $BACKEND_SERVICE"

# Get a running task
echo "Finding a running task..."
TASK_ARN=$(aws ecs list-tasks \
  --cluster "$CLUSTER_NAME" \
  --service-name "$BACKEND_SERVICE" \
  --desired-status RUNNING \
  --query 'taskArns[0]' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION")

if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" == "None" ]; then
  echo -e "${YELLOW}WARNING: No running tasks found. Will seed directly via database connection.${NC}"
  echo "Seeding system data directly..."
  
  # Run seed script directly with DATABASE_URL
  cd "$(dirname "$0")/../../backend" || exit 1
  export DATABASE_URL
  export SEED_SCOPE=system
  export NODE_ENV="$ENVIRONMENT"
  
  npm run db:seed
  
  echo -e "${GREEN}✓ System data seeded successfully${NC}"
  exit 0
fi

echo "Found running task: $TASK_ARN"

# Execute seed command in the running container
echo "Executing system seed in container..."
aws ecs execute-command \
  --cluster "$CLUSTER_NAME" \
  --task "$TASK_ARN" \
  --container backend \
  --interactive \
  --command "sh -c 'export SEED_SCOPE=system && npm run db:seed'" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" || {
  echo -e "${YELLOW}WARNING: ECS execute-command failed. Trying direct database connection...${NC}"
  
  # Fallback: Run seed script directly with DATABASE_URL
  cd "$(dirname "$0")/../../backend" || exit 1
  export DATABASE_URL
  export SEED_SCOPE=system
  export NODE_ENV="$ENVIRONMENT"
  
  npm run db:seed
}

echo -e "${GREEN}✓ System data seeded successfully${NC}"




