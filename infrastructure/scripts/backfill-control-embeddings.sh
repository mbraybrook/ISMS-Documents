#!/bin/bash
# Script to backfill control embeddings for an existing environment
# This can be run on already-deployed infrastructure to populate missing embeddings

set -e

# Default values
ENVIRONMENT="${ENVIRONMENT:-staging}"
AWS_PROFILE="${AWS_PROFILE:-pt-sandbox}"
AWS_REGION="${AWS_REGION:-eu-west-2}"
BATCH_SIZE="${BATCH_SIZE:-20}"
CONCURRENCY="${CONCURRENCY:-2}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Backfilling control embeddings for ${ENVIRONMENT} environment${NC}"

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
SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id "$DB_SECRET_ARN" \
  --query 'SecretString' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION")

DATABASE_URL=$(echo "$SECRET_JSON" | jq -r '.DATABASE_URL')
INTERNAL_SERVICE_TOKEN=$(echo "$SECRET_JSON" | jq -r '.INTERNAL_SERVICE_TOKEN // empty')

if [ -z "$DATABASE_URL" ] || [ "$DATABASE_URL" == "null" ]; then
  echo -e "${RED}ERROR: Could not retrieve DATABASE_URL from Secrets Manager${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Retrieved database connection string${NC}"

# Get AI service URL from ECS task definition or use default
echo "Determining AI service URL..."
AI_SERVICE_URL="${AI_SERVICE_URL:-http://ai-service.local:4002}"

# Get cluster and service name
CLUSTER_NAME=$(aws cloudformation describe-stacks \
  --stack-name "isms-${ENVIRONMENT}-ecs" \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterName`].OutputValue' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" 2>/dev/null || echo "")

if [ -z "$CLUSTER_NAME" ]; then
  echo -e "${RED}ERROR: Could not find ECS cluster. Cannot run backfill without cluster access.${NC}"
  exit 1
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

# Get task definition from the service
echo "Getting task definition from service..."
TASK_DEFINITION=$(aws ecs describe-services \
  --cluster "$CLUSTER_NAME" \
  --services "$BACKEND_SERVICE" \
  --query 'services[0].taskDefinition' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION")

if [ -z "$TASK_DEFINITION" ] || [ "$TASK_DEFINITION" == "None" ]; then
  echo -e "${RED}ERROR: Could not get task definition from service${NC}"
  exit 1
fi

echo "Using task definition: $TASK_DEFINITION"

# Get VPC configuration from task definition
echo "Getting VPC configuration..."
TASK_DEF_JSON=$(aws ecs describe-task-definition \
  --task-definition "$TASK_DEFINITION" \
  --query 'taskDefinition' \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION")

# Get subnets and security groups from ECS stack
VPC_ID=$(aws cloudformation describe-stacks \
  --stack-name "isms-${ENVIRONMENT}-vpc" \
  --query 'Stacks[0].Outputs[?OutputKey==`VpcId`].OutputValue' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" 2>/dev/null || echo "")

PRIV_SUBNET_1=$(aws cloudformation describe-stacks \
  --stack-name "isms-${ENVIRONMENT}-vpc" \
  --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnet1Id`].OutputValue' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" 2>/dev/null || echo "")

