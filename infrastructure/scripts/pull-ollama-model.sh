#!/bin/bash
# Script to pull Ollama embedding model after deployment
# Usage: ./scripts/pull-ollama-model.sh [environment] [model-name]

set -euo pipefail

ENVIRONMENT="${1:-staging}"
MODEL="${2:-nomic-embed-text}"
AWS_PROFILE="${AWS_PROFILE:-pt-sandbox}"
AWS_REGION="${AWS_REGION:-eu-west-2}"

echo "🔍 Pulling Ollama model: $MODEL"
echo "Environment: $ENVIRONMENT"
echo ""

# Get cluster name
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

# Get Ollama service name
OLLAMA_SERVICE="isms-${ENVIRONMENT}-ollama"

# Check if service exists
SERVICE_STATUS=$(aws ecs describe-services \
  --cluster "$CLUSTER_NAME" \
  --services "$OLLAMA_SERVICE" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --query 'services[0]' \
  --output json 2>/dev/null || echo "null")

if [ "$SERVICE_STATUS" == "null" ] || [ -z "$SERVICE_STATUS" ]; then
  echo "❌ Ollama service is not deployed!"
  echo "Deploy it first using: aws cloudformation deploy --template-file templates/ollama-ecs.yaml ..."
  exit 1
fi

# Get running task
echo "📋 Finding running Ollama task..."
TASK_ARN=$(aws ecs list-tasks \
  --cluster "$CLUSTER_NAME" \
  --service-name "$OLLAMA_SERVICE" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --query 'taskArns[0]' \
  --output text)

if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" == "None" ]; then
  echo "❌ No running Ollama tasks found. Is the service running?"
  exit 1
fi

echo "✅ Found task: $TASK_ARN"
echo ""

# Check if ECS Exec is enabled (required for execute-command)
echo "📥 Pulling model '$MODEL'..."
echo ""

# Try to execute command (requires ECS Exec to be enabled)
if aws ecs execute-command \
  --cluster "$CLUSTER_NAME" \
  --task "$TASK_ARN" \
  --container ollama \
  --command "ollama pull $MODEL" \
  --interactive \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" 2>&1; then
  echo ""
  echo "✅ Model pulled successfully!"
else
  echo ""
  echo "⚠️  ECS Execute Command failed or not enabled."
  echo ""
  echo "Alternative: Use AWS Systems Manager Session Manager:"
  echo "  1. Enable ECS Exec on the task definition"
  echo "  2. Or manually exec into the container using:"
  echo "     aws ecs execute-command \\"
  echo "       --cluster $CLUSTER_NAME \\"
  echo "       --task $TASK_ARN \\"
  echo "       --container ollama \\"
  echo "       --command \"ollama pull $MODEL\" \\"
  echo "       --interactive \\"
  echo "       --profile $AWS_PROFILE \\"
  echo "       --region $AWS_REGION"
  echo ""
  echo "Or create a one-time task to pull the model:"
  echo "  # Get task definition"
  echo "  TASK_DEF=\$(aws ecs describe-services --cluster $CLUSTER_NAME --services $OLLAMA_SERVICE --query 'services[0].taskDefinition' --output text --profile $AWS_PROFILE --region $AWS_REGION)"
  echo ""
  echo "  # Run one-time task"
  echo "  aws ecs run-task \\"
  echo "    --cluster $CLUSTER_NAME \\"
  echo "    --task-definition \$TASK_DEF \\"
  echo "    --launch-type FARGATE \\"
  echo "    --network-configuration \"awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=DISABLED}\" \\"
  echo "    --overrides \"{\\\"containerOverrides\\\":[{\\\"name\\\":\\\"ollama\\\",\\\"command\\\":[\\\"sh\\\",\\\"-c\\\",\\\"ollama pull $MODEL && sleep 300\\\"]}]}\" \\"
  echo "    --profile $AWS_PROFILE \\"
  echo "    --region $AWS_REGION"
fi

echo ""
echo "💡 Verify model is available:"
echo "  aws ecs execute-command \\"
echo "    --cluster $CLUSTER_NAME \\"
echo "    --task $TASK_ARN \\"
echo "    --container ollama \\"
echo "    --command \"ollama list\" \\"
echo "    --interactive \\"
echo "    --profile $AWS_PROFILE \\"
echo "    --region $AWS_REGION"
