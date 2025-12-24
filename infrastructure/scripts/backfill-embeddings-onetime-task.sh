#!/bin/bash
# Backfill control embeddings using a one-time ECS task with ECS Exec enabled

set -euo pipefail

ENVIRONMENT="${1:-staging}"
AWS_PROFILE="${AWS_PROFILE:-pt-sandbox}"
AWS_REGION="${AWS_REGION:-eu-west-2}"
BATCH_SIZE="${BATCH_SIZE:-20}"
CONCURRENCY="${CONCURRENCY:-2}"

echo "🔄 Backfilling control embeddings via one-time task..."
echo "Environment: $ENVIRONMENT"
echo "Batch size: $BATCH_SIZE"
echo "Concurrency: $CONCURRENCY"
echo ""

# Get required parameters
CLUSTER_NAME=$(aws cloudformation describe-stacks \
  --stack-name "isms-${ENVIRONMENT}-ecs" \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterName`].OutputValue' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" 2>/dev/null || echo "")

if [ -z "$CLUSTER_NAME" ]; then
  echo "❌ Could not find ECS cluster. Is the ECS stack deployed?"
  exit 1
fi

# Get backend service details to clone task definition
echo "📋 Getting backend task definition..."
BACKEND_SERVICE=$(aws cloudformation describe-stacks \
  --stack-name "isms-${ENVIRONMENT}-ecs" \
  --query 'Stacks[0].Outputs[?OutputKey==`BackendServiceName`].OutputValue' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION")

CURRENT_TASK_DEF=$(aws ecs describe-services \
  --cluster "$CLUSTER_NAME" \
  --services "$BACKEND_SERVICE" \
  --query 'services[0].taskDefinition' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION")

echo "✅ Found task definition: $CURRENT_TASK_DEF"
echo ""

# Get task definition JSON
echo "📝 Creating new task definition..."
TEMP_TASK_DEF_FILE=$(mktemp)
aws ecs describe-task-definition \
  --task-definition "$CURRENT_TASK_DEF" \
  --query 'taskDefinition' \
  --output json \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" > "$TEMP_TASK_DEF_FILE" 2>&1

if [ $? -ne 0 ]; then
  echo "❌ Failed to get task definition"
  cat "$TEMP_TASK_DEF_FILE"
  rm -f "$TEMP_TASK_DEF_FILE"
  exit 1
fi

# Validate JSON
if ! jq empty "$TEMP_TASK_DEF_FILE" 2>/dev/null; then
  echo "❌ Invalid task definition JSON received"
  echo "First 500 chars:"
  head -c 500 "$TEMP_TASK_DEF_FILE"
  rm -f "$TEMP_TASK_DEF_FILE"
  exit 1
fi

# Create new task definition with command override
# Remove fields that can't be set when registering
TEMP_NEW_TASK_DEF_FILE=$(mktemp)
jq --arg batch "$BATCH_SIZE" --arg concurrency "$CONCURRENCY" '
  del(.taskDefinitionArn) |
  del(.revision) |
  del(.status) |
  del(.requiresAttributes) |
  del(.compatibilities) |
  del(.registeredAt) |
  del(.registeredBy) |
  .containerDefinitions[0].command = ["sh", "-c", "cd /app && npm run backfill-control-embeddings -- --batch-size " + $batch + " --concurrency " + $concurrency]
' "$TEMP_TASK_DEF_FILE" > "$TEMP_NEW_TASK_DEF_FILE" 2>&1

if [ $? -ne 0 ]; then
  echo "❌ Failed to process task definition JSON"
  cat "$TEMP_NEW_TASK_DEF_FILE"
  rm -f "$TEMP_TASK_DEF_FILE" "$TEMP_NEW_TASK_DEF_FILE"
  exit 1
fi

NEW_TASK_DEF_JSON=$(cat "$TEMP_NEW_TASK_DEF_FILE")
rm -f "$TEMP_TASK_DEF_FILE" "$TEMP_NEW_TASK_DEF_FILE"

# Register new task definition
TEMP_TASK_DEF_NAME="isms-${ENVIRONMENT}-backend-embeddings-backfill-$(date +%s)"
echo "📦 Registering temporary task definition: $TEMP_TASK_DEF_NAME"

# Save JSON to temp file for registration
TEMP_REGISTER_FILE=$(mktemp)
echo "$NEW_TASK_DEF_JSON" > "$TEMP_REGISTER_FILE"

NEW_TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json "file://$TEMP_REGISTER_FILE" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text 2>&1)

REGISTER_EXIT_CODE=$?
rm -f "$TEMP_REGISTER_FILE"

if [ $REGISTER_EXIT_CODE -ne 0 ] || [ -z "$NEW_TASK_DEF_ARN" ] || [ "$NEW_TASK_DEF_ARN" == "None" ]; then
  echo "❌ Failed to register task definition: $NEW_TASK_DEF_ARN"
  exit 1
fi

echo "✅ Created task definition: $NEW_TASK_DEF_ARN"
echo ""

# Get network configuration from backend service
echo "🌐 Getting network configuration..."
VPC_ID=$(aws cloudformation describe-stacks \
  --stack-name "isms-${ENVIRONMENT}-vpc" \
  --query 'Stacks[0].Outputs[?OutputKey==`VpcId`].OutputValue' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION")

PRIV_SUBNET_1=$(aws cloudformation describe-stacks \
  --stack-name "isms-${ENVIRONMENT}-vpc" \
  --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnet1Id`].OutputValue' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION")