PRIV_SUBNET_2=$(aws cloudformation describe-stacks \
  --stack-name "isms-${ENVIRONMENT}-vpc" \
  --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnet2Id`].OutputValue' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" 2>/dev/null || echo "")

ECS_SG_ID=$(aws cloudformation describe-stacks \
  --stack-name "isms-${ENVIRONMENT}-sg" \
  --query 'Stacks[0].Outputs[?OutputKey==`ECSSecurityGroupId`].OutputValue' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" 2>/dev/null || echo "")

if [ -z "$PRIV_SUBNET_1" ] || [ -z "$PRIV_SUBNET_2" ] || [ -z "$ECS_SG_ID" ]; then
  echo -e "${RED}ERROR: Could not get VPC configuration (subnets or security group)${NC}"
  exit 1
fi

# Run a one-off ECS task that executes the backfill script
echo "Running one-off ECS task to execute backfill..."
echo "This task will run inside the VPC and have access to the database..."

# Create a modified task definition JSON that runs the backfill script as the command
# Override the CMD to run the backfill script instead of starting the server
TASK_DEF_WITH_CMD=$(echo "$TASK_DEF_JSON" | jq '
  .requiresCompatibilities = ["FARGATE"] |
  .networkMode = "awsvpc" |
  del(.taskDefinitionArn) |
  del(.revision) |
  del(.status) |
  del(.requiresAttributes) |
  del(.compatibilities) |
  del(.registeredAt) |
  del(.registeredBy) |
  .containerDefinitions[0].command = ["sh", "-c", "npm run backfill-control-embeddings -- --batch-size '"$BATCH_SIZE"' --concurrency '"$CONCURRENCY"'"] |
  .containerDefinitions[0].essential = true
')

# Register a temporary task definition for the one-off task
echo "Registering temporary task definition..."
TEMP_TASK_DEF_ARN=$(echo "$TASK_DEF_WITH_CMD" | aws ecs register-task-definition \
  --cli-input-json file:///dev/stdin \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text 2>&1)

if [ $? -ne 0 ] || [ -z "$TEMP_TASK_DEF_ARN" ] || [[ "$TEMP_TASK_DEF_ARN" == *"error"* ]]; then
  echo -e "${RED}ERROR: Failed to register temporary task definition${NC}"
  echo "$TEMP_TASK_DEF_ARN"
  exit 1
fi

echo "Registered temporary task definition: $TEMP_TASK_DEF_ARN"

# Run the one-off task
echo "Starting one-off task..."
RUN_TASK_OUTPUT=$(aws ecs run-task \
  --cluster "$CLUSTER_NAME" \
  --task-definition "$TEMP_TASK_DEF_ARN" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIV_SUBNET_1,$PRIV_SUBNET_2],securityGroups=[$ECS_SG_ID],assignPublicIp=DISABLED}" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" 2>&1)

TASK_ARN=$(echo "$RUN_TASK_OUTPUT" | jq -r '.tasks[0].taskArn // empty' 2>/dev/null)

if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" == "null" ]; then
  echo -e "${RED}ERROR: Failed to start one-off task${NC}"
  echo "$RUN_TASK_OUTPUT"
  exit 1
fi

echo "One-off task started: $TASK_ARN"
echo "Waiting for task to complete (this may take several minutes)..."
echo "You can monitor progress in CloudWatch logs: /ecs/isms-${ENVIRONMENT}-backend"

# Wait for task to complete
MAX_WAIT=600  # 10 minutes
WAIT_COUNT=0
LAST_STATUS=""
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
  TASK_INFO=$(aws ecs describe-tasks \
    --cluster "$CLUSTER_NAME" \
    --tasks "$TASK_ARN" \
    --query 'tasks[0].{status:lastStatus,stopCode:stopCode,exitCode:containers[0].exitCode,reason:containers[0].reason}' \
    --output json \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" 2>/dev/null)
  
  TASK_STATUS=$(echo "$TASK_INFO" | jq -r '.status // "UNKNOWN"')
  EXIT_CODE=$(echo "$TASK_INFO" | jq -r '.exitCode // "null"')
  STOP_REASON=$(echo "$TASK_INFO" | jq -r '.reason // "N/A"')
  
  if [ "$TASK_STATUS" != "$LAST_STATUS" ]; then
    echo "Task status: $TASK_STATUS"
    LAST_STATUS="$TASK_STATUS"
  fi
  
  if [ "$TASK_STATUS" == "STOPPED" ]; then
    if [ "$EXIT_CODE" == "0" ] || [ "$EXIT_CODE" == "null" ]; then
      echo -e "${GREEN}✓ Task completed successfully${NC}"
      break
    else
      echo -e "${RED}ERROR: Task failed with exit code: $EXIT_CODE${NC}"
      echo "Stop reason: $STOP_REASON"
      
      # Get logs from CloudWatch
      LOG_GROUP="/ecs/isms-${ENVIRONMENT}-backend"
      echo "Fetching recent logs..."
      LOG_STREAMS=$(aws logs describe-log-streams \
        --log-group-name "$LOG_GROUP" \
        --order-by LastEventTime \
        --descending \
        --max-items 5 \
        --query 'logStreams[*].logStreamName' \
        --output text \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" 2>/dev/null || echo "")
      
      if [ -n "$LOG_STREAMS" ]; then
        echo -e "\n${YELLOW}Recent log entries:${NC}"
        for STREAM in $LOG_STREAMS; do
          if [[ "$STREAM" == *"$TASK_ARN"* ]] || [[ "$STREAM" == *"backfill"* ]]; then
            aws logs get-log-events \
              --log-group-name "$LOG_GROUP" \
              --log-stream-name "$STREAM" \
              --limit 30 \
              --profile "$AWS_PROFILE" \
              --region "$AWS_REGION" \
              --query 'events[*].message' \
              --output text 2>/dev/null | tail -20 || true
            break
          fi
        done
      fi
      
      exit 1
    fi
  fi
  
  sleep 10
  WAIT_COUNT=$((WAIT_COUNT + 10))
  
  # Show progress every 30 seconds
  if [ $((WAIT_COUNT % 30)) -eq 0 ]; then
    echo "Still waiting... (${WAIT_COUNT}s elapsed)"
  fi
done

if [ "$TASK_STATUS" != "STOPPED" ]; then
  echo -e "${YELLOW}WARNING: Task did not complete in time (status: $TASK_STATUS)${NC}"
  echo "Task ARN: $TASK_ARN"
  echo "You can check the task status and logs manually:"
  echo "  aws ecs describe-tasks --cluster $CLUSTER_NAME --tasks $TASK_ARN --profile $AWS_PROFILE --region $AWS_REGION"
  echo "  aws logs tail /ecs/isms-${ENVIRONMENT}-backend --follow --profile $AWS_PROFILE --region $AWS_REGION"
  exit 1
fi

echo "Note: Temporary task definition $TEMP_TASK_DEF_ARN will remain (you can delete it manually if desired)"

echo -e "${GREEN}✓ Control embeddings backfilled successfully${NC}"