PRIV_SUBNET_2=$(aws cloudformation describe-stacks \
  --stack-name "isms-${ENVIRONMENT}-vpc" \
  --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnet2Id`].OutputValue' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION")

ECS_SG_ID=$(aws cloudformation describe-stacks \
  --stack-name "isms-${ENVIRONMENT}-sg" \
  --query 'Stacks[0].Outputs[?OutputKey==`ECSSecurityGroupId`].OutputValue' \
  --output text \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION")

# Run one-time task (command is already set in task definition, no ECS Exec needed)
echo "🚀 Starting one-time task..."
TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER_NAME" \
  --task-definition "$NEW_TASK_DEF_ARN" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIV_SUBNET_1,$PRIV_SUBNET_2],securityGroups=[$ECS_SG_ID],assignPublicIp=DISABLED}" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --query 'tasks[0].taskArn' \
  --output text)

if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" == "None" ]; then
  echo "❌ Failed to start task"
  exit 1
fi

echo "✅ Task started: $TASK_ARN"
echo ""
echo "⏳ Waiting for task to start..."
sleep 10

# Wait for task to be running
echo "📊 Monitoring task status..."
aws ecs wait tasks-running \
  --cluster "$CLUSTER_NAME" \
  --tasks "$TASK_ARN" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" || true

echo ""
echo "✅ Task started!"
echo ""
echo "📋 Task will run the backfill command and exit when complete."
echo "   Monitor progress via CloudWatch logs:"
echo "   aws logs tail /ecs/isms-${ENVIRONMENT}-backend --follow --profile $AWS_PROFILE --region $AWS_REGION | grep -i backfill"
echo ""
echo "💡 To check task status:"
echo "   aws ecs describe-tasks --cluster $CLUSTER_NAME --tasks $TASK_ARN --profile $AWS_PROFILE --region $AWS_REGION --query 'tasks[0].{Status:lastStatus,StoppedReason:stoppedReason,ExitCode:containers[0].exitCode}'"
echo ""
echo "⏳ Waiting for task to complete (this may take 10-30 minutes)..."
echo "   The task will automatically stop after completion."
echo ""
echo "🧹 After completion, clean up the temporary task definition:"
echo "   aws ecs deregister-task-definition --task-definition $NEW_TASK_DEF_ARN --profile $AWS_PROFILE --region $AWS_REGION"
